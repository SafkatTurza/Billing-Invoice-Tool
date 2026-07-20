import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base is relative so the built app can be opened from any path (standalone spirit)
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true,
    port: 5173,
  },
})
