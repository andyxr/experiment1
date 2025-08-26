class MovementEngine {
    constructor() {
        this.perlinFlow = new PerlinFlow();
        this.pixelManipulator = new PixelManipulator();
        this.imageAnalyzer = new ImageAnalyzer();
        
        this.isRunning = false;
        this.animationId = null;
        this.lastTime = 0;
        
        // Movement parameters
        this.params = {
            movementSpeed: 0.5,
            noiseScale: 0.01,
            brightnessSensitivity: 1.0,
            regionThreshold: 30,
            gravityStrength: 0.0,
            scatterStrength: 0,
            flowFieldType: 'perlin', // 'perlin', 'turbulent', 'directional', 'vortex', 'wave'
            flowStrength: 1.0,
            timeStep: 0.01,
            particleLifetime: 2000,
            trailLength: 10
        };
        
        this.flowFieldCache = new Map();
        this.frameCount = 0;
        this.exportFrames = [];
        this.isRecording = false;
        
        // Gravity system
        this.gravityWells = [];
        this.gravityRadius = 80; // Pixels within this radius are affected
    }

    initialize(canvas) {
        this.pixelManipulator.initialize(canvas);
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
    }

    loadImage(imageData) {
        this.pixelManipulator.loadImageData(imageData);
        this.regions = this.imageAnalyzer.analyzeImage(
            imageData, 
            imageData.width, 
            imageData.height
        );
        this.pixelManipulator.setRegions(this.regions);
        this.generateFlowField();
        this.generateGravityWells();
        
        return this.regions;
    }

    setParameter(name, value) {
        if (name in this.params) {
            this.params[name] = value;
            
            // Trigger flow field regeneration for relevant parameters
            if (['noiseScale', 'flowFieldType', 'flowStrength'].includes(name)) {
                this.generateFlowField();
            }
            
            // Trigger gravity wells regeneration for gravity changes
            if (name === 'gravityStrength') {
                this.generateGravityWells();
            }
            
            // Update image analysis for threshold changes
            if (name === 'regionThreshold') {
                this.imageAnalyzer.setThreshold(value);
                // Re-analyze if we have image data
                if (this.pixelManipulator.originalData) {
                    const imageData = new ImageData(
                        this.pixelManipulator.originalData,
                        this.pixelManipulator.width,
                        this.pixelManipulator.height
                    );
                    this.loadImage(imageData);
                }
            }
        }
    }

    generateFlowField() {
        if (!this.pixelManipulator.width || !this.pixelManipulator.height) return;
        
        const width = Math.floor(this.pixelManipulator.width / 4); // Lower resolution for performance
        const height = Math.floor(this.pixelManipulator.height / 4);
        const scale = this.params.noiseScale;
        const time = this.perlinFlow.getTime();
        
        let flowField;
        
        switch (this.params.flowFieldType) {
            case 'turbulent':
                flowField = this.perlinFlow.createTurbulentFlowField(width, height, scale, time, 4);
                break;
            case 'directional':
                flowField = this.perlinFlow.createDirectionalFlow(
                    width, height, 45, this.params.flowStrength, 0.3, scale
                );
                break;
            case 'vortex':
                flowField = this.perlinFlow.createVortexFlow(
                    width, height, width / 2, height / 2, this.params.flowStrength, 0.01
                );
                break;
            case 'wave':
                flowField = this.perlinFlow.createWaveFlow(
                    width, height, 50, this.params.flowStrength, time * 10
                );
                break;
            default: // 'perlin'
                flowField = this.perlinFlow.createFlowField(width, height, scale, time);
                break;
        }
        
        this.pixelManipulator.setFlowField(flowField);
    }

    generateGravityWells() {
        if (!this.pixelManipulator.width || !this.pixelManipulator.height || this.params.gravityStrength <= 0) {
            this.gravityWells = [];
            return;
        }
        
        // Much more reasonable number of gravity wells - not based on total pixels
        const wellCount = Math.min(10, Math.floor(this.params.gravityStrength * 2)); // Max 10 wells
        
        this.gravityWells = [];
        for (let i = 0; i < wellCount; i++) {
            this.gravityWells.push({
                x: Math.random() * this.pixelManipulator.width,
                y: Math.random() * this.pixelManipulator.height,
                strength: this.params.gravityStrength * (0.5 + Math.random() * 0.5) // Vary strength
            });
        }
    }

    applyGravityForces() {
        if (this.params.gravityStrength <= 0 || this.gravityWells.length === 0) return;
        
        const pixelPositions = this.pixelManipulator.pixelPositions;
        const pixelVelocities = this.pixelManipulator.pixelVelocities;
        
        // Sample pixels for performance - process 10x more pixels for stronger effect
        const sampleRate = Math.max(1, Math.floor(pixelPositions.length / 50000)); // Process max 50000 pixels (10x more)
        let forcesApplied = 0; // Debug counter
        
        for (let i = 0; i < pixelPositions.length; i += sampleRate) {
            const pixel = pixelPositions[i];
            
            // Apply force from each nearby gravity well
            for (let well of this.gravityWells) {
                const dx = well.x - pixel.x;
                const dy = well.y - pixel.y;
                const distanceSquared = dx * dx + dy * dy;
                const distance = Math.sqrt(distanceSquared);
                
                // Only affect pixels within gravity radius
                if (distance < this.gravityRadius && distance > 1) {
                    // DRAMATICALLY stronger gravity force!
                    const force = (well.strength * 100.0) / Math.max(distance, 10); // Maximum intensity!
                    const forceX = (dx / distance) * force;
                    const forceY = (dy / distance) * force;
                    
                    // Apply force more aggressively - directly move pixels toward gravity wells
                    const oldVelX = pixelVelocities[i].x;
                    const oldVelY = pixelVelocities[i].y;
                    
                    // Add to velocity AND directly to position for immediate effect
                    pixelVelocities[i].x += forceX * sampleRate * 3; // Triple the force
                    pixelVelocities[i].y += forceY * sampleRate * 3;
                    
                    // Also directly move pixel slightly toward well for immediate visible effect
                    const directMoveStrength = well.strength * 0.1;
                    pixelPositions[i].x += (dx / distance) * directMoveStrength;
                    pixelPositions[i].y += (dy / distance) * directMoveStrength;
                    
                    forcesApplied++;
                    
                    // Debug first few applications
                    if (forcesApplied < 3) {
                        console.log(`Strong gravity on pixel ${i}: force(${forceX.toFixed(3)}, ${forceY.toFixed(3)}) vel ${oldVelX.toFixed(3)} -> ${pixelVelocities[i].x.toFixed(3)}`);
                    }
                }
            }
        }
        
        // Debug logging every 120 frames (about every 4 seconds)
        if (this.frameCount % 120 === 0 && forcesApplied > 0) {
            console.log(`Gravity: ${this.gravityWells.length} wells, ${forcesApplied} forces applied, strength: ${this.params.gravityStrength}`);
        }
    }

    applyScatterForces() {
        if (this.params.scatterStrength <= 0) return;
        
        // Apply scatter more frequently for better visual effect
        if (this.frameCount % 3 !== 0) return; // Every 3rd frame for more dramatic effect
        
        const pixelPositions = this.pixelManipulator.pixelPositions;
        const pixelVelocities = this.pixelManipulator.pixelVelocities;
        
        // Calculate how many pixels to scatter based on percentage  
        const totalPixels = pixelPositions.length;
        const scatterCount = Math.floor((this.params.scatterStrength / 100) * totalPixels / 3); // Divide by 3 since we apply every 3 frames
        
        console.log(`Scatter debug: totalPixels=${totalPixels}, scatterStrength=${this.params.scatterStrength}, scatterCount=${scatterCount}`);
        
        if (scatterCount === 0) {
            console.log("Scatter count is 0 - no pixels will be scattered");
            return;
        }
        
        // Randomly select pixels to scatter - use Set to avoid duplicates
        const scatteredPixels = new Set();
        while (scatteredPixels.size < scatterCount) {
            const randomIndex = Math.floor(Math.random() * totalPixels);
            scatteredPixels.add(randomIndex);
        }
        
        const scatteredArray = Array.from(scatteredPixels);
        console.log(`Scattering ${scatteredArray.length} unique pixels: first few indices:`, scatteredArray.slice(0, 5));
        
        // Apply random velocities to scattered pixels
        scatteredArray.forEach((pixelIndex, arrayIndex) => {
            // Generate random direction
            const angle = Math.random() * Math.PI * 2;
            
            // Make scatter MUCH more dramatic - use a fixed high speed
            const scatterSpeed = 10 + (this.params.movementSpeed * 5); // Much faster!
            
            // Calculate scatter velocity components
            const scatterVelX = Math.cos(angle) * scatterSpeed;
            const scatterVelY = Math.sin(angle) * scatterSpeed;
            
            // Apply scatter velocity (overwrite existing velocity completely)
            pixelVelocities[pixelIndex].x = scatterVelX;
            pixelVelocities[pixelIndex].y = scatterVelY;
            
            // ALSO directly move the pixel position for immediate visible effect - MAKE IT BIG
            const jumpDistance = 40 + (this.params.scatterStrength * 2); // Big but not overwhelming jumps
            const oldX = pixelPositions[pixelIndex].x;
            const oldY = pixelPositions[pixelIndex].y;
            
            pixelPositions[pixelIndex].x += Math.cos(angle) * jumpDistance;
            pixelPositions[pixelIndex].y += Math.sin(angle) * jumpDistance;
            
            // Debug first few scattered pixels
            if (arrayIndex < 5) {
                console.log(`Pixel ${pixelIndex} scattered: (${oldX.toFixed(1)}, ${oldY.toFixed(1)}) -> (${pixelPositions[pixelIndex].x.toFixed(1)}, ${pixelPositions[pixelIndex].y.toFixed(1)}) jump=${jumpDistance.toFixed(1)}`);
            }
        });
        
        // Debug logging
        if (this.frameCount % 120 === 0 && scatterCount > 0) {
            console.log(`Scatter: ${scatterCount} pixels scattered (${this.params.scatterStrength}%), total affected per second: ~${scatterCount * 6}`);
        }
    }

    startAnimation() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.lastTime = performance.now();
        this.frameCount = 0;
        this.animate();
    }

    stopAnimation() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    animate() {
        if (!this.isRunning) return;
        
        const currentTime = performance.now();
        const deltaTime = Math.min(currentTime - this.lastTime, 50); // Cap at 50ms
        this.lastTime = currentTime;
        
        // Update flow field periodically
        if (this.frameCount % 30 === 0) {
            this.perlinFlow.advanceTime(this.params.timeStep);
            this.generateFlowField();
        }
        
        // Regenerate gravity wells occasionally for more chaos
        if (this.frameCount % 120 === 0) { // Every 4 seconds at 30fps
            this.generateGravityWells();
        }
        
        // Apply gravity forces first
        this.applyGravityForces();
        
        // Update pixel positions
        this.pixelManipulator.updatePixelPositions(
            deltaTime,
            this.params.movementSpeed,
            this.params.brightnessSensitivity
        );
        
        // Apply scatter forces AFTER position update (so it doesn't get overridden)
        this.applyScatterForces();
        
        // Render frame
        const frameData = this.pixelManipulator.renderFrame();
        
        // Record frame if needed
        if (this.isRecording) {
            this.exportFrames.push(frameData);
        }
        
        this.frameCount++;
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    reset() {
        this.stopAnimation();
        this.pixelManipulator.reset();
        this.frameCount = 0;
        this.exportFrames = [];
        this.isRecording = false;
        this.perlinFlow = new PerlinFlow(); // Reset time
    }

    startRecording() {
        this.exportFrames = [];
        this.isRecording = true;
    }

    stopRecording() {
        this.isRecording = false;
        return this.exportFrames;
    }

    createCompositeEffect(effects = []) {
        // Combine multiple movement effects
        const width = Math.floor(this.pixelManipulator.width / 4);
        const height = Math.floor(this.pixelManipulator.height / 4);
        let compositeField = new Array(width * height).fill({x: 0, y: 0, magnitude: 0});
        
        effects.forEach(effect => {
            let field;
            const time = this.perlinFlow.getTime();
            
            switch (effect.type) {
                case 'perlin':
                    field = this.perlinFlow.createFlowField(
                        width, height, effect.scale || 0.01, time
                    );
                    break;
                case 'vortex':
                    field = this.perlinFlow.createVortexFlow(
                        width, height, 
                        effect.centerX || width / 2, 
                        effect.centerY || height / 2,
                        effect.strength || 1.0,
                        effect.falloff || 0.01
                    );
                    break;
                case 'directional':
                    field = this.perlinFlow.createDirectionalFlow(
                        width, height,
                        effect.direction || 0,
                        effect.strength || 1.0,
                        effect.noiseInfluence || 0.3,
                        effect.scale || 0.01
                    );
                    break;
                default:
                    field = new Array(width * height).fill({x: 0, y: 0, magnitude: 0});
                    break;
            }
            
            // Blend fields
            const weight = effect.weight || 1.0;
            compositeField = compositeField.map((vector, index) => ({
                x: vector.x + field[index].x * weight,
                y: vector.y + field[index].y * weight,
                magnitude: Math.sqrt(
                    Math.pow(vector.x + field[index].x * weight, 2) +
                    Math.pow(vector.y + field[index].y * weight, 2)
                )
            }));
        });
        
        this.pixelManipulator.setFlowField(compositeField);
    }

    addBrightnessBasedMovement() {
        if (!this.pixelManipulator.originalData) return;
        
        const brightnessMap = this.imageAnalyzer.getBrightnessMap(
            this.pixelManipulator.width,
            this.pixelManipulator.height
        );
        
        // Create brightness-influenced flow field
        const width = Math.floor(this.pixelManipulator.width / 4);
        const height = Math.floor(this.pixelManipulator.height / 4);
        const brightnessForcedField = new Array(width * height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                const originalIndex = Math.floor(y * 4) * this.pixelManipulator.width + Math.floor(x * 4);
                const brightness = brightnessMap[originalIndex] || 0;
                
                // Bright areas create upward force, dark areas create downward force
                const verticalForce = (brightness - 0.5) * this.params.brightnessSensitivity;
                const horizontalForce = Math.sin(brightness * Math.PI * 2) * 0.1;
                
                brightnessForcedField[index] = {
                    x: horizontalForce,
                    y: -verticalForce, // Negative because canvas Y increases downward
                    magnitude: Math.sqrt(horizontalForce * horizontalForce + verticalForce * verticalForce)
                };
            }
        }
        
        // Blend with existing flow field
        if (this.pixelManipulator.flowField) {
            const blendedField = this.perlinFlow.interpolateField(
                this.pixelManipulator.flowField,
                brightnessForcedField,
                0.3, // 30% brightness influence
                width,
                height
            );
            this.pixelManipulator.setFlowField(blendedField);
        } else {
            this.pixelManipulator.setFlowField(brightnessForcedField);
        }
    }

    addColorHarmonyMovement() {
        if (!this.regions.length) return;
        
        // Group regions by similar colors
        const colorGroups = this.groupRegionsByColor(this.regions);
        
        // Apply coordinated movement to each color group
        colorGroups.forEach((group, groupIndex) => {
            const baseDirection = (groupIndex / colorGroups.length) * 360;
            const coherenceStrength = 0.05; // Reduced for pixel displacement
            
            group.forEach(region => {
                // Apply force to all pixels in this region
                region.pixels.forEach(pixel => {
                    const pixelIndex = pixel.y * this.pixelManipulator.width + pixel.x;
                    if (pixelIndex < this.pixelManipulator.pixelVelocities.length) {
                        const angle = (baseDirection + Math.sin(this.frameCount * 0.01) * 30) * Math.PI / 180;
                        const force = {
                            x: Math.cos(angle) * coherenceStrength,
                            y: Math.sin(angle) * coherenceStrength
                        };
                        
                        this.pixelManipulator.pixelVelocities[pixelIndex].x += force.x;
                        this.pixelManipulator.pixelVelocities[pixelIndex].y += force.y;
                    }
                });
            });
        });
    }

    groupRegionsByColor(regions, threshold = 50) {
        const groups = [];
        const processed = new Set();
        
        regions.forEach((region, index) => {
            if (processed.has(index)) return;
            
            const group = [region];
            processed.add(index);
            
            // Find similar colored regions
            regions.forEach((otherRegion, otherIndex) => {
                if (processed.has(otherIndex)) return;
                
                const colorDistance = this.imageAnalyzer.colorDistance(
                    region.avgColor,
                    otherRegion.avgColor
                );
                
                if (colorDistance < threshold) {
                    group.push(otherRegion);
                    processed.add(otherIndex);
                }
            });
            
            groups.push(group);
        });
        
        return groups;
    }

    visualizeFlowField(alpha = 0.3) {
        if (this.pixelManipulator.flowField) {
            this.perlinFlow.visualizeField(this.canvas, this.pixelManipulator.flowField, 15, alpha);
        }
    }

    visualizeGravityWells() {
        if (!this.gravityWells.length) return;
        
        const ctx = this.ctx;
        ctx.save();
        
        this.gravityWells.forEach(well => {
            // Draw gravity well as a bright circle
            ctx.fillStyle = `rgba(255, 0, 255, 0.8)`; // Bright magenta
            ctx.beginPath();
            ctx.arc(well.x, well.y, 5 + well.strength, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw influence radius
            ctx.strokeStyle = `rgba(255, 0, 255, 0.3)`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(well.x, well.y, this.gravityRadius, 0, Math.PI * 2);
            ctx.stroke();
        });
        
        ctx.restore();
    }

    getStats() {
        return {
            frameCount: this.frameCount,
            pixelCount: this.pixelManipulator.getPixelCount(),
            regionCount: this.pixelManipulator.getRegionCount(),
            isRunning: this.isRunning,
            isRecording: this.isRecording,
            exportedFrames: this.exportFrames.length,
            currentFlowType: this.params.flowFieldType
        };
    }

    exportCurrentFrame() {
        return this.pixelManipulator.exportFrame();
    }

    createPresets() {
        return {
            gentle: {
                movementSpeed: 0.3,
                noiseScale: 0.005,
                brightnessSensitivity: 0.5,
                flowFieldType: 'perlin',
                flowStrength: 0.8
            },
            dynamic: {
                movementSpeed: 1.2,
                noiseScale: 0.02,
                brightnessSensitivity: 1.5,
                flowFieldType: 'turbulent',
                flowStrength: 1.5
            },
            swirl: {
                movementSpeed: 0.8,
                noiseScale: 0.01,
                brightnessSensitivity: 1.0,
                flowFieldType: 'vortex',
                flowStrength: 1.2
            },
            wave: {
                movementSpeed: 0.6,
                noiseScale: 0.008,
                brightnessSensitivity: 0.8,
                flowFieldType: 'wave',
                flowStrength: 1.0
            },
            drift: {
                movementSpeed: 0.4,
                noiseScale: 0.003,
                brightnessSensitivity: 2.0,
                flowFieldType: 'directional',
                flowStrength: 0.6
            }
        };
    }

    applyPreset(presetName) {
        const presets = this.createPresets();
        if (presets[presetName]) {
            Object.keys(presets[presetName]).forEach(key => {
                this.setParameter(key, presets[presetName][key]);
            });
        }
    }
}