// Note: This requires mp4-muxer to be available globally
// In a production environment, you would bundle this with a tool like webpack or rollup

class WebCodecsMP4Exporter {
    constructor() {
        this.isRecording = false;
        this.videoEncoder = null;
        this.muxer = null;
        this.canvas = null;
        this.frameCount = 0;
        this.startTime = 0;
        
        // Export settings
        this.settings = {
            width: 800,
            height: 600,
            fps: 30,
            bitrate: 2500000, // 2.5 Mbps
            codec: 'avc1.42E01E' // H.264 baseline profile (mp4-muxer compatible)
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

        if (!this.isWebCodecsSupported()) {
            throw new Error('WebCodecs API not supported in this browser');
        }

        try {
            // Create muxer (requires mp4-muxer to be available)
            // Check for various possible global names
            const Mp4MuxerLib = window.Mp4Muxer || window.mp4Muxer || window.MP4Muxer;
            if (!Mp4MuxerLib) {
                throw new Error('mp4-muxer library not loaded or not available globally');
            }
            
            // Determine mp4-muxer codec based on WebCodecs working codec
            let muxerCodec;
            const workingWebCodecsCodec = this.webCodecsWorkingCodec || 'avc1.42E01E';
            
            // Note: mp4-muxer may have limited codec support in browser
            // Let's try VP9 first as it's more reliable for WebCodecs
            if (workingWebCodecsCodec.startsWith('vp09')) {
                muxerCodec = 'vp9'; // VP9 - most reliable
            } else if (workingWebCodecsCodec === 'vp8') {
                muxerCodec = 'vp8'; // VP8 - good fallback
            } else if (workingWebCodecsCodec.startsWith('avc1')) {
                // H.264 might not work reliably with mp4-muxer in browser
                muxerCodec = 'avc'; 
            } else {
                muxerCodec = 'vp9'; // Default to VP9 for better compatibility
            }

            try {
                this.muxer = new Mp4MuxerLib.Muxer({
                    target: new Mp4MuxerLib.ArrayBufferTarget(),
                    video: {
                        codec: muxerCodec,
                        width: this.settings.width,
                        height: this.settings.height,
                        frameRate: this.settings.fps,
                        bitrate: this.settings.bitrate
                    },
                    fastStart: false
                });
                this.settings.codec = muxerCodec; // Update settings with working codec
            } catch (e) {
                throw new Error(`mp4-muxer failed with codec ${muxerCodec}: ${e.message}`);
            }

            // Create video encoder
            this.videoEncoder = new VideoEncoder({
                output: (chunk, metadata) => {
                    this.muxer.addVideoChunk(chunk, metadata);
                },
                error: (error) => {
                    console.error('VideoEncoder error:', error);
                }
            });

            // Use the codec that was found to be working during checkCodecSupport
            const encoderCodec = this.webCodecsWorkingCodec || 'avc1.42E01E';
            
            this.videoEncoder.configure({
                codec: encoderCodec,
                width: this.settings.width,
                height: this.settings.height,
                bitrate: this.settings.bitrate,
                bitrateMode: 'constant',
                framerate: this.settings.fps
            });

            this.frameCount = 0;
            this.startTime = performance.now();
            this.isRecording = true;

            console.log('WebCodecs MP4 recording started');
            return true;
        } catch (error) {
            console.error('Failed to start WebCodecs recording:', error);
            throw error;
        }
    }

    recordFrame() {
        if (!this.isRecording || !this.videoEncoder || !this.canvas) {
            return;
        }

        try {
            // Create VideoFrame from canvas
            const videoFrame = new VideoFrame(this.canvas, {
                timestamp: (this.frameCount * 1000000) / this.settings.fps // microseconds
            });

            // Encode the frame
            this.videoEncoder.encode(videoFrame, { keyFrame: this.frameCount % 30 === 0 });
            
            // Clean up the frame
            videoFrame.close();
            
            this.frameCount++;
        } catch (error) {
            console.error('Error recording frame:', error);
        }
    }

    async stopRecording() {
        if (!this.isRecording) {
            return null;
        }

        this.isRecording = false;

        try {
            // Flush encoder
            await this.videoEncoder.flush();
            this.videoEncoder.close();

            // Finalize muxer
            this.muxer.finalize();

            // Get the video data
            const buffer = this.muxer.target.buffer;
            const mimeType = this.settings.codec === 'vp8' || this.settings.codec === 'vp9' ? 'video/webm' : 'video/mp4';
            const blob = new Blob([buffer], { type: mimeType });
            const url = URL.createObjectURL(blob);

            const duration = (performance.now() - this.startTime) / 1000;

            console.log(`WebCodecs MP4 recording complete: ${this.frameCount} frames, ${duration.toFixed(2)}s`);

            return {
                blob,
                url,
                size: blob.size,
                duration,
                frameCount: this.frameCount
            };
        } catch (error) {
            console.error('Error stopping WebCodecs recording:', error);
            throw error;
        }
    }

    downloadVideo(videoData, filename = 'pixel-movement-video') {
        // Determine file extension based on codec used
        let extension = 'mp4';
        if (this.settings.codec === 'vp8' || this.settings.codec === 'vp9') {
            extension = 'webm'; // VP8/VP9 in WebM container
        }
        
        const a = document.createElement('a');
        a.href = videoData.url;
        a.download = `${filename}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up the object URL after download
        setTimeout(() => {
            URL.revokeObjectURL(videoData.url);
        }, 1000);
    }

    isWebCodecsSupported() {
        return typeof VideoEncoder !== 'undefined' && 
               typeof VideoFrame !== 'undefined' &&
               VideoEncoder.isConfigSupported;
    }

    async checkCodecSupport() {
        if (!this.isWebCodecsSupported()) {
            return { supported: false, reason: 'WebCodecs API not available' };
        }

        // Test multiple codec options for WebCodecs
        // Prioritize VP9/VP8 since mp4-muxer works better with those
        const codecsToTest = [
            'vp09.00.10.08', // VP9 - best for mp4-muxer compatibility
            'vp8',           // VP8 - good fallback
            'avc1.42E01E',   // H.264 Baseline
            'avc1.42001E',   // H.264 Baseline alternate
            'avc1.420028'    // H.264 Baseline alternate
        ];

        for (const codec of codecsToTest) {
            try {
                const config = {
                    codec: codec,
                    width: this.settings.width,
                    height: this.settings.height,
                    bitrate: this.settings.bitrate,
                    framerate: this.settings.fps
                };

                const support = await VideoEncoder.isConfigSupported(config);
                if (support.supported) {
                    // Store the working codec for later use
                    this.webCodecsWorkingCodec = codec;
                    return {
                        supported: true,
                        config: support.config,
                        codec: codec,
                        reason: `${codec} codec supported`
                    };
                }
            } catch (error) {
                console.warn(`Codec ${codec} test failed:`, error.message);
            }
        }

        return { 
            supported: false, 
            reason: `No supported codecs found. Tested: ${codecsToTest.join(', ')}` 
        };
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
        if (this.videoEncoder) {
            try {
                this.videoEncoder.close();
            } catch (e) {
                // Encoder might already be closed
            }
            this.videoEncoder = null;
        }
        
        this.muxer = null;
        this.isRecording = false;
        this.frameCount = 0;
    }
}

// Make available globally (no ES modules)
window.WebCodecsMP4Exporter = WebCodecsMP4Exporter;