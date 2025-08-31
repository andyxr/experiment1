class SimpleMP4Exporter {
    constructor() {
        this.isRecording = false;
        this.videoEncoder = null;
        this.muxer = null;
        this.canvas = null;
        this.frameCount = 0;
        this.startTime = 0;
        
        // Export settings - optimized for highest quality
        this.settings = {
            width: 1200,
            height: 900,
            fps: 30,
            bitrate: 50000000 // 50 Mbps for maximum quality
        };
        
        this.workingCodec = null;
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

        if (typeof Mp4Muxer === 'undefined') {
            throw new Error('mp4-muxer library not loaded');
        }

        try {
            // Find a working codec first
            const codecResult = await this.findWorkingCodec();
            if (!codecResult.success) {
                throw new Error(`No supported codec found: ${codecResult.error}`);
            }

            this.workingCodec = codecResult.codec;

            // Only H.264/MP4 is supported now
            const muxerCodec = 'avc';
            const containerType = 'mp4';
            const mimeType = 'video/mp4';
            
            // Store format info for later use
            this.outputFormat = { containerType, mimeType, muxerCodec };
            
            const muxerConfig = {
                target: new Mp4Muxer.ArrayBufferTarget(),
                video: {
                    codec: muxerCodec,
                    width: this.settings.width,
                    height: this.settings.height,
                    frameRate: this.settings.fps,
                    bitrate: this.settings.bitrate
                },
                fastStart: false
            };
            
            console.log('Creating muxer with config:', muxerConfig);
            this.muxer = new Mp4Muxer.Muxer(muxerConfig);

            // Create video encoder
            let chunksReceived = 0;
            this.videoEncoder = new VideoEncoder({
                output: (chunk, metadata) => {
                    chunksReceived++;
                    console.log(`Received encoded chunk ${chunksReceived}: type=${chunk.type}, size=${chunk.byteLength}, timestamp=${chunk.timestamp}`);
                    try {
                        this.muxer.addVideoChunk(chunk, metadata);
                    } catch (error) {
                        console.error('Error adding chunk to muxer:', error);
                    }
                },
                error: (error) => {
                    console.error('VideoEncoder error:', error);
                }
            });

            // Configure encoder with working codec
            const encoderConfig = {
                codec: this.workingCodec.webCodecs,
                width: this.settings.width,
                height: this.settings.height,
                bitrate: this.settings.bitrate,
                framerate: this.settings.fps,
                bitrateMode: 'constant',
                latencyMode: 'quality',
                hardwareAcceleration: 'prefer-hardware',
                scalabilityMode: 'L1T1',
                avc: { format: 'avc' }
            };
            
            console.log('Configuring VideoEncoder with:', encoderConfig);
            this.videoEncoder.configure(encoderConfig);

            this.frameCount = 0;
            this.startTime = performance.now();
            this.isRecording = true;

            console.log(`Simple MP4 recording started with codec: ${this.workingCodec.webCodecs}`);
            return true;
        } catch (error) {
            console.error('Failed to start simple MP4 recording:', error);
            throw error;
        }
    }

    async findWorkingCodec() {
        // Test H.264 codecs prioritizing highest quality profiles
        const codecsToTest = [
            { name: 'H.264 High L5.0', webCodecs: 'avc1.640032' },
            { name: 'H.264 High L4.2', webCodecs: 'avc1.64002A' },
            { name: 'H.264 High L4.0', webCodecs: 'avc1.640028' },
            { name: 'H.264 High L3.1', webCodecs: 'avc1.64001F' },
            { name: 'H.264 High L3.0', webCodecs: 'avc1.64001E' },
            { name: 'H.264 Main L3.1', webCodecs: 'avc1.4D401F' },
            { name: 'H.264 Main L3.0', webCodecs: 'avc1.4D401E' },
            { name: 'H.264 Baseline', webCodecs: 'avc1.42E01E' }
        ];
        
        console.log('Testing H.264 codecs for MP4 compatibility:');
        codecsToTest.forEach(codec => console.log(`- ${codec.name}: ${codec.webCodecs}`));

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
                console.log(`Testing ${codec.name} (${codec.webCodecs}): ${support.supported ? 'SUPPORTED' : 'NOT SUPPORTED'}`);
                if (support.supported) {
                    console.log(`✓ Selected codec: ${codec.name} (${codec.webCodecs})`);
                    return { success: true, codec: codec };
                }
            } catch (error) {
                console.warn(`Codec ${codec.name} test failed:`, error.message);
            }
        }

        console.log('❌ No H.264 codecs supported by this browser - MP4 export not possible');
        return { success: false, error: 'No H.264 codecs supported - MP4 export requires H.264 encoding' };
    }

    recordFrame() {
        if (!this.isRecording || !this.videoEncoder || !this.canvas) {
            return;
        }

        try {
            // Create VideoFrame from canvas
            const timestamp = (this.frameCount * 1000000) / this.settings.fps; // microseconds
            const videoFrame = new VideoFrame(this.canvas, {
                timestamp: timestamp
            });

            // Encode the frame - keyframe every 1 second for better quality and seeking
            const keyFrame = this.frameCount === 0 || this.frameCount % this.settings.fps === 0;
            this.videoEncoder.encode(videoFrame, { keyFrame });
            
            // Clean up the frame
            videoFrame.close();
            
            this.frameCount++;
            
            // Log progress every 30 frames
            if (this.frameCount % 30 === 0) {
                console.log(`Recorded ${this.frameCount} frames, last timestamp: ${timestamp}μs`);
            }
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
            console.log(`Stopping recording: ${this.frameCount} frames recorded`);
            
            // Flush encoder and wait for all chunks
            console.log('Flushing video encoder...');
            await this.videoEncoder.flush();
            
            console.log('Closing video encoder...');
            this.videoEncoder.close();

            // Finalize muxer
            console.log('Finalizing muxer...');
            this.muxer.finalize();

            // Get the MP4 data
            const buffer = this.muxer.target.buffer;
            console.log(`Muxer produced buffer of size: ${buffer.byteLength} bytes`);
            
            if (buffer.byteLength === 0) {
                throw new Error('Muxer produced empty buffer');
            }
            
            const blob = new Blob([buffer], { type: this.outputFormat.mimeType });
            const url = URL.createObjectURL(blob);

            const duration = (performance.now() - this.startTime) / 1000;

            console.log(`Simple MP4 recording complete: ${this.frameCount} frames, ${duration.toFixed(2)}s, ${blob.size} bytes`);

            return {
                blob,
                url,
                size: blob.size,
                duration,
                frameCount: this.frameCount
            };
        } catch (error) {
            console.error('Error stopping simple MP4 recording:', error);
            throw error;
        }
    }

    downloadVideo(videoData, filename = 'pixel-movement-video') {
        const extension = this.outputFormat ? this.outputFormat.containerType : 'mp4';
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
        const result = await this.findWorkingCodec();
        if (result.success) {
            return {
                supported: true,
                codec: result.codec.name,
                webCodecs: result.codec.webCodecs,
                reason: `${result.codec.name} codec supported`
            };
        } else {
            return {
                supported: false,
                reason: result.error
            };
        }
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }

    getRecordingStats() {
        return {
            isRecording: this.isRecording,
            frameCount: this.frameCount,
            duration: this.isRecording ? (performance.now() - this.startTime) / 1000 : 0,
            codec: this.workingCodec?.name || 'none',
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
        this.workingCodec = null;
    }
}

// Make available globally
window.SimpleMP4Exporter = SimpleMP4Exporter;