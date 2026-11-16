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

// ----- Données vérifiées à la porte (1.13.1) -----

test('formulaire (Vue) : envoie des textes nettoyés et des choix pris dans leurs listes', async ({ page }) => {
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
  await page.fill('#f-nom', '  Camille‮   Martin​ ');
  await page.fill('#f-email', ' camille@example.com ');
  await page.fill('#f-message', 'Bonjour,\r\nje voudrais un site\u0007 vitrine pour mon atelier.');
  // Une page modifiée : un type qui n'est pas dans la liste
  await page.locator('#f-type').evaluate((select) => {
    select.add(new Option('<script>', '<script>'));
    select.value = '<script>';
    select.dispatchEvent(new Event('change'));
  });
  await page.check('#f-rgpd');
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('#contact-app .success')).toBeVisible({ timeout: 10_000 });

  expect(sent.get('nom')).toBe('Camille Martin');
  expect(sent.get('email')).toBe('camille@example.com');
  expect(sent.get('message')).toBe('Bonjour,\nje voudrais un site vitrine pour mon atelier.');
  expect(sent.get('type')).not.toBe('<script>');
});

test('formulaire : chaque champ de texte a une longueur maximale, avec et sans JavaScript', async ({ page, browser }) => {
  await page.goto('/');
  for (const [field, max] of [['#f-nom', '80'], ['#f-email', '180'], ['#f-entreprise', '120']]) {
    await expect(page.locator(`#contact-app ${field}`)).toHaveAttribute('maxlength', max);
  }
  const context = await browser.newContext({ javaScriptEnabled: false });
  const plain = await context.newPage();
  await plain.goto('/');
  for (const [field, max] of [['#f-nom', '80'], ['#f-email', '180'], ['#f-entreprise', '120'], ['#f-message', '1500']]) {
    await expect(plain.locator(field)).toHaveAttribute('maxlength', max);
  }
  await context.close();
});

test('curseur : la flèche sur le contenu, la main sur ce qui se clique, la barre dans un champ', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('cursor', 'default');
  await expect(page.locator('main p').first()).toHaveCSS('cursor', 'default');
  await expect(page.locator('main a[href]').first()).toHaveCSS('cursor', 'pointer');
  await expect(page.locator('#contact-app #f-nom')).toHaveCSS('cursor', 'text');
});

// ----- Langues (1.10.0) -----

/** Les textes à plat : chemin de clé → valeur (les tableaux restent des valeurs). */
test('sélection : les titres et l’interface ne se sélectionnent pas, les textes si (1.14.1)', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const userSelect = (selector) => page.locator(selector).first().evaluate((element) => getComputedStyle(element).userSelect);
  for (const selector of ['.hero__title', '.hero__status', '#services-title', '.brand__name', '.nav__link', '.btn', '.hud-panel', '.panel__index']) {
    expect(await userSelect(selector), selector).toBe('none');
  }
  // Les textes, l'adresse e-mail et les champs se copient (traduction, lecture à voix haute de la sélection)
  for (const selector of ['.hero__lead', '.section__intro', '.aug__text', '.contact__mail']) {
    expect(await userSelect(selector), selector).not.toBe('none');
  }
  if (isMobile) return; // le glisser de souris se vérifie sur ordinateur
  const drag = async (selector) => {
    await page.evaluate(() => window.getSelection().removeAllRanges());
    // Le long de la première ligne : au milieu d'un paragraphe, la souris tomberait dans un interligne
    const box = await page.locator(selector).first().boundingBox();
    const y = box.y + Math.min(14, box.height / 4);
    await page.mouse.move(box.x + 2, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.8, y, { steps: 12 });
    await page.mouse.up();
    return page.evaluate(() => window.getSelection().toString().trim());
  };
  expect(await drag('.hero__title'), 'glisser sur le titre du hero').toBe('');
  expect((await drag('.hero__lead')).length, 'glisser sur le paragraphe du hero').toBeGreaterThan(0);
});

const flatten = (object, prefix = '') => Object.entries(object).flatMap(([key, value]) =>
  value && typeof value === 'object' && !Array.isArray(value) ? flatten(value, `${prefix}${key}.`) : [[`${prefix}${key}`, value]]);
const placeholders = (text) => (String(text).match(/\{\w+\}/g) ?? []).sort().join(' ');

