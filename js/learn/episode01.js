/**
 * La mise en scène de l'épisode 1, « Que se passe-t-il quand on ouvre une page web ? » (1.14.0) :
 * l'état de la scène à chaque instant, calculé à partir du temps seulement (aucune horloge, aucun
 * hasard). Le film image par image et la page interactive appellent la même fonction.
 *
 * Six battements : demander, répondre, construire, habiller, réveiller, fini. Chaque moment est écrit
 * en secondes « prévues » dans son battement ; quand la voix fixe la vraie durée d'un battement, ses
 * moments s'étirent avec lui.
 */
import { EASE, clamp, phase, pulse } from './ease.js';
import { Shots } from './camera.js';
import { Timeline } from './timeline.js';
import { LINES, STATIONS, fractionNear, linePoints, pointAlong } from './world.js';

/**
 * Les battements tels que prévus avant la voix (secondes) : 43,3 s. L'image suit la langue la plus longue
 * à chaque battement, le français d'ordinaire ; ces durées laissent déjà ses sous-titres assez longtemps.
 */
export const PLAN = Object.freeze([
  Object.freeze({ id: 'ask', seconds: 7 }),
  Object.freeze({ id: 'answer', seconds: 7.5 }),
  Object.freeze({ id: 'build', seconds: 6 }),
  Object.freeze({ id: 'dress', seconds: 8 }),
  Object.freeze({ id: 'wake', seconds: 7 }),
  Object.freeze({ id: 'done', seconds: 7.8 }),
]);

/**
 * Les dix sous-titres (leurs textes sont dans les traductions de la page), placés dans leur battement.
 * Chacun reste au moins (caractères ÷ 15) + 1,5 s à l'écran, en français comme en anglais (un test le
 * vérifie) : la voix fixera les vrais temps, langue par langue.
 */
export const CAPTIONS = Object.freeze([
  Object.freeze({ beat: 'ask', from: 0.3, to: 3.1 }),
  Object.freeze({ beat: 'ask', from: 3.2, to: 6.9 }),
  Object.freeze({ beat: 'answer', from: 0.2, to: 3.1 }),
  Object.freeze({ beat: 'answer', from: 3.3, to: 7.4 }),
  Object.freeze({ beat: 'build', from: 0.3, to: 5.9 }),
  Object.freeze({ beat: 'dress', from: 0.3, to: 4.2 }),
  Object.freeze({ beat: 'dress', from: 4.3, to: 7.95 }),
  Object.freeze({ beat: 'wake', from: 0.3, to: 6.9 }),
  Object.freeze({ beat: 'done', from: 0.1, to: 3.7 }),
  Object.freeze({ beat: 'done', from: 3.8, to: 7.75 }),
]);

/** La règle de lecture : un texte reste au moins (caractères ÷ 15) + 1,5 s entièrement à l'écran. */
export const readSeconds = (text) => [...text].length / 15 + 1.5;

/** Les voyages : chaque ligne tracée par sa plume, son jeton derrière elle (secondes prévues dans le battement). */
const TRAVELS = Object.freeze([
  Object.freeze({ line: 'request', beat: 'ask', from: 1.8, to: 4.8, label: '?' }),
  Object.freeze({ line: 'html', beat: 'answer', from: 1.0, to: 4.2, label: 'index.html' }),
  Object.freeze({ line: 'css', beat: 'dress', from: 0.8, to: 3.4, label: 'style.css' }),
  Object.freeze({ line: 'js', beat: 'wake', from: 0.8, to: 3.2, label: 'script.js' }),
]);

/** Le jeton suit sa plume de ce retard (s) ; il apparaît et s'efface en ce temps (s). */
const TOKEN_LAG = 0.3;
const TOKEN_FADE = 0.25;

/**
 * Les cadrages fixes { cx, cy, width } du monde. L'écran du téléphone (476 de haut) reste entre 24 % et
 * 78 % de la hauteur de l'image : la bande des sous-titres en haut garde le fond noir derrière elle, et
 * la légende des applis ne couvre pas la page. D'où une largeur de 500 au moins pour un plan de l'écran.
 */
