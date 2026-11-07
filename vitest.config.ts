import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  // Svelte resolves to its server build under Node otherwise, where mount()
  // and onMount() are unavailable (needed by component tests).
  resolve: { conditions: ['browser'] },
  test: {
    environment: 'jsdom',
    globals: true,
    exclude: ['node_modules/**', 'tests/e2e/**', 'tests/visual/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      exclude: ['node_modules/', 'tests/']
    }
  }
})
