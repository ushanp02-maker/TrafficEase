import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [tailwindcss()],
  server: { proxy: { '/api': { target: process.env.BACKEND_PROXY_TARGET || 'http://127.0.0.1:8080' } } },
});
