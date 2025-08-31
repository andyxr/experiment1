class MediabunnyMP4Exporter {
    constructor() {
        this.isRecording = false;
        this.output = null;
        this.videoSource = null;
        this.canvas = null;
        this.frameCount = 0;
        this.startTime = 0;
        
        // Export settings - optimized for highest quality
        this.settings = {
            width: 1200,
            height: 900,
            fps: 30,
            bitrate: 50000000, // 50 Mbps for maximum quality
            videoCodec: 'avc' // 'avc' for H.264, 'vp9' for VP9
        };
    }

    initialize(canvas) {
        this.canvas = canvas;
        this.settings.width = canvas.width;
        this.settings.height = canvas.height;
    }

    async startRecording() {
        if (!this.canvas) {
            throw new Error('Canvas not initialized');
        }

        if (!this.isMediabunnySupported()) {
            throw new Error('Mediabunny library not available');
        }

        if (!this.isWebCodecsSupported()) {
            throw new Error('WebCodecs API not supported in this browser');
        }

        try {
            // Create output with MP4 format
            this.output = new Mediabunny.Output({
                format: new Mediabunny.Mp4OutputFormat(),
                target: new Mediabunny.BufferTarget(),
            });

            // Test codec support and create video source
            const codecSupport = await this.findBestCodec();
            if (!codecSupport.supported) {
                throw new Error(`No supported codec found: ${codecSupport.reason}`);
            }

            // Create canvas source for video
            this.videoSource = new Mediabunny.CanvasSource(this.canvas, {
                codec: codecSupport.codec,
                bitrate: this.settings.bitrate,
            });

            // Add video track to output
            this.output.addVideoTrack(this.videoSource, { 
                frameRate: this.settings.fps 
            });

            // Start the output
            await this.output.start();

            this.frameCount = 0;
            this.startTime = performance.now();
            this.isRecording = true;

            console.log(`Mediabunny MP4 recording started with codec: ${codecSupport.codec}`);
            return true;
        } catch (error) {
            console.error('Failed to start Mediabunny recording:', error);
            throw error;
        }
    }

    recordFrame() {
        if (!this.isRecording || !this.videoSource) {
            return;
        }

        try {
            const timestampInSeconds = this.frameCount / this.settings.fps;
            const durationInSeconds = 1 / this.settings.fps;
            
            // Add frame to video source
            this.videoSource.add(timestampInSeconds, durationInSeconds);
            this.frameCount++;
        } catch (error) {
            console.error('Error recording frame with Mediabunny:', error);
        }
    }

    async stopRecording() {
        if (!this.isRecording) {
            return null;
        }

        this.isRecording = false;

        try {
            // Finalize the output
            await this.output.finalize();

            // Get the MP4 buffer
            const buffer = this.output.target.buffer;
            const blob = new Blob([buffer], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);

            const duration = (performance.now() - this.startTime) / 1000;

            console.log(`Mediabunny MP4 recording complete: ${this.frameCount} frames, ${duration.toFixed(2)}s`);

            return {
                blob,
                url,
                size: blob.size,
                duration,
                frameCount: this.frameCount
            };
        } catch (error) {
            console.error('Error stopping Mediabunny recording:', error);
            throw error;
        }
    }

    downloadVideo(videoData, filename = 'pixel-movement-video') {
        const a = document.createElement('a');
        a.href = videoData.url;
        a.download = `${filename}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up the object URL after download
        setTimeout(() => {
            URL.revokeObjectURL(videoData.url);
        }, 1000);
    }

    isMediabunnySupported() {
        return typeof Mediabunny !== 'undefined' && 
               typeof Mediabunny.Output !== 'undefined' &&
               typeof Mediabunny.Mp4OutputFormat !== 'undefined' &&
               typeof Mediabunny.CanvasSource !== 'undefined';
    }

    isWebCodecsSupported() {
        return typeof VideoEncoder !== 'undefined' && 
               typeof VideoFrame !== 'undefined' &&
               VideoEncoder.isConfigSupported;
    }

    async findBestCodec() {
        if (!this.isWebCodecsSupported()) {
            return { supported: false, reason: 'WebCodecs API not available' };
        }

        // Test codec options (Mediabunny uses simpler codec names)
        const codecsToTest = [
            { name: 'avc', webCodecs: 'avc1.42E01E' },   // H.264
            { name: 'vp9', webCodecs: 'vp09.00.10.08' }, // VP9
            { name: 'vp8', webCodecs: 'vp8' }            // VP8
        ];

        for (const codec of codecsToTest) {
            try {
                const config = {
                    codec: codec.webCodecs,
                    width: this.settings.width,
                    height: this.settings.height,
                    bitrate: this.settings.bitrate,
                    framerate: this.settings.fps
                };

                const support = await VideoEncoder.isConfigSupported(config);
                if (support.supported) {
                    return {
                        supported: true,
                        codec: codec.name,
                        webCodecs: codec.webCodecs,
                        config: support.config,
                        reason: `${codec.name} codec supported`
                    };
                }
            } catch (error) {
                console.warn(`Codec ${codec.name} test failed:`, error.message);
            }
        }

        return { 
            supported: false, 
            reason: `No supported codecs found. Tested: ${codecsToTest.map(c => c.name).join(', ')}` 
        };
    }

    async checkCodecSupport() {
        return await this.findBestCodec();
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }

    getRecordingStats() {
        return {
            isRecording: this.isRecording,
            frameCount: this.frameCount,
            duration: this.isRecording ? (performance.now() - this.startTime) / 1000 : 0,
            settings: { ...this.settings }
        };
    }

    cleanup() {
        if (this.output) {
            try {
                // Mediabunny cleanup is handled automatically
                this.output = null;
            } catch (e) {
                // Handle cleanup errors silently
            }
        }
        
        this.videoSource = null;
        this.isRecording = false;
        this.frameCount = 0;
    }
}

// Make available globally (no ES modules)
window.MediabunnyMP4Exporter = MediabunnyMP4Exporter;