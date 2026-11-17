/* Illustrations vectorielles des projets (animées quand la diapositive est active).
   Chaque fonction reçoit l'identifiant du projet et la fonction de traduction t() de vue-i18n. */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

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

const catapult = (id, t) => `
<svg viewBox="0 0 760 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(t('art.catapultAlt'))}">
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
    <text x="40" y="56" class="a-text">${esc(t('art.angle'))}</text>
    <text x="40" y="80" class="a-text">${esc(t('art.power'))}</text>
    <path d="M40 92h120" class="a-line"/>
    <path d="M40 92h104" class="a-line a-thick art-anim a-meter"/>
  </g>
</svg>`;

const bastion = (id, t) => {
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
<svg viewBox="0 0 760 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(t('art.bastionAlt'))}">
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
      <rect x="170" y="300" width="10" height="10" class="a-fill art-anim a-blink"/>
      <rect x="600" y="300" width="10" height="10" class="a-fill art-anim a-blink"/>
    </g>
  </g>
  <text x="40" y="56" class="a-text">${esc(t('art.sector'))}</text>
  <text x="40" y="80" class="a-text">${esc(t('art.ramparts'))}</text>
</svg>`;
};

const classified = (id, t) => `
<svg viewBox="0 0 760 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(t('art.classifiedAlt'))}">
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
    <rect x="330" y="320" width="60" height="12" class="a-fill art-anim a-blink"/>
    <rect x="400" y="320" width="160" height="12" class="a-fill art-anim a-blink"/>
  </g>
  <text x="40" y="56" class="a-text">${esc(t('art.restricted'))}</text>
  <text x="40" y="80" class="a-text">${esc(t('art.decrypting'))}</text>
</svg>`;

const darts = (id, t) => {
  // Cible de fléchettes : 20 secteurs, anneaux simple / triple / double, bull
  const cx = 380, cy = 205, R = 150;
  const rings = [R, R * 0.94, R * 0.62, R * 0.56, R * 0.12, R * 0.05];
  const order = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  let spokes = '', labels = '';
  for (let i = 0; i < 20; i++) {
    const a = ((i * 18 - 99) * Math.PI) / 180;
    spokes += `<path d="M${(cx + Math.cos(a) * rings[4]).toFixed(1)} ${(cy + Math.sin(a) * rings[4]).toFixed(1)}L${(cx + Math.cos(a) * R).toFixed(1)} ${(cy + Math.sin(a) * R).toFixed(1)}" class="a-soft"/>`;
    const b = ((i * 18 - 90) * Math.PI) / 180;
    labels += `<text x="${(cx + Math.cos(b) * (R + 20)).toFixed(1)}" y="${(cy + Math.sin(b) * (R + 20) + 6).toFixed(1)}" text-anchor="middle" class="a-num">${order[i]}</text>`;
  }
  // Secteur du triple 20 (en haut), mis en valeur
  const arc = (r1, r2, a1, a2) => {
    const p = (r, a) => `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
    return `M${p(r1, a1)}A${r1} ${r1} 0 0 1 ${p(r1, a2)}L${p(r2, a2)}A${r2} ${r2} 0 0 0 ${p(r2, a1)}Z`;
  };
  const t20 = arc(rings[2], rings[3], (-99 * Math.PI) / 180, (-81 * Math.PI) / 180);
  const ty = cy - R * 0.59;
  return `
<svg viewBox="0 0 760 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(t('art.dartsAlt'))}">
  ${grid.replaceAll('{id}', id)}
  <g class="a-board">
    <circle cx="${cx}" cy="${cy}" r="${R + 34}" class="a-soft"/>
    ${rings.map((r, i) => `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" class="${i === 0 || i === 2 ? 'a-line' : 'a-soft'}"/>`).join('')}
    ${spokes}
    <path d="${t20}" class="a-fill a-pulse art-anim"/>
    <circle cx="${cx}" cy="${cy}" r="${rings[5].toFixed(1)}" class="a-fill"/>
    ${labels}
  </g>
  <g transform="translate(${cx} ${ty.toFixed(1)})"><g class="a-dart art-anim">
    <path d="M0 0 L-46 -30" class="a-line a-thick"/>
    <path d="M-46 -30 L-70 -50 M-58 -38 L-62 -60 M-58 -38 L-80 -38" class="a-line"/>
    <path d="M0 0 L-8 -12 L-12 -6 Z" class="a-fill"/>
  </g></g>
  <circle cx="${cx}" cy="${ty.toFixed(1)}" r="10" class="a-line a-impact art-anim"/>
  <text x="40" y="56" class="a-text">${esc(t('art.triple'))}</text>
  <text x="40" y="80" class="a-text">${esc(t('art.score'))}</text>
