/**
 * Les pupitres de « Sfumato » (1.12.1) : comment chaque instrument sonne, pas ce qu'il joue (arrangement.js).
 * Tout est synthétisé : oscillateurs, filtres, bruit. Chaque pupitre reçoit une séance (`s`), un instant (`t`)
 * et ses notes MIDI, et se branche sur la séance par `route`.
 *
 * Orchestre : cordes (violons et altos en nappe, violoncelles et contrebasses, spiccato), cuivres (cors et
 * trombones), timbales, chœur à quatre voix et voix soliste par filtres de formants. Synthés : pulsation,
 * nappe, basse, pédale, cloche. Percussions : grosse caisse, caisse claire, toms, cymbales, impacts.
 */

export const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

/** Formants des voyelles chantées : [fréquence, gain] (F1 à F4) */
const VOWELS = {
  a: [[800, 1], [1150, 0.5], [2900, 0.28], [3900, 0.12]],
  o: [[450, 1], [800, 0.42], [2830, 0.14], [3800, 0.06]],
  u: [[325, 1], [700, 0.26], [2530, 0.07], [3500, 0.03]],
};

/**
 * @param {BaseAudioContext} ctx
 * @param {object} deps
 * @param {AudioBuffer} deps.noise bruit blanc partagé
 * @param {() => number} deps.random hasard à graine
 * @param {Function} deps.route branche un nœud sur la séance (sec, réverbération, délai, sidechain, stéréo)
 * @param {GainNode} deps.duck gain du sidechain (la grosse caisse le creuse)
 * @param {number} deps.step durée d'une double croche
 * @param {number} [deps.voices] copies désaccordées par note des ensembles (2 sur un appareil modeste, 3 sinon)
 */
