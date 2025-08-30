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
            scatterPulseEnabled: false,
            scatterPulseProbability: 0,
            heightMapStrength: 0.0,
            heightMapRotationSpeed: 0.5,
            scanLineInterference: 0, // 0-10 scale for interference strength
            kaleidoscopeFractal: 0, // 0-10 scale for kaleidoscope symmetry intensity
            trails: 0, // 0-10 scale for trailing effect percentage (0=0%, 10=100%)
            colorShift: 0, // 0-1 scale for color changing frequency (0=none, 1=frequent)
            flowFieldType: 'perlin', // 'perlin', 'turbulent', 'directional', 'vortex', 'wave', 'swarm', 'magnetic', 'cellular', 'centrifugal', 'radial', 'chromatic', 'timeDisplacement', 'feedbackEcho'
            flowStrength: 1.0,
            timeStep: 0.01,
            particleLifetime: 2000,
            trailLength: 10
        };
        
        this.flowFieldCache = new Map();
        this.frameCount = 0;
        this.exportFrames = [];
        this.isRecording = false;
        this.frameRecordCallback = null; // Callback for WebCodecs frame recording
        
        // Feedback echo system
        this.feedbackFrames = [];
        this.maxFeedbackFrames = 3; // Keep only last 3 frames for performance
        this.feedbackEchoDecay = 0.8;
        this.feedbackIntensity = 1.0; // How strongly feedback affects flow
        
        // Gravity system
        this.gravityWells = [];
        this.gravityRadius = 200; // Pixels within this radius are affected
        
        // Scan line interference system
        this.scanLinePhase = 0; // For animating the interference pattern
        
        // Kaleidoscope fractal system
        this.kaleidoscopeSegments = 6; // Number of symmetrical segments
        this.kaleidoscopeRotation = 0; // Current rotation angle
        
        // Trails system
        this.trailPixels = new Set(); // Pixels selected for trailing
        this.trailHistory = new Map(); // Stores trail positions for each pixel
        this.pixelColorCache = new Map(); // Cache pixel colors to avoid repeated calculations

        // Scatter Pulse runtime state
        this.scatterPulse = {
            windowMs: 5000,
            windowStartMs: 0,
            scheduledAtMs: null,
            activeFramesRemaining: 0
        };
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
                
                // For chromatic flow, reset velocities to see immediate strength changes
                if (this.params.flowFieldType === 'chromatic' && name === 'flowStrength') {
                    this.pixelManipulator.resetVelocities();
                }
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
                    
                    // If we're using Time Displacement, regenerate the flow field with new regions
                    if (this.params.flowFieldType === 'timeDisplacement') {
                        this.generateFlowField();
                    }
                }
            }

            // Handle Scatter Pulse runtime resets when toggled or probability changes
            if (name === 'scatterPulseEnabled') {
                if (value) {
                    const now = performance.now();
                    this.scatterPulse.windowStartMs = now;
                    this.scatterPulse.scheduledAtMs = null;
                    this.scatterPulse.activeFramesRemaining = 0;
                    this.scheduleScatterPulseForWindow(now);
                } else {
                    this.scatterPulse.scheduledAtMs = null;
                    this.scatterPulse.activeFramesRemaining = 0;
                }
            }
            if (name === 'scatterPulseProbability') {
                // Recompute scheduling for current window
                this.scheduleScatterPulseForWindow(this.scatterPulse.windowStartMs || performance.now());
            }
        }
    }

    // Schedules at most one pulse within the 5s window based on probability slider
    scheduleScatterPulseForWindow(startTimeMs) {
        if (!this.params.scatterPulseEnabled) {
            this.scatterPulse.scheduledAtMs = null;
            return;
        }
        const p = Math.max(0, Math.min(100, this.params.scatterPulseProbability)) / 100;
        if (p <= 0) {
            this.scatterPulse.scheduledAtMs = null;
            return;
        }
        // Decide if this window will have a pulse
        const willPulse = Math.random() < p || p === 1;
        if (!willPulse) {
            this.scatterPulse.scheduledAtMs = null;
            return;
        }
        const randOffset = Math.random() * this.scatterPulse.windowMs;
        this.scatterPulse.scheduledAtMs = startTimeMs + randOffset;
    }

    updateScatterPulse(currentTimeMs) {
        if (!this.params.scatterPulseEnabled) return;
        // Initialize window start if needed
        if (!this.scatterPulse.windowStartMs) {
            this.scatterPulse.windowStartMs = currentTimeMs;
            this.scheduleScatterPulseForWindow(this.scatterPulse.windowStartMs);
        }
        // Advance window every 5 seconds
        while (currentTimeMs - this.scatterPulse.windowStartMs >= this.scatterPulse.windowMs) {
            this.scatterPulse.windowStartMs += this.scatterPulse.windowMs;
            this.scatterPulse.scheduledAtMs = null;
            this.scheduleScatterPulseForWindow(this.scatterPulse.windowStartMs);
        }
        // Activate pulse when scheduled time arrives
        if (this.scatterPulse.scheduledAtMs !== null && currentTimeMs >= this.scatterPulse.scheduledAtMs && this.scatterPulse.activeFramesRemaining === 0) {
            this.scatterPulse.activeFramesRemaining = 2; // Active for 3 frames
            // Clear the schedule so it does not retrigger repeatedly within the same window
            this.scatterPulse.scheduledAtMs = null;
        }
    }

    isScatterPulseActive() {
        return this.scatterPulse.activeFramesRemaining > 0;
    }

    getEffectiveScatterStrength() {
        if (this.isScatterPulseActive()) return 90;
        // When Scatter Pulse is enabled but not active, strength must drop to 0
        if (this.params.scatterPulseEnabled) return 0;
        return this.params.scatterStrength;
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
            case 'swarm':
                flowField = this.perlinFlow.createSwarmFlow(
                    width, height, 12, this.params.flowStrength, time  // More boids for varied patterns
                );
                break;
            case 'magnetic':
                flowField = this.perlinFlow.createMagneticFlow(
                    width, height, 4, this.params.flowStrength, 'mixed'
                );
                break;
            case 'cellular':
                flowField = this.perlinFlow.createCellularFlow(
                    width, height, 12, this.params.flowStrength, time  // More initial cells
                );
                break;
            case 'centrifugal':
                flowField = this.perlinFlow.createCentrifugalFlow(
                    width, height, width / 2, height / 2, this.params.flowStrength, 0.1, time
                );
                break;
            case 'radial':
                flowField = this.perlinFlow.createRadialFlow(
                    width, height, width / 2, height / 2, this.params.flowStrength, time
                );
                break;
            case 'chromatic':
                flowField = this.perlinFlow.createChromaticFlow(
                    width, height, this.params.flowStrength, time, scale
                );
                break;
            case 'timeDisplacement':
                // Use the full resolution for time displacement since it's region-based
                flowField = this.perlinFlow.createTimeDisplacementFlow(
                    this.pixelManipulator.width, this.pixelManipulator.height, this.regions, time
                );
                break;
            case 'feedbackEcho':
                flowField = this.perlinFlow.createFeedbackEchoFlow(
                    width, height, this.feedbackFrames, this.params.flowStrength, time, this.feedbackEchoDecay
                );
                break;
            case 'lidar':
                flowField = this.perlinFlow.createLidarFlow(
                    width, height, this.params.flowStrength, time
                );
                break;
            default: // 'perlin'
                flowField = this.perlinFlow.createFlowField(width, height, scale, time);
                break;
        }
        
        // Pass full resolution flag for Time Displacement
        const isFullResolution = this.params.flowFieldType === 'timeDisplacement';
        this.pixelManipulator.setFlowField(flowField, isFullResolution);
    }

    generateGravityWells() {
        if (!this.pixelManipulator.width || !this.pixelManipulator.height || this.params.gravityStrength <= 0) {
            this.gravityWells = [];
            return;
        }
        
        // Much more reasonable number of gravity wells - not based on total pixels
        const wellCount = Math.max(1, Math.min(10, Math.ceil(this.params.gravityStrength * 2))); // Min 1, Max 10 wells
        
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
                    const force = (well.strength * 500.0) / Math.max(distance, 5); // Much stronger intensity!
                    const forceX = (dx / distance) * force;
                    const forceY = (dy / distance) * force;
                    
                    // Apply force more aggressively - directly move pixels toward gravity wells
                    const oldVelX = pixelVelocities[i].x;
                    const oldVelY = pixelVelocities[i].y;
                    
                    // Add to velocity AND directly to position for immediate effect
                    pixelVelocities[i].x += forceX * sampleRate * 3; // Triple the force
                    pixelVelocities[i].y += forceY * sampleRate * 3;
                    
                    // Also directly move pixel slightly toward well for immediate visible effect
                    const directMoveStrength = well.strength * 0.3;
                    pixelPositions[i].x += (dx / distance) * directMoveStrength;
                    pixelPositions[i].y += (dy / distance) * directMoveStrength;
                    
                    forcesApplied++;
                    
                }
            }
        }
        
    }

    applyScatterForces() {
        const effectiveStrength = this.getEffectiveScatterStrength();
        if (effectiveStrength <= 0) return;
        
        // Apply scatter every 3rd frame for consistency regardless of pulse
        if (this.frameCount % 3 !== 0) return; // Every 3rd frame for more dramatic effect
        
        const pixelPositions = this.pixelManipulator.pixelPositions;
        const pixelVelocities = this.pixelManipulator.pixelVelocities;
        
        // Calculate how many pixels to scatter based on percentage  
        const totalPixels = pixelPositions.length;
        const scatterCount = Math.floor((effectiveStrength / 100) * totalPixels / 3); // Divide by 3 since we apply every 3 frames
        
        console.log(`Scatter debug: totalPixels=${totalPixels}, scatterStrength=${effectiveStrength}, scatterCount=${scatterCount}`);
        
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
            const jumpDistance = 40 + (effectiveStrength * 2); // Big but not overwhelming jumps
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
            console.log(`Scatter: ${scatterCount} pixels scattered (${effectiveStrength}%), total affected per second: ~${scatterCount * 6}`);
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
        
        // Update flow field periodically - more frequently for dynamic types
        let updateInterval = 30; // Default: every 30 frames
        if (this.params.flowFieldType === 'swarm' || this.params.flowFieldType === 'cellular' || this.params.flowFieldType === 'centrifugal' || this.params.flowFieldType === 'chromatic') {
            updateInterval = 5; // Every 5 frames for dynamic behavior
        } else if (this.params.flowFieldType === 'feedbackEcho') {
            updateInterval = 3; // Every 3 frames for feedback echo - balance between effect and performance
        }
        
        if (this.frameCount % updateInterval === 0) {
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
            this.params.brightnessSensitivity,
            this.params.colorShift
        );
        
        // Update and apply Scatter Pulse logic
        this.updateScatterPulse(currentTime);
        // Apply scatter forces AFTER position update
        this.applyScatterForces();
        // Decrement pulse frames at the end of frame
        if (this.scatterPulse.activeFramesRemaining > 0) {
            this.scatterPulse.activeFramesRemaining--;
        }
        
        // Apply scan line interference for CRT-like distortion effects
        this.applyScanLineInterference();
        
        // Apply kaleidoscope fractal for mesmerizing symmetrical patterns
        this.applyKaleidoscopeFractal();
        
        // Apply trails to create ghosting effects on moving pixels
        this.applyTrails();
        
        // Render frame with color shifting
        const frameData = this.pixelManipulator.renderFrame(this.params.colorShift);
        
        // Apply height map effect if enabled
        if (this.params.heightMapStrength > 0) {
            this.applyHeightMapEffect(frameData);
        }
        
        // Capture frame for feedback echo if using that flow type
        this.captureFeedbackFrame(frameData);
        
        // Render trails on top of the main frame
        this.renderTrails();
        
        // Record frame if needed
        if (this.isRecording) {
            this.exportFrames.push(frameData);
        }
        
        // Call WebCodecs frame recording callback if set
        if (this.frameRecordCallback) {
            this.frameRecordCallback();
        }
        
        this.frameCount++;
        this.animationId = requestAnimationFrame(() => this.animate());
    }

    setFrameRecordCallback(callback) {
        this.frameRecordCallback = callback;
    }

    clearFrameRecordCallback() {
        this.frameRecordCallback = null;
    }

    captureFeedbackFrame(frameData) {
        if (!frameData) return;
        
        // Only capture frames every few frames to reduce overhead
        if (this.frameCount % 3 !== 0) return;
        
        // Create a downsampled version for much better performance
        const downsampleScale = 4; // 4x4 pixel blocks
        const downsampledWidth = Math.floor(frameData.width / downsampleScale);
        const downsampledHeight = Math.floor(frameData.height / downsampleScale);
        const downsampledData = new Uint8ClampedArray(downsampledWidth * downsampledHeight * 4);
        
        // Downsample by taking every Nth pixel
        for (let y = 0; y < downsampledHeight; y++) {
            for (let x = 0; x < downsampledWidth; x++) {
                const sourceX = x * downsampleScale;
                const sourceY = y * downsampleScale;
                const sourceIndex = (sourceY * frameData.width + sourceX) * 4;
                const targetIndex = (y * downsampledWidth + x) * 4;
                
                if (sourceIndex + 3 < frameData.data.length) {
                    downsampledData[targetIndex] = frameData.data[sourceIndex];     // R
                    downsampledData[targetIndex + 1] = frameData.data[sourceIndex + 1]; // G
                    downsampledData[targetIndex + 2] = frameData.data[sourceIndex + 2]; // B
                    downsampledData[targetIndex + 3] = frameData.data[sourceIndex + 3]; // A
                }
            }
        }
        
        const feedbackFrame = {
            data: downsampledData,
            width: downsampledWidth,
            height: downsampledHeight,
            originalWidth: frameData.width,
            originalHeight: frameData.height,
            timestamp: performance.now()
        };
        
        this.feedbackFrames.push(feedbackFrame);
        
        // Keep only the last maxFeedbackFrames
        if (this.feedbackFrames.length > this.maxFeedbackFrames) {
            this.feedbackFrames.shift();
        }
    }

    reset() {
        this.stopAnimation();
        this.pixelManipulator.reset();
        this.frameCount = 0;
        this.exportFrames = [];
        this.isRecording = false;
        this.frameRecordCallback = null;
        this.perlinFlow = new PerlinFlow(); // Reset time
        
        // Clear feedback frames
        this.feedbackFrames = [];
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

    applyHeightMapEffect(frameData) {
        if (!frameData || this.params.heightMapStrength === 0) return;
        
        const width = this.pixelManipulator.width;
        const height = this.pixelManipulator.height;
        const data = frameData.data;
        const strength = this.params.heightMapStrength;
        
        // Create a new image data for the height map effect
        const heightMapData = new Uint8ClampedArray(data.length);
        
        // Clear with black
        for (let i = 0; i < heightMapData.length; i += 4) {
            heightMapData[i] = 0;     // R
            heightMapData[i + 1] = 0; // G  
            heightMapData[i + 2] = 0; // B
            heightMapData[i + 3] = 255; // A
        }
        
        // Process each pixel
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                
                // Get original pixel color
                const r = data[pixelIndex];
                const g = data[pixelIndex + 1];
                const b = data[pixelIndex + 2];
                
                // Calculate brightness (0-1)
                const brightness = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
                
                // Calculate height based on brightness
                const maxHeight = Math.floor(height * 0.3); // Max 30% of canvas height
                const lineHeight = Math.floor(brightness * maxHeight * strength);
                
                // Calculate rotation angle based on time and position
                const rotationSpeed = this.frameCount * 0.02 * this.params.heightMapRotationSpeed; // User-controlled rotation
                const baseAngle = Math.atan2(y - height/2, x - width/2); // Radial pattern
                const rotationAngle = rotationSpeed + baseAngle * 0.5; // Combine time and position
                
                // Calculate direction vector for rotated line
                const dirX = Math.cos(rotationAngle + Math.PI/2); // Start perpendicular (vertical)
                const dirY = Math.sin(rotationAngle + Math.PI/2);
                
                // Draw rotated line
                for (let step = 0; step < lineHeight; step++) {
                    const offsetX = Math.round(dirX * step);
                    const offsetY = Math.round(dirY * step);
                    
                    const targetX = x + offsetX;
                    const targetY = y + offsetY;
                    
                    // Check bounds
                    if (targetX >= 0 && targetX < width && targetY >= 0 && targetY < height) {
                        const targetIndex = (targetY * width + targetX) * 4;
                        
                        // Use original pixel color for the line
                        heightMapData[targetIndex] = r;
                        heightMapData[targetIndex + 1] = g;
                        heightMapData[targetIndex + 2] = b;
                        heightMapData[targetIndex + 3] = 255;
                    }
                }
            }
        }
        
        // Blend the height map with the original image
        const blendFactor = strength;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.floor(data[i] * (1 - blendFactor) + heightMapData[i] * blendFactor);
            data[i + 1] = Math.floor(data[i + 1] * (1 - blendFactor) + heightMapData[i + 1] * blendFactor);
            data[i + 2] = Math.floor(data[i + 2] * (1 - blendFactor) + heightMapData[i + 2] * blendFactor);
        }
        
        // Update the canvas
        this.ctx.putImageData(frameData, 0, 0);
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