import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Pure-logic tests run in Node (fast). Component tests opt in to the DOM
    // with a `// @vitest-environment jsdom` comment at the top of the file.
    environment: 'node',
    setupFiles: ['./src/test/setup.js'],
  },
})
