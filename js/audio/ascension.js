/**
 * « Ascension » — thème original d'AdamRodWebDev.
 * Composition générative en Web Audio API, dans l'esprit des bandes-son
 * cyberpunk / néo-Renaissance : nappes analogiques, arpège pulsé à délai
 * pointé, basse en sidechain, percussions cinématiques et mélodie de cloche FM.
 * Aucun fichier audio : tout est synthétisé en temps réel dans le navigateur.
 *
 * Tonalité : ré mineur, 84 BPM.
 * Grille (8 mesures) : Dm9 | Dm9 | B♭maj7(#11) | B♭maj7(#11) | Gm9 | Gm9 | Asus4 | A
 */

const BPM = 84;
const S16 = 60 / BPM / 4;            // durée d'une double croche
const BAR = S16 * 16;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = [
  { pad: [50, 53, 57, 60, 64], arp: [62, 65, 69, 72, 76], bass: 38 }, // Dm9
  { pad: [50, 53, 57, 60, 64], arp: [62, 65, 69, 72, 76], bass: 38 },
  { pad: [46, 50, 53, 57, 64], arp: [58, 62, 65, 69, 76], bass: 34 }, // B♭maj7(#11)
  { pad: [46, 50, 53, 57, 64], arp: [58, 62, 65, 69, 76], bass: 34 },
  { pad: [43, 46, 50, 53, 57], arp: [55, 58, 62, 65, 69], bass: 31 }, // Gm9
  { pad: [43, 46, 50, 53, 57], arp: [55, 58, 62, 65, 69], bass: 31 },
  { pad: [45, 50, 52, 55, 57], arp: [57, 62, 64, 67, 69], bass: 33 }, // Asus4
  { pad: [45, 49, 52, 55, 57], arp: [57, 61, 64, 67, 69], bass: 33 }, // A
];
const ARP_PATTERN = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 2, 1, 3, 4, 3];

// Mélodie originale : [mesure, pas, note MIDI, durée en pas]
const LEAD = [
  [0, 0, 69, 6], [0, 6, 72, 2], [0, 8, 74, 8],
  [1, 0, 77, 4], [1, 4, 76, 4], [1, 8, 74, 4], [1, 12, 69, 4],
  [2, 0, 76, 8], [2, 8, 74, 4], [2, 12, 77, 4],
  [3, 0, 81, 12], [3, 12, 79, 4],
  [4, 0, 77, 6], [4, 6, 74, 2], [4, 8, 70, 8],
  [5, 0, 69, 4], [5, 4, 70, 4], [5, 8, 74, 8],
  [6, 0, 76, 8], [6, 8, 74, 8],
  [7, 0, 73, 16],
];

/** Sections : intro (8 mesures) puis cycle montée (8) / plein (16) / respiration (8). */
function sectionOf(bar) {
  if (bar < 8) return { name: 'intro', pos: bar, len: 8 };
  const c = (bar - 8) % 32;
  if (c < 8) return { name: 'build', pos: c, len: 8 };
  if (c < 24) return { name: 'full', pos: c - 8, len: 16 };
  return { name: 'break', pos: c - 24, len: 8 };
}

