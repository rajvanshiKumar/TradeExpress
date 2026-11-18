import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The backend address comes only from VITE_PUBLIC_API_BASE_URL in frontend/.env (see src/config/api.js).
// The dev proxy forwards same-site /api and /uploads requests to that same backend, so no host is written here.
function backendProxy(apiBaseUrl) {
  let target;
  try {
    target = new URL(apiBaseUrl).origin; // only an absolute URL names a backend to forward to
  } catch {
    return undefined;
  }
  const route = { target, changeOrigin: true, secure: true };
  return { '/api': route, '/uploads': route };
}

// Tailwind CSS v4 runs as a Vite plugin: design tokens live in src/styles/index.css,
// so no tailwind.config.js or PostCSS config is needed.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: backendProxy(String(env.VITE_PUBLIC_API_BASE_URL || '').trim()),
    },
  };
});
