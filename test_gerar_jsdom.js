const fs = require('fs');
let js = fs.readFileSync('public/js/roteiros.js', 'utf8');

const { JSDOM } = require('jsdom');
const dom = new JSDOM(`<div id="previewContainer"></div>
<div id="roteiroTimeline"><div>Test</div></div>
<select id="selectRoteiroBase"><option value="Test" selected>Test</option></select>
<div id="roteiroEditContainer" style="display:none"></div>
<button id="btnGerarRoteiro"></button>
<div id="previewOverlay" class="hidden"></div>
`);
global.document = dom.window.document;
global.window = dom.window;

global.dbRotas = {
  'Test': {
    cliente: {
      adultos: 2,
      criancas: 0,
      dataOrcamento: '2026-06-01',
      dataFim: '2026-06-10',
      estadias: [{ cidade: 'Tokyo', dataInicio: '2026-06-01', dataFim: '2026-06-05', hotel: 'Test' }]
    }
  }
};
global.roteiroEmEdicao = undefined;

window.formatPeriodo = function(d1, d2) { return d1 + ' a ' + d2; };

eval(js.match(/document\.getElementById\('btnGerarRoteiro'\)\.addEventListener\([\s\S]*?\}\);/)[0]);

try {
  document.getElementById('btnGerarRoteiro').click();
  console.log('Overlay classList:', document.getElementById('previewOverlay').classList.toString());
  console.log('Preview content:', document.getElementById('previewContainer').innerHTML.substring(0, 500));
} catch(e) {
  console.error('ERROR ON CLICK:', e);
}
