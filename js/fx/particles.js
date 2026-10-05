/** Explosion d'éclats dorés triangulaires (écran de confirmation du formulaire). */
export function burst(canvas) {
  if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = width * dpr; canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  const gold = getComputedStyle(document.documentElement).getPropertyValue('--gold-hi').trim() || '#f5cf6e';
  const cx = width / 2, cy = 110;
  const parts = Array.from({ length: 90 }, () => {
    const a = Math.random() * Math.PI * 2;
    const v = 3 + Math.random() * 7;
    return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, s: 3 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, life: 1, d: 0.006 + Math.random() * 0.012 };
  });
  let raf, start = performance.now() + 1050; // synchronisé avec le tracé de la coche
  const frame = (t) => {
    raf = requestAnimationFrame(frame);
    if (t < start) return;
    ctx.clearRect(0, 0, width, height);
    let alive = 0;
    for (const p of parts) {
      if (p.life <= 0) continue;
      alive++;
      p.vx *= 0.985; p.vy = p.vy * 0.985 + 0.12; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= p.d;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = gold;
      ctx.beginPath(); ctx.moveTo(0, -p.s); ctx.lineTo(p.s * 0.8, p.s * 0.6); ctx.lineTo(-p.s * 0.8, p.s * 0.6); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    if (!alive) cancelAnimationFrame(raf);
  };
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}
