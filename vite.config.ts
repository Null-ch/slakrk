import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.js',
    injectRegister: 'script',
    injectManifest: { globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'] },
    manifest: {
      id: '/', name: 'Моё похудение', short_name: 'Моё похудение', lang: 'ru',
      description: 'Личный дневник питания, веса и активности',
      start_url: '/', scope: '/', display: 'standalone',
      theme_color: '#174c36', background_color: '#f4f6f2',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
  })],
})
