import { defineConfig } from 'vitest/config'

// Unit tests for the server-side demo endpoint (api/ + server/). They run in
// plain Node, so this config deliberately skips the React plugin.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
})
