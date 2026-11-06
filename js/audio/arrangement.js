/**
 * L'arrangement de « Sfumato » (1.12.1) : qui joue quoi, double croche par double croche.
 * L'ossature (grille, mélodie, pulsation, nappe, basse, batterie) est celle de la 1.12.0 ; l'orchestre, le chœur
 * et la dramaturgie s'y ajoutent : cordes qui entrent par pupitres, cuivres en crescendo vers chaque phrase,
 * timbales et roulements, rupture avant l'apogée, coup final sur la dominante avant le retour.
 */
import { BAR, CHORDS, GRID, MELODY, STEP, STEPS_PER_BAR, sectionAt } from './score.js';

const PULSE = [0, 12, 0, 7, 0, 12, 7, 12];
const SPICCATO = [0, 2, 1, 2, 0, 3, 1, 2];
const ARPEGGIO = [0, 1, 2, 3, 2, 1, 3, 2];
const PHRASES = { ascent: ['A', 'B', 'A', 'B'], apex: ['C', 'C', 'C'] };

/** Note liée à la précédente (aucun silence entre elles) : la voix y glisse, comme un port de voix */
function legatoFrom(notes, i) {
  if (!i) return null;
  const [b0, s0, m0, l0] = notes[i - 1];
  const [b1, s1, m1] = notes[i];
  return b0 * STEPS_PER_BAR + s0 + l0 === b1 * STEPS_PER_BAR + s1 && m0 !== m1 ? m0 : null;
}
/** Les notes de la phrase qui commencent ici, avec la note d'où la voix arrive */
const melodyAt = (phrase, bar, s) => MELODY[phrase].flatMap((note, i) => (
  note[0] === bar && note[1] === s ? [{ m: note[2], len: note[3] * STEP, from: legatoFrom(MELODY[phrase], i) }] : []));

/** Seconde voix : la note de l'accord la plus proche sous la mélodie, à une tierce au moins */
function harmonyBelow(m, chord) {
  const classes = new Set(chord.pad.map((n) => n % 12));
  for (let d = 3; d <= 9; d++) if (classes.has((m - d + 120) % 12)) return m - d;
  return m - 12;
}
/** Timbale accordée sur la fondamentale, dans sa tessiture (ré grave à la grave) */
const timpaniNote = (bass) => (bass >= 38 ? bass : bass + 12);

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

