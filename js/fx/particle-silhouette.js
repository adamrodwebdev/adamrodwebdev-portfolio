// Particle silhouette: a shape drawn by thousands of grains that breathe, drift,
// gather, blow away and morph. Plain ES module, WebGL2 with a Canvas 2D fallback.
//
// Portfolio copy (1.21.0) of the module made in the Catapulte Mania lab (ours, no dependency).
// Kept here: the dust mood only (the user's choice), the two gold palettes of the site, SVG shapes
// (for scripts/bake-grains.mjs) and baked grains (for the page, which samples nothing), plus
// setEnergy() for the music. Removed: text shapes and font loading, the smoke and sparks moods.
// Added in 1.22.0 (the brand scene meets the soundtrack): the grains can break along the cuts of the
// brand scene's 3D fracture (setShards, breakShards: cracks of light, a beat of stillness, the burst,
// home again), and settle like sand on a vibrating plate into the Chladni figure the music plays
// (sandFigure for the figure, setSand every frame for how far and how hard). Both live in the vertex
// shader, like the rest: still one draw call and no upload per frame (only when a figure changes).
//
//   const fx = await ParticleSilhouette.create(canvas, { budget: 14000, mood: 'dust', palette: 'gold' });
//   await fx.setShape(Shapes.baked(buffer, { label }));  fx.setEnergy(level);
//   await fx.disperse();  await fx.gather();
//   fx.setShards(decodeShards(cutsBuffer, count));  await fx.breakShards();
//   await fx.sandFigure(nodalTargets(positions, count, [2, 5]));  fx.setSand(strength, hop);
//
// Added in 1.23.0 (from the lab): the cursor and the finger stir the grains (pointerMove,
// pointerLeave, setPointer): a soft head and a fading wake, applied in the shader after the
// shape is placed, still one uniform upload per frame and nothing allocated per frame.
//
// Every grain is animated in the vertex shader from static attributes and a few
// uniforms: one draw call, no buffer upload and no allocation per frame. The CPU
// only touches the particle buffer when the shape changes.
import { decodeGrains } from './grain-file.js';

export const QUALITY_TIERS = Object.freeze({ low: 8000, mid: 25000, high: 60000 });

const FALLBACK_BUDGET = 6000;          // Canvas 2D computes every grain on the CPU
const RASTER_PX = 768;                 // long side of the mask the shape is sampled from
// ax ay bx by edgeA edgeB seed0..3 | sand targets: mode slot P (x, y), slot Q (x, y)
// | brand cuts: shard flight x, y, shard spin, crack closeness   (1.22.0: 10 -> 18)
const FLOATS = 18;
const STRIDE = FLOATS * 4;
// The cursor and the finger (1.23.0, from the Catapulte Mania lab): the live head + 9 fading wake marks
const FIELD = 10;
const STAMP_MS = 60;                   // one wake mark per 60 ms of stroke...
const STAMP_LIFE = 0.5;                // ...each gone in 0.5 s, so a mark is never cut short
// slots of the pointer state: target, smoothed head, velocity, strength, times, scratch
const PS = Object.freeze({ TX: 0, TY: 1, X: 2, Y: 3, VX: 4, VY: 5, STRENGTH: 6, MOVED: 7, STAMPED: 8, R: 9, PX: 10, PY: 11, K: 12, SPEED: 13, TARGET: 14, SIZE: 15 });

export const MOODS = Object.freeze({
  // drift: idle wander, swirl: turbulence, rise: upward pull, flicker: shimmer,
  // size: grain size (CSS px), soft: 0 crisp .. 1 soft, alpha, edgeGrow: edge grains swell
  dust:   Object.freeze({ drift: 1.0, swirl: 0.7, rise: 0.15, flicker: 0.45, size: 1.25, soft: 0.6, alpha: 0.9, edgeGrow: 0.35, heat: 0.0, wind: [1, -0.22] }),
});

export const PALETTES = Object.freeze({
  // add: light grains on a dark ground; over: dark grains printed on paper.
  // The site's gold (dark theme) and its dark gold printed on the light theme's paper.
  gold:    Object.freeze({ a: '#e0b04a', b: '#9a7420', hot: '#f5cf6e', blend: 'add', ground: '#000000' }),
  goldInk: Object.freeze({ a: '#85620f', b: '#6b4e0a', hot: '#c9972c', blend: 'over', ground: '#fbfaf7' }),
});

// ---------------------------------------------------------------------------
// Shapes: an SVG to sample, or grains already sampled.
// ---------------------------------------------------------------------------

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { canvas: c, ctx: c.getContext('2d', { willReadFrequently: true }) };
}

function readAlpha(ctx, w, h) {
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 3; i < out.length; i++, j += 4) out[i] = rgba[j];
  return { alpha: out, w, h };
}

async function decodeImage(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  await img.decode();
  return img;
}

export const Shapes = Object.freeze({
  /** An SVG document (string). Drawn as an image, so it runs no script and loads nothing. */
  svg(markup, { label = 'silhouette' } = {}) {
    return {
      label,
      async rasterize(maxPx) {
        const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }));
        try {
          const img = await decodeImage(url);
          const k = maxPx / Math.max(img.naturalWidth || 1, img.naturalHeight || 1);
          const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
          const { ctx } = makeCanvas(w, h);
          ctx.drawImage(img, 0, 0, w, h);
          return readAlpha(ctx, w, h);
        } finally { URL.revokeObjectURL(url); }
      },
    };
  },

  /** Grains baked ahead of time (js/fx/grain-file.js): nothing to sample in the browser. */
  baked(buffer, { label = 'silhouette' } = {}) {
    return { label, grains: decodeGrains(buffer, label) };
  },
});

// ---------------------------------------------------------------------------
// Sampling: mask -> signed distance -> weighted grains (dense core, noisy edge)
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}

const fbm = (x, y, seed) => 0.62 * valueNoise(x, y, seed) + 0.38 * valueNoise(x * 2.3 + 17.1, y * 2.3 - 9.4, seed + 1);
const smooth01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Two-pass chamfer distance; `dist` holds 0 at sources and Infinity elsewhere. */
function chamfer(dist, w, h) {
  const D2 = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = dist[i];
      if (v === 0) continue;
      if (x > 0) v = Math.min(v, dist[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, dist[i - w] + 1);
        if (x > 0) v = Math.min(v, dist[i - w - 1] + D2);
        if (x < w - 1) v = Math.min(v, dist[i - w + 1] + D2);
      }
      dist[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = dist[i];
      if (v === 0) continue;
      if (x < w - 1) v = Math.min(v, dist[i + 1] + 1);
      if (y < h - 1) {
        v = Math.min(v, dist[i + w] + 1);
        if (x < w - 1) v = Math.min(v, dist[i + w + 1] + D2);
        if (x > 0) v = Math.min(v, dist[i + w - 1] + D2);
      }
      dist[i] = v;
    }
  }
}

const nextTask = () => new Promise((r) => setTimeout(r, 0));

/**
 * Samples `count` grains from a shape. Returns positions in shape units (the
 * silhouette is 1 unit tall, centred on 0), an edge factor per grain (0 deep in
 * the body, 1 on or outside the edge), the aspect ratio and the inner area.
 * The order is random, so any prefix is an even subsample (that is how density works).
 */
