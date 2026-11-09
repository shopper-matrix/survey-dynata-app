/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Docker on Windows/macOS doesn't forward file-change events into bind mounts, so compose sets
// VITE_USE_POLLING=true to make hot reload work inside the container.
const usePolling = process.env.VITE_USE_POLLING === 'true';
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    watch: usePolling ? { usePolling: true, interval: 300 } : {},
    // One address in development, as in production: the API also serves the survey entry links
    // (/s/…) and the mock Dynata end page. Regex keys: '/s' alone would also match '/survey'.
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '^/s/': { target: apiTarget },
      '^/mock-dynata/': { target: apiTarget },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
