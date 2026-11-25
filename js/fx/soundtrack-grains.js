/**
 * Le logo en grains de la section « Bande-son » (1.21.0) : l'hexagone et son A dessinés par des milliers de
 * grains d'or, qui respirent au repos et s'animent avec la musique. Un effet décoratif : le lecteur
 * (SoundtrackPlayer) ne le charge qu'à l'approche de la section, et le nom du morceau reste dans le texte.
 *
 *  - Les grains sont précalculés (scripts/bake-grains.mjs, assets/grains/) : le navigateur n'échantillonne rien.
 *  - L'ambiance « poussière » seule, l'or du thème sombre ou l'or foncé imprimé sur le papier du thème clair.
 *  - La musique : le niveau des graves et des médiums de l'analyseur gonfle la respiration, la dérive et le
 *    scintillement ; chaque nouvelle partie souffle le logo, qui se reforme.
 *  - Le mouvement réduit, la pause hors de l'écran et la limite de densité de pixels sont tenus par le module.
 */

/** Le fichier des grains du logo, et leur nombre (le plus grand budget : un préfixe en donne moins). */
export const EMBLEM_GRAINS = Object.freeze({ file: 'assets/grains/emblem.bin', count: 14000 });

/** Grains dessinés selon l'appareil : un téléphone en trace moins. */
const BUDGET = Object.freeze({ phone: 6000, desktop: 14000 });

/** Bandes lues dans l'analyseur (sur 1024 cases à 48 kHz, à peu près 50 Hz à 1 kHz) et lissage du niveau. */
const BAND = Object.freeze({ from: 2, to: 24 });
const RISE = 0.45;
const FALL = 0.06;

export class SoundtrackGrains {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ soundtrack: { analyser(): AnalyserNode | null }, dark: boolean }} options
   */
  static async start(canvas, { soundtrack, dark }) {
    const [{ ParticleSilhouette, Shapes }, buffer] = await Promise.all([
      import('./particle-silhouette.js'),
      fetch(`/${EMBLEM_GRAINS.file}`).then((res) => {
        if (!res.ok) throw new Error(`grains : HTTP ${res.status}`);
        return res.arrayBuffer();
      }),
    ]);
    const phone = matchMedia('(pointer: coarse)').matches;
    const fx = await ParticleSilhouette.create(canvas, {
      budget: phone ? BUDGET.phone : BUDGET.desktop,
      mood: 'dust',
      palette: dark ? 'gold' : 'goldInk',
      fill: 0.88,
    });
    const grains = new SoundtrackGrains(fx, soundtrack);
    // Les grains se rassemblent ; on n'attend pas la fin du mouvement, qui ne court que la scène à l'écran
    fx.setShape(Shapes.baked(buffer, { label: 'AdamRodWebTech' }), { transition: 'gather', duration: 2400 }).catch(() => {});
    return grains;
  }

  constructor(fx, soundtrack) {
    this.fx = fx;
    this.soundtrack = soundtrack;
    this.playing = false;
    this.level = 0;
    this.bins = null;
    this.raf = 0;
    this.loop = () => this.tick();   // une seule fermeture, aucune par image
  }

  /** La musique joue ou s'arrête : le niveau suit l'analyseur, puis retombe doucement. */
  setPlaying(playing) {
    this.playing = playing;
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
  }

  /** Une nouvelle partie du morceau : le logo s'envole, puis se reforme. */
  async newPart() {
    await this.fx.disperse({ duration: 900 });
    await this.fx.gather({ duration: 1500 });
  }

  setDark(dark) {
    this.fx.setPalette(dark ? 'gold' : 'goldInk');
  }

  tick() {
    this.raf = 0;
    let target = 0;
    const analyser = this.playing ? this.soundtrack.analyser() : null;
    if (analyser) {
      if (!this.bins || this.bins.length !== analyser.frequencyBinCount) this.bins = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(this.bins);
      const to = Math.min(BAND.to, this.bins.length);
      let sum = 0;
      for (let i = BAND.from; i < to; i++) sum += this.bins[i];
      target = sum / Math.max(1, to - BAND.from) / 255;
    }
    this.level += (target - this.level) * (target > this.level ? RISE : FALL);
    this.fx.setEnergy(this.level);
    // L'image suivante tant que la musique joue ou que le niveau retombe ; ensuite, plus rien
    if (this.playing || this.level > 0.004) this.raf = requestAnimationFrame(this.loop);
    else { this.level = 0; this.fx.setEnergy(0); }
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.fx.destroy();
  }
}