export async function sampleShape(shape, count, { seed = 7, core = 1, edge = 1, grain = 1 } = {}) {
  const { alpha, w, h } = await shape.rasterize(RASTER_PX);
  await nextTask();
  const n = w * h;
  const dIn = new Float32Array(n), dOut = new Float32Array(n);
  let minX = w, minY = h, maxX = -1, maxY = -1, inside = 0;
  for (let i = 0; i < n; i++) {
    if (alpha[i] >= 128) {
      inside++;
      dIn[i] = Infinity; dOut[i] = 0;
      const x = i % w, y = (i / w) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    } else { dIn[i] = 0; dOut[i] = Infinity; }
  }
  if (inside < 32) throw new Error(`Shape "${shape.label}" is empty`);
  chamfer(dIn, w, h);
  chamfer(dOut, w, h);
  await nextTask();

  const boxW = maxX - minX + 1, boxH = maxY - minY + 1;
  const long = Math.max(boxW, boxH);
  // the body and the halo scale with the strokes, not with the canvas: a thin
  // letter and a fat boiler both get a dense core and a halo of their own size
  let sumIn = 0;
  for (let i = 0; i < n; i++) if (dIn[i] > 0) sumIn += dIn[i];
  const stroke = sumIn / inside;   // mean depth: about half of a half-width
  const coreBand = Math.max(1.5, Math.min(stroke * 1.3, long * 0.02) * core);
  const sigma = Math.max(1.2, Math.min(stroke * 0.6, long * 0.01) * edge);
  const reach = sigma * 3.2;
  const cell = long * 0.05;
  const cdf = new Float64Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const din = dIn[i];
    let wgt = 0;
    if (din > 0) {
      const x = i % w, y = (i / w) | 0;
      const nz = fbm(x / cell, y / cell, seed);
      wgt = (0.22 + 0.78 * smooth01((din - 0.5) / coreBand)) * (1 - 0.45 * grain + 0.9 * grain * nz);
    } else if (dOut[i] < reach) {
      const x = i % w, y = (i / w) | 0;
      const nz = fbm(x / (cell * 0.7), y / (cell * 0.7), seed + 5);
      const q = (dOut[i] - 0.5) / sigma;
      wgt = 0.38 * Math.exp(-q * q) * (0.1 + 1.9 * nz * nz);
    }
    total += wgt;
    cdf[i] = total;
  }
  await nextTask();

  const rand = mulberry32(seed * 7919 + count);
  const positions = new Float32Array(count * 2);
  const edges = new Float32Array(count);
  const cx = minX + boxW / 2, cy = minY + boxH / 2;
  for (let k = 0; k < count; k++) {
    const r = rand() * total;
    let lo = 0, hi = n - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] > r) hi = mid; else lo = mid + 1; }
    const x = lo % w, y = (lo / w) | 0;
    positions[k * 2] = (x + rand() - cx) / boxH;
    positions[k * 2 + 1] = (y + rand() - cy) / boxH;
    const din = dIn[lo];
    edges[k] = din > 0 ? 1 - smooth01((din - 0.5) / (coreBand * 1.6)) : 1;
  }
  return { positions, edges, count, aspect: boxW / boxH, area: inside / (boxH * boxH), label: shape.label };
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 aA;
layout(location=1) in vec2 aB;
layout(location=2) in vec2 aE;
layout(location=3) in vec4 aS;
layout(location=4) in vec4 aC;   // sand: nodal target of mode slot P (xy) and slot Q (zw), shape units
layout(location=5) in vec4 aK;   // brand cuts: shard flight (xy, -1..1), shard spin (-1..1), crack closeness
// All uniforms travel in one vec4 array, uploaded from one preallocated
// Float32Array: a single call per frame and no number boxed on the JS side.
uniform vec4 uU[26];
#define uSand  uU[9]   // sand strength, mix P -> Q, hop, shard break
#define uCut   uU[10]  // crack glow
// uU[11..20]: pointer field (1.23.0), one stamp each (x, y px from the canvas centre, radius px, strength)
// uU[21..25]: their velocities, px/s, two per vec4
#define uView  uU[0].xy  // drawing buffer, px
#define uWind  uU[0].zw  // disperse direction
#define uFit   uU[1]     // xy: px per unit of shape A and B; zw: centre offset, px
#define uAnim  uU[2]     // time, morph, gather, disperse
#define uMoodA uU[3]     // drift, swirl, rise, flicker
#define uMoodB uU[4]     // size px, alpha, edge grow, motion (0 = reduced motion)
#define uMisc  uU[5]     // spin angle, breath, exposure x opacity, heat
#define uColA  uU[6].rgb // .w: grain softness
#define uColB  uU[7].rgb
#define uHot   uU[8].rgb
out vec3 vCol;
out float vAlpha;
out float vSoft;

