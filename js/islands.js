import { createApp } from 'vue';
import { createAppI18n, loadMessages } from './i18n/index.js';
import NavBar from './components/NavBar.js';
import ProjectSwiper from './components/ProjectSwiper.js';
import ContactForm from './components/ContactForm.js';
import SoundtrackPlayer from './components/SoundtrackPlayer.js';
import { createSoundtrack } from './audio/soundtrack.js';
import { PROJECT_GROUPS } from './data/projects.js';

// Îlots Vue : le contenu statique reste dans le HTML (référencement, rendu immédiat),
// les parties interactives sont montées par Vue et traduites par vue-i18n.
const mount = (component, selector, messages, provided = {}) => {
  const el = document.querySelector(selector);
  if (!el) return;
  const app = createApp(component).use(createAppI18n(messages));
  for (const [key, value] of Object.entries(provided)) app.provide(key, value);
  app.mount(el);
};

/**
 * Monte un îlot quand son élément approche de l'écran (1.17.0), une fois et demie la hauteur de la fenêtre
 * avant d'y arriver : les deux carrousels, quatre à sept écrans sous l'arrivée, ne pèsent plus sur le
 * démarrage, et leur remplacement de la liste statique se fait hors de la vue (aucun saut visible).
 */
const mountNear = (component, selector, messages, provided) => {
  const el = document.querySelector(selector);
  if (!el) return;
  if (!('IntersectionObserver' in window)) { mount(component, selector, messages, provided); return; }
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    io.disconnect();
    setTimeout(() => mount(component, selector, messages, provided), 0);
  }, { rootMargin: '150% 0px' });
  io.observe(el);
};

/** Une étape par tâche : le navigateur affiche et répond entre deux, aucune longue tâche au démarrage. */
const inTurn = (steps) => steps.reduce(
  (previous, step) => previous.then(() => new Promise((done) => setTimeout(() => { step(); done(); }, 0))),
  Promise.resolve(),
);

/**
 * Monte les îlots avec les textes de la langue de la page : l'en-tête d'abord (visible dès l'arrivée), puis
 * ceux du bas de la page. Racine de composition : la bande-son est créée ici, une seule fois, et fournie à
 * l'en-tête (son interrupteur) comme au lecteur de la section « Bande-son ».
 */
export async function mountIslands() {
  const messages = await loadMessages();
  // Un appareil modeste (4 cœurs ou moins) joue les ensembles à deux voix par note au lieu de trois
  const soundtrack = createSoundtrack({ engineOptions: { voices: (navigator.hardwareConcurrency || 8) <= 4 ? 2 : 3 } });
  return inTurn([
    () => mount(NavBar, '#nav-app', messages, { soundtrack }),
    // Deux carrousels (1.17.0), chacun à l'approche de sa section (1.18.1) : monté au démarrage, celui des
    // réalisations mettait en page ses diapositives dans la même tâche, la plus longue du chargement sur mobile.
    () => mountNear(ProjectSwiper, PROJECT_GROUPS.work, messages, { projectGroup: 'work' }),
    () => mountNear(ProjectSwiper, PROJECT_GROUPS.lab, messages, { projectGroup: 'lab' }),
    () => mount(SoundtrackPlayer, '#soundtrack-app', messages, { soundtrack }),
    () => mount(ContactForm, '#contact-app', messages),
  ]);
}
