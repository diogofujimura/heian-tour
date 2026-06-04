const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="modalOverlay"><div id="modalBox"><button id="modalClose"></button><div id="modalContent"></div></div></div><button id="btnNovaRota"></button></body></html>');
global.document = dom.window.document;
global.window = dom.window;
global.navigator = dom.window.navigator;
const state = { atracoesDB: [], rotasDB: [] };
global.state = state;

try {
  const txt = require('fs').readFileSync('public/js/app.js', 'utf8');
  eval(txt);
  
  // mock close / open modal if undefined
  if (!global.openModal) {
    global.openModal = function() { console.log('Mock openModal'); }
  }
  
  document.getElementById('btnNovaRota').click();
  console.log('Successfully clicked btnNovaRota');
} catch(e) {
  console.error('Error in app.js:', e);
}
