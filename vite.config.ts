import { defineConfig } from 'vite';
export default defineConfig({
  // Portable static output: also works beneath a path when reviewing on GitHub Pages.
  base: './',
  build: { target: 'es2022' }
});
