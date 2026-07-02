import { defineConfig } from '@playwright/test';

// Puerto 3001 está ocupado en este entorno por un servicio ajeno (bridge de
// WhatsApp gestionado por PM2), así que la API E2E usa un puerto alternativo
// libre. El proxy de Vite se apunta al mismo puerto vía VITE_API_PROXY_TARGET.
const apiPort = process.env.E2E_API_PORT ?? '4501';
const apiTarget = `http://localhost:${apiPort}`;

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:5173' },
  webServer: [
    {
      command: `bash -c "cd ../api && PORT=${apiPort} node dist/server.js"`,
      url: `${apiTarget}/health`,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30_000,
      env: { VITE_API_PROXY_TARGET: apiTarget },
    },
  ],
});
