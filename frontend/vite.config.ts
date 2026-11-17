import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      // PWA: installable on Android (Chrome) and iOS (Safari "Add to Home
      // Screen"), with an offline shell served by a Workbox service worker.
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'TAMS - TA Management System',
          short_name: 'TAMS',
          description: 'دستیار مدیریت دستیاران آموزشی',
          lang: 'fa',
          dir: 'rtl',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#111827',
          theme_color: '#1f2937',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          // SPA navigation: fall back to index.html for client-side routes.
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              // NEVER cache API responses — auth data must always be fresh.
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
            },
            {
              // Google/self-hosted font + icon assets: cache-first.
              urlPattern: ({ request }) =>
                request.destination === 'font' || request.destination === 'image',
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'tams-assets',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
        devOptions: {
          // Lets you test the service worker with `npm run dev` too.
          enabled: true,
        },
      }),
    ],
    server: {
      port: 18765,
      watch: {
        ignored: ['**/.vs/**'], // ?????? ????? ???? Visual Studio
      },
      // Dev-time proxy: the SPA calls same-origin `/api/v1/...` and Vite
      // forwards it to Django, so there are no CORS preflights in the browser
      // and mobile devices on the LAN can hit the app via `--host` too.
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
  };
});
