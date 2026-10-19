import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(
    mode,
    fileURLToPath(new URL('../..', import.meta.url)),
    '',
  );
  const apiPort = process.env.API_PORT ?? env.API_PORT ?? '3001';
  return {
    plugins: [react()],
    // משתני שרת נקראים רק בתצורת הפיתוח ואינם מוזרקים לחבילת הדפדפן.
    server: { proxy: { '/api': `http://127.0.0.1:${apiPort}` } },
  };
});
