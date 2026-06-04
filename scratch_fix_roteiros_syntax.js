const fs = require('fs');
let rot = fs.readFileSync('public/js/roteiros.js', 'utf8');

// The corrupted block at 460-480
const badBlock = `    if (typeof attachChipEvents === 'function') attachChipEvents();
} catch (err) {
  alert('ERRO PREVIEW ROTEIRO: ' + err.message + '\\n' + err.stack);
  console.error(err);
}
  });

  document.getElementById('btnPrevisualizarRoteiro')?.addEventListener('click', () => {
try {
    const previewCont = document.getElementById('previewContainer');`;

const goodBlock = `    if (typeof attachChipEvents === 'function') attachChipEvents();
  });

  document.getElementById('btnPrevisualizarRoteiro')?.addEventListener('click', () => {
    const previewCont = document.getElementById('previewContainer');`;

rot = rot.replace(badBlock, goodBlock);

// The end of the btnPrevisualizarRoteiro block:
const badEndBlock = `    if (typeof attachChipEvents === 'function') attachChipEvents();
} catch (err) {
  alert('ERRO PREVIEW ROTEIRO: ' + err.message + '\\n' + err.stack);
  console.error(err);
}
  });`;

const goodEndBlock = `    if (typeof attachChipEvents === 'function') attachChipEvents();
  });`;

rot = rot.replace(badEndBlock, goodEndBlock);

fs.writeFileSync('public/js/roteiros.js', rot);
console.log('Fixed roteiros.js syntax error');
