import { createApp } from 'vue';
import { createAppI18n } from './i18n/index.js';
import NavBar from './components/NavBar.js';
import ProjectSwiper from './components/ProjectSwiper.js';
import ContactForm from './components/ContactForm.js';
import MusicPlayer from './components/MusicPlayer.js';
import {
  initReveal, initCursor, initTilt, initMagnetic, initClock,
  initProgress, initShards, initGlitch, scramble,
} from './fx/effects.js';

// Îlots Vue : le contenu statique reste dans le HTML (référencement, rendu immédiat),
// les parties interactives sont montées par Vue et traduites par vue-i18n.
const mount = (component, selector) => {
  const el = document.querySelector(selector);
  if (el) createApp(component).use(createAppI18n()).mount(el);
};
mount(NavBar, '#nav-app');
mount(ProjectSwiper, '#projects-app');
mount(ContactForm, '#contact-app');
mount(MusicPlayer, '#music-app');

initReveal();
initClock();
initProgress();
initMagnetic();
initGlitch();
document.querySelectorAll('.hero [data-scramble]').forEach((el, i) => setTimeout(() => scramble(el), 200 + i * 180));

// Effets décoratifs lancés quand le navigateur est disponible (préserve les performances)
const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
idle(() => { initShards(); initCursor(); initTilt(); });
