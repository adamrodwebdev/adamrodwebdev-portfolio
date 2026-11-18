/**
 * Le bouton de thème des pages générées sans Vue (1.19.0), le même comportement que celui de l'accueil
 * (useTheme) et de /lumirift/ : sombre ou clair, mémorisé, et la couleur de la barre du navigateur suivie.
 */
export class ThemeToggle {
  /**
   * @param {{ button: HTMLButtonElement, root: HTMLElement, prefersLight: MediaQueryList, storage: Storage | null,
   *   metas: readonly HTMLMetaElement[] }} parts
   */
  constructor({ button, root, prefersLight, storage, metas }) {
    this.button = button;
    this.root = root;
    this.prefersLight = prefersLight;
    this.storage = storage;
    this.metas = metas;
  }

  isDark() {
    const forced = this.root.getAttribute('data-theme');
    return forced ? forced === 'dark' : !this.prefersLight.matches;
  }

  mount() {
    this.button.addEventListener('click', () => this.toggle());
    this.prefersLight.addEventListener?.('change', () => this.paint());
    this.paint();
  }

  toggle() {
    const dark = !this.isDark();
    this.root.setAttribute('data-theme', dark ? 'dark' : 'light');
    try {
      this.storage?.setItem('arwd-theme', dark ? 'dark' : 'light');
    } catch {
      // Stockage refusé (navigation privée stricte) : le thème vaut pour cette visite.
    }
    this.metas.forEach((meta) => meta.setAttribute('content', dark ? '#000000' : '#FBFAF7'));
    this.paint();
  }

  paint() {
    const dark = this.isDark();
    const { button } = this;
    button.classList.toggle('is-dark', dark);
    button.setAttribute('aria-pressed', dark ? 'true' : 'false');
    button.setAttribute('aria-label', dark ? button.dataset.toLight : button.dataset.toDark);
    const mask = button.querySelector('.theme-icon__mask-circle');
    mask?.setAttribute('cx', dark ? '17' : '30');
    mask?.setAttribute('cy', dark ? '7' : '-6');
    button.querySelector('.theme-icon__core')?.setAttribute('r', dark ? '8' : '5');
  }
}
