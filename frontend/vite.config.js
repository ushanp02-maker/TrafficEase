import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
const cert = process.env.DEV_HTTPS_CERT, key = process.env.DEV_HTTPS_KEY;
if (Boolean(cert) !== Boolean(key)) throw new Error('Set both DEV_HTTPS_CERT and DEV_HTTPS_KEY for trusted local HTTPS.');
export default defineConfig({
  plugins: [tailwindcss()],
  server: { https: cert ? { cert: readFileSync(cert), key: readFileSync(key) } : undefined, proxy: { '/api': { target: process.env.BACKEND_PROXY_TARGET || 'http://127.0.0.1:8080' } } },
});
