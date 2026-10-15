import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Inlines src/art/sprite.svg (every icon, piece and avatar) into index.html, so the
 * drawings are there on first paint without an extra request.
 */
const sprite = (): Plugin => ({
  name: 'dara-sprite',
  transformIndexHtml: (html) => html.replace('<!--sprite-->', readFileSync(new URL('./src/art/sprite.svg', import.meta.url), 'utf8')),
});

/** ngrok's public addresses (free and paid plans), for sharing the local game with testers. */
const NGROK_HOSTS = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app', '.ngrok.dev', '.ngrok.io'];

// One dev server for everything: the React app with hot reload, and the Worker, Durable
// Objects and D1 running in the real Cloudflare runtime (workerd) on the same port.
//
// `host: true` also opens it on your Wi-Fi address, so a phone on the same network can play.
// Vite prints that address as "Network:" when it starts.
export default defineConfig({
  plugins: [
    react(),
    sprite(),
    cloudflare(),
    // Installable app: a manifest plus a service worker that caches the app, so it opens
    // instantly and survives a weak connection. Updates wait for a Reload tap on Home.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png'],
      manifest: {
        id: '/',
        name: 'Dara X&O',
        short_name: 'Dara X&O',
        description: 'Three in a row, the Naija way. Quick matches across Nigeria, friend rooms and Baba Ayo.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0a2a',
        theme_color: '#0b0a2a',
        categories: ['games'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Only the Latin font files: other alphabets load on demand if a name needs them.
        globPatterns: ['**/*.{js,css,html,png,webmanifest}', '**/*-latin-wght-*.woff2'],
        // The sign-in email's pictures are fetched by mail apps, never by the game.
        globIgnores: ['email/**'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  // ngrok: Yves shares an ngrok link so people can play while he tests. Vite blocks hosts it
  // doesn't know, so ngrok's addresses are allowed here. Keep this until the game is live;
  // remove it only after launch, when Yves says so.
  server: { host: true, port: 5173, allowedHosts: NGROK_HOSTS },
  preview: { host: true, port: 4173, allowedHosts: NGROK_HOSTS },
});
