/**
 * La mise en scène de l'épisode 1, « Le voyage d'une page » (1.14.0) : l'état de la scène à chaque
 * instant, calculé à partir du temps seulement (aucune horloge, aucun hasard). Le film image par image
 * et la page interactive appellent la même fonction.
 *
 * On part du principe que la personne qui écoute ne connaît rien : chaque mot de la voix est défini
 * avant d'être employé, et l'image montre ce que la voix définit. Six battements, sur les cinq phrases
 * de la voix : le lien et le message ; Internet ; le binaire ; le serveur (et le restaurant) ; le
 * retour des trois documents ; la fin. Chaque moment est écrit en secondes « prévues » dans son
 * battement ; quand la voix fixe la vraie durée d'un battement, ses moments s'étirent avec lui.
 */
import { EASE, clamp, phase, pulse } from './ease.js';
import { Shots } from './camera.js';
import { Timeline } from './timeline.js';
import { LINES, STATIONS, fractionNear, linePoints, pointAlong } from './world.js';

/** Les battements tels que prévus avant la voix (secondes) : 50,7 s, calés sur le français. */
export const PLAN = Object.freeze([
  Object.freeze({ id: 'ask', seconds: 10.5 }),
  Object.freeze({ id: 'internet', seconds: 10.5 }),
  Object.freeze({ id: 'binary', seconds: 6.5 }),
  Object.freeze({ id: 'server', seconds: 12.7 }),
  Object.freeze({ id: 'back', seconds: 8 }),
  Object.freeze({ id: 'done', seconds: 2.5 }),
]);

/**
 * Les onze sous-titres (leurs textes sont dans les traductions de la page), placés dans leur battement.
 * Chacun reste au moins (caractères ÷ 15) + 1,5 s à l'écran, en français comme en anglais (un test le
 * vérifie) : la voix fixera les vrais temps, langue par langue. Un sous-titre peut déborder sur le
 * battement suivant (`to` au-delà de sa durée prévue) : le second du binaire finit sur le serveur.
 */
export const CAPTIONS = Object.freeze([
  Object.freeze({ beat: 'ask', from: 0.4, to: 3.2 }),
  Object.freeze({ beat: 'ask', from: 3.25, to: 6.65 }),
  Object.freeze({ beat: 'ask', from: 6.7, to: 10.4 }),
  Object.freeze({ beat: 'internet', from: 0.3, to: 4.3 }),
  Object.freeze({ beat: 'internet', from: 4.4, to: 10.4 }),
  Object.freeze({ beat: 'binary', from: 0.3, to: 3.6 }),
  Object.freeze({ beat: 'binary', from: 3.65, to: 7.3 }),
  Object.freeze({ beat: 'server', from: 0.8, to: 4.6 }),
  Object.freeze({ beat: 'server', from: 4.7, to: 8.4 }),
  Object.freeze({ beat: 'server', from: 8.5, to: 12.6 }),
  Object.freeze({ beat: 'back', from: 0.3, to: 4.2 }),
  Object.freeze({ beat: 'back', from: 4.3, to: 8.0 }),
]);

/**
 * Le message en binaire, tel qu'il voyage : « page? » en ASCII, huit bits par lettre. Le jeton montre
 * une lettre à la fois, ses huit bits entiers (01110000 pour p) : chaque image arrêtée se lit, ce sont
 * de vrais bits, pas un décor.
 */
export const BYTES = Object.freeze([...'page?'].map((c) => c.charCodeAt(0).toString(2).padStart(8, '0')));
/** Lettres montrées par seconde. */
const BYTES_PER_SECOND = 3;

/** Le jeton suit sa plume de ce retard (s) ; il apparaît et s'efface en ce temps (s). */
const LAG = 0.3;
const FADE = 0.25;

/**
 * Les cadrages fixes { cx, cy, width } du monde. Ceux de l'écran gardent le téléphone entre 24 % et
 * 78 % de la hauteur (la bande des sous-titres au-dessus, la légende des applis en dessous).
 */
const FRAMES = Object.freeze({
  screen: Object.freeze({ cx: 330, cy: 990, width: 520 }),
  // Le réseau à gauche de la diagonale, avec la correspondance où attend le message ; le serveur hors cadre.
  network: Object.freeze({ cx: 230, cy: 560, width: 560 }),
  // Serré sur le jour et la nuit (y 267), la baie et le plateau (y 580) : ils tiennent entre 27 % et 78 %.
  server: Object.freeze({ cx: 680, cy: 424, width: 360 }),
  wide: Object.freeze({ cx: 450, cy: 780, width: 1000 }),
});