export function createInstruments(ctx, { noise, random, route, duck, step, voices = 3 }) {
  const DETUNE = voices >= 3 ? [-10, 2, 11] : [-7, 7];

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
  const osc = (type, freq, t, end, detune = 0) => {
    const o = ctx.createOscillator(); o.type = type; o.detune.value = detune;
    // Valeur posée à l'instant de la note : les glissements qui suivent partent d'elle, pas du début du morceau
    o.frequency.setValueAtTime(freq, t);
    o.start(t); o.stop(end);
    return o;
  };
  const noiseSource = (t, end) => {
    const n = ctx.createBufferSource(); n.buffer = noise; n.loop = true;
    n.start(t, random() * 1.5); n.stop(end);
    return n;
  };
  const filter = (type, frequency, q = 0.7) => {
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = frequency; f.Q.value = q;
    return f;
  };
  const gain = (value) => { const g = ctx.createGain(); g.gain.value = value; return g; };
  /** Vibrato partagé par un pupitre : un oscillateur lent, une profondeur qui arrive après l'attaque */
  const vibrato = (t, end, { rate, depth, delay }) => {
    const lfo = osc('sine', rate, t, end);
    const amount = ctx.createGain();
    amount.gain.setValueAtTime(0, t); amount.gain.linearRampToValueAtTime(depth, t + delay);
    lfo.connect(amount);
    return amount;
  };
  /** Banc de formants : la source passe par F1 à F4 de la voyelle, avec un glissement possible vers une autre */
  const formants = (source, t, from, to, glide) => {
    const out = ctx.createGain();
    VOWELS[from].forEach(([freq, level], i) => {
      const bp = filter('bandpass', freq, 8 + i * 2);
      bp.frequency.setValueAtTime(freq, t);
      if (to !== from) bp.frequency.linearRampToValueAtTime(VOWELS[to][i][0], t + glide);
      const g = gain(level * 3.4);
      source.connect(bp); bp.connect(g); g.connect(out);
    });
    return out;
  };

  // ----- Synthés (l'ossature du thème)

  function pad(s, t, notes, dur, { bright, level }) {
    const f = filter('lowpass', 320 + bright * 500, 0.6);
    f.frequency.setValueAtTime(320 + bright * 500, t);
    f.frequency.linearRampToValueAtTime(700 + bright * 1900, t + dur * 0.55);
    f.frequency.linearRampToValueAtTime(420 + bright * 700, t + dur + 1.5);
    const g = ctx.createGain(); f.connect(g);
    const end = swell(g, t, { peak: 0.03 * level, attack: 0.9, hold: dur, release: 1.6 });
    route(s, g, { rev: 0.55, ducked: true });
    notes.forEach((m, i) => [-7, 7].forEach((cents, k) => {
      const p = ctx.createStereoPanner(); p.pan.value = (k ? 1 : -1) * (0.2 + i * 0.12);
      osc('sawtooth', mtof(m), t, end, cents + (i - 2) * 1.3).connect(p); p.connect(f);
    }));
  }

  function pulse(s, t, m, { open, level, pan }) {
    const f = filter('lowpass', open * 1.5, 6);
    f.frequency.setValueAtTime(open * 1.5, t); f.frequency.exponentialRampToValueAtTime(Math.max(180, open * 0.3), t + 0.14);
    const g = ctx.createGain(); f.connect(g);
    const end = envelope(g, t, { peak: 0.05 * level, attack: 0.004, hold: 0.02, release: 0.16 });
    route(s, g, { del: 0.4, rev: 0.15, pan });
    osc('square', mtof(m), t, end).connect(f); osc('sawtooth', mtof(m), t, end, 6).connect(f);
  }

  function bass(s, t, m, len, { level, cutoff }) {
    const f = filter('lowpass', cutoff, 3);
    f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(120, t + len);
    const g = ctx.createGain(); f.connect(g);
    const end = envelope(g, t, { peak: 0.13 * level, attack: 0.008, hold: len * 0.5, release: len * 0.6 });
    route(s, g, { ducked: true });
    osc('sawtooth', mtof(m), t, end).connect(f);
    const sg = gain(1.1); osc('sine', mtof(m - 12), t, end).connect(sg); sg.connect(g);
  }

  /** Pédale grave tenue : le mi à 82 Hz (audible aussi sur un téléphone), son octave, le mi très grave en soutien */
  function pedal(s, t, m, dur, level) {
    const f = filter('lowpass', 420);
    const g = ctx.createGain(); f.connect(g);
    const end = swell(g, t, { peak: 0.16 * level, attack: 0.6, hold: dur, release: 1 });
    [[m, 'sawtooth', 0.5], [m - 12, 'sine', 0.35], [m + 12, 'triangle', 0.18]].forEach(([note, type, level2]) => {
      const og = gain(level2); osc(type, mtof(note), t, end).connect(og); og.connect(f);
    });
    route(s, g, { ducked: true, rev: 0.1 });
  }

  /** Cloche de verre : modulation de fréquence inharmonique qui s'éteint */
  function bell(s, t, m, level = 1) {
    const fc = mtof(m);
    const g = ctx.createGain();
    const end = envelope(g, t, { peak: 0.045 * level, attack: 0.003, hold: 0.01, release: 2.6 });
    const car = osc('sine', fc, t, end), mod = osc('sine', fc * 3.51, t, end);
    const idx = ctx.createGain(); idx.gain.setValueAtTime(fc * 1.6, t); idx.gain.exponentialRampToValueAtTime(fc * 0.05, t + 1.6);
    mod.connect(idx); idx.connect(car.frequency); car.connect(g);
    route(s, g, { rev: 0.7, del: 0.45, pan: 0.3 * Math.sin(m) });
  }

  /** Souffle de fond : bruit filtré qui ondule lentement */
  function air(s, t, dur, level) {
    const f = filter('lowpass', 700, 1.5);
    const g = ctx.createGain(); f.connect(g);
    const end = swell(g, t, { peak: 0.03 * level, attack: 0.8, hold: dur, release: 1 });
    const depth = gain(380); osc('sine', 0.13, t, end).connect(depth); depth.connect(f.frequency);
    noiseSource(t, end).connect(f);
    route(s, g, { rev: 0.4, pan: -0.2 });
  }

  // ----- Cordes

  /**
   * Violons ou altos en nappe : chaque note jouée par plusieurs pupitres désaccordés, un vibrato commun,
   * l'archet qui arrive en `attack` secondes.
   */
  function strings(s, t, notes, dur, { level, bright = 0.6, attack = 0.8, pan = 0 }) {
    const hp = filter('highpass', 180), lp = filter('lowpass', 2200 + bright * 4200, 0.5);
    const g = ctx.createGain(); hp.connect(lp); lp.connect(g);
    const end = swell(g, t, { peak: 0.016 * level, attack, hold: dur, release: 1.5 });
    const vib = vibrato(t, end, { rate: 5.3, depth: 7, delay: 0.6 });
    notes.forEach((m, i) => DETUNE.forEach((cents, k) => {
      const o = osc('sawtooth', mtof(m), t, end, cents + i);
      vib.connect(o.detune);
      const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan + (k - (DETUNE.length - 1) / 2) * 0.45));
      o.connect(p); p.connect(hp);
    }));
    route(s, g, { rev: 0.75, dry: 0.85 });
  }

  /** Violoncelles et contrebasses : la note et son octave grave, archet ample */
  function lowStrings(s, t, m, dur, level) {
    const lp = filter('lowpass', 1100, 0.6);
    const g = ctx.createGain(); lp.connect(g);
    const end = swell(g, t, { peak: 0.05 * level, attack: 0.35, hold: dur, release: 1.2 });
    const vib = vibrato(t, end, { rate: 4.8, depth: 5, delay: 0.5 });
    [[m, 0.6], [m - 12, 0.5]].forEach(([note, level2], i) => DETUNE.slice(0, 2).forEach((cents) => {
      const o = osc('sawtooth', mtof(note), t, end, cents * 0.6 + i);
      vib.connect(o.detune);
      const og = gain(level2); o.connect(og); og.connect(lp);
    }));
    route(s, g, { rev: 0.45, ducked: true, pan: -0.1 });
  }

  /** Spiccato : une note d'archet sautée, courte et mordante */
  function spiccato(s, t, m, { level, pan }) {
    const lp = filter('lowpass', 3000, 1.2);
    lp.frequency.setValueAtTime(3600, t); lp.frequency.exponentialRampToValueAtTime(1200, t + 0.12);
    const g = ctx.createGain(); lp.connect(g);
    const end = envelope(g, t, { peak: 0.04 * level, attack: 0.006, hold: 0.02, release: 0.13 });
    osc('sawtooth', mtof(m), t, end, -6).connect(lp); osc('sawtooth', mtof(m), t, end, 7).connect(lp);
    route(s, g, { rev: 0.3, pan });
  }

  // ----- Cuivres

  /**
   * Cors (ou trombones) : le filtre s'ouvre avec la nuance, la note arrive par en dessous.
   * `swellTo` > 0 : un crescendo sur toute la durée ; sinon une attaque franche (accord tenu ou coup).
   */
  function brass(s, t, notes, dur, { level, swellTo = 0 }) {
    const lp = filter('lowpass', 500, 1.4);
    const g = ctx.createGain(); lp.connect(g);
    const peak = 0.03 * level;
    let end;
    if (swellTo) {
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak * swellTo, t + dur);
      g.gain.linearRampToValueAtTime(0, t + dur + 0.08);
      lp.frequency.setValueAtTime(350, t); lp.frequency.exponentialRampToValueAtTime(900 + 2600 * swellTo, t + dur);
      end = t + dur + 0.1;
    } else {
      end = swell(g, t, { peak, attack: 0.09, hold: dur, release: 0.6 });
      lp.frequency.setValueAtTime(400, t); lp.frequency.exponentialRampToValueAtTime(900 + 2200 * level, t + 0.08);
      lp.frequency.exponentialRampToValueAtTime(700 + 1300 * level, t + 0.6);
    }
    notes.forEach((m, i) => [-5, 5].forEach((cents) => {
      const o = osc('sawtooth', mtof(m), t, end, cents);
      o.detune.setValueAtTime(cents - 30, t); o.detune.linearRampToValueAtTime(cents, t + 0.07);
      const p = ctx.createStereoPanner(); p.pan.value = (i - (notes.length - 1) / 2) * 0.25;
      o.connect(p); p.connect(lp);
    }));
    route(s, g, { rev: 0.55, dry: 0.9 });
  }

  // ----- Voix

  /**
   * Chœur à voix multiples : chaque note chantée par plusieurs voix désaccordées, vibrato commun,
   * voyelle qui glisse de `from` vers `to` pendant l'attaque.
   */
  function choir(s, t, notes, dur, { level, from = 'o', to = 'a', attack = 1.1 }) {
    const sum = ctx.createGain();
    const g = ctx.createGain();
    formants(sum, t, from, to, attack * 1.2).connect(g);
    const end = swell(g, t, { peak: 0.05 * level, attack, hold: dur, release: 2 });
    const vib = vibrato(t, end, { rate: 4.7, depth: 11, delay: 0.8 });
    notes.forEach((m, i) => DETUNE.forEach((cents) => {
      const o = osc('sawtooth', mtof(m), t, end, cents * 1.2 + i * 2);
      vib.connect(o.detune); o.connect(sum);
    }));
    route(s, g, { rev: 0.85, dry: 0.75, ducked: true });
  }

  /**
   * La voix soliste : une note chantée, liée à la précédente par un port de voix (`from`), du « o » vers le
   * « a », vibrato qui s'élargit, souffle à l'attaque.
   */
  function voice(s, t, m, dur, { level = 1, from = null, pan = 0.05 } = {}) {
    const f0 = mtof(m);
    const src = ctx.createGain();
    const g = ctx.createGain();
    const end = swell(g, t, { peak: 0.1 * level, attack: from ? 0.06 : 0.14, hold: dur, release: 0.8 });
    const vib = vibrato(t, end, { rate: 5.5, depth: 22, delay: Math.min(dur, 0.9) });
    [['sawtooth', 0, 1], ['triangle', 4, 0.6]].forEach(([type, cents, level2]) => {
      const o = osc(type, f0, t, end, cents);
      if (from) { o.frequency.setValueAtTime(mtof(from), t); o.frequency.exponentialRampToValueAtTime(f0, t + 0.11); }
      vib.connect(o.detune);
      const og = gain(level2); o.connect(og); og.connect(src);
    });
    formants(src, t, from ? 'a' : 'o', 'a', 0.5).connect(g);
    const bf = filter('bandpass', 2600, 1.2), bg = ctx.createGain();
    bg.gain.setValueAtTime(0.09, t); bg.gain.exponentialRampToValueAtTime(0.025, t + 0.25);
    noiseSource(t, end).connect(bf); bf.connect(bg); bg.connect(g);
    route(s, g, { rev: 0.6, del: 0.2, pan });
  }

  // ----- Percussions

  function kick(s, t, level = 1) {
    const g = ctx.createGain();
    const end = envelope(g, t, { peak: 0.75 * level, attack: 0.002, hold: 0.01, release: 0.5 });
    const o = osc('sine', 130, t, end);
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    o.connect(g); route(s, g, { rev: 0.08 });
    duck.gain.cancelScheduledValues(t);
    duck.gain.setValueAtTime(0.3, t); duck.gain.linearRampToValueAtTime(1, t + step * 3.5);
  }

  function snare(s, t, level = 1) {
    const f = filter('bandpass', 1500, 0.7), g = ctx.createGain(); f.connect(g);
    const end = envelope(g, t, { peak: 0.3 * level, attack: 0.002, hold: 0.01, release: 0.32 });
    noiseSource(t, end).connect(f); route(s, g, { rev: 0.9 });
    const og = ctx.createGain();
    envelope(og, t, { peak: 0.22 * level, attack: 0.002, hold: 0.01, release: 0.16 });
    const o = osc('sine', 190, t, end); o.frequency.exponentialRampToValueAtTime(130, t + 0.1);
    o.connect(og); route(s, og, { rev: 0.4 });
  }

  /** Tambour grave de film, frappé à la main */
  function tom(s, t, m, level = 1) {
    const g = ctx.createGain();
    const end = envelope(g, t, { peak: 0.45 * level, attack: 0.003, hold: 0.02, release: 0.9 });
    const o = osc('sine', mtof(m) * 1.8, t, end); o.frequency.exponentialRampToValueAtTime(mtof(m), t + 0.09);
    o.connect(g); route(s, g, { rev: 0.5, pan: (m % 3 - 1) * 0.3 });
  }

  /** Timbale accordée : ses partiels (1, 1,5, 1,98), un coup de baguette, la note qui se pose */
  function timpani(s, t, m, level = 1) {
    const f0 = mtof(m);
    const g = ctx.createGain(); g.gain.value = 0.5 * level;
    [[1, 1, 2.4], [1.5, 0.45, 1.3], [1.98, 0.22, 0.8]].forEach(([ratio, amp, decay]) => {
      const pg = ctx.createGain();
      const end = envelope(pg, t, { peak: amp, attack: 0.004, hold: 0.01, release: decay });
      const o = osc('sine', f0 * ratio * 1.03, t, end); o.frequency.exponentialRampToValueAtTime(f0 * ratio, t + 0.12);
      o.connect(pg); pg.connect(g);
    });
    const tf = filter('lowpass', 380), tg = ctx.createGain();
    const tend = envelope(tg, t, { peak: 0.5, attack: 0.002, hold: 0.005, release: 0.12 });
    noiseSource(t, tend).connect(tf); tf.connect(tg); tg.connect(g);
    route(s, g, { rev: 0.5, pan: -0.15 });
  }

  /** Roulement de timbale : des coups serrés qui enflent de `from` à `to` */
  function timpaniRoll(s, t, m, dur, { from = 0.15, to = 0.8 } = {}) {
    const hits = Math.max(2, Math.round(dur / (step * 2 / 3)));
    for (let i = 0; i < hits; i++) {
      const k = i / (hits - 1);
      timpani(s, t + i * (dur / hits), m, (from + (to - from) * k ** 1.6) * (0.85 + random() * 0.3));
    }
  }

  function hat(s, t, level) {
    const f = filter('highpass', 7800), g = ctx.createGain(); f.connect(g);
    const end = envelope(g, t, { peak: 0.07 * level, attack: 0.001, hold: 0.005, release: 0.06 });
    noiseSource(t, end).connect(f); route(s, g, { pan: 0.35, rev: 0.06 });
  }

  /** Cymbale frappée : souffle aigu qui s'éteint lentement */
  function cymbal(s, t, level = 1) {
    const f = filter('highpass', 5500), g = ctx.createGain(); f.connect(g);
    const end = envelope(g, t, { peak: 0.06 * level, attack: 0.004, hold: 0.02, release: 1.8 });
    noiseSource(t, end).connect(f); route(s, g, { rev: 0.35, pan: -0.3 });
  }

  /** Cymbale à l'envers : elle enfle jusqu'au temps fort qui suit, et se coupe net dessus */
  function reverseCymbal(s, t, dur, level = 1) {
    const f = filter('highpass', 3000), g = ctx.createGain(); f.connect(g);
    f.frequency.setValueAtTime(1800, t); f.frequency.exponentialRampToValueAtTime(6000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08 * level, t + dur - 0.01);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.01);
    noiseSource(t, t + dur + 0.05).connect(f); route(s, g, { rev: 0.25, pan: 0.2 });
  }

  /** Impact grave au début d'une partie */
  function impact(s, t, level = 1) {
    const g = ctx.createGain();
    const end = envelope(g, t, { peak: 0.6 * level, attack: 0.003, hold: 0.05, release: 2.6 });
    const o = osc('sine', 90, t, end); o.frequency.exponentialRampToValueAtTime(28, t + 1.4);
    o.connect(g); route(s, g, { rev: 0.5 });
    const f = filter('lowpass', 5000), ng = ctx.createGain(); f.connect(ng);
    f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(300, t + 2);
    envelope(ng, t, { peak: 0.12 * level, attack: 0.004, hold: 0.02, release: 2.4 });
    noiseSource(t, end).connect(f); route(s, ng, { rev: 0.9 });
  }

  function riser(s, t, dur) {
    const f = filter('bandpass', 250, 2.5), g = ctx.createGain(); f.connect(g);
    f.frequency.setValueAtTime(250, t); f.frequency.exponentialRampToValueAtTime(6500, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.03);
    noiseSource(t, t + dur + 0.05).connect(f); route(s, g, { rev: 0.5 });
  }

  return {
    pad, pulse, bass, pedal, bell, air, strings, lowStrings, spiccato, brass, choir, voice,
    kick, snare, tom, timpani, timpaniRoll, hat, cymbal, reverseCymbal, impact, riser,
  };
}
