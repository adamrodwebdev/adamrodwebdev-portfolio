// Tests unitaires de l'emblème en éclats (1.20.0) : la géométrie, sans navigateur (node --test).
// L'effet lui-même (calques, animations) est vérifié par les tests Playwright de tests/site.spec.mjs.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMBLEM, HEXAGON, area, cutHexagon, grow, seams, seeded, shatter } from '../../js/fx/emblem-shards.js';

const near = (a, b, epsilon = 1e-6) => Math.abs(a - b) <= epsilon;
const hexagonArea = (3 * Math.sqrt(3) / 2) * EMBLEM.radius ** 2;

/** Un point est dans l'hexagone (bord compris) : du même côté de chacun de ses six côtés que le centre. */
function inside([x, y]) {
  return HEXAGON.every((a, i) => {
    const b = HEXAGON[(i + 1) % 6];
    const side = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    const centre = (b[0] - a[0]) * (EMBLEM.centre - a[1]) - (b[1] - a[1]) * (EMBLEM.centre - a[0]);
    return side * centre >= -1e-6;
  });
}

describe("l'emblème en éclats", () => {
  it('tire toujours la même suite pour la même graine, entre 0 et 1', () => {
    const a = seeded(7);
    const b = seeded(7);
    const first = Array.from({ length: 20 }, a);
    assert.deepEqual(Array.from({ length: 20 }, b), first);
    assert.ok(first.every((v) => v >= 0 && v < 1));
    assert.notDeepEqual(Array.from({ length: 20 }, seeded(8)), first);
  });

  it("découpe l'hexagone en éclats qui le recouvrent exactement, sans en sortir", () => {
    const pieces = cutHexagon(EMBLEM.shards, seeded(EMBLEM.seed));
    assert.equal(pieces.length, EMBLEM.shards);
    assert.ok(near(pieces.reduce((sum, t) => sum + area(t), 0), hexagonArea, 1e-6), 'la somme des aires est celle de l’hexagone');
    for (const t of pieces) {
      assert.ok(area(t) > 1, 'aucun éclat sans surface');
      for (const point of t) assert.ok(inside(point), `${point} hors de l’hexagone`);
    }
  });

  it('donne le même vol aux mêmes éclats à chaque fois, et des vols figés', () => {
    const one = shatter();
    const two = shatter();
    assert.equal(JSON.stringify(one), JSON.stringify(two));
    assert.ok(one.every(Object.isFrozen));
    for (const piece of one) {
      assert.ok(near(Math.hypot(...piece.dir), 1), 'une direction de longueur 1');
      assert.ok(piece.reach >= 1.1 && piece.reach <= 2.5);
      assert.ok(piece.depth >= 260 && piece.depth <= 680, 'jamais derrière la caméra (perspective de 900 px)');
      assert.ok(piece.lag >= 0 && piece.lag < 1);
    }
  });

  it('grossit chaque éclat d’un cheveu, pour qu’aucune couture ne se voie au repos', () => {
    const [piece] = shatter();
    const grown = grow(piece.tri, piece.centre, 0.8);
    grown.forEach((point, k) => {
      const before = Math.hypot(piece.tri[k][0] - piece.centre[0], piece.tri[k][1] - piece.centre[1]);
      const after = Math.hypot(point[0] - piece.centre[0], point[1] - piece.centre[1]);
      assert.ok(near(after - before, 0.8));
    });
  });

  it('trace chaque couture une seule fois', () => {
    const lines = seams(shatter());
    const keys = lines.map((pair) => pair.map((p) => p.map((v) => v.toFixed(1)).join(',')).sort().join('|'));
    assert.equal(new Set(keys).size, lines.length);
    assert.ok(lines.length > EMBLEM.shards);
  });
});
