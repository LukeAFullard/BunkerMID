import { defineConfig } from 'vite';

export default defineConfig({
  base: '/BunkerMID/',
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    include: ['pdfjs-dist']
  },
  build: {
    target: 'esnext'
  }
});
