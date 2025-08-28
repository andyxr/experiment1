class PixelMovementDemo {
    constructor() {
        this.movementEngine = new MovementEngine();
        this.videoExporter = new VideoExporter();
        
        // Initialize Simple MP4 exporter if available
        this.simpleMP4Exporter = null;
        if (typeof SimpleMP4Exporter !== 'undefined') {
            try {
                this.simpleMP4Exporter = new SimpleMP4Exporter();
            } catch (e) {
                console.warn('Simple MP4 Exporter not available:', e.message);
            }
        }
        
        this.canvas = null;
        this.ctx = null;
        this.currentImage = null;
        this.regions = [];
        
        this.isInitialized = false;
        this.statusElement = null;
        
        this.init();
    }

    init() {
        console.log('=== INIT METHOD CALLED ===');
        console.log('Document ready state:', document.readyState);
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            console.log('Document still loading, adding event listener');
            document.addEventListener('DOMContentLoaded', () => {
                console.log('DOMContentLoaded event fired');
                this.setupInterface();
            });
        } else {
            console.log('Document already ready, calling setupInterface directly');
            this.setupInterface();
        }
    }

    setupInterface() {
        console.log('=== SETUP INTERFACE START ===');
        
        // Get DOM elements
        this.canvas = document.getElementById('main-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.statusElement = document.getElementById('status-text');
        console.log('DOM elements retrieved');
        
        // Initialize engines
        this.movementEngine.initialize(this.canvas);
        this.videoExporter.initialize(this.canvas);
        
        // Initialize Simple MP4 exporter with canvas
        if (this.simpleMP4Exporter) {
            this.simpleMP4Exporter.initialize(this.canvas);
        }
        console.log('Engines initialized');
        
        // Set up event listeners
        console.log('About to setup event listeners...');
        this.setupEventListeners();
        console.log('Event listeners setup complete');
        
        // Direct initialization without setTimeout
        console.log('About to initialize scan line control...');
        this.initializeScanLineControl();
        console.log('Scan line control initialization complete');
        
        // Initialize kaleidoscope control
        this.initializeKaleidoscopeControl();
        
        // Initialize flow field controls
        this.initializeFlowFieldControls();
        
        // Update interface
        this.updateStatus('System initialized. Ready to load image...');
        this.updateStats();
        
        this.isInitialized = true;
    }

    setupEventListeners() {
        // Image input
        const imageInput = document.getElementById('image-input');
        imageInput.addEventListener('change', (e) => this.handleImageLoad(e));
        
        // Control sliders
        const controls = [
            {
                sliderId: 'movement-speed',
                displayId: 'speed-value',
                parameterName: 'movementSpeed',
                parser: parseFloat
            },
            {
                sliderId: 'noise-scale',
                displayId: 'noise-value',
                parameterName: 'noiseScale',
                parser: parseFloat
            },
            {
                sliderId: 'brightness-sensitivity',
                displayId: 'brightness-value',
                parameterName: 'brightnessSensitivity',
                parser: parseFloat
            },
            {
                sliderId: 'region-threshold',
                displayId: 'threshold-value',
                parameterName: 'regionThreshold',
                parser: parseInt
            },
            {
                sliderId: 'gravity-strength',
                displayId: 'gravity-value',
                parameterName: 'gravityStrength',
                parser: parseFloat
            },
            {
                sliderId: 'scatter-strength',
                displayId: 'scatter-value',
                parameterName: 'scatterStrength',
                parser: parseInt
            },
        ];
        
        controls.forEach(({ sliderId, displayId, parameterName, parser }) => {
            const slider = document.getElementById(sliderId);
            const valueDisplay = document.getElementById(displayId);
            
            if (slider) {
                slider.addEventListener('input', (e) => {
                    const value = parser(e.target.value);
                    this.movementEngine.setParameter(parameterName, value);
                    if (valueDisplay) {
                        valueDisplay.textContent = value;
                    }
                });
            }
        });
        
        // Buttons
        document.getElementById('analyze-btn').addEventListener('click', () => this.analyzeCurrentImage());
        document.getElementById('start-animation-btn').addEventListener('click', () => this.startAnimation());
        document.getElementById('stop-animation-btn').addEventListener('click', () => this.stopAnimation());
        document.getElementById('reset-btn').addEventListener('click', () => this.reset());
        document.getElementById('export-btn').addEventListener('click', () => this.exportVideo());
        
        // Animation frame updates
        this.setupAnimationLoop();
    }

    initializeScanLineControl() {
        try {
            console.log('=== SCAN LINE CONTROL INIT START ===');
            const slider = document.getElementById('scan-line-interference');
            const display = document.getElementById('interference-value');
            
            console.log('Slider element:', slider);
            console.log('Display element:', display);
            
            if (slider && display) {
                console.log('Adding event listener...');
                const handler = (e) => {
                    console.log('=== SLIDER EVENT FIRED ===');
                    const value = parseInt(e.target.value);
                    console.log('New value:', value);
                    this.movementEngine.setParameter('scanLineInterference', value);
                    display.textContent = value;
                    console.log('Display updated to:', display.textContent);
                };
                
                slider.addEventListener('input', handler);
                console.log('Event listener added successfully');
                
                // Test that we can update the display manually
                display.textContent = '0';
                console.log('Manual display update test successful');
                
            } else {
                console.error('Elements not found - slider:', !!slider, 'display:', !!display);
            }
            console.log('=== SCAN LINE CONTROL INIT END ===');
        } catch (error) {
            console.error('Error in initializeScanLineControl:', error);
        }
    }

    initializeKaleidoscopeControl() {
        const slider = document.getElementById('kaleidoscope-fractal');
        const display = document.getElementById('kaleidoscope-value');
        
        if (slider && display) {
            slider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.movementEngine.setParameter('kaleidoscopeFractal', value);
                display.textContent = value;
            });
            console.log('Kaleidoscope Fractal control initialized');
        }
    }

    initializeFlowFieldControls() {
        // Flow field type dropdown
        const typeSelect = document.getElementById('flow-field-type');
        if (typeSelect) {
            typeSelect.addEventListener('change', (e) => {
                const value = e.target.value;
                this.movementEngine.setParameter('flowFieldType', value);
            });
            console.log('Flow field type control initialized');
        }

        // Flow strength slider
        const strengthSlider = document.getElementById('flow-strength');
        const strengthDisplay = document.getElementById('flow-strength-value');
        
        if (strengthSlider && strengthDisplay) {
            strengthSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.movementEngine.setParameter('flowStrength', value);
                strengthDisplay.textContent = value;
            });
            console.log('Flow strength control initialized');
        }
    }

    setupAnimationLoop() {
        const updateLoop = () => {
            if (this.movementEngine.isRunning) {
                this.updateStats();
            }
            requestAnimationFrame(updateLoop);
        };
        updateLoop();
    }

    async handleImageLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.updateStatus('Loading image...');
        
        try {
            const image = await this.loadImageFile(file);
            this.currentImage = image;
            
            // Scale canvas to fit image while maintaining aspect ratio
            this.resizeCanvasForImage(image);
            
            // Draw image to canvas
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);
            
            // Get image data
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            // Load into movement engine
            this.regions = this.movementEngine.loadImage(imageData);
            
            this.updateStatus(`Image loaded. Found ${this.regions.length} regions. Click 'Start Animation' to begin.`);
            this.enableControls(['analyze-btn', 'start-animation-btn']);
            this.updateStats();
            
            // Update canvas info
            document.getElementById('canvas-size').textContent = `${this.canvas.width}x${this.canvas.height}`;
            
        } catch (error) {
            this.updateStatus(`Error loading image: ${error.message}`);
            console.error(error);
        }
    }

    loadImageFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    resizeCanvasForImage(image) {
        const maxWidth = 800;
        const maxHeight = 600;
        
        let { width, height } = image;
        
        // Scale down if image is too large
        if (width > maxWidth || height > maxHeight) {
            const scale = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * scale);
            height = Math.floor(height * scale);
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        // Update video exporter settings
        this.videoExporter.updateSettings({ width, height });
    }

    analyzeCurrentImage() {
        if (!this.currentImage) return;
        
        this.updateStatus('Re-analyzing image with current settings...');
        
        // Redraw image
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.currentImage, 0, 0, this.canvas.width, this.canvas.height);
        
        // Get fresh image data
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        // Re-analyze
        this.regions = this.movementEngine.loadImage(imageData);
        
        this.updateStatus(`Re-analysis complete. Found ${this.regions.length} regions.`);
        this.updateStats();
    }

    startAnimation() {
        if (!this.currentImage || !this.regions.length) {
            this.updateStatus('Please load an image first.');
            return;
        }
        
        this.movementEngine.startAnimation();
        this.updateStatus('Animation started. Pixels are now moving based on configured rules.');
        this.enableControls(['stop-animation-btn', 'export-btn']);
        this.disableControls(['start-animation-btn', 'analyze-btn']);
    }

    stopAnimation() {
        this.movementEngine.stopAnimation();
        this.updateStatus('Animation stopped.');
        this.enableControls(['start-animation-btn', 'analyze-btn']);
        this.disableControls(['stop-animation-btn']);
    }

    reset() {
        this.movementEngine.reset();
        this.videoExporter.cleanup();
        
        if (this.currentImage) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(this.currentImage, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        this.updateStatus('System reset. Ready for new configuration.');
        this.enableControls(['analyze-btn', 'start-animation-btn']);
        this.disableControls(['stop-animation-btn', 'export-btn']);
        this.updateStats();
    }

    async exportVideo() {
        if (!this.movementEngine.isRunning) {
            this.updateStatus('Starting animation for video export...');
            this.startAnimation();
            // Wait a moment for animation to start
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Choose exporter: prefer Simple MP4 for MP4, fallback to MediaRecorder
        const useSimpleMP4 = this.simpleMP4Exporter && this.simpleMP4Exporter.isWebCodecsSupported();
        
        if (useSimpleMP4) {
            await this.exportVideoSimpleMP4();
        } else {
            await this.exportVideoMediaRecorder();
        }
    }

    async exportVideoSimpleMP4() {
        try {
            this.updateStatus('Starting Simple MP4 recording...');
            
            // Check codec support
            const codecSupport = await this.simpleMP4Exporter.checkCodecSupport();
            if (!codecSupport.supported) {
                throw new Error(`Codec not supported: ${codecSupport.reason}`);
            }
            
            await this.simpleMP4Exporter.startRecording();
            this.updateStatus(`Recording MP4 video with ${codecSupport.codec} codec... Stop animation to finish and download.`);
            
            // Set up frame recording callback
            this.isSimpleMP4Recording = true;
            this.movementEngine.setFrameRecordCallback(() => {
                if (this.simpleMP4Exporter && this.simpleMP4Exporter.isRecording) {
                    this.simpleMP4Exporter.recordFrame();
                }
            });
            
            // Automatically stop recording after animation stops
            const checkStop = () => {
                if (!this.movementEngine.isRunning && this.simpleMP4Exporter.isRecording) {
                    this.finalizeSimpleMP4Export();
                } else if (this.simpleMP4Exporter.isRecording) {
                    setTimeout(checkStop, 100);
                }
            };
            setTimeout(checkStop, 100);
            
        } catch (error) {
            this.updateStatus(`Simple MP4 recording failed: ${error.message}. Falling back to MediaRecorder...`);
            console.error(error);
            // Fallback to MediaRecorder
            await this.exportVideoMediaRecorder();
        }
    }

    async finalizeSimpleMP4Export() {
        try {
            this.updateStatus('Finalizing MP4 video...');
            
            const videoData = await this.simpleMP4Exporter.stopRecording();
            
            if (videoData) {
                this.simpleMP4Exporter.downloadVideo(videoData, 'pixel-movement-video');
                this.updateStatus(`MP4 video exported successfully! ${videoData.frameCount} frames, ${videoData.duration.toFixed(2)}s`);
            } else {
                this.updateStatus('Failed to create MP4 video file.');
            }
        } catch (error) {
            this.updateStatus(`MP4 export finalization failed: ${error.message}`);
            console.error(error);
        } finally {
            this.isSimpleMP4Recording = false;
            this.movementEngine.clearFrameRecordCallback();
        }
    }

    async exportVideoMediaRecorder() {
        try {
            this.updateStatus('Starting MediaRecorder video recording...');
            
            await this.videoExporter.startRecording();
            this.updateStatus('Recording video... Stop animation to finish and download.');
            
            // Automatically stop recording after animation stops
            const checkStop = () => {
                if (!this.movementEngine.isRunning && this.videoExporter.isRecording) {
                    this.finalizeVideoExport();
                } else if (this.videoExporter.isRecording) {
                    setTimeout(checkStop, 100);
                }
            };
            setTimeout(checkStop, 100);
            
        } catch (error) {
            this.updateStatus(`Recording failed: ${error.message}`);
            console.error(error);
        }
    }

    async finalizeVideoExport() {
        try {
            this.updateStatus('Finalizing video...');
            
            this.videoExporter.stopRecording();
            
            // Wait a bit for the recording to finalize
            setTimeout(() => {
                const videoData = this.videoExporter.finalizeRecording();
                if (videoData) {
                    this.videoExporter.downloadVideo(videoData, 'pixel-movement-animation');
                    this.updateStatus(`Video exported successfully! Size: ${(videoData.size / 1024 / 1024).toFixed(2)} MB`);
                } else {
                    this.updateStatus('Failed to create video file.');
                }
            }, 500);
            
        } catch (error) {
            this.updateStatus(`Export finalization failed: ${error.message}`);
            console.error(error);
        }
    }

    updateStats() {
        if (!this.isInitialized) return;
        
        const stats = this.movementEngine.getStats();
        
        document.getElementById('region-count').textContent = stats.regionCount;
        document.getElementById('particle-count').textContent = stats.pixelCount;
        
        // Update canvas size display
        document.getElementById('canvas-size').textContent = `${this.canvas.width}x${this.canvas.height}`;
    }

    updateStatus(message) {
        if (this.statusElement) {
            this.statusElement.textContent = message;
        }
        console.log('Status:', message);
    }

    enableControls(controlIds) {
        controlIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.disabled = false;
        });
    }

    disableControls(controlIds) {
        controlIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.disabled = true;
        });
    }

    // Preset methods for different movement styles
    applyPreset(presetName) {
        this.movementEngine.applyPreset(presetName);
        this.updateControlValues();
        this.updateStatus(`Applied ${presetName} preset.`);
    }

    updateControlValues() {
        const params = this.movementEngine.params;
        
        // Update slider values and displays
        const updates = [
            ['movement-speed', params.movementSpeed],
            ['noise-scale', params.noiseScale],
            ['brightness-sensitivity', params.brightnessSensitivity],
            ['region-threshold', params.regionThreshold],
            ['gravity-strength', params.gravityStrength],
            ['scatter-strength', params.scatterStrength],
        ];
        
        const displayMap = {
            'movement-speed': 'speed-value',
            'noise-scale': 'noise-value',
            'brightness-sensitivity': 'brightness-value',
            'region-threshold': 'threshold-value',
            'gravity-strength': 'gravity-value',
            'scatter-strength': 'scatter-value',
        };

        // Also update flow field controls
        const flowTypeSelect = document.getElementById('flow-field-type');
        const flowStrengthSlider = document.getElementById('flow-strength');
        const flowStrengthDisplay = document.getElementById('flow-strength-value');
        
        if (flowTypeSelect) flowTypeSelect.value = params.flowFieldType;
        if (flowStrengthSlider) flowStrengthSlider.value = params.flowStrength;
        if (flowStrengthDisplay) flowStrengthDisplay.textContent = params.flowStrength;
        
        updates.forEach(([id, value]) => {
            const slider = document.getElementById(id);
            const display = document.getElementById(displayMap[id]);
            
            if (slider) slider.value = value;
            if (display) display.textContent = value;
        });
    }

    // Debug methods
    visualizeRegions() {
        if (this.regions.length > 0) {
            this.movementEngine.imageAnalyzer.visualizeRegions(this.canvas, this.regions);
            this.updateStatus('Showing region visualization.');
        }
    }

    visualizeFlowField() {
        this.movementEngine.visualizeFlowField(0.3);
        this.updateStatus('Showing flow field visualization.');
    }

    visualizeGravityWells() {
        this.movementEngine.visualizeGravityWells();
        this.updateStatus('Showing gravity wells visualization.');
    }

    visualizeDisplacement() {
        this.movementEngine.pixelManipulator.visualizeDisplacement();
        this.updateStatus('Showing pixel displacement vectors.');
    }


    // Advanced features
    createCompositeEffect() {
        const effects = [
            { type: 'perlin', scale: 0.01, weight: 0.6 },
            { type: 'vortex', centerX: this.canvas.width / 2, centerY: this.canvas.height / 2, strength: 0.8, weight: 0.4 }
        ];
        
        this.movementEngine.createCompositeEffect(effects);
        this.updateStatus('Applied composite movement effect.');
    }

    enableBrightnessMovement() {
        this.movementEngine.addBrightnessBasedMovement();
        this.updateStatus('Enhanced with brightness-based movement.');
    }

    enableColorHarmony() {
        this.movementEngine.addColorHarmonyMovement();
        this.updateStatus('Added color harmony movement coordination.');
    }
}

// Initialize the demo when the script loads
const demo = new PixelMovementDemo();

// Make demo available globally for debugging
window.pixelMovementDemo = demo;