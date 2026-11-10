/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

// Docker on Windows/macOS doesn't forward file-change events into bind mounts, so compose sets
// VITE_USE_POLLING=true to make hot reload work inside the container.
const usePolling = process.env.VITE_USE_POLLING === 'true';
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000';

/**
 * Content-Security-Policy of the built app (DSA-503), as a meta tag so it travels with the files
 * wherever they are hosted. Scripts only from our origin and Cloudflare Turnstile; images may
 * come from https (survey stimuli); inline styles are needed by the chart library and Radix.
 * frame-ancestors cannot be set in a meta tag: the host sends it as a header (DSA-801).
 * Only in builds: the dev server injects inline scripts for hot reload.
 */
export const WEB_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  'frame-src https://challenges.cloudflare.com',
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const contentSecurityPolicy = (): Plugin => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: WEB_CONTENT_SECURITY_POLICY },
      injectTo: 'head-prepend',
    },
  ],
});

export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    watch: usePolling ? { usePolling: true, interval: 300 } : {},
    // One address in development, as in production: the API serves /api/…, the survey entry
    // links (/s/…) and the mock Dynata end page. Regex keys: '/s' alone would also match '/survey'.
    proxy: {
      '/api': { target: apiTarget },
      '^/s/': { target: apiTarget },
      '^/mock-dynata/': { target: apiTarget },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
