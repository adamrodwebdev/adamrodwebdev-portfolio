// Tests unitaires de « Comment marche le Web » (1.14.0) : les parties pures de l'épisode, sans navigateur
// (node --test). La scène, qui dessine dans le DOM, est vérifiée par les tests Playwright et le tournage.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EASE, clamp, phase, pulse } from '../../js/learn/ease.js';
import { Timeline } from '../../js/learn/timeline.js';
import { ASPECT, FOCUS, Shots, viewBoxOf } from '../../js/learn/camera.js';
import { LINES, ROUTE, STATIONS, fractionNear, linePoints, offsetPath, pointAlong, polylineLength } from '../../js/learn/world.js';
import { CAPTIONS, Direction, PLAN, readSeconds } from '../../js/learn/episode01.js';
import { learnPage } from '../../js/i18n/messages.js';

const near = (a, b, epsilon = 1e-6) => Math.abs(a - b) <= epsilon;

describe('les courbes', () => {
  it('commencent à 0, finissent à 1, et restent dans leurs bornes', () => {
    for (const [name, curve] of Object.entries(EASE)) {
      assert.ok(near(curve(0), 0), `${name}(0)`);
      assert.ok(near(curve(1), 1), `${name}(1)`);
    }
    assert.equal(clamp(3), 1);
    assert.equal(phase(5, 2, 4), 1);
    assert.equal(phase(1, 2, 4), 0);
    assert.equal(phase(3, 2, 4), 0.5);
  });

  it("donnent un battement bref qui culmine à son instant et s'éteint au-delà de sa largeur", () => {
    assert.ok(near(pulse(2, 2, 1), 1));
    assert.equal(pulse(3, 2, 1), 0);
  });
});

describe('la ligne de temps', () => {
  const timeline = new Timeline([{ id: 'a', seconds: 2 }, { id: 'b', seconds: 3 }]);

  it("additionne ses battements et trouve celui d'un instant", () => {
    assert.equal(timeline.duration, 5);
    assert.equal(timeline.indexAt(0), 0);
    assert.equal(timeline.indexAt(2), 1);
    assert.equal(timeline.indexAt(99), 1);
    assert.equal(timeline.at('b', 1), 3);
  });

  it('refuse un battement mal nommé, une durée impossible ou une liste vide', () => {
    assert.throws(() => new Timeline([]), TypeError);
    assert.throws(() => new Timeline([{ id: 'Bad Id', seconds: 1 }]), TypeError);
    assert.throws(() => new Timeline([{ id: 'a', seconds: Number.NaN }]), RangeError);
    assert.throws(() => new Timeline([{ id: 'a', seconds: -1 }]), RangeError);
    assert.throws(() => timeline.beat('z'), RangeError);
  });
});

describe('le plan de métro', () => {
  it('garde ses quatre lignes parallèles, à leur écart, sur les segments droits', () => {
    const left = offsetPath(ROUTE, -24);
    const right = offsetPath(ROUTE, 24);
    // Le segment vertical du téléphone : les deux lignes extrêmes à 48 unités l'une de l'autre.
    assert.ok(near(Math.abs(left[0][0] - right[0][0]), 48));
  });

  it('place un point le long du tracé, des extrémités au milieu', () => {
    const points = linePoints(LINES[0]);
    assert.deepEqual(pointAlong(points, 0), points[0]);
    assert.deepEqual(pointAlong(points, 1).map(Math.round), points.at(-1).map(Math.round));
    // Une ligne décalée garde à peu près la longueur du tracé central (plus longue à l'extérieur des virages).
    const length = polylineLength(points);
    const centre = polylineLength(ROUTE);
    assert.ok(Math.abs(length - centre) < 0.15 * centre, `longueur ${length} pour ${centre}`);
  });

  it("trouve la correspondance d'Internet vers le milieu de chaque ligne", () => {
    for (const line of LINES) {
      const at = fractionNear(linePoints(line), STATIONS.internet);
      assert.ok(at > 0.3 && at < 0.75, `${line.key} : ${at}`);
    }
  });
});

