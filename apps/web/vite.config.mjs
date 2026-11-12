import { defineConfig } from 'vite';

export default defineConfig({
  // Keep the preview compatible with the project's existing modern browsers.
  build: { target: 'es2022' },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
});
