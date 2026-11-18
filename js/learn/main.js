/**
 * L'entrée de /learn/ (1.19.0), chargée une fois le premier affichage signalé : elle monte l'épisode et
 * son lecteur. Avec `?film`, la page ne montre que la scène, sans sous-titres (l'habillage du film les
 * dessine par langue), et expose `window.EPISODE` pour l'outil de tournage : la durée, les temps des
 * sous-titres, `render(t)`, `retime(beats)` (les battements fixés par la voix) et `ready`, la promesse
 * des polices chargées.
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

/** Les retours à la ligne et tabulations : un sous-titre tient en une phrase, il n'en a aucun. */
const BREAKS = /[\t\n\v\f\r\u2028\u2029]/u;

/**
 * Les sous-titres de la page, lus à la porte : du texte nettoyé, borné, sinon rien. Les espaces
 * insécables restent (« Internet : », « page ? ») : le nettoyage d'une ligne les changerait en espaces
 * simples, et le sous-titre pourrait se couper avant ses deux-points. Le texte est donc nettoyé comme un
 * texte de plusieurs lignes, puis refusé s'il en a plusieurs ; les espaces simples répétées n'en font qu'une.
 */
function readCaptions(list) {
  if (!list) return [];
  return [...list.querySelectorAll('[data-caption]')].map((item) => {
    const text = cleanText(item.textContent ?? '', true).replace(/ {2,}/g, ' ');
    return text && !BREAKS.test(text) && textLength(text) <= CAPTION_MAX ? text : '';
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

/** Le plus long que la page attend ses polices avant de monter la scène (ms) : au-delà, le repli suffit. */
const FONTS_WAIT = 3000;

/**
 * La page attend ses polices, puis une tâche, avant de monter la scène. La page se remet en page quand
 * Barlow arrive, et la scène se met en page à son montage : dans une même tâche, les deux dépassaient
 * 100 ms sur un téléphone lent (Lighthouse : temps de blocage, 99 au lieu de 100). Séparées, chacune
 * reste sous 50 ms, et la scène n'est mise en page qu'une fois, déjà dans sa police.
 */
async function sceneTurn() {
  await Promise.race([fontsReady().catch(() => false), new Promise((resolve) => setTimeout(resolve, FONTS_WAIT))]);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const root = document.querySelector('[data-learn]');
if (root) {
  // Un seul drapeau possible dans l'adresse : sa présence suffit, sa valeur n'est jamais lue.
  const film = new URLSearchParams(window.location.search).has('film');
  const createEpisode = () => new Episode({
    svg: root.querySelector('[data-learn-scene]'),
    direction: new Direction(),
    caption: film ? null : root.querySelector('[data-learn-caption]'),
    captions: readCaptions(document.querySelector('[data-learn-captions]')),
  });

  if (film) {
    const episode = createEpisode();
    document.documentElement.classList.add('learn-film');
    episode.render(0);
    window.EPISODE = Object.freeze({
      get duration() {
        return episode.duration;
      },
      // Les temps des sous-titres ({ index, start, end }, secondes) : l'habillage du film les dessine par langue.
      get captions() {
        return Object.freeze(episode.captionTimes.map((caption) => Object.freeze({ ...caption })));
      },
      render: (t) => episode.render(t),
      // Les battements fixés par la voix ([{ id, seconds }], dans l'ordre) : la même scène, chaque moment étiré.
      retime: (beats) => episode.retime(Direction.retimed(beats)),
      ready: fontsReady(),
    });
  } else {
    // Sans attendre au niveau du module : le bouton de thème, plus bas, se monte tout de suite.
    sceneTurn().then(() => {
      const episode = createEpisode();
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
    });
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
