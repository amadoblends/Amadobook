import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    // Makes VITE_APP_MODE available everywhere
    __APP_MODE__: JSON.stringify(process.env.VITE_APP_MODE || 'client'),
  },
})