describe('la caméra', () => {
  it('cadre en 9:16, le sujet à FOCUS de la hauteur', () => {
    const box = viewBoxOf({ cx: 300, cy: 900, width: 450 });
    assert.ok(near(box.height / box.width, ASPECT));
    assert.ok(near((900 - box.y) / box.height, FOCUS));
  });

  it("passe d'un plan au suivant sans saut : identique au précédent au début du fondu, au nouveau à la fin", () => {
    const a = { cx: 100, cy: 100, width: 400 };
    const b = { cx: 500, cy: 900, width: 800 };
    const shots = new Shots([{ at: 0, blend: 0, frame: () => a }, { at: 10, blend: 2, frame: () => b }]);
    const same = (x, y) => ['cx', 'cy', 'width'].every((key) => near(x[key], y[key], 1e-9));
    assert.ok(same(shots.framing(10), a), 'au début du fondu : le plan précédent');
    assert.ok(same(shots.framing(12), b), 'à la fin du fondu : le nouveau plan');
    const middle = shots.framing(11);
    assert.ok(middle.width > a.width && middle.width < b.width);
  });
});

describe("la mise en scène de l'épisode 1", () => {
  const direction = new Direction();

  it('dure ses battements prévus', () => {
    assert.ok(near(direction.duration, PLAN.reduce((sum, beat) => sum + beat.seconds, 0)));
  });

  it("dessine le même état pour le même instant, dans n'importe quel ordre (le film se tourne en désordre)", () => {
    const times = [31.7, 0.9, 17.4, 4.0, 12.6];
    const first = times.map((t) => JSON.stringify(direction.state(t)));
    const again = [...times].reverse().map((t) => JSON.stringify(direction.state(t))).reverse();
    assert.deepEqual(again, first);
  });

  it('trace chaque ligne une fois, sans jamais reculer', () => {
    for (const line of LINES) {
      let last = 0;
      for (let t = 0; t <= direction.duration; t += 0.1) {
        const drawn = direction.drawn(line.key, t);
        assert.ok(drawn >= last - 1e-9, `${line.key} recule à ${t.toFixed(1)} s`);
        last = drawn;
      }
      assert.ok(near(last, 1), `${line.key} finit tracée`);
    }
  });

  it('montre un seul jeton à la fois, et aucun avant la demande ni à la fin', () => {
    assert.equal(direction.token(0.5), null);
    assert.equal(direction.token(direction.duration), null);
    assert.equal(direction.token(direction.at('ask', 3)).label, '?');
    assert.equal(direction.token(direction.at('answer', 2.5)).label, 'index.html');
  });

  it('compte trois « j’aime » à la fin, et enlève les étiquettes de la page finie', () => {
    const end = direction.state(direction.duration).screen;
    assert.equal(end.likes, 3);
    assert.equal(end.badges, 0);
    assert.equal(end.dress, 1);
  });

  it('étire ses moments avec la voix : un battement deux fois plus long garde son déroulé', () => {
    const longer = new Direction(new Timeline(PLAN.map((beat) => ({ id: beat.id, seconds: beat.id === 'answer' ? beat.seconds * 2 : beat.seconds }))));
    const half = direction.drawn('html', direction.at('answer', 2.6));
    assert.ok(near(longer.drawn('html', longer.at('answer', 2.6)), half));
    assert.ok(near(longer.at('answer', 7.5) - longer.at('answer', 0), 15));
  });

  it('refuse une ligne de temps dont un battement lui est inconnu', () => {
    assert.throws(() => new Direction(new Timeline([{ id: 'intro', seconds: 3 }])), RangeError);
  });

  it('laisse chaque sous-titre assez longtemps pour le lire, en français et en anglais (prévu avant la voix)', () => {
    const times = direction.captions();
    assert.equal(times.length, CAPTIONS.length);
    for (const lang of ['fr', 'en']) {
      const texts = learnPage[lang].captions;
      assert.equal(texts.length, CAPTIONS.length, `${lang} : dix sous-titres`);
      for (const { index, start, end } of times) {
        assert.ok(end - start >= readSeconds(texts[index]) - 1e-9, `${lang} n° ${index + 1} « ${texts[index]} » : ${(end - start).toFixed(2)} s pour ${readSeconds(texts[index]).toFixed(2)} s`);
        assert.ok([...texts[index]].length <= 35, `${lang} n° ${index + 1} dépasse 35 caractères`);
      }
    }
  });

  it('ne fait jamais se chevaucher deux sous-titres', () => {
    const times = direction.captions();
    for (let k = 1; k < times.length; k++) assert.ok(times[k].start >= times[k - 1].end, `n° ${k} et ${k + 1}`);
  });
});
