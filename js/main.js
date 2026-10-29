import {
  initReveal, initCursor, initTilt, initMagnetic, initClock,
  initProgress, initShards, initGlitch, scramble,
} from './fx/effects.js';

// Les effets d'abord, sans attendre Vue : si le CDN ne répond pas, les sections apparaissent quand même.
initReveal();
initClock();
initProgress();
initMagnetic();
initGlitch();
document.querySelectorAll('.hero [data-scramble]').forEach((el, i) => setTimeout(() => scramble(el), 200 + i * 180));

// Les îlots Vue (Vue et vue-i18n viennent du CDN), chacun dans sa propre tâche.
import('./islands.js').then(({ mountIslands }) => mountIslands());

// Effets décoratifs lancés quand le navigateur est disponible (préserve les performances)
const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
const afterLoad = (fn) => (document.readyState === 'complete' ? fn() : addEventListener('load', fn, { once: true }));
afterLoad(() => idle(() => { initShards(); initCursor(); initTilt(); }));
