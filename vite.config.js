import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  worker: {
    format: 'es'
  },
  resolve: {
    alias: {
      'mammoth': 'mammoth/mammoth.browser.js'
    }
  }
});
