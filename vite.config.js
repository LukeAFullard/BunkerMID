import { defineConfig } from 'vite';

export default defineConfig({
  base: '/BunkerMID/',
  worker: {
    format: 'es'
  },
  resolve: {
    alias: {
      'mammoth': 'mammoth/mammoth.browser.js'
    }
  }
});
