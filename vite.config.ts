import { defineConfig } from 'vite';
export default defineConfig({
  // Portable static output: also works beneath a path when reviewing on GitHub Pages.
  base: './',
  server: { watch: { ignored: ['**/artifacts/**', '**/test-results/**', '**/playwright-report/**'] } },
  build: { target: 'es2022' }
});
