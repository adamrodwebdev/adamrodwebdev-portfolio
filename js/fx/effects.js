/* Effets d'interface : révélations, décodage de texte, curseur, inclinaison 3D,
   boutons magnétiques, horloge et champ d'éclats du hero. */

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(pointer: fine)').matches;

/* ---------- Révélations au défilement ---------- */
export function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || reduce) { els.forEach((e) => e.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      en.target.querySelectorAll('[data-scramble]').forEach(scramble);
      io.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  els.forEach((e) => io.observe(e));
}

/* ---------- Décodage de texte façon terminal ---------- */
const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>[]';
export function scramble(el) {
  if (reduce || el.dataset.done) return;
  el.dataset.done = '1';
  const final = el.textContent;
  // hauteur figée pour éviter tout décalage de mise en page
  el.style.minHeight = el.offsetHeight + 'px';
  const DURATION = 750, t0 = performance.now();
  const tick = () => {
    const progress = Math.min(1, (performance.now() - t0) / DURATION);
    if (progress >= 1) { el.textContent = final; clearInterval(iv); return; }
    el.textContent = [...final].map((ch, i) => {
      if (ch === ' ' || i / final.length < progress) return ch;
      return glyphs[(Math.random() * glyphs.length) | 0];
    }).join('');
  };
  // minuterie basée sur le temps réel : le texte final est garanti même si l'onglet est ralenti
  const iv = setInterval(tick, 40);
  tick();
}

/* ---------- Curseur personnalisé ---------- */
export function initCursor() {
  const cur = document.querySelector('.cursor');
  if (!cur || !fine || reduce) return;
  const ring = cur.querySelector('.cursor__ring');
  const dot = cur.querySelector('.cursor__dot');
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, shown = false;
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY;
    if (!shown) { shown = true; rx = x; ry = y; cur.classList.add('is-ready'); }
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, { passive: true });
  const interactive = 'a, button, input, select, textarea, label, [tabindex="0"]';
  addEventListener('pointerover', (e) => cur.classList.toggle('is-hover', !!e.target.closest?.(interactive)));
  addEventListener('pointerdown', () => cur.classList.add('is-down'));
  addEventListener('pointerup', () => cur.classList.remove('is-down'));
  document.addEventListener('mouseleave', () => cur.classList.remove('is-ready'));
  document.addEventListener('mouseenter', () => shown && cur.classList.add('is-ready'));
  const loop = () => {
    rx += (x - rx) * 0.2; ry += (y - ry) * 0.2;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    requestAnimationFrame(loop);
  };
  loop();
}

/* ---------- Inclinaison 3D + halo suivant la souris ---------- */
export function initTilt() {
  if (!fine || reduce) return;
  document.querySelectorAll('.tilt').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--ry', `${(px - 0.5) * 10}deg`);
      el.style.setProperty('--rx', `${(0.5 - py) * 10}deg`);
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  });
}

/* ---------- Boutons magnétiques (délégation : fonctionne aussi pour les composants Vue) ---------- */
export function initMagnetic() {
  if (!fine || reduce) return;
  let current = null;
  addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('.magnetic');
    if (current && current !== el) { current.style.transform = ''; current = null; }
    if (!el || el.disabled) return;
    current = el;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${dx * 0.18}px, ${dy * 0.3}px)`;
  }, { passive: true });
}

/* ---------- Horloge (heure de Paris) ---------- */
export function initClock() {
  const el = document.querySelector('[data-clock]');
  const fmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Paris' });
  const tick = () => { if (el) el.textContent = fmt.format(new Date()); };
  tick(); setInterval(tick, 1000);
  const y = document.querySelector('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
}

/* ---------- Barre de progression (secours si scroll-timeline absent) ---------- */
export function initProgress() {
  if (CSS.supports?.('animation-timeline: scroll()')) return;
  const bar = document.querySelector('.scroll-progress');
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar?.style.setProperty('--progress', max > 0 ? (scrollY / max).toFixed(4) : 0);
  };
  addEventListener('scroll', update, { passive: true }); update();
}

/* ---------- Champ d'éclats dorés du hero (canvas 2D) ---------- */
export function initShards() {
  const canvas = document.querySelector('.hero__shards');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const hero = canvas.parentElement;
  let w, h, dpr, shards = [], mx = 0, my = 0, tmx = 0, tmy = 0, visible = true, raf, gold, line;

  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    gold = cs.getPropertyValue('--gold').trim();
    line = cs.getPropertyValue('--gold-hi').trim();
  };
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(46, (w * h) / 26000));
    shards = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      z: 0.3 + Math.random() * 0.9,
      s: 6 + Math.random() * 26,
      r: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.004,
      vy: -(0.08 + Math.random() * 0.25),
      fill: Math.random() < 0.35,
    }));
  };
  const draw = (static_) => {
    ctx.clearRect(0, 0, w, h);
    mx += (tmx - mx) * 0.05; my += (tmy - my) * 0.05;
    for (const p of shards) {
      if (!static_) { p.y += p.vy * p.z; p.r += p.vr; if (p.y < -40) { p.y = h + 40; p.x = Math.random() * w; } }
      const x = p.x + mx * 30 * p.z, y = p.y + my * 30 * p.z;
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.r);
      ctx.globalAlpha = 0.12 + p.z * 0.35;
      ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.lineTo(p.s * 0.55, p.s * 0.7); ctx.lineTo(-p.s * 0.75, p.s * 0.35); ctx.closePath();
      if (p.fill) { ctx.fillStyle = gold; ctx.fill(); } else { ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.restore();
    }
  };
  const loop = () => { draw(false); raf = visible ? requestAnimationFrame(loop) : null; };

  readColors(); resize();
  if (reduce) { draw(true); }
  else {
    loop();
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && !raf) loop(); }).observe(hero);
    if (fine) addEventListener('pointermove', (e) => { tmx = e.clientX / innerWidth - 0.5; tmy = e.clientY / innerHeight - 0.5; }, { passive: true });
  }
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); if (reduce) draw(true); }, 150); });
  new MutationObserver(() => { readColors(); if (reduce) draw(true); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

/* ---------- Effet de « glitch » au survol des titres ---------- */
export function initGlitch() {
  if (reduce) return;
  document.querySelectorAll('.section__title').forEach((t) => {
    t.addEventListener('pointerenter', () => {
      t.classList.remove('glitch-once'); void t.offsetWidth; t.classList.add('glitch-once');
    });
  });
}