</svg>`;
};

const marbles = (id, t) => {
  // Une chaîne de billes en spirale vers le trou ; un tir fait éclater un groupe de trois
  const cx = 470, cy = 210;
  const at = (k) => {
    const a = k * 0.42 + 0.6;
    const r = 170 - k * 6.2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.82];
  };
  let track = '';
  for (let k = 0; k <= 22; k += 0.25) {
    const [x, y] = at(k);
    track += `${k === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  const burst = [4, 5, 6];
  let balls = '';
  for (let k = 0; k < 16; k++) {
    const [x, y] = at(k);
    const r = (15 - k * 0.45).toFixed(1);
    const cls = burst.includes(k) ? 'a-fill a-burst art-anim' : k % 3 === 0 ? 'a-line a-soft-fill' : 'a-line';
    balls += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" class="${cls}"/>`;
  }
  const [hx, hy] = at(22);
  const [tx, ty] = at(5);
  const shot = `M150 300 L${tx.toFixed(1)} ${ty.toFixed(1)}`;
  return `
<svg viewBox="0 0 760 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(t('art.marblesAlt'))}">
  ${grid.replaceAll('{id}', id)}
  <path d="${track}" class="a-soft"/>
  <circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="14" class="a-fill a-pulse art-anim"/>
  ${balls}
  <circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="16" class="a-line a-impact art-anim"/>
  <path d="${shot}" class="a-soft a-dash-static"/>
  <circle r="11" class="a-fill art-anim"><animateMotion dur="2.6s" repeatCount="indefinite" path="${shot}" keyPoints="0;1;1" keyTimes="0;0.3;1" calcMode="linear"/></circle>
  <g class="a-shooter">
    <circle cx="150" cy="300" r="30" class="a-line a-soft-fill"/>
    <circle cx="150" cy="300" r="11" class="a-fill"/>
  </g>
  <text x="40" y="56" class="a-text">${esc(t('art.combo'))}</text>
  <text x="40" y="80" class="a-text">${esc(t('art.chain'))}</text>
</svg>`;
};

const lumirift = (id, t) => {
  // Un puits presque plein : une barre tombe dans le trou et fait éclater quatre lignes
  const x0 = 300, y0 = 100, s = 20, gap = 5;
  const cell = (c, r, cls) => `<rect x="${x0 + c * s + 1}" y="${y0 + r * s + 1}" width="${s - 2}" height="${s - 2}" class="${cls}"/>`;
  let rows = '';
  for (let r = 6; r < 10; r++) {
    for (let c = 0; c < 8; c++) {
      if (c === gap) continue;
      const solid = (c * 3 + r) % 4 === 0;
      rows += cell(c, r, `${solid ? 'a-fill' : 'a-line a-soft-fill'} a-burst art-anim`);
    }
  }
  let bar = '';
  let ghost = '';
  for (let r = 6; r < 10; r++) {
    bar += cell(gap, r, 'a-fill a-piece art-anim');
    ghost += cell(gap, r, 'a-soft a-dash-static');
  }
  let next = '';
  for (const [c, r] of [[0, 1], [1, 1], [2, 1], [1, 0]]) {
    next += `<rect x="${540 + c * 16}" y="${134 + r * 16}" width="14" height="14" class="a-line a-soft-fill"/>`;
  }
  return `
<svg viewBox="0 0 760 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(t('art.lumiriftAlt'))}">
  ${grid.replaceAll('{id}', id)}
  <path d="M384 0 372 70 392 130 368 200 394 262 374 326 386 400" class="a-soft a-dash-static"/>
  <path d="M${x0} ${y0}V${y0 + 10 * s}H${x0 + 8 * s}V${y0}" class="a-line a-thick"/>
  ${ghost}
  ${rows}
  <g class="a-drop art-anim">${bar}</g>
  <rect x="516" y="112" width="96" height="76" class="a-soft"/>
  ${next}
  <text x="40" y="56" class="a-text">${esc(t('art.lines'))}</text>
  <text x="40" y="80" class="a-text">${esc(t('art.modes'))}</text>
</svg>`;
};

