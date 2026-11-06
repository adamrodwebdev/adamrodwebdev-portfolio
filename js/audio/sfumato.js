/**
 * « Sfumato » — le moteur qui joue la partition (score.js) en Web Audio, sans aucun fichier audio (1.12.0).
 * Chargé seulement à la première écoute. Lecture depuis n'importe quelle mesure (chapitres, barre de temps),
 * et rendu hors ligne (OfflineAudioContext) pour l'analyser.
 *
 * Pupitres : pulsation staccato à délai pointé, nappes analogiques, chœur et voix sans paroles (formants),
 * basse et sub en sidechain, cloche FM, percussions de film en demi-temps, souffle filtré.
 */
import {
  BAR, CHORDS, DURATION, GRID, MELODY, STEP, STEPS_PER_BAR, TAIL, TOTAL_STEPS, sectionAt, snapToBar,
} from './score.js';

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

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

/** Formants d'une voix : [fréquence, gain, Q] pour « a » et « o » */
const VOWEL_A = [[780, 1, 9], [1180, 0.5, 10], [2800, 0.22, 12]];
const VOWEL_O = [[480, 1, 9], [860, 0.45, 10], [2600, 0.12, 12]];

export function createEngine({ context, random = seededRandom() } = {}) {
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

  const envelope = (g, t, { peak, attack, hold, release }) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + Math.max(attack, hold));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack, hold) + release);
    return t + Math.max(attack, hold) + release + 0.05;
  };

  /** Son tenu : montée linéaire, puis extinction continue (pas de creux entre deux accords qui se relaient) */
  const swell = (g, t, { peak, attack, hold, release }) => {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + Math.max(attack, hold));
    g.gain.setTargetAtTime(0, t + Math.max(attack, hold), release / 4);
    return t + Math.max(attack, hold) + release * 1.3;
  };

  // ----- Pupitres
  function pad(s, t, notes, dur, { bright, level }) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.6;
    f.frequency.setValueAtTime(320 + bright * 500, t);
    f.frequency.linearRampToValueAtTime(700 + bright * 1900, t + dur * 0.55);
    f.frequency.linearRampToValueAtTime(420 + bright * 700, t + dur + 1.5);
    const g = ctx.createGain(); f.connect(g);
    const end = swell(g, t, { peak: 0.03 * level, attack: 0.9, hold: dur, release: 1.6 });
    route(s, g, { rev: 0.55, ducked: true });
    notes.forEach((m, i) => [-7, 7].forEach((cents, k) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = cents + (i - 2) * 1.3;
      const p = ctx.createStereoPanner(); p.pan.value = (k ? 1 : -1) * (0.2 + i * 0.12);
      o.connect(p); p.connect(f); o.start(t); o.stop(end);
    }));
  }

  /** Chœur sans paroles : scies désaccordées dans un banc de formants « a » */
  function choir(s, t, notes, dur, level) {
    const sum = ctx.createGain();
    const g = ctx.createGain();
    VOWEL_A.forEach(([freq, gain, q]) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
      const bg = ctx.createGain(); bg.gain.value = gain * 3.2; sum.connect(bp); bp.connect(bg); bg.connect(g);
    });
    const end = swell(g, t, { peak: 0.05 * level, attack: 1.2, hold: dur, release: 2 });
    route(s, g, { rev: 0.8, dry: 0.7, ducked: true });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 4.6;
    const depth = ctx.createGain(); depth.gain.value = 9; lfo.connect(depth);
    notes.forEach((m, i) => [-11, 0, 12].forEach((cents) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = cents + i * 2;
      depth.connect(o.detune); o.connect(sum); o.start(t); o.stop(end);
    }));
    lfo.start(t); lfo.stop(end);
  }

  /** La voix : une note tenue, du « o » vers le « a », vibrato qui arrive, un peu de souffle */
  function voice(s, t, m, dur, level = 1) {
    const f0 = mtof(m);
    const saw = ctx.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = f0;
    const tri = ctx.createOscillator(); tri.type = 'triangle'; tri.frequency.value = f0; tri.detune.value = 4;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.4;
    const vibDepth = ctx.createGain();
    vibDepth.gain.setValueAtTime(0, t); vibDepth.gain.linearRampToValueAtTime(16, t + Math.min(dur, 0.9));
    vib.connect(vibDepth); vibDepth.connect(saw.detune); vibDepth.connect(tri.detune);
    const src = ctx.createGain(); saw.connect(src); tri.connect(src);
    const g = ctx.createGain();
    VOWEL_O.forEach(([freq, gain, q], i) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(freq, t); bp.frequency.linearRampToValueAtTime(VOWEL_A[i][0], t + Math.min(dur, 1.2));
      const bg = ctx.createGain(); bg.gain.value = gain * 3; src.connect(bp); bp.connect(bg); bg.connect(g);
    });
    const breath = ctx.createBufferSource(); breath.buffer = noise; breath.loop = true;
    const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 2400; bf.Q.value = 1.2;
    const bgain = ctx.createGain(); bgain.gain.value = 0.05; breath.connect(bf); bf.connect(bgain); bgain.connect(g);
    const end = swell(g, t, { peak: 0.09 * level, attack: 0.14, hold: dur, release: 0.8 });
    route(s, g, { rev: 0.6, del: 0.22, pan: 0.05 });
    [saw, tri, vib].forEach((o) => { o.start(t); o.stop(end); });
    breath.start(t, random() * 1.5); breath.stop(end);
  }

  function pulse(s, t, m, { open, level, pan }) {
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(m);
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = mtof(m); o2.detune.value = 6;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(open * 1.5, t); f.frequency.exponentialRampToValueAtTime(Math.max(180, open * 0.3), t + 0.14);
    const g = ctx.createGain(); o.connect(f); o2.connect(f); f.connect(g);
    const end = envelope(g, t, { peak: 0.05 * level, attack: 0.004, hold: 0.02, release: 0.16 });
    route(s, g, { del: 0.4, rev: 0.15, pan });
    o.start(t); o2.start(t); o.stop(end); o2.stop(end);
  }

  /** Cloche de verre : modulation de fréquence inharmonique qui s'éteint */
  function bell(s, t, m, level = 1) {
    const fc = mtof(m);
    const car = ctx.createOscillator(); car.frequency.value = fc;
    const mod = ctx.createOscillator(); mod.frequency.value = fc * 3.51;
    const idx = ctx.createGain(); idx.gain.setValueAtTime(fc * 1.6, t); idx.gain.exponentialRampToValueAtTime(fc * 0.05, t + 1.6);
    mod.connect(idx); idx.connect(car.frequency);
    const g = ctx.createGain(); car.connect(g);
    const end = envelope(g, t, { peak: 0.045 * level, attack: 0.003, hold: 0.01, release: 2.6 });
    route(s, g, { rev: 0.7, del: 0.45, pan: 0.3 * Math.sin(m) });
    car.start(t); mod.start(t); car.stop(end); mod.stop(end);
  }

  function bass(s, t, m, len, { level, cutoff }) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m);
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = mtof(m - 12);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(120, t + len);
    const sg = ctx.createGain(); sg.gain.value = 1.1;
    const g = ctx.createGain(); o.connect(f); f.connect(g); sub.connect(sg); sg.connect(g);
    const end = envelope(g, t, { peak: 0.13 * level, attack: 0.008, hold: len * 0.5, release: len * 0.6 });
    route(s, g, { ducked: true });
    o.start(t); sub.start(t); o.stop(end); sub.stop(end);
  }

  /** Pédale grave tenue : le mi à 82 Hz (audible aussi sur un téléphone), son octave, le mi très grave en soutien */
  function pedal(s, t, m, dur, level) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 0.7;
    const g = ctx.createGain(); f.connect(g);
    [[m, 'sawtooth', 0.5], [m - 12, 'sine', 0.35], [m + 12, 'triangle', 0.18]].forEach(([note, type, gain]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = mtof(note);
      const og = ctx.createGain(); og.gain.value = gain; o.connect(og); og.connect(f);
      o.start(t); o.stop(t + dur + 2);
    });
    swell(g, t, { peak: 0.16 * level, attack: 0.6, hold: dur, release: 1 });
    route(s, g, { ducked: true, rev: 0.1 });
  }

  /** Cordes aiguës de l'apogée : scies désaccordées, brillantes, en nappe */
  function strings(s, t, notes, dur, level) {
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 380;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 8000;
    const g = ctx.createGain(); hp.connect(lp); lp.connect(g);
    const end = swell(g, t, { peak: 0.022 * level, attack: 0.7, hold: dur, release: 1.4 });
    route(s, g, { rev: 0.7, del: 0.1, dry: 0.9 });
    notes.forEach((m, i) => [-12, 0, 12].forEach((cents, k) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = cents + i;
      const p = ctx.createStereoPanner(); p.pan.value = (k - 1) * 0.6;
      o.connect(p); p.connect(hp); o.start(t); o.stop(end);
    }));
  }

  /** Souffle de fond : bruit filtré qui ondule lentement */
  function air(s, t, dur, level) {
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.5;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const depth = ctx.createGain(); depth.gain.value = 380; lfo.connect(depth); depth.connect(f.frequency);
    f.frequency.value = 700;
    const g = ctx.createGain(); src.connect(f); f.connect(g);
    const end = swell(g, t, { peak: 0.03 * level, attack: 0.8, hold: dur, release: 1 });
    route(s, g, { rev: 0.4, pan: -0.2 });
    src.start(t, random() * 1.5); lfo.start(t); src.stop(end); lfo.stop(end);
  }

  function kick(s, t, level = 1) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const g = ctx.createGain(); o.connect(g);
    const end = envelope(g, t, { peak: 0.75 * level, attack: 0.002, hold: 0.01, release: 0.5 });
    route(s, g, { rev: 0.08 });
    o.start(t); o.stop(end);
    duck.gain.cancelScheduledValues(t);
    duck.gain.setValueAtTime(0.3, t); duck.gain.linearRampToValueAtTime(1, t + STEP * 3.5);
  }

  function snare(s, t, level = 1) {
    const n = ctx.createBufferSource(); n.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.7;
    const g = ctx.createGain(); n.connect(f); f.connect(g);
    const end = envelope(g, t, { peak: 0.3 * level, attack: 0.002, hold: 0.01, release: 0.32 });
    route(s, g, { rev: 0.9 });
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(130, t + 0.1);
    const og = ctx.createGain(); o.connect(og);
    envelope(og, t, { peak: 0.22 * level, attack: 0.002, hold: 0.01, release: 0.16 });
    route(s, og, { rev: 0.4 });
    n.start(t, random()); n.stop(end); o.start(t); o.stop(end);
  }

  /** Tambour grave de film, frappé à la main */
  function tom(s, t, m, level = 1) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(mtof(m) * 1.8, t); o.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.09);
    const g = ctx.createGain(); o.connect(g);
    const end = envelope(g, t, { peak: 0.45 * level, attack: 0.003, hold: 0.02, release: 0.9 });
    route(s, g, { rev: 0.5, pan: (m % 3 - 1) * 0.3 });
    o.start(t); o.stop(end);
  }

  function hat(s, t, level) {
    const n = ctx.createBufferSource(); n.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7800;
    const g = ctx.createGain(); n.connect(f); f.connect(g);
    const end = envelope(g, t, { peak: 0.07 * level, attack: 0.001, hold: 0.005, release: 0.06 });
    route(s, g, { pan: 0.35, rev: 0.06 });
    n.start(t, random()); n.stop(end);
  }

  /** Cymbale : souffle aigu qui s'éteint lentement */
  function cymbal(s, t, level = 1) {
    const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5500;
    const g = ctx.createGain(); n.connect(f); f.connect(g);
    const end = envelope(g, t, { peak: 0.06 * level, attack: 0.004, hold: 0.02, release: 1.8 });
    route(s, g, { rev: 0.35, pan: -0.3 });
    n.start(t, random()); n.stop(end);
  }

  /** Impact grave au début d'une partie */
  function impact(s, t, level = 1) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.4);
    const g = ctx.createGain(); o.connect(g);
    const end = envelope(g, t, { peak: 0.6 * level, attack: 0.003, hold: 0.05, release: 2.6 });
    route(s, g, { rev: 0.5 });
    const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(300, t + 2);
    const ng = ctx.createGain(); n.connect(f); f.connect(ng);
    envelope(ng, t, { peak: 0.12 * level, attack: 0.004, hold: 0.02, release: 2.4 });
    route(s, ng, { rev: 0.9 });
    o.start(t); o.stop(end); n.start(t, random()); n.stop(end);
  }

  function riser(s, t, dur) {
    const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
    f.frequency.setValueAtTime(250, t); f.frequency.exponentialRampToValueAtTime(6500, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.03);
    n.connect(f); f.connect(g); route(s, g, { rev: 0.5 });
    n.start(t, random()); n.stop(t + dur + 0.05);
  }

  // ----- Arrangement : ce que joue chaque double croche
  const PULSE = [0, 12, 0, 7, 0, 12, 7, 12];
  const PHRASES = { ascent: ['A', 'B', 'A', 'B'], apex: ['C', 'C', 'C'] };
  const notesAt = (phrase, bar, s) => MELODY[phrase].filter(([b, st]) => b === bar && st === s);

  /** Nombre de mesures où l'accord de `bar` reste le même, sans sortir de sa partie */
  function runFrom(bar) {
    const { index } = sectionAt(bar);
    let end = bar + 1;
    while (end < GRID.length && GRID[end] === GRID[bar] && sectionAt(end).index === index) end++;
    return end - bar;
  }
  /** Un accord tenu ne se rejoue pas à chaque mesure : seulement quand il change, ou là où la lecture reprend */
  const startsRun = (session, bar) => bar === session.firstBar || GRID[bar - 1] !== GRID[bar]
    || sectionAt(bar - 1).index !== sectionAt(bar).index;

  function scheduleStep(session, n, t) {
    const bar = Math.floor(n / STEPS_PER_BAR), s = n % STEPS_PER_BAR;
    const chord = CHORDS[GRID[bar]];
    const { key, pos, bars } = sectionAt(bar);
    const last = pos === bars - 1;
    const root = chord.bass + 12;
    const held = s === 0 && startsRun(session, bar) ? runFrom(bar) * BAR : 0;
    const top3 = chord.pad.slice(-3).map((m) => m + 12);
    const side = s % 4 ? 0.4 : -0.4;

    if (key === 'awakening') {
      if (held) {
        pad(session, t, chord.pad, held, { bright: 0.12 + pos * 0.03, level: 0.55 + pos * 0.04 });
        air(session, t, held, 1.3);
      }
      if (s === 0 && pos >= 2 && pos % 2 === 0) [0, 6, 8].forEach((st, i) => bell(session, t + st * STEP, chord.bell[i], 0.6));
      if (s === 0 && last) riser(session, t, BAR);
      if (s % 2 === 0) pulse(session, t, root + PULSE[s / 2], { open: 320 + pos * 110, level: 0.8, pan: side });
    }

    if (key === 'signal') {
      if (s === 0 && pos === 0) impact(session, t, 0.7);
      if (held) {
        pad(session, t, chord.pad, held, { bright: 0.3, level: 0.75 });
        pedal(session, t, 40, held, 1);
        air(session, t, held, 0.7);
      }
      if (s === 0 && pos % 4 === 0) bell(session, t, chord.bell[0], 0.55);
      if (s === 0 && pos >= 8) kick(session, t, 0.55);
      if (s === 8 && pos >= 12) snare(session, t, 0.45);
      if (s === 0 && last) riser(session, t, BAR);
      if (s % 2 === 0) pulse(session, t, root + PULSE[s / 2], { open: 1400 + pos * 45, level: 0.75, pan: side });
      for (const [, , m, len] of notesAt('S', pos, s)) voice(session, t, m, len * STEP, 0.85);
    }

    if (key === 'ascent') {
      const p = Math.floor(pos / 8), pb = pos % 8;
      if (s === 0 && pos === 0) impact(session, t, 0.8);
      if (held) {
        pad(session, t, chord.pad, held, { bright: 0.45 + p * 0.12, level: 0.7 });
        if (p >= 1) choir(session, t, top3, held, 0.3 + p * 0.1);
      }
      if (s === 0 && p === 0 && pb % 2 === 0) bell(session, t, chord.bell[0], 0.55);
      if (s === 0 && last) riser(session, t, BAR);
      if (s === 0 && p >= 2 && pb === 0) cymbal(session, t, 0.6);
      if (s % 2 === 0) bass(session, t, chord.bass + (s === 6 || s === 14 ? 12 : 0), STEP * 1.7, { level: 0.7 + p * 0.07, cutoff: 600 + p * 130 });
      if (s === 0 || s === 10) kick(session, t, 0.7 + p * 0.05);
      if (s === 8 && p >= 1) snare(session, t, 0.65 + p * 0.05);
      if (p >= 1 && s % 2 === 1) hat(session, t, 0.4 + p * 0.1);
      if (p === 3 && s % 4 === 2) hat(session, t, 0.35);
      if (p >= 1 && pb === 7 && s >= 12) tom(session, t, 45 - (s - 12) * 2, 0.65 + (s - 12) * 0.08);
      if (s % 2 === 0) pulse(session, t, root + PULSE[s / 2], { open: 2400 + p * 200, level: 0.55, pan: side });
      for (const [, , m, len] of notesAt(PHRASES.ascent[p], pb, s)) voice(session, t, m, len * STEP, 0.85 + p * 0.04);
    }

    if (key === 'apex') {
      const p = Math.floor(pos / 8), pb = pos % 8;
      if (s === 0 && pb === 0) impact(session, t, 1);
      if (s === 0 && pb % 2 === 0) cymbal(session, t, pb === 0 ? 1 : 0.6);
      if (held) {
        pad(session, t, chord.pad, held, { bright: 1, level: 1 });
        choir(session, t, top3, held, 1);
        strings(session, t, top3, held, 0.9 + p * 0.15);
      }
      if (s === 0) bell(session, t, chord.bell[2], 0.5);
      if (s % 2 === 0) bass(session, t, chord.bass + (s === 6 || s === 14 ? 12 : 0), STEP * 1.7, { level: 1.05, cutoff: 1300 });
      if (s === 0 || s === 10) kick(session, t, 1);
      if (s === 8) snare(session, t, 1.15);
      if (s === 4 || s === 6) tom(session, t, 40, 0.65);
      if (s % 2 === 1) hat(session, t, 1);
      if (s % 4 === 2) hat(session, t, 0.5);
      if (pb === 7 && s >= 12) tom(session, t, 45 - (s - 12) * 2, 0.75 + (s - 12) * 0.08);
      pulse(session, t, chord.pad[[0, 1, 2, 3, 2, 1, 3, 2][s % 8] % chord.pad.length] + 12, { open: 3800, level: 0.5, pan: s % 2 ? 0.45 : -0.45 });
      for (const [, , m, len] of notesAt('C', pb, s)) {
        voice(session, t, m, len * STEP, 1.1);
        if (p >= 1) voice(session, t, m - 12, len * STEP, 0.6);
      }
    }

    if (key === 'return') {
      const final = GRID[bar] === 'Efifth';
      if (s === 0 && pos === 0) impact(session, t, 0.6);
      if (held && final) {
        pad(session, t, chord.pad, held, { bright: 0.25, level: 0.9 });
        choir(session, t, [64, 71, 76], held, 0.5);
        pedal(session, t, 40, held, 0.8);
      } else if (held) {
        pad(session, t, chord.pad, held, { bright: 0.3, level: 0.75 - pos * 0.02 });
        if (pos < 8) { pedal(session, t, 40, held, 0.8); air(session, t, held, 0.8); }
      }
      if (s === 0 && final && GRID[bar - 1] !== 'Efifth') [0, 6, 8].forEach((st, i) => bell(session, t + st * STEP, chord.bell[i], 0.6 - i * 0.07));
      if (!final && s % 2 === 0) pulse(session, t, root + PULSE[s / 2], { open: Math.max(380, 1800 - pos * 150), level: 0.7 - pos * 0.04, pan: side });
      for (const [, , m, len] of notesAt('R', pos, s)) voice(session, t, m, len * STEP, 0.8);
    }
  }

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
