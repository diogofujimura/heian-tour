const fs = require('fs');
let rot = fs.readFileSync('public/js/roteiros.js', 'utf8');

const oldEvt = `  document.getElementById('btnPrevisualizarRoteiro')?.addEventListener('click', () => {
    const previewCont = document.getElementById('previewContainer');`;
const newEvt = `  document.getElementById('btnPrevisualizarRoteiro')?.addEventListener('click', () => {
try {
    const previewCont = document.getElementById('previewContainer');`;

const oldEvtEnd = `    if (typeof attachChipEvents === 'function') attachChipEvents();
  });`;
const newEvtEnd = `    if (typeof attachChipEvents === 'function') attachChipEvents();
} catch (err) {
  alert('ERRO PREVIEW ROTEIRO: ' + err.message + '\\n' + err.stack);
  console.error(err);
}
  });`;

rot = rot.replace(oldEvt, newEvt);
rot = rot.replace(oldEvtEnd, newEvtEnd);
fs.writeFileSync('public/js/roteiros.js', rot);
console.log('Added try-catch to roteiro preview');
