/*
 * Biaflix Nebula v__NEBULA_VERSION__ — snippet per JS Injector ("Biaflix Nebula", pubblico).
 * Carica nebula.js UNA sola volta. Il JS si attiva solo se la skin "Biaflix Nebula" è selezionata
 * nello Skin Manager di KefinTweaks. Per spegnere tutto: disattivare questo script in JS Injector.
 */
(function () {
  'use strict';
  if (window.BiaflixNebula || document.getElementById('biaflix-nebula-js')) return;

  window.BiaflixNebulaConfig = {
    enabled: true,
    activation: 'skin',
    skinName: 'Biaflix Nebula',
    hero: true,
    heroAutoplay: false,
    heroCollectionName: 'In evidenza',
    homeCollectionsRail: true,
    homeWatchlistRail: true,
    cardActions: true,
    detailActions: true,
    collectionsHub: true,
    collectionManage: true,
    locale: 'auto',
    debug: false,
  };

  // Sostituire con l'URL versionato (tag fisso, mai @latest) dove è pubblicato dist/nebula.js.
  var NEBULA_JS_URL = 'https://cdn.jsdelivr.net/gh/OWNER/biaflix-nebula@v__NEBULA_VERSION__/dist/nebula.js';

  var s = document.createElement('script');
  s.id = 'biaflix-nebula-js';
  s.src = NEBULA_JS_URL;
  s.defer = true;
  s.onerror = function () {
    console.warn('[Biaflix Nebula] nebula.js non raggiungibile: Jellyfin continua con la UI standard.');
  };
  document.head.appendChild(s);
})();