vec2 flow(vec2 q, float t) {
  return vec2(sin(q.y * 1.7 + t + 1.3 * sin(q.x * 0.9 - t * 0.6)),
              cos(q.x * 1.3 - t * 0.8 + 1.1 * sin(q.y * 1.1 + t * 0.5)));
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

void main() {
  float t = uAnim.x;
  float motion = uMoodB.w;
  float L = 0.5 * length(uView);

  // morph A -> B, staggered per grain, with a sideways swirl mid-flight
  float m = clamp(uAnim.y * 1.5 - aS.x * 0.5, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  mat2 R = rot(uMisc.x);
  vec2 pa = R * aA * uFit.x;
  vec2 pb = R * aB * uFit.y;
  vec2 p = mix(pa, pb, m);
  vec2 home = p;
  float unit = mix(uFit.x, uFit.y, m);
  float edge = mix(aE.x, aE.y, m);
  float swirl = sin(m * 3.14159265);
  vec2 d = pb - pa;
  p += vec2(-d.y, d.x) * (aS.w - 0.5) * 0.6 * swirl;
  p += flow(p * 0.01 + aS.xy * 6.0, t * 0.7) * swirl * L * 0.05;

  // breathing, idle drift (edges wander more) and a slow band where edge grains lift off
  p *= 1.0 + motion * uMisc.y * sin(t * 0.85) * (0.5 + 0.5 * edge);
  float amp = unit * 0.006 * uMoodA.x * (0.1 + 1.7 * edge * edge);
  p += motion * amp * flow(p / unit * 3.0 + aS.zw * 7.0, t * 0.6 * (0.6 + aS.y));
  float band = smoothstep(0.72, 1.0, sin(home.x / unit * 1.4 - t * 0.45 + aS.x * 0.6));
  p += motion * (vec2(0.0, -uMoodA.z - 0.2) + 0.6 * flow(home / unit * 2.0, t)) * unit * 0.09 * band * edge * edge;

  // sand on a plate (the music): grains slide to the nodal lines of the mode the music plays,
  // each in its own time, and hop on the beat; when the music calms they flow back into the logo
  float sandK = clamp(uSand.x * 1.5 - aS.y * 0.5, 0.0, 1.0);
  sandK = sandK * sandK * (3.0 - 2.0 * sandK) * motion;
  vec2 node = R * mix(aC.xy, aC.zw, uSand.y) * unit;
  // sand lines have body: each grain keeps a small scatter of its own around the line
  p = mix(p, node + (aS.zw - 0.5) * unit * 0.022 + (p - home) * 0.25, sandK);
  float hop = uSand.z * motion * (0.35 + 0.65 * aS.z);
  p += vec2(sin(t * 37.0 + aS.x * 91.0), cos(t * 43.0 + aS.w * 77.0)) * hop * unit * 0.016;

  // the brand cuts (a new part of the music): each shard of the 3D fracture flies along its own
  // flight and turns about the logo's centre a little; its dust spreads as it goes, then all comes home
  float brk = uSand.w * motion;
  float be = 1.0 - (1.0 - brk) * (1.0 - brk);
  vec2 fly = R * aK.xy;
  p = rot(aK.z * 0.5 * be) * p + fly * unit * 0.3 * be;
  p += flow(home / unit * 3.0 + aS.xy * 4.0, t) * unit * 0.07 * brk * brk * (0.3 + edge);
  // the cracks spread from the impact (between the A's legs, as in the video), lighting the grains
  // that sit on a cut; the rest of the dust dims so the lines read
  float fromImpact = length(home / unit - vec2(0.0, -0.057));
  float reached = smoothstep(fromImpact - 0.12, fromImpact, uCut.x * 0.75);
  float onCut = aK.w * aK.w;
  float crack = reached * onCut * 3.0;
  float dimmed = 1.0 - 0.6 * uCut.x * (1.0 - onCut);

  // gather: grains fly in from all around, spiralling, and settle with an ease-out
  float g = clamp(uAnim.z * 1.6 - aS.y * 0.6, 0.0, 1.0);
  float ge = 1.0 - pow(1.0 - g, 3.0);
  float ang = aS.w * 6.2831853;
  vec2 far = vec2(cos(ang), sin(ang)) * L * (0.35 + aS.x * 0.95);
  p += rot((1.0 - ge) * 2.4 * (aS.z - 0.5)) * ((far - p) * (1.0 - ge));

  // disperse: blown away like ash or steam, the downwind side leaves first
  vec2 nrm = home / L;
  float dd = clamp(uAnim.w * 1.8 - (0.5 - 0.5 * dot(nrm, uWind)) * 0.55 - aS.x * 0.25, 0.0, 1.0);
  p += uWind * dd * dd * L * (0.5 + aS.y)
     + vec2(0.0, -1.0) * dd * L * 0.3 * uMoodA.z
     + flow(nrm * 4.0 + aS.zw * 5.0, t) * dd * L * 0.12 * uMoodA.y;

  p += uFit.zw;

  // pointer (1.23.0): the cursor or finger and its fading wake push grains aside, drag them along the
  // stroke and curl them round on each side; grains settle back home as the stamps fade
  vec2 stir = vec2(0.0);
  float lit = 0.0, reach = 1.0;
  for (int i = 0; i < 10; i++) {
    vec4 f = uU[11 + i];
    if (f.w < 0.002) continue;
    vec4 vv = uU[21 + i / 2];
    vec2 v = (i % 2 == 0) ? vv.xy : vv.zw;
    // each stamp is a capsule over the last 60 ms of its stroke, so a fast wake has no gaps
    vec2 seg = v * 0.06;
    vec2 q0 = p - f.xy;
    float h = clamp(-dot(q0, seg) / max(dot(seg, seg), 1.0), 0.0, 1.0);
    vec2 q = q0 + seg * h;
    float q2 = dot(q, q) / (f.z * f.z);
    if (q2 > 6.0) continue;
    float fall = exp(-q2) * f.w;
    vec2 n = q / (sqrt(dot(q, q)) + 0.001);
    float side = sign(q0.x * v.y - q0.y * v.x);
    float jit = 0.45 + aS.y;
    vec2 drag = v * 0.045;
    drag *= min(1.0, f.z * 0.9 / max(length(drag), 0.001));
    stir += (n * f.z * 0.7 + vec2(-n.y, n.x) * side * f.z * 0.4 * (aS.z - 0.25) + drag) * fall * jit;
    lit = max(lit, fall);
    reach = max(reach, f.z);
  }
  // overlapping marks do not add up past one radius: a furrow, never a crater
  float sl = length(stir);
  stir *= sl > 0.001 ? reach * tanh(sl / reach) / sl : 0.0;
  p += stir * motion;
  lit *= motion;
  gl_Position = vec4(p.x / (uView.x * 0.5), -p.y / (uView.y * 0.5), 0.0, 1.0);

  float size = uMoodB.x * (0.55 + 0.9 * aS.y * aS.y) * (1.0 + uMoodB.z * (edge * 0.6 + dd * 1.5)) * (1.0 + 0.3 * lit);
  float shimmer = 1.0 - uMoodA.w * motion * 0.5 * (1.0 + sin(t * (1.3 + 3.5 * aS.y) + aS.x * 40.0));
  float spark = motion > 0.5
    ? pow(0.5 + 0.5 * sin(t * (2.0 + 5.0 * aS.z) + aS.w * 50.0), 14.0)
    : pow(aS.z, 24.0);
  float heat = uMisc.w * spark;
  float light = 0.8 + 0.2 * clamp(-(home.x + home.y) / (unit * 1.2), -1.0, 1.0);
  float a = uMoodB.y * mix(1.0, 0.5, edge) * shimmer;
  a *= smoothstep(0.0, 0.04, uAnim.z) * mix(0.25, 1.0, ge);
  a *= 1.0 - smoothstep(0.3, 1.0, dd);
  a *= uMisc.z * (1.0 + heat * 1.5 + crack * 2.5) * dimmed * (1.0 + 0.6 * lit);
  size *= 1.0 + crack * 0.6;
  if (size < 1.0) { a *= size * size; size = 1.0; }
  gl_PointSize = size;
  vCol = mix(mix(mix(uColA, uColB, aS.z * 0.7), uHot, max(heat, lit * 0.45)) * light, uHot * 1.4, clamp(crack, 0.0, 1.0));
  vAlpha = a;
  vSoft = uU[6].w;
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec3 vCol;
in float vAlpha;
in float vSoft;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float a = vAlpha * clamp((1.0 - dot(c, c)) / vSoft, 0.0, 1.0);
  outColor = vec4(vCol * a, a);
}`;

class GLRenderer {
  static tryCreate(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    return gl ? new GLRenderer(gl) : null;
  }

  constructor(gl) {
    this.gl = gl;
    this.kind = 'webgl2';
    this.capacity = 0;
    this.init();
  }

  init() {
    const gl = this.gl;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.prog = prog;
    this.uBlock = gl.getUniformLocation(prog, 'uU');
    this.block = new Float32Array(104);
    this.vao = gl.createVertexArray();
    this.vbo = gl.createBuffer();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    const attr = (loc, size, offset) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE, offset * 4);
    };
    attr(0, 2, 0); attr(1, 2, 2); attr(2, 2, 4); attr(3, 4, 6); attr(4, 4, 10); attr(5, 4, 14);
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    this.capacity = 0;
  }

  upload(data, count) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    if (count > this.capacity) {
      gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * FLOATS), gl.STATIC_DRAW);
      this.capacity = count;
    } else {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * FLOATS);
    }
  }

  draw(s, count) {
    const gl = this.gl;
    gl.viewport(0, 0, s.viewW, s.viewH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (count === 0 || s.opacity <= 0) return;
    if (s.additive) gl.blendFunc(gl.ONE, gl.ONE);
    else gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.prog);
    const b = this.block;
    b[0] = s.viewW; b[1] = s.viewH; b[2] = s.windX; b[3] = s.windY;
    b[4] = s.fitA; b[5] = s.fitB; b[6] = s.centerX; b[7] = s.centerY;
    b[8] = s.time; b[9] = s.morph; b[10] = s.gather; b[11] = s.disperse;
    b[12] = s.drift; b[13] = s.swirl; b[14] = s.rise; b[15] = s.flicker;
    b[16] = s.size; b[17] = s.alpha; b[18] = s.edgeGrow; b[19] = s.motion;
    b[20] = s.spin; b[21] = s.breath; b[22] = s.exposure * s.opacity; b[23] = s.heat;
    b[24] = s.colA[0]; b[25] = s.colA[1]; b[26] = s.colA[2]; b[27] = s.soft;
    b[28] = s.colB[0]; b[29] = s.colB[1]; b[30] = s.colB[2];
    b[32] = s.hot[0]; b[33] = s.hot[1]; b[34] = s.hot[2];
    b[36] = s.sand; b[37] = s.sandMix; b[38] = s.hop; b[39] = s.brk;
    b[40] = s.crack;
    const F = s.field;
    for (let i = 0; i < FIELD; i++) {
      const o = i * 6, j = 44 + i * 4, k = 84 + i * 2;
      b[j] = F[o]; b[j + 1] = F[o + 1]; b[j + 2] = F[o + 2]; b[j + 3] = F[o + 3];
      b[k] = F[o + 4]; b[k + 1] = F[o + 5];
    }
    gl.uniform4fv(this.uBlock, b);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);
  }

  destroy() {
    const gl = this.gl;
    gl.deleteBuffer(this.vbo);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.prog);
  }
}

/** CPU mirror of the vertex shader, plotting grains into one ImageData. */
class Canvas2DRenderer {
  constructor(canvas) {
    this.kind = 'canvas2d';
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.data = null;
    this.image = null;
  }

  upload(data) { this.data = data; }

  draw(s, count) {
    const w = s.viewW, h = s.viewH;
    if (!this.image || this.image.width !== w || this.image.height !== h) {
      this.image = this.ctx.createImageData(w, h);
      this.px = this.image.data;
    }
    const px = this.px;
    px.fill(0);
    if (count > 0 && s.opacity > 0) this.plot(s, count, w, h, px);
    this.ctx.putImageData(this.image, 0, 0);
  }

  plot(s, count, w, h, px) {
    const D = this.data, t = s.time, motion = s.motion;
    const L = 0.5 * Math.hypot(w, h);
    const sinS = Math.sin(s.spin), cosS = Math.cos(s.spin);
    const breathK = motion * s.breath * Math.sin(t * 0.85);
    const ca = s.colA, cb = s.colB, ch = s.hot;
    for (let i = 0; i < count; i++) {
      const o = i * FLOATS;
      const s0 = D[o + 6], s1 = D[o + 7], s2 = D[o + 8], s3 = D[o + 9];
      let m = Math.min(1, Math.max(0, s.morph * 1.5 - s0 * 0.5));
      m = m * m * (3 - 2 * m);
      const ax = (cosS * D[o] - sinS * D[o + 1]) * s.fitA, ay = (sinS * D[o] + cosS * D[o + 1]) * s.fitA;
      const bx = (cosS * D[o + 2] - sinS * D[o + 3]) * s.fitB, by = (sinS * D[o + 2] + cosS * D[o + 3]) * s.fitB;
      const hx = ax + (bx - ax) * m, hy = ay + (by - ay) * m;
      const unit = s.fitA + (s.fitB - s.fitA) * m;
      const edge = D[o + 4] + (D[o + 5] - D[o + 4]) * m;
      const sw = Math.sin(m * Math.PI);
      let x = hx - (by - ay) * (s3 - 0.5) * 0.6 * sw;
      let y = hy + (bx - ax) * (s3 - 0.5) * 0.6 * sw;
      const k = 1 + breathK * (0.5 + 0.5 * edge);
      x *= k; y *= k;
      const amp = motion * unit * 0.006 * s.drift * (0.1 + 1.7 * edge * edge);
      const ft = t * 0.6 * (0.6 + s1);
      x += amp * Math.sin((y / unit * 3 + s3 * 7) * 1.7 + ft);
      y += amp * Math.cos((x / unit * 3 + s2 * 7) * 1.3 - ft * 0.8);
      const g = Math.min(1, Math.max(0, s.gather * 1.6 - s1 * 0.6));
      const ge = 1 - (1 - g) ** 3;
      if (ge < 1) {
        const ang = s3 * 6.2831853, r = L * (0.35 + s0 * 0.95);
        x += (Math.cos(ang) * r - x) * (1 - ge);
        y += (Math.sin(ang) * r - y) * (1 - ge);
      }
      let dd = 0;
      if (s.disperse > 0) {
        const along = (hx * s.windX + hy * s.windY) / L;
        dd = Math.min(1, Math.max(0, s.disperse * 1.8 - (0.5 - 0.5 * along) * 0.55 - s0 * 0.25));
        x += s.windX * dd * dd * L * (0.5 + s1) + Math.sin(s2 * 40 + t) * dd * L * 0.12 * s.swirl;
        y += s.windY * dd * dd * L * (0.5 + s1) - dd * L * 0.3 * s.rise;
      }
      let lit = 0;
      if (s.fieldOn && motion > 0) {
        const F = s.field, px0 = x + s.centerX, py0 = y + s.centerY;
        let ox = 0, oy = 0, reach = 1;
        for (let f = 0; f < FIELD; f++) {
          const o = f * 6, st = F[o + 3];
          if (st < 0.002) continue;
          const vx = F[o + 4], vy = F[o + 5], r = F[o + 2];
          const q0x = px0 - F[o], q0y = py0 - F[o + 1], gx = vx * 0.06, gy = vy * 0.06;
          const hh = Math.min(1, Math.max(0, -(q0x * gx + q0y * gy) / Math.max(gx * gx + gy * gy, 1)));
          const qx = q0x + gx * hh, qy = q0y + gy * hh;
          const q2 = (qx * qx + qy * qy) / (r * r);
          if (q2 > 6) continue;
          const fall = Math.exp(-q2) * st, dist = Math.hypot(qx, qy) + 0.001;
          const nx = qx / dist, ny = qy / dist;
          const side = Math.sign(q0x * vy - q0y * vx), jit = 0.45 + s1, tw = side * r * 0.4 * (s2 - 0.25);
          const dl = Math.hypot(vx, vy) * 0.045, dk = 0.045 * Math.min(1, (r * 0.9) / Math.max(dl, 0.001));
          ox += (nx * r * 0.7 - ny * tw + vx * dk) * fall * jit;
          oy += (ny * r * 0.7 + nx * tw + vy * dk) * fall * jit;
          if (fall > lit) lit = fall;
          if (r > reach) reach = r;
        }
        const sl = Math.hypot(ox, oy), k = sl > 0.001 ? (reach * Math.tanh(sl / reach)) / sl : 0;
        x += ox * k; y += oy * k;
      }
      const sx = Math.round(x + s.centerX + w / 2), sy = Math.round(y + s.centerY + h / 2);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const shimmer = 1 - s.flicker * motion * 0.5 * (1 + Math.sin(t * (1.3 + 3.5 * s1) + s0 * 40));
      let a = s.alpha * (1 - 0.5 * edge) * shimmer * (g > 0 ? 0.25 + 0.75 * ge : 0) * s.exposure * s.opacity * (1 + 0.6 * lit);
      if (dd > 0.3) a *= 1 - smooth01((dd - 0.3) / 0.7);
      const heat = Math.max(lit * 0.45, s.heat * (motion > 0.5 ? Math.pow(0.5 + 0.5 * Math.sin(t * (2 + 5 * s2) + s3 * 50), 14) : Math.pow(s2, 24)));
      const light = 0.8 + 0.2 * Math.max(-1, Math.min(1, -(hx + hy) / (unit * 1.2)));
      const mix = s2 * 0.7;
      a = Math.min(1, a * (1 + heat * 1.5));
      const r = ((ca[0] + (cb[0] - ca[0]) * mix) * (1 - heat) + ch[0] * heat) * light;
      const gg = ((ca[1] + (cb[1] - ca[1]) * mix) * (1 - heat) + ch[1] * heat) * light;
      const b = ((ca[2] + (cb[2] - ca[2]) * mix) * (1 - heat) + ch[2] * heat) * light;
      const j = (sy * w + sx) * 4;
      if (s.additive) {
        px[j] += r * a * 255; px[j + 1] += gg * a * 255; px[j + 2] += b * a * 255; px[j + 3] += a * 255;
      } else {
        const keep = 1 - a;
        px[j] = r * a * 255 + px[j] * keep; px[j + 1] = gg * a * 255 + px[j + 1] * keep;
        px[j + 2] = b * a * 255 + px[j + 2] * keep; px[j + 3] = a * 255 + px[j + 3] * keep;
      }
    }
    // ImageData is not premultiplied: divide colour by alpha so grains keep their tint
    for (let j = 0; j < px.length; j += 4) {
      const al = px[j + 3];
      if (al > 0 && al < 255) {
        const k = 255 / al;
        px[j] *= k; px[j + 1] *= k; px[j + 2] *= k;
      }
    }
  }

  destroy() {}
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

const hexToRgb = (hex) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Bad colour ${hex}`);
  const v = parseInt(m[1], 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};

class Tween {
  constructor() { this.active = false; this.from = 0; this.to = 0; this.start = 0; this.dur = 1; this.resolve = null; }
  run(from, to, durMs, now) {
    this.finish();
    this.from = from; this.to = to; this.start = now; this.dur = Math.max(1, durMs); this.active = true;
    return new Promise((r) => { this.resolve = r; });
  }
  value(now) {
    const k = Math.min(1, (now - this.start) / this.dur);
    if (k >= 1) this.finish();
    return this.from + (this.to - this.from) * k;
  }
  finish() {
    this.active = false;
    const r = this.resolve;
    this.resolve = null;
    if (r) r();
  }
}

function pickTier() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  if (coarse) return memory >= 6 && cores >= 8 ? 'mid' : 'low';
  return cores >= 8 && memory >= 8 ? 'high' : 'mid';
}

