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
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['svelte', 'valibot', 'idb-keyval', 'date-holidays']
        }
      }
    }
  }
})
