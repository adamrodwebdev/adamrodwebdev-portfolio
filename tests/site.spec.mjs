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
  const userSelect = (selector) => page.locator(selector).first().evaluate((element) => { const style = getComputedStyle(element); return style.webkitUserSelect || style.userSelect; });
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
// Sans guillemets : Chromium écrit « "Clivage Fallback" », WebKit « Clivage Fallback »
const fontOf = (locator) => locator.evaluate((element) => getComputedStyle(element).fontFamily.replace(/["']/g, ''));
// L'accueil donne ses polices bloc par bloc (1.18.1) : la classe fonts-ready marque le dernier
const fontsApplied = (page) => expect(page.locator('html')).toHaveClass(/\bfonts-ready\b/, { timeout: 10_000 });

test('police signature : tout l’affichage en Clivage, le texte courant en Barlow, plus de Rajdhani', async ({ page }) => {
  const fonts = [];
  page.on('request', (request) => { if (request.resourceType() === 'font') fonts.push(new URL(request.url()).pathname); });
  await page.goto('/');
  // Les îlots Vue montés (la navigation remplace l'en-tête) : un élément détaché n'a pas de style calculé
  await page.waitForLoadState('networkidle');
  await signatureLoaded(page);
  await fontsApplied(page);
  for (const selector of ['.brand__name', '.hero__title', '#services-title', '.hero__status', '.btn']) {
    expect(await fontOf(page.locator(selector).first()), selector).toMatch(/^Clivage, Clivage Fallback/);
  }
  expect(await fontOf(page.locator('.hero__lead'))).toMatch(/^Barlow/);
  // Une seule graisse, déclarée pour toutes : le navigateur ne simule aucun gras
  expect(await page.evaluate((family) => [...document.fonts].find((face) => face.family.replace(/["']/g, '') === family).weight, SIGNATURE)).toBe('100 900');
  expect(fonts.some((path) => path === '/fonts/clivage-v2-latin.woff2')).toBe(true);
  // Une page latine ne télécharge pas le fichier cyrillique (1.15.0)
  expect(fonts.filter((path) => path.includes('cyrillic'))).toEqual([]);
  expect(fonts.filter((path) => path.includes('rajdhani'))).toEqual([]);
});

test('polices bloc par bloc (1.18.1) : chaque texte de l’accueil finit dans une police du site chargée, dans chaque langue', async ({ page }) => {
  for (const path of ['/', '/en/', '/es/', '/it/', '/ru/']) {
    await page.goto(path);
    await fontsApplied(page);
    // Les carrousels montés eux aussi : ils arrivent à l'approche de leur section
    for (const id of ['#projets', '#creations']) {
      await page.locator(id).evaluate((el) => el.scrollIntoView({ behavior: 'instant' }));
      await expect(page.locator(`${id} .slide`).first()).toBeAttached();
    }
    const problems = await page.evaluate(() => {
      const ru = document.documentElement.lang === 'ru';
      const faces = [...document.fonts].filter((face) => face.status === 'loaded');
      const covered = (family, weight) => faces.some((face) => {
        const [low, high = low] = face.weight.split(' ').map(Number);
        return face.family.replace(/["']/g, '') === family && weight >= low && weight <= high;
      });
      const found = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const text = walker.currentNode.textContent.trim();
        const element = walker.currentNode.parentElement;
        if (!text || element.closest('script, noscript, template') || !element.checkVisibility()) continue;
        const style = getComputedStyle(element);
        const family = style.fontFamily.split(',')[0].replace(/["']/g, '').trim();
        const weight = Number(style.fontWeight);
        // Une tête de pile locale (le repli de Clivage, ou Segoe UI hors du russe) : un bloc oublié ;
        // une police du site sans fichier chargé à sa graisse : une police oubliée dans HOME_FONTS
        const leftover = family === 'Clivage Fallback' || (family === 'Segoe UI' && !ru);
        const missing = (family === 'Clivage' || family === 'Barlow') && !covered(family, weight);
        if (leftover || missing) found.add(`${family} ${weight} : ${element.tagName.toLowerCase()}.${element.classList[0] ?? ''} « ${text.slice(0, 30)} »`);
      }
      return [...found];
    });
    expect(problems, path).toEqual([]);
    // Le menu mobile, que Vue place dans body, hors des blocs
    expect(await fontOf(page.locator('#menu-mobile a').first()), path).toMatch(/^Clivage, Clivage Fallback/);
  }
});

test('polices bloc par bloc (1.18.1) : l’écran d’abord, chaque bloc dans sa tâche', async ({ page }) => {
  await page.addInitScript(() => {
    window.fontBlocks = [];
    // Une tâche ouverte par chaque bloc, fermée par la tâche suivante : un bloc qui la trouve encore ouverte
    // a été servi dans la même tâche que le précédent
    let open = false;
    document.addEventListener('fontsapplied', (event) => {
      const box = event.detail.getBoundingClientRect();
      window.fontBlocks.push({ seen: box.bottom > 0 && box.top < innerHeight, shared: open });
      open = true;
      setTimeout(() => { open = false; }, 0);
    });
  });
  await page.goto('/');
  await fontsApplied(page);
  const blocks = await page.evaluate(() => window.fontBlocks);
  expect(blocks.length).toBeGreaterThan(10);
  expect(blocks[0].seen).toBe(true);
  expect(blocks.at(-1).seen).toBe(false);
  expect(blocks.filter((block) => block.shared)).toEqual([]);
});

test('police signature : le menu des langues fermé n’est pas mis en page, le cyrillique ne vient qu’à son ouverture (1.15.0)', async ({ page }) => {
  const fonts = [];
  page.on('request', (request) => { if (request.resourceType() === 'font') fonts.push(new URL(request.url()).pathname); });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const list = page.locator('#nav-app .lang-menu__list');
  // Sans boîte, « Русский » ne demande aucune police (Lighthouse mettait en page le <details> fermé)
  expect(await list.evaluate((element) => getComputedStyle(element).display)).toBe('none');
  expect(fonts.filter((path) => path.includes('cyrillic'))).toEqual([]);
  await page.locator('#nav-app .lang-menu summary').click();
  const russian = list.getByRole('link', { name: 'Русский' });
  await expect(russian).toBeVisible();
  await expect.poll(() => fonts.includes('/fonts/clivage-v2-cyrillic.woff2')).toBe(true);
  expect(await fontOf(russian)).toMatch(/^Clivage, Clivage Fallback/);
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

test('police signature : en russe aussi, tout l’affichage en Clivage, ses deux fichiers chargés (1.15.0)', async ({ page }) => {
  const fonts = [];
  page.on('request', (request) => { if (request.resourceType() === 'font') fonts.push(new URL(request.url()).pathname); });
  await page.goto('/ru/');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  await fontsApplied(page);
  for (const selector of ['.brand__name', '.hero__title', '#services-title', '.hero__status', '.btn']) {
    expect(await fontOf(page.locator(selector).first()), selector).toMatch(/^Clivage, Clivage Fallback/);
  }
  // Barlow n'a pas de cyrillique : le texte courant russe garde les polices système
  expect(await fontOf(page.locator('.hero__lead'))).toMatch(/^Segoe UI/);
  expect(fonts.filter((path) => path.startsWith('/fonts/clivage-')).sort()).toEqual(['/fonts/clivage-v2-cyrillic.woff2', '/fonts/clivage-v2-latin.woff2']);
  const faces = await page.evaluate(() => [...document.fonts].filter((face) => face.family.replace(/["']/g, '') === 'Clivage').map((face) => face.status));
  expect(faces).toEqual(['loaded', 'loaded']);
});

test('police signature : son arrivée ne décale rien (repli calé sur ses mesures)', async ({ page }) => {
  // Les textes d'affichage écrits dans le HTML (pas ceux des îlots Vue, montés plus tard)
  const boxes = () => page.evaluate(() => Object.fromEntries(
    ['#accueil .hero__title', '#accueil .hero__status', '#accueil .hero__actions', '.site-header .brand__name',
      '#offres-title', '#services-title', '#projets-title', '#methode-title', '#creations-title', '#bande-son-title', '#contact-title']
      .map((selector) => [selector, Math.round(document.querySelector(selector).getBoundingClientRect().height)])));
  // D'abord sans la signature (le repli seul), puis avec ; en latin et en russe (1.15.0)
  for (const path of ['/', '/ru/']) {
    await page.route('**/fonts/clivage-*.woff2', (route) => route.abort());
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    // Une police qui manque n'arrête pas les autres : les blocs reçoivent quand même les leurs (1.18.1)
    await fontsApplied(page);
    const fallback = await boxes();
    await page.unroute('**/fonts/clivage-*.woff2');
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await fontsApplied(page);
    expect(await boxes(), path).toEqual(fallback);
  }
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

// ----- Offre commerciale (1.17.0) -----

test('offres : trois formules, la maintenance et le pré-audit, aux prix de la langue (1.17.0)', async ({ page }) => {
  const { messages } = await import('../js/i18n/messages.js');
  const { plans, care, audit } = await import('../js/data/offers.js');
  for (const [path, lang] of [['/', 'fr'], ['/en/', 'en'], ['/ru/', 'ru'], ['/it/', 'it'], ['/es/', 'es']]) {
    await page.goto(path);
    const locale = messages[lang].meta.ldLanguage;
    const { euros } = await import('../scripts/offers.mjs');
    const price = (amount) => euros(amount, locale);
    const offers = page.locator('#offres .offer');
    await expect(offers).toHaveCount(plans.length);
    await expect(page.locator('#offres .offer--pick')).toHaveCount(1);
    await expect(offers.first().locator('.offer__price')).toContainText(price(plans[0].price));
    await expect(page.locator('#offres .care__tiers li')).toHaveCount(care.length);
    await expect(page.locator('#offres .care__price').first()).toContainText(price(care[0].monthly));
    await expect(page.locator('#offres .audit .offer__price')).toContainText(price(audit.price));
    await expect(page.locator('#offres .offers__legal')).toHaveText(messages[lang].offers.legal);
  }
});

test('offres : chaque bouton choisit son type de projet dans le formulaire (1.17.0)', async ({ page }) => {
  const { messages } = await import('../js/i18n/messages.js');
  const { PROJECT_TYPES } = await import('../js/data/offers.js');
  const types = messages.fr.form.types;
  await page.goto('/');
  await expect(page.locator('#contact-app form[aria-busy]')).toHaveCount(1);
  for (const [selector, key] of [['#offres .care__more a', 'care'], ['#offres .audit .btn', 'audit'], ['#offres .offer:nth-child(3) .offer__cta', 'app']]) {
    // Clic sans souris : une vraie souris qui bouge pendant le défilement fait planter Chromium sans écran
    // sur ordinateur, déjà en 1.15.0 (2 passages sur 10) ; ce test vérifie le lien bouton → type, pas le survol.
    await page.locator(selector).dispatchEvent('click');
    await expect(page.locator('#f-type')).toHaveValue(types[PROJECT_TYPES[key]]);
  }
  // Le budget le plus bas existe maintenant
  await expect(page.locator('#contact-app .chips')).toContainText(messages.fr.form.budgets[0]);
});

test('accueil : l’offre d’abord, les sites puis les jeux, chacun son carrousel (1.17.0)', async ({ page }) => {
  const { projectsOf } = await import('../js/data/projects.js');
  await page.goto('/');
  const ids = await page.locator('main > section[id]').evaluateAll((sections) => sections.map((s) => s.id));
  expect(ids).toEqual(['accueil', 'offres', 'services', 'projets', 'methode', 'creations', 'bande-son', 'contact']);
  const indexes = await page.locator('main .panel__index').evaluateAll((spans) => spans.map((s) => s.dataset.index));
  expect(indexes).toEqual(['01', '02', '03', '04', '05', '06', '07']);
  // Chaque carrousel se monte à l'approche de sa section (1.18.1 pour les réalisations) : le dernier îlot est
  // monté, les observateurs ont rendu leur premier avis (deux images), les listes statiques tiennent encore
  await expect(page.locator('#contact-app form[aria-busy]')).toHaveCount(1);
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await expect(page.locator('#projects-app .projects-static')).toHaveCount(1);
  await expect(page.locator('#creations-app .projects-static')).toHaveCount(1);
  await page.locator('#projets').evaluate((el) => el.scrollIntoView({ behavior: 'instant' }));
  await expect(page.locator('#projects-app .slide')).toHaveCount(projectsOf('work').length);
  await page.locator('#creations').evaluate((el) => el.scrollIntoView({ behavior: 'instant' }));
  await expect(page.locator('#creations-app .slide')).toHaveCount(projectsOf('lab').length);
  const links = await page.locator('.site-header .nav__links a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  expect(links).toEqual(['#offres', '#services', '#projets', '#creations', '#contact']);
});

test('témoignages, réservation et Malt : absents tant que leur donnée manque (1.17.0)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.testimonials, .contact__booking')).toHaveCount(0);
  await expect(page.locator('a[href*="cal.com"], a[href*="malt"]')).toHaveCount(0);
  await expect(page.locator('.hero__actions a').nth(1)).toHaveAttribute('href', '#contact');
});

test('marque : AdamRodWebTech sur chaque page, plus jamais AdamRodWebDev (1.17.0)', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    const html = await page.content();
    expect(html, path).not.toContain('AdamRodWebDev');
    if (!path.startsWith('/lumirift/')) expect(html, path).toContain('AdamRodWebTech');
  }
  await page.goto('/');
  await expect(page.locator('.site-header .brand__name')).toHaveText('AdamRodWebTech');
  await expect(page).toHaveTitle(/^AdamRodWebTech \|/);
});

test.describe('sans JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('offres : les formules, leurs prix et les deux listes de projets restent lisibles (1.17.0)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#offres .offer')).toHaveCount(3);
    await expect(page.locator('#offres .care__tiers li')).toHaveCount(3);
    await expect(page.locator('#projects-app .projects-static li')).toHaveCount(5);
    await expect(page.locator('#creations-app .projects-static li')).toHaveCount(5);
  });

  test('bande-son : les cinq parties et la note restent lisibles', async ({ page }) => {
    const { messages } = await import('../js/i18n/messages.js');
    await page.goto('/');
    await expect(page.locator('#bande-son .chapter')).toHaveCount(5);
    await expect(page.locator('#bande-son .no-js-only')).toHaveText(messages.fr.soundtrack.noscript);
  });

  test('polices (1.18.1) : sans JavaScript, toute la page prend les polices du site, sans attendre de bloc', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/fonts-staged/);
    await page.evaluate(() => document.fonts.ready);
    expect(await fontOf(page.locator('.hero__title'))).toMatch(/^Clivage, Clivage Fallback/);
    expect(await fontOf(page.locator('.hero__lead'))).toMatch(/^Barlow/);
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

// La licence des polices Ressac (1.18.0) : /ressac/licence/ (fait foi) et /en/ressac/licence/
const LICENCE = [
  { path: '/ressac/licence/', lang: 'fr', other: '/en/ressac/licence/', otherLang: 'en', first: '#article-1', annex: 'annexe-a', toc: 'sommaire' },
  { path: '/en/ressac/licence/', lang: 'en', other: '/ressac/licence/', otherLang: 'fr', first: '#section-1', annex: 'schedule-a', toc: 'contents' },
];

test.describe('licence des polices Ressac (1.18.0)', () => {
  for (const licence of LICENCE) {
    test(`${licence.path} : titre, version, sommaire complet, lien vers l’autre langue, liens alternatifs`, async ({ page }) => {
      await page.goto(licence.path);
      await expect(page.locator('html')).toHaveAttribute('lang', licence.lang);
      await expect(page.locator('h1')).toContainText('Ressac');
      await expect(page.locator('.licence__version')).toContainText('1.0');
      // Vingt entrées (18 articles, l'annexe, l'historique), chacune vers un titre de la page
      const targets = await page.locator('.licence__toc a').evaluateAll((links) =>
        links.map((link) => document.getElementById(link.hash.slice(1))?.tagName ?? `absent : ${link.hash}`));
      expect(targets).toEqual(Array(20).fill('H2'));
      await expect(page.locator('.licence__toc a').first()).toHaveAttribute('href', licence.first);
      // L'autre langue, dans l'encadré et dans l'en-tête ; la version française prévaut
      const notice = page.locator('.licence__lang');
      await expect(notice.locator('a')).toHaveAttribute('href', licence.other);
      await expect(notice.locator('a')).toHaveAttribute('hreflang', licence.otherLang);
      await expect(notice).toContainText(licence.lang === 'fr' ? 'la version française prévaut' : 'the French version prevails');
      await expect(page.locator(`.nav__tools a[hreflang="${licence.otherLang}"]`)).toHaveAttribute('href', licence.other);
      // Le français, l'anglais, et l'anglais pour les autres langues (russe, italien, espagnol)
      const alternates = await page.locator('link[rel="alternate"]').evaluateAll((links) =>
        links.map((link) => `${link.hreflang} ${new URL(link.href).pathname}`));
      expect(alternates).toEqual(['fr /ressac/licence/', 'en /en/ressac/licence/', 'x-default /en/ressac/licence/']);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://adamrodwebdev.com${licence.path}`);
    });
  }

  test('le texte se sélectionne, titres compris ; le sommaire, non', async ({ page }) => {
    await page.goto('/ressac/licence/');
    const userSelect = (selector) => page.locator(selector).first().evaluate((element) => { const style = getComputedStyle(element); return style.webkitUserSelect || style.userSelect; });
    for (const selector of ['.licence__head h1', '.licence__text h2', '.licence__text p', '.licence__text li', '.licence__table td']) {
      expect(await userSelect(selector), selector).not.toBe('none');
    }
    for (const selector of ['.licence__toc', '.licence__kicker', '.site-header']) expect(await userSelect(selector), selector).toBe('none');
  });

  test('le contrat se lit dans les polices du système, les titres dans la signature : aucune police de texte à attendre', async ({ page }) => {
    const fonts = [];
    page.on('request', (request) => { if (request.resourceType() === 'font') fonts.push(new URL(request.url()).pathname); });
    await page.goto('/ressac/licence/');
    await page.waitForLoadState('networkidle');
    const family = (selector) => fontOf(page.locator(selector).first());
    expect(await family('.licence__text p')).toMatch(/^Segoe UI/);
    expect(await family('.licence__text h2')).toMatch(/^Clivage, Clivage Fallback/);
    // Barlow recomposait le texte visible à son arrivée (décalage de 0,12 sur ordinateur) : elle n'est plus demandée
    expect(fonts.filter((path) => path.includes('barlow'))).toEqual([]);
  });

  test('une ancre ouverte de l’extérieur tombe sur son article, même après l’arrivée des polices', async ({ page }) => {
    await page.goto('/ressac/licence/#article-14');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => [...document.fonts].some((face) => face.family === 'Clivage' && face.status === 'loaded'));
    await page.waitForTimeout(300);
    const top = await page.locator('#article-14').evaluate((element) => element.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThan(48);
  });

  test('le sommaire mène à l’article choisi', async ({ page }) => {
    await page.goto('/en/ressac/licence/');
    await page.locator('.licence__toc a[href="#section-17"]').click();
    await expect.poll(() => page.locator('#section-17').evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBeLessThan(48);
    expect(new URL(page.url()).hash).toBe('#section-17');
  });

  test('aucun défilement horizontal de 320 à 2560 px ; un tableau défile dans son cadre, nommé, au clavier', async ({ page }) => {
    for (const licence of LICENCE) {
      await page.goto(licence.path);
      for (const width of [320, 360, 390, 768, 1024, 1280, 1920, 2560]) {
        await page.setViewportSize({ width, height: 800 });
        const overflow = await page.evaluate(() => {
          const limit = document.documentElement.clientWidth;
          const wide = [...document.querySelectorAll('body *')]
            .filter((element) => !element.closest('.licence__table') && element.getBoundingClientRect().right > limit + 1)
            .map((element) => element.tagName + (element.className ? `.${String(element.className).split(' ')[0]}` : ''));
          return { page: document.documentElement.scrollWidth - limit, wide: wide.slice(0, 5) };
        });
        expect(overflow, `${licence.path} à ${width} px`).toEqual({ page: 0, wide: [] });
      }
      const frame = page.locator(`.licence__table[aria-labelledby="${licence.annex}"]`);
      await expect(frame).toHaveAttribute('role', 'region');
      await expect(frame).toHaveAttribute('tabindex', '0');
    }
  });

  test('le bouton de thème bascule et se souvient', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/ressac/licence/');
    const button = page.locator('[data-theme-toggle]');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await button.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('[data-theme-toggle]')).toHaveAttribute('aria-pressed', 'false');
  });
});

// La politique de confidentialité de l'application Android de Lumirift (1.18.2) : son adresse est dans la fiche
// Google Play, elle ne bouge plus
test('lumirift : la politique de confidentialité de l’application, en quatre langues, avec son contact (1.18.2)', async ({ page }) => {
  await page.goto('/lumirift/privacy/');
  await expect(page).toHaveTitle(/Lumirift app privacy policy/);
  for (const lang of ['en', 'fr', 'id', 'ru']) {
    const section = page.locator(`section#${lang}`);
    await expect(section, lang).toHaveAttribute('lang', lang);
    await expect(section.locator('a[href="mailto:contact@adamrodwebdev.com"]'), lang).toHaveCount(1);
    await expect(section.locator('a[href^="/"][href*="legal"], a[href="/mentions-legales.html"]'), lang).toHaveCount(1);
  }
  const html = await page.content();
  expect(html).not.toContain('[contact address]');
  expect(html).not.toMatch(/TODO/);
  // Le lien depuis la page du jeu
  await page.goto('/lumirift/');
  await page.locator('.site-footer a[href="/lumirift/privacy/"]').click();
  await expect(page).toHaveURL(/\/lumirift\/privacy\/$/);
});

// La médiation de la consommation (1.18.0) : CM2C, dans les mentions légales
test.describe('mentions légales : la médiation de la consommation (1.18.0)', () => {
  const CM2C = ['a[href="tel:+33189470014"]', 'a[href="https://www.cm2c.net/declarer-un-litige.php"]', 'a[href="mailto:litiges@cm2c.net"]'];

  test('en français : la clause de CM2C, ses coordonnées et leurs liens, sans débordement à 320 px', async ({ page }) => {
    await page.goto('/mentions-legales.html');
    await expect(page.locator('#mediation')).toHaveText('Médiation de la consommation');
    await expect(page.getByText('vous avez la possibilité de recourir gratuitement à une procédure de médiation de la consommation')).toBeVisible();
    for (const link of CM2C) await expect(page.locator(link), link).toBeVisible();
    // Typographie française : espaces insécables avant les deux-points et dans les guillemets
    expect(await page.locator('#mediation + p').textContent()).toContain('«\u00a0le processus de médiation des litiges de la consommation\u00a0»');
    await page.setViewportSize({ width: 320, height: 640 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });

  test('en anglais, puis en russe, en italien et en espagnol : la médiation se fait en français', async ({ page }) => {
    await page.goto('/en/legal-notice.html');
    await expect(page.locator('#mediation')).toHaveText('Consumer mediation');
    await expect(page.getByText('The mediation is conducted in French.')).toBeVisible();
    for (const link of CM2C) await expect(page.locator(link), link).toBeVisible();
    for (const [lang, french] of [['ru', 'на французском'], ['it', 'in francese'], ['es', 'en francés']]) {
      await expect(page.locator(`p[lang="${lang}"]`), lang).toContainText('CM2C');
      await expect(page.locator(`p[lang="${lang}"]`), lang).toContainText(french);
    }
    await page.setViewportSize({ width: 320, height: 640 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
});

test('mentions légales : le texte dans les polices du système, sans Barlow à attendre (1.18.0)', async ({ page }) => {
  for (const path of ['/mentions-legales.html', '/en/legal-notice.html']) {
    const fonts = [];
    const listen = (request) => { if (request.resourceType() === 'font') fonts.push(new URL(request.url()).pathname); };
    page.on('request', listen);
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await fontOf(page.locator('.page p').first()), path).toMatch(/^Segoe UI/);
    expect(fonts.filter((font) => font.includes('barlow')), path).toEqual([]);
    page.off('request', listen);
  }
});
