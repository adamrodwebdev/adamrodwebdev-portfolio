/**
 * La mise en scène de l'épisode 1, « Le voyage d'une page » (1.19.0) : l'état de la scène à chaque
 * instant, calculé à partir du temps seulement (aucune horloge, aucun hasard). Le film image par image
 * et la page interactive appellent la même fonction.
 *
 * On part du principe que la personne qui écoute ne connaît rien : chaque mot de la voix est défini
 * avant d'être employé, et l'image montre ce que la voix définit. Six battements, sur les cinq phrases
 * de la voix : le lien et le message ; Internet ; le binaire ; le serveur (et le restaurant) ; le
 * retour des trois documents ; la fin. Chaque moment est écrit en secondes « prévues » dans son
 * battement ; quand la voix fixe la vraie durée d'un battement, ses moments s'étirent avec lui.
 */
import { EASE, phase, pulse } from './ease.js';
import { Shots } from './camera.js';
import { Timeline } from './timeline.js';
import { LINES, STATIONS, fractionNear, linePoints, pointAlong } from './world.js';
import { PANEL, panelOffset } from './transitions.js';
import { REPAIR, TITLE, breakAndRebuild, crack, repair, shatter, wholeAt, windows } from './frac.js';

/** Les battements tels que prévus avant la voix (secondes) : 50,7 s, calés sur le français. */
export const PLAN = Object.freeze([
  Object.freeze({ id: 'ask', seconds: 10.5 }),
  Object.freeze({ id: 'internet', seconds: 10.5 }),
  Object.freeze({ id: 'binary', seconds: 6.5 }),
  Object.freeze({ id: 'server', seconds: 12.7 }),
  Object.freeze({ id: 'back', seconds: 8 }),
  Object.freeze({ id: 'done', seconds: 2.5 }),
]);

/** Un sous-titre : son début et sa fin, chacun dans son battement, en secondes prévues. */
const cue = ([beat, from], [endBeat, to]) => Object.freeze({ beat, from, endBeat, to });

/**
 * Les douze sous-titres (leurs textes sont dans les traductions de la page). Chacun arrive brisé, se répare
 * en REPAIR secondes, puis reste entier au moins (caractères ÷ 15) + 1,5 s, en français comme en anglais :
 * le temps de la réparation s'ajoute à celui de la lecture, il ne le prend jamais (un test le vérifie).
 * Le premier attend la fin du titre ; aucun ne se répare pendant qu'un numéro de panneau se fêle ou que
 * « PAGE ? » se brise. Un sous-titre peut finir dans le battement suivant (`endBeat`) : chaque bout suit
 * la vraie durée de son battement quand la voix l'étire.
 */
export const CAPTIONS = Object.freeze([
  cue(['ask', 1.05], ['ask', 4.15]),
  cue(['ask', 4.2], ['ask', 7.95]),
  cue(['ask', 8.0], ['internet', 1.4]),
  cue(['internet', 1.45], ['internet', 5.55]),
  cue(['internet', 5.6], ['internet', 10.0]),
  cue(['binary', 0.4], ['binary', 3.95]),
  cue(['binary', 4.0], ['server', 1.45]),
  cue(['server', 1.5], ['server', 5.5]),
  cue(['server', 5.55], ['server', 9.55]),
  cue(['server', 9.6], ['back', 0.65]),
  cue(['back', 0.7], ['back', 4.2]),
  cue(['back', 4.25], ['done', 0.15]),
]);

/**
 * Les battements qu'ouvre un panneau, montant puis descendant tour à tour (la marche monte, puis descend,
 * comme les sections du site). Ni le premier (le titre l'ouvre) ni la fin (la boucle se referme sur le
 * téléphone, sans coupe).
 */
export const PANELS = Object.freeze([
  Object.freeze({ beat: 'internet', kind: 'rise' }),
  Object.freeze({ beat: 'binary', kind: 'fall' }),
  Object.freeze({ beat: 'server', kind: 'rise' }),
  Object.freeze({ beat: 'back', kind: 'fall' }),
]);

/** Le mot qui se brise dans le binaire : il se lit pareil en français et en anglais. */
export const WORD = 'PAGE ?';
/** Quand il se brise (secondes prévues dans « binary ») : après le premier sous-titre du binaire, réparé. */
const WORD_BREAK = 0.8;

/**
 * Le message en binaire, tel qu'il voyage : « page? » en ASCII, huit bits par lettre (01110000 pour p).
 * Quand « PAGE ? » se brise, ses cinq octets flottent autour de lui : de vrais bits, pas un décor.
 */
export const BYTES = Object.freeze([...'page?'].map((c) => c.charCodeAt(0).toString(2).padStart(8, '0')));

/** Le jeton suit sa plume de ce retard (s) ; il apparaît et s'efface en ce temps (s). */
const LAG = 0.3;
const FADE = 0.25;
/**
 * La taille du « ? » face aux bits : la question se lit d'un coup d'œil, même dans le plan large
 * d'Internet. Elle revient à 1 en `QUESTION_SHRINK` secondes juste avant les bits, sans saut.
 */
