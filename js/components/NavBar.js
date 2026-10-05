import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useTheme } from '../composables/useTheme.js';

const links = [
  { id: 'services', label: 'Services' },
  { id: 'projets', label: 'Projets' },
  { id: 'methode', label: 'Méthode' },
  { id: 'contact', label: 'Contact' },
];

export default {
  name: 'NavBar',
  setup() {
    const open = ref(false);
    const active = ref('');
    const { isDark, toggle } = useTheme();
    const burger = ref(null);
    let observer;

    const onScroll = () => {
      document.querySelector('.site-header')?.classList.toggle('is-scrolled', window.scrollY > 24);
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && open.value) {
        open.value = false;
        burger.value?.focus();
      }
    };

    watch(open, async (v) => {
      document.documentElement.style.overflow = v ? 'hidden' : '';
      if (v) {
        await nextTick();
        document.querySelector('.mobile-menu a')?.focus({ preventScroll: true });
      }
    });

    onMounted(() => {
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('keydown', onKey);
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => { if (en.isIntersecting) active.value = en.target.id; });
        },
        { rootMargin: '-45% 0px -50% 0px' }
      );
      ['accueil', ...links.map((l) => l.id)].forEach((id) => {
        const el = document.getElementById(id);
        if (el) observer.observe(el);
      });
    });
    onBeforeUnmount(() => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
      observer?.disconnect();
    });

    const go = () => { open.value = false; };
    return { links, open, active, isDark, toggle, go, burger };
  },
  template: `
  <nav class="nav container" aria-label="Navigation principale">
    <a class="brand" href="#accueil" aria-label="AdamRodWebDev, retour à l'accueil" @click="go">
      <svg class="brand__mark" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3 42 13.5v21L24 45 6 34.5v-21Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15 33 24 13l9 20M19 26h10" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>
      <span class="brand__name">AdamRod<b>WebDev</b></span>
    </a>
    <ul class="nav__links">
      <li v-for="l in links" :key="l.id">
        <a class="nav__link" :class="{ 'is-active': active === l.id }" :href="'#' + l.id" :aria-current="active === l.id ? 'location' : null">{{ l.label }}</a>
      </li>
    </ul>
    <div class="nav__tools">
      <button class="icon-btn" :class="{ 'is-dark': isDark }" type="button" @click="toggle($event)"
        :aria-label="isDark ? 'Activer le mode clair' : 'Activer le mode sombre'" :aria-pressed="isDark ? 'true' : 'false'">
        <svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
          <mask id="moon-mask"><rect width="24" height="24" fill="#fff"/><circle class="theme-icon__mask-circle" :cx="isDark ? 17 : 30" :cy="isDark ? 7 : -6" r="7" fill="#000"/></mask>
          <circle class="theme-icon__core" cx="12" cy="12" :r="isDark ? 8 : 5" fill="currentColor" mask="url(#moon-mask)"/>
          <g class="theme-icon__rays" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"/>
          </g>
        </svg>
      </button>
      <button ref="burger" class="icon-btn burger" type="button" @click="open = !open"
        :aria-expanded="open ? 'true' : 'false'" aria-controls="menu-mobile" :aria-label="open ? 'Fermer le menu' : 'Ouvrir le menu'">
        <span class="burger__bars" aria-hidden="true"><span></span><span></span><span></span></span>
      </button>
    </div>
  </nav>
  <Teleport to="body">
  <div id="menu-mobile" class="mobile-menu" :class="{ 'is-open': open }" :inert="!open || null">
    <ul>
      <li v-for="(l, i) in links" :key="l.id"><a :href="'#' + l.id" :style="{ '--i': i }" :class="{ 'is-active': active === l.id }" @click="go">{{ l.label }}</a></li>
    </ul>
    <p class="mobile-menu__foot">AdamRodWebDev, développement web front-end.</p>
  </div>
  </Teleport>
  `,
};
