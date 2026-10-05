/* Illustrations vectorielles des projets (animées quand la diapositive est active). */

const grid = `
  <defs>
    <pattern id="g-{id}" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" class="a-grid"/>
    </pattern>
    <radialGradient id="r-{id}" cx="50%" cy="60%" r="60%">
      <stop offset="0" class="a-stop-glow"/>
      <stop offset="1" class="a-stop-none"/>
    </radialGradient>
  </defs>
  <rect width="760" height="400" fill="url(#g-{id})"/>
  <rect width="760" height="400" fill="url(#r-{id})"/>`;

const catapult = (id) => `
<svg viewBox="0 0 760 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration : une catapulte lance un projectile vers une tour de blocs">
  ${grid.replaceAll('{id}', id)}
  <path d="M0 330H760" class="a-line"/>
  <path d="M0 338H760" class="a-soft" stroke-dasharray="4 10"/>
  <!-- trajectoire -->
  <path d="M200 205 Q 380 20 560 230" class="a-line a-dash art-anim" pathLength="1"/>
  <circle r="9" class="a-fill art-anim a-projectile"><animateMotion dur="2.6s" repeatCount="indefinite" path="M200 205 Q 380 20 560 230" keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".3 0 .7 1"/></circle>
  <!-- catapulte -->
  <g class="a-catapult">
    <path d="M110 330 140 290H240L270 330" class="a-line"/>
    <circle cx="140" cy="330" r="16" class="a-line"/>
    <circle cx="240" cy="330" r="16" class="a-line"/>
    <path d="M190 290V250L210 290" class="a-line"/>
    <g class="a-arm art-anim">
      <path d="M190 252 120 300" class="a-line a-thick"/>
      <path d="M190 252 222 205" class="a-line a-thick"/>
      <path d="M210 196h24l-6 14h-12Z" class="a-fill"/>
    </g>
  </g>
  <!-- tour de blocs -->
  <g class="a-tower art-anim">
    <rect x="560" y="290" width="40" height="40" class="a-line"/>
    <rect x="600" y="290" width="40" height="40" class="a-line"/>
    <rect x="640" y="290" width="40" height="40" class="a-line"/>
    <rect x="580" y="250" width="40" height="40" class="a-line"/>
    <rect x="620" y="250" width="40" height="40" class="a-line"/>
    <rect x="600" y="210" width="40" height="40" class="a-fill a-pulse art-anim"/>
    <path d="M620 210V180l18 8-18 8" class="a-line"/>
  </g>
  <g class="a-hud">
    <text x="40" y="56" class="a-text">ANGLE 42°</text>
    <text x="40" y="80" class="a-text">PUISSANCE 87 %</text>
    <path d="M40 92h120" class="a-line"/>
    <path d="M40 92h104" class="a-line a-thick art-anim a-meter"/>
  </g>
</svg>`;

const bastion = (id) => {
  // Fort en étoile (tracé trace italienne) calculé
  const pts = (n, R, r, cx, cy, rot = -Math.PI / 2) => {
    const out = [];
    for (let i = 0; i < n * 2; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = rot + (i * Math.PI) / n;
      out.push(`${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`);
    }
    return out.join(' ');
  };
  return `
<svg viewBox="0 0 760 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration : plan d'une forteresse en étoile vue du ciel, balayée par un radar">
  ${grid.replaceAll('{id}', id)}
  <g transform="translate(0 0)">
    <polygon points="${pts(5, 165, 95, 380, 205)}" class="a-line a-soft-fill"/>
    <polygon points="${pts(5, 130, 76, 380, 205)}" class="a-line a-dash-static"/>
    <polygon points="${pts(5, 58, 34, 380, 205, Math.PI / 2)}" class="a-fill a-pulse art-anim"/>
    <circle cx="380" cy="205" r="190" class="a-soft"/>
    <g class="a-radar art-anim">
      <path d="M380 205 L380 15 A190 190 0 0 1 514 71 Z" class="a-sweep"/>
      <path d="M380 205 L380 15" class="a-line"/>
    </g>
    <g class="a-blips">
      <rect x="560" y="90" width="10" height="10" class="a-fill art-anim a-blink"/>
      <rect x="170" y="300" width="10" height="10" class="a-fill art-anim a-blink" style="animation-delay:-1s"/>
      <rect x="600" y="300" width="10" height="10" class="a-fill art-anim a-blink" style="animation-delay:-2s"/>
    </g>
  </g>
  <text x="40" y="56" class="a-text">SECTEUR 7 SÉCURISÉ</text>
  <text x="40" y="80" class="a-text">REMPARTS 5/5</text>
</svg>`;
};

const classified = (id) => `
<svg viewBox="0 0 760 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration : dossier verrouillé en cours de déchiffrement">
  ${grid.replaceAll('{id}', id)}
  <g class="a-float art-anim">
    <path d="M380 70 470 122v104l-90 52-90-52V122Z" class="a-line a-soft-fill"/>
    <path d="M380 100 444 137v74l-64 37-64-37v-74Z" class="a-line a-dash-static"/>
    <rect x="350" y="170" width="60" height="46" class="a-fill"/>
    <path d="M362 170v-16a18 18 0 0 1 36 0v16" class="a-line a-thick"/>
  </g>
  <g class="a-scan art-anim"><rect x="0" y="0" width="760" height="3" class="a-fill" opacity=".6"/></g>
  <g class="a-bars">
    <rect x="200" y="320" width="120" height="12" class="a-fill art-anim a-blink"/>
    <rect x="330" y="320" width="60" height="12" class="a-fill art-anim a-blink" style="animation-delay:-.6s"/>
    <rect x="400" y="320" width="160" height="12" class="a-fill art-anim a-blink" style="animation-delay:-1.2s"/>
  </g>
  <text x="40" y="56" class="a-text">ACCÈS RESTREINT</text>
  <text x="40" y="80" class="a-text">DÉCHIFFREMENT EN COURS</text>
</svg>`;

export const art = { catapult, bastion, classified };