test('traductions : chaque langue a les clés, les listes et les paramètres du français', async () => {
  const { messages } = await import('../js/i18n/messages.js');
  const reference = new Map(flatten(messages.fr));
  for (const [code, texts] of Object.entries(messages)) {
    const flat = new Map(flatten(texts));
    expect([...flat.keys()].filter((key) => !reference.has(key)), `${code} : clés en trop`).toEqual([]);
    for (const [key, value] of reference) {
      const other = flat.get(key);
      expect(other, `${code}.${key} manque`).toBeDefined();
      if (Array.isArray(value)) {
        expect(other.length, `${code}.${key} : longueur de liste`).toBe(value.length);
        continue;
      }
      expect(placeholders(other), `${code}.${key} : paramètres`).toBe(placeholders(value));
      // vue-i18n lit { } @ $ | : hors des paramètres, seuls les titres de page (jamais lus par vue-i18n) en ont
      if (!key.startsWith('meta.')) expect(String(other).replace(/\{\w+\}/g, ''), `${code}.${key} : caractère spécial`).not.toMatch(/[{}@$|]/);
    }
  }
});

test('langues : chaque accueil annonce les cinq langues et ne charge que la sienne', async ({ page }) => {
  const { LANGUAGES } = await import('../js/i18n/languages.js');
  for (const language of LANGUAGES) {
    const locales = [];
    page.on('request', (request) => { const m = /\/js\/i18n\/locales\/(\w+)\.js$/.exec(request.url()); if (m) locales.push(m[1]); });
    await page.goto(language.base);
    await expect(page.locator('html')).toHaveAttribute('lang', language.code);
    const hreflangs = await page.locator('link[rel="alternate"][hreflang]').evaluateAll((links) => links.map((link) => link.hreflang));
    expect(hreflangs).toEqual([...LANGUAGES.map((l) => l.code), 'x-default']);
    await expect(page.locator('#nav-app .lang-menu summary')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect([...new Set(locales)], language.code).toEqual([language.code]);
    page.removeAllListeners('request');
  }
});

test('menu des langues : cinq langues, la langue courante marquée, la section gardée', async ({ page }) => {
  await page.goto('/#contact');
  await page.waitForLoadState('networkidle');
  const menu = page.locator('#nav-app .lang-menu');
  await menu.locator('summary').click();
  const links = menu.locator('.lang-menu__list a');
  await expect(links).toHaveText(['Français', 'English', 'Русский', 'Italiano', 'Español']);
  await expect(links.first()).toHaveAttribute('aria-current', 'true');
  const box = await links.nth(3).boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);
  await links.nth(3).click();
  await page.waitForURL((url) => url.pathname === '/it/' && url.hash === '#contact');
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
});

test("en-tête : la marque et ses boutons tiennent sur une ligne de 320 à 1280 px, sans écraser le logo", async ({ page }) => {
  // Le russe est la langue la plus large ; 861 et 1024 px encadraient l'apparition des liens (1.12.0)
  for (const width of [320, 360, 390, 412, 440, 768, 861, 1024, 1120, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/ru/');
    await page.waitForLoadState('networkidle');
    // Le bord droit de chaque élément visible de l'en-tête (le bouton du menu est caché sur grand écran)
    const rights = await page.locator('#nav-app .brand__mark, #nav-app .lang-menu summary, #nav-app .nav__tools > *').evaluateAll((elements) =>
      elements.filter((element) => element.getClientRects().length).map((element) => Math.round(element.getBoundingClientRect().right)));
    expect(Math.max(...rights), `en-tête à ${width} px`).toBeLessThanOrEqual(width);
    expect((await page.locator('#nav-app .brand__mark').boundingBox()).width, `logo à ${width} px`).toBeGreaterThanOrEqual(30);
  }
});

test('titres : l’effet de survol joue une fois, même si la souris reste dessus (1.10.1)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'pas de survol sur un écran tactile');
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const title = page.locator('#services-title');
  await title.scrollIntoViewIfNeeded();
  // Le titre arrive brisé et se répare (1.14.0) : la fissure du survol attend la fin de la réparation
  await expect(title).toHaveAttribute('data-done', '1');
  await expect(title).not.toHaveClass(/is-repairing/, { timeout: 3000 });
  await title.evaluate((element) => {
    window.cracks = 0;
    new MutationObserver(() => { if (element.classList.contains('crack-once')) window.cracks += 1; })
      .observe(element, { attributes: true, attributeFilter: ['class'] });
  });
  await title.hover();
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.cracks), 'souris immobile sur le titre').toBe(1);
  await expect(title).not.toHaveClass(/crack-once/);
  // Sortie de l'en-tête de la section, puis retour : l'effet rejoue une fois
  await page.mouse.move(5, 5);
  await title.hover();
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.cracks), 'second survol').toBe(2);
});