export function createEngine() {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC({ latencyHint: 'playback' });

  // ----- Chaîne de sortie
  const bus = ctx.createGain(); bus.gain.value = 1.8;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3.5; comp.attack.value = 0.01; comp.release.value = 0.25;
  const master = ctx.createGain(); master.gain.value = 0;
  const analyser = ctx.createAnalyser(); analyser.fftSize = 128; analyser.smoothingTimeConstant = 0.8;
  bus.connect(comp); comp.connect(master); master.connect(analyser); analyser.connect(ctx.destination);

  // ----- Réverbération (réponse impulsionnelle générée)
  const reverb = ctx.createConvolver();
  reverb.buffer = (() => {
    const len = ctx.sampleRate * 4.2, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  })();
  const revIn = ctx.createGain(); revIn.gain.value = 0.55;
  revIn.connect(reverb); reverb.connect(comp);

  // ----- Délai pointé avec filtre dans la réinjection
  const delay = ctx.createDelay(2); delay.delayTime.value = S16 * 3;
  const fb = ctx.createGain(); fb.gain.value = 0.42;
  const fbf = ctx.createBiquadFilter(); fbf.type = 'lowpass'; fbf.frequency.value = 2600;
  const dIn = ctx.createGain(); dIn.gain.value = 1;
  dIn.connect(delay); delay.connect(fbf); fbf.connect(fb); fb.connect(delay);
  const dPan = ctx.createStereoPanner(); dPan.pan.value = 0.35;
  fbf.connect(dPan); dPan.connect(comp); fbf.connect(revIn);

  // ----- Sidechain (la basse et les nappes « respirent » avec la grosse caisse)
  const duck = ctx.createGain(); duck.connect(bus);

  // Bruit blanc partagé
  const noise = (() => {
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  })();

  const out = (node, { dry = 1, rev = 0, del = 0, pan = 0, toDuck = false } = {}) => {
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    node.connect(p);
    const g = ctx.createGain(); g.gain.value = dry; p.connect(g); g.connect(toDuck ? duck : bus);
    if (rev) { const r = ctx.createGain(); r.gain.value = rev; p.connect(r); r.connect(revIn); }
    if (del) { const s = ctx.createGain(); s.gain.value = del; p.connect(s); s.connect(dIn); }
  };

  // ----- Instruments
  function pad(t, notes, dur, bright) {
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(400 + bright * 500, t);
    f.frequency.linearRampToValueAtTime(900 + bright * 1600, t + dur * 0.6);
    f.frequency.linearRampToValueAtTime(500 + bright * 600, t + dur + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.9);
    g.gain.setValueAtTime(0.05, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1.6);
    f.connect(g); out(g, { rev: 0.5, toDuck: true });
    notes.forEach((m, i) => {
      [-8, 8].forEach((cents, k) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = mtof(m); o.detune.value = cents + (i - 2) * 1.5;
        const p = ctx.createStereoPanner(); p.pan.value = (k ? 1 : -1) * (0.25 + i * 0.1);
        o.connect(p); p.connect(f); o.start(t); o.stop(t + dur + 1.7);
      });
    });
  }

  function arp(t, m, open, vel, pan) {
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(m);
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = mtof(m); o2.detune.value = 7;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 7;
    f.frequency.setValueAtTime(open * 1.6, t); f.frequency.exponentialRampToValueAtTime(Math.max(300, open * 0.35), t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06 * vel, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(f); o2.connect(f); f.connect(g);
    out(g, { del: 0.45, rev: 0.18, pan });
    o.start(t); o2.start(t); o.stop(t + 0.3); o2.stop(t + 0.3);
  }

  function bass(t, m, len, accent) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m);
    const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = mtof(m - 12);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 4;
    f.frequency.setValueAtTime(accent ? 900 : 520, t); f.frequency.exponentialRampToValueAtTime(140, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(accent ? 0.2 : 0.14, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const sg = ctx.createGain(); sg.gain.value = 0.9;
    o.connect(f); f.connect(g); sub.connect(sg); sg.connect(g);
    out(g, { toDuck: true });
    o.start(t); sub.start(t); o.stop(t + len + 0.05); sub.stop(t + len + 0.05);
  }

  function kick(t, big = false) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(big ? 120 : 150, t); o.frequency.exponentialRampToValueAtTime(big ? 32 : 42, t + (big ? 0.5 : 0.16));
    const g = ctx.createGain();
    g.gain.setValueAtTime(big ? 1.1 : 0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (big ? 1.8 : 0.5));
    o.connect(g); out(g, { rev: big ? 0.6 : 0.05 });
    o.start(t); o.stop(t + (big ? 1.9 : 0.55));
    // compression latérale
    duck.gain.cancelScheduledValues(t);
    duck.gain.setValueAtTime(0.25, t); duck.gain.linearRampToValueAtTime(1, t + S16 * 3);
  }

  function hat(t, vel) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.05 * vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); out(g, { pan: 0.3, rev: 0.05 });
    s.start(t, Math.random()); s.stop(t + 0.06);
  }

  function snare(t) {
    const s = ctx.createBufferSource(); s.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.32, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    s.connect(f); f.connect(g); out(g, { rev: 0.7 });
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.1);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.25, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(og); out(og, { rev: 0.3 });
    s.start(t, Math.random()); s.stop(t + 0.3); o.start(t); o.stop(t + 0.16);
  }

  function lead(t, m, dur) {
    const fq = mtof(m);
    const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = fq;
    const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = fq * 2;
    const mg = ctx.createGain();
    mg.gain.setValueAtTime(fq * 2.2, t); mg.gain.exponentialRampToValueAtTime(fq * 0.25, t + 0.6);
    mod.connect(mg); mg.connect(car.frequency);
    const saw = ctx.createOscillator(); saw.type = 'sawtooth'; saw.frequency.value = fq; saw.detune.value = -6;
    const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.setValueAtTime(600, t); sf.frequency.linearRampToValueAtTime(2200, t + dur * 0.5);
    const sg = ctx.createGain(); sg.gain.value = 0.35;
    saw.connect(sf); sf.connect(sg);
    // vibrato tardif
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
    const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(6, t + Math.min(dur, 1.2));
    lfo.connect(lg); lg.connect(car.detune); lg.connect(saw.detune);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.085, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.5); g.gain.setValueAtTime(0.045, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.9);
    car.connect(g); sg.connect(g);
    out(g, { rev: 0.55, del: 0.3 });
    const end = t + dur + 1;
    [car, mod, saw, lfo].forEach((o) => { o.start(t); o.stop(end); });
  }

  function riser(t, dur) {
    const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    s.connect(f); f.connect(g); out(g, { rev: 0.4 });
    s.start(t); s.stop(t + dur + 0.05);
  }

  // ----- Séquenceur
  let step = 0, nextTime = 0, timer = null, playing = false;

  function scheduleStep(n, t) {
    const bar = Math.floor(n / 16), s = n % 16;
    const chord = CHORDS[bar % 8];
    const sec = sectionOf(bar);
    const full = sec.name === 'full', build = sec.name === 'build', brk = sec.name === 'break', intro = sec.name === 'intro';

    if (s === 0) {
      const bright = intro ? sec.pos / 8 : full ? 1 : build ? 0.6 + sec.pos / 20 : 0.4;
      pad(t, chord.pad, BAR, bright);
      if (sec.pos === 0 && (build || full)) kick(t, true);
    }

    // Arpège : s'ouvre pendant l'intro, plus clairsemé pendant la respiration
    const play = brk ? s % 4 === 0 || s % 4 === 3 : !(intro && sec.pos < 2 && s % 2);
    if (play) {
      const open = intro ? 500 + sec.pos * 260 : brk ? 900 : full ? 2600 : 1500 + sec.pos * 120;
      const vel = s % 4 === 0 ? 1 : 0.65;
      arp(t, chord.arp[ARP_PATTERN[s] % chord.arp.length] + (full && s >= 8 && bar % 2 ? 12 : 0), open, vel, s % 2 ? 0.45 : -0.45);
    }

    if (build || full) {
      if (s % 2 === 0) bass(t, chord.bass + (s === 6 || s === 14 ? 12 : 0), S16 * 1.8, s % 8 === 0);
      if (s === 0 || (full && s === 8) || (build && sec.pos >= 4 && s === 8)) kick(t);
    }
    if (full) {
      if (s % 2 === 1) hat(t, s % 4 === 3 ? 1 : 0.55);
      if (s === 8) snare(t);
      if (sec.pos >= 4 && s === 14 && bar % 2) hat(t, 0.8);
    }

    if (full || brk) {
      const lb = bar % 8;
      for (const [b, st, m, len] of LEAD) if (b === lb && st === s) lead(t, m + (brk ? -12 : 0), len * S16);
    }

    if (s === 0 && sec.pos === sec.len - 1 && (intro || brk || build)) riser(t, BAR);
  }

  function scheduler() {
    while (nextTime < ctx.currentTime + 0.15) {
      scheduleStep(step, nextTime);
      nextTime += S16; step++;
    }
  }

  let volume = 0.7;
  async function start() {
    if (playing) return;
    await ctx.resume();
    playing = true;
    nextTime = ctx.currentTime + 0.08;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 2.5);
    timer = setInterval(scheduler, 25);
    scheduler();
  }
  function stop() {
    if (!playing) return Promise.resolve();
    playing = false;
    clearInterval(timer);
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 1.2);
    return new Promise((r) => setTimeout(() => { if (!playing) ctx.suspend(); r(); }, 1300));
  }
  function setVolume(v) {
    volume = v;
    if (playing) master.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
  }

  return { start, stop, setVolume, analyser, get playing() { return playing; }, title: 'Ascension', bpm: BPM };
}