export const QUESTION_SIZE = 1.6;
const QUESTION_SHRINK = 0.3;

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

  /**
   * La mise en scène sur des battements venus de l'extérieur (l'outil de tournage, d'après la voix), lus à
   * la porte : les battements de l'épisode, tous et dans leur ordre ; chaque durée, la ligne de temps la
   * vérifie (un nombre fini, plus de 0 et 120 s au plus, jamais converti).
   * @param {unknown} beats
   */
  static retimed(beats) {
    if (!Array.isArray(beats) || beats.length !== PLAN.length) {
      throw new TypeError(`L'épisode 1 a ${PLAN.length} battements`);
    }
    return new Direction(new Timeline(beats.map((beat, i) => {
      if (beat === null || typeof beat !== 'object' || beat.id !== PLAN[i].id) {
        throw new TypeError(`Battement n° ${i + 1} : « ${PLAN[i].id} » attendu`);
      }
      return { id: beat.id, seconds: beat.seconds };
    })));
  }

  get duration() {
    return this.timeline.duration;
  }

  /** Le temps absolu d'un moment prévu `seconds` après le début du battement `id`, étiré à sa vraie durée. */
  at(id, seconds) {
    const beat = this.timeline.beat(id);
    return beat.start + (seconds / this.planned.get(id)) * (beat.end - beat.start);
  }

  /**
   * Les sous-titres et leurs temps absolus, dans l'ordre : `start` (il arrive brisé), `whole` (il est réparé :
   * sa lecture commence) et `end`.
   */
  captions() {
    return CAPTIONS.map((caption, index) => {
      const start = this.at(caption.beat, caption.from);
      return { index, start, whole: wholeAt(start), end: this.at(caption.endBeat, caption.to) };
    });
  }

  /** L'instant où « PAGE ? » se brise, et celui où il commence à se réparer (entier à l'arrivée au serveur). */
  get word() {
    return { breaks: this.at('binary', WORD_BREAK), rebuilds: this.request.arrive - REPAIR };
  }

  /**
   * Toutes les fenêtres où une fracture change, dans l'ordre : le titre, chaque sous-titre qui se répare,
   * chaque numéro de panneau qui se fêle, le mot qui se brise puis se répare. Elles ne doivent jamais se
   * chevaucher (un test le vérifie) : une seule fracture à la fois.
   */
  fractures() {
    const { breaks, rebuilds } = this.word;
    return [
      { kind: 'title', window: windows.title(0) },
      ...this.captions().map((caption) => ({ kind: `caption ${caption.index + 1}`, window: windows.repair(caption.start) })),
      ...PANELS.map((panel) => ({ kind: `panel ${panel.beat}`, window: windows.crack(this.timeline.beat(panel.beat).start - PANEL.crackLead) })),
      { kind: 'word breaks', window: windows.break(breaks) },
      { kind: 'word rebuilds', window: windows.repair(rebuilds) },
    ].sort((a, b) => a.window[0] - b.window[0]);
  }

  /**
   * L'habillage de l'image au temps `t`, au-dessus de la scène : le titre de la première seconde, la ligne
   * d'état (le battement en cours), le panneau d'un changement de battement et le sous-titre. Les textes sont
   * dans la langue de la page ; l'état ne donne que des numéros et des valeurs FRAC.
   */
  chrome(t) {
    const index = this.timeline.indexAt(t);
    const panel = PANELS.map((item, k) => ({ item, k, b: this.timeline.beat(item.beat).start }))
      .map(({ item, k, b }) => ({ item, k, b, offset: panelOffset(t, b) }))
      .find(({ offset }) => offset !== null);
    const caption = this.captions().find((item) => t >= item.start && t < item.end);
    return {
      title: { shown: t < TITLE.duration, frac: shatter(t, 0) },
      status: { shown: t >= TITLE.duration, index },
      panel: panel ? {
        kind: panel.item.kind,
        number: this.timeline.beats.findIndex((beat) => beat.id === panel.item.beat) + 1,
        offset: panel.offset,
        frac: crack(t, panel.b - PANEL.crackLead),
      } : null,
      caption: caption ? { index: caption.index, frac: repair(t, caption.start) } : null,
    };
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

  /**
   * Le jeton de la demande ; null hors de son voyage. D'abord un hexagone d'or et son « ? » (`form: 'mark'`),
   * grossi (QUESTION_SIZE) pour se lire dans le plan large ; il revient à 1 juste avant le binaire. Dans le
   * binaire, le mot « PAGE ? » (`form: 'word'`) : entier, il se brise en bits (ses cinq octets flottent
   * autour), voyage brisé, puis se répare pour arriver entier au serveur. `scale` le fait apparaître et
   * s'effacer.
   */
  token(t) {
    const { start, arrive } = this.request;
    if (t < start || t > arrive + LAG + FADE) return null;
    const along = this.drawn('request', t - LAG);
    const appear = phase(t, start, start + FADE);
    const leave = 1 - phase(t, arrive + LAG, arrive + LAG + FADE);
    const binaryFrom = this.at('binary', 0.4);
    const shrink = EASE.inOut(phase(t, binaryFrom - QUESTION_SHRINK, binaryFrom));
    const base = { line: 'request', along, scale: EASE.out(Math.min(appear, leave)), size: QUESTION_SIZE + (1 - QUESTION_SIZE) * shrink };
    if (t < binaryFrom) return { ...base, form: 'mark', label: '?' };
    const { breaks, rebuilds } = this.word;
    const scattered = phase(t, breaks, breaks + 0.45) * (1 - phase(t, rebuilds, arrive));
    return { ...base, form: 'word', label: WORD, frac: breakAndRebuild(t, breaks, rebuilds), bits: scattered, bytes: BYTES };
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
      // La fin reste sur le téléphone et ses trois fichiers, cadrée comme le début : la boucle se referme.
      { at: at('back', 4.4), blend: 1.0, frame: still(FRAMES.screen) },
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
    // Le doigt touche le lien une fois le titre passé.
    const tap = this.at('ask', 1.2);
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
