// Tests du site publié (1.9.0) : dist/ servi par scripts/serve.mjs, avec les en-têtes de Netlify (CSP comprise).
// Un seul processus de test, pour ménager la machine.
import { defineConfig } from '@playwright/test';

const PORT = 8090;

export default defineConfig({
  testDir: 'tests',
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: 'mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'node scripts/serve.mjs',
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: false,
  },
});
