import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';

// Abrir o app direto numa tela separada (ex.: #/trilha): o HTML já pede o arquivo dela junto com o principal, sem esperar o app iniciar.
const precarregarRota = () => ({
  name: 'precarregar-rota',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      if (!ctx.bundle) return html;
      const mapa = {};
      for (const c of Object.values(ctx.bundle)) {
        const m = c.type === 'chunk' && c.isDynamicEntry && c.facadeModuleId?.match(/screens\/(\w+)\.svelte$/);
        if (m) mapa[m[1].toLowerCase()] = [c.fileName, ...(c.viteMetadata?.importedCss ?? [])];
      }
      const js = `(function(){var m=${JSON.stringify(mapa)},r=location.hash.replace('#/','').split('?')[0];if(r==='lacunas')r='trilha';(m[r]||[]).forEach(function(h){var l=document.createElement('link');if(/\\.css$/.test(h)){l.rel='preload';l.as='style'}else l.rel='modulepreload';l.crossOrigin='';l.href=h;document.head.appendChild(l)})})()`;
      return html.replace('</title>', `</title>\n  <script>${js}</script>`);
    },
  },
});

export default defineConfig({
  base: './', // funciona em qualquer hospedagem (GitHub Pages, Netlify, Vercel)
  plugins: [
    svelte(),
    precarregarRota(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest', srcDir: 'src', filename: 'sw.js', // service worker próprio: precache + aviso com o app fechado
      includeAssets: ['fonts/inter.woff2', 'icon.svg'],
      injectManifest: { globPatterns: ['**/*.{js,css,html,svg,woff2,png,json}'] },
      manifest: {
        name: 'Estuda Gabriel', short_name: 'Estuda Gabriel', lang: 'pt-BR',
        description: 'Checklist diário de estudos para Escola Naval, EFOMM, ENEM e ITA.',
        theme_color: '#0d110c', background_color: '#0d110c', display: 'standalone', start_url: './', scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  test: { include: ['tests/**/*.test.js'] },
});