const FRAMES = Object.freeze({
  screen: Object.freeze({ cx: 330, cy: 990, width: 520 }),
  screenClose: Object.freeze({ cx: 330, cy: 994, width: 500 }),
  server: Object.freeze({ cx: 630, cy: 460, width: 460 }),
  // Tout le plan, du haut du serveur (320) au bas du téléphone (1240), entre 26 % et 78 % de la hauteur.
  wide: Object.freeze({ cx: 450, cy: 780, width: 1000 }),
});

export class Direction {
  /** @param {Timeline} timeline les vrais battements (par défaut, ceux prévus) */
  constructor(timeline = new Timeline(PLAN)) {
    this.timeline = timeline;
    this.planned = new Map(PLAN.map((beat) => [beat.id, beat.seconds]));
    for (const beat of timeline.beats) {
      if (!this.planned.has(beat.id)) throw new RangeError(`Battement inconnu de l'épisode 1 : ${beat.id}`);
    }
    this.paths = Object.fromEntries(LINES.map((line) => [line.key, linePoints(line)]));
    this.internetAt = Object.fromEntries(LINES.map((line) => [line.key, fractionNear(this.paths[line.key], STATIONS.internet)]));
    this.travels = TRAVELS.map((travel) => ({ ...travel, start: this.at(travel.beat, travel.from), end: this.at(travel.beat, travel.to) }));
    this.camera = new Shots(this.#shots());
  }

  get duration() {
    return this.timeline.duration;
  }

  /** Le temps absolu d'un moment prévu `seconds` après le début du battement `id`, étiré à sa vraie durée. */
  at(id, seconds) {
    const beat = this.timeline.beat(id);
    return beat.start + (seconds / this.planned.get(id)) * (beat.end - beat.start);
  }

  /** Les sous-titres et leurs temps absolus, dans l'ordre. */
  captions() {
    return CAPTIONS.map((caption, index) => ({ index, start: this.at(caption.beat, caption.from), end: this.at(caption.beat, caption.to) }));
  }

  /** Ce que la plume d'une ligne a tracé (0 à 1). */
  drawn(key, t) {
    const travel = this.travels.find((candidate) => candidate.line === key);
    return EASE.inOut(phase(t, travel.start, travel.end));
  }

  /** Le jeton en route au temps `t`, ou null. */
  token(t) {
    const travel = this.travels.find((candidate) => t >= candidate.start && t <= candidate.end + TOKEN_LAG + TOKEN_FADE);
    if (!travel) return null;
    const along = EASE.inOut(phase(t - TOKEN_LAG, travel.start, travel.end));
    const appear = phase(t, travel.start, travel.start + TOKEN_FADE);
    const leave = 1 - phase(t, travel.end + TOKEN_LAG, travel.end + TOKEN_LAG + TOKEN_FADE);
    return { line: travel.line, label: travel.label, along, scale: EASE.out(Math.min(appear, leave)) };
  }

  /** Le cadrage qui suit le jeton de la ligne `key` (avant le départ : sa gare de départ). */
  #ride(key, width) {
    const travel = this.travels.find((candidate) => candidate.line === key);
    return (t) => {
      const [cx, cy] = pointAlong(this.paths[key], EASE.inOut(phase(t - TOKEN_LAG, travel.start, travel.end)));
      return { cx, cy, width };
    };
  }

