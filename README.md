# PortraitStudio 📸

Privacy-first background removal and replacement powered by AI.

## Features

- 🔒 **100% Privacy**: All processing happens locally in your browser
- 🎨 **AI-Powered**: Uses @imgly/background-removal for accurate cutouts
- ⚡ **Fast**: Direct CDN loading for WASM/ONNX models
- 🎭 **Fun UX**: Entertaining processing messages and smooth animations
- 📦 **500x500 Output**: Perfect square format ready to use

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **@imgly/background-removal** - AI background removal

## How It Works

1. Upload a portrait image
2. AI removes the background locally
3. Composites with predefined background
4. Outputs a 500x500px PNG
5. Download and enjoy!

## Privacy

No images are ever sent to any server. All AI inference happens directly in your browser using WebAssembly and ONNX Runtime.
