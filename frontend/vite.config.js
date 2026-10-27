import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Tailwind CSS v4 runs as a Vite plugin: design tokens live in src/styles/index.css,
// so no tailwind.config.js or PostCSS config is needed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