/** @param {ReturnType<import('./instruments.js').createInstruments>} I les pupitres */
export function createArrangement(I) {
  function scheduleStep(session, n, t) {
    const bar = Math.floor(n / STEPS_PER_BAR), s = n % STEPS_PER_BAR;
    const chord = CHORDS[GRID[bar]];
    const { key, pos, bars } = sectionAt(bar);
    const last = pos === bars - 1;
    const root = chord.bass + 12;
    const held = s === 0 && startsRun(session, bar) ? runFrom(bar) * BAR : 0;
    const top3 = chord.pad.slice(-3);
    const side = s % 4 ? 0.4 : -0.4;
    const timp = timpaniNote(chord.bass);
    const sing = (phrase, barInPhrase, level, extra) => {
      for (const { m, len, from } of melodyAt(phrase, barInPhrase, s)) {
        I.voice(session, t, m, len, { level, from });
        extra?.(m, len);
      }
    };

    if (key === 'awakening') {
      if (held) {
        I.pad(session, t, chord.pad, held, { bright: 0.12 + pos * 0.03, level: 0.5 + pos * 0.035 });
        I.air(session, t, held, 1.3);
        if (pos >= 4) I.strings(session, t, top3.map((m) => m + 12), held, { level: 0.25 + pos * 0.03, bright: 0.25, attack: 2.2, pan: 0.2 });
        if (pos >= 6) I.lowStrings(session, t, root, held, 0.45);
        if (pos >= 8) I.choir(session, t, top3, held, { level: 0.45, from: 'u', to: 'o', attack: 1.6 });
      }
      if (s === 0 && pos >= 2 && pos % 2 === 0) [0, 6, 8].forEach((st, i) => I.bell(session, t + st * STEP, chord.bell[i], 0.6));
      if (s === 0 && last) {
        I.riser(session, t, BAR);
        I.reverseCymbal(session, t, BAR, 0.7);
        I.timpaniRoll(session, t + BAR / 2, timp, BAR / 2, { from: 0.1, to: 0.55 });
      }
      if (s % 2 === 0) I.pulse(session, t, root + PULSE[s / 2], { open: 320 + pos * 110, level: 0.8, pan: side });
    }

    if (key === 'signal') {
      if (s === 0 && pos === 0) { I.impact(session, t, 0.7); I.timpani(session, t, 40, 0.8); }
      if (held) {
        I.pad(session, t, chord.pad, held, { bright: 0.3, level: 0.6 });
        I.pedal(session, t, 40, held, 1);
        I.air(session, t, held, 0.7);
        I.lowStrings(session, t, 52, held, 0.7);
        I.choir(session, t, top3, held, { level: 0.55, from: 'u', to: 'o', attack: 1.4 });
        if (pos >= 8) I.strings(session, t, chord.pad, held, { level: 0.5, bright: 0.35, attack: 1.2, pan: -0.15 });
      }
      if (s === 0 && pos % 4 === 0) I.bell(session, t, chord.bell[0], 0.55);
      if (s === 0 && pos >= 8) I.kick(session, t, 0.55);
      if (s === 8 && pos >= 12) I.snare(session, t, 0.45);
      if (s === 0 && last) {
        I.riser(session, t, BAR);
        I.reverseCymbal(session, t, BAR, 0.9);
        I.timpaniRoll(session, t, timpaniNote(35), BAR, { from: 0.1, to: 0.9 });
        I.brass(session, t, chord.pad.map((m) => m - 12), BAR, { level: 0.9, swellTo: 1 });
      }
      if (s % 2 === 0) I.pulse(session, t, root + PULSE[s / 2], { open: 1400 + pos * 45, level: 0.75, pan: side });
      sing('S', pos, 1);
    }

    if (key === 'ascent') {
      const p = Math.floor(pos / 8), pb = pos % 8;
      const breaking = last && s >= 8;
      if (s === 0 && pos === 0) { I.impact(session, t, 0.85); I.timpani(session, t, 40, 1); I.cymbal(session, t, 0.7); }
      if (held) {
        I.pad(session, t, chord.pad, held, { bright: 0.45 + p * 0.12, level: 0.6 });
        I.lowStrings(session, t, root, held, 0.75 + p * 0.05);
        I.strings(session, t, chord.pad, held, { level: 0.45 + p * 0.1, bright: 0.45 + p * 0.1, attack: 0.9, pan: -0.15 });
        if (p >= 1) I.strings(session, t, top3.map((m) => m + 12), held, { level: 0.35 + p * 0.12, bright: 0.6, attack: 1, pan: 0.15 });
        if (p >= 1) I.choir(session, t, top3, held, { level: 0.45 + p * 0.12, from: 'o', to: 'a', attack: 1.1 });
        if (p >= 2) I.brass(session, t, chord.pad, held, { level: 0.45 + (p - 2) * 0.2 });
      }
      if (s === 0 && p === 0 && pb % 2 === 0) I.bell(session, t, chord.bell[0], 0.55);
      if (s === 0 && p >= 1 && !(pb === 0 && p === 0)) I.timpani(session, t, timp, 0.55 + p * 0.1);
      // Les cuivres enflent vers la phrase suivante ; avant l'apogée, la rupture
      if (s === 0 && pb === 7 && !last) { I.brass(session, t, chord.pad, BAR, { level: 0.7 + p * 0.1, swellTo: 1 }); I.reverseCymbal(session, t + BAR / 2, BAR / 2, 0.6); }
      if (s === 0 && last) {
        I.riser(session, t, BAR);
        I.timpaniRoll(session, t + BAR / 2, timp, BAR / 2, { from: 0.2, to: 1 });
        I.reverseCymbal(session, t + BAR / 2, BAR / 2, 1);
        I.brass(session, t, chord.pad, BAR, { level: 1, swellTo: 1 });
      }
      if (s === 0 && p >= 2 && pb === 0) I.cymbal(session, t, 0.6);
      if (s % 2 === 0 && !breaking) I.bass(session, t, chord.bass + (s === 6 || s === 14 ? 12 : 0), STEP * 1.7, { level: 0.7 + p * 0.07, cutoff: 600 + p * 130 });
      if (!breaking) {
        if (s === 0 || s === 10) I.kick(session, t, 0.7 + p * 0.05);
        if (s === 8 && p >= 1) I.snare(session, t, 0.65 + p * 0.05);
        if (p >= 1 && s % 2 === 1) I.hat(session, t, 0.4 + p * 0.1);
        if (p === 3 && s % 4 === 2) I.hat(session, t, 0.35);
        if (p >= 1 && pb === 7 && s >= 12) I.tom(session, t, 45 - (s - 12) * 2, 0.65 + (s - 12) * 0.08);
      }
      // Spiccato : croches, puis doubles croches à partir de la deuxième phrase
      if ((p === 0 ? s % 2 === 0 : true) && !(last && s >= 12)) {
        I.spiccato(session, t, chord.pad[SPICCATO[s % 8] % chord.pad.length], { level: 0.45 + p * 0.1, pan: s % 2 ? 0.3 : -0.3 });
      }
      if (s % 2 === 0 && !(last && s >= 14)) I.pulse(session, t, root + PULSE[s / 2], { open: 2400 + p * 200, level: 0.45, pan: side });
      sing(PHRASES.ascent[p], pb, 1.05 + p * 0.04);
    }

    if (key === 'apex') {
      const p = Math.floor(pos / 8), pb = pos % 8;
      const ending = last && s >= 8;
      if (s === 0 && pb === 0) {
        I.impact(session, t, 1); I.cymbal(session, t, 1); I.timpani(session, t, timp, 1.2);
        I.brass(session, t, [chord.bass + 12, chord.bass + 19], STEP * 4, { level: 1.2 });
      }
      if (s === 0 && pb % 2 === 0 && pb) I.cymbal(session, t, 0.6);
      if (held) {
        I.pad(session, t, chord.pad, held, { bright: 1, level: 0.8 });
        I.choir(session, t, [chord.bass + 12, ...top3, chord.pad.at(-1) + 12], held, { level: 1.15, from: 'o', to: 'a', attack: 0.6 });
        I.strings(session, t, top3.map((m) => m + 12), held, { level: 1.1, bright: 0.9, attack: 0.5, pan: 0.15 });
        I.strings(session, t, chord.pad, held, { level: 0.8, bright: 0.7, attack: 0.5, pan: -0.15 });
        I.lowStrings(session, t, root, held, 1);
        I.brass(session, t, chord.pad, held, { level: 0.85 });
      }
      if (s === 0) I.bell(session, t, chord.bell[2], 0.5);
      if ((s === 0 || s === 8) && !(pb === 0 && s === 0) && !ending) I.timpani(session, t, timp, s ? 0.7 : 0.9);
      // La dernière mesure : roulement et crescendo, puis un coup de tout l'orchestre sur la dominante
      if (s === 0 && last) {
        I.timpaniRoll(session, t, timp, BAR / 2, { from: 0.3, to: 1.1 });
        I.brass(session, t, chord.pad, BAR / 2, { level: 1.1, swellTo: 1 });
      }
      if (s === 8 && last) {
        I.impact(session, t, 1); I.cymbal(session, t, 1); I.timpani(session, t, timp, 1.3);
        I.brass(session, t, [47, 54, 59, 63, 66], STEP * 6, { level: 1.2 });
      }
      if (!ending) {
        if (s % 2 === 0) I.bass(session, t, chord.bass + (s === 6 || s === 14 ? 12 : 0), STEP * 1.7, { level: 1.05, cutoff: 1300 });
        if (s === 0 || s === 10) I.kick(session, t, 1);
        if (s === 8) I.snare(session, t, 1.15);
        if (s === 4 || s === 6) I.tom(session, t, 40, 0.65);
        if (s % 2 === 1) I.hat(session, t, 1);
        if (s % 4 === 2) I.hat(session, t, 0.5);
        if (pb === 7 && s >= 12) I.tom(session, t, 45 - (s - 12) * 2, 0.75 + (s - 12) * 0.08);
        I.spiccato(session, t, chord.pad[SPICCATO[s % 8] % chord.pad.length] + 12, { level: 0.7, pan: s % 2 ? 0.3 : -0.3 });
      }
      if (!(last && s >= 10)) I.pulse(session, t, chord.pad[ARPEGGIO[s % 8] % chord.pad.length] + 12, { open: 3800, level: 0.4, pan: s % 2 ? 0.45 : -0.45 });
      sing('C', pb, 1.25, (m, len) => {
        if (p >= 1) I.voice(session, t, harmonyBelow(m, chord), len, { level: 0.7, pan: -0.25 });
        if (p === 2) I.voice(session, t, m - 12, len, { level: 0.5, pan: 0.25 });
      });
    }

    if (key === 'return') {
      const final = GRID[bar] === 'Efifth';
      if (s === 0 && pos === 0) { I.impact(session, t, 0.6); I.timpani(session, t, 40, 0.5); }
      if (held && final) {
        I.pad(session, t, chord.pad, held, { bright: 0.25, level: 0.9 });
        I.choir(session, t, [64, 71, 76], held, { level: 0.65, from: 'o', to: 'a', attack: 1.6 });
        I.strings(session, t, [64, 71, 76, 83], held, { level: 0.6, bright: 0.4, attack: 1.8 });
        I.lowStrings(session, t, 40, held, 0.6);
        I.pedal(session, t, 40, held, 0.8);
        I.timpaniRoll(session, t, 40, BAR, { from: 0.05, to: 0.35 });
        I.timpani(session, t + BAR, 40, 0.55);
      } else if (held) {
        I.pad(session, t, chord.pad, held, { bright: 0.3, level: 0.65 - pos * 0.02 });
        I.strings(session, t, top3.map((m) => m + 12), held, { level: 0.4 - pos * 0.02, bright: 0.3, attack: 1.5 });
        I.lowStrings(session, t, root, held, 0.55 - pos * 0.03);
        if (pos < 8) {
          I.pedal(session, t, 40, held, 0.8); I.air(session, t, held, 0.8);
          I.choir(session, t, top3, held, { level: 0.4, from: 'u', to: 'o', attack: 1.4 });
        }
      }
      if (s === 0 && final && GRID[bar - 1] !== 'Efifth') [0, 6, 8].forEach((st, i) => I.bell(session, t + st * STEP, chord.bell[i], 0.6 - i * 0.07));
      if (!final && s % 2 === 0) I.pulse(session, t, root + PULSE[s / 2], { open: Math.max(380, 1800 - pos * 150), level: 0.7 - pos * 0.04, pan: side });
      sing('R', pos, 0.95);
    }
  }

  return { scheduleStep };
}
