/**
 * « Sfumato » — la partition du thème du site (1.12.0) : des données seulement, sans son ni Vue.
 * Le moteur (sfumato.js) la joue, le lecteur et la génération des pages y lisent la durée et les parties.
 *
 * Composition originale d'AdamRodWebDev. Mi mineur, 116 BPM joués en demi-temps, 4/4, 96 mesures.
 * Couleur : la sixte napolitaine (fa majeur, accord de ♭II) et la dominante majeure (si), d'où son
 * clair-obscur doré.
 */

export const TITLE = 'Sfumato';
export const BPM = 116;
/** Durée d'une double croche, en secondes */
export const STEP = 60 / BPM / 4;
export const STEPS_PER_BAR = 16;
export const BAR = STEP * STEPS_PER_BAR;
/** Résonance laissée à la fin (réverbération, dernier accord) */
export const TAIL = 5;

/** Notes MIDI des accords : nappe (4 à 5 sons), basse, cloche (3 sons aigus). */
export const CHORDS = {
  Em9: { pad: [52, 55, 59, 62, 66], bass: 40, bell: [83, 86, 90] },
  Em: { pad: [52, 55, 59, 64], bass: 40, bell: [83, 88, 86] },
  EmD: { pad: [50, 55, 59, 64], bass: 38, bell: [83, 86, 88] },
  Cmaj7: { pad: [48, 52, 55, 59], bass: 36, bell: [79, 83, 84] },
  CE: { pad: [52, 55, 60, 64], bass: 40, bell: [79, 84, 88] },
  C: { pad: [48, 52, 55, 60], bass: 36, bell: [79, 84, 88] },
  Am9: { pad: [57, 60, 64, 67, 71], bass: 33, bell: [81, 83, 84] },
  Am7: { pad: [57, 60, 64, 67], bass: 33, bell: [81, 84, 88] },
  GD: { pad: [55, 59, 62, 67], bass: 38, bell: [79, 83, 86] },
  G: { pad: [55, 59, 62, 67], bass: 43, bell: [79, 83, 86] },
  DFs: { pad: [54, 57, 62, 66], bass: 42, bell: [78, 81, 86] },
  F7s11: { pad: [53, 57, 64, 71], bass: 41, bell: [77, 81, 83] },
  FE: { pad: [53, 57, 64, 71], bass: 40, bell: [77, 81, 83] },
  Bsus4: { pad: [59, 64, 66, 71], bass: 35, bell: [83, 88, 90] },
  B: { pad: [59, 63, 66, 71], bass: 35, bell: [83, 87, 90] },
  BsusE: { pad: [59, 64, 66, 71], bass: 40, bell: [83, 88, 90] },
  BE: { pad: [59, 63, 66, 71], bass: 40, bell: [83, 87, 90] },
  Efifth: { pad: [40, 47, 52, 59], bass: 28, bell: [83, 88, 95] },
};

const PHRASE_A = ['Em', 'EmD', 'Cmaj7', 'Cmaj7', 'Am9', 'Am9', 'Bsus4', 'B'];
const PHRASE_B = ['Em', 'GD', 'Cmaj7', 'Am7', 'F7s11', 'F7s11', 'Bsus4', 'B'];
const PHRASE_C = ['Em', 'C', 'G', 'DFs', 'Em', 'C', 'F7s11', 'B'];

/**
 * Les cinq parties : leur nom (clé de traduction), leur grille mesure par mesure.
 * Chaque partie commence sur une mesure : le lecteur y saute d'un clic.
 */
const PARTS = [
  { key: 'awakening', chords: ['Em9', 'Em9', 'Em9', 'Em9', 'Cmaj7', 'Cmaj7', 'Em9', 'Em9', 'Am9', 'Am9', 'Bsus4', 'B'] },
  { key: 'signal', chords: ['Em9', 'Em9', 'Em9', 'Em9', 'CE', 'CE', 'Em9', 'Em9', 'Em9', 'Em9', 'Em9', 'Em9', 'FE', 'FE', 'BsusE', 'BE'] },
  { key: 'ascent', chords: [...PHRASE_A, ...PHRASE_B, ...PHRASE_A, ...PHRASE_B] },
  { key: 'apex', chords: [...PHRASE_C, ...PHRASE_C, ...PHRASE_C] },
  { key: 'return', chords: ['Em9', 'Em9', 'Em9', 'Em9', 'Cmaj7', 'Cmaj7', 'Am9', 'Am9', 'Bsus4', 'B', 'Efifth', 'Efifth'] },
];

