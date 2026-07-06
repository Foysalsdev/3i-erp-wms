import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import fs from 'node:fs'

// Cloudflare Pages has no built-in SPA fallback, and its `_redirects` linter
// false-positives on the standard `/* /index.html 200` rule (flags it as an
// infinite loop because the destination also matches the wildcard, so the
// rule gets silently dropped). Cloudflare *does* auto-serve a custom
// `404.html` for any unmatched path, so copying the built index.html there
// gets client-side routes (e.g. /dashboard) working on direct load/refresh
// without any redirect rules or wrangler config to fight with.
function spaFallback404(): Plugin {
  return {
    name: 'spa-fallback-404',
    closeBundle() {
      const outDir = path.resolve(__dirname, 'dist')
      fs.copyFileSync(path.join(outDir, 'index.html'), path.join(outDir, '404.html'))
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    spaFallback404(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Whirlpool WH',
        short_name: 'Whirlpool',
        description: 'Whirlpool WH — ERP + WMS',
        theme_color: '#eeb111',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          pdf: ['@react-pdf/renderer'],
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  },
  server: { port: 5173 }
})
