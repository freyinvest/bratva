
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Use one root-scope service worker for both PWA caching and Firebase
      // Cloud Messaging. Registering a second worker at the same scope would
      // replace this one and break closed-tab push delivery.
      workbox: {
        // Version the imported FCM handler in the generated worker script itself.
        // This forces existing browsers to install a fresh root-scope service worker
        // when the standalone Firebase messaging handler changes.
        importScripts: ['/firebase-messaging-sw.js?v=bratva-push-2026-10-19-1'],
      },
      manifest: {
        name: 'Братва',
        short_name: 'Братва',
        description: 'Общайся с братвой!',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
