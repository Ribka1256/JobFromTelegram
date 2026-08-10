import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    port: 5173,
    proxy: {
      // Forward API and health calls to the Express backend
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/health': { target: 'http://localhost:5000', changeOrigin: true },
    },
  },
})

