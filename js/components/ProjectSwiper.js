import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { projects, statusLabels } from '../data/projects.js';
import { art } from '../data/art.js';

const AUTOPLAY_MS = 7000;

/**
 * Carrousel 3D « coverflow » sans dépendance :
 * glisser à la souris ou au doigt, flèches du clavier, boutons, puces,
 * lecture automatique (mise en pause au survol, au focus et hors écran).
 */
export default {
  name: 'ProjectSwiper',
  setup() {
    const slides = projects.map((p) => ({
      ...p,
      statusLabel: statusLabels[p.status] || '',
      svg: p.image ? '' : (art[p.art] || art.classified)(p.id),
    }));
    const count = slides.length;
    const index = ref(0);
    const drag = ref(0);            // décalage en fraction de diapositive pendant le glissement
    const dragging = ref(false);
    const paused = ref(false);
    const visible = ref(false);
    const timerKey = ref(0);
    const root = ref(null);
    const viewport = ref(null);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const wrap = (i) => ((i % count) + count) % count;
    const offsetOf = (i) => {
      let d = i - index.value;
      if (d > count / 2) d -= count;
      if (d < -count / 2) d += count;
      return d + drag.value;
    };

    const styleFor = (i) => {
      const o = offsetOf(i);
      const a = Math.abs(o);
      const narrow = window.innerWidth < 700;
      const spread = narrow ? 88 : 62;
      return {
        transform: `translateX(${o * spread}%) translateZ(${-a * 220}px) rotateY(${-o * 28}deg) scale(${1 - Math.min(a, 2) * 0.08})`,
        opacity: a > 2.2 ? 0 : 1 - a * 0.42,
        zIndex: 100 - Math.round(a * 10),
        filter: a > 0.5 ? `grayscale(.6) brightness(${1 - Math.min(a, 1.5) * 0.3})` : 'none',
        pointerEvents: a > 0.5 ? 'none' : 'auto',
      };
    };

    const go = (i) => { index.value = wrap(i); timerKey.value++; };
    const next = () => go(index.value + 1);
    const prev = () => go(index.value - 1);

    // --- Lecture automatique
    let timer, t0 = 0, armed = false, remaining = AUTOPLAY_MS;
    const running = computed(() => !reduce && visible.value && !paused.value && !dragging.value);
    const schedule = () => {
      clearTimeout(timer); armed = false;
      if (!running.value) return;
      t0 = performance.now(); armed = true;
      timer = setTimeout(next, Math.max(0, remaining));
    };
    watch([index, timerKey], () => { remaining = AUTOPLAY_MS; schedule(); });
    watch(running, (r) => {
      if (r) return schedule();
      if (armed) remaining -= performance.now() - t0;
      clearTimeout(timer); armed = false;
    });

    // --- Glisser (Pointer Events)
    let startX = 0, startT = 0, width = 1, pid = null, moved = false;
    const onDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      pid = e.pointerId; startX = e.clientX; startT = performance.now(); moved = false;
      width = viewport.value.querySelector('.slide')?.offsetWidth || viewport.value.offsetWidth;
      dragging.value = true;
    };
    const onMove = (e) => {
      if (!dragging.value || e.pointerId !== pid) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 6 && !moved) { moved = true; viewport.value.setPointerCapture?.(pid); }
      drag.value = Math.max(-1.2, Math.min(1.2, dx / (width * 0.62)));
    };
    const onUp = (e) => {
      if (!dragging.value || (e && e.pointerId !== pid)) return;
      const velocity = drag.value / Math.max(1, performance.now() - startT) * 1000;
      const d = drag.value;
      dragging.value = false; drag.value = 0;
      if (d < -0.18 || velocity < -1.2) next();
      else if (d > 0.18 || velocity > 1.2) prev();
    };
    const onClickCapture = (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } };

    const onKey = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(count - 1); }
    };

    // Les animations SMIL ne tournent que sur la diapositive active
    const syncSvg = () => {
      root.value?.querySelectorAll('.slide').forEach((el, i) => {
        const svg = el.querySelector('svg');
        if (!svg?.pauseAnimations) return;
        i === index.value && visible.value && !reduce ? svg.unpauseAnimations() : svg.pauseAnimations();
      });
    };
    watch([index, visible], () => nextTick(syncSvg));

    let io;
    const onVis = () => { if (document.hidden) visible.value = false; };
    onMounted(() => {
      io = new IntersectionObserver(([en]) => { visible.value = en.isIntersecting && !document.hidden; }, { threshold: 0.35 });
      io.observe(root.value);
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('resize', onResize, { passive: true });
      syncSvg();
      schedule();
    });
    const tick = ref(0);
    const onResize = () => { tick.value++; };
    onBeforeUnmount(() => { io?.disconnect(); clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('resize', onResize); });

    const styles = computed(() => { tick.value; drag.value; index.value; return slides.map((_, i) => styleFor(i)); });

    return {
      slides, count, index, dragging, paused, running, timerKey, root, viewport, styles,
      go, next, prev, onDown, onMove, onUp, onKey, onClickCapture, AUTOPLAY_MS,
      pad: (n) => String(n).padStart(2, '0'),
    };
  },
  template: `
  <div ref="root" class="swiper" role="region" aria-roledescription="carrousel" aria-label="Projets"
       @mouseenter="paused = true" @mouseleave="paused = false" @focusin="paused = true" @focusout="paused = false">
    <div ref="viewport" class="swiper__viewport" :class="{ 'is-dragging': dragging }" tabindex="0" role="group"
         aria-label="Utilisez les flèches gauche et droite pour changer de projet"
         @keydown="onKey" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @lostpointercapture="onUp"
         @click.capture="onClickCapture" @dragstart.prevent>
      <article v-for="(s, i) in slides" :key="s.id" class="slide" :class="{ 'is-active': i === index }" :style="styles[i]"
        role="group" aria-roledescription="diapositive" :aria-label="(i + 1) + ' sur ' + count + ' : ' + s.title"
        :aria-hidden="i !== index ? 'true' : 'false'" :inert="i !== index || null">
        <div class="slide__card">
          <div class="slide__visual">
            <img v-if="s.image" :src="s.image" :alt="s.imageAlt || ''" width="760" height="400" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover">
            <div v-else v-html="s.svg" style="height:100%"></div>
          </div>
          <div class="slide__body">
            <p class="slide__status" :class="{ 'slide__status--soon': s.status !== 'live' }">{{ s.statusLabel }}</p>
            <h3 class="slide__title">{{ s.title }}</h3>
            <p class="slide__desc">{{ s.description }}</p>
            <ul class="slide__tags" role="list"><li v-for="t in s.tags" :key="t">{{ t }}</li></ul>
            <a v-if="s.url" class="slide__link" :href="s.url" :target="s.url.startsWith('http') ? '_blank' : null" :rel="s.url.startsWith('http') ? 'noopener' : null">
              {{ s.linkLabel || ('Découvrir ' + s.title) }}
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>
            </a>
          </div>
        </div>
      </article>
    </div>

    <div class="swiper__controls">
      <button class="icon-btn" type="button" @click="prev" aria-label="Projet précédent">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>
      </button>
      <div class="swiper__bullets">
        <button v-for="(s, i) in slides" :key="s.id" class="swiper__bullet" type="button"
          :aria-label="'Afficher ' + s.title" :aria-current="i === index ? 'true' : 'false'" @click="go(i)"></button>
      </div>
      <p class="swiper__counter" :aria-live="running ? 'off' : 'polite'"><b>{{ pad(index + 1) }}</b> / {{ pad(count) }}</p>
      <button class="icon-btn" type="button" @click="next" aria-label="Projet suivant" style="position:relative">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>
        <span :key="timerKey + '-' + index" class="swiper__timer" :class="{ 'is-running': true, 'is-paused': !running }" :style="{ '--autoplay': AUTOPLAY_MS + 'ms' }" aria-hidden="true"></span>
      </button>
    </div>
  </div>
  `,
};
