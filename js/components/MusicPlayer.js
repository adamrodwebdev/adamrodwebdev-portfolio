import { ref, onBeforeUnmount } from 'vue';

/** Lecteur de la bande-son originale. Le moteur audio n'est chargé qu'au premier clic. */
export default {
  name: 'MusicPlayer',
  setup() {
    const playing = ref(false);
    const open = ref(false);
    const loading = ref(false);
    const volume = ref(70);
    const viz = ref(null);
    let engine = null, raf = null;

    const draw = () => {
      const c = viz.value; if (!c || !engine) return;
      const ctx = c.getContext('2d');
      const dpr = Math.min(devicePixelRatio || 1, 2);
      if (c.width !== 46 * dpr) { c.width = 46 * dpr; c.height = 46 * dpr; ctx.scale(dpr, dpr); }
      const data = new Uint8Array(engine.analyser.frequencyBinCount);
      engine.analyser.getByteFrequencyData(data);
      const gold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim();
      ctx.clearRect(0, 0, 46, 46);
      ctx.strokeStyle = gold; ctx.lineWidth = 2;
      const n = 24;
      for (let i = 0; i < n; i++) {
        const v = data[i + 2] / 255;
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const r1 = 11, r2 = 11 + 2 + v * 10;
        ctx.globalAlpha = 0.4 + v * 0.6;
        ctx.beginPath(); ctx.moveTo(23 + Math.cos(a) * r1, 23 + Math.sin(a) * r1); ctx.lineTo(23 + Math.cos(a) * r2, 23 + Math.sin(a) * r2); ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };

    async function toggle() {
      if (loading.value) return;
      if (!engine) {
        loading.value = true;
        const { createEngine } = await import('../audio/ascension.js');
        engine = createEngine();
        engine.setVolume(volume.value / 100);
        loading.value = false;
      }
      if (engine.playing) {
        playing.value = false;
        await engine.stop();
        cancelAnimationFrame(raf);
      } else {
        await engine.start();
        playing.value = true; open.value = true;
        draw();
      }
    }
    const onVolume = () => engine?.setVolume(volume.value / 100);
    onBeforeUnmount(() => { cancelAnimationFrame(raf); engine?.stop(); });

    return { playing, open, loading, volume, viz, toggle, onVolume };
  },
  template: `
  <aside class="player" :class="{ 'is-playing': playing, 'is-open': open }" aria-label="Bande-son du site">
    <button class="player__toggle" type="button" @click="toggle" :aria-pressed="playing ? 'true' : 'false'"
            :aria-label="playing ? 'Mettre la bande-son en pause' : 'Écouter la bande-son originale'">
      <canvas v-show="playing" ref="viz" class="player__viz" width="46" height="46" aria-hidden="true"></canvas>
      <span v-show="!playing" class="player__bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
    </button>
    <div class="player__info" :inert="!open || null">
      <span class="player__title">Ascension</span>
      <span class="player__sub">Thème original, synthétisé en direct</span>
      <label class="visually-hidden" for="player-volume">Volume de la bande-son</label>
      <input id="player-volume" class="player__vol" type="range" min="0" max="100" v-model.number="volume" @input="onVolume">
    </div>
  </aside>
  `,
};