export class ParticleSilhouette {
  /**
   * @param {HTMLCanvasElement} canvas  sized by CSS; the module sets its pixel size
   * @param {object} [o]
   * @param {'auto'|'low'|'mid'|'high'} [o.quality]  grain budget tier
   * @param {number} [o.budget]   explicit grain budget (overrides quality), e.g. 3000 for a small loader
   * @param {'webgl2'|'canvas2d'|'auto'} [o.renderer]
   * @param {keyof MOODS} [o.mood]  @param {keyof PALETTES} [o.palette]
   * @param {number} [o.density]  0..1 share of the budget drawn
   * @param {number} [o.fill]     share of the free area the shape may take (0..1)
   * @param {number} [o.grainSize] grain size as a multiple of the mood's (0.5..3, 1.23.0)
   * @param {{top?:number,right?:number,bottom?:number,left?:number}} [o.inset]  CSS px kept free (HUD)
   * @param {boolean|'auto'} [o.reducedMotion]
   * @param {boolean} [o.adaptive]  lower the grain count when frames run long
   * @param {number} [o.maxDpr]
   */
  static async create(canvas, o = {}) {
    const fx = new ParticleSilhouette(canvas, o);
    return fx;
  }

  constructor(canvas, o) {
    this.canvas = canvas;
    this.raf = 0;
    this.frame = (now) => this.tick(now);   // bound once: no closure per frame
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.maxDpr = o.maxDpr ?? (coarse ? 1.25 : 1.5);
    let renderer = null;
    if (o.renderer !== 'canvas2d') {
      try { renderer = GLRenderer.tryCreate(canvas); } catch (err) { console.warn('[particle-silhouette] WebGL2 failed, using Canvas 2D', err); }
    }
    this.renderer = renderer ?? new Canvas2DRenderer(canvas);
    if (this.renderer.kind === 'canvas2d') this.maxDpr = 1;
    this.tier = o.quality && o.quality !== 'auto' ? o.quality : pickTier();
    if (!(this.tier in QUALITY_TIERS)) throw new Error(`Unknown quality ${o.quality}`);
    this.budget = this.resolveBudget(o.budget);
    this.density = clamp01(o.density ?? 1);
    this.fill = clamp01(o.fill ?? 0.82);
    this.grainSize = Math.min(3, Math.max(0.5, Number.isFinite(o.grainSize) ? o.grainSize : 1));   // 1.23.0
    this.inset = { top: 0, right: 0, bottom: 0, left: 0, ...(o.inset ?? {}) };
    this.adaptive = o.adaptive ?? true;
    this.governorCap = 1;
    this.data = new Float32Array(this.budget * FLOATS);
    this.current = null;      // sampled shape now in slot B
    this.previous = null;     // sampled shape in slot A (during a morph)
    this.cache = new Map();   // shape -> sampled grains
    this.seedSlots(this.budget);

    this.morphT = new Tween(); this.gatherT = new Tween(); this.disperseT = new Tween(); this.opacityT = new Tween();
    this.sandMixT = new Tween(); this.brkT = new Tween(); this.crackT = new Tween();
    this.progressTarget = -1;
    this.spinRate = 0;
    this.s = {
      viewW: 1, viewH: 1, fitA: 1, fitB: 1, centerX: 0, centerY: 0,
      time: 0, morph: 1, gather: 0, disperse: 0, spin: 0, breath: 0.012,
      drift: 0, swirl: 0, rise: 0, flicker: 0, size: 1, alpha: 1, edgeGrow: 0, soft: 0.5, heat: 0,
      windX: 1, windY: 0, motion: 1, exposure: 1, opacity: 1, additive: true,
      colA: [1, 1, 1], colB: [1, 1, 1], hot: [1, 1, 1],
      sand: 0, sandMix: 0, hop: 0, brk: 0, crack: 0,
      field: new Float32Array(FIELD * 6), fieldOn: false,   // per stamp: x, y, radius, strength, vx, vy
    };
    // the pointer (1.23.0): target and smoothed head in device px from the canvas centre
    this.ptr = { on: false, fresh: true, touch: false };
    this.ptrState = new Float64Array(PS.SIZE);
    this.stampAge = new Float32Array(FIELD).fill(STAMP_LIFE);   // seconds since each wake mark was dropped
    this.stampPower = new Float32Array(FIELD);                    // its strength when dropped
    this.pointerOptions = { radius: 1, strength: 1 };
    this.stats = { renderer: this.renderer.kind, tier: this.tier, budget: this.budget, count: 0, fps: 0, cpuMs: 0, lastCpuMs: 0, frameMs: 0, dpr: 1 };
    this.setMood(o.mood ?? 'dust');
    this.setPalette(o.palette ?? 'gold');

    this.reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedOption = o.reducedMotion ?? 'auto';
    this.onReducedChange = () => this.applyReducedMotion();
    this.reducedQuery.addEventListener('change', this.onReducedChange);
    this.applyReducedMotion();

    this.t0 = performance.now();
    this.last = this.t0;
    this.running = false;
    this.visible = true;
    this.paused = false;
    this.dirty = true;
    this.resizeObserver = new ResizeObserver(() => { this.needsResize = true; this.wake(); });
    this.resizeObserver.observe(canvas);
    this.needsResize = true;
    this.intersection = new IntersectionObserver((entries) => {
      this.visible = entries[entries.length - 1].isIntersecting;
      this.wake();
    });
    this.intersection.observe(canvas);
    this.onVisibility = () => this.wake();
    document.addEventListener('visibilitychange', this.onVisibility);
    if (this.renderer.kind === 'webgl2') {
      this.onLost = (e) => { e.preventDefault(); this.lost = true; };
      this.onRestored = () => { this.lost = false; this.renderer.init(); this.renderer.upload(this.data, this.budget); this.wake(); };
      canvas.addEventListener('webglcontextlost', this.onLost);
      canvas.addEventListener('webglcontextrestored', this.onRestored);
    }
    canvas.setAttribute('role', 'img');
  }

