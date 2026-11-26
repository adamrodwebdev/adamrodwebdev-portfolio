// Tests du site publié (1.9.0) : dist/ servi par scripts/serve.mjs, avec les en-têtes de Netlify (CSP comprise).
// Un seul processus de test, pour ménager la machine.
// Le projet desktop tourne dans le headless shell de Chromium : il plante parfois quand une vraie souris bouge
// pendant un défilement en douceur au-dessus des carrousels 3D (pas Chrome stable ni WebKit) ; voir le README,
// « Un plantage du navigateur de test ». Un clic qui fait défiler la page passe par dispatchEvent('click').
import { defineConfig } from '@playwright/test';

const PORT = 8090;

export default defineConfig({
  testDir: 'tests',
  // Les tests du navigateur seulement : les tests unitaires (tests/unit/*.test.mjs) passent par node --test.
  testMatch: '**/*.spec.mjs',
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
