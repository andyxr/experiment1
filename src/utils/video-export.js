class VideoExporter {
    constructor() {
        this.isRecording = false;
        this.recordedChunks = [];
        this.mediaRecorder = null;
        this.stream = null;
        this.canvas = null;
        
        // Export settings - optimized for highest quality
        this.settings = {
            width: 1200,
            height: 900,
            fps: 30,
            bitrate: 50000000, // 50 Mbps for maximum quality
            format: 'mp4', // or 'webm'
            codec: 'h264' // or 'vp9'
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

        try {
            // Create a stream from the canvas
            this.stream = this.canvas.captureStream(this.settings.fps);
            // Prefer detail over motion for better visual quality if supported
            const track = this.stream.getVideoTracks && this.stream.getVideoTracks()[0];
            if (track && 'contentHint' in track) {
                track.contentHint = 'detail';
            }
            
            // Configure recorder options
            const options = {
                mimeType: this.getMimeType(),
                videoBitsPerSecond: this.settings.bitrate
            };

            // Create MediaRecorder
            this.mediaRecorder = new MediaRecorder(this.stream, options);
            this.recordedChunks = [];

            // Set up event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this.finalizeRecording();
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
            };

            // Start recording
            this.mediaRecorder.start(250); // Collect data every 250ms to reduce overhead
            this.isRecording = true;

            return true;
        } catch (error) {
            console.error('Failed to start recording:', error);
            throw error;
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
        }
    }

    finalizeRecording() {
        if (this.recordedChunks.length === 0) {
            console.warn('No recorded chunks available');
            return null;
        }

        const blob = new Blob(this.recordedChunks, {
            type: this.getMimeType()
        });

        const url = URL.createObjectURL(blob);
        return {
            blob,
            url,
            size: blob.size,
            duration: this.recordedChunks.length * 0.1 // Approximate duration
        };
    }

    getMimeType() {
        // Try MP4 formats first - prioritize highest quality profiles
        const mp4Formats = [
            // Try highest quality H.264 profiles first
            'video/mp4;codecs="avc1.640032,mp4a.40.2"', // H.264 High L5.0 + AAC
            'video/mp4;codecs="avc1.64002A,mp4a.40.2"', // H.264 High L4.2 + AAC
            'video/mp4;codecs="avc1.640028,mp4a.40.2"', // H.264 High L4.0 + AAC
            'video/mp4;codecs="avc1.64001F,mp4a.40.2"', // H.264 High L3.1 + AAC
            'video/mp4;codecs="avc1.64001E,mp4a.40.2"', // H.264 High L3.0 + AAC
            'video/mp4;codecs="avc1.4D401F,mp4a.40.2"', // H.264 Main L3.1 + AAC
            'video/mp4;codecs="avc1.4D401E,mp4a.40.2"', // H.264 Main L3.0 + AAC
            'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', // H.264 Baseline + AAC
            'video/mp4'
        ];

        // If user wants MP4, try MP4 formats first
        if (this.settings.format === 'mp4') {
            for (const format of mp4Formats) {
                if (MediaRecorder.isTypeSupported(format)) {
                    return format;
                }
            }
        }

        // Try WebM formats
        const webmFormats = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm'
        ];

        for (const format of webmFormats) {
            if (MediaRecorder.isTypeSupported(format)) {
                // Update settings to reflect actual format being used
                if (this.settings.format === 'mp4' && format.includes('webm')) {
                    console.warn('MP4 not supported, falling back to WebM');
                    this.settings.format = 'webm';
                }
                return format;
            }
        }

        // Final fallback
        this.settings.format = 'webm';
        return 'video/webm';
    }

    downloadVideo(videoData, filename = 'pixel-movement-video') {
        const extension = this.settings.format === 'webm' ? 'webm' : 'mp4';
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

    // Alternative method: Export frames as images
    exportFramesAsZip(frames, filename = 'frames') {
        if (!frames.length) {
            throw new Error('No frames to export');
        }

        // This would require a zip library like JSZip
        // For now, we'll export individual frames
        frames.forEach((frameData, index) => {
            this.downloadFrame(frameData, `${filename}_frame_${String(index).padStart(4, '0')}`);
        });
    }

    downloadFrame(imageData, filename) {
        // Create a temporary canvas to convert ImageData to blob
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        
        tempCtx.putImageData(imageData, 0, 0);
        
        tempCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    // Create GIF from frames (requires additional library)
    async createGif(frames, options = {}) {
        const {
            delay = 100, // ms between frames
            quality = 10, // 1-30, lower is better quality
            width = this.settings.width,
            height = this.settings.height
        } = options;

        // This is a placeholder - would need a GIF encoding library
        console.warn('GIF creation requires additional library (e.g., gif.js)');
        
        // Basic structure for GIF creation:
        // 1. Initialize GIF encoder
        // 2. Add each frame with specified delay
        // 3. Finish and get blob
        
        return null;
    }

    // Utility to convert canvas to different formats
    exportCanvasAs(format = 'png', quality = 0.9) {
        if (!this.canvas) {
            throw new Error('Canvas not initialized');
        }

        return new Promise((resolve) => {
            this.canvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                resolve({ blob, url });
            }, `image/${format}`, quality);
        });
    }

    // Get supported formats
    getSupportedFormats() {
        const formats = [];
        
        // Check WebM support
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
            formats.push({ format: 'webm', codec: 'vp9', quality: 'high' });
        }
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
            formats.push({ format: 'webm', codec: 'vp8', quality: 'medium' });
        }
        
        // Check MP4 support
        if (MediaRecorder.isTypeSupported('video/mp4;codecs=h264')) {
            formats.push({ format: 'mp4', codec: 'h264', quality: 'high' });
        }
        
        return formats;
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }

    getRecordingStats() {
        return {
            isRecording: this.isRecording,
            chunksRecorded: this.recordedChunks.length,
            estimatedSize: this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0),
            settings: { ...this.settings }
        };
    }

    // Clean up resources
    cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.mediaRecorder) {
            this.mediaRecorder = null;
        }
        
        this.recordedChunks = [];
        this.isRecording = false;
    }
}