/**
 * Le lecteur d'un épisode dans la page (1.19.0) : Lire / Pause, Précédent / Suivant, une pastille par
 * battement. Il fait avancer le temps et appelle `episode.render(t)` ; l'horloge lui est donnée (aucune
 * heure cachée). Avec le mouvement réduit, il passe d'un battement posé au suivant, sans travelling.
 */
import { PANEL } from './transitions.js';

/**
 * Où le mouvement réduit pose un battement : un peu avant sa fin, avant que le panneau du suivant ne
 * monte. Le battement y est complet, son sous-titre entier, aucune fracture en cours.
 */
const REST_BEFORE_END = PANEL.rise + 0.1;

export class Player {
  /**
   * @param {{
   *   episode: import('./episode.js').Episode,
   *   ui: { play: HTMLButtonElement, playLabel: HTMLElement, back: HTMLButtonElement, next: HTMLButtonElement,
   *     dots: readonly HTMLButtonElement[] },
   *   clock: { now: () => number, frame: (callback: (now: number) => void) => number, cancel: (id: number) => void },
   *   reducedMotion: boolean,
   *   labels: { play: string, pause: string, replay: string },
   * }} parts
   */
  constructor({ episode, ui, clock, reducedMotion, labels }) {
    this.episode = episode;
    this.ui = ui;
    this.clock = clock;
    this.reducedMotion = reducedMotion;
    this.labels = labels;
    this.time = 0;
    this.playing = false;
    this.request = 0;
    this.last = 0;
    /** Mouvement réduit : depuis combien de secondes le battement posé est affiché. */
    this.held = 0;
  }

  /** Branche les commandes et dessine le début. */
  mount() {
    this.ui.play.addEventListener('click', () => (this.playing ? this.pause() : this.play()));
    this.ui.next.addEventListener('click', () => this.step(1));
    this.ui.back.addEventListener('click', () => this.step(-1));
    this.ui.dots.forEach((dot, index) => dot.addEventListener('click', () => this.seekBeat(index)));
    this.#show(this.reducedMotion ? this.#settled(0) : 0);
  }

  /** L'instant où le battement `index` est posé, avant le panneau du suivant (le mouvement réduit s'y arrête). */
  #settled(index) {
    const beat = this.episode.beats[index];
    return Math.max(beat.start, beat.end - REST_BEFORE_END);
  }

  /**
   * L'instant où l'on arrive en choisissant le battement `index` : son début, une fois son panneau reparti
   * (sinon l'image s'arrêterait sur le panneau, sans la scène). Le premier s'ouvre sur le titre.
   */
  #landing(index) {
    if (index === 0) return 0;
    const beat = this.episode.beats[index];
    return Math.min(beat.end, beat.start + PANEL.hold + PANEL.leave);
  }

  #beatIndex() {
    const beats = this.episode.beats;
    const index = beats.findIndex((beat) => this.time < beat.end);
    return index === -1 ? beats.length - 1 : index;
  }

  play() {
    if (this.time >= this.episode.duration - 0.05) this.#show(0);
    this.playing = true;
    this.last = this.clock.now();
    this.#paint();
    this.request = this.clock.frame((now) => this.#tick(now));
  }

  pause() {
    this.playing = false;
    this.clock.cancel(this.request);
    this.#paint();
  }

  /** Le battement suivant (+1) ou précédent (−1), à son arrivée (ou posé, mouvement réduit). */
  step(direction) {
    const beats = this.episode.beats;
    const current = this.#beatIndex();
    // Juste après l'arrivée sur un battement, « Précédent » mène au battement d'avant, sinon au début de celui-ci.
    const atStart = this.time - this.#landing(current) < 0.4;
    const target = direction > 0 ? current + 1 : atStart ? current - 1 : current;
    this.seekBeat(Math.min(beats.length - 1, Math.max(0, target)));
  }

  seekBeat(index) {
    this.pause();
    this.#show(this.reducedMotion ? this.#settled(index) : this.#landing(index));
  }

  #tick(now) {
    if (!this.playing) return;
    const elapsed = Math.min(0.25, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (this.reducedMotion) {
      // Un battement posé par battement, le temps de sa durée : des coupes, jamais de mouvement continu.
      this.held += elapsed;
      const beat = this.episode.beats[this.#beatIndex()];
      if (this.held >= beat.end - beat.start) {
        this.held = 0;
        const next = this.#beatIndex() + 1;
        if (next >= this.episode.beats.length) return this.#finish();
        this.#show(this.#settled(next));
      }
    } else {
      const time = this.time + elapsed;
      if (time >= this.episode.duration) return this.#finish();
      this.#show(time);
    }
    this.request = this.clock.frame((later) => this.#tick(later));
  }

  #finish() {
    this.#show(this.episode.duration);
    this.playing = false;
    this.#paint();
  }

  #show(time) {
    this.time = time;
    this.held = 0;
    this.episode.render(time);
    this.#paint();
  }

  /** L'état des commandes : le libellé du bouton principal, la pastille du battement en cours. */
  #paint() {
    const ended = !this.playing && this.time >= this.episode.duration - 0.05;
    const label = this.playing ? this.labels.pause : ended ? this.labels.replay : this.labels.play;
    if (this.ui.playLabel.textContent !== label) this.ui.playLabel.textContent = label;
    const current = this.#beatIndex();
    this.ui.dots.forEach((dot, index) => {
      if (index === current) dot.setAttribute('aria-current', 'step');
      else dot.removeAttribute('aria-current');
    });
  }
}
