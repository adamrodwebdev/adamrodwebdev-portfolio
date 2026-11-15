/**
 * L'entrée de /learn/ (1.14.0), chargée une fois le premier affichage signalé : elle monte l'épisode et
 * son lecteur. Avec `?film`, la page ne montre que la scène, sans sous-titres (l'habillage du film les
 * dessine par langue), et expose `window.EPISODE` pour l'outil de tournage : la durée, `render(t)` et
 * `ready`, la promesse des polices chargées.
 */
import { cleanText, textLength } from '../input.js';
import { Direction } from './episode01.js';
import { Episode } from './episode.js';
import { Player } from './player.js';
import { ThemeToggle } from './theme.js';

/** Longueur maximale d'un sous-titre lu dans la page (caractères) : au-delà, il est refusé, pas coupé. */
const CAPTION_MAX = 80;
/** Les graisses que la scène emploie : le film les attend avant sa première image. */
const FACES = Object.freeze(['500 20px Barlow', '600 20px Barlow']);

/** Les sous-titres de la page, lus à la porte : du texte nettoyé, borné, sinon rien. */
function readCaptions(list) {
  if (!list) return [];
  return [...list.querySelectorAll('[data-caption]')].map((item) => {
    const text = cleanText(item.textContent ?? '');
    return text && textLength(text) <= CAPTION_MAX ? text : '';
  });
}

/** Attend qu'une condition soit vraie (toutes les 25 ms, 10 s au plus). */
async function until(test) {
  for (let waited = 0; waited < 10_000; waited += 25) {
    const value = test();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Délai dépassé');
}

/** Les polices du site, demandées après le premier affichage : la feuille, puis chaque graisse de la scène. */
async function fontsReady() {
  const sheet = await until(() => document.querySelector('link[rel="stylesheet"][href="/css/fonts.css"]'));
  if (!sheet.sheet) await new Promise((resolve) => sheet.addEventListener('load', resolve, { once: true }));
  await Promise.all(FACES.map((face) => document.fonts.load(face)));
  await document.fonts.ready;
  return true;
}

const root = document.querySelector('[data-learn]');
if (root) {
  // Un seul drapeau possible dans l'adresse : sa présence suffit, sa valeur n'est jamais lue.
  const film = new URLSearchParams(window.location.search).has('film');
  const episode = new Episode({
    svg: root.querySelector('[data-learn-scene]'),
    direction: new Direction(),
    caption: film ? null : root.querySelector('[data-learn-caption]'),
    captions: readCaptions(document.querySelector('[data-learn-captions]')),
  });

  if (film) {
    document.documentElement.classList.add('learn-film');
    episode.render(0);
    window.EPISODE = Object.freeze({
      duration: episode.duration,
      render: (t) => episode.render(t),
      ready: fontsReady(),
    });
  } else {
    const play = root.querySelector('[data-learn-play]');
    const player = new Player({
      episode,
      ui: {
        play,
        playLabel: play.querySelector('span'),
        back: root.querySelector('[data-learn-back]'),
        next: root.querySelector('[data-learn-next]'),
        dots: [...root.querySelectorAll('[data-learn-dot]')],
      },
      clock: {
        now: () => performance.now(),
        frame: (callback) => requestAnimationFrame(callback),
        cancel: (id) => cancelAnimationFrame(id),
      },
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      labels: { play: play.dataset.play, pause: play.dataset.pause, replay: play.dataset.replay },
    });
    player.mount();
    root.classList.add('is-ready');
  }

  const themeButton = document.querySelector('[data-theme-toggle]');
  if (themeButton) {
    let storage = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    new ThemeToggle({
      button: themeButton,
      root: document.documentElement,
      prefersLight: window.matchMedia('(prefers-color-scheme: light)'),
      storage,
      metas: [...document.querySelectorAll('meta[name="theme-color"]')],
    }).mount();
  }
}
