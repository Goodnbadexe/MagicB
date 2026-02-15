import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/legacy/**', '**/legacy']
    }
  },
  optimizeDeps: {
    // Only scan the active index.html and src folder
    entries: ['index.html', 'src/**/*.{js,jsx}']
  },
  build: {
    rollupOptions: {
      // Ensure we don't try to bundle the legacy file
      input: {
        main: 'index.html'
      }
    }
  }
})
