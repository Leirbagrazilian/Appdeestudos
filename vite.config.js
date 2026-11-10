import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './', // funciona em qualquer hospedagem (GitHub Pages, Netlify, Vercel)
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/inter.woff2', 'icon.svg'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2,png,json}'] },
      manifest: {
        name: 'Rumo à Aprovação', short_name: 'Rumo', lang: 'pt-BR',
        description: 'Checklist diário de estudos para Escola Naval, EFOMM, ENEM e ITA.',
        theme_color: '#0a0a0c', background_color: '#0a0a0c', display: 'standalone', start_url: './', scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  test: { include: ['tests/**/*.test.js'] },
});
