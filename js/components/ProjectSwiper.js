import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { projects } from '../data/projects.js';
import { playLinks } from '../data/platforms.js';
import { art } from '../data/art.js';

const AUTOPLAY_MS = 7000;
const PHONE = '(max-width: 600px)'; // même seuil que css/style.css
const SPREAD = 62;                  // écart entre deux cartes en « coverflow » (% de la largeur d'une carte)
const GAP = 12;                     // écart entre deux cartes sur téléphone (px)
const AXIS_LOCK = 8;                // déplacement (px) avant de choisir entre glisser et faire défiler la page

/**
 * Carrousel de projets sans dépendance : « coverflow » 3D sur grand écran, piste plate sur téléphone.
 * Glisser à la souris ou au doigt (la carte suit le doigt, un geste vertical fait défiler la page),
 * toucher une carte voisine, flèches du clavier, boutons, puces ou segments.
 * Lecture automatique mise en pause au survol, au focus et hors écran, arrêtée dès que le visiteur prend la main.
 */
export default {
  name: 'ProjectSwiper',
  setup() {
    const { t, te, tm, rt } = useI18n();
    /** Les liens d'une fiche : une plateforme où jouer chacun, sinon l'adresse du projet. */
    const linksFor = (p, title) => {
      const links = p.play
        ? playLinks(p).map(({ platform, url }) => ({ url, label: t('swiper.playOn', { platform }) }))
        : p.url ? [{ url: p.url, label: te(`projects.${p.id}.link`) ? t(`projects.${p.id}.link`) : t('swiper.discover', { title }) }] : [];
      return links.map((link) => ({ ...link, newTab: p.newTab || link.url.startsWith('http') }));
    };
    const slides = projects.map((p) => {
      const k = `projects.${p.id}`;
      const title = t(`${k}.title`);
      return {
        ...p,
        title,
        description: t(`${k}.description`),
        tags: (tm(`${k}.tags`) || []).map((m) => rt(m)),
        links: linksFor(p, title),
        statusLabel: t(`swiper.status.${p.status}`),
        svg: p.image ? '' : (art[p.art] || art.classified)(p.id, t),
      };
    });
    const count = slides.length;
    const index = ref(0);
    const drag = ref(0);            // décalage en fraction de diapositive pendant le glissement
    const dragging = ref(false);
    const paused = ref(false);
    const stopped = ref(false);     // le visiteur a pris la main : plus de lecture automatique
    const expanded = ref(false);    // description de la diapositive active dépliée (téléphone)
    const clamped = ref(slides.map(() => false));
    const visible = ref(false);
    const timerKey = ref(0);
    const root = ref(null);
    const viewport = ref(null);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const phoneQuery = window.matchMedia(PHONE);
    const phone = ref(phoneQuery.matches);

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
      if (phone.value) {
        // Piste plate : les voisines dépassent de quelques pixels sur les bords, sans filtre coûteux
        const s = 1 - Math.min(a, 1) * 0.06;
        return {
          transform: `translateX(calc(${o} * (100% + ${GAP}px) - ${Math.sign(o) * (1 - s) * 50}%)) scale(${s})`,
          opacity: a < 1 ? 1 - a * 0.55 : Math.max(0, 0.45 * (2 - a)),
          zIndex: 100 - Math.round(a * 10),
          pointerEvents: a > 0.5 ? 'none' : 'auto',
        };
      }
      return {
        transform: `translateX(${o * SPREAD}%) translateZ(${-a * 220}px) rotateY(${-o * 28}deg) scale(${1 - Math.min(a, 2) * 0.08})`,
        opacity: a > 2.2 ? 0 : 1 - a * 0.42,
        zIndex: 100 - Math.round(a * 10),
        filter: a > 0.5 ? `grayscale(.6) brightness(${1 - Math.min(a, 1.5) * 0.3})` : 'none',
        pointerEvents: a > 0.5 ? 'none' : 'auto',
      };
    };

    const go = (i) => { index.value = wrap(i); timerKey.value++; };
    const next = () => go(index.value + 1);
    const prev = () => go(index.value - 1);
    // Action du visiteur : la lecture automatique s'arrête
    const take = (fn) => (...args) => { stopped.value = true; fn(...args); };

    // --- Lecture automatique
    let timer, t0 = 0, armed = false, remaining = AUTOPLAY_MS;
    const autoplay = computed(() => !reduce && !stopped.value);
    const running = computed(() => autoplay.value && visible.value && !paused.value && !dragging.value && !expanded.value);
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

    // --- Glisser (Pointer Events) avec verrou d'axe
    let pid = null, startX = 0, startY = 0, axis = '', step = 1, samples = [], moved = false;
    // Largeur (px) d'un pas de diapositive : la carte suit le doigt au pixel près
    const stepPx = () => {
      const w = viewport.value.querySelector('.slide')?.offsetWidth || viewport.value.offsetWidth;
      return phone.value ? w + GAP : w * SPREAD / 100;
    };
    // Vitesse en diapositives par seconde sur les 120 dernières millisecondes
    const velocity = (now) => {
      const recent = samples.filter(([ts]) => now - ts <= 120);
      if (recent.length < 2) return 0;
      const [ta, xa] = recent[0], [tb, xb] = recent[recent.length - 1];
      return (xb - xa) / step / Math.max(16, tb - ta) * 1000;
    };
    const settle = (v) => {
      const d = drag.value;
      dragging.value = false; drag.value = 0;
      const dir = Math.abs(v) > 0.5 ? Math.sign(v) : Math.abs(d) > 0.35 ? Math.sign(d) : 0;
      if (dir < 0) next();
      else if (dir > 0) prev();
    };
    const onDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      pid = e.pointerId; startX = e.clientX; startY = e.clientY; axis = ''; moved = false;
      samples = [[e.timeStamp, e.clientX]];
    };
    const onMove = (e) => {
      if (e.pointerId !== pid) return;
      if (!axis) {
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (Math.hypot(dx, dy) < AXIS_LOCK) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (axis === 'y') return; // la page défile (touch-action: pan-y)
        moved = true; stopped.value = true; dragging.value = true; step = stepPx();
        viewport.value.setPointerCapture?.(pid);
      }
      if (axis !== 'x') return;
      samples.push([e.timeStamp, e.clientX]);
      if (samples.length > 12) samples.shift();
      drag.value = Math.max(-1.1, Math.min(1.1, (e.clientX - startX) / step));
    };
    const onUp = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      if (axis === 'x') settle(velocity(e.timeStamp));
      else if (!axis) {
        stopped.value = true;
        // Toucher une carte voisine l'amène au centre
        if (!e.target.closest?.('.slide.is-active')) {
          const r = viewport.value.getBoundingClientRect();
          e.clientX > r.left + r.width / 2 ? next() : prev();
        }
      }
      axis = '';
    };
    const onCancel = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      if (axis === 'x') settle(0);
      axis = '';
    };
    const onClickCapture = (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } };

    const onKey = (e) => {
      const keys = { ArrowRight: next, ArrowLeft: prev, Home: () => go(0), End: () => go(count - 1) };
      if (!keys[e.key]) return;
      e.preventDefault();
      take(keys[e.key])();
    };

    // --- Description repliée sur téléphone : « Lire la suite » seulement si le texte dépasse
    const measure = () => {
      if (expanded.value || !root.value) return;
      const next = [...root.value.querySelectorAll('.slide__desc')].map((el) => el.scrollHeight > el.clientHeight + 1);
      if (next.some((v, i) => v !== clamped.value[i])) clamped.value = next;
    };
    const toggle = take(() => { expanded.value = !expanded.value; });
    watch(index, () => { expanded.value = false; });
    watch(expanded, (v) => { if (!v) nextTick(measure); });

    // Les animations SMIL ne tournent que sur la diapositive active
    const syncSvg = () => {
      root.value?.querySelectorAll('.slide').forEach((el, i) => {
        const svg = el.querySelector('svg');
        if (!svg?.pauseAnimations) return;
        i === index.value && visible.value && !reduce ? svg.unpauseAnimations() : svg.pauseAnimations();
      });
    };
    watch([index, visible], () => nextTick(syncSvg));

    let io, ro, frame = 0;
    const onVis = () => { if (document.hidden) visible.value = false; };
    // Les hauteurs se lisent à l'image suivante, la mise en page faite : jamais pendant le montage
    // (une lecture forcée y allongeait la tâche de démarrage).
    const remeasure = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const onPhone = (e) => { phone.value = e.matches; nextTick(measure); };
    onMounted(() => {
      io = new IntersectionObserver(([en]) => { visible.value = en.isIntersecting && !document.hidden; }, { threshold: 0.35 });
      io.observe(root.value);
      ro = new ResizeObserver(remeasure);
      ro.observe(root.value);
      document.addEventListener('visibilitychange', onVis);
      phoneQuery.addEventListener('change', onPhone);
      document.fonts?.ready.then(remeasure);
      syncSvg();
      schedule();
    });
    onBeforeUnmount(() => {
      io?.disconnect(); ro?.disconnect(); clearTimeout(timer); cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVis);
      phoneQuery.removeEventListener('change', onPhone);
    });

    const styles = computed(() => slides.map((_, i) => styleFor(i)));

    return {
      slides, count, index, dragging, paused, running, autoplay, expanded, clamped, timerKey, root, viewport, styles,
      go: take(go), next: take(next), prev: take(prev), toggle,
      onDown, onMove, onUp, onCancel, onKey, onClickCapture, AUTOPLAY_MS, t,
      pad: (n) => String(n).padStart(2, '0'),
    };
  },
  template: `
  <div ref="root" class="swiper" role="region" :aria-roledescription="t('swiper.roledescription')" :aria-label="t('swiper.region')"
       @mouseenter="paused = true" @mouseleave="paused = false" @focusin="paused = true" @focusout="paused = false">
    <div ref="viewport" class="swiper__viewport" :class="{ 'is-dragging': dragging }" tabindex="0" role="group"
         :aria-label="t('swiper.viewport')"
         @keydown="onKey" @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onCancel" @lostpointercapture.self="onCancel"
         @click.capture="onClickCapture" @dragstart.prevent>
      <article v-for="(s, i) in slides" :key="s.id" class="slide" :class="{ 'is-active': i === index, 'is-expanded': expanded && i === index }" :style="styles[i]"
        role="group" :aria-roledescription="t('swiper.slideRole')" :aria-label="t('swiper.slideLabel', { n: i + 1, count, title: s.title })"
        :aria-hidden="i !== index ? 'true' : 'false'" :inert="i !== index || null">
        <div class="slide__card">
          <div class="slide__visual">
            <img v-if="s.image" class="slide__art" :src="s.image" :alt="s.imageAlt || ''" width="760" height="400" loading="lazy" decoding="async">
            <div v-else class="slide__art" v-html="s.svg"></div>
          </div>
          <div class="slide__body">
            <p class="slide__status" :class="{ 'slide__status--soon': s.status !== 'live' }">{{ s.statusLabel }}</p>
            <h3 class="slide__title">{{ s.title }}</h3>
            <p :id="'swiper-desc-' + s.id" class="slide__desc">{{ s.description }}</p>
            <button v-if="clamped[i]" class="slide__more" type="button" :aria-controls="'swiper-desc-' + s.id"
              :aria-expanded="expanded && i === index ? 'true' : 'false'" @click="toggle">
              {{ expanded && i === index ? t('swiper.less') : t('swiper.more') }}
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>
            </button>
            <ul class="slide__tags" role="list"><li v-for="t in s.tags" :key="t">{{ t }}</li></ul>
            <div v-if="s.links.length" class="slide__links">
              <a v-for="l in s.links" :key="l.url" class="slide__link" :href="l.url" :target="l.newTab ? '_blank' : null" :rel="l.newTab ? 'noopener' : null">
                {{ l.label }}
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>
              </a>
            </div>
          </div>
        </div>
      </article>
    </div>

    <div class="swiper__controls">
      <button class="icon-btn" type="button" @click="prev" :aria-label="t('swiper.prev')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>
      </button>
      <div class="swiper__bullets">
        <button v-for="(s, i) in slides" :key="s.id" class="swiper__bullet" type="button"
          :aria-label="t('swiper.show', { title: s.title })" :aria-current="i === index ? 'true' : 'false'" @click="go(i)"></button>
      </div>
      <div class="swiper__meter">
        <p class="swiper__counter" :aria-live="running ? 'off' : 'polite'"><b>{{ pad(index + 1) }}</b> / {{ pad(count) }}</p>
        <div class="swiper__segments" aria-hidden="true">
          <span v-for="(s, i) in slides" :key="s.id" class="swiper__segment" :class="{ 'is-active': i === index, 'is-timed': i === index && autoplay }">
            <i v-if="i === index && autoplay" :key="timerKey + '-' + index" :class="{ 'is-paused': !running }" :style="{ '--autoplay': AUTOPLAY_MS + 'ms' }"></i>
          </span>
        </div>
      </div>
      <button class="icon-btn" type="button" @click="next" :aria-label="t('swiper.next')" style="position:relative">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>
        <span v-if="autoplay" :key="timerKey + '-' + index" class="swiper__timer is-running" :class="{ 'is-paused': !running }" :style="{ '--autoplay': AUTOPLAY_MS + 'ms' }" aria-hidden="true"></span>
      </button>
    </div>
  </div>
  `,
};