const plumb = (id, t) => {
  // Vue éclatée de la fléchette Plumb : pointe, fût à bagues, tige et ailette écartées sur leur axe
  // (l’état de repos, aussi celui du mouvement réduit), qui se rassemblent puis s’écartent de nouveau.
  const y = 228;
  const rings = Array.from({ length: 9 }, (_, i) => `M${262 + i * 14} ${y - 22}v44`).join('');
  return `
<svg viewBox="0 0 760 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(t('art.plumbAlt'))}">
  ${grid.replaceAll('{id}', id)}
  <path d="M40 ${y}H720" class="a-soft a-dash-static"/>
  <g class="a-plumb">
    <g class="art-anim"><path d="M70 ${y}L190 ${y - 5}v10Z" class="a-fill"/></g>
    <g class="art-anim">
      <rect x="230" y="${y - 24}" width="190" height="48" rx="22" class="a-line"/>
      <path d="${rings}" class="a-soft"/>
      <path d="M400 ${y - 23}v46" class="a-line a-thick"/>
    </g>
    <g class="art-anim"><path d="M460 ${y - 8}h120v16H460Z" class="a-line"/></g>
    <g class="art-anim">
      <path d="M600 ${y}L650 ${y - 62}h70l-30 62 30 62h-70Z" class="a-line"/>
      <path d="M612 ${y}H708" class="a-soft"/>
    </g>
  </g>
  <text x="40" y="56" class="a-text">${esc(t('art.exploded'))}</text>
  <text x="40" y="80" class="a-text">${esc(t('art.lighthouse'))}</text>
</svg>`;
};

const cordeau = (id, t) => {
  // La GT Aplomb Cordeau de profil sur une route mouillée : roues qui tournent, marquage qui défile,
  // un reflet qui glisse sur la carrosserie (découpé par sa silhouette) et le bandeau lumineux qui pulse.
  // Au repos (mouvement réduit), la voiture est à l’arrêt et le reflet hors du cadre.
  const body = 'M150 282L148 252Q150 238 172 233L232 226C276 210 300 184 346 178L456 176C490 178 510 196 532 210L640 222Q668 226 670 246L666 274Q664 284 650 286H575A40 40 0 0 0 495 286H285A40 40 0 0 0 205 286H162Q150 286 150 282Z';
  const wheel = (cx) => {
    const spokes = Array.from({ length: 5 }, (_, i) => {
      const a = (i * 72 * Math.PI) / 180;
      return `M${cx} 278L${(cx + Math.cos(a) * 19).toFixed(1)} ${(278 + Math.sin(a) * 19).toFixed(1)}`;
    }).join('');
    return `
    <circle cx="${cx}" cy="278" r="29" class="a-line a-soft-fill"/>
    <g class="a-wheel art-anim"><circle cx="${cx}" cy="278" r="19" class="a-soft"/><path d="${spokes}" class="a-line"/></g>
    <circle cx="${cx}" cy="278" r="4" class="a-fill"/>`;
  };
  return `
<svg viewBox="0 0 760 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(t('art.cordeauAlt'))}">
  ${grid.replaceAll('{id}', id)}
  <defs><clipPath id="c-${id}"><path d="${body}"/></clipPath></defs>
  <path d="M0 308H760" class="a-line"/>
  <path d="M60 326H700" class="a-soft a-dash-static"/>
  <path d="M760 346H0" class="a-line a-dash art-anim" pathLength="1"/>
  <path d="${body}" class="a-line a-soft-fill"/>
  <g clip-path="url(#c-${id})"><path d="M-140 150h60l-40 160h-60Z" class="a-sweep a-shine art-anim"/></g>
  <path d="M262 228C298 208 322 192 352 190L452 188C478 190 494 202 508 214Z" class="a-line"/>
  <path d="M402 189L404 221M404 222L406 284M506 216L500 284M300 226L292 284M180 244L640 236" class="a-soft"/>
  <path d="M614 228L666 236L665 241L613 233Z" class="a-fill a-pulse art-anim"/>
  <path d="M150 250L178 244V248L150 254Z" class="a-fill"/>
  ${wheel(245)}
  ${wheel(535)}
  <text x="40" y="56" class="a-text">${esc(t('art.configurator'))}</text>
  <text x="40" y="80" class="a-text">${esc(t('art.realtime'))}</text>
</svg>`;
};