/** Les parties avec leur première mesure et leur début en secondes */
export const SECTIONS = PARTS.reduce((list, part) => {
  const firstBar = list.length ? list.at(-1).firstBar + list.at(-1).bars : 0;
  return [...list, { key: part.key, firstBar, bars: part.chords.length, start: firstBar * BAR }];
}, []);

/** La grille complète : un nom d'accord par mesure */
export const GRID = PARTS.flatMap((part) => part.chords);
export const TOTAL_BARS = GRID.length;
export const TOTAL_STEPS = TOTAL_BARS * STEPS_PER_BAR;
export const DURATION = TOTAL_BARS * BAR + TAIL;

/** La partie d'une mesure, et la position de la mesure dans cette partie */
export function sectionAt(bar) {
  const index = SECTIONS.findLastIndex((section) => section.firstBar <= bar);
  const section = SECTIONS[Math.max(0, index)];
  return { index: Math.max(0, index), key: section.key, pos: bar - section.firstBar, bars: section.bars };
}

/** La partie en cours à un instant donné (en secondes), -1 avant le début */
export const sectionIndexAt = (seconds) => SECTIONS.findLastIndex((section) => section.start <= seconds);

/** Un instant en minutes et secondes : 3:24 (lecteur et pages générées) */
export const clock = (seconds) => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

/** Minutes et secondes séparées, pour les textes lus à voix haute (« 3 min 24 s ») */
export const minutesSeconds = (seconds) => {
  const whole = Math.max(0, Math.floor(seconds));
  return { m: Math.floor(whole / 60), s: whole % 60 };
};

/** Un instant ramené au début de sa mesure : la lecture reprend toujours sur un temps fort */
export const snapToBar = (seconds) => Math.min(TOTAL_BARS - 1, Math.max(0, Math.floor(seconds / BAR + 1e-6))) * BAR;

/**
 * La voix (mélodie originale) : [mesure dans la phrase, double croche, note MIDI, durée en doubles croches].
 * A et B : la montée ; C : l'apogée ; S : les notes tenues de « Signal ».
 */
export const MELODY = {
  A: [
    [0, 0, 71, 12], [0, 12, 74, 4],
    [1, 0, 76, 8], [1, 8, 74, 4], [1, 12, 71, 4],
    [2, 0, 79, 10], [2, 10, 78, 2], [2, 12, 76, 4],
    [3, 0, 71, 16],
    [4, 0, 72, 6], [4, 6, 71, 2], [4, 8, 69, 8],
    [5, 0, 76, 12], [5, 12, 74, 4],
    [6, 0, 76, 8], [6, 8, 75, 8],
    [7, 0, 78, 16],
  ],
  B: [
    [0, 0, 79, 8], [0, 8, 78, 4], [0, 12, 76, 4],
    [1, 0, 74, 12], [1, 12, 71, 4],
    [2, 0, 72, 8], [2, 8, 76, 8],
    [3, 0, 81, 12], [3, 12, 79, 4],
    [4, 0, 77, 16],
    [5, 0, 76, 8], [5, 8, 71, 8],
    [6, 0, 76, 16],
    [7, 0, 75, 16],
  ],
  C: [
    [0, 0, 83, 8], [0, 8, 81, 4], [0, 12, 79, 4],
    [1, 0, 79, 12], [1, 12, 76, 4],
    [2, 0, 74, 8], [2, 8, 79, 8],
    [3, 0, 78, 16],
    [4, 0, 79, 6], [4, 6, 81, 2], [4, 8, 83, 8],
    [5, 0, 84, 12], [5, 12, 83, 4],
    [6, 0, 81, 8], [6, 8, 77, 8],
    [7, 0, 78, 8], [7, 8, 75, 8],
  ],
  S: [
    [4, 0, 71, 16], [5, 0, 69, 8], [5, 8, 67, 8], [6, 0, 67, 16], [7, 0, 66, 16],
    [8, 0, 71, 12], [8, 12, 74, 4], [9, 0, 76, 16], [10, 0, 74, 8], [10, 8, 71, 8], [11, 0, 69, 16],
    [12, 0, 69, 8], [12, 8, 72, 8], [13, 0, 71, 16], [14, 0, 76, 16], [15, 0, 75, 16],
  ],
  R: [[0, 0, 76, 16], [1, 0, 74, 8], [1, 8, 71, 8], [2, 0, 71, 16], [3, 0, 67, 16], [8, 0, 76, 16], [9, 0, 75, 16]],
};
