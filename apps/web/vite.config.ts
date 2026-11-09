import { defineConfig } from 'vite';

// Docker on Windows/macOS doesn't forward file-change events into bind mounts, so compose sets
// VITE_USE_POLLING=true to make hot reload work inside the container.
const usePolling = process.env.VITE_USE_POLLING === 'true';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    watch: usePolling ? { usePolling: true, interval: 300 } : {},
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
