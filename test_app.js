const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="modalOverlay"><div id="modalContent"></div></div><div id="btnNovaRota"></div></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.navigator = dom.window.navigator;
const state = { atracoesDB: [], rotasDB: [] };
global.state = state;

try {
  const txt = require('fs').readFileSync('public/js/app.js', 'utf8');
  eval(txt);
  
  global.openModal = function() { console.log('openModal called'); };
  
  abrirModalRota();
  console.log('Success opening modal');
} catch(e) {
  console.error('Error in app.js:', e);
}
