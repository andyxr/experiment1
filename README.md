# Dream Frame - Image to Video

An experimental creative coding project that transforms still images into dynamic videos by analyzing color and brightness regions and applying algorithmic movement patterns.

## 🌟 Features

### Core Capabilities
- **Advanced Image Analysis**: Region-growing segmentation to identify distinct color and brightness areas
- **Multiple Movement Algorithms**: Perlin noise flow fields, brightness-based physics, color harmony coordination
- **Real-time Controls**: Interactive parameter adjustment for movement speed, noise scale, and sensitivity
- **Video Export**: Record and download animations as WebM/MP4 videos
- **Particle Systems**: Convert image regions into dynamic particle systems with physics-based movement

### Movement Types
- **Perlin Flow**: Organic, natural movement using Perlin noise
- **Turbulent**: Chaotic, energetic movement patterns
- **Directional**: Coordinated movement in specific directions
- **Vortex**: Swirling, rotational movement around centers
- **Wave**: Oscillating wave-like motion
- **Brightness Physics**: Bright regions float, dark regions sink

## 🚀 Getting Started

1. **Open the Application**
   ```bash
   # Serve locally (recommended)
   python -m http.server 8000
   # Or use any static file server
   ```
   
2. **Load an Image**
   - Click "Load Image" and select a photo
   - The system will automatically analyze color/brightness regions
   
3. **Configure Movement**
   - Adjust movement speed, noise scale, and sensitivity
   - Experiment with different settings in real-time
   
4. **Start Animation**
   - Click "Start Animation" to see pixels come alive
   - Watch as different regions move according to their properties
   
5. **Export Video**
   - Click "Export Video" while animation is running
   - Stop animation to finalize and download

## 🎛️ Controls

### Primary Parameters
- **Movement Speed**: Overall animation velocity (0.1 - 2.0)
- **Noise Scale**: Granularity of Perlin noise (0.001 - 0.1)
- **Brightness Sensitivity**: How much brightness affects movement (0.1 - 3.0)
- **Region Threshold**: Color similarity for region detection (5 - 100)

### Advanced Features
Access through browser console (`window.pixelMovementDemo`):
- `demo.visualizeRegions()` - Show detected regions
- `demo.visualizeFlowField()` - Display movement vectors
- `demo.applyPreset('gentle|dynamic|swirl|wave|drift')` - Apply movement presets
- `demo.createCompositeEffect()` - Combine multiple movement types

## 🏗️ Architecture

### Core Modules
```
src/
├── core/
│   ├── image-analyzer.js     # Region detection & segmentation
│   ├── pixel-manipulator.js  # Particle system & rendering
│   └── movement-engine.js    # Main orchestration
├── algorithms/
│   └── perlin-flow.js       # Noise-based movement generation
├── utils/
│   ├── color-space.js       # Color analysis utilities
│   └── video-export.js      # Recording & export
└── examples/
    └── demo.js              # Interactive interface
```

### Key Classes
- **ImageAnalyzer**: Segments images using region-growing algorithm
- **PixelManipulator**: Manages particle systems and rendering
- **PerlinFlow**: Generates organic movement fields
- **MovementEngine**: Coordinates all systems
- **VideoExporter**: Handles recording and export

## 🎨 Algorithm Details

### Region Detection
Uses a modified watershed/region-growing approach:
1. Analyzes color similarity using Euclidean distance
2. Groups pixels into coherent regions
3. Calculates region properties (center, brightness, size)
4. Assigns movement characteristics based on properties

### Movement Generation
- **Perlin Noise Fields**: Create smooth, organic movement vectors
- **Physics Simulation**: Apply forces based on brightness and color
- **Particle Systems**: Convert regions into dynamic particles with trails
- **Flow Field Sampling**: Bilinear interpolation for smooth movement

### Brightness-Based Physics
- Bright regions: Tend to rise slowly (like hot air)
- Dark regions: Move faster downward (like heavy objects)
- Color harmony: Similar colors coordinate movement patterns

## 🔧 Customization

### Creating New Movement Types
```javascript
// Add to PerlinFlow class
createCustomFlow(width, height, customParams) {
    const field = new Array(width * height);
    // Your custom algorithm here
    return field;
}
```

### Movement Presets
Define new presets in `MovementEngine.createPresets()`:
```javascript
myPreset: {
    movementSpeed: 0.8,
    noiseScale: 0.015,
    brightnessSensitivity: 1.2,
    flowFieldType: 'turbulent'
}
```

## 📊 Performance

### Optimization Features
- **Adaptive Resolution**: Flow fields computed at lower resolution
- **Particle Limiting**: Maximum particles per region
- **GPU-friendly**: Uses Canvas 2D API for hardware acceleration
- **Frame Capping**: Prevents excessive CPU usage

### Browser Support
- Modern browsers with Canvas API support
- WebRTC for video recording (Chrome, Firefox, Safari 14.1+)
- Tested on Chrome 90+, Firefox 88+, Safari 14+

## 🎯 Use Cases

### Artistic Applications
- Transform portraits into living paintings
- Create dynamic textures from static images
- Generate abstract animations from photographs

### Creative Coding
- Experiment with novel pixel manipulation techniques
- Study emergent behavior in particle systems
- Explore the intersection of image analysis and motion

### Educational
- Demonstrate computer vision concepts
- Visualize Perlin noise and flow fields
- Teach pixel-level image manipulation

## 🚀 Future Enhancements

### Planned Features
- GPU compute shaders for better performance
- More sophisticated region detection (deep learning)
- Audio-reactive movement
- Multi-layer image analysis
- Real-time style transfer integration

### Advanced Algorithms
- Fluid simulation integration
- Cellular automata-based movement
- Genetic algorithm parameter optimization
- Machine learning movement pattern recognition

## 📝 Technical Notes

### Browser Compatibility
The application uses modern web APIs:
- Canvas 2D API for rendering
- MediaRecorder API for video export
- File API for image loading
- RequestAnimationFrame for smooth animation

### Performance Considerations
- Large images are automatically scaled down
- Flow field resolution is adaptive
- Particle count is limited based on region size
- Frame rate is capped at 60 FPS

## 🤝 Contributing

This is an experimental project exploring novel approaches to pixel movement. Contributions welcome!

### Areas for Development
- New movement algorithms
- Performance optimizations  
- UI/UX improvements
- Mobile device support
- Additional export formats

---

*An experiment in bringing still images to life through algorithmic movement and creative coding.*