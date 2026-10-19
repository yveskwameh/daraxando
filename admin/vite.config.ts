// Builds the dashboard's screens into dist/, which the admin Worker serves (wrangler.jsonc).
// On your machine, `npm run dev` serves the screens and passes /api and /auth to the Worker
// running with `npm run dev:worker`.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 5180,
    // The dashboard reads a few names from the game's shared/ folder (modes, titles, states).
    fs: { allow: ['.', '../shared'] },
    proxy: { '/api': 'http://localhost:8787', '/auth': 'http://localhost:8787' },
  },
});
