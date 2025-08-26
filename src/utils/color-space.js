class ColorSpace {
    static rgbToHsl(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        
        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        
        return { h: h * 360, s: s * 100, l: l * 100 };
    }
    
    static hslToRgb(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;
        
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h * 6) % 2 - 1));
        const m = l - c / 2;
        
        let r, g, b;
        
        if (h < 1/6) {
            [r, g, b] = [c, x, 0];
        } else if (h < 2/6) {
            [r, g, b] = [x, c, 0];
        } else if (h < 3/6) {
            [r, g, b] = [0, c, x];
        } else if (h < 4/6) {
            [r, g, b] = [0, x, c];
        } else if (h < 5/6) {
            [r, g, b] = [x, 0, c];
        } else {
            [r, g, b] = [c, 0, x];
        }
        
        return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255)
        };
    }
    
    static rgbToLab(r, g, b) {
        // First convert to XYZ
        const xyz = this.rgbToXyz(r, g, b);
        return this.xyzToLab(xyz.x, xyz.y, xyz.z);
    }
    
    static rgbToXyz(r, g, b) {
        r = r / 255;
        g = g / 255;
        b = b / 255;
        
        // Apply gamma correction
        r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
        g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
        b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
        
        // Convert to XYZ using sRGB matrix
        const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
        const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
        const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
        
        return { x: x * 100, y: y * 100, z: z * 100 };
    }
    
    static xyzToLab(x, y, z) {
        // Normalize for D65 illuminant
        x = x / 95.047;
        y = y / 100.000;
        z = z / 108.883;
        
        // Apply cubic root transform
        x = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x + 16/116);
        y = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y + 16/116);
        z = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z + 16/116);
        
        const l = (116 * y) - 16;
        const a = 500 * (x - y);
        const b = 200 * (y - z);
        
        return { l, a, b };
    }
    
    static deltaE(lab1, lab2) {
        // CIE76 Delta E formula
        const deltaL = lab1.l - lab2.l;
        const deltaA = lab1.a - lab2.a;
        const deltaB = lab1.b - lab2.b;
        
        return Math.sqrt(deltaL * deltaL + deltaA * deltaA + deltaB * deltaB);
    }
    
    static rgbDistance(rgb1, rgb2) {
        const dr = rgb1.r - rgb2.r;
        const dg = rgb1.g - rgb2.g;
        const db = rgb1.b - rgb2.b;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }
    
    static perceptualDistance(rgb1, rgb2) {
        const lab1 = this.rgbToLab(rgb1.r, rgb1.g, rgb1.b);
        const lab2 = this.rgbToLab(rgb2.r, rgb2.g, rgb2.b);
        return this.deltaE(lab1, lab2);
    }
    
    static getBrightness(r, g, b) {
        // Luminance formula
        return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
    }
    
    static getContrast(rgb1, rgb2) {
        const l1 = this.getBrightness(rgb1.r, rgb1.g, rgb1.b);
        const l2 = this.getBrightness(rgb2.r, rgb2.g, rgb2.b);
        
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        
        return (lighter + 0.05) / (darker + 0.05);
    }
    
    static adjustBrightness(r, g, b, factor) {
        return {
            r: Math.min(255, Math.max(0, r * factor)),
            g: Math.min(255, Math.max(0, g * factor)),
            b: Math.min(255, Math.max(0, b * factor))
        };
    }
    
    static adjustSaturation(r, g, b, factor) {
        const hsl = this.rgbToHsl(r, g, b);
        hsl.s = Math.min(100, Math.max(0, hsl.s * factor));
        return this.hslToRgb(hsl.h, hsl.s, hsl.l);
    }
    
    static complementaryColor(r, g, b) {
        const hsl = this.rgbToHsl(r, g, b);
        hsl.h = (hsl.h + 180) % 360;
        return this.hslToRgb(hsl.h, hsl.s, hsl.l);
    }
    
    static analogousColors(r, g, b, count = 2, angle = 30) {
        const hsl = this.rgbToHsl(r, g, b);
        const colors = [];
        
        for (let i = 1; i <= count; i++) {
            const h1 = (hsl.h + angle * i) % 360;
            const h2 = (hsl.h - angle * i + 360) % 360;
            
            colors.push(this.hslToRgb(h1, hsl.s, hsl.l));
            if (i <= count / 2) {
                colors.push(this.hslToRgb(h2, hsl.s, hsl.l));
            }
        }
        
        return colors;
    }
    
    static triadicColors(r, g, b) {
        const hsl = this.rgbToHsl(r, g, b);
        return [
            this.hslToRgb((hsl.h + 120) % 360, hsl.s, hsl.l),
            this.hslToRgb((hsl.h + 240) % 360, hsl.s, hsl.l)
        ];
    }
    
    static monochromaticColors(r, g, b, count = 5) {
        const hsl = this.rgbToHsl(r, g, b);
        const colors = [];
        
        for (let i = 0; i < count; i++) {
            const lightness = Math.min(100, Math.max(0, hsl.l + (i - count/2) * 20));
            colors.push(this.hslToRgb(hsl.h, hsl.s, lightness));
        }
        
        return colors;
    }
    
    static blendColors(rgb1, rgb2, factor = 0.5) {
        return {
            r: Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor),
            g: Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor),
            b: Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor)
        };
    }
    
    static getDominantColors(imageData, colorCount = 5) {
        const colors = new Map();
        const data = imageData.data;
        
        // Sample every 4th pixel for performance
        for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            if (a > 128) { // Ignore transparent pixels
                // Quantize colors to reduce variations
                const qr = Math.floor(r / 16) * 16;
                const qg = Math.floor(g / 16) * 16;
                const qb = Math.floor(b / 16) * 16;
                const key = `${qr},${qg},${qb}`;
                
                colors.set(key, (colors.get(key) || 0) + 1);
            }
        }
        
        // Sort by frequency and return top colors
        return Array.from(colors.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, colorCount)
            .map(([color, count]) => {
                const [r, g, b] = color.split(',').map(Number);
                return { r, g, b, count };
            });
    }
    
    static createColorPalette(baseColor, scheme = 'complementary') {
        const { r, g, b } = baseColor;
        
        switch (scheme) {
            case 'complementary':
                return [baseColor, this.complementaryColor(r, g, b)];
            case 'analogous':
                return [baseColor, ...this.analogousColors(r, g, b, 2, 30)];
            case 'triadic':
                return [baseColor, ...this.triadicColors(r, g, b)];
            case 'monochromatic':
                return this.monochromaticColors(r, g, b, 5);
            default:
                return [baseColor];
        }
    }
}