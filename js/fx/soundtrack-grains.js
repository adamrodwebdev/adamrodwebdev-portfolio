/**
 * Le logo en grains de la section « Bande-son » (1.21.0, 1.22.0) : l'hexagone et son A dessinés par des milliers
 * de grains d'or, qui respirent au repos et dansent avec la musique. Un effet décoratif : le lecteur
 * (SoundtrackPlayer) ne le charge qu'à l'approche de la section, et le nom du morceau reste dans le texte.
 *
 *  - Les grains sont précalculés (scripts/bake-grains.mjs, assets/grains/) : le navigateur n'échantillonne rien.
 *  - L'ambiance « poussière » seule, l'or du thème sombre ou l'or foncé imprimé sur le papier du thème clair.
 *  - La musique (1.22.0), comme du sable sur un haut-parleur : un son soutenu range les grains en figure de
 *    Chladni, qui fond dans le logo quand la musique se calme ; la basse les fait sauter ; une musique plus
 *    claire dessine une figure à plus de lignes (elle change sur un temps fort, au plus toutes les 2,8 s).
 *  - Chaque nouvelle partie brise le logo le long des fissures de la scène de marque (assets/grains/
 *    emblem-shards.bin) : des fissures de lumière, un temps d'arrêt, l'éclatement, puis le logo se reforme.
 *  - Le mouvement réduit (le logo reste immobile, seule la lumière des fissures paraît), la pause hors de
 *    l'écran et la limite de densité de pixels sont tenus par le module. Rien n'est alloué par image.
 */
import { decodeShards } from './shard-file.js';

/** Le fichier des grains du logo, et leur nombre (le plus grand budget : un préfixe en donne moins). */
export const EMBLEM_GRAINS = Object.freeze({ file: 'assets/grains/emblem.bin', count: 14000 });
/** Les éclats de la scène de marque, grain par grain (même ordre que le fichier des grains). */
export const EMBLEM_SHARDS = Object.freeze({ file: 'assets/grains/emblem-shards.bin' });

/** Grains dessinés selon l'appareil : un téléphone en trace moins. */
const BUDGET = Object.freeze({ phone: 6000, desktop: 14000 });

/** Lissage du niveau, et vitesse à laquelle la figure se forme et fond (par image à 60 Hz). */
const RISE = 0.3, FALL = 0.05;
const FORM = 0.04, MELT = 0.012, MELT_FAST = 0.16;
/** Écart minimal entre deux figures, en secondes, et temps fort de la basse. */
const FIGURE_GAP = 2.8;
const BEAT = Object.freeze({ ratio: 1.35, floor: 0.22, gap: 0.18 });

const fetchBuffer = (file) => fetch(`/${file}`).then((res) => {
  if (!res.ok) throw new Error(`grains : HTTP ${res.status}`);
  return res.arrayBuffer();
});

