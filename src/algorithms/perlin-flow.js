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

    createCellularFlow(width, height, cells = 8, strength = 1.0, timeOffset = 0) {
        const field = new Array(width * height);
        
        // Initialize cell centers if not already done or if parameters changed
        if (!this.cellularCenters || this.cellularCenters.length !== cells) {
            this.cellularCenters = [];
            for (let i = 0; i < cells; i++) {
                this.cellularCenters.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    radius: 8 + Math.random() * 12, // Slightly larger cells
                    growthRate: 0.03 + Math.random() * 0.04, // Faster growth
                    phase: Math.random() * Math.PI * 2, // Phase offset for pulsing
                    divisionTimer: 50 + Math.random() * 150 // Much faster division (was 500)
                });
            }
        }
        
        // Update cellular growth and division
        const cellularCenters = this.cellularCenters;
        const currentTime = timeOffset * 100; // Scale time for cellular processes
        
        for (let cell of cellularCenters) {
            // Pulsing growth/shrink cycle
            const pulseFactor = Math.sin(currentTime * cell.growthRate + cell.phase);
            cell.currentRadius = cell.radius * (1 + pulseFactor * 0.3);
            
            // Simulate cell division (split into two cells occasionally)
            cell.divisionTimer -= 1;
            if (cell.divisionTimer <= 0 && cellularCenters.length < cells * 2.5) { // Allow more cells (2.5x instead of 1.5x)
                // Create daughter cell nearby
                const angle = Math.random() * Math.PI * 2;
                const distance = cell.currentRadius * 1.5;
                cellularCenters.push({
                    x: cell.x + Math.cos(angle) * distance,
                    y: cell.y + Math.sin(angle) * distance,
                    radius: cell.radius * 0.8, // Slightly larger daughter cells
                    growthRate: cell.growthRate + (Math.random() - 0.5) * 0.02, // More growth variation
                    phase: Math.random() * Math.PI * 2,
                    divisionTimer: 40 + Math.random() * 120 // Much faster division cycle
                });
                
                // Reset parent cell
                cell.radius *= 0.9; // Less shrinkage after division
                cell.divisionTimer = 60 + Math.random() * 100; // Much faster next division
                
                // Keep cell positions within bounds
                cellularCenters.forEach(c => {
                    c.x = Math.max(c.currentRadius, Math.min(width - c.currentRadius, c.x));
                    c.y = Math.max(c.currentRadius, Math.min(height - c.currentRadius, c.y));
                });
                
                break; // Only one division per frame
            }
        }
        
        // Generate flow field based on cellular structure
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                let totalX = 0, totalY = 0, totalInfluence = 0;
                
                // Calculate influence from each cell
                for (let cell of cellularCenters) {
                    const dx = x - cell.x;
                    const dy = y - cell.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // Cell membrane effect - strongest flow at cell boundary
                    const cellRadius = cell.currentRadius;
                    let influence = 0;
                    
                    if (distance < cellRadius * 0.3) {
                        // Inside cell core - gentle outward flow
                        influence = strength * 0.3;
                        const coreFlowX = (dx / (distance + 1)) * influence;
                        const coreFlowY = (dy / (distance + 1)) * influence;
                        totalX += coreFlowX;
                        totalY += coreFlowY;
                    } else if (distance < cellRadius) {
                        // Near cell membrane - strong circular flow
                        influence = strength * Math.exp(-(distance - cellRadius * 0.7) * 3);
                        
                        // Tangential flow around cell membrane
                        const tangentX = -dy / (distance + 1);
                        const tangentY = dx / (distance + 1);
                        
                        // Mix of outward and circular flow
                        const radialX = dx / (distance + 1);
                        const radialY = dy / (distance + 1);
                        
                        totalX += (tangentX * 0.7 + radialX * 0.3) * influence;
                        totalY += (tangentY * 0.7 + radialY * 0.3) * influence;
                    } else if (distance < cellRadius * 2) {
                        // Outside cell - weak inward flow (nutrient absorption)
                        influence = strength * 0.2 * Math.exp(-(distance - cellRadius) * 0.1);
                        const inwardX = (-dx / (distance + 1)) * influence;
                        const inwardY = (-dy / (distance + 1)) * influence;
                        totalX += inwardX;
                        totalY += inwardY;
                    }
                    
                    totalInfluence += influence;
                }
                
                // Add subtle noise for organic feel
                const noiseValue = this.noise2D(x * 0.02, y * 0.02 + timeOffset * 0.1);
                const noiseAngle = noiseValue * Math.PI;
                totalX += Math.cos(noiseAngle) * 0.1 * strength;
                totalY += Math.sin(noiseAngle) * 0.1 * strength;
                
                field[index] = {
                    x: totalX,
                    y: totalY,
                    magnitude: Math.sqrt(totalX * totalX + totalY * totalY),
                    cellular: totalInfluence
                };
            }
        }
        
        return field;
    }

    createCentrifugalFlow(width, height, centerX, centerY, strength = 1.0, rotationSpeed = 0.02, timeOffset = 0) {
        const field = new Array(width * height);
        
        // Calculate dynamic rotation angle based on time
        const rotationAngle = timeOffset * rotationSpeed;
        
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
                
                // Normalize distance vectors
                const normalizedX = dx / distance;
                const normalizedY = dy / distance;
                
                // Calculate base rotational velocity (tangent to radius)
                // Rotate by 90 degrees for tangential flow
                const tangentX = -normalizedY;
                const tangentY = normalizedX;
                
                // Apply rotation based on time (makes the whole field rotate)
                const cosRot = Math.cos(rotationAngle);
                const sinRot = Math.sin(rotationAngle);
                const rotatedTangentX = tangentX * cosRot - tangentY * sinRot;
                const rotatedTangentY = tangentX * sinRot + tangentY * cosRot;
                
                // Centrifugal force: outward radial acceleration (increases with distance) - PROPERLY SCALED BY STRENGTH
                const centrifugalStrength = strength * Math.min(distance * 0.3 * strength, 8.0 * strength); // Scale cap by strength too
                const centrifugalX = normalizedX * centrifugalStrength;
                const centrifugalY = normalizedY * centrifugalStrength;
                
                // Rotational force: decreases with distance (like a spinning disc) - PROPERLY SCALED BY STRENGTH
                const rotationalStrength = strength * Math.exp(-distance * 0.003) * 3.0 * strength; // Scale by strength squared for more effect
                const rotationalX = rotatedTangentX * rotationalStrength;
                const rotationalY = rotatedTangentY * rotationalStrength;
                
                // Combine centrifugal and rotational forces
                let combinedX = centrifugalX + rotationalX;
                let combinedY = centrifugalY + rotationalY;
                
                // Add subtle noise for organic variation - REDUCED so it doesn't mask centrifugal effect
                const noiseValue = this.noise3D(x * 0.01, y * 0.01, timeOffset * 0.5);
                const noiseAngle = noiseValue * Math.PI * 0.1;  // Reduced from 0.3
                const noiseStrength = strength * 0.05;  // Reduced from 0.2
                combinedX += Math.cos(noiseAngle) * noiseStrength;
                combinedY += Math.sin(noiseAngle) * noiseStrength;
                
                // Add spiral effect for more dynamic motion - PROPERLY SCALED BY STRENGTH
                const spiralFactor = Math.sin(distance * 0.1 + timeOffset * 2) * 1.0 * strength;  // Scale by strength
                combinedX += rotatedTangentX * spiralFactor;
                combinedY += rotatedTangentY * spiralFactor;
                
                field[index] = {
                    x: combinedX,
                    y: combinedY,
                    magnitude: Math.sqrt(combinedX * combinedX + combinedY * combinedY),
                    centrifugal: true,
                    distance: distance
                };
            }
        }
        
        return field;
    }

    createRadialFlow(width, height, centerX, centerY, strength = 1.0, timeOffset = 0) {
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
                
                // Normalize direction vectors
                const normalizedX = dx / distance;
                const normalizedY = dy / distance;
                
                // Base radial force - scaled for better visibility at low strengths
                let radialStrength = strength * 1.0; // Increased from 0.3 to 1.0 for better low-strength response
                
                // Add distance-based scaling for explosion effect
                // Adjust falloff for better low-strength visibility
                const distanceFalloff = Math.max(0.6, Math.exp(-distance * 0.002)); // Slightly stronger falloff
                radialStrength *= distanceFalloff;
                
                // Apply strength scaling directly - no minimum needed since forces work fine at low values
                radialStrength *= strength;
                
                const radialX = normalizedX * radialStrength;
                const radialY = normalizedY * radialStrength;
                
                // Add minimal noise for organic variation
                const noiseValue = this.noise3D(x * 0.02, y * 0.02, timeOffset * 0.3);
                const noiseAngle = noiseValue * Math.PI * 0.05; // Very minimal noise influence
                const noiseStrength = strength * 0.02; // Use direct strength scaling
                const noiseX = Math.cos(noiseAngle) * noiseStrength;
                const noiseY = Math.sin(noiseAngle) * noiseStrength;
                
                // Add very subtle pulsing effect based on time
                const pulsePhase = timeOffset * 1.0 + distance * 0.02; // Even slower pulsing
                const pulseFactor = 1.0 + Math.sin(pulsePhase) * 0.05 * strength; // Use direct strength
                
                // Combine forces
                const finalX = (radialX + noiseX) * pulseFactor;
                const finalY = (radialY + noiseY) * pulseFactor;
                
                
                field[index] = {
                    x: finalX,
                    y: finalY,
                    magnitude: Math.sqrt(finalX * finalX + finalY * finalY),
                    radial: true,
                    distance: distance
                };
            }
        }
        
        return field;
    }

    createChromaticFlow(width, height, strength = 1.0, timeOffset = 0, scale = 0.01) {
        const field = new Array(width * height);
        
        // Create EXTREMELY chaotic and different patterns
        const centerX = width / 2;
        const centerY = height / 2;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                
                // Distance and angle from center
                const dx = x - centerX;
                const dy = y - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                
                // Create 3 VERY different patterns that interfere with each other
                
                // Pattern 1: Spiraling waves
                const spiral1 = Math.sin(distance * 0.3 + angle * 3 + timeOffset * 5);
                const spiral2 = Math.cos(distance * 0.2 - angle * 2 + timeOffset * 3);
                
                // Pattern 2: Radial pulses
                const pulse1 = Math.sin(distance * 0.1 + timeOffset * 8);
                const pulse2 = Math.cos(distance * 0.15 - timeOffset * 6);
                
                // Pattern 3: Rotating interference
                const rotation = timeOffset * 2;
                const interference1 = Math.sin(x * 0.2 + y * 0.3 + rotation);
                const interference2 = Math.cos(x * 0.15 - y * 0.25 - rotation);
                
                // Combine all patterns with VERY different weights - EXTREME SCALING BY STRENGTH
                const baseStrength = Math.pow(strength, 3); // CUBIC scaling for maximum dramatic differences
                const chaosX = (spiral1 * 0.4 + pulse1 * 0.3 + interference1 * 0.3) * baseStrength * 10.0; // Doubled multiplier
                const chaosY = (spiral2 * 0.4 + pulse2 * 0.3 + interference2 * 0.3) * baseStrength * 10.0; // Doubled multiplier
                
                
                // Add explosive radial component - also scaled by strength  
                if (distance > 1) {
                    const radialForce = Math.sin(timeOffset * 4 + distance * 0.1) * baseStrength * 4.0; // Doubled
                    const radialX = (dx / distance) * radialForce;
                    const radialY = (dy / distance) * radialForce;
                    
                    field[index] = {
                        x: chaosX + radialX,
                        y: chaosY + radialY,
                        magnitude: Math.sqrt((chaosX + radialX) ** 2 + (chaosY + radialY) ** 2),
                        chromatic: true
                    };
                } else {
                    field[index] = {
                        x: chaosX,
                        y: chaosY,
                        magnitude: Math.sqrt(chaosX ** 2 + chaosY ** 2),
                        chromatic: true
                    };
                }
            }
        }
        
        return field;
    }

    createTimeDisplacementFlow(width, height, regions, timeOffset = 0) {
        const field = new Array(width * height);
        
        if (!regions || regions.length === 0) {
            // Fallback to simple perlin if no regions
            return this.createFlowField(width, height, 0.01, timeOffset);
        }
        
        // Use half the regions for a coarser, less granular effect
        const effectiveRegionCount = Math.max(1, Math.floor(regions.length / 2));
        const regionStep = Math.max(1, Math.floor(regions.length / effectiveRegionCount));
        
        
        // Create a map of region time offsets - only for selected regions
        const regionTimeOffsets = new Map();
        const selectedRegions = [];
        
        for (let i = 0; i < regions.length; i += regionStep) {
            selectedRegions.push(regions[i]);
        }
        
        selectedRegions.forEach((region, index) => {
            // Each region gets a unique time offset based on its index and position
            const centerX = region.boundingBox ? (region.boundingBox.minX + region.boundingBox.maxX) / 2 : 0;
            const centerY = region.boundingBox ? (region.boundingBox.minY + region.boundingBox.maxY) / 2 : 0;
            
            // Create time offset based on region index and spatial position
            const spatialOffset = (centerX / width + centerY / height) * Math.PI;
            const indexOffset = (index / selectedRegions.length) * Math.PI * 2;
            const regionTime = timeOffset + spatialOffset + indexOffset;
            
            regionTimeOffsets.set(region, regionTime);
        });
        
        // Create a coarse grid-based system instead of precise region mapping
        // This will give us the "blocky" effect you're looking for
        // Much simpler approach: aim for 4-16 total blocks across the image
        const targetBlocks = Math.max(4, Math.min(16, Math.ceil(effectiveRegionCount / 15))); // 4-16 blocks total
        const gridSize = Math.floor(Math.min(width, height) / Math.sqrt(targetBlocks));
        
        const gridWidth = Math.ceil(width / gridSize);
        const gridHeight = Math.ceil(height / gridSize);
        const totalGridCells = gridWidth * gridHeight;
        
        
        // Create time offsets for each grid cell
        const gridTimeOffsets = new Array(totalGridCells);
        for (let i = 0; i < totalGridCells; i++) {
            const gridX = i % gridWidth;
            const gridY = Math.floor(i / gridWidth);
            
            // Create time offset based on grid position - much more dramatic offsets
            const spatialOffset = ((gridX / gridWidth) + (gridY / gridHeight)) * Math.PI * 4; // Increased
            const indexOffset = (i / totalGridCells) * Math.PI * 8; // Much more dramatic
            gridTimeOffsets[i] = timeOffset + spatialOffset + indexOffset;
        }
        
        // Generate flow field with grid-based time offsets
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                
                // Find which grid cell this pixel belongs to
                const gridX = Math.floor(x / gridSize);
                const gridY = Math.floor(y / gridSize);
                const gridIndex = gridY * gridWidth + gridX;
                
                // Use the grid cell's time offset
                const regionTime = gridTimeOffsets[gridIndex] || timeOffset;
                
                // Generate flow based on grid cell time - more uniform within each block
                const blockNoise = this.noise2D(gridX * 0.1, regionTime);
                const blockNoiseY = this.noise2D(gridY * 0.1, regionTime + 100);
                
                // Much less spatial variation within the grid cell for blockier effect
                const timeModulation = Math.sin(regionTime) * 0.8; // Stronger modulation
                
                // Create directional flow that's consistent within each grid cell
                const angle = regionTime + blockNoise * Math.PI * 2; // More dramatic angle variation
                const magnitude = (0.8 + Math.abs(blockNoise) * 0.4) * (1 + timeModulation); // Stronger magnitude
                
                const vectorX = Math.cos(angle) * magnitude;
                const vectorY = Math.sin(angle) * magnitude;
                
                field[index] = {
                    x: vectorX,
                    y: vectorY,
                    magnitude: magnitude
                };
            }
        }
        
        return field;
    }

    createFeedbackEchoFlow(width, height, previousFrames, strength = 1.0, timeOffset = 0, echoDecay = 0.8) {
        const field = new Array(width * height);
        
        if (!previousFrames || previousFrames.length === 0) {
            // Fallback to perlin noise if no previous frames
            return this.createFlowField(width, height, 0.02, timeOffset);
        }
        
        // MUCH more aggressive optimization - use only last 2 frames max
        const maxFramesToUse = Math.min(2, previousFrames.length);
        const framesToUse = previousFrames.slice(-maxFramesToUse);
        
        // Much coarser grid for feedback analysis - big performance boost
        const feedbackGridSize = 32; // 32x32 pixel blocks
        const gridWidth = Math.ceil(width / feedbackGridSize);
        const gridHeight = Math.ceil(height / feedbackGridSize);
        
        // Pre-calculate feedback influence for each grid cell
        const gridInfluence = new Array(gridWidth * gridHeight);
        
        // Only sample from the most recent frame for performance
        const latestFrame = framesToUse[framesToUse.length - 1];
        if (latestFrame && latestFrame.data) {
            for (let gy = 0; gy < gridHeight; gy++) {
                for (let gx = 0; gx < gridWidth; gx++) {
                    const gridIndex = gy * gridWidth + gx;
                    
                    // Map to downsampled frame coordinates
                    const centerX = Math.min(width - 1, gx * feedbackGridSize + feedbackGridSize / 2);
                    const centerY = Math.min(height - 1, gy * feedbackGridSize + feedbackGridSize / 2);
                    
                    // Convert to downsampled frame coordinates
                    const frameX = Math.floor((centerX / width) * latestFrame.width);
                    const frameY = Math.floor((centerY / height) * latestFrame.height);
                    const sampleIndex = (frameY * latestFrame.width + frameX) * 4;
                    
                    if (sampleIndex + 3 < latestFrame.data.length) {
                        const r = latestFrame.data[sampleIndex];
                        const g = latestFrame.data[sampleIndex + 1];
                        const b = latestFrame.data[sampleIndex + 2];
                        
                        // Convert RGB to flow direction
                        const brightness = (r + g + b) / (3 * 255);
                        const colorAngle = Math.atan2(g - 128, r - 128) + timeOffset * 0.2;
                        
                        const influenceX = Math.cos(colorAngle) * brightness * strength * 3;
                        const influenceY = Math.sin(colorAngle) * brightness * strength * 3;
                        
                        gridInfluence[gridIndex] = {
                            x: influenceX,
                            y: influenceY,
                            magnitude: Math.sqrt(influenceX * influenceX + influenceY * influenceY)
                        };
                    } else {
                        gridInfluence[gridIndex] = { x: 0, y: 0, magnitude: 0 };
                    }
                }
            }
        }
        
        // Generate flow field using pre-calculated grid influence
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                
                // Find which grid cell this pixel belongs to
                const gridX = Math.floor(x / feedbackGridSize);
                const gridY = Math.floor(y / feedbackGridSize);
                const gridIndex = gridY * gridWidth + gridX;
                
                let feedbackX = 0, feedbackY = 0;
                if (gridIndex < gridInfluence.length && gridInfluence[gridIndex]) {
                    feedbackX = gridInfluence[gridIndex].x;
                    feedbackY = gridInfluence[gridIndex].y;
                    
                    // Add recursion - let feedback modify itself
                    const recursionPhase = timeOffset + feedbackX + feedbackY;
                    feedbackX += Math.sin(recursionPhase) * 0.5 * strength;
                    feedbackY += Math.cos(recursionPhase) * 0.5 * strength;
                }
                
                // Base noise for non-feedback areas
                const baseNoise = this.noise2D(x * 0.02, y * 0.02 + timeOffset);
                const baseAngle = baseNoise * Math.PI * 2;
                const baseMagnitude = Math.abs(baseNoise) * 0.4;
                
                const baseX = Math.cos(baseAngle) * baseMagnitude;
                const baseY = Math.sin(baseAngle) * baseMagnitude;
                
                // Simple blend
                const blendFactor = Math.min(1, Math.sqrt(feedbackX * feedbackX + feedbackY * feedbackY) / 2);
                const finalX = feedbackX * blendFactor + baseX * (1 - blendFactor);
                const finalY = feedbackY * blendFactor + baseY * (1 - blendFactor);
                
                field[index] = {
                    x: finalX,
                    y: finalY,
                    magnitude: Math.sqrt(finalX * finalX + finalY * finalY),
                    echo: true
                };
            }
        }
        
        return field;
    }

    createLidarFlow(width, height, strength = 1.0, timeOffset = 0) {
        const field = new Array(width * height);
        const centerX = width / 2;
        const centerY = height / 2;
        
        // LiDAR scanning parameters
        const scanSpeed = timeOffset * 0.5; // Speed of scanning rotation (slower for visibility)
        const scanAngle = scanSpeed % (Math.PI * 2); // Current scan line angle
        const scanLineWidth = 50; // Width of scan line effect (much wider)
        const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                
                // Calculate polar coordinates from center
                const deltaX = x - centerX;
                const deltaY = y - centerY;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                const pixelAngle = Math.atan2(deltaY, deltaX);
                
                // Normalize angle to [0, 2π]
                const normalizedPixelAngle = (pixelAngle + Math.PI * 2) % (Math.PI * 2);
                const normalizedScanAngle = (scanAngle + Math.PI * 2) % (Math.PI * 2);
                
                // Calculate distance from scan line
                let angleDiff = Math.abs(normalizedPixelAngle - normalizedScanAngle);
                if (angleDiff > Math.PI) {
                    angleDiff = Math.PI * 2 - angleDiff;
                }
                
                // LiDAR scanning effect - particles move when hit by scan line
                let scanInfluence = 0;
                if (angleDiff < 0.3) { // Much wider angle threshold (about 17 degrees on each side)
                    scanInfluence = 1.0 - (angleDiff / 0.3); // Linear falloff instead of cosine
                }
                
                // LiDAR scan line effect - much stronger force for visibility
                const scanForceX = Math.cos(scanAngle) * scanInfluence * 5.0;
                const scanForceY = Math.sin(scanAngle) * scanInfluence * 5.0;
                
                const finalX = scanForceX * strength;
                const finalY = scanForceY * strength;
                
                field[index] = {
                    x: finalX,
                    y: finalY,
                    magnitude: Math.sqrt(finalX * finalX + finalY * finalY),
                    lidar: true,
                    scanInfluence: scanInfluence // For potential visual effects
                };
            }
        }
        
        return field;
    }

    createIFSFractalFlow(width, height, strength = 1.0, timeOffset = 0) {
        const field = new Array(width * height);
        
        // Create self-similar flow patterns at multiple scales
        // This creates the fractal "texture" rather than trying to create the fractal shape itself
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                
                // Normalize coordinates to [0,1] range
                const nx = x / width;
                const ny = y / height;
                
                // Create multiple scales of self-similar patterns
                let totalX = 0, totalY = 0;
                
                // Scale 1: Large triangular pattern (1:1 scale)
                const angle1 = this.calculateTriangularFlow(nx, ny, 1.0, timeOffset);
                const magnitude1 = this.calculateTriangularMagnitude(nx, ny, 1.0, timeOffset);
                totalX += Math.cos(angle1) * magnitude1 * 1.0;
                totalY += Math.sin(angle1) * magnitude1 * 1.0;
                
                // Scale 2: Medium triangular pattern (1:2 scale - half size)
                const angle2 = this.calculateTriangularFlow(nx * 2, ny * 2, 0.5, timeOffset * 1.5);
                const magnitude2 = this.calculateTriangularMagnitude(nx * 2, ny * 2, 0.5, timeOffset * 1.5);
                totalX += Math.cos(angle2) * magnitude2 * 0.6;
                totalY += Math.sin(angle2) * magnitude2 * 0.6;
                
                // Scale 3: Small triangular pattern (1:4 scale - quarter size)  
                const angle3 = this.calculateTriangularFlow(nx * 4, ny * 4, 0.25, timeOffset * 2.0);
                const magnitude3 = this.calculateTriangularMagnitude(nx * 4, ny * 4, 0.25, timeOffset * 2.0);
                totalX += Math.cos(angle3) * magnitude3 * 0.3;
                totalY += Math.sin(angle3) * magnitude3 * 0.3;
                
                // Apply strength scaling - this should now work properly
                const scaledX = totalX * strength * 0.8;
                const scaledY = totalY * strength * 0.8;
                
                field[index] = {
                    x: scaledX,
                    y: scaledY,
                    magnitude: Math.sqrt(scaledX * scaledX + scaledY * scaledY),
                    ifsFractal: true
                };
            }
        }
        
        return field;
    }
    
    // Helper function to calculate triangular flow direction based on position within a triangle
    calculateTriangularFlow(nx, ny, scale, timeOffset) {
        // Wrap coordinates to [0,1] to create tiling
        const wx = (nx % 1 + 1) % 1;
        const wy = (ny % 1 + 1) % 1;
        
        // Determine which triangle region we're in (like sierpinski subdivisions)
        let regionAngle = 0;
        
        // Top triangle region
        if (wy > 0.5 && wx < 0.5) {
            regionAngle = -Math.PI / 2; // Upward
        }
        // Bottom-left triangle region  
        else if (wy <= 0.5 && wx < wy) {
            regionAngle = Math.PI * 5 / 6; // Up-left
        }
        // Bottom-right triangle region
        else {
            regionAngle = Math.PI / 6; // Up-right
        }
        
        // Add time-based rotation
        regionAngle += timeOffset * (1.0 + scale);
        
        // Add some position-based variation
        regionAngle += Math.sin(wx * Math.PI * 6) * 0.3;
        regionAngle += Math.cos(wy * Math.PI * 4) * 0.2;
        
        return regionAngle;
    }
    
    // Helper function to calculate magnitude based on position within triangle regions
    calculateTriangularMagnitude(nx, ny, scale, timeOffset) {
        const wx = (nx % 1 + 1) % 1;
        const wy = (ny % 1 + 1) % 1;
        
        // Distance from center of current tile
        const centerX = 0.5;
        const centerY = 0.5;
        const distFromCenter = Math.sqrt((wx - centerX) * (wx - centerX) + (wy - centerY) * (wy - centerY));
        
        // Distance from corners (where triangular forces are strongest)
        const corners = [
            {x: 0, y: 0}, {x: 1, y: 0}, {x: 0.5, y: 1}
        ];
        
        let minCornerDist = Infinity;
        corners.forEach(corner => {
            const dist = Math.sqrt((wx - corner.x) * (wx - corner.x) + (wy - corner.y) * (wy - corner.y));
            minCornerDist = Math.min(minCornerDist, dist);
        });
        
        // Stronger forces near corners, weaker in center
        let baseMagnitude = (1.0 - minCornerDist) * 0.7 + 0.1;
        
        // Add time-based pulsing
        baseMagnitude *= (Math.sin(timeOffset * 2 + distFromCenter * 8) * 0.3 + 0.7);
        
        // Scale by the fractal level
        return baseMagnitude * scale;
    }

    createBlackHoleFlow(width, height, strength = 1.0, timeOffset = 0) {
        const field = new Array(width * height);
        
        // Initialize black hole center if not set (only once)
        if (!this.blackHoleCenter) {
            this.blackHoleCenter = {
                x: Math.random() * width,
                y: Math.random() * height
            };
        }
        
        const blackHoleX = this.blackHoleCenter.x;
        const blackHoleY = this.blackHoleCenter.y;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                
                // Calculate distance and direction to black hole
                const dx = blackHoleX - x;
                const dy = blackHoleY - y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 1) {
                    // Very close to black hole center - minimal movement to avoid singularity
                    field[index] = { x: 0, y: 0, magnitude: 0, blackHole: true };
                    continue;
                }
                
                // Normalize direction vectors
                const directionX = dx / distance;
                const directionY = dy / distance;
                
                // Calculate tangential vector (perpendicular for orbital motion)
                const tangentialX = -directionY; // 90-degree rotation
                const tangentialY = directionX;
                
                // Black hole strength based on inverse square law (like gravity)
                // But capped to prevent infinite forces
                const gravityStrength = Math.min(strength * 200, strength * 50000 / Math.max(distance * distance, 25));
                
                // Orbital velocity - stronger closer to black hole (like real physics)
                const orbitalStrength = Math.min(strength * 100, strength * 8000 / Math.max(distance, 10));
                
                // Create spiral inward motion
                // As strength increases, more inward pull vs orbital motion
                const inwardRatio = Math.min(0.8, strength * 0.2); // Higher strength = more inward pull
                const orbitalRatio = 1.0 - inwardRatio;
                
                // Add time-based rotation to make the spiral dynamic
                const timeRotation = timeOffset * 0.5;
                const rotatedTangentialX = tangentialX * Math.cos(timeRotation) - tangentialY * Math.sin(timeRotation);
                const rotatedTangentialY = tangentialX * Math.sin(timeRotation) + tangentialY * Math.cos(timeRotation);
                
                // Combine inward gravitational pull with orbital motion
                const finalX = (directionX * gravityStrength * inwardRatio) + 
                              (rotatedTangentialX * orbitalStrength * orbitalRatio);
                const finalY = (directionY * gravityStrength * inwardRatio) + 
                              (rotatedTangentialY * orbitalStrength * orbitalRatio);
                
                // Add some noise for more organic motion
                const noiseValue = this.noise2D(x * 0.01 + timeOffset, y * 0.01 + timeOffset);
                const noiseStrength = strength * 0.5;
                const noiseX = Math.cos(noiseValue * Math.PI * 2) * noiseStrength;
                const noiseY = Math.sin(noiseValue * Math.PI * 2) * noiseStrength;
                
                const resultX = finalX + noiseX;
                const resultY = finalY + noiseY;
                
                field[index] = {
                    x: resultX,
                    y: resultY,
                    magnitude: Math.sqrt(resultX * resultX + resultY * resultY),
                    blackHole: true,
                    distance: distance // For potential visual effects
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