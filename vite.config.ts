import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as {
  version: string
}

export default defineConfig({
  // Shown in the settings sheet's About block.
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Weather Dash',
        short_name: 'Weather Dash',
        description:
          'Fullscreen, always-on weather and date wall display for phones, tablets, PCs and TVs',
        id: '/',
        display: 'fullscreen',
        // Falls back to standalone where fullscreen display isn't supported,
        // instead of dropping to a plain browser tab.
        display_override: ['fullscreen', 'standalone'],
        orientation: 'any',
        theme_color: '#0a1726',
        background_color: '#0a1726',
        start_url: '/',
        scope: '/',
        categories: ['weather', 'utilities'],
        icons: [
          { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: '/screenshot-wide.png',
            sizes: '1920x1080',
            type: 'image/png',
            form_factor: 'wide'
          },
          {
            src: '/screenshot-narrow.png',
            sizes: '780x1688',
            type: 'image/png',
            form_factor: 'narrow'
          }
        ]
      },
      workbox: {
        // No runtime caching of Open-Meteo: lib/weather/cache.ts already keeps
        // the last snapshot for offline boot. A SW cache in front of the API
        // served the first response forever (the CORS response hides its Date
        // header, so workbox's maxAge check can't expire it) while the store
        // stamped each replay as freshly fetched.
        globPatterns: ['**/*.{js,css,html,svg,woff2}']
      }
    })
  ],
  build: {
    target: 'esnext',
    minify: 'terser',
    // `date-holidays`'s bundled all-countries dataset is a single ~1.4MB
    // chunk (see lib/date/holidaysLazy.ts) — it's reached only via dynamic
    // import(), so it never blocks initial paint, but Rollup's default
    // 500KB warning doesn't distinguish eager from lazy chunks and would
    // still flag it. Raised just enough to silence that one known,
    // deliberately-lazy chunk without hiding a real regression elsewhere
    // (the next-largest chunk here is ~108KB).
    chunkSizeWarningLimit: 1500,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              // date-holidays is deliberately excluded here — it's now reached
              // only via dynamic import() (see lib/date/holidaysLazy.ts), and
              // forcing it into this eager chunk would put it straight back
              // into the main bundle, undoing the split.
              name: 'vendor',
              test: /node_modules\/(svelte|valibot|idb-keyval)\//
            }
          ]
        }
      }
    }
  }
})