// ----- La police signature (1.14.0) -----

const SIGNATURE = 'Clivage';
const signatureLoaded = (page) => page.waitForFunction((family) =>
  [...document.fonts].some((face) => face.family.replace(/["']/g, '') === family && face.status === 'loaded'), SIGNATURE);
const fontOf = (locator) => locator.evaluate((element) => getComputedStyle(element).fontFamily);

test('police signature : tout l’affichage en Clivage, le texte courant en Barlow, plus de Rajdhani', async ({ page }) => {
  const fonts = [];
  page.on('request', (request) => { if (request.resourceType() === 'font') fonts.push(new URL(request.url()).pathname); });
  await page.goto('/');
  // Les îlots Vue montés (la navigation remplace l'en-tête) : un élément détaché n'a pas de style calculé
  await page.waitForLoadState('networkidle');
  await signatureLoaded(page);
  for (const selector of ['.brand__name', '.hero__title', '#services-title', '.hero__status', '.btn']) {
    expect(await fontOf(page.locator(selector).first()), selector).toMatch(/^Clivage, "Clivage Fallback"/);
  }
  expect(await fontOf(page.locator('.hero__lead'))).toMatch(/^Barlow/);
  // Une seule graisse, déclarée pour toutes : le navigateur ne simule aucun gras
  expect(await page.evaluate((family) => [...document.fonts].find((face) => face.family.replace(/["']/g, '') === family).weight, SIGNATURE)).toBe('100 900');
  expect(fonts.some((path) => path === '/fonts/clivage-v1.woff2')).toBe(true);
  expect(fonts.filter((path) => path.includes('rajdhani'))).toEqual([]);
});

test('police signature : chaque titre arrive brisé et se répare, le hero se brise puis se répare', async ({ page }) => {
  await page.goto('/');
  await signatureLoaded(page);
  await expect(page.locator('.hero__line').first()).toHaveClass(/is-shattering/, { timeout: 4000 });
  const title = page.locator('#projets-title');
  await title.scrollIntoViewIfNeeded();
  await expect(title).toHaveClass(/is-repairing/);
  await expect(title).not.toHaveClass(/is-repairing/, { timeout: 3000 });
  // Entier à la fin, et le texte du titre n'a jamais changé (les lecteurs d'écran lisent le vrai titre)
  expect(await title.evaluate((element) => getComputedStyle(element).fontVariationSettings)).toBe('normal');
  expect(await title.textContent()).toBe(await page.evaluate(() => document.getElementById('projets-title').textContent));
});

test('police signature : avec « réduire les animations », rien ne se brise', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await signatureLoaded(page);
  await page.waitForTimeout(2200);
  await expect(page.locator('.hero__line.is-shattering')).toHaveCount(0);
  const title = page.locator('#services-title');
  await title.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await expect(title).not.toHaveClass(/is-repairing/);
  for (const selector of ['.hero__line', '#services-title', '.brand__name']) {
    expect(await page.locator(selector).first().evaluate((element) => getComputedStyle(element).fontVariationSettings), selector).toBe('normal');
  }
});

test('police signature : aucun contour CSS, qui tracerait ses lignes de cassure', async ({ page }) => {
  await page.goto('/');
  for (const selector of ['.hero__line--gold', '.panel__index', '.sound-deck__title', '.brand__name']) {
    const stroke = await page.locator(selector).first().evaluate((element) => getComputedStyle(element).webkitTextStrokeWidth);
    expect(stroke, selector).toBe('0px');
  }
});

test('police signature : en russe, le logo et le titre du hero la gardent, les titres passent aux polices système', async ({ page }) => {
  await page.goto('/ru/');
  await page.waitForLoadState('networkidle');
  expect(await fontOf(page.locator('.brand__name').first())).toMatch(/^Clivage,/);
  expect(await fontOf(page.locator('.hero__title'))).toMatch(/^Clivage,/);
  expect(await fontOf(page.locator('#services-title'))).toMatch(/^Bahnschrift/);
});

test('police signature : son arrivée ne décale rien (repli calé sur ses mesures)', async ({ page }) => {
  // Les textes d'affichage écrits dans le HTML (pas ceux des îlots Vue, montés plus tard)
  const boxes = () => page.evaluate(() => Object.fromEntries(
    ['#accueil .hero__title', '#accueil .hero__status', '#accueil .hero__actions', '.site-header .brand__name',
      '#services-title', '#projets-title', '#methode-title', '#bande-son-title', '#contact-title']
      .map((selector) => [selector, Math.round(document.querySelector(selector).getBoundingClientRect().height)])));
  // D'abord sans la signature (le repli seul), puis avec
  await page.route('**/fonts/clivage-*.woff2', (route) => route.abort());
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const fallback = await boxes();
  await page.unroute('**/fonts/clivage-*.woff2');
  await page.goto('/');
  await signatureLoaded(page);
  expect(await boxes()).toEqual(fallback);
});

test('police signature : le hero, les titres et le logo tiennent dans l’écran, de 320 à 2560 px', async ({ page, isMobile }) => {
  test.skip(isMobile, 'les largeurs se règlent ici à la main');
  for (const path of ['/', '/ru/']) {
    for (const width of [320, 360, 390, 768, 1024, 1280, 1440, 1920, 2560]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await signatureLoaded(page);
      const overflow = await page.locator('.hero__line, .section__title, .site-header .brand__name').evaluateAll((elements) =>
        elements.filter((element) => element.getClientRects().length)
          .filter((element) => element.scrollWidth > element.clientWidth + 1 || element.getBoundingClientRect().right > innerWidth + 1)
          .map((element) => element.className));
      expect(overflow, `${path} à ${width} px`).toEqual([]);
    }
  }
});

// ----- Bande-son (1.12.0) -----

test('partition : chaque note tient dans sa mesure, chaque accord existe, les parties couvrent le morceau', async () => {
  const { MELODY, GRID, CHORDS, STEPS_PER_BAR, SECTIONS, TOTAL_BARS, BAR } = await import('../js/audio/score.js');
  for (const [phrase, notes] of Object.entries(MELODY)) {
    for (const [bar, step, , length] of notes) expect(step + length, `${phrase} mesure ${bar}, pas ${step}`).toBeLessThanOrEqual(STEPS_PER_BAR);
  }
  for (const chord of GRID) expect(CHORDS[chord], chord).toBeDefined();
  expect(SECTIONS.reduce((bars, section) => bars + section.bars, 0)).toBe(TOTAL_BARS);
  for (const section of SECTIONS) expect(section.start).toBeCloseTo(section.firstBar * BAR, 6);
});

test('bande-son : l’interrupteur de l’en-tête lance et coupe le thème, le lecteur suit', async ({ page }) => {
  const { messages } = await import('../js/i18n/messages.js');
  await page.goto('/');
  await expect(page.locator('.player')).toHaveCount(0);
  const toggle = page.locator('#nav-app .sound-btn');
  await expect(toggle).toHaveAccessibleName(messages.fr.nav.sound);
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
  const position = page.locator('#soundtrack-app .sound-deck__timeline input');
  await expect.poll(async () => Number(await position.inputValue()), { timeout: 10_000 }).toBeGreaterThan(1);
  await expect(page.locator('#soundtrack-app .sound-deck__play')).toHaveText(messages.fr.soundtrack.pause);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  const held = await position.inputValue();
  await page.waitForTimeout(1200);
  expect(await position.inputValue(), 'la position reste sur la pause').toBe(held);
});

test('bande-son : chaque partie se joue depuis son début, et s’allume', async ({ page }) => {
  const { SECTIONS } = await import('../js/audio/score.js');
  await page.goto('/#bande-son');
  const chapters = page.locator('#soundtrack-app .chapter');
  await expect(chapters).toHaveCount(SECTIONS.length);
  await chapters.nth(3).locator('.chapter__play').click();
  await expect(chapters.nth(3)).toHaveAttribute('aria-current', 'time', { timeout: 10_000 });
  const position = Number(await page.locator('#soundtrack-app .sound-deck__timeline input').inputValue());
  expect(position).toBeGreaterThanOrEqual(Math.floor(SECTIONS[3].start));
  expect(position).toBeLessThan(SECTIONS[4].start);
  await page.locator('#nav-app .sound-btn').click();
  await expect(page.locator('#nav-app .sound-btn')).toHaveAttribute('aria-pressed', 'false');
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('bande-son : les cinq parties et la note restent lisibles', async ({ page }) => {
    const { messages } = await import('../js/i18n/messages.js');
    await page.goto('/');
    await expect(page.locator('#bande-son .chapter')).toHaveCount(5);
    await expect(page.locator('#bande-son .no-js-only')).toHaveText(messages.fr.soundtrack.noscript);
  });

  test('menu des langues : il s’ouvre et mène à une autre langue', async ({ page }) => {
    await page.goto('/es/');
    const menu = page.locator('.lang-menu');
    await menu.locator('summary').click();
    await menu.getByRole('link', { name: 'Русский' }).click();
    await page.waitForURL('**/ru/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });

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
