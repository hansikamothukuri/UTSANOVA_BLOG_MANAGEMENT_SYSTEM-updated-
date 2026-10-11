import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

// Vite only reads VITE_* variables from its envDir (defaults to the project root, where
// `npm run dev` runs it). The Firebase web config lives in client/.env, so point envDir there
// when that folder has an env file; otherwise keep the default (project root).
const clientDir = path.resolve(__dirname, 'client');
const hasClientEnv =
  fs.existsSync(clientDir) &&
  fs.readdirSync(clientDir).some((f) => f.startsWith('.env') && !f.endsWith('.example'));

export default defineConfig(() => {
  return {
    envDir: hasClientEnv ? clientDir : __dirname,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