  resolveBudget(explicit) {
    const cap = this.renderer.kind === 'canvas2d' ? FALLBACK_BUDGET : Infinity;
    const n = explicit ?? QUALITY_TIERS[this.tier];
    if (!Number.isInteger(n) || n < 100 || n > 200000) throw new Error(`Bad budget ${n}`);
    return Math.min(n, cap);
  }

  seedSlots(count) {
    const rand = mulberry32(1234 + count);
    for (let i = 0; i < count; i++) {
      const o = i * FLOATS;
      this.data[o + 6] = rand(); this.data[o + 7] = rand(); this.data[o + 8] = rand(); this.data[o + 9] = rand();
    }
  }

  // --- shapes ---------------------------------------------------------------

  async sample(shape) {
    if (shape.grains) {
      if (shape.grains.count < this.budget) throw new Error(`Baked shape has ${shape.grains.count} grains, budget is ${this.budget}`);
      return shape.grains;
    }
    let entry = this.cache.get(shape);
    if (!entry || entry.count < this.budget) {
      entry = await sampleShape(shape, this.budget);
      this.cache.set(shape, entry);
    }
    return entry;
  }

  writeSlot(slot, grains, order) {
    const D = this.data, P = grains.positions, E = grains.edges;
    const pos = slot === 'a' ? 0 : 2, ed = slot === 'a' ? 4 : 5;
    for (let i = 0; i < this.budget; i++) {
      const k = order ? order[i] : i;
      D[i * FLOATS + pos] = P[k * 2];
      D[i * FLOATS + pos + 1] = P[k * 2 + 1];
      D[i * FLOATS + ed] = E[k];
    }
  }