const cocorico = (id, t) => {
  // La basse-cour de Cocorico : un coq qui chante, une poule et un poussin qui picorent, un œuf,
  // et la jauge de l’accueil (« 9 semaines sur 12 »). Traits fins quel que soit l’agrandissement.
  const n = 'vector-effect="non-scaling-stroke"';
  const bird = ({ x, s, kind }) => {
    const rooster = kind === 'rooster';
    const hy = rooster ? -84 : -74; // hauteur de la tête : le coq la lève pour chanter
    const tail = rooster
      ? `<path d="M-34 -40C-60 -60-70-100-46-118M-34 -36C-70 -50-86-86-70-104M-34 -32C-74 -36-92-62-88-80" class="a-line" ${n}/>`
      : kind === 'hen' ? `<path d="M-34 -36L-50 -70L-22 -50Z" class="a-line" ${n}/>` : '';
    const comb = rooster
      ? `<path d="M18 ${hy - 8}Q20 ${hy - 20} 25 ${hy - 10}Q28 ${hy - 22} 32 ${hy - 11}Q36 ${hy - 20} 38 ${hy - 8}Z" class="a-fill"/>`
      : kind === 'hen' ? `<path d="M21 ${hy - 9}q3 -7 6 0q3 -7 6 0" class="a-line" ${n}/>` : '';
    const beak = rooster
      ? `<path d="M38 ${hy - 3}L52 ${hy - 8}L40 ${hy + 1}ZM38 ${hy + 3}L50 ${hy + 6}L39 ${hy + 5}Z" class="a-fill"/>`
      : `<path d="M38 ${hy - 3}L49 ${hy + 1}L38 ${hy + 4}Z" class="a-fill"/>`;
    return `
  <g transform="translate(${x} 318) scale(${s})"><g class="${rooster ? 'a-bird' : `a-bird a-peck art-anim${kind === 'chick' ? ' a-peck--late' : ''}`}">
    ${tail}
    <path d="M-38 -34C-40 -62-6 -72 18 -60C34 -52 40 -36 32 -22C24 -8 4 -4-14 -8C-30 -12-38 -22-38 -34Z" class="a-line a-soft-fill" ${n}/>
    <path d="M-20 -42C-6 -50 12 -44 16 -32C2 -26-12 -30-20 -42Z" class="a-soft" ${n}/>
    <path d="M16 -58L24 ${hy + 8}" class="a-line" ${n}/>
    <circle cx="28" cy="${hy}" r="11" class="a-line a-soft-fill" ${n}/>
    ${comb}${beak}
    ${kind === 'chick' ? '' : `<path d="M36 ${hy + 8}q3 7-3 8" class="a-line" ${n}/>`}
    <circle cx="31" cy="${hy - 2}" r="1.8" class="a-fill"/>
    <path d="M-6 -7V0M8 -7V0M-12 0H0M2 0H15" class="a-line" ${n}/>
  </g></g>`;
  };
  return `
<svg viewBox="0 0 760 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(t('art.cocoricoAlt'))}">
  ${grid.replaceAll('{id}', id)}
  <path d="M60 318V258M220 318V258M380 318V258M540 318V258M700 318V258M40 272H720M40 296H720" class="a-soft"/>
  <path d="M0 318H760" class="a-line"/>
  <path d="M0 330H760" class="a-soft a-dash-static"/>
  ${bird({ x: 255, s: 1.55, kind: 'rooster' })}
  <g class="a-crow"><path d="M350 172Q360 185 350 198" class="a-line art-anim"/><path d="M364 164Q379 185 364 206" class="a-line art-anim"/><path d="M378 156Q398 185 378 214" class="a-line art-anim"/></g>
  ${bird({ x: 470, s: 1.05, kind: 'hen' })}
  ${bird({ x: 566, s: 0.6, kind: 'chick' })}
  <ellipse cx="640" cy="299" rx="15" ry="19" class="a-fill a-pulse art-anim"/>
  <text x="40" y="56" class="a-text">${esc(t('art.flock'))}</text>
  <text x="40" y="80" class="a-text">${esc(t('art.weeks'))}</text>
  <path d="M40 92h120" class="a-soft"/>
  <path d="M40 92h90" class="a-line a-thick art-anim a-meter"/>
</svg>`;
};

