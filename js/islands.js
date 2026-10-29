import { createApp } from 'vue';
import { createAppI18n } from './i18n/index.js';
import NavBar from './components/NavBar.js';
import ProjectSwiper from './components/ProjectSwiper.js';
import ContactForm from './components/ContactForm.js';
import MusicPlayer from './components/MusicPlayer.js';

// Îlots Vue : le contenu statique reste dans le HTML (référencement, rendu immédiat),
// les parties interactives sont montées par Vue et traduites par vue-i18n.
const mount = (component, selector) => {
  const el = document.querySelector(selector);
  if (el) createApp(component).use(createAppI18n()).mount(el);
};

/** Une étape par tâche : le navigateur affiche et répond entre deux, aucune longue tâche au démarrage. */
const inTurn = (steps) => steps.reduce(
  (previous, step) => previous.then(() => new Promise((done) => setTimeout(() => { step(); done(); }, 0))),
  Promise.resolve(),
);

/** Monte les îlots : l'en-tête et le lecteur (visibles dès l'arrivée), puis ceux du bas de la page. */
export function mountIslands() {
  return inTurn([
    () => mount(NavBar, '#nav-app'),
    () => mount(MusicPlayer, '#music-app'),
    () => mount(ProjectSwiper, '#projects-app'),
    () => mount(ContactForm, '#contact-app'),
  ]);
}
