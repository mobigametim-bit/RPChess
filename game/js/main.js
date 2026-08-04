(() => {
  'use strict';
  const profile=window.NC.Storage.load();
  const game=new window.NC.Game(profile);
  window.rpchess=game;
  window.rpchessUI=new window.NC_UI.UI(game,document.getElementById('app'));
  // Legacy aliases keep older exported saves and test helpers compatible.
  window.neurochess=game;
  window.neurochessUI=window.rpchessUI;
})();
