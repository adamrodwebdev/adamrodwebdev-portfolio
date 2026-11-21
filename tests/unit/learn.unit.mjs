// Tests unitaires de « Comment marche le Web » (1.19.0) : les parties pures des épisodes, sans navigateur
// (node --test). La scène, qui dessine dans le DOM, est vérifiée par les tests Playwright et le tournage.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EASE, clamp, phase, pulse } from '../../js/learn/ease.js';
import { Timeline } from '../../js/learn/timeline.js';
import { ASPECT, FOCUS, Shots, viewBoxOf } from '../../js/learn/camera.js';
import { FILES, INK, LINES, ROUTE, SHAPES, STATIONS, fractionNear, linePoints, offsetPath, pointAlong, polylineLength } from '../../js/learn/world.js';
import { CAPTION_MAX, readSeconds } from '../../js/learn/captions.js';
import { BYTES, CAPTIONS, Direction, PANELS, PLAN, QUESTION_SIZE, WORD } from '../../js/learn/episode01.js';
import { BREAK, CRACK, FRAC_STEP, REPAIR, TITLE, breakAndRebuild, crack, fracClass, repair, shatter, snapFrac, stepped, wholeAt } from '../../js/learn/frac.js';
import { PANEL, panelOffset, panelWindow } from '../../js/learn/transitions.js';
import { Direction as LanguagesBase } from '../../js/learn/episode02.js';
import { learnEpisode2, learnPage } from '../../js/i18n/messages.js';

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

