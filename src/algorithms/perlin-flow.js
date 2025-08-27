class PerlinFlow {
    constructor() {
        this.permutation = this.generatePermutation();
        this.gradients = this.generateGradients();
        this.time = 0;
    }

    generatePermutation() {
        const perm = [];
        for (let i = 0; i < 256; i++) {
            perm[i] = i;
        }
        
        // Shuffle using Fisher-Yates algorithm
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [perm[i], perm[j]] = [perm[j], perm[i]];
        }
        
        // Duplicate to avoid buffer overflow
        return perm.concat(perm);
    }

    generateGradients() {
        const gradients = [];
        const angles = [0, 45, 90, 135, 180, 225, 270, 315];
        
        for (let i = 0; i < 256; i++) {
            const angle = (angles[i % angles.length] * Math.PI) / 180;
            gradients[i] = {
                x: Math.cos(angle),
                y: Math.sin(angle)
            };
        }
        
        return gradients;
    }

    noise2D(x, y) {
        const xi = Math.floor(x) & 255;
        const yi = Math.floor(y) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        
        const u = this.fade(xf);
        const v = this.fade(yf);
        
        const aa = this.permutation[this.permutation[xi] + yi];
        const ab = this.permutation[this.permutation[xi] + yi + 1];
        const ba = this.permutation[this.permutation[xi + 1] + yi];
        const bb = this.permutation[this.permutation[xi + 1] + yi + 1];
        
        const grad1 = this.dotGridGradient(aa, xf, yf);
        const grad2 = this.dotGridGradient(ba, xf - 1, yf);
        const grad3 = this.dotGridGradient(ab, xf, yf - 1);
        const grad4 = this.dotGridGradient(bb, xf - 1, yf - 1);
        
        const x1 = this.lerp(grad1, grad2, u);
        const x2 = this.lerp(grad3, grad4, u);
        
        return this.lerp(x1, x2, v);
    }

    noise3D(x, y, z) {
        const xi = Math.floor(x) & 255;
        const yi = Math.floor(y) & 255;
        const zi = Math.floor(z) & 255;
        
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        const zf = z - Math.floor(z);
        
        const u = this.fade(xf);
        const v = this.fade(yf);
        const w = this.fade(zf);
        
        const aaa = this.permutation[this.permutation[this.permutation[xi] + yi] + zi];
        const aba = this.permutation[this.permutation[this.permutation[xi] + yi + 1] + zi];
        const aab = this.permutation[this.permutation[this.permutation[xi] + yi] + zi + 1];
        const abb = this.permutation[this.permutation[this.permutation[xi] + yi + 1] + zi + 1];
        const baa = this.permutation[this.permutation[this.permutation[xi + 1] + yi] + zi];
        const bba = this.permutation[this.permutation[this.permutation[xi + 1] + yi + 1] + zi];
        const bab = this.permutation[this.permutation[this.permutation[xi + 1] + yi] + zi + 1];
        const bbb = this.permutation[this.permutation[this.permutation[xi + 1] + yi + 1] + zi + 1];
        
        const x1 = this.lerp(this.grad3D(aaa, xf, yf, zf), this.grad3D(baa, xf - 1, yf, zf), u);
        const x2 = this.lerp(this.grad3D(aba, xf, yf - 1, zf), this.grad3D(bba, xf - 1, yf - 1, zf), u);
        const x3 = this.lerp(this.grad3D(aab, xf, yf, zf - 1), this.grad3D(bab, xf - 1, yf, zf - 1), u);
        const x4 = this.lerp(this.grad3D(abb, xf, yf - 1, zf - 1), this.grad3D(bbb, xf - 1, yf - 1, zf - 1), u);
        
        const y1 = this.lerp(x1, x2, v);
        const y2 = this.lerp(x3, x4, v);
        
        return this.lerp(y1, y2, w);
    }

    dotGridGradient(hash, x, y) {
        const gradient = this.gradients[hash % this.gradients.length];
        return gradient.x * x + gradient.y * y;
    }

    grad3D(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }

    fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    lerp(a, b, t) {
        return a + t * (b - a);
    }

    createFlowField(width, height, scale = 0.01, timeOffset = 0) {
        const field = new Array(width * height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                const noiseValue = this.noise3D(x * scale, y * scale, timeOffset);
                const angle = noiseValue * Math.PI * 2;
                
                field[index] = {
                    x: Math.cos(angle),
                    y: Math.sin(angle),
                    magnitude: Math.abs(noiseValue)
                };
            }
        }
        
        return field;
    }

    createTurbulentFlowField(width, height, scale = 0.01, timeOffset = 0, octaves = 4) {
        const field = new Array(width * height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                
                let noiseValue = 0;
                let amplitude = 1;
                let frequency = scale;
                let maxValue = 0;
                
                // Fractal Brownian Motion
                for (let i = 0; i < octaves; i++) {
                    noiseValue += this.noise3D(x * frequency, y * frequency, timeOffset) * amplitude;
                    maxValue += amplitude;
                    amplitude *= 0.5;
                    frequency *= 2;
                }
                
                noiseValue /= maxValue;
                const angle = noiseValue * Math.PI * 4; // More chaotic
                
                field[index] = {
                    x: Math.cos(angle),
                    y: Math.sin(angle),
                    magnitude: Math.abs(noiseValue),
                    turbulence: noiseValue
                };
            }
        }
        
        return field;
    }

    createDirectionalFlow(width, height, direction, strength = 1.0, noiseInfluence = 0.3, scale = 0.01) {
        const field = new Array(width * height);
        const directionRad = (direction * Math.PI) / 180;
        const baseVector = {
            x: Math.cos(directionRad) * strength,
            y: Math.sin(directionRad) * strength
        };
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                const noiseValue = this.noise2D(x * scale, y * scale) * noiseInfluence;
                const noiseAngle = noiseValue * Math.PI * 2;
                
                const noiseVector = {
                    x: Math.cos(noiseAngle) * Math.abs(noiseValue),
                    y: Math.sin(noiseAngle) * Math.abs(noiseValue)
                };
                
                field[index] = {
                    x: baseVector.x + noiseVector.x,
                    y: baseVector.y + noiseVector.y,
                    magnitude: Math.sqrt(
                        Math.pow(baseVector.x + noiseVector.x, 2) + 
                        Math.pow(baseVector.y + noiseVector.y, 2)
                    )
                };
            }
        }
        
        return field;
    }

    createVortexFlow(width, height, centerX, centerY, strength = 1.0, falloff = 0.01) {
        const field = new Array(width * height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                const dx = x - centerX;
                const dy = y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance === 0) {
                    field[index] = {x: 0, y: 0, magnitude: 0};
                    continue;
                }
                
                // Create clockwise vortex
                const angle = Math.atan2(dy, dx) + Math.PI / 2;
                const magnitude = strength * Math.exp(-distance * falloff);
                
                field[index] = {
                    x: Math.cos(angle) * magnitude,
                    y: Math.sin(angle) * magnitude,
                    magnitude: magnitude,
                    distance: distance
                };
            }
        }
        
        return field;
    }

    createWaveFlow(width, height, wavelength = 50, amplitude = 1.0, direction = 0) {
        const field = new Array(width * height);
        const waveK = (2 * Math.PI) / wavelength;
        const dirRad = (direction * Math.PI) / 180;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                
                // Project position onto wave direction
                const projectedDistance = x * Math.cos(dirRad) + y * Math.sin(dirRad);
                const waveValue = Math.sin(projectedDistance * waveK) * amplitude;
                
                // Perpendicular to wave direction
                const perpAngle = dirRad + Math.PI / 2;
                
                field[index] = {
                    x: Math.cos(perpAngle) * waveValue,
                    y: Math.sin(perpAngle) * waveValue,
                    magnitude: Math.abs(waveValue),
                    wave: waveValue
                };
            }
        }
        
        return field;
    }

    createSwarmFlow(width, height, boids = 8, strength = 1.0, timeOffset = 0) {
        const field = new Array(width * height);
        
        // Initialize boids if not already done or if parameters changed
        if (!this.swarmBoids || this.swarmBoids.length !== boids) {
            this.swarmBoids = [];
            for (let i = 0; i < boids; i++) {
                // Create more varied initial conditions
                const angle = (Math.random() * Math.PI * 2);
                const speed = 0.3 + Math.random() * 0.7; // More varied speeds
                
                this.swarmBoids.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    speed: speed,
                    individualBehavior: Math.random() * 0.5 // Add individual variation
                });
            }
        }
        
        // Update boid positions with flocking behavior
        const swarmBoids = this.swarmBoids;
        const separationRadius = Math.min(width, height) * 0.05; // Smaller radius for more varied behavior
        const alignmentRadius = Math.min(width, height) * 0.08;
        const cohesionRadius = Math.min(width, height) * 0.1;
        
        // Calculate flocking forces for each boid
        for (let i = 0; i < swarmBoids.length; i++) {
            const boid = swarmBoids[i];
            let separationX = 0, separationY = 0;
            let alignmentX = 0, alignmentY = 0;
            let cohesionX = 0, cohesionY = 0;
            let separationCount = 0, alignmentCount = 0, cohesionCount = 0;
            
            // Check interactions with other boids
            for (let j = 0; j < swarmBoids.length; j++) {
                if (i === j) continue;
                
                const other = swarmBoids[j];
                const dx = boid.x - other.x;
                const dy = boid.y - other.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // Separation (avoid crowding)
                if (distance < separationRadius && distance > 0) {
                    separationX += dx / distance;
                    separationY += dy / distance;
                    separationCount++;
                }
                
                // Alignment (steer towards average heading)
                if (distance < alignmentRadius) {
                    alignmentX += other.vx;
                    alignmentY += other.vy;
                    alignmentCount++;
                }
                
                // Cohesion (steer towards average position)
                if (distance < cohesionRadius) {
                    cohesionX += other.x;
                    cohesionY += other.y;
                    cohesionCount++;
                }
            }
            
            // Apply flocking forces
            if (separationCount > 0) {
                separationX /= separationCount;
                separationY /= separationCount;
            }
            
            if (alignmentCount > 0) {
                alignmentX /= alignmentCount;
                alignmentY /= alignmentCount;
            }
            
            if (cohesionCount > 0) {
                cohesionX = (cohesionX / cohesionCount) - boid.x;
                cohesionY = (cohesionY / cohesionCount) - boid.y;
            }
            
            // Update velocity with flocking behavior - use individual behavior variation
            const individualFactor = boid.individualBehavior;
            boid.vx += separationX * (0.15 + individualFactor * 0.1) + 
                      alignmentX * (0.01 + individualFactor * 0.02) + 
                      cohesionX * (0.03 + individualFactor * 0.02);
            boid.vy += separationY * (0.15 + individualFactor * 0.1) + 
                      alignmentY * (0.01 + individualFactor * 0.02) + 
                      cohesionY * (0.03 + individualFactor * 0.02);
            
            // Add individual randomness to prevent uniform behavior
            boid.vx += (Math.random() - 0.5) * 0.15 * (1 + individualFactor);
            boid.vy += (Math.random() - 0.5) * 0.15 * (1 + individualFactor);
            
            // Limit speed - keep reasonable bounds
            const maxSpeed = boid.speed * 1.5;
            const speed = Math.sqrt(boid.vx * boid.vx + boid.vy * boid.vy);
            if (speed > maxSpeed) {
                boid.vx = (boid.vx / speed) * maxSpeed;
                boid.vy = (boid.vy / speed) * maxSpeed;
            }
            
            // Update position
            boid.x += boid.vx;
            boid.y += boid.vy;
            
            // Wrap around edges
            boid.x = (boid.x + width) % width;
            boid.y = (boid.y + height) % height;
        }
        
        // Generate flow field based on boid influences
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                let totalX = 0, totalY = 0, totalInfluence = 0;
                
                // Calculate influence from each boid
                for (let boid of swarmBoids) {
                    const dx = x - boid.x;
                    const dy = y - boid.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // Much smaller, more localized influence radius
                    const maxInfluenceDistance = Math.min(width, height) * 0.15; // Limit influence range
                    if (distance > maxInfluenceDistance) continue;
                    
                    const influence = Math.exp(-distance * 0.02) * strength; // Tighter falloff
                    
                    if (influence > 0.05) {
                        // Create varied flow - mix boid direction with positional forces
                        const boidInfluenceX = boid.vx * influence * 2;
                        const boidInfluenceY = boid.vy * influence * 2;
                        
                        // Add radial force away from boid center for more variation
                        const radialX = (dx / (distance + 1)) * influence * 0.5;
                        const radialY = (dy / (distance + 1)) * influence * 0.5;
                        
                        totalX += boidInfluenceX + radialX;
                        totalY += boidInfluenceY + radialY;
                        totalInfluence += influence;
                    }
                }
                
                // Normalize and add some noise for organic feel
                if (totalInfluence > 0) {
                    totalX /= totalInfluence;
                    totalY /= totalInfluence;
                }
                
                // Add subtle noise
                const noiseValue = this.noise2D(x * 0.01, y * 0.01 + timeOffset * 0.1);
                const noiseAngle = noiseValue * Math.PI * 0.5;
                totalX += Math.cos(noiseAngle) * 0.1;
                totalY += Math.sin(noiseAngle) * 0.1;
                
                field[index] = {
                    x: totalX,
                    y: totalY,
                    magnitude: Math.sqrt(totalX * totalX + totalY * totalY),
                    swarm: totalInfluence
                };
            }
        }
        
        return field;
    }

    createMagneticFlow(width, height, poles = 4, strength = 1.0, polarity = 'mixed') {
        const field = new Array(width * height);
        
        // Generate magnetic poles
        const magneticPoles = [];
        for (let i = 0; i < poles; i++) {
            let charge;
            switch (polarity) {
                case 'all_positive':
                    charge = 1;
                    break;
                case 'all_negative':
                    charge = -1;
                    break;
                case 'mixed':
                default:
                    charge = i % 2 === 0 ? 1 : -1; // Alternate positive/negative
                    break;
            }
            
            magneticPoles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                charge: charge,
                strength: strength * (0.8 + Math.random() * 0.4) // Vary individual pole strength
            });
        }
        
        // Generate magnetic field
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                let totalX = 0, totalY = 0;
                
                // Calculate field contribution from each pole
                for (let pole of magneticPoles) {
                    const dx = x - pole.x;
                    const dy = y - pole.y;
                    const distanceSquared = dx * dx + dy * dy;
                    const distance = Math.sqrt(distanceSquared);
                    
                    // Avoid division by zero at pole centers
                    if (distance < 2) continue;
                    
                    // Magnetic field strength falls off with distance squared - much stronger
                    const fieldStrength = (pole.charge * pole.strength * 100) / Math.max(distanceSquared, 4);
                    
                    // Field lines point away from positive charges, toward negative charges
                    const fieldX = (dx / distance) * fieldStrength;
                    const fieldY = (dy / distance) * fieldStrength;
                    
                    totalX += fieldX;
                    totalY += fieldY;
                }
                
                // For dipole-like effects, create field lines that curve between opposite charges
                if (poles >= 2 && polarity === 'mixed') {
                    // Find closest positive and negative poles
                    let closestPositive = null, closestNegative = null;
                    let minPosDistance = Infinity, minNegDistance = Infinity;
                    
                    for (let pole of magneticPoles) {
                        const dx = x - pole.x;
                        const dy = y - pole.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (pole.charge > 0 && distance < minPosDistance) {
                            closestPositive = pole;
                            minPosDistance = distance;
                        } else if (pole.charge < 0 && distance < minNegDistance) {
                            closestNegative = pole;
                            minNegDistance = distance;
                        }
                    }
                    
                    // Add dipole field lines
                    if (closestPositive && closestNegative) {
                        const dipoleX = closestNegative.x - closestPositive.x;
                        const dipoleY = closestNegative.y - closestPositive.y;
                        const dipoleDistance = Math.sqrt(dipoleX * dipoleX + dipoleY * dipoleY);
                        
                        if (dipoleDistance > 0) {
                            // Create curved field lines
                            const posX = x - closestPositive.x;
                            const posY = y - closestPositive.y;
                            const negX = x - closestNegative.x;
                            const negY = y - closestNegative.y;
                            
                            const posDistance = Math.sqrt(posX * posX + posY * posY);
                            const negDistance = Math.sqrt(negX * negX + negY * negY);
                            
                            // Blend field based on relative distances
                            const blendFactor = posDistance / (posDistance + negDistance);
                            const curveStrength = 2.0 * strength; // Much stronger curves
                            
                            // Perpendicular component for curved field lines
                            const perpX = -dipoleY / dipoleDistance;
                            const perpY = dipoleX / dipoleDistance;
                            
                            const curveX = perpX * curveStrength * Math.sin(blendFactor * Math.PI);
                            const curveY = perpY * curveStrength * Math.sin(blendFactor * Math.PI);
                            
                            totalX += curveX;
                            totalY += curveY;
                        }
                    }
                }
                
                // Add subtle noise for more organic field lines
                const noiseValue = this.noise2D(x * 0.005, y * 0.005);
                const noiseAngle = noiseValue * Math.PI * 0.2;
                totalX += Math.cos(noiseAngle) * 0.2 * strength;
                totalY += Math.sin(noiseAngle) * 0.2 * strength;
                
                field[index] = {
                    x: totalX,
                    y: totalY,
                    magnitude: Math.sqrt(totalX * totalX + totalY * totalY),
                    magnetic: true
                };
            }
        }
        
        return field;
    }

    interpolateField(field1, field2, factor, width, height) {
        const result = new Array(width * height);
        
        for (let i = 0; i < width * height; i++) {
            result[i] = {
                x: this.lerp(field1[i].x, field2[i].x, factor),
                y: this.lerp(field1[i].y, field2[i].y, factor),
                magnitude: this.lerp(field1[i].magnitude, field2[i].magnitude, factor)
            };
        }
        
        return result;
    }

    sampleField(field, x, y, width, height) {
        // Clamp coordinates
        x = Math.max(0, Math.min(width - 1, x));
        y = Math.max(0, Math.min(height - 1, y));
        
        const index = Math.floor(y) * width + Math.floor(x);
        return field[index] || {x: 0, y: 0, magnitude: 0};
    }

    bilinearSampleField(field, x, y, width, height) {
        const x1 = Math.floor(x);
        const y1 = Math.floor(y);
        const x2 = Math.min(x1 + 1, width - 1);
        const y2 = Math.min(y1 + 1, height - 1);
        
        const fx = x - x1;
        const fy = y - y1;
        
        const a = this.sampleField(field, x1, y1, width, height);
        const b = this.sampleField(field, x2, y1, width, height);
        const c = this.sampleField(field, x1, y2, width, height);
        const d = this.sampleField(field, x2, y2, width, height);
        
        const top = {
            x: this.lerp(a.x, b.x, fx),
            y: this.lerp(a.y, b.y, fx),
            magnitude: this.lerp(a.magnitude, b.magnitude, fx)
        };
        
        const bottom = {
            x: this.lerp(c.x, d.x, fx),
            y: this.lerp(c.y, d.y, fx),
            magnitude: this.lerp(c.magnitude, d.magnitude, fx)
        };
        
        return {
            x: this.lerp(top.x, bottom.x, fy),
            y: this.lerp(top.y, bottom.y, fy),
            magnitude: this.lerp(top.magnitude, bottom.magnitude, fy)
        };
    }

    advanceTime(deltaTime = 0.01) {
        this.time += deltaTime;
    }

    getTime() {
        return this.time;
    }

    visualizeField(canvas, field, scale = 10, alpha = 0.3) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const fieldWidth = Math.sqrt(field.length * width / height);
        const fieldHeight = field.length / fieldWidth;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 1;
        
        for (let y = 0; y < fieldHeight; y += scale) {
            for (let x = 0; x < fieldWidth; x += scale) {
                const index = Math.floor(y) * Math.floor(fieldWidth) + Math.floor(x);
                if (index >= field.length) continue;
                
                const vector = field[index];
                const startX = x * (width / fieldWidth);
                const startY = y * (height / fieldHeight);
                const endX = startX + vector.x * scale * vector.magnitude;
                const endY = startY + vector.y * scale * vector.magnitude;
                
                ctx.beginPath();
                ctx.moveTo(startX, startY);
                ctx.lineTo(endX, endY);
                ctx.stroke();
                
                // Arrow head
                const angle = Math.atan2(vector.y, vector.x);
                const arrowLength = 3;
                ctx.beginPath();
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - arrowLength * Math.cos(angle - Math.PI / 6),
                    endY - arrowLength * Math.sin(angle - Math.PI / 6)
                );
                ctx.moveTo(endX, endY);
                ctx.lineTo(
                    endX - arrowLength * Math.cos(angle + Math.PI / 6),
                    endY - arrowLength * Math.sin(angle + Math.PI / 6)
                );
                ctx.stroke();
            }
        }
        
        ctx.restore();
    }
}