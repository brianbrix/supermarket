import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const rawBasePath = process.env.VITE_BASE_PATH ?? '/'
const normalizedBasePath = (() => {
  if (rawBasePath === './') return './'
  let value = rawBasePath.trim()
  if (!value.startsWith('/')) {
    value = `/${value}`
  }
  if (!value.endsWith('/') && value !== './') {
    value = `${value}/`
  }
  return value
})()

// https://vite.dev/config/
export default defineConfig({
  base: normalizedBasePath,
  plugins: [react()],
  optimizeDeps: {
    include: ['react-bootstrap-typeahead']
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('react-router-dom')) return 'vendor-router';
          if (id.includes('react-hook-form')) return 'vendor-forms';
          if (id.includes('bootstrap')) return 'vendor-bootstrap';
          if (id.includes('react')) return 'vendor-react';

          const segments = id
            .toString()
            .split('node_modules/')[1]
            .split('/');

          const packageName = segments[0].startsWith('@')
            ? `${segments[0]}-${segments[1]}`
            : segments[0];

          return `vendor-${packageName.replace(/[@]/g, '')}`;
        },
      },
    },
  },
})