  copyBToA() {
    const D = this.data;
    for (let i = 0; i < this.budget; i++) {
      const o = i * FLOATS;
      D[o] = D[o + 2]; D[o + 1] = D[o + 3]; D[o + 4] = D[o + 5];
    }
  }

  /** Pairs each grain of the new shape with the old grain of the same left-to-right
   *  rank, so a morph sweeps across instead of scrambling. Slot order stays random. */
  pairByRank(grains) {
    const n = this.budget, D = this.data;
    const keyOld = new Float32Array(n), keyNew = new Float32Array(n);
    const rand = mulberry32(99);
    for (let i = 0; i < n; i++) {
      keyOld[i] = D[i * FLOATS] + (rand() - 0.5) * 0.12;
      keyNew[i] = grains.positions[i * 2] + (rand() - 0.5) * 0.12;
    }
    const oldIdx = Uint32Array.from({ length: n }, (_, i) => i).sort((p, q) => keyOld[p] - keyOld[q]);
    const newIdx = Uint32Array.from({ length: n }, (_, i) => i).sort((p, q) => keyNew[p] - keyNew[q]);
    const order = new Uint32Array(n);
    for (let r = 0; r < n; r++) order[oldIdx[r]] = newIdx[r];
    return order;
  }

  /**
   * Shows a shape. transition: 'gather' (fly in), 'morph' (from the current shape),
   * 'cut' (at once). Resolves when the move ends.
   */
  async setShape(shape, { transition = 'gather', duration } = {}) {
    const grains = await this.sample(shape);
    this.currentShape = shape;
    this.canvas.setAttribute('aria-label', grains.label);
    if (transition === 'morph' && this.current) return this.morphTo(grains, duration ?? 1800);
    this.morphT.finish(); this.disperseT.finish();
    this.writeSlot('a', grains); this.writeSlot('b', grains);
    this.renderer.upload(this.data, this.budget);
    this.previous = this.current = grains;
    this.s.morph = 1; this.s.disperse = 0;
    this.progressTarget = -1;
    this.layout();
    if (transition === 'cut') { this.gatherT.finish(); this.s.gather = 1; this.wake(); return; }
    this.s.gather = 0;
    return this.gather({ duration });
  }

  morph(shape, { duration } = {}) { return this.setShape(shape, { transition: 'morph', duration }); }

  async morphTo(grains, duration) {
    if (this.reduced) {
      await this.fadeTo(0, 180);
      this.writeSlot('a', grains); this.writeSlot('b', grains);
      this.renderer.upload(this.data, this.budget);
      this.previous = this.current = grains;
      this.layout();
      return this.fadeTo(1, 260);
    }
    if (this.morphT.active) { this.morphT.finish(); }
    this.copyBToA();
    this.writeSlot('b', grains, this.pairByRank(grains));
    this.renderer.upload(this.data, this.budget);
    this.previous = this.current;
    this.current = grains;
    this.s.morph = 0;
    this.layout();
    const now = performance.now();
    this.wake();
    await this.morphT.run(0, 1, duration, now);
    this.previous = this.current;
  }

  gather({ duration = 2200 } = {}) {
    this.progressTarget = -1;
    this.disperseT.finish();
    if (this.s.disperse > 0) { this.s.disperse = 0; this.s.gather = 0; }
    if (this.reduced) { this.s.gather = 1; this.s.opacity = 0; return this.fadeTo(1, 300); }
    this.wake();
    return this.gatherT.run(this.s.gather, 1, duration * (1 - this.s.gather), performance.now());
  }

  disperse({ duration = 2400, wind } = {}) {
    this.progressTarget = -1;
    this.gatherT.finish();
    if (wind) this.setWind(wind[0], wind[1]);
    if (this.reduced) return this.fadeTo(0, 300);
    this.wake();
    return this.disperseT.run(this.s.disperse, 1, duration * (1 - this.s.disperse), performance.now());
  }

  /** Ties the shape to real loading progress (0..1). The grains follow smoothly. */
  setProgress(p) {
    if (typeof p !== 'number' || !Number.isFinite(p)) return;
    this.gatherT.finish(); this.disperseT.finish();
    if (this.s.disperse > 0) { this.s.disperse = 0; this.s.gather = 0; }
    this.progressTarget = clamp01(p);
    if (this.reduced) { this.s.gather = 1; this.s.opacity = 0.15 + 0.85 * this.progressTarget; this.dirty = true; }
    this.wake();
  }

  fadeTo(target, ms) {
    this.wake();
    return this.opacityT.run(this.s.opacity, target, ms, performance.now());
  }

  // --- looks ----------------------------------------------------------------

  setMood(name) {
    const m = MOODS[name];
    if (!m) throw new Error(`Unknown mood ${name}`);
    this.mood = name;
    Object.assign(this.s, { drift: m.drift, swirl: m.swirl, rise: m.rise, flicker: m.flicker, alpha: m.alpha, edgeGrow: m.edgeGrow, soft: Math.max(0.05, m.soft), heat: m.heat });
    this.setWind(m.wind[0], m.wind[1]);
    this.layout();
    this.wake();
  }

  setPalette(name) {
    const p = PALETTES[name];
    if (!p) throw new Error(`Unknown palette ${name}`);
    this.palette = name;
    this.s.colA = hexToRgb(p.a); this.s.colB = hexToRgb(p.b); this.s.hot = hexToRgb(p.hot);
    this.s.additive = p.blend === 'add';
    this.layout();
    this.wake();
  }

  setWind(x, y) {
    const l = Math.hypot(x, y) || 1;
    this.s.windX = x / l; this.s.windY = y / l;
  }

  /**
   * Live energy, 0..1 (a music level): swells the breathing, the drift and the shimmer around the
   * mood's own values. Cheap enough to call every frame: it writes a few numbers, allocates nothing.
   */
  setEnergy(e) {
    const k = clamp01(e);
    const m = MOODS[this.mood];
    const s = this.s;
    s.breath = 0.012 + 0.05 * k;
    s.drift = m.drift * (1 + 1.1 * k);
    s.swirl = m.swirl * (1 + 0.8 * k);
    s.flicker = Math.min(1, m.flicker * (1 + 1.6 * k));
    s.alpha = Math.min(1, m.alpha * (1 + 0.4 * k));
  }

  // --- the brand scene's cuts and the sand of the music (1.22.0) -------------------