/** Les trois documents qui reviennent : leur ligne, et leur départ décalé (secondes prévues dans « back »). */
const RETURNS = Object.freeze([
  Object.freeze({ line: 'html', from: 0.3, to: 3.6 }),
  Object.freeze({ line: 'css', from: 0.6, to: 3.9 }),
  Object.freeze({ line: 'js', from: 0.9, to: 4.2 }),
]);

export class Direction {
  /** @param {Timeline} timeline les vrais battements (par défaut, ceux prévus) */
  constructor(timeline = new Timeline(PLAN)) {
    this.timeline = timeline;
    this.planned = new Map(PLAN.map((beat) => [beat.id, beat.seconds]));
    for (const beat of timeline.beats) {
      if (!this.planned.has(beat.id)) throw new RangeError(`Battement inconnu de l'épisode 1 : ${beat.id}`);
    }
    this.paths = Object.fromEntries(LINES.map((line) => [line.key, linePoints(line)]));
    this.internetAt = fractionNear(this.paths.request, STATIONS.internet);
    // La demande en deux étapes : jusqu'au globe (fin de « ask »), puis du globe au serveur (« binary »).
    this.request = {
      start: this.at('ask', 6.8),
      atGlobe: this.at('ask', 10.2),
      leave: this.at('binary', 0.6),
      arrive: this.at('binary', 5.4),
    };
    this.returns = RETURNS.map((item) => ({ ...item, start: this.at('back', item.from), end: this.at('back', item.to) }));
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

  /** Ce que la plume d'une ligne a tracé (0 à 1). La demande s'arrête au globe le temps d'Internet. */
  drawn(key, t) {
    if (key === 'request') {
      const { start, atGlobe, leave, arrive } = this.request;
      if (t < leave) return EASE.inOut(phase(t, start, atGlobe)) * this.internetAt;
      return this.internetAt + EASE.inOut(phase(t, leave, arrive)) * (1 - this.internetAt);
    }
    const item = this.returns.find((candidate) => candidate.line === key);
    return EASE.inOut(phase(t, item.start, item.end));
  }

  /** Le jeton de la demande : « ? », puis ses bits qui défilent une fois sorti d'Internet ; null hors de son voyage. */
  token(t) {
    const { start, arrive } = this.request;
    if (t < start || t > arrive + LAG + FADE) return null;
    const along = this.drawn('request', t - LAG);
    const appear = phase(t, start, start + FADE);
    const leave = 1 - phase(t, arrive + LAG, arrive + LAG + FADE);
    const binaryFrom = this.at('binary', 0.4);
    const letter = Math.floor(Math.max(0, t - binaryFrom) * BYTES_PER_SECOND) % BYTES.length;
    return {
      line: 'request',
      label: t >= binaryFrom ? BYTES[letter] : '?',
      along,
      scale: EASE.out(Math.min(appear, leave)),
    };
  }

  /** Les trois documents en route vers le téléphone. */
  docs(t) {
    return Object.fromEntries(this.returns.map((item) => {
      if (t < item.start || t > item.end + LAG + FADE) return [item.line, null];
      const along = EASE.inOut(phase(t - LAG, item.start, item.end));
      const appear = phase(t, item.start, item.start + FADE);
      const leave = 1 - phase(t, item.end + LAG, item.end + LAG + FADE);
      return [item.line, { along, scale: EASE.out(Math.min(appear, leave)) }];
    }));
  }

  /** Le cadrage qui suit un point mobile d'une ligne (la demande, ou le premier document du retour). */
  #ride(key, width) {
    return (t) => {
      const along = key === 'request' ? this.drawn('request', t - LAG) : EASE.inOut(phase(t - LAG, this.returns[0].start, this.returns[0].end));
      const [cx, cy] = pointAlong(this.paths[key], along);
      return { cx, cy, width };
    };
  }

