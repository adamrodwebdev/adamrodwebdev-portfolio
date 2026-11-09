import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { clock, minutesSeconds } from '../audio/score.js';

/** Rayon d'un hexagone pointe en haut, dans la direction `angle` (rayon des sommets : 1) */
const hexRadius = (angle) => Math.cos(Math.PI / 6) / Math.cos((((angle + Math.PI / 2) % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6);

/**
 * Le lecteur de la section « Bande-son » (1.12.0) : lecture, position, volume, les cinq parties du morceau.
 * L'état vient de la bande-son partagée (fournie par islands.js), que l'interrupteur de l'en-tête pilote aussi.
 */
export default {
  name: 'SoundtrackPlayer',
  setup() {
    const { t } = useI18n();
    const soundtrack = inject('soundtrack');
    const { state, sections, duration, title } = soundtrack;
    const viz = ref(null);
    /** Position affichée pendant qu'on fait glisser le curseur, avant de la valider */
    const scrub = ref(null);
    let frame = 0;

    const shown = computed(() => scrub.value ?? state.time);
    const spoken = (seconds) => t('soundtrack.duration', minutesSeconds(seconds));
    const facts = computed(() => t('soundtrack.facts', { duration: clock(duration) }));
    const volume = computed({
      get: () => Math.round(state.volume * 100),
      set: (value) => soundtrack.setVolume(value / 100),
    });
    const chapterName = (section) => t(`soundtrack.chapters.${section.key}.name`);

    // La valeur d'une glissière, lue en nombre fini : une page modifiée pourrait y mettre n'importe quoi
    const sliderValue = (event) => (Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : null);
    const onScrub = (event) => { scrub.value = sliderValue(event); };
    async function onSeek(event) {
      scrub.value = null;
      const at = sliderValue(event);
      if (at !== null) await soundtrack.seek(at);
    }
    const playFrom = (start) => soundtrack.play(start);

    /** Spectre en hexagone : les fréquences poussent des traits d'or autour du losange du logo */
    function draw() {
      const canvas = viz.value;
      if (!canvas) return;
      const size = canvas.clientWidth, dpr = Math.min(devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(size * dpr)) { canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr); }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const styles = getComputedStyle(canvas);
      const gold = styles.getPropertyValue('--gold').trim(), hi = styles.getPropertyValue('--gold-hi').trim();
      const c = size / 2, R = size * 0.3;
      const analyser = soundtrack.analyser();
      const data = new Uint8Array(analyser ? analyser.frequencyBinCount : 64);
      if (analyser && state.playing) analyser.getByteFrequencyData(data);
      const ticks = 48;
      ctx.lineCap = 'square';
      for (let i = 0; i < ticks; i++) {
        const a = (i / ticks) * Math.PI * 2 - Math.PI / 2;
        const v = data[2 + Math.floor((i < ticks / 2 ? i : ticks - i) * 1.1)] / 255;
        const r1 = R * hexRadius(a) + 6, r2 = r1 + 3 + v * size * 0.16;
        ctx.strokeStyle = v > 0.55 ? hi : gold; ctx.globalAlpha = 0.35 + v * 0.65; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1); ctx.lineTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.strokeStyle = gold; ctx.lineWidth = 1.5;
      for (const k of [1, 0.62]) {
        ctx.beginPath();
        for (let j = 0; j <= 6; j++) {
          const a = -Math.PI / 2 + j * Math.PI / 3;
          ctx[j ? 'lineTo' : 'moveTo'](c + Math.cos(a) * R * k, c + Math.sin(a) * R * k);
        }
        ctx.stroke();
      }
      if (state.playing) frame = requestAnimationFrame(draw);
    }
    watch(() => state.playing, () => { cancelAnimationFrame(frame); draw(); });
    onMounted(draw);
    onBeforeUnmount(() => cancelAnimationFrame(frame));

    return {
      t, state, sections, duration, title, facts, shown, volume, viz, clock, spoken, chapterName,
      chapter: soundtrack.chapter, toggle: soundtrack.toggle, onScrub, onSeek, playFrom,
    };
  },
  template: `
  <div class="soundtrack__grid">
    <div class="sound-deck">
      <div class="sound-deck__head">
        <canvas ref="viz" class="sound-deck__viz" aria-hidden="true"></canvas>
        <div class="sound-deck__id">
          <p class="sound-deck__title">{{ title }}</p>
          <p class="sound-deck__facts">{{ facts }}</p>
        </div>
      </div>
      <div class="sound-deck__controls">
        <button type="button" class="btn btn--gold sound-deck__play" @click="toggle" :aria-busy="state.loading ? 'true' : null">
          <svg v-if="state.playing" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>
          <span>{{ state.playing ? t('soundtrack.pause') : t('soundtrack.play') }}</span>
        </button>
        <label class="sound-deck__volume">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9.5a3.5 3.5 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <span class="visually-hidden">{{ t('soundtrack.volume') }}</span>
          <input type="range" min="0" max="100" step="1" v-model.number="volume">
        </label>
      </div>
      <div class="sound-deck__timeline">
        <input type="range" min="0" :max="Math.floor(duration)" step="1" :value="Math.floor(shown)"
          :aria-label="t('soundtrack.position')"
          :aria-valuetext="t('soundtrack.positionValue', { time: spoken(shown), duration: spoken(duration) })"
          @input="onScrub" @change="onSeek">
        <span class="sound-deck__clock" aria-hidden="true">{{ clock(shown) }} / {{ clock(duration) }}</span>
      </div>
      <p v-if="state.failed" class="sound-deck__error" role="alert">{{ t('soundtrack.unavailable') }}</p>
      <p class="sound-deck__note">{{ t('soundtrack.note') }}</p>
    </div>
    <ol class="chapters" role="list" :aria-label="t('soundtrack.chaptersLabel')">
      <li v-for="(section, i) in sections" :key="section.key" class="chapter" :class="{ 'is-current': i === chapter }"
        :aria-current="i === chapter ? 'time' : null">
        <span class="chapter__num" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
        <div class="chapter__body">
          <h3 class="chapter__name">{{ chapterName(section) }}</h3>
          <p class="chapter__text">{{ t('soundtrack.chapters.' + section.key + '.text') }}</p>
        </div>
        <button type="button" class="chapter__play" @click="playFrom(section.start)"
          :aria-label="t('soundtrack.playFrom', { name: chapterName(section), time: spoken(section.start) })">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>
          <time :datetime="'PT' + Math.floor(section.start) + 'S'">{{ clock(section.start) }}</time>
        </button>
      </li>
    </ol>
    <p class="soundtrack__credits">{{ t('soundtrack.credits') }}</p>
  </div>
  `,
};
