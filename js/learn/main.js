/**
 * L'entrée de /learn/ (1.19.0), chargée une fois le premier affichage signalé : elle monte l'épisode, son
 * habillage et son lecteur. Avec `?film`, la page ne montre que l'image, plein cadre : la scène et son
 * habillage (titre, ligne d'état, panneaux, sous-titres dans la langue de la page, peints d'après t) ;
 * `?film&captions=off` cache les textes (titre, ligne d'état, sous-titres) pour un film sans langue.
 * Elle expose `window.EPISODE` pour l'outil de tournage : la durée, les temps des sous-titres
 * ({ index, start, whole, end }), `render(t)`, `retime(beats)` (les battements fixés par la voix), `plan`
 * (les battements prévus, que la voix ne raccourcit jamais) et `ready`, la promesse des polices chargées,
 * Clivage comprise. Ce contrat est celui de l'outil de tournage : on y ajoute, on n'y change rien sans le
 * prévenir (test « film : … »).
 */
import { cleanText, textLength } from '../input.js';
import { Direction, PLAN } from './episode01.js';
import { Chrome } from './chrome.js';
import { Episode } from './episode.js';
import { Player } from './player.js';
import { ThemeToggle } from './theme.js';

/** Longueur maximale d'un sous-titre lu dans la page (caractères) : au-delà, il est refusé, pas coupé. */
const CAPTION_MAX = 80;
/** Longueur maximale d'un nom de battement lu dans la page (caractères). */
const BEAT_MAX = 40;
/**
 * Les polices que l'image emploie, avec un texte qui choisit le bon fichier : Barlow (la scène), Clivage
 * et son axe FRAC (titre, sous-titres, numéros, « PAGE ? »). Le film les attend avant sa première image.
 */
const FACES = Object.freeze([['500 20px Barlow', 'a'], ['600 20px Barlow', 'a'], ['700 40px Clivage', 'PAGE ?']]);

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

/** Les noms des battements, ceux des pastilles du lecteur : du texte nettoyé d'une ligne, borné, sinon rien. */
function readBeats(dots) {
  return dots.map((dot) => {
    const text = cleanText(dot.textContent ?? '').trim();
    return textLength(text) <= BEAT_MAX ? text : '';
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
  await Promise.all(FACES.map(([face, sample]) => document.fonts.load(face, sample)));
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
  // Deux réglages dans l'adresse, lus comme une liste fermée : `film` (sa présence suffit) et
  // `captions=off` (seule valeur reconnue ; toute autre est ignorée).
  const params = new URLSearchParams(window.location.search);
  const film = params.has('film');
  const clean = film && params.get('captions') === 'off';
  const createEpisode = () => new Episode({
    svg: root.querySelector('[data-learn-scene]'),
    direction: new Direction(),
    chrome: new Chrome({
      overlay: root.querySelector('[data-learn-overlay]'),
      title: root.querySelector('[data-learn-titlecard]'),
      titleSeries: root.querySelector('[data-learn-titlecard] .learn-titlecard__series'),
      status: root.querySelector('[data-learn-status]'),
      statusBeat: root.querySelector('[data-learn-status-beat]'),
      statusCount: root.querySelector('[data-learn-status-count]'),
      plate: root.querySelector('[data-learn-plate]'),
      caption: root.querySelector('[data-learn-caption]'),
      texts: {
        captions: readCaptions(document.querySelector('[data-learn-captions]')),
        beats: readBeats([...root.querySelectorAll('[data-learn-dot]')]),
      },
    }),
  });

  if (film) {
    const episode = createEpisode();
    document.documentElement.classList.add('learn-film');
    if (clean) document.documentElement.classList.add('learn-film--clean');
    episode.render(0);
    window.EPISODE = Object.freeze({
      get duration() {
        return episode.duration;
      },
      // Les temps des sous-titres ({ index, start, whole, end }, secondes) : `whole`, l'instant où le sous-titre est
      // réparé, ouvre sa fenêtre de lecture ; les fichiers SRT gardent `start`.
      get captions() {
        return Object.freeze(episode.captionTimes.map((caption) => Object.freeze({ ...caption })));
      },
      render: (t) => episode.render(t),
      // Les battements fixés par la voix ([{ id, seconds }], dans l'ordre) : la même scène, chaque moment étiré.
      retime: (beats) => episode.retime(Direction.retimed(beats)),
      // Les battements prévus ([{ id, seconds }], figés) : l'outil calcule le minutage de la voix à partir d'eux.
      plan: PLAN,
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
    // Le titre de la page se répare, comme ceux du site, une fois Clivage arrivée.
    fontsReady().then(() => document.getElementById('learn-title')?.classList.add('is-repairing'), () => {});
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
