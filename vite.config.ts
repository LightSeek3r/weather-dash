import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Wall Dashboard',
        short_name: 'Wall',
        description: 'Fullscreen 24/7 weather and date wall display',
        display: 'fullscreen',
        theme_color: '#0a0a0f',
        background_color: '#0a0a0f',
        start_url: '/',
        scope: '/',
        // TODO: real icons, apple touch icons, screenshots for install prompt
        icons: [
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%230a0a0f" width="192" height="192"/></svg>',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ],
        screenshots: [
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 720"><rect fill="%230a0a0f" width="540" height="720"/></svg>',
            sizes: '540x720',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'open-meteo-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 3600
              }
            }
          }
        ]
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
    rollupOptions: {
      output: {
        manualChunks: {
          // date-holidays is deliberately excluded here — it's now reached
          // only via dynamic import() (see lib/date/holidaysLazy.ts), and
          // forcing it into this eager chunk via manualChunks would put it
          // straight back into the main bundle, undoing the split.
          vendor: ['svelte', 'valibot', 'idb-keyval']
        }
      }
    }
  }
})
