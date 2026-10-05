import { ref } from 'vue';

const KEY = 'arwd-theme';
const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: light)');

const resolve = () => {
  const forced = root.getAttribute('data-theme');
  if (forced === 'dark') return true;
  if (forced === 'light') return false;
  return !media.matches; // le site est sombre par défaut
};

const isDark = ref(resolve());
media.addEventListener?.('change', () => { isDark.value = resolve(); });

function apply(dark) {
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  isDark.value = dark;
  try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch (e) { /* stockage indisponible */ }
  const meta = document.querySelectorAll('meta[name="theme-color"]');
  meta.forEach((m) => m.setAttribute('content', dark ? '#000000' : '#FBFAF7'));
}

/**
 * Bascule de thème avec l'API View Transitions :
 * le nouveau thème se dévoile en cercle à partir du bouton cliqué.
 */
function toggle(event) {
  const next = !isDark.value;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce) { apply(next); return; }

  const rect = event?.currentTarget?.getBoundingClientRect?.();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 40;
  const y = rect ? rect.top + rect.height / 2 : 36;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

  const t = document.startViewTransition(() => apply(next));
  t.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 750, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' }
    );
  }).catch(() => {});
}

export function useTheme() {
  return { isDark, toggle };
}
