import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

const isGitHubPages = process.env.GITHUB_PAGES === 'true'

// https://vitejs.dev/config/
export default defineConfig({
  base: isGitHubPages ? '/MagicB/' : '/',
  plugins: [react()],
  define: {
    // GitHub Pages is static hosting with no /api/generate, so that build is
    // bring-your-own-key only and never probes for the free demo endpoint.
    __MAGICB_DEMO_API__: JSON.stringify(!isGitHubPages),
  },
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
