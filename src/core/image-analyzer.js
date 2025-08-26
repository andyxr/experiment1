class ImageAnalyzer {
    constructor() {
        this.regions = [];
        this.originalImageData = null;
        this.analysisCanvas = null;
        this.analysisCtx = null;
        this.threshold = 30;
    }

    setThreshold(value) {
        this.threshold = value;
    }

    analyzeImage(imageData, width, height) {
        this.originalImageData = new Uint8ClampedArray(imageData.data);
        
        if (!this.analysisCanvas) {
            this.analysisCanvas = document.createElement('canvas');
            this.analysisCtx = this.analysisCanvas.getContext('2d');
        }
        
        this.analysisCanvas.width = width;
        this.analysisCanvas.height = height;
        
        const tempImageData = new ImageData(this.originalImageData, width, height);
        this.analysisCtx.putImageData(tempImageData, 0, 0);
        
        this.regions = this.segmentImage(width, height);
        return this.regions;
    }

    segmentImage(width, height) {
        const visited = new Array(width * height).fill(false);
        const regions = [];
        const data = this.originalImageData;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                
                if (!visited[index]) {
                    const region = this.regionGrow(x, y, width, height, visited, data);
                    if (region.pixels.length > 50) { // Minimum region size
                        regions.push(region);
                    }
                }
            }
        }

        return this.consolidateRegions(regions, width, height);
    }

    regionGrow(startX, startY, width, height, visited, data) {
        const stack = [{x: startX, y: startY}];
        const pixels = [];
        const seedIndex = startY * width + startX;
        const seedColor = {
            r: data[seedIndex * 4],
            g: data[seedIndex * 4 + 1],
            b: data[seedIndex * 4 + 2]
        };
        
        let totalR = 0, totalG = 0, totalB = 0;
        let minX = width, maxX = 0, minY = height, maxY = 0;

        while (stack.length > 0) {
            const {x, y} = stack.pop();
            const index = y * width + x;

            if (x < 0 || x >= width || y < 0 || y >= height || visited[index]) {
                continue;
            }

            const pixelColor = {
                r: data[index * 4],
                g: data[index * 4 + 1],
                b: data[index * 4 + 2]
            };

            if (this.colorDistance(seedColor, pixelColor) > this.threshold) {
                continue;
            }

            visited[index] = true;
            pixels.push({x, y, index});
            
            totalR += pixelColor.r;
            totalG += pixelColor.g;
            totalB += pixelColor.b;
            
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);

            // Add neighbors
            stack.push({x: x + 1, y});
            stack.push({x: x - 1, y});
            stack.push({x, y: y + 1});
            stack.push({x, y: y - 1});
        }

        const avgColor = {
            r: Math.round(totalR / pixels.length),
            g: Math.round(totalG / pixels.length),
            b: Math.round(totalB / pixels.length)
        };

        const brightness = (avgColor.r * 0.299 + avgColor.g * 0.587 + avgColor.b * 0.114) / 255;
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        return {
            pixels,
            avgColor,
            brightness,
            bounds: {minX, maxX, minY, maxY},
            center: {x: centerX, y: centerY},
            size: pixels.length
        };
    }

    colorDistance(color1, color2) {
        const dr = color1.r - color2.r;
        const dg = color1.g - color2.g;
        const db = color1.b - color2.b;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    }

    consolidateRegions(regions, width, height) {
        // Sort regions by size (largest first)
        regions.sort((a, b) => b.size - a.size);
        
        // Keep only significant regions and calculate movement properties
        const significantRegions = regions.slice(0, Math.min(100, regions.length));
        
        return significantRegions.map((region, index) => {
            const hue = this.rgbToHue(region.avgColor);
            const saturation = this.rgbToSaturation(region.avgColor);
            
            return {
                ...region,
                id: index,
                hue,
                saturation,
                movementVector: {x: 0, y: 0},
                velocityMultiplier: this.calculateVelocityMultiplier(region),
                mass: Math.log(region.size + 1) / 10
            };
        });
    }

    calculateVelocityMultiplier(region) {
        // Brighter regions move slower (like hot air rising slowly)
        // Darker regions move faster (like heavy objects falling)
        const brightnessFactor = Math.pow(1 - region.brightness, 0.5);
        
        // Larger regions move slower
        const sizeFactor = 1 / (1 + Math.log(region.size) / 1000);
        
        return brightnessFactor * sizeFactor * (0.5 + Math.random() * 0.5);
    }

    rgbToHue(color) {
        const r = color.r / 255;
        const g = color.g / 255;
        const b = color.b / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;
        
        if (diff === 0) return 0;
        
        let hue;
        switch (max) {
            case r: hue = (g - b) / diff + (g < b ? 6 : 0); break;
            case g: hue = (b - r) / diff + 2; break;
            case b: hue = (r - g) / diff + 4; break;
        }
        
        return hue * 60;
    }

    rgbToSaturation(color) {
        const r = color.r / 255;
        const g = color.g / 255;
        const b = color.b / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        
        if (max === 0) return 0;
        return (max - min) / max;
    }

    getBrightnessMap(width, height) {
        const brightnessMap = new Float32Array(width * height);
        const data = this.originalImageData;
        
        for (let i = 0; i < width * height; i++) {
            const r = data[i * 4];
            const g = data[i * 4 + 1];
            const b = data[i * 4 + 2];
            brightnessMap[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        }
        
        return brightnessMap;
    }

    getEdgeMap(width, height) {
        const edgeMap = new Float32Array(width * height);
        const data = this.originalImageData;
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const index = y * width + x;
                
                // Sobel edge detection
                const sobelX = this.getSobelX(x, y, width, data);
                const sobelY = this.getSobelY(x, y, width, data);
                
                edgeMap[index] = Math.sqrt(sobelX * sobelX + sobelY * sobelY);
            }
        }
        
        return edgeMap;
    }

    getSobelX(x, y, width, data) {
        const kernel = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        let sum = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
                const index = ((y + ky) * width + (x + kx)) * 4;
                const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
                sum += brightness * kernel[(ky + 1) * 3 + (kx + 1)];
            }
        }
        
        return sum;
    }

    getSobelY(x, y, width, data) {
        const kernel = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
        let sum = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
                const index = ((y + ky) * width + (x + kx)) * 4;
                const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
                sum += brightness * kernel[(ky + 1) * 3 + (kx + 1)];
            }
        }
        
        return sum;
    }

    visualizeRegions(canvas, regions) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        const colors = this.generateRegionColors(regions.length);
        
        // Fill with original image
        for (let i = 0; i < this.originalImageData.length; i++) {
            imageData.data[i] = this.originalImageData[i];
        }
        
        // Overlay region boundaries
        regions.forEach((region, regionIndex) => {
            const color = colors[regionIndex];
            region.pixels.forEach(pixel => {
                const index = pixel.index * 4;
                // Blend with original
                imageData.data[index] = Math.round(imageData.data[index] * 0.7 + color.r * 0.3);
                imageData.data[index + 1] = Math.round(imageData.data[index + 1] * 0.7 + color.g * 0.3);
                imageData.data[index + 2] = Math.round(imageData.data[index + 2] * 0.7 + color.b * 0.3);
            });
        });
        
        ctx.putImageData(imageData, 0, 0);
        
        // Draw region centers
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        regions.forEach(region => {
            ctx.beginPath();
            ctx.arc(region.center.x, region.center.y, 5, 0, Math.PI * 2);
            ctx.stroke();
        });
    }

    generateRegionColors(count) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const hue = (i * 137.508) % 360; // Golden angle
            colors.push(this.hslToRgb(hue, 0.7, 0.5));
        }
        return colors;
    }

    hslToRgb(h, s, l) {
        h /= 360;
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h * 6) % 2 - 1));
        const m = l - c / 2;
        
        let r, g, b;
        if (h < 1/6) [r, g, b] = [c, x, 0];
        else if (h < 2/6) [r, g, b] = [x, c, 0];
        else if (h < 3/6) [r, g, b] = [0, c, x];
        else if (h < 4/6) [r, g, b] = [0, x, c];
        else if (h < 5/6) [r, g, b] = [x, 0, c];
        else [r, g, b] = [c, 0, x];
        
        return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255)
        };
    }
}