  #shots() {
    const still = (framing) => () => framing;
    const at = (id, seconds) => this.at(id, seconds);
    return [
      { at: 0, blend: 0, frame: still(FRAMES.screen) },
      { at: at('ask', 1.6), blend: 0.9, frame: this.#ride('request', 470) },
      { at: at('ask', 4.7), blend: 1.0, frame: still(FRAMES.server) },
      { at: at('answer', 1.0), blend: 0.8, frame: this.#ride('html', 470) },
      { at: at('answer', 4.2), blend: 0.9, frame: still(FRAMES.screen) },
      { at: at('build', 0), blend: 1.2, frame: still(FRAMES.screenClose) },
      { at: at('dress', 0.3), blend: 0.8, frame: this.#ride('css', 560) },
      { at: at('dress', 3.4), blend: 0.9, frame: still(FRAMES.screen) },
      { at: at('wake', 0.3), blend: 0.8, frame: this.#ride('js', 560) },
      { at: at('wake', 3.2), blend: 0.9, frame: still(FRAMES.screenClose) },
      { at: at('done', 0), blend: 1.8, frame: still(FRAMES.wide) },
    ];
  }

  /** Les stations allumées (0 à 1) et leurs éclats d'arrivée. */
  #stations(t) {
    const request = this.drawn('request', t);
    const responses = this.travels.filter((travel) => travel.line !== 'request');
    const passed = (key) => clamp((this.drawn(key, t) - this.internetAt[key]) * 10);
    const flashAt = (times) => Math.max(0, ...times.map((time) => pulse(t, time + 0.15, 0.7)));
    const reqTravel = this.travels[0];
    const passTimes = this.travels.map((travel) => travel.start + (travel.end - travel.start) * this.internetAt[travel.line]);
    return {
      lit: {
        phone: clamp(phase(t, reqTravel.start, reqTravel.start + 0.3)),
        internet: Math.max(...LINES.map((line) => passed(line.key))),
        server: clamp((request - 0.96) * 25),
      },
      flash: {
        phone: flashAt(responses.map((travel) => travel.end)),
        internet: flashAt(passTimes),
        server: flashAt([reqTravel.end]),
      },
    };
  }

  /** Les voyants du serveur : ils clignotent quand il prépare sa réponse et envoie ses fichiers. */
  #leds(t) {
    const at = (id, seconds) => this.at(id, seconds);
    const busy = [[at('ask', 4.6), at('answer', 1.2)], [at('dress', 0.4), at('dress', 1.0)], [at('wake', 0.4), at('wake', 1.0)]]
      .some(([from, to]) => t >= from && t <= to);
    return Array.from({ length: 6 }, (_, k) => (busy ? ((Math.floor(t * 9) + k * 2) % 3 === 0 ? 1 : 0.25) : 0.35));
  }

  /** L'écran du téléphone : liens, attente, fichier, puis la page qui se construit, s'habille et vit. */
  #screen(t) {
    const at = (id, seconds) => this.at(id, seconds);
    const fade = (from, to) => phase(t, at(...from), at(...to));
    const tap = at('ask', 0.7);
    const tapping = phase(t, tap, tap + 0.6);
    const loadingWindows = [
      [at('ask', 1.4), at('build', 0.4), at('build', 0.8)],
      [at('dress', 0.8), at('dress', 3.6), at('dress', 4.0)],
      [at('wake', 0.8), at('wake', 3.4), at('wake', 3.8)],
    ];
    const loading = loadingWindows.reduce((value, [from, full, gone]) => (t >= from && t < gone ? Math.max(value, phase(t, from, full)) : value), 0);
    const pops = [4.4, 5.3, 6.1].map((seconds) => at('wake', seconds));
    const badge = t >= this.travels[3].end ? 'js' : t >= this.travels[2].end ? 'css' : 'html';
    return {
      links: 1 - fade(['ask', 1.4], ['ask', 1.7]),
      ripple: { r: 34 * EASE.out(tapping), opacity: t >= tap ? 0.9 * (1 - tapping) : 0 },
      loading,
      wait: fade(['ask', 1.4], ['ask', 1.7]) * (1 - fade(['answer', 4.4], ['answer', 4.7])),
      spin: (t * 432) % 360,
      file: fade(['answer', 4.4], ['answer', 4.8]) * (1 - fade(['build', 0.3], ['build', 0.6])),
      code: [4.8, 5.3, 5.8, 6.3].map((seconds) => phase(t, at('answer', seconds), at('answer', seconds + 0.25))),
      page: fade(['build', 0.2], ['build', 0.5]),
      boxes: [0.6, 1.4, 2.2, 3.0].map((seconds) => ({ shown: EASE.snap(phase(t, at('build', seconds), at('build', seconds + 0.45))) })),
      dress: EASE.inOut(fade(['dress', 4.0], ['dress', 5.6])),
      badges: 1 - fade(['done', 0], ['done', 0.8]),
      badge,
      pop: Math.max(0, ...pops.map((time) => pulse(t, time + 0.12, 0.36))),
      likes: pops.filter((time) => t >= time).length,
    };
  }

  /** L'état complet de la scène au temps `t` (secondes depuis le début de l'épisode). */
  state(t) {
    const stations = this.#stations(t);
    return {
      camera: this.camera.at(t),
      lines: Object.fromEntries(LINES.map((line) => [line.key, { drawn: this.drawn(line.key, t) }])),
      stations: stations.lit,
      flash: stations.flash,
      server: { leds: this.#leds(t) },
      token: this.token(t),
      screen: this.#screen(t),
    };
  }
}