describe("l'épisode 1, « Le voyage d'une page »", () => {
  const direction = new Direction();
  const at = (id, seconds) => direction.at(id, seconds);

  it('dure ses battements prévus', () => {
    assert.ok(near(direction.duration, PLAN.reduce((sum, beat) => sum + beat.seconds, 0)));
  });

  it("dessine le même état pour le même instant, dans n'importe quel ordre (le film se tourne en désordre)", () => {
    const times = [40.1, 0.9, 17.0, 4.0, 30.5, 24.2];
    const first = times.map((t) => JSON.stringify(direction.state(t)));
    const again = [...times].reverse().map((t) => JSON.stringify(direction.state(t))).reverse();
    assert.deepEqual(again, first);
  });

  it('trace chaque ligne une fois, sans jamais reculer, et la finit', () => {
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

  it("arrête la demande au globe pendant qu'Internet s'ouvre", () => {
    const atGlobe = direction.drawn('request', at('internet', 0.5));
    assert.ok(near(direction.drawn('request', at('internet', 9.5)), atGlobe), 'immobile pendant Internet');
    assert.ok(atGlobe > 0.3 && atGlobe < 0.75, `au globe : ${atGlobe}`);
  });

  it('montre « ? » dans son hexagone, puis « PAGE ? » qui se brise en bits et arrive entier au serveur', () => {
    assert.equal(direction.token(at('ask', 1)), null, 'pas de message avant le lien touché');
    const question = direction.token(at('ask', 8));
    assert.equal(question.form, 'mark');
    assert.equal(question.label, '?');
    const { breaks, rebuilds } = direction.word;
    const before = direction.token(breaks - 0.01);
    assert.equal(before.form, 'word');
    assert.equal(before.label, WORD);
    assert.equal(before.frac, 0, 'entier avant de se briser');
    assert.equal(direction.token((breaks + rebuilds) / 2).frac, 100, 'brisé pendant le voyage');
    assert.equal(direction.token(direction.request.arrive).frac, 0, 'entier à son arrivée au serveur');
    assert.equal(direction.token(direction.duration), null);
  });

  it('fait flotter autour du mot brisé les vrais octets de « page? », et les range quand il se répare', () => {
    assert.equal(BYTES.join(''), [...'page?'].map((c) => c.charCodeAt(0).toString(2).padStart(8, '0')).join(''));
    const { breaks, rebuilds } = direction.word;
    const broken = direction.token((breaks + rebuilds) / 2);
    assert.deepEqual(broken.bytes, BYTES);
    assert.equal(broken.bits, 1, 'les bits se voient quand le mot est brisé');
    assert.equal(direction.token(breaks - 0.01).bits, 0, 'aucun bit tant que le mot est entier');
    assert.equal(direction.token(direction.request.arrive).bits, 0, 'aucun bit une fois réparé');
  });

  it('grossit le « ? » pour qu’il se lise, et le ramène à la taille des bits sans saut', () => {
    assert.ok(QUESTION_SIZE > 1);
    assert.equal(direction.token(at('ask', 8)).size, QUESTION_SIZE, 'le « ? » en route');
    assert.equal(direction.token(at('internet', 5)).size, QUESTION_SIZE, 'le « ? » qui attend au globe');
    assert.equal(direction.token(at('binary', 0.5)).size, 1, 'les bits à leur taille');
    // Image par image (1/30 s) autour du passage aux bits : la taille ne fait que décroître, par petits pas.
    let last = direction.token(at('binary', -0.2)).size;
    for (let t = at('binary', -0.2); t <= at('binary', 0.6); t += 1 / 30) {
      const { size } = direction.token(t);
      assert.ok(size <= last + 1e-9 && last - size < 0.15, `à ${t.toFixed(3)} s : ${last} → ${size}`);
      last = size;
    }
  });

  it('finit sur le téléphone, cadré comme au début : la boucle se referme', () => {
    const start = direction.state(0).camera;
    const end = direction.state(direction.duration).camera;
    for (const key of Object.keys(start)) assert.ok(near(end[key], start[key]), `${key} : ${start[key]} au début, ${end[key]} à la fin`);
  });

  it('ouvre le réseau pour Internet seulement', () => {
    assert.equal(direction.state(at('ask', 5)).network, null);
    assert.ok(direction.state(at('internet', 5)).network.shown > 0.99);
    assert.equal(direction.state(at('server', 5)).network, null);
  });

  it('fait passer le serveur du jour à la nuit et retour, puis sort trois documents sur le plateau', () => {
    const cycle = (s) => direction.state(at('server', s)).dayNight.night;
    assert.ok(cycle(2.4) < 0.01 && cycle(4.5) > 0.99 && cycle(6.6) < 0.01);
    const tray = direction.state(at('server', 10.5)).tray;
    assert.deepEqual(tray.docs.map((doc) => near(doc, 1, 1e-6)), [true, true, true]);
  });

  it('ramène les trois documents au téléphone, et les montre arrivés à la fin', () => {
    assert.deepEqual(Object.values(direction.docs(at('ask', 3))), [null, null, null]);
    const middle = direction.docs(at('back', 2));
    assert.ok(['html', 'css', 'js'].every((key) => middle[key] && middle[key].along > 0 && middle[key].along < 1));
    assert.deepEqual(direction.state(direction.duration).screen.received.map((f) => near(f, 1)), [true, true, true]);
  });

  it('étire ses moments avec la voix : un battement deux fois plus long garde son déroulé', () => {
    const longer = new Direction(new Timeline(PLAN.map((beat) => ({ id: beat.id, seconds: beat.id === 'internet' ? beat.seconds * 2 : beat.seconds }))));
    const net = (d) => d.state(d.at('internet', 2.2)).network.drawn;
    assert.ok(near(net(longer), net(direction)));
    assert.ok(near(longer.at('internet', 10.5) - longer.at('internet', 0), 21));
  });

  it('refuse une ligne de temps dont un battement lui est inconnu', () => {
    assert.throws(() => new Direction(new Timeline([{ id: 'intro', seconds: 3 }])), RangeError);
  });

  it('prend les battements fixés par la voix : tous, dans leur ordre, chacun une vraie durée', () => {
    const voiced = PLAN.map((beat) => ({ id: beat.id, seconds: beat.id === 'server' ? 14 : beat.seconds }));
    const retimed = Direction.retimed(voiced);
    assert.ok(near(retimed.duration, direction.duration + 14 - 12.7));
    assert.ok(near(retimed.at('server', 12.7) - retimed.at('server', 0), 14), 'le serveur étiré à 14 s');
  });

  it('refuse des battements venus de dehors qui manquent, changent d’ordre ou de nature', () => {
    const plan = PLAN.map(({ id, seconds }) => ({ id, seconds }));
    const swapped = [plan[1], plan[0], ...plan.slice(2)];
    assert.throws(() => Direction.retimed(plan.slice(1)), TypeError);
    assert.throws(() => Direction.retimed(swapped), TypeError);
    assert.throws(() => Direction.retimed('ask'), TypeError);
    assert.throws(() => Direction.retimed([null, ...plan.slice(1)]), TypeError);
    for (const seconds of ['10', Number.NaN, 0, -1, 121, Infinity]) {
      assert.throws(() => Direction.retimed([{ id: 'ask', seconds }, ...plan.slice(1)]), RangeError, String(seconds));
    }
  });

  it('laisse chaque sous-titre assez longtemps pour le lire une fois réparé, en français et en anglais (prévu avant la voix)', () => {
    const times = direction.captions();
    assert.equal(times.length, CAPTIONS.length);
    for (const lang of ['fr', 'en']) {
      const texts = learnPage[lang].captions;
      assert.equal(texts.length, CAPTIONS.length, `${lang} : autant de sous-titres que de places`);
      for (const { index, start, whole, end } of times) {
        assert.ok(near(whole - start, REPAIR), `n° ${index + 1} : réparé en ${REPAIR} s`);
        assert.ok(end - whole >= readSeconds(texts[index]) - 1e-9, `${lang} n° ${index + 1} « ${texts[index]} » : ${(end - whole).toFixed(2)} s de lecture pour ${readSeconds(texts[index]).toFixed(2)} s`);
        assert.ok([...texts[index]].length <= CAPTION_MAX, `${lang} n° ${index + 1} dépasse ${CAPTION_MAX} caractères`);
      }
    }
  });

  it('attend la fin du titre pour son premier sous-titre et pour le doigt qui touche le lien', () => {
    assert.ok(direction.captions()[0].start >= TITLE.duration);
    assert.equal(direction.state(TITLE.duration - 0.01).screen.ripple.opacity, 0, 'le lien n’est pas encore touché sous le titre');
  });

  it('ne fait jamais se chevaucher deux sous-titres', () => {
    const times = direction.captions();
    for (let k = 1; k < times.length; k++) assert.ok(times[k].start >= times[k - 1].end, `n° ${k} et ${k + 1}`);
  });

  it('a, dans chaque langue, autant de phrases de voix et de mots expliqués', () => {
    assert.equal(learnPage.fr.narration.length, learnPage.en.narration.length);
    assert.equal(learnPage.fr.glossary.length, learnPage.en.glossary.length);
    assert.equal(learnPage.fr.beats.length, PLAN.length);
    assert.equal(learnPage.en.beats.length, PLAN.length);
  });
});

describe('la fracture de Clivage', () => {
  const onGrid = (value) => Number.isInteger(value / FRAC_STEP) && value >= 0 && value <= 100;

  it('avance par paliers comme steps(n, end), toujours sur la grille de 5', () => {
    const spec = { start: 1, duration: 1, from: 100, to: 0, steps: 4 };
    assert.equal(stepped(0.5, spec), 100);
    assert.equal(stepped(1.1, spec), 100, 'le premier palier tient jusqu’à la fin de son intervalle');
    assert.equal(stepped(1.3, spec), 75);
    assert.equal(stepped(2, spec), 0);
    assert.equal(snapFrac(37), 35);
    assert.equal(snapFrac(-3), 0);
    assert.equal(snapFrac(140), 100);
    assert.equal(fracClass(83), 'frac-85');
  });

  it('répare un texte de 100 à 0 en REPAIR secondes, sans jamais revenir en arrière', () => {
    assert.equal(repair(9.99, 10), 100);
    assert.equal(repair(wholeAt(10), 10), 0);
    let last = 100;
    for (let t = 10; t <= 10.5; t += 1 / 60) {
      const value = repair(t, 10);
      assert.ok(onGrid(value) && value <= last, `${t.toFixed(3)} : ${value}`);
      last = value;
    }
  });

  it('brise le titre d’un coup puis le répare, entier au début et à la fin de sa seconde', () => {
    assert.equal(shatter(0, 0), 0);
    assert.equal(shatter(TITLE.duration * TITLE.breakShare, 0), 100);
    assert.equal(shatter(TITLE.duration, 0), 0);
  });

  it('fêle le numéro d’un panneau de 35 à 85, puis le ramène à 35', () => {
    assert.equal(crack(4.9, 5), CRACK.rest);
    assert.equal(crack(5 + CRACK.rise, 5), CRACK.peak);
    assert.equal(crack(5 + CRACK.rise + CRACK.fall, 5), CRACK.rest);
  });

  it('brise un mot, le garde brisé, puis le répare', () => {
    assert.equal(breakAndRebuild(0.99, 1, 4), 0);
    assert.equal(breakAndRebuild(1 + BREAK.duration, 1, 4), 100);
    assert.equal(breakAndRebuild(3.99, 1, 4), 100);
    assert.equal(breakAndRebuild(4 + REPAIR, 1, 4), 0);
  });
});

describe('les panneaux entre les battements', () => {
  it('montent, se posent au début du battement, puis redescendent ; rien hors de leur fenêtre', () => {
    const [from, to] = panelWindow(10);
    assert.equal(panelOffset(from - 0.01, 10), null);
    assert.ok(near(panelOffset(from, 10), 1));
    assert.equal(panelOffset(10, 10), 0);
    assert.equal(panelOffset(10 + PANEL.hold, 10), 0);
    assert.equal(panelOffset(to, 10), null);
    let last = 1;
    for (let t = from; t < 10; t += 0.02) {
      const offset = panelOffset(t, 10);
      assert.ok(offset <= last + 1e-9, `il monte sans redescendre (${t.toFixed(2)})`);
      last = offset;
    }
  });
});

describe("l'habillage de l'épisode 1", () => {
  const direction = new Direction();
  const at = (id, seconds) => direction.at(id, seconds);

  it('ne fait jamais deux fractures à la fois, ni sur les battements prévus ni sur une voix plus lente', () => {
    const slower = new Direction(new Timeline(PLAN.map((beat) => ({ id: beat.id, seconds: beat.seconds * 1.25 }))));
    for (const [name, d] of [['prévu', direction], ['voix plus lente', slower]]) {
      const fractures = d.fractures();
      for (let k = 1; k < fractures.length; k++) {
        assert.ok(fractures[k].window[0] >= fractures[k - 1].window[1] - 1e-9, `${name} : « ${fractures[k - 1].kind} » et « ${fractures[k].kind} » se chevauchent`);
      }
    }
  });

  it('ouvre sur le titre pendant une seconde, puis montre la ligne d’état du battement en cours', () => {
    assert.equal(direction.chrome(0.5).title.shown, true);
    assert.equal(direction.chrome(0.5).status.shown, false);
    assert.equal(direction.chrome(0.5).caption, null, 'aucun sous-titre sous le titre');
    assert.equal(direction.chrome(TITLE.duration).title.shown, false);
    assert.equal(direction.chrome(at('server', 3)).status.index, 3);
  });

  it('pose un panneau à chaque battement qui en a un, numéroté, montant puis descendant tour à tour', () => {
    const seen = PANELS.map(({ beat }) => direction.chrome(at(beat, 0)).panel);
    assert.deepEqual(seen.map((panel) => panel.number), [2, 3, 4, 5]);
    assert.deepEqual(seen.map((panel) => panel.kind), ['rise', 'fall', 'rise', 'fall']);
    assert.equal(direction.chrome(at('server', 6)).panel, null);
  });

  it('se pose, en mouvement réduit, sur chaque battement sans panneau, sans titre, son sous-titre entier', () => {
    for (const beat of direction.timeline.beats) {
      const chrome = direction.chrome(Math.max(beat.start, beat.end - (PANEL.rise + 0.1)));
      assert.equal(chrome.panel, null, beat.id);
      assert.equal(chrome.title.shown, false, beat.id);
      if (chrome.caption) assert.equal(chrome.caption.frac, 0, beat.id);
    }
  });

  it('garde le même habillage pour le même instant, dans n’importe quel ordre', () => {
    const times = [0.4, 21.9, 10.5, 44.6, 26.2];
    const first = times.map((t) => JSON.stringify(direction.chrome(t)));
    assert.deepEqual([...times].reverse().map((t) => JSON.stringify(direction.chrome(t))).reverse(), first);
  });
});

describe('les couleurs du site, et rien d’autre', () => {
  const PALETTE = ['#000000', '#0e0c08', '#17140d', '#e0b04a', '#f5cf6e', '#9a7420', '#f6f4ef', '#a8a193', '#57514a'];

  it('n’emploie que les jetons du site, et distingue les fichiers par leur forme', () => {
    for (const colour of Object.values(INK)) assert.ok(PALETTE.includes(colour), colour);
    for (const line of LINES) assert.ok(PALETTE.includes(line.ink), line.key);
    assert.deepEqual(Object.values(FILES).map((file) => file.shape), ['hex', 'diamond', 'shard']);
    for (const file of Object.values(FILES)) assert.ok(SHAPES[file.shape], file.label);
  });

  it('n’écrit aucune autre couleur dans la scène ni dans l’habillage', async () => {
    const { readFile } = await import('node:fs/promises');
    for (const name of ['scene.js', 'chrome.js']) {
      const source = await readFile(new URL(`../../js/learn/${name}`, import.meta.url), 'utf8');
      const colours = [...source.matchAll(/#[0-9a-f]{3,8}\b/gi)].map(([hex]) => hex.toLowerCase()).filter((hex) => hex !== '#fff');
      assert.deepEqual(colours, [], name);
    }
  });
});

describe("la base de l'épisode 2 (pas encore branchée)", () => {
  it('dessine toujours le même état pour le même instant', () => {
    const base = new LanguagesBase();
    assert.equal(JSON.stringify(base.state(20)), JSON.stringify(base.state(20)));
  });

  it('garde son texte final : cinq phrases et dix-sept sous-titres par langue, 35 caractères au plus', () => {
    for (const lang of ['fr', 'en']) {
      assert.equal(learnEpisode2[lang].narration.length, 5, `${lang} : cinq phrases`);
      assert.equal(learnEpisode2[lang].captions.length, 17, `${lang} : dix-sept sous-titres`);
      for (const caption of learnEpisode2[lang].captions) assert.ok([...caption].length <= CAPTION_MAX, `${lang} « ${caption} »`);
    }
  });
});
