/**
 * La devise en poussière d'or en tête des offres (1.23.0) : « Le client à cœur », dessinée par des milliers de
 * grains d'or que le curseur ou le doigt écarte, puis qui reviennent à leur place. Un effet décoratif : la
 * phrase reste dans le texte de la page (lue par les lecteurs d'écran), la toile est cachée à l'accessibilité.
 *
 *  - Les grains sont précalculés, une forme par langue (scripts/bake-grains.mjs, assets/grains/tagline-*.bin) :
 *    le navigateur n'échantillonne rien et ne charge que la langue de la page.
 *  - Le module ne se charge qu'à l'arrivée de la bande à l'écran, après le chargement et un temps libre : le
 *    premier affichage n'en paie rien.
 *  - L'ambiance « poussière », l'or du thème sombre ou l'or foncé du thème clair, qui suit le bouton de thème.
 *  - La souris par pointermove, le doigt par touchmove passif : la page défile toujours (touch-action: pan-y).
 *  - En mouvement réduit, les grains restent en place (le module coupe le champ). Rien n'est alloué par image.
 */

/** Les langues du site, chacune avec sa forme. */
export const TAGLINE_LANGS = Object.freeze(['fr', 'en', 'es', 'it', 'ru']);
/** Grains par fichier (le plus grand budget : un préfixe en donne moins). */
export const TAGLINE_GRAINS = Object.freeze({ count: 16000 });
export const taglineFile = (lang) => `assets/grains/tagline-${lang}.bin`;

/** Grains dessinés selon l'appareil : un téléphone en trace moins. */
const BUDGET = Object.freeze({ phone: 7000, desktop: 16000 });
/**
 * Plus gros et plus lumineux que les grains du logo : étalés sur une bande large, ils se perdaient dans le fond
 * et la devise se lisait mal (réglage choisi sur captures, thèmes clair et sombre, 390 et 1280 px).
 */
const GRAIN_SIZE = 1.8;
const GAIN = 2.4;

const pageLang = (root) => {
  const lang = (root.getAttribute('lang') ?? '').slice(0, 2).toLowerCase();
  return TAGLINE_LANGS.includes(lang) ? lang : 'fr';
};

/** Le thème de la page, comme js/composables/useTheme.js le résout (sombre par défaut). */
const isDark = (root) => {
  const forced = root.getAttribute('data-theme');
  if (forced === 'dark') return true;
  if (forced === 'light') return false;
  return !matchMedia('(prefers-color-scheme: light)').matches;
};

export class ClientsDust {
  /**
   * @param {HTMLElement} band la bande (elle reçoit le curseur et le doigt)
   * @param {HTMLCanvasElement} canvas
   */
  static async start(band, canvas) {
    const root = document.documentElement;
    const lang = pageLang(root);
    const [{ ParticleSilhouette, Shapes }, buffer] = await Promise.all([
      import('./particle-silhouette.js'),
      fetch(`/${taglineFile(lang)}`).then((res) => {
        if (!res.ok) throw new Error(`devise : HTTP ${res.status}`);
        return res.arrayBuffer();
      }),
    ]);
    const phone = matchMedia('(pointer: coarse)').matches;
    const fx = await ParticleSilhouette.create(canvas, {
      budget: phone ? BUDGET.phone : BUDGET.desktop,
      mood: 'dust',
      palette: isDark(root) ? 'gold' : 'goldInk',
      fill: 0.92,
      grainSize: GRAIN_SIZE,
      gain: GAIN,
    });
    const dust = new ClientsDust(fx, band, root);
    // Les grains se rassemblent ; on n'attend pas la fin du mouvement, qui ne court que la bande à l'écran
    fx.setShape(Shapes.baked(buffer, { label: band.dataset.label ?? '' }), { transition: 'gather', duration: 2200 }).catch(() => {});
    band.classList.add('is-ready');
    return dust;
  }

  constructor(fx, band, root) {
    this.fx = fx;
    this.band = band;
    this.root = root;
    // Les écouteurs, liés une fois : aucune fermeture par événement
    this.onPointerMove = (e) => {
      if (e.pointerType === 'touch') return;   // le doigt passe par touchmove, qui laisse la page défiler
      const r = this.band.getBoundingClientRect();
      this.fx.pointerMove(e.clientX - r.left, e.clientY - r.top, false);
      this.markStirred();
    };
    this.onTouch = (e) => {
      const t = e.touches[0];
      if (!t) return;
      const r = this.band.getBoundingClientRect();
      this.fx.pointerMove(t.clientX - r.left, t.clientY - r.top, true);
      this.markStirred();
    };
    this.onLeave = () => this.fx.pointerLeave();
    this.onTheme = () => this.fx.setPalette(isDark(this.root) ? 'gold' : 'goldInk');

    band.addEventListener('pointermove', this.onPointerMove, { passive: true });
    band.addEventListener('pointerleave', this.onLeave, { passive: true });
    band.addEventListener('touchstart', this.onTouch, { passive: true });
    band.addEventListener('touchmove', this.onTouch, { passive: true });
    band.addEventListener('touchend', this.onLeave, { passive: true });
    band.addEventListener('touchcancel', this.onLeave, { passive: true });
    this.themeObserver = new MutationObserver(this.onTheme);
    this.themeObserver.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    this.media = matchMedia('(prefers-color-scheme: light)');
    this.media.addEventListener('change', this.onTheme);
  }

  /** La première fois que la bande est remuée, elle le dit (data-stirred) : les tests le voient, rien d'autre ne s'en sert. */
  markStirred() {
    if (this.stirred) return;
    this.stirred = true;
    this.band.dataset.stirred = '';
  }

  destroy() {
    const b = this.band;
    b.removeEventListener('pointermove', this.onPointerMove);
    b.removeEventListener('pointerleave', this.onLeave);
    for (const type of ['touchstart', 'touchmove']) b.removeEventListener(type, this.onTouch);
    for (const type of ['touchend', 'touchcancel']) b.removeEventListener(type, this.onLeave);
    this.themeObserver.disconnect();
    this.media.removeEventListener('change', this.onTheme);
    this.fx.destroy();
  }
}

/**
 * Lance la devise quand sa bande arrive à l'écran (appelé par js/main.js après le chargement et un temps libre).
 * Sans bande sur la page, ne fait rien.
 */
export function initClientsDust(doc = document) {
  const band = doc.querySelector('.clients-dust');
  const canvas = band?.querySelector('canvas');
  if (!band || !canvas) return;
  const start = () => ClientsDust.start(band, canvas).catch((err) => console.warn('[clients-dust]', err));
  if (!('IntersectionObserver' in window)) { start(); return; }
  const near = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    near.disconnect();
    start();
  });
  near.observe(band);
}
