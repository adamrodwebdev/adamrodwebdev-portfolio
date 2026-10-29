// Le site publié (dist/), dans un vrai navigateur (1.9.0) :
//  - chaque page ne demande rien à un autre domaine, ne déclenche aucune violation de CSP ni aucune erreur ;
//  - les fichiers internes du dépôt ne sont pas servis ;
//  - le formulaire de contact envoie le consentement et garde le pot de miel, avec et sans JavaScript.
import { readdirSync } from 'node:fs';
import { test, expect } from '@playwright/test';

/** Les pages publiées, d'après les fichiers HTML de dist/. */
const PAGES = readdirSync('dist', { recursive: true })
  .map((file) => `/${String(file).replaceAll('\\', '/')}`)
  .filter((file) => file.endsWith('.html'))
  .map((file) => file.replace(/index\.html$/, ''))
  .sort();

/** Suit les requêtes vers un autre domaine, les violations de CSP et les erreurs d'une page. */
async function watch(page, baseURL) {
  const origin = new URL(baseURL).origin;
  const outside = [];
  const errors = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(`${origin}/`) && !/^(data|blob):/.test(url)) outside.push(url);
  });
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    window.cspViolations = [];
    addEventListener('securitypolicyviolation', (event) => {
      window.cspViolations.push(`${event.violatedDirective} ${event.blockedURI} ${event.sample}`.trim());
    });
  });
  return { outside, errors, violations: () => page.evaluate(() => window.cspViolations) };
}

/** Parcourt la page jusqu'en bas : les îlots, révélations et médias différés se chargent. */
async function scrollThrough(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += innerHeight / 2) {
      scrollTo(0, y);
      await new Promise((done) => setTimeout(done, 100));
    }
  });
  await page.waitForLoadState('networkidle');
}

for (const path of PAGES) {
  test(`${path} : rien d'un autre domaine, aucune violation de CSP ni erreur`, async ({ page, baseURL }) => {
    const seen = await watch(page, baseURL);
    const response = await page.goto(path);
    expect(response.headers()['content-security-policy']).toContain("default-src 'none'");
    await scrollThrough(page);
    expect(seen.outside).toEqual([]);
    expect(await seen.violations()).toEqual([]);
    expect(seen.errors).toEqual([]);
  });
}

test('en-têtes de sécurité : CSP stricte et protections attendues', async ({ request }) => {
  const headers = (await request.get('/')).headers();
  const csp = headers['content-security-policy'];
  expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|https?:|\*/);
  for (const directive of ["default-src 'none'", "form-action 'self'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'"]) {
    expect(csp).toContain(directive);
  }
  expect(headers['strict-transport-security']).toContain('preload');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBeTruthy();
  expect(headers['permissions-policy']).toBeTruthy();
});

test("les fichiers internes du dépôt ne sont pas servis", async ({ request }) => {
  for (const path of ['/README.md', '/CHANGELOG.md', '/ROADMAP.md', '/package.json', '/package-lock.json', '/netlify.toml',
    '/.gitignore', '/templates/index.html', '/scripts/build.mjs', '/tests/site.spec.mjs', '/node_modules/vue/package.json', '/_headers']) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test('formulaire (Vue) : envoie le consentement et le pot de miel', async ({ page }) => {
  let sent = null;
  await page.route((url) => url.pathname === '/', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    sent = new URLSearchParams(route.request().postData() ?? '');
    return route.fulfill({ status: 200, body: '' });
  });
  await page.goto('/');
  const form = page.locator('#contact-app form[aria-busy]');
  await form.scrollIntoViewIfNeeded();
  await expect(form).toBeVisible();
  await page.fill('#f-nom', 'Camille Martin');
  await page.fill('#f-email', 'camille@example.com');
  await page.fill('#f-message', 'Bonjour, je voudrais un site vitrine pour mon atelier.');
  await page.check('#f-rgpd');
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('#contact-app .success')).toBeVisible({ timeout: 10_000 });

  expect(sent.get('form-name')).toBe('contact');
  expect(sent.get('rgpd')).toBe('oui');
  expect(sent.has('bot-field')).toBe(true);
  expect(sent.get('bot-field')).toBe('');
  expect(sent.get('nom')).toBe('Camille Martin');
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('formulaire : envoie le consentement et le pot de miel', async ({ page }) => {
    let sent = null;
    await page.route((url) => url.pathname === '/merci.html', async (route) => {
      if (route.request().method() === 'POST') sent = new URLSearchParams(route.request().postData() ?? '');
      return route.continue();
    });
    await page.goto('/');
    await page.fill('#f-nom', 'Camille Martin');
    await page.fill('#f-email', 'camille@example.com');
    await page.fill('#f-message', 'Bonjour, je voudrais un site vitrine pour mon atelier.');
    await page.check('#f-rgpd');
    await page.locator('#contact-app button[type="submit"]').click();
    await page.waitForURL('**/merci.html');

    expect(sent.get('form-name')).toBe('contact');
    expect(sent.get('rgpd')).toBe('oui');
    expect(sent.has('bot-field')).toBe(true);
  });
});
