/**
 * « Sfumato » — le moteur qui joue la partition (score.js) en Web Audio, sans aucun fichier audio (1.12.0).
 * Chargé seulement à la première écoute. Lecture depuis n'importe quelle mesure (chapitres, barre de temps),
 * et rendu hors ligne (OfflineAudioContext) pour l'analyser.
 *
 * Ici : la console de mixage (bus, compression, aigus, limiteur), la réverbération, le délai, le sidechain,
 * les séances de lecture et le transport. Les pupitres sont dans instruments.js, l'arrangement dans
 * arrangement.js (1.12.1).
 */
import { BAR, DURATION, STEP, STEPS_PER_BAR, TAIL, TOTAL_STEPS, snapToBar } from './score.js';
import { createInstruments } from './instruments.js';
import { createArrangement } from './arrangement.js';

/** Hasard à graine (mulberry32) : souffle et réverbération identiques d'une écoute à l'autre */
export function seededRandom(seed = 0x2f6b9a17) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {object} [options]
 * @param {BaseAudioContext} [options.context] contexte audio (OfflineAudioContext pour un rendu hors ligne)
 * @param {() => number} [options.random] hasard à graine
 * @param {number} [options.voices] copies désaccordées par note des ensembles : 2 allège le calcul
 */
export function createEngine({ context, random = seededRandom(), voices = 3 } = {}) {
  const ctx = context ?? new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
  const live = !('startRendering' in ctx);

  // ----- Sortie : bus → compression → limiteur → analyseur → volume → haut-parleurs
  const bus = ctx.createGain(); bus.gain.value = 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.012; comp.release.value = 0.3;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
  const analyser = ctx.createAnalyser(); analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.82;
  const master = ctx.createGain(); master.gain.value = live ? 0 : 0.8;
  // Un peu d'éclat dans les aigus, comme une bande-son de film mixée pour la salle
  const shelf = ctx.createBiquadFilter(); shelf.type = 'highshelf'; shelf.frequency.value = 3200; shelf.gain.value = 5;
  bus.connect(comp); comp.connect(shelf); shelf.connect(limiter); limiter.connect(analyser); analyser.connect(master); master.connect(ctx.destination);

  // ----- Réverbération : réponse impulsionnelle générée, de plus en plus sombre
  const reverb = ctx.createConvolver();
  reverb.buffer = (() => {
    const len = Math.floor(ctx.sampleRate * 5), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let low = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        low += (random() * 2 - 1 - low) * (0.95 - 0.55 * k);
        d[i] = low * (1 - k) ** 2.4 * (i < ctx.sampleRate * 0.012 ? i / (ctx.sampleRate * 0.012) : 1);
      }
    }
    return buf;
  })();
  const reverbIn = ctx.createGain(); reverbIn.gain.value = 0.5;
  reverbIn.connect(reverb); reverb.connect(bus);

  // ----- Délai pointé en ping-pong, filtré dans la réinjection
  const delayIn = ctx.createGain();
  const dl = ctx.createDelay(2); dl.delayTime.value = STEP * 3;
  const dr = ctx.createDelay(2); dr.delayTime.value = STEP * 3;
  const fbl = ctx.createGain(); fbl.gain.value = 0.4;
  const fbr = ctx.createGain(); fbr.gain.value = 0.4;
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2400;
  const merger = ctx.createChannelMerger(2);
  delayIn.connect(tone); tone.connect(dl); dl.connect(fbl); fbl.connect(dr); dr.connect(fbr); fbr.connect(dl);
  dl.connect(merger, 0, 0); dr.connect(merger, 0, 1);
  const delayOut = ctx.createGain(); delayOut.gain.value = 0.55;
  merger.connect(delayOut); delayOut.connect(bus); delayOut.connect(reverbIn);

  // ----- Sidechain : nappes, chœur et basse respirent avec la grosse caisse
  const duck = ctx.createGain(); duck.connect(bus);

  // Souffle partagé (2 s, à graine)
  const noise = (() => {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = random() * 2 - 1;
    return b;
  })();

  /**
   * Une séance de lecture : ses propres entrées vers le bus, la réverbération, le délai et le sidechain.
   * Changer de position coupe l'ancienne séance en douceur, sans couper les queues de réverbération.
   */
  function openSession() {
    const make = (target) => { const g = ctx.createGain(); g.connect(target); return g; };
    return { dry: make(bus), rev: make(reverbIn), del: make(delayIn), duck: make(duck) };
  }
  function closeSession(session, at = ctx.currentTime) {
    for (const g of [session.dry, session.rev, session.del, session.duck]) {
      g.gain.cancelScheduledValues(at);
      g.gain.setValueAtTime(g.gain.value, at);
      g.gain.linearRampToValueAtTime(0, at + 0.12);
    }
    if (live) setTimeout(() => [session.dry, session.rev, session.del, session.duck].forEach((g) => g.disconnect()), 6000);
  }

  /** Branche un pupitre sur la séance : sec (ou sidechain), réverbération, délai, position stéréo */
  function route(session, node, { dry = 1, rev = 0, del = 0, pan = 0, ducked = false } = {}) {
    const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p);
    const g = ctx.createGain(); g.gain.value = dry; p.connect(g); g.connect(ducked ? session.duck : session.dry);
    if (rev) { const r = ctx.createGain(); r.gain.value = rev; p.connect(r); r.connect(session.rev); }
    if (del) { const d = ctx.createGain(); d.gain.value = del; p.connect(d); d.connect(session.del); }
  }

  // ----- Les pupitres (instruments.js) et ce qu'ils jouent (arrangement.js)
  const instruments = createInstruments(ctx, { noise, random, route, duck, step: STEP, voices });
  const { scheduleStep } = createArrangement(instruments);

  // ----- Transport
  let session = null, step = 0, nextTime = 0, origin = 0, pausedAt = 0, playing = false;
  let timer = 0, endTimer = 0, suspendTimer = 0, volume = 0.8;
  const endedListeners = new Set();

  function scheduler() {
    while (nextTime < ctx.currentTime + 0.2 && step < TOTAL_STEPS) {
      scheduleStep(session, step, nextTime);
      nextTime += STEP; step++;
    }
    if (step >= TOTAL_STEPS && !endTimer) endTimer = setTimeout(finish, (nextTime - ctx.currentTime + TAIL) * 1000);
  }

  function halt() {
    clearInterval(timer); clearTimeout(endTimer); clearTimeout(suspendTimer);
    timer = 0; endTimer = 0;
  }

  /** Joue depuis le début de la mesure qui contient `fromSeconds` ; renvoie la position réelle */
  async function play(fromSeconds = 0) {
    const from = snapToBar(fromSeconds);
    halt();
    await ctx.resume();
    if (session) closeSession(session);
    session = { ...openSession(), firstBar: Math.round(from / BAR) };
    step = Math.round(from / STEP);
    nextTime = ctx.currentTime + 0.08;
    origin = nextTime - from;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(volume, now + (playing ? 0.15 : 1.2));
    playing = true;
    timer = setInterval(scheduler, 25);
    scheduler();
    return from;
  }

  function pause() {
    if (!playing) return;
    pausedAt = position();
    playing = false;
    halt();
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 0.6);
    if (session) closeSession(session, now + 0.55);
    session = null;
    suspendTimer = setTimeout(() => { if (!playing) ctx.suspend(); }, 800);
  }

  function finish() {
    playing = false;
    halt();
    if (session) closeSession(session);
    session = null; pausedAt = 0;
    suspendTimer = setTimeout(() => { if (!playing) ctx.suspend(); }, 500);
    endedListeners.forEach((listener) => listener());
  }

  const position = () => (playing ? Math.min(DURATION, Math.max(0, ctx.currentTime - origin)) : pausedAt);

  function setVolume(value) {
    volume = value;
    if (playing) master.gain.setTargetAtTime(value, ctx.currentTime, 0.08);
  }

  /** Hors ligne (OfflineAudioContext) : programme les mesures [fromBar, toBar[, la première à `offset` secondes */
  function renderBars(fromBar = 0, toBar = TOTAL_STEPS / STEPS_PER_BAR, offset = 0.05) {
    session = { ...openSession(), firstBar: fromBar };
    for (let n = fromBar * STEPS_PER_BAR; n < toBar * STEPS_PER_BAR; n++) scheduleStep(session, n, offset + (n - fromBar * STEPS_PER_BAR) * STEP);
  }

  return {
    analyser, play, pause, setVolume, renderBars,
    onEnded(listener) { endedListeners.add(listener); return () => endedListeners.delete(listener); },
    get time() { return position(); },
    get playing() { return playing; },
  };
}
