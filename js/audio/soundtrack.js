import { computed, reactive } from 'vue';
import { DURATION, SECTIONS, TITLE, sectionIndexAt, snapToBar } from './score.js';

/**
 * La bande-son du site (1.12.0) : un seul état, partagé par l'interrupteur de l'en-tête et le lecteur de la
 * section « Bande-son ». Créée par la racine de composition (islands.js) et fournie aux îlots qui s'en servent.
 * Le moteur (sfumato.js) n'est téléchargé qu'à la première écoute : rien ne pèse au chargement de la page.
 *
 * @param {object} [options]
 * @param {() => Promise<{ createEngine: Function }>} [options.loadEngine] chargement du moteur (remplaçable en test)
 * @param {MediaSession | undefined} [options.mediaSession] commandes du système (écran verrouillé, touches multimédia)
 * @param {(callback: FrameRequestCallback) => number} [options.requestFrame]
 * @param {(handle: number) => void} [options.cancelFrame]
 */
export function createSoundtrack({
  loadEngine = () => import('./sfumato.js'),
  mediaSession = globalThis.navigator?.mediaSession,
  requestFrame = (callback) => requestAnimationFrame(callback),
  cancelFrame = (handle) => cancelAnimationFrame(handle),
} = {}) {
  const state = reactive({ playing: false, loading: false, failed: false, time: 0, volume: 0.8 });
  /** La partie en cours, -1 tant que rien n'a été écouté */
  const chapter = computed(() => (state.playing || state.time > 0 ? sectionIndexAt(state.time) : -1));
  let engine = null;
  let frame = 0;

  async function ensureEngine() {
    if (engine) return engine;
    state.loading = true;
    try {
      const { createEngine } = await loadEngine();
      engine = createEngine();
      engine.setVolume(state.volume);
      engine.onEnded(() => {
        state.playing = false;
        state.time = 0;
        cancelFrame(frame);
        syncSystem();
      });
      bindSystem();
      return engine;
    } finally {
      state.loading = false;
    }
  }

  /** Suit la position pendant l'écoute, quatre fois par seconde pour l'affichage */
  function follow() {
    const quarter = Math.floor(engine.time * 4) / 4;
    if (quarter !== state.time) state.time = quarter;
    frame = requestFrame(follow);
  }

  async function play(from = state.time) {
    if (state.loading) return;
    try {
      const player = await ensureEngine();
      state.time = await player.play(from >= DURATION - 1 ? 0 : from);
      state.playing = true;
      state.failed = false;
      cancelFrame(frame);
      follow();
      syncSystem();
    } catch {
      state.failed = true;
      state.playing = false;
    }
  }

  function pause() {
    if (!engine || !state.playing) return;
    engine.pause();
    state.playing = false;
    cancelFrame(frame);
    state.time = engine.time;
    syncSystem();
  }

  const toggle = () => (state.playing ? pause() : play());

  /** Va à un instant (ramené au début de sa mesure) ; continue de jouer si la lecture était en cours */
  async function seek(seconds) {
    const at = snapToBar(Math.min(Math.max(0, seconds), DURATION));
    if (state.playing) await play(at);
    else state.time = at;
  }

  function setVolume(value) {
    state.volume = value;
    engine?.setVolume(value);
  }

  const analyser = () => engine?.analyser ?? null;

  /** Titre, état et commandes affichés par le système (écran verrouillé, casque, touches multimédia) */
  function bindSystem() {
    if (!mediaSession) return;
    const handlers = {
      play: () => play(),
      pause: () => pause(),
      seekto: (details) => seek(details.seekTime ?? 0),
      previoustrack: () => seek(SECTIONS[Math.max(0, sectionIndexAt(state.time) - 1)].start),
      nexttrack: () => seek(SECTIONS[Math.min(SECTIONS.length - 1, sectionIndexAt(state.time) + 1)].start),
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try { mediaSession.setActionHandler(action, handler); } catch { /* action inconnue de ce navigateur */ }
    }
  }
  function syncSystem() {
    if (!mediaSession) return;
    if (typeof MediaMetadata !== 'undefined' && !mediaSession.metadata) {
      mediaSession.metadata = new MediaMetadata({
        title: TITLE,
        artist: 'AdamRodWebDev',
        artwork: [{ src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png' }],
      });
    }
    mediaSession.playbackState = state.playing ? 'playing' : 'paused';
  }

  return { state, chapter, sections: SECTIONS, duration: DURATION, title: TITLE, play, pause, toggle, seek, setVolume, analyser };
}