  /** The fracture's cuts, grain for grain (js/fx/shard-file.js). Grain i of the shape is slot i. */
  setShards(cuts) {
    if (!cuts || cuts.count < this.budget) throw new Error('shard data does not cover the grains');
    const D = this.data;
    for (let i = 0; i < this.budget; i++) {
      const o = i * FLOATS, s = cuts.shardOf[i];
      D[o + 14] = cuts.fly[s * 2]; D[o + 15] = cuts.fly[s * 2 + 1]; D[o + 16] = cuts.spin[s]; D[o + 17] = cuts.crack[i];
    }
    this.renderer.upload(this.data, this.budget);
    this.hasShards = true;
  }

  /** Writes one mode's nodal targets (shape units, grain for grain) into slot 'p' or 'q'. */
  writeSandSlot(slot, targets) {
    const D = this.data, off = slot === 'p' ? 10 : 12;
    for (let i = 0; i < this.budget; i++) {
      D[i * FLOATS + off] = targets[i * 2];
      D[i * FLOATS + off + 1] = targets[i * 2 + 1];
    }
  }

  /** Moves the sand to a new figure: written into the slot not shown, then crossfaded. */
  sandFigure(targets, duration = 1400) {
    const toQ = this.s.sandMix < 0.5;
    this.writeSandSlot(toQ ? 'q' : 'p', targets);
    if (!this.sandReady) { this.writeSandSlot(toQ ? 'p' : 'q', targets); this.sandReady = true; }
    this.renderer.upload(this.data, this.budget);
    this.wake();
    return this.sandMixT.run(this.s.sandMix, toQ ? 1 : 0, duration, performance.now());
  }

  /** Live, every frame: how far the grains have gone into the figure (0..1), and the beat's hop (0..1). */
  setSand(strength, hop) {
    this.s.sand = this.sandReady ? clamp01(strength) : 0;
    this.s.hop = clamp01(hop);
  }

  /** A new part: cracks of light along the fracture, a beat of stillness, the burst, then home.
   *  The cuts live in the WebGL shader: without shards, or on the Canvas 2D fallback, the old blow-away. */
  async breakShards() {
    if (!this.hasShards || this.renderer.kind !== 'webgl2') return this.disperse({ duration: 900 }).then(() => this.gather({ duration: 1500 }));
    const now = () => performance.now();
    this.wake();
    await this.crackT.run(this.s.crack, 1, 420, now());
    await new Promise((r) => setTimeout(r, 100));
    if (this.reduced) return this.crackT.run(1, 0, 500, now());
    this.crackT.run(1, 0, 260, now());
    await this.brkT.run(0, 1, 650, now());
    await new Promise((r) => setTimeout(r, 220));
    await this.brkT.run(1, 0, 1300, now());
  }

  setDensity(d) { this.density = clamp01(d); this.layout(); this.wake(); }
  setSpin(radPerSecond) { this.spinRate = Number.isFinite(radPerSecond) ? radPerSecond : 0; this.wake(); }
  setInset(inset) { Object.assign(this.inset, inset); this.layout(); this.wake(); }

