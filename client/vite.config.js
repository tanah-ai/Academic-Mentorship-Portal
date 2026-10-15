import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow connections from any device on the network
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://192.168.1.250:5000', // Use network IP for backend access
        changeOrigin: true,
      },
    },
  },
})