const reel = (id, t) => {
  // Short Reel : la maison est une bande de film. Les ciseaux coupent une image (marquée de coins blancs),
  // qui sort de la bande, glisse et se recolle deux images plus loin, puis la bande se rembobine.
  const fx = (i) => 60 + i * 108;
  const holes = Array.from({ length: 28 }, (_, i) => `M${48 + i * 24} 156h12v8h-12ZM${48 + i * 24} 256h12v8h-12Z`).join('');
  // Le contenu de chaque image : une porte, un escalier, une fenêtre…, comme les pièces de la maison
  const scenes = [
    (x) => `M${x + 38} 238v-40h24v40`,
    (x) => `M${x + 14} 238h18v-14h18v-14h18v-14h18`,
    (x) => `M${x + 30} 190h40v32h-40ZM${x + 50} 190v32M${x + 30} 206h40`,
    (x) => `M${x + 20} 238q30 -50 60 0`,
    null,
    (x) => `M${x + 14} 238h72M${x + 50} 238v-46l-16 14M${x + 50} 192l16 14`,
  ];
  const frame = (i) => `<rect x="${fx(i)}" y="172" width="100" height="76" class="a-line"/><path d="${scenes[i](fx(i))}" class="a-soft"/>`;
  const ticks = (x) => `M${x + 4} 184v-8h8M${x + 88} 176h8v8M${x + 4} 236v8h8M${x + 96} 236v8h-8`;
  return `
<svg viewBox="0 0 760 400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(t('art.reelAlt'))}">
  ${grid.replaceAll('{id}', id)}
  <rect x="40" y="150" width="680" height="120" class="a-line a-soft-fill"/>
  <path d="${holes}" class="a-soft"/>
  ${[0, 1, 3, 5].map(frame).join('')}
  <rect x="${fx(2)}" y="172" width="100" height="76" class="a-soft a-dash-static"/>
  <rect x="${fx(4)}" y="172" width="100" height="76" class="a-soft a-dash-static"/>
  <g class="a-splice art-anim">
    ${frame(2)}
    <path d="${ticks(fx(2))}" class="a-line a-thick"/>
  </g>
  <g class="a-shears">
    <g class="art-anim"><path d="M368 120L390 196" class="a-line a-thick"/><circle cx="365" cy="111" r="9" class="a-line"/></g>
    <g class="art-anim"><path d="M392 120L370 196" class="a-line a-thick"/><circle cx="395" cy="111" r="9" class="a-line"/></g>
  </g>
  <text x="40" y="56" class="a-text">${esc(t('art.directorsCut'))}</text>
  <text x="40" y="80" class="a-text">${esc(t('art.jamDays'))}</text>
</svg>`;
};

export const art = { catapult, bastion, darts, plumb, cordeau, marbles, lumirift, reel, cocorico, classified };