  #shots() {
    const still = (framing) => () => framing;
    const at = (id, seconds) => this.at(id, seconds);
    return [
      { at: 0, blend: 0, frame: still(FRAMES.screen) },
      { at: at('ask', 6.5), blend: 1.0, frame: this.#ride('request', 470) },
      { at: at('internet', 0.3), blend: 1.4, frame: still(FRAMES.network) },
      { at: at('binary', 0.2), blend: 1.0, frame: this.#ride('request', 470) },
      { at: at('server', 0.2), blend: 1.0, frame: still(FRAMES.server) },
      { at: at('back', 0.3), blend: 1.0, frame: this.#ride('html', 560) },
      { at: at('back', 4.4), blend: 1.0, frame: still(FRAMES.screen) },
      { at: at('done', 0), blend: 1.6, frame: still(FRAMES.wide) },
    ];
  }

  /** Les stations allumées (0 à 1) et leurs éclats d'arrivée. */
  #stations(t) {
    const { start, atGlobe, arrive } = this.request;
    const flashAt = (times) => Math.max(0, ...times.map((time) => pulse(t, time + 0.15, 0.7)));
    return {
      lit: {
        phone: phase(t, start, start + 0.3),
        internet: phase(t, atGlobe - 0.2, atGlobe + 0.1),
        server: phase(t, arrive - 0.15, arrive + 0.15),
      },
      flash: {
        phone: flashAt(this.returns.map((item) => item.end)),
        internet: flashAt([atGlobe]),
        server: flashAt([arrive]),
      },
    };
  }

  /** Les voyants du serveur : toujours allumés ; ils clignotent quand la demande arrive et quand il envoie. */
  #leds(t) {
    const busy = [[this.request.arrive, this.at('server', 1.5)], [this.at('back', 0), this.at('back', 1.2)]].some(([from, to]) => t >= from && t <= to);
    return Array.from({ length: 6 }, (_, k) => (busy ? ((Math.floor(t * 9) + k * 2) % 3 === 0 ? 1 : 0.35) : 0.9));
  }

  /** Internet ouvert : le globe s'ouvre sur les appareils, puis se referme quand le message repart. */
  #network(t) {
    const at = (seconds) => this.at('internet', seconds);
    const shown = phase(t, at(0.2), at(1.0)) * (1 - phase(t, this.at('binary', 0.2), this.at('binary', 1.0)));
    if (shown <= 0) return null;
    return {
      shown,
      drawn: EASE.inOut(phase(t, at(0.8), at(3.6))),
      waves: phase(t, at(3.6), at(4.2)),
      flow: (t * 0.45) % 1,
    };
  }

  /** Le jour et la nuit au-dessus du serveur, le temps de dire qu'il reste allumé. */
  #dayNight(t) {
    const at = (seconds) => this.at('server', seconds);
    const shown = phase(t, at(1.4), at(2.0)) * (1 - phase(t, at(7.0), at(7.6)));
    if (shown <= 0) return null;
    return { shown, night: 0.5 - Math.cos(2 * Math.PI * phase(t, at(2.4), at(6.6))) / 2 };
  }

  /** Le plateau : « tu demandes, il te l'apporte » ; il disparaît quand les documents partent. */
  #tray(t) {
    const at = (seconds) => this.at('server', seconds);
    const shown = phase(t, at(7.4), at(8.0)) * (1 - phase(t, this.at('back', 0.3), this.at('back', 0.6)));
    if (shown <= 0) return null;
    return { shown, docs: [8.2, 8.7, 9.2].map((seconds) => EASE.snap(phase(t, at(seconds), at(seconds + 0.6)))) };
  }

  /** L'écran du téléphone : la page de liens, l'attente, puis les trois documents reçus. */
  #screen(t) {
    const tap = this.at('ask', 0.8);
    const tapping = phase(t, tap, tap + 0.6);
    const sent = this.request.start;
    const arrived = this.returns.at(-1).end + LAG;
    return {
      links: 1 - phase(t, sent - 0.3, sent),
      ripple: { r: 34 * EASE.out(tapping), opacity: t >= tap ? 0.9 * (1 - tapping) : 0 },
      loading: t >= sent && t < arrived + 0.4 ? 0.92 * phase(t, sent, this.returns[0].end) + 0.08 * phase(t, arrived - 0.2, arrived) : 0,
      wait: phase(t, sent - 0.3, sent) * (1 - phase(t, this.returns[0].end, this.returns[0].end + 0.3)),
      spin: (t * 432) % 360,
      received: this.returns.map((item) => EASE.snap(phase(t, item.end + LAG, item.end + LAG + 0.45))),
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
      network: this.#network(t),
      dayNight: this.#dayNight(t),
      tray: this.#tray(t),
      docs: this.docs(t),
      token: this.token(t),
      screen: this.#screen(t),
    };
  }
}
