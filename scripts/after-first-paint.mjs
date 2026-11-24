/**
 * Ce qu'une page générée demande une fois son premier affichage signalé (1.8.1) : les polices et,
 * sur l'accueil, les îlots Vue. Le premier affichage vient du HTML et de sa feuille de style en ligne ;
 * rien ne lui fait concurrence, et ces requêtes ne partent qu'une image plus tard environ.
 *
 *  - Onglet en arrière-plan (aucun affichage à attendre) : tout part aussitôt.
 *  - Navigateur sans mesure des affichages : une image, puis une tâche.
 *  - Mesure qui ne vient pas : tout part au bout d'une seconde.
 *
 * Polices bloc par bloc (1.18.1), si la page donne sa liste : la page s'affiche avec ses polices locales
 * (classe fonts-staged, posée avant le premier affichage), les polices du site se chargent, puis chaque bloc
 * de la page les reçoit (classe fonts-on), ceux de l'écran d'abord, chacun dans sa tâche. Chrome mesure
 * chaque lettre de chaque taille d'une police web à sa première mise en page : donnée à toute la page d'un
 * coup, l'arrivée des polices faisait la tâche la plus longue du chargement sur mobile. Les règles sont
 * dans css/style.css (« Polices bloc par bloc »). Un événement « fontsapplied » suit chaque bloc ; la classe
 * fonts-ready marque la fin.
 *
 * La fonction est copiée telle quelle dans un <script> de la page : JavaScript simple, sans module.
 */
function afterFirstPaint(stylesheets, modules, entry, fonts) {
  var started = false;
  var root = document.documentElement;
  var staged = fonts.length > 0 && !!document.fonts && typeof document.fonts.load === 'function';
  if (staged) root.classList.add('fonts-staged');
  var link = function (rel, href) {
    var element = document.createElement('link');
    element.rel = rel;
    element.href = href;
    if (rel === 'modulepreload') element.crossOrigin = '';
    document.head.appendChild(element);
    return element;
  };
  // Distance d'un bloc à l'écran (0 s'il y est) : l'ordre dans lequel les blocs reçoivent les polices
  var distance = function (element) {
    var box = element.getBoundingClientRect();
    return box.bottom < 0 ? -box.bottom : box.top > innerHeight ? box.top - innerHeight : 0;
  };
  // Les blocs : ce qui entoure main, et dans chaque section de main, chacun de ses morceaux (l'en-tête, la
  // grille, chaque encart) ; une section entière d'un coup, celle des offres, faisait encore une tâche longue
  var BLOCKS = 'body > :not(main):not(script):not(noscript):not(template), main > * > :not(.container), main > * > .container > *';
  var applyFonts = function () {
    var blocks = [].slice.call(document.querySelectorAll(BLOCKS));
    var order = blocks
      .map(function (block, index) { return [distance(block), index, block]; })
      .sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var next = 0;
    var step = function () {
      if (next === order.length) { root.classList.add('fonts-ready'); return; }
      var block = order[next++][2];
      block.classList.add('fonts-on');
      // La mise en page de ce bloc, ici : chaque bloc dans sa tâche, aucune ne dure
      void block.offsetHeight;
      document.dispatchEvent(new CustomEvent('fontsapplied', { detail: block }));
      setTimeout(step, 0);
    };
    step();
  };
  // Une police qui ne vient pas laisse sa place au repli : les blocs reçoivent quand même les autres
  var loadFonts = function () {
    Promise.all(fonts.map(function (font) {
      return document.fonts.load(font[0], font[1]).then(null, function () { return null; });
    })).then(applyFonts);
  };
  var start = function () {
    if (started) return;
    started = true;
    var waiting = stylesheets.length;
    stylesheets.forEach(function (href) {
      var sheet = link('stylesheet', href);
      if (!staged) return;
      // Les polices se chargent une fois leurs déclarations lues ; une feuille qui manque n'arrête rien
      var done = function () { if (--waiting === 0) loadFonts(); };
      sheet.addEventListener('load', done);
      sheet.addEventListener('error', done);
    });
    if (staged && !stylesheets.length) loadFonts();
    if (!entry) return;
    modules.forEach(function (href) { link('modulepreload', href); });
    var script = document.createElement('script');
    script.type = 'module';
    script.src = entry;
    document.head.appendChild(script);
  };
  var types = window.PerformanceObserver && PerformanceObserver.supportedEntryTypes;
  if (document.visibilityState === 'hidden') {
    start();
  } else if (types && types.indexOf('paint') !== -1) {
    new PerformanceObserver(function (list, observer) {
      if (!list.getEntriesByName('first-contentful-paint').length) return;
      observer.disconnect();
      start();
    }).observe({ type: 'paint', buffered: true });
    setTimeout(start, 1000);
  } else {
    requestAnimationFrame(function () { setTimeout(start, 0); });
  }
}

/**
 * Le script à placer dans la page.
 * @param {{ stylesheets?: string[], modules?: string[], entry?: string, fonts?: [string, string][] }} assets
 *   feuilles de style (les polices), modules à précharger, module d'entrée des îlots Vue, et les polices à
 *   donner bloc par bloc : [police, texte] pour document.fonts.load, le texte choisissant le fichier
 *   (unicode-range). Sans cette liste, les polices arrivent comme le navigateur les trouve.
 */
export function afterFirstPaintScript({ stylesheets = [], modules = [], entry = '', fonts = [] }) {
  const args = [stylesheets, modules, entry, fonts].map((value) => JSON.stringify(value)).join(', ');
  return `(${afterFirstPaint})(${args});`;
}
