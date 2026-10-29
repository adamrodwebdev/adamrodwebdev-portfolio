/**
 * Ce qu'une page générée demande une fois son premier affichage signalé (1.8.1) : les polices et,
 * sur l'accueil, les îlots Vue. Le premier affichage vient du HTML et de sa feuille de style en ligne ;
 * rien ne lui fait concurrence, et ces requêtes ne partent qu'une image plus tard environ.
 *
 *  - Onglet en arrière-plan (aucun affichage à attendre) : tout part aussitôt.
 *  - Navigateur sans mesure des affichages : une image, puis une tâche.
 *  - Mesure qui ne vient pas : tout part au bout d'une seconde.
 *
 * La fonction est copiée telle quelle dans un <script> de la page : JavaScript simple, sans module.
 */
function afterFirstPaint(stylesheets, modules, entry) {
  var started = false;
  var link = function (rel, href) {
    var element = document.createElement('link');
    element.rel = rel;
    element.href = href;
    if (rel === 'modulepreload') element.crossOrigin = '';
    document.head.appendChild(element);
  };
  var start = function () {
    if (started) return;
    started = true;
    stylesheets.forEach(function (href) { link('stylesheet', href); });
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
 * @param {{ stylesheets?: string[], modules?: string[], entry?: string }} assets
 *   feuilles de style (les polices), modules à précharger, module d'entrée des îlots Vue.
 */
export function afterFirstPaintScript({ stylesheets = [], modules = [], entry = '' }) {
  const args = [stylesheets, modules, entry].map((value) => JSON.stringify(value)).join(', ');
  return `(${afterFirstPaint})(${args});`;
}
