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
            randomMirrors: 0,
            scanLineInterference: 0, // 0-10 scale for interference strength
            kaleidoscopeFractal: 0, // 0-10 scale for kaleidoscope symmetry intensity
            trails: 0, // 0-10 scale for trailing effect percentage (0=0%, 10=100%)
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
        
        // Mirror system
        this.mirrorLines = [];
        
        // Scan line interference system
        this.scanLinePhase = 0; // For animating the interference pattern
        
        // Kaleidoscope fractal system
        this.kaleidoscopeSegments = 6; // Number of symmetrical segments
        this.kaleidoscopeRotation = 0; // Current rotation angle
        
        // Trails system
        this.trailPixels = new Set(); // Pixels selected for trailing
        this.trailHistory = new Map(); // Stores trail positions for each pixel
        this.pixelColorCache = new Map(); // Cache pixel colors to avoid repeated calculations
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
        this.generateMirrorLines();
        
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
            
            // Trigger mirror lines regeneration for mirror changes
            if (name === 'randomMirrors') {
                this.generateMirrorLines();
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

    generateMirrorLines() {
        if (!this.pixelManipulator.width || !this.pixelManipulator.height || this.params.randomMirrors <= 0) {
            this.mirrorLines = [];
            return;
        }
        
        this.mirrorLines = [];
        const width = this.pixelManipulator.width;
        const height = this.pixelManipulator.height;
        
        for (let i = 0; i < this.params.randomMirrors; i++) {
            // Generate random mirror line from border to border
            const angle = Math.random() * Math.PI; // 0 to 180 degrees
            const startSide = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
            
            let x1, y1, x2, y2;
            
            // Start point on a random border
            switch (startSide) {
                case 0: // Top border
                    x1 = Math.random() * width;
                    y1 = 0;
                    break;
                case 1: // Right border
                    x1 = width;
                    y1 = Math.random() * height;
                    break;
                case 2: // Bottom border
                    x1 = Math.random() * width;
                    y1 = height;
                    break;
                case 3: // Left border
                    x1 = 0;
                    y1 = Math.random() * height;
                    break;
            }
            
            // Calculate end point by extending line to opposite border
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);
            
            // Find intersection with canvas boundaries
            const tValues = [];
            
            // Check intersection with left border (x = 0)
            if (dx !== 0) {
                const t = -x1 / dx;
                const y = y1 + t * dy;
                if (t > 0 && y >= 0 && y <= height) {
                    tValues.push({ t, x: 0, y });
                }
            }
            
            // Check intersection with right border (x = width)
            if (dx !== 0) {
                const t = (width - x1) / dx;
                const y = y1 + t * dy;
                if (t > 0 && y >= 0 && y <= height) {
                    tValues.push({ t, x: width, y });
                }
            }
            
            // Check intersection with top border (y = 0)
            if (dy !== 0) {
                const t = -y1 / dy;
                const x = x1 + t * dx;
                if (t > 0 && x >= 0 && x <= width) {
                    tValues.push({ t, x, y: 0 });
                }
            }
            
            // Check intersection with bottom border (y = height)
            if (dy !== 0) {
                const t = (height - y1) / dy;
                const x = x1 + t * dx;
                if (t > 0 && x >= 0 && x <= width) {
                    tValues.push({ t, x, y: height });
                }
            }
            
            // Use the closest intersection point
            if (tValues.length > 0) {
                tValues.sort((a, b) => a.t - b.t);
                x2 = tValues[0].x;
                y2 = tValues[0].y;
            } else {
                // Fallback: create horizontal or vertical line
                if (Math.random() < 0.5) {
                    // Horizontal line
                    x1 = 0;
                    y1 = Math.random() * height;
                    x2 = width;
                    y2 = y1;
                } else {
                    // Vertical line
                    x1 = Math.random() * width;
                    y1 = 0;
                    x2 = x1;
                    y2 = height;
                }
            }
            
            // Calculate line normal vector for reflections
            const lineVecX = x2 - x1;
            const lineVecY = y2 - y1;
            const lineLength = Math.sqrt(lineVecX * lineVecX + lineVecY * lineVecY);
            
            // Normal vector (perpendicular to the line)
            const normalX = -lineVecY / lineLength;
            const normalY = lineVecX / lineLength;
            
            this.mirrorLines.push({
                x1, y1, x2, y2,
                normalX, normalY,
                // Line equation coefficients (ax + by + c = 0)
                a: normalX,
                b: normalY,
                c: -(normalX * x1 + normalY * y1)
            });
        }
        
        console.log(`Generated ${this.mirrorLines.length} mirror lines for Random Mirrors = ${this.params.randomMirrors}`);
    }

    applyGravityForces() {
        if (this.params.gravityStrength <= 0 || this.gravityWells.length === 0) return;
        
        const pixelPositions = this.pixelManipulator.pixelPositions;
        const pixelVelocities = this.pixelManipulator.pixelVelocities;
        
        // Sample pixels for performance - process way more pixels for much stronger effect
        const sampleRate = Math.max(1, Math.floor(pixelPositions.length / 200000)); // Process max 200000 pixels (4x more than before)
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
                    const force = (well.strength * 200.0) / Math.max(distance, 10); // Double intensity!
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

    applyMirrorReflections() {
        if (this.params.randomMirrors <= 0 || this.mirrorLines.length === 0) return;
        
        const pixelPositions = this.pixelManipulator.pixelPositions;
        const pixelVelocities = this.pixelManipulator.pixelVelocities;
        const width = this.pixelManipulator.width;
        const height = this.pixelManipulator.height;
        
        let reflectionsApplied = 0;
        let debugCount = 0;
        
        // Sample fewer pixels for performance but ensure we check enough
        const sampleRate = Math.max(1, Math.floor(pixelPositions.length / 10000)); // Check up to 10k pixels
        
        for (let i = 0; i < pixelPositions.length; i += sampleRate) {
            const pixel = pixelPositions[i];
            const velocity = pixelVelocities[i];
            
            // Skip pixels that are not moving much
            const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
            if (speed < 0.5) continue;
            
            // Calculate where the pixel will be next frame
            const nextX = pixel.x + velocity.x;
            const nextY = pixel.y + velocity.y;
            
            for (let mirrorLine of this.mirrorLines) {
                // Check if pixel crosses the mirror line using line equation
                const currentDist = mirrorLine.a * pixel.x + mirrorLine.b * pixel.y + mirrorLine.c;
                const nextDist = mirrorLine.a * nextX + mirrorLine.b * nextY + mirrorLine.c;
                
                // If signs are different, the pixel crossed the line
                if (currentDist * nextDist < 0 && Math.abs(currentDist) < 50) { // Only if close to line
                    // Calculate intersection point using parametric approach
                    const denominator = currentDist - nextDist;
                    if (Math.abs(denominator) < 0.001) continue; // Avoid division by zero
                    
                    const t = Math.abs(currentDist) / Math.abs(denominator);
                    const intersectX = pixel.x + t * velocity.x;
                    const intersectY = pixel.y + t * velocity.y;
                    
                    // Make sure intersection is within canvas bounds
                    if (intersectX < 0 || intersectX >= width || intersectY < 0 || intersectY >= height) {
                        continue;
                    }
                    
                    // Reflect velocity across the mirror line
                    // Formula: v_reflected = v - 2 * (v · n) * n
                    const dotProduct = velocity.x * mirrorLine.normalX + velocity.y * mirrorLine.normalY;
                    const reflectedVelX = velocity.x - 2 * dotProduct * mirrorLine.normalX;
                    const reflectedVelY = velocity.y - 2 * dotProduct * mirrorLine.normalY;
                    
                    // Update velocity
                    velocity.x = reflectedVelX;
                    velocity.y = reflectedVelY;
                    
                    // Move pixel to intersection point plus a bit beyond to avoid re-crossing
                    const reflectionOffset = 2.0;
                    pixel.x = intersectX + mirrorLine.normalX * reflectionOffset;
                    pixel.y = intersectY + mirrorLine.normalY * reflectionOffset;
                    
                    // Ensure pixel stays within canvas bounds
                    pixel.x = Math.max(1, Math.min(width - 1, pixel.x));
                    pixel.y = Math.max(1, Math.min(height - 1, pixel.y));
                    
                    reflectionsApplied++;
                    
                    // Debug first few reflections
                    if (debugCount < 3) {
                        console.log(`Mirror reflection ${reflectionsApplied}: pixel ${i} speed=${speed.toFixed(1)} reflected off line ${mirrorLine.x1.toFixed(0)},${mirrorLine.y1.toFixed(0)} to ${mirrorLine.x2.toFixed(0)},${mirrorLine.y2.toFixed(0)}`);
                        console.log(`  Old velocity: (${(velocity.x - (reflectedVelX - velocity.x)).toFixed(2)}, ${(velocity.y - (reflectedVelY - velocity.y)).toFixed(2)}) -> New velocity: (${velocity.x.toFixed(2)}, ${velocity.y.toFixed(2)})`);
                        debugCount++;
                    }
                    
                    // Only reflect once per pixel per frame
                    break;
                }
            }
        }
        
        // Debug logging every 60 frames (more frequent)
        if (this.frameCount % 60 === 0) {
            console.log(`Mirror debug: ${this.mirrorLines.length} mirror lines, ${reflectionsApplied} reflections this frame, sampling every ${sampleRate} pixels`);
        }
    }

    applyScanLineInterference() {
        if (this.params.scanLineInterference <= 0) return;
        
        
        const pixelPositions = this.pixelManipulator.pixelPositions;
        const pixelVelocities = this.pixelManipulator.pixelVelocities;
        const width = this.pixelManipulator.width;
        const height = this.pixelManipulator.height;
        
        if (!pixelPositions || !width || !height) return;
        
        // Calculate interference parameters based on strength (0-10) - MUCH more dramatic!
        const strength = this.params.scanLineInterference / 10; // Normalize to 0-1
        const scanLineSpacing = Math.max(3, 25 - this.params.scanLineInterference * 2); // Closer lines at higher strength
        const maxDisplacement = this.params.scanLineInterference * 8; // Max 80 pixel displacement at strength 10 (was 30)
        const interferenceSpeed = 0.08 + (strength * 0.15); // Faster animation speed
        
        // Update scan line phase for animation
        this.scanLinePhase += interferenceSpeed;
        if (this.scanLinePhase > Math.PI * 2) {
            this.scanLinePhase -= Math.PI * 2;
        }
        
        // Sample more pixels for more prominent effect
        const sampleRate = Math.max(1, Math.floor(pixelPositions.length / 25000)); // Process up to 25k pixels (was 15k)
        let interferenceApplied = 0;
        
        for (let i = 0; i < pixelPositions.length; i += sampleRate) {
            const pixel = pixelPositions[i];
            const velocity = pixelVelocities[i];
            
            // Calculate which scan line this pixel is on
            const scanLineIndex = Math.floor(pixel.y / scanLineSpacing);
            
            // Create interference pattern using multiple sine waves for complexity - MORE DRAMATIC!
            const primaryWave = Math.sin((scanLineIndex * 0.3) + this.scanLinePhase);
            const secondaryWave = Math.sin((scanLineIndex * 0.7) + (this.scanLinePhase * 1.5)) * 0.7; // Increased from 0.5
            const tertiaryWave = Math.sin((scanLineIndex * 1.2) + (this.scanLinePhase * 0.8)) * 0.4; // Increased from 0.25
            const quaternaryWave = Math.sin((scanLineIndex * 0.15) + (this.scanLinePhase * 2.2)) * 0.3; // NEW layer
            
            const combinedWave = primaryWave + secondaryWave + tertiaryWave + quaternaryWave;
            
            // Create horizontal displacement based on interference pattern
            const horizontalDisplacement = combinedWave * maxDisplacement * strength;
            
            // Create vertical "jitter" effect for more realistic interference
            const verticalJitter = (Math.sin(scanLineIndex * 2.1 + this.scanLinePhase * 2) * 0.5) * strength;
            
            // Apply interference to velocity (for smooth movement) - MUCH stronger forces!
            const interferenceForceX = horizontalDisplacement * 0.3; // Tripled from 0.1
            const interferenceForceY = verticalJitter * 0.15; // Tripled from 0.05
            
            velocity.x += interferenceForceX;
            velocity.y += interferenceForceY;
            
            // Direct position displacement kicks in earlier and stronger
            if (this.params.scanLineInterference > 3) { // Now starts at level 4 instead of 6
                const directStrength = (this.params.scanLineInterference - 3) / 7; // 0-1 for levels 4-10
                pixel.x += horizontalDisplacement * directStrength * 0.5; // Doubled from 0.2
                pixel.y += verticalJitter * directStrength * 0.25; // Doubled from 0.1
                
                // Keep pixels within bounds
                pixel.x = Math.max(0, Math.min(width - 1, pixel.x));
                pixel.y = Math.max(0, Math.min(height - 1, pixel.y));
            }
            
            interferenceApplied++;
        }
        
        // Debug logging every 120 frames
        if (this.frameCount % 120 === 0 && this.params.scanLineInterference > 0) {
            console.log(`Scan Line Interference: strength=${this.params.scanLineInterference}, spacing=${scanLineSpacing.toFixed(1)}, displacement=${maxDisplacement.toFixed(1)}, affected=${interferenceApplied} pixels`);
        }
    }

    applyKaleidoscopeFractal() {
        if (this.params.kaleidoscopeFractal <= 0) return;
        
        const pixelPositions = this.pixelManipulator.pixelPositions;
        const pixelVelocities = this.pixelManipulator.pixelVelocities;
        const width = this.pixelManipulator.width;
        const height = this.pixelManipulator.height;
        
        if (!pixelPositions || !width || !height) return;
        
        // Calculate kaleidoscope parameters
        const strength = this.params.kaleidoscopeFractal / 10; // 0-1 scale
        const centerX = width / 2;
        const centerY = height / 2;
        const maxRadius = Math.min(width, height) / 2;
        
        // Update rotation for dynamic effect - MUCH faster and more visible
        this.kaleidoscopeRotation += 0.08 + (strength * 0.12); // 4x faster rotation
        if (this.kaleidoscopeRotation > Math.PI * 2) {
            this.kaleidoscopeRotation -= Math.PI * 2;
        }
        
        // Determine number of segments based on strength
        this.kaleidoscopeSegments = Math.max(3, Math.min(12, Math.floor(3 + strength * 9)));
        const segmentAngle = (Math.PI * 2) / this.kaleidoscopeSegments;
        
        // Sample MORE pixels for much more visible effect
        const sampleRate = Math.max(1, Math.floor(pixelPositions.length / 35000)); // Process up to 35k pixels
        let fractalsApplied = 0;
        
        for (let i = 0; i < pixelPositions.length; i += sampleRate) {
            const pixel = pixelPositions[i];
            const velocity = pixelVelocities[i];
            
            // Convert to polar coordinates relative to center
            const deltaX = pixel.x - centerX;
            const deltaY = pixel.y - centerY;
            const radius = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            // Skip pixels too far from center or at center
            if (radius > maxRadius || radius < 5) continue;
            
            let angle = Math.atan2(deltaY, deltaX) + this.kaleidoscopeRotation;
            
            // Normalize angle to [0, 2π]
            while (angle < 0) angle += Math.PI * 2;
            while (angle >= Math.PI * 2) angle -= Math.PI * 2;
            
            // Find which kaleidoscope segment this pixel is in
            const segmentIndex = Math.floor(angle / segmentAngle);
            const angleInSegment = angle % segmentAngle;
            
            // Create kaleidoscope mirroring effect
            let mirroredAngle = angleInSegment;
            
            // Apply different mirroring patterns based on segment
            if (segmentIndex % 2 === 0) {
                // Even segments: mirror around segment center
                mirroredAngle = segmentAngle - angleInSegment;
            }
            
            // Add fractal-like recursive reflections for higher strengths
            if (this.params.kaleidoscopeFractal > 5) {
                const subSegments = Math.floor(strength * 4) + 2;
                const subSegmentAngle = segmentAngle / subSegments;
                const subIndex = Math.floor(mirroredAngle / subSegmentAngle);
                const angleInSubSegment = mirroredAngle % subSegmentAngle;
                
                if (subIndex % 2 === 0) {
                    mirroredAngle = angleInSubSegment;
                } else {
                    mirroredAngle = subSegmentAngle - angleInSubSegment;
                }
            }
            
            // Calculate target position based on mirrored angle
            const targetAngle = mirroredAngle + (segmentIndex * segmentAngle) - this.kaleidoscopeRotation;
            const targetX = centerX + Math.cos(targetAngle) * radius;
            const targetY = centerY + Math.sin(targetAngle) * radius;
            
            // Apply kaleidoscope force - pull pixels toward their mirrored positions - MUCH STRONGER!
            const forceX = (targetX - pixel.x) * strength * 0.8; // 8x stronger force
            const forceY = (targetY - pixel.y) * strength * 0.8;
            
            velocity.x += forceX;
            velocity.y += forceY;
            
            // Add direct position displacement for immediate visible effect at ALL levels
            if (this.params.kaleidoscopeFractal >= 3) {
                const directStrength = strength * 0.3; // Direct position jump
                pixel.x += forceX * directStrength;
                pixel.y += forceY * directStrength;
                
                // Keep pixels within bounds
                pixel.x = Math.max(0, Math.min(width - 1, pixel.x));
                pixel.y = Math.max(0, Math.min(height - 1, pixel.y));
            }
            
            // At higher strengths, add spiraling motion - MUCH MORE DRAMATIC
            if (this.params.kaleidoscopeFractal > 5) { // Start spiraling earlier at level 6
                const spiralStrength = (this.params.kaleidoscopeFractal - 5) / 5; // 0-1 for levels 6-10
                const tangentialForce = spiralStrength * 8; // 4x stronger spiral
                
                velocity.x += -deltaY / radius * tangentialForce;
                velocity.y += deltaX / radius * tangentialForce;
            }
            
            // At high strength, add radial pulsing - MORE VISIBLE
            if (this.params.kaleidoscopeFractal >= 8) { // Start pulsing earlier at level 8
                const pulsePhase = this.frameCount * 0.1; // Faster pulse
                const pulseStrength = Math.sin(pulsePhase + radius * 0.05) * 3; // MUCH stronger pulse
                
                velocity.x += (deltaX / radius) * pulseStrength;
                velocity.y += (deltaY / radius) * pulseStrength;
            }
            
            fractalsApplied++;
        }
        
        // Debug logging
        if (this.frameCount % 120 === 0) {
            console.log(`Kaleidoscope Fractal: strength=${this.params.kaleidoscopeFractal}, segments=${this.kaleidoscopeSegments}, affected=${fractalsApplied} pixels, rotation=${(this.kaleidoscopeRotation * 180 / Math.PI).toFixed(1)}°`);
        }
    }

    applyTrails() {
        if (this.params.trails <= 0) {
            // Clear trail data when disabled
            this.trailPixels.clear();
            this.trailHistory.clear();
            return;
        }
        
        const pixelPositions = this.pixelManipulator.pixelPositions;
        const pixelVelocities = this.pixelManipulator.pixelVelocities;
        
        if (!pixelPositions || pixelPositions.length === 0) return;
        
        // Scale pixel count properly - remove hard cap for higher trail values
        const trailPercentage = this.params.trails * 0.1; // 10% per level as originally intended
        let targetTrailCount = Math.floor(pixelPositions.length * trailPercentage);
        
        // Aggressive caps for performance at ALL levels
        if (this.params.trails <= 3) {
            targetTrailCount = Math.min(200, targetTrailCount); // Very low for levels 1-3
        } else if (this.params.trails <= 7) {
            targetTrailCount = Math.min(500, targetTrailCount); // Medium for levels 4-7
        } else {
            targetTrailCount = Math.min(800, targetTrailCount); // Still capped for levels 8-10
        }
        
        // Update trail pixel selection VERY infrequently to allow very long trails
        if (this.frameCount % 600 === 0) { // Every 600 frames (~20 seconds at 30fps)
            this.updateTrailPixelSelection(targetTrailCount, pixelPositions.length);
            this.cleanupTrailHistory(); // Clean up old trail data
        }
        
        // Apply trail effects to selected pixels - SIMPLIFIED for performance
        let trailsApplied = 0;
        const maxTrailLength = 40 + (this.params.trails * 16); // Much longer trails: 40-200 segments
        
        for (let pixelIndex of this.trailPixels) {
            if (pixelIndex >= pixelPositions.length) continue;
            
            const pixel = pixelPositions[pixelIndex];
            
            // Initialize trail history for new pixels
            if (!this.trailHistory.has(pixelIndex)) {
                this.trailHistory.set(pixelIndex, []);
            }
            
            const trailData = this.trailHistory.get(pixelIndex);
            
            // ALWAYS add current position to trail history (no speed check here)
            trailData.unshift({
                x: pixel.x,
                y: pixel.y
            });
            
            // Keep only last few positions for performance
            if (trailData.length > maxTrailLength) {
                trailData.length = maxTrailLength;
            }
            
            trailsApplied++;
        }
        
        // Debug logging
        if (this.frameCount % 120 === 0 && this.params.trails > 0) {
            console.log(`Trails: ${this.params.trails * 10}% coverage, ${this.trailPixels.size} pixels trailing, max length: ${maxTrailLength}`);
        }
    }

    updateTrailPixelSelection(targetCount, totalPixels) {
        // Clear existing selection
        this.trailPixels.clear();
        
        // Randomly select pixels for trailing
        const selectedIndices = new Set();
        while (selectedIndices.size < targetCount) {
            const randomIndex = Math.floor(Math.random() * totalPixels);
            selectedIndices.add(randomIndex);
        }
        
        this.trailPixels = selectedIndices;
    }

    cleanupTrailHistory() {
        // Remove trail data for pixels that are no longer selected
        for (let pixelIndex of this.trailHistory.keys()) {
            if (!this.trailPixels.has(pixelIndex)) {
                this.trailHistory.delete(pixelIndex);
                this.pixelColorCache.delete(pixelIndex); // Also cleanup color cache
            }
        }
    }

    renderTrails() {
        if (this.params.trails <= 0 || !this.ctx) return;
        
        // Render trails much less frequently for better performance  
        if (this.frameCount % 4 !== 0) return; // Every 4th frame only
        
        // Save canvas state
        this.ctx.save();
        this.ctx.lineWidth = 1; // Thinner lines for better performance
        this.ctx.strokeStyle = 'rgba(255,255,255,0.3)'; // Single white color for ALL trails
        
        // Draw ALL trails in a single path for maximum performance
        this.ctx.beginPath();
        
        let trailsDrawn = 0;
        for (let pixelIndex of this.trailPixels) {
            if (!this.trailHistory.has(pixelIndex)) continue;
            
            const trailData = this.trailHistory.get(pixelIndex);
            if (trailData.length < 2) continue;
            
            // Check for teleportation jumps in more trail points
            let hasValidTrail = true;
            const pointsToCheck = Math.min(trailData.length, 30); // Check up to 30 points
            for (let i = 1; i < pointsToCheck; i++) {
                const dx = trailData[i].x - trailData[i-1].x;
                const dy = trailData[i].y - trailData[i-1].y;
                if (dx * dx + dy * dy > 2500) { // 50*50 = 2500
                    hasValidTrail = false;
                    break;
                }
            }
            
            if (!hasValidTrail) continue; // Skip trails with teleportation
            
            // Add MUCH longer trail to the single path
            this.ctx.moveTo(trailData[0].x, trailData[0].y);
            const pointsToDraw = Math.min(trailData.length, 40); // Draw up to 40 points (doubled!)
            for (let i = 1; i < pointsToDraw; i++) {
                this.ctx.lineTo(trailData[i].x, trailData[i].y);
            }
            
            trailsDrawn++;
            
            // Much more aggressive limits for performance
            const maxTrailsToRender = this.params.trails <= 5 ? 30 : 60; // Even more reduced
            if (trailsDrawn >= maxTrailsToRender) break;
        }
        
        // Single stroke for ALL trails
        this.ctx.stroke();
        
        // Restore canvas state
        this.ctx.restore();
        
        // Debug logging with more detail
        if (this.frameCount % 60 === 0 && this.params.trails > 0) {
            let shortTrails = 0;
            let validTrails = 0;
            for (let data of this.trailHistory.values()) {
                if (data.length < 2) shortTrails++;
                else validTrails++;
            }
            console.log(`TRAILS DEBUG: ${trailsDrawn} trails drawn, ${this.trailPixels.size} selected pixels, ${this.trailHistory.size} in history (${validTrails} valid, ${shortTrails} too short)`);
        }
    }

    getPixelColor(pixelIndex) {
        // Get original color from the pixel manipulator's data
        if (this.pixelManipulator.originalData && this.pixelManipulator.width) {
            // Convert pixel index to x,y coordinates
            const y = Math.floor(pixelIndex / this.pixelManipulator.width);
            const x = pixelIndex % this.pixelManipulator.width;
            
            // Convert to data array index (RGBA format)
            const dataIndex = (y * this.pixelManipulator.width + x) * 4;
            
            if (dataIndex + 3 < this.pixelManipulator.originalData.length) {
                return {
                    r: this.pixelManipulator.originalData[dataIndex],
                    g: this.pixelManipulator.originalData[dataIndex + 1],
                    b: this.pixelManipulator.originalData[dataIndex + 2]
                };
            }
        }
        
        // Default to white if we can't get the original color
        return { r: 255, g: 255, b: 255 };
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
        
        // Apply mirror reflections BEFORE scatter (so scatter can also be reflected)
        this.applyMirrorReflections();
        
        // Apply scatter forces AFTER position update and mirror reflections
        this.applyScatterForces();
        
        // Apply scan line interference for CRT-like distortion effects
        this.applyScanLineInterference();
        
        // Apply kaleidoscope fractal for mesmerizing symmetrical patterns
        this.applyKaleidoscopeFractal();
        
        // Apply trails to create ghosting effects on moving pixels
        this.applyTrails();
        
        // Render frame
        const frameData = this.pixelManipulator.renderFrame();
        
        // Render trails on top of the main frame
        this.renderTrails();
        
        // Draw mirror lines on top if they exist (for debugging)
        if (this.params.randomMirrors > 0) {
            this.visualizeMirrorLines();
        }
        
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

    visualizeMirrorLines() {
        // Mirror lines are now invisible - no rendering
        return;
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