class PixelManipulator {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.imageData = null;
        this.originalData = null;
        this.currentData = null;
        this.width = 0;
        this.height = 0;
        this.pixelPositions = [];  // Tracks current position of each pixel
        this.pixelVelocities = []; // Velocity for each pixel
        this.regions = [];
        this.flowField = null;
        this.time = 0;
    }

    initialize(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;
        this.imageData = this.ctx.createImageData(this.width, this.height);
    }

    loadImageData(imageData) {
        this.originalData = new Uint8ClampedArray(imageData.data);
        this.currentData = new Uint8ClampedArray(imageData.data);
        this.imageData = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
        this.width = imageData.width;
        this.height = imageData.height;
        
        // Initialize pixel positions - each pixel starts at its original location
        this.initializePixelPositions();
    }

    initializePixelPositions() {
        this.pixelPositions = [];
        this.pixelVelocities = [];
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.pixelPositions.push({
                    x: x,
                    y: y,
                    originalX: x,
                    originalY: y
                });
                this.pixelVelocities.push({
                    x: 0,
                    y: 0
                });
            }
        }
    }


    setRegions(regions) {
        this.regions = regions;
        this.assignPixelsToRegions();
    }

    assignPixelsToRegions() {
        // Create a map of pixel index to region ID
        this.pixelToRegion = new Array(this.width * this.height).fill(-1);
        
        this.regions.forEach((region, regionId) => {
            region.pixels.forEach(pixel => {
                const index = pixel.y * this.width + pixel.x;
                if (index < this.pixelToRegion.length) {
                    this.pixelToRegion[index] = regionId;
                }
            });
        });
    }

    setFlowField(flowField) {
        this.flowField = flowField;
    }
    
    resetVelocities() {
        // Reset all pixel velocities to zero for immediate response to new forces
        for (let i = 0; i < this.pixelVelocities.length; i++) {
            this.pixelVelocities[i].x = 0;
            this.pixelVelocities[i].y = 0;
        }
    }

    updatePixelPositions(deltaTime, movementSpeed = 1.0, brightnessSensitivity = 1.0) {
        this.time += deltaTime;
        
        // Update each pixel's position based on forces
        for (let i = 0; i < this.pixelPositions.length; i++) {
            const pos = this.pixelPositions[i];
            const vel = this.pixelVelocities[i];
            const regionId = this.pixelToRegion[i];
            
            // Sample flow field at current position
            let flowVector = {x: 0, y: 0};
            if (this.flowField) {
                flowVector = this.sampleFlowField(pos.x, pos.y);
                
            }
            
            // Get pixel color/brightness for force calculations
            const originalIndex = pos.originalY * this.width + pos.originalX;
            const pixelBrightness = this.getPixelBrightness(originalIndex);
            const regionInfo = regionId >= 0 ? this.regions[regionId] : null;
            
            // Apply brightness-based movement
            const brightnessForce = this.calculatePixelBrightnessForce(pixelBrightness, brightnessSensitivity);
            
            // Apply region-based forces if pixel belongs to a region
            const regionForce = regionInfo ? this.calculatePixelRegionForce(pos, regionInfo) : {x: 0, y: 0};
            
            // Apply some noise/randomness for organic movement
            const noiseForce = {
                x: (Math.random() - 0.5) * 0.05,
                y: (Math.random() - 0.5) * 0.05
            };
            
            // Combine forces - special handling for chromatic flow
            let flowWeight = 0.1;
            if (this.flowField && this.flowField[0]?.chromatic) {
                flowWeight = 0.8; // Much stronger weight for chromatic flow
            }
            
            const totalForceX = flowVector.x * flowWeight + brightnessForce.x * 0.25 + regionForce.x * 0.1 + noiseForce.x * 0.05;
            const totalForceY = flowVector.y * flowWeight + brightnessForce.y * 0.25 + regionForce.y * 0.1 + noiseForce.y * 0.05;
            
            // Update velocity with damping - PRESERVE existing velocity (includes gravity forces)
            const damping = 0.95;
            vel.x = vel.x * damping + totalForceX * deltaTime * movementSpeed;
            vel.y = vel.y * damping + totalForceY * deltaTime * movementSpeed;
            
            // Limit velocity to prevent chaos (scale with movement speed)
            const maxVelocity = 3.0 * movementSpeed;
            const currentSpeed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
            if (currentSpeed > maxVelocity) {
                vel.x = (vel.x / currentSpeed) * maxVelocity;
                vel.y = (vel.y / currentSpeed) * maxVelocity;
            }
            
            // Update position
            pos.x += vel.x;
            pos.y += vel.y;
            
            // Boundary conditions - wrap around
            if (pos.x < 0) pos.x = this.width - 1;
            if (pos.x >= this.width) pos.x = 0;
            if (pos.y < 0) pos.y = this.height - 1;
            if (pos.y >= this.height) pos.y = 0;
        }
    }

    getPixelBrightness(originalIndex) {
        if (originalIndex >= 0 && originalIndex * 4 < this.originalData.length) {
            const r = this.originalData[originalIndex * 4];
            const g = this.originalData[originalIndex * 4 + 1];
            const b = this.originalData[originalIndex * 4 + 2];
            return (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        }
        return 0.5; // neutral brightness as fallback
    }

    calculatePixelBrightnessForce(brightness, sensitivity) {
        // Bright pixels tend to rise, dark pixels tend to sink
        const verticalForce = (brightness - 0.5) * sensitivity * 0.2; // Increased from 0.08
        
        // Add some horizontal drift based on brightness
        const horizontalForce = Math.sin(brightness * Math.PI * 2) * 0.1; // Increased from 0.03
        
        return {
            x: horizontalForce,
            y: -verticalForce // Negative because canvas Y increases downward
        };
    }

    calculatePixelRegionForce(pixelPos, regionInfo) {
        // Force towards region center with some oscillation
        const centerX = regionInfo.center.x;
        const centerY = regionInfo.center.y;
        const dx = centerX - pixelPos.x;
        const dy = centerY - pixelPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return {x: 0, y: 0};
        
        const pullStrength = 0.0005;
        const oscillationStrength = 0.01;
        const time = this.time * 0.001;
        
        return {
            x: (dx / distance) * pullStrength + Math.sin(time + pixelPos.x * 0.01) * oscillationStrength,
            y: (dy / distance) * pullStrength + Math.cos(time + pixelPos.y * 0.01) * oscillationStrength
        };
    }

    sampleFlowField(x, y) {
        if (!this.flowField) return {x: 0, y: 0};
        
        // Flow field is at 1/4 resolution (as per movement-engine.js line 115-116)
        const fieldWidth = Math.floor(this.width / 4);
        const fieldHeight = Math.floor(this.height / 4);
        
        // Map pixel coordinates to flow field coordinates
        const fx = Math.floor((x / this.width) * fieldWidth);
        const fy = Math.floor((y / this.height) * fieldHeight);
        
        // Clamp to valid range
        const clampedFx = Math.max(0, Math.min(fieldWidth - 1, fx));
        const clampedFy = Math.max(0, Math.min(fieldHeight - 1, fy));
        
        const index = clampedFy * fieldWidth + clampedFx;
        
        if (index >= 0 && index < this.flowField.length) {
            return this.flowField[index];
        }
        
        return {x: 0, y: 0};
    }

    renderFrame() {
        // Create displaced image data
        const displacedImageData = this.createDisplacedImage();
        
        // Clear canvas and render displaced image
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.putImageData(displacedImageData, 0, 0);
        
        return displacedImageData;
    }

    createDisplacedImage() {
        // Create new image data for the displaced image
        const displacedData = new Uint8ClampedArray(this.width * this.height * 4);
        
        // Fill with black initially
        for (let i = 0; i < displacedData.length; i += 4) {
            displacedData[i] = 0;     // R
            displacedData[i + 1] = 0; // G
            displacedData[i + 2] = 0; // B
            displacedData[i + 3] = 255; // A
        }
        
        // Place each pixel at its displaced position
        for (let i = 0; i < this.pixelPositions.length; i++) {
            const pos = this.pixelPositions[i];
            const originalIndex = pos.originalY * this.width + pos.originalX;
            
            // Get current position (rounded to integer pixel coordinates)
            const currentX = Math.round(pos.x);
            const currentY = Math.round(pos.y);
            
            // Skip if displaced position is out of bounds
            if (currentX < 0 || currentX >= this.width || currentY < 0 || currentY >= this.height) {
                continue;
            }
            
            const currentIndex = currentY * this.width + currentX;
            
            // Copy original pixel color to displaced position
            if (originalIndex >= 0 && originalIndex * 4 < this.originalData.length &&
                currentIndex >= 0 && currentIndex * 4 < displacedData.length) {
                
                displacedData[currentIndex * 4] = this.originalData[originalIndex * 4];         // R
                displacedData[currentIndex * 4 + 1] = this.originalData[originalIndex * 4 + 1]; // G
                displacedData[currentIndex * 4 + 2] = this.originalData[originalIndex * 4 + 2]; // B
                displacedData[currentIndex * 4 + 3] = this.originalData[originalIndex * 4 + 3]; // A
            }
        }
        
        return new ImageData(displacedData, this.width, this.height);
    }

    createInterpolatedDisplacedImage() {
        // Alternative method using bilinear interpolation for smoother results
        const displacedData = new Uint8ClampedArray(this.width * this.height * 4);
        
        // Fill with black initially
        for (let i = 0; i < displacedData.length; i += 4) {
            displacedData[i] = 0;
            displacedData[i + 1] = 0;
            displacedData[i + 2] = 0;
            displacedData[i + 3] = 255;
        }
        
        // For each pixel, distribute its color to nearby positions based on displacement
        for (let i = 0; i < this.pixelPositions.length; i++) {
            const pos = this.pixelPositions[i];
            const originalIndex = pos.originalY * this.width + pos.originalX;
            
            if (originalIndex < 0 || originalIndex * 4 >= this.originalData.length) continue;
            
            // Get original pixel color
            const r = this.originalData[originalIndex * 4];
            const g = this.originalData[originalIndex * 4 + 1];
            const b = this.originalData[originalIndex * 4 + 2];
            const a = this.originalData[originalIndex * 4 + 3];
            
            // Distribute to 4 nearest pixels using bilinear interpolation
            const x1 = Math.floor(pos.x);
            const y1 = Math.floor(pos.y);
            const x2 = x1 + 1;
            const y2 = y1 + 1;
            
            const fx = pos.x - x1;
            const fy = pos.y - y1;
            
            // Calculate weights for bilinear interpolation
            const weights = [
                (1 - fx) * (1 - fy), // Top-left
                fx * (1 - fy),       // Top-right
                (1 - fx) * fy,       // Bottom-left
                fx * fy              // Bottom-right
            ];
            
            const positions = [
                {x: x1, y: y1},
                {x: x2, y: y1},
                {x: x1, y: y2},
                {x: x2, y: y2}
            ];
            
            // Distribute color to each position based on weight
            positions.forEach((pos, idx) => {
                if (pos.x >= 0 && pos.x < this.width && pos.y >= 0 && pos.y < this.height) {
                    const targetIndex = pos.y * this.width + pos.x;
                    const weight = weights[idx];
                    
                    // Blend colors (simple additive blending)
                    displacedData[targetIndex * 4] = Math.min(255, displacedData[targetIndex * 4] + r * weight);
                    displacedData[targetIndex * 4 + 1] = Math.min(255, displacedData[targetIndex * 4 + 1] + g * weight);
                    displacedData[targetIndex * 4 + 2] = Math.min(255, displacedData[targetIndex * 4 + 2] + b * weight);
                }
            });
        }
        
        return new ImageData(displacedData, this.width, this.height);
    }

    renderRegionVisualization() {
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        this.ctx.strokeStyle = '#0f0';
        this.ctx.lineWidth = 1;
        
        this.regions.forEach(region => {
            // Draw region bounds
            const bounds = region.bounds;
            this.ctx.strokeRect(
                bounds.minX, 
                bounds.minY, 
                bounds.maxX - bounds.minX, 
                bounds.maxY - bounds.minY
            );
            
            // Draw center point
            this.ctx.fillStyle = '#0f0';
            this.ctx.beginPath();
            this.ctx.arc(region.center.x, region.center.y, 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw movement vector
            if (region.movementVector) {
                const scale = 20;
                this.ctx.beginPath();
                this.ctx.moveTo(region.center.x, region.center.y);
                this.ctx.lineTo(
                    region.center.x + region.movementVector.x * scale,
                    region.center.y + region.movementVector.y * scale
                );
                this.ctx.stroke();
            }
        });
        
        this.ctx.restore();
    }

    exportFrame() {
        return this.ctx.getImageData(0, 0, this.width, this.height);
    }

    getPixelCount() {
        return this.pixelPositions.length;
    }

    getRegionCount() {
        return this.regions.length;
    }

    reset() {
        this.regions = [];
        this.flowField = null;
        this.time = 0;
        
        if (this.originalData) {
            this.loadImageData(new ImageData(this.originalData, this.width, this.height));
        }
    }

    // Utility method to switch between rendering modes
    setRenderingMode(mode = 'displaced') {
        this.renderingMode = mode; // 'displaced' or 'interpolated'
    }

    // Alternative rendering using the interpolated method
    renderFrameInterpolated() {
        const displacedImageData = this.createInterpolatedDisplacedImage();
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.putImageData(displacedImageData, 0, 0);
        return displacedImageData;
    }

    // Debug method to visualize pixel displacement vectors
    visualizeDisplacement() {
        this.ctx.save();
        this.ctx.strokeStyle = '#0f0';
        this.ctx.lineWidth = 0.5;
        this.ctx.globalAlpha = 0.5;
        
        // Sample every 10th pixel to avoid overcrowding
        for (let i = 0; i < this.pixelPositions.length; i += 10) {
            const pos = this.pixelPositions[i];
            
            this.ctx.beginPath();
            this.ctx.moveTo(pos.originalX, pos.originalY);
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
            
            // Draw small dots at displaced positions
            this.ctx.fillStyle = '#f00';
            this.ctx.beginPath();
            this.ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
            this.ctx.fill();
        }
        
        this.ctx.restore();
    }

}