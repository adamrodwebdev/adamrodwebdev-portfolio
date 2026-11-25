import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { clock, minutesSeconds } from '../audio/score.js';
import { useTheme } from '../composables/useTheme.js';

/**
 * Le lecteur de la section « Bande-son » (1.12.0) : lecture, position, volume, les cinq parties du morceau.
 * L'état vient de la bande-son partagée (fournie par islands.js), que l'interrupteur de l'en-tête pilote aussi.
 * Au-dessus, le logo en grains d'or (1.21.0, js/fx/soundtrack-grains.js), chargé à l'approche de la section.
 */
export default {
  name: 'SoundtrackPlayer',
  setup() {
    const { t } = useI18n();
    const soundtrack = inject('soundtrack');
    const { state, sections, duration, title } = soundtrack;
    const { isDark } = useTheme();
    const stage = ref(null);
    const canvas = ref(null);
    /** Position affichée pendant qu'on fait glisser le curseur, avant de la valider */
    const scrub = ref(null);

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

    // Le logo en grains : chargé quand la section approche (une hauteur d'écran avant), jamais au démarrage.
    // Sans WebGL2 ni Canvas 2D, ou si le fichier manque, la scène reste vide et rien d'autre ne change.
    let grains = null;
    let near = null;
    let destroyed = false;
    async function startGrains() {
      try {
        const { SoundtrackGrains } = await import('../fx/soundtrack-grains.js');
        const started = await SoundtrackGrains.start(canvas.value, { soundtrack, dark: isDark.value });
        if (destroyed) { started.destroy(); return; }
        grains = started;
        stage.value?.classList.add('is-ready');
        grains.setPlaying(state.playing);
      } catch {
        stage.value?.classList.add('is-empty');
      }
    }
    watch(() => state.playing, (playing) => grains?.setPlaying(playing));
    watch(soundtrack.chapter, (now, before) => { if (now >= 0 && before >= 0 && now !== before) grains?.newPart(); });
    watch(isDark, (dark) => grains?.setDark(dark));
    onMounted(() => {
      if (!('IntersectionObserver' in window)) { startGrains(); return; }
      near = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        near.disconnect();
        startGrains();
      }, { rootMargin: '100% 0px' });
      near.observe(stage.value);
    });
    onBeforeUnmount(() => { destroyed = true; near?.disconnect(); grains?.destroy(); });

    return {
      t, state, sections, duration, title, facts, shown, volume, stage, canvas, clock, spoken, chapterName,
      chapter: soundtrack.chapter, toggle: soundtrack.toggle, onScrub, onSeek, playFrom,
    };
  },
  template: `
  <div class="soundtrack__grid">
    <div class="sound-deck">
      <div ref="stage" class="sound-deck__stage" aria-hidden="true"><canvas ref="canvas" class="sound-deck__grains"></canvas></div>
      <div class="sound-deck__head">
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