export class SoundtrackGrains {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ soundtrack: { analyser(): AnalyserNode | null }, dark: boolean }} options
   */
  static async start(canvas, { soundtrack, dark }) {
    const [{ ParticleSilhouette, Shapes }, chladni, buffer, cuts] = await Promise.all([
      import('./particle-silhouette.js'),
      import('./chladni.js'),
      fetchBuffer(EMBLEM_GRAINS.file),
      fetchBuffer(EMBLEM_SHARDS.file),
    ]);
    const phone = matchMedia('(pointer: coarse)').matches;
    const fx = await ParticleSilhouette.create(canvas, {
      budget: phone ? BUDGET.phone : BUDGET.desktop,
      mood: 'dust',
      palette: dark ? 'gold' : 'goldInk',
      fill: 0.88,
    });
    const shape = Shapes.baked(buffer, { label: 'AdamRodWebTech' });
    const grains = new SoundtrackGrains(fx, soundtrack, chladni, shape.grains);
    // Les grains se rassemblent ; on n'attend pas la fin du mouvement, qui ne court que la scène à l'écran
    fx.setShape(shape, { transition: 'gather', duration: 2400 }).catch(() => {});
    fx.setShards(decodeShards(cuts, shape.grains.count));
    return grains;
  }

  constructor(fx, soundtrack, chladni, grains) {
    this.fx = fx;
    this.soundtrack = soundtrack;
    this.chladni = chladni;
    this.grains = grains;
    this.figures = null;       // les cibles de chaque figure, calculées à la première écoute
    this.playing = false;
    this.level = 0; this.strength = 0; this.hop = 0; this.bassAvg = 0;
    this.lastBeat = 0; this.lastFigure = 0; this.figure = 0; this.breaking = false;
    this.tap = null; this.tapSource = null; this.bins = null; this.binHz = 1;
    this.raf = 0;
    this.loop = (now) => this.tick(now);   // une seule fermeture, aucune par image
  }

  /** La musique joue ou s'arrête : le niveau suit l'analyseur, puis retombe doucement. */
  setPlaying(playing) {
    this.playing = playing;
    if (playing && !this.figures) this.prepareFigures().catch(() => { this.figures = null; });
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  /** Les cibles de chaque figure, une par tâche (une dizaine de millisecondes chacune) : rien de long d'un coup. */
  async prepareFigures() {
    this.figures = [];
    const { MODES, nodalTargets } = this.chladni;
    const count = this.fx.budget;
    for (const mode of MODES) {
      this.figures.push(nodalTargets(this.grains.positions, count, mode));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await this.fx.sandFigure(this.figures[0], 1);
  }

  /** Une nouvelle partie du morceau : la figure fond, puis le logo se brise le long de la scène de marque et se reforme. */
  async newPart() {
    // Hors de l'écran, la scène ne court pas : une cassure attendrait le retour du visiteur pour se jouer à
    // contretemps. Personne ne la verrait : on la saute.
    if (this.breaking || !this.fx.visible || document.hidden) return;
    this.breaking = true;
    // Le temps de la cassure, la scène le dit (data-breaking) : les tests la voient, rien d'autre ne s'en sert
    this.fx.canvas.dataset.breaking = '';
    try {
      if (this.strength > 0.05) await new Promise((resolve) => setTimeout(resolve, 380));
      await this.fx.breakShards();
    } finally {
      this.breaking = false;
      delete this.fx.canvas.dataset.breaking;
    }
  }

  setDark(dark) {
    this.fx.setPalette(dark ? 'gold' : 'goldInk');
  }

  /** Un second analyseur, plus fin (2048 points), branché sur celui du moteur : le moteur ne change pas. */
  listen(analyser) {
    if (this.tap && this.tapSource === analyser) return this.tap;
    if (this.tap) this.tapSource.disconnect(this.tap);
    this.tap = analyser.context.createAnalyser();
    this.tap.fftSize = 2048;
    this.tap.smoothingTimeConstant = 0.6;
    analyser.connect(this.tap);
    this.tapSource = analyser;
    this.bins = new Uint8Array(this.tap.frequencyBinCount);
    this.binHz = analyser.context.sampleRate / this.tap.fftSize;
    return this.tap;
  }

  band(fromHz, toHz) {
    const a = Math.max(1, Math.floor(fromHz / this.binHz));
    const b = Math.min(this.bins.length, Math.ceil(toHz / this.binHz));
    let sum = 0;
    for (let i = a; i < b; i++) sum += this.bins[i];
    return sum / Math.max(1, b - a) / 255;
  }

  tick(now) {
    this.raf = 0;
    const t = now / 1000;
    let bass = 0, body = 0, brightness = -1;
    const analyser = this.playing ? this.soundtrack.analyser() : null;
    if (analyser) {
      this.listen(analyser).getByteFrequencyData(this.bins);
      bass = this.band(40, 160);
      body = this.band(40, 2000);
      // la clarté : le centre de gravité du spectre sur une échelle logarithmique, 80 Hz → 0, 6 kHz → 1
      let w = 0, sw = 0;
      const a = Math.floor(80 / this.binHz), b = Math.min(this.bins.length, Math.ceil(6000 / this.binHz));
      for (let i = a; i < b; i++) { const v = this.bins[i]; w += v; sw += v * Math.log((i + 0.5) * this.binHz / 80); }
      if (w > 0) brightness = Math.min(1, Math.max(0, sw / w / Math.log(6000 / 80)));
    }
    this.level += (body - this.level) * (body > this.level ? RISE : FALL);
    // la figure se forme sur un son soutenu, fond quand la musique se calme (et vite quand le logo se brise)
    const want = this.breaking ? 0 : Math.min(1, Math.max(0, (this.level - 0.1) / 0.28));
    this.strength += (want - this.strength) * (want > this.strength ? FORM : (this.breaking ? MELT_FAST : MELT));
    // un temps fort de la basse : les grains sautent
    const beat = bass > this.bassAvg * BEAT.ratio && bass > BEAT.floor && t - this.lastBeat > BEAT.gap;
    this.bassAvg += (bass - this.bassAvg) * 0.08;
    if (beat) this.lastBeat = t;
    this.hop = beat ? 1 : this.hop * 0.86;
    // la figure suit la clarté (Sfumato reste entre 0,45 et 0,75 sur cette échelle), et change sur un temps fort
    const ready = this.figures !== null && this.figures.length === this.chladni.MODES.length;
    if (ready && beat && brightness >= 0 && t - this.lastFigure > FIGURE_GAP) {
      const last = this.figures.length - 1;
      const wanted = Math.min(last, Math.max(0, Math.round((brightness - 0.45) / 0.3 * last)));
      if (wanted !== this.figure) {
        this.figure = wanted; this.lastFigure = t;
        this.fx.sandFigure(this.figures[wanted], 1400);
      }
    }
    this.fx.setSand(this.strength, this.hop * this.strength);
    this.fx.setEnergy(this.level);
    // L'image suivante tant que la musique joue ou que la figure fond ; ensuite, plus rien
    if (this.playing || this.strength > 0.002 || this.level > 0.004) this.raf = requestAnimationFrame(this.loop);
    else { this.level = 0; this.strength = 0; this.fx.setSand(0, 0); this.fx.setEnergy(0); }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    if (this.tap) this.tapSource.disconnect(this.tap);
    this.fx.destroy();
  }
}
