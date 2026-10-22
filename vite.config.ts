import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8001,
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-dom',
              test: /node_modules[\\/]react-dom[\\/]/,
            },
            {
              name: 'firebase-firestore',
              test: /node_modules[\\/]@firebase[\\/]firestore[\\/]/,
            },
            {
              name: 'firebase-auth',
              test: /node_modules[\\/]@firebase[\\/]auth[\\/]/,
            },
            {
              name: 'firebase-regex',
              test: /node_modules[\\/]re2js[\\/]/,
            },
          ],
        },
      },
    },
  },
})
