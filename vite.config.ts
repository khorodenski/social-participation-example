/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // netlify.toml proxies to this exact port. Without strictPort, Vite quietly
    // takes the next free one when 5173 is busy, and `netlify dev` then serves
    // 500s from a dead proxy target - which looks like a broken app, not a
    // busy port.
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