  /**
   * The cursor or a finger, in CSS px from the canvas's top-left corner. Call it on every
   * pointermove of a mouse, and while a finger is down on touch (touch = true widens the field).
   * Grains move out of the way, follow the stroke, curl round on each side and settle back
   * home once it has passed. Nothing moves in reduced motion. Allocates nothing.
   */
  pointerMove(x, y, touch = false) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const P = this.ptrState, dpr = this.stats.dpr || 1;
    const tx = x * dpr - this.s.viewW / 2, ty = y * dpr - this.s.viewH / 2;
    if (this.ptr.fresh) {
      // a new stroke: the old head keeps fading where it was, the new one starts from nothing
      if (P[PS.STRENGTH] > 0.02) this.dropStamp(1);
      P[PS.X] = P[PS.TX] = tx; P[PS.Y] = P[PS.TY] = ty;
      P[PS.VX] = 0; P[PS.VY] = 0; P[PS.STRENGTH] = 0;
      P[PS.MOVED] = performance.now();
      this.ptr.fresh = false;
    }
    if (Math.abs(tx - P[PS.TX]) + Math.abs(ty - P[PS.TY]) > 0.5) P[PS.MOVED] = performance.now();
    P[PS.TX] = tx; P[PS.TY] = ty;
    this.ptr.on = true; this.ptr.touch = touch === true;
    this.wake();
  }

  /** The cursor left the canvas or the finger lifted: the grains settle back. */
  pointerLeave() { this.ptr.on = false; this.ptr.fresh = true; }

  /** Field size and push, as multipliers of the defaults (0..3). */
  setPointer({ radius, strength } = {}) {
    if (Number.isFinite(radius)) this.pointerOptions.radius = Math.min(3, Math.max(0, radius));
    if (Number.isFinite(strength)) this.pointerOptions.strength = Math.min(3, Math.max(0, strength));
  }

  // The pointer state lives in a Float64Array, so the optimised code keeps no boxed number:
  // after warm-up, stirring adds no garbage per frame.
  updatePointer(dt, now) {
    const P = this.ptrState, s = this.s, F = s.field, opt = this.pointerOptions, on = this.ptr.on;
    if (this.reduced) {
      if (s.fieldOn) { F.fill(0); this.stampAge.fill(STAMP_LIFE); s.fieldOn = false; P[PS.STRENGTH] = 0; }
      return;
    }
    const dpr = this.stats.dpr || 1;
    // sized to the lettering, not the screen: a small title gets a small field
    P[PS.R] = Math.min(96, Math.max(22, (s.fitB / dpr) * 0.14)) * (this.ptr.touch ? 1.25 : 1) * opt.radius * dpr;
    // the head lags the pointer a little, like a hand drawn through sand
    P[PS.PX] = P[PS.X]; P[PS.PY] = P[PS.Y];
    P[PS.K] = 1 - Math.exp(-dt * 16);
    P[PS.X] += (P[PS.TX] - P[PS.X]) * P[PS.K];
    P[PS.Y] += (P[PS.TY] - P[PS.Y]) * P[PS.K];
    if (dt > 0) {
      P[PS.K] = 1 - Math.exp(-dt * 12);
      P[PS.VX] += ((P[PS.X] - P[PS.PX]) / dt - P[PS.VX]) * P[PS.K];
      P[PS.VY] += ((P[PS.Y] - P[PS.PY]) / dt - P[PS.VY]) * P[PS.K];
    }
    P[PS.SPEED] = Math.hypot(P[PS.VX], P[PS.VY]);
    if (P[PS.SPEED] > P[PS.R] * 22) {
      P[PS.K] = (P[PS.R] * 22) / P[PS.SPEED];
      P[PS.VX] *= P[PS.K]; P[PS.VY] *= P[PS.K];
    }
    // a pointer left still for a while lets most of the grains creep back under it
    P[PS.TARGET] = on ? (now - P[PS.MOVED] < 900 ? opt.strength : 0.4 * opt.strength) : 0;
    P[PS.K] = 1 - Math.exp(-dt * (P[PS.TARGET] > P[PS.STRENGTH] ? 9 : 3));
    P[PS.STRENGTH] += (P[PS.TARGET] - P[PS.STRENGTH]) * P[PS.K];
    if (P[PS.STRENGTH] < 0.002 && !on) P[PS.STRENGTH] = 0;
    F[0] = P[PS.X]; F[1] = P[PS.Y]; F[2] = P[PS.R]; F[3] = P[PS.STRENGTH]; F[4] = P[PS.VX]; F[5] = P[PS.VY];
    // the wake: marks dropped along the stroke fade out over their life and spread a little
    const age = this.stampAge, power = this.stampPower;
    let any = P[PS.STRENGTH] > 0;
    for (let i = 1; i < FIELD; i++) {
      const j = i * 6;
      if (age[i] >= STAMP_LIFE) { F[j + 3] = 0; continue; }
      age[i] = Math.min(STAMP_LIFE, age[i] + dt);
      F[j + 3] = power[i] * (1 - age[i] / STAMP_LIFE) * (1 - age[i] / STAMP_LIFE);
      F[j + 2] *= 1 + dt * 0.7;
      any = true;
    }
    if (P[PS.STRENGTH] > 0.05 && P[PS.SPEED] > P[PS.R] * 1.5 && now - P[PS.STAMPED] >= STAMP_MS) {
      this.dropStamp(0.85);
      P[PS.STAMPED] = now;
      any = true;
    }
    s.fieldOn = any;
  }

  /** Copies the live head into the oldest wake slot. */
  dropStamp(scale) {
    const F = this.s.field, age = this.stampAge;
    let slot = 1;
    for (let i = 2; i < FIELD; i++) if (age[i] > age[slot]) slot = i;
    F.copyWithin(slot * 6, 0, 6);
    age[slot] = 0;
    this.stampPower[slot] = F[3] * scale;
  }

  /** Changes the grain budget tier; resamples the current shape. */
  async setQuality(tier) {
    if (!(tier in QUALITY_TIERS)) throw new Error(`Unknown quality ${tier}`);
    this.tier = tier;
    this.budget = this.resolveBudget();
    this.governorCap = 1;
    this.data = new Float32Array(this.budget * FLOATS);
    this.seedSlots(this.budget);
    this.cache.clear();
    Object.assign(this.stats, { tier, budget: this.budget });
    if (this.current) {
      const shape = this.currentShape;
      if (shape) await this.setShape(shape, { transition: 'cut' });
    }
  }

  // --- frame ----------------------------------------------------------------

  applyReducedMotion() {
    const r = this.reducedOption === 'auto' ? this.reducedQuery.matches : Boolean(this.reducedOption);
    this.reduced = r;
    this.s.motion = r ? 0 : 1;
    if (r) {
      this.gatherT.finish(); this.morphT.finish(); this.disperseT.finish();
      this.s.morph = 1;
      if (this.s.disperse >= 1) { this.s.opacity = 0; }
      this.s.disperse = 0;
      this.s.gather = 1;
      if (this.progressTarget >= 0) this.s.opacity = 0.15 + 0.85 * this.progressTarget;
    }
    this.dirty = true;
    this.wake();
  }

  setReducedMotion(value) { this.reducedOption = value; this.applyReducedMotion(); }

  layout() {
    const s = this.s;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.stats.dpr = dpr;
    const W = s.viewW, H = s.viewH;
    const top = this.inset.top * dpr, bottom = this.inset.bottom * dpr, left = this.inset.left * dpr, right = this.inset.right * dpr;
    const freeW = Math.max(1, W - left - right), freeH = Math.max(1, H - top - bottom);
    const fit = (g) => (g ? Math.min(freeH * this.fill, (freeW * this.fill) / g.aspect) : 1);
    s.fitA = fit(this.previous ?? this.current);
    s.fitB = fit(this.current);
    s.centerX = (left - right) / 2;
    s.centerY = (top - bottom) / 2;
    const count = Math.max(1, Math.round(this.budget * this.density * this.governorCap));
    this.count = count;
    this.stats.count = count;
    const m = MOODS[this.mood];
    s.size = m.size * this.grainSize * dpr;
    // exposure: keep the body bright but not burnt, whatever the grain count and canvas size
    const g = this.current;
    if (g) {
      const areaPx = g.area * s.fitB * s.fitB;
      const grainPx = s.size * s.size * 0.75;
      const coverage = (count * grainPx) / Math.max(1, areaPx);
      s.exposure = Math.min(1, Math.max(0.12, 1.1 / Math.pow(Math.max(coverage, 0.01), 0.55)));
      if (!s.additive) s.exposure = Math.min(1, s.exposure * 1.2);
    }
  }

  resize() {
    this.needsResize = false;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.s.viewW = w; this.s.viewH = h;
    this.layout();
    this.dirty = true;
  }

  wake() {
    if (this.destroyed || this.raf) return;
    this.dirty = true;
    this.raf = requestAnimationFrame(this.frame);
  }

  animating() {
    return this.morphT.active || this.gatherT.active || this.disperseT.active || this.opacityT.active
      || this.sandMixT.active || this.brkT.active || this.crackT.active
      || (this.progressTarget >= 0 && Math.abs(this.s.gather - this.progressTarget) > 0.0005);
  }

  tick(now) {
    this.raf = 0;
    if (this.destroyed || this.paused || this.lost || !this.visible || document.hidden) return;
    const t0 = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.stats.frameMs += ((now - this.last) - this.stats.frameMs) * 0.08;
    this.last = now;
    if (this.needsResize) this.resize();
    const s = this.s;
    if (!this.reduced) s.time = ((now - this.t0) / 1000) % 1000;
    s.spin = this.reduced ? 0 : (s.spin + this.spinRate * dt) % (Math.PI * 2);
    if (this.morphT.active) s.morph = this.morphT.value(now);
    if (this.gatherT.active) s.gather = this.gatherT.value(now);
    if (this.disperseT.active) s.disperse = this.disperseT.value(now);
    if (this.opacityT.active) s.opacity = this.opacityT.value(now);
    if (this.sandMixT.active) s.sandMix = this.sandMixT.value(now);
    if (this.brkT.active) s.brk = this.brkT.value(now);
    if (this.crackT.active) s.crack = this.crackT.value(now);
    if (this.progressTarget >= 0 && !this.reduced) {
      s.gather += (this.progressTarget - s.gather) * (1 - Math.exp(-dt * 3.2));
    }
    this.updatePointer(dt, now);
    this.renderer.draw(s, this.current ? this.count : 0);
    this.dirty = false;
    const cpu = performance.now() - t0;
    this.stats.lastCpuMs = cpu;
    this.stats.cpuMs += (cpu - this.stats.cpuMs) * 0.08;
    this.stats.fps = this.stats.frameMs > 0 ? 1000 / this.stats.frameMs : 0;
    this.governor(now);
    if (this.onFrame) this.onFrame(this.stats);
    // reduced motion: draw only while something fades, then sleep
    if (!this.reduced || this.animating()) this.raf = requestAnimationFrame(this.frame);
  }

  /** Drops the grain count by steps when frames stay long, never raises it back on its own. */
  governor(now) {
    if (!this.adaptive || this.reduced) return;
    if (!this.govStart) { this.govStart = now; this.govSlow = 0; this.govFrames = 0; }
    this.govFrames++;
    if (this.stats.frameMs > 24) this.govSlow++;
    if (now - this.govStart > 2500) {
      if (this.govFrames > 20 && this.govSlow / this.govFrames > 0.6 && this.governorCap > 0.3) {
        this.governorCap = Math.max(0.3, this.governorCap * 0.75);
        this.layout();
      }
      this.govStart = now; this.govSlow = 0; this.govFrames = 0;
    }
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; this.last = performance.now(); this.wake(); }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    for (const t of [this.morphT, this.gatherT, this.disperseT, this.opacityT, this.sandMixT, this.brkT, this.crackT]) t.finish();
    this.resizeObserver.disconnect();
    this.intersection.disconnect();
    this.reducedQuery.removeEventListener('change', this.onReducedChange);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.onLost) {
      this.canvas.removeEventListener('webglcontextlost', this.onLost);
      this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    }
    this.renderer.destroy();
  }
}

function clamp01(v) { return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0)); }
