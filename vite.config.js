import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Shorter hash length for asset filenames
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const extType = info[info.length - 1]
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
            return `img/[name].[hash:6][extname]`
          }
          if (/woff2?|eot|ttf|otf/i.test(extType)) {
            return `fonts/[name].[hash:6][extname]`
          }
          return `assets/[name].[hash:6][extname]`
        },
        // Shorter hash for JS chunks
        chunkFileNames: 'js/[name].[hash:6].js',
        // Shorter hash for entry files
        entryFileNames: 'js/[name].[hash:6].js'
      }
    }
  },
  server: {
    port: 3000,
    host: true,
    hmr: {
      clientPort: 443
    }
  }
})
