const fs = require('fs');
let txt = fs.readFileSync('public/js/app.js', 'utf8');

const target = `  if (!state.orcamento.valoresTour) state.orcamento.valoresTour = { '4h': 45000, '6h': 65000, '8h': 85000, '10h': 105000, '12h': 125000 };
  document.getElementById('baseTour4h').value = state.orcamento.valoresTour['4h'] || '';
  document.getElementById('baseTour6h').value = state.orcamento.valoresTour['6h'] || '';
  document.getElementById('baseTour8h').value = state.orcamento.valoresTour['8h'] || '';
  document.getElementById('baseTour10h').value = state.orcamento.valoresTour['10h'] || '';
  document.getElementById('baseTour12h').value = state.orcamento.valoresTour['12h'] || '';`;

const replacement = `  if (!state.orcamento.valoresTour) state.orcamento.valoresTour = {};
  const defs = { '4h': 45000, '6h': 65000, '8h': 85000, '10h': 105000, '12h': 125000 };
  ['4h','6h','8h','10h','12h'].forEach(k => {
    if (!state.orcamento.valoresTour[k] || state.orcamento.valoresTour[k] === 0) {
      state.orcamento.valoresTour[k] = defs[k];
    }
  });

  document.getElementById('baseTour4h').value = state.orcamento.valoresTour['4h'];
  document.getElementById('baseTour6h').value = state.orcamento.valoresTour['6h'];
  document.getElementById('baseTour8h').value = state.orcamento.valoresTour['8h'];
  document.getElementById('baseTour10h').value = state.orcamento.valoresTour['10h'];
  document.getElementById('baseTour12h').value = state.orcamento.valoresTour['12h'];`;

txt = txt.replace(target, replacement);

const targetNovo = `  if (!state.orcamento.valoresTour) state.orcamento.valoresTour = { '4h': 45000, '6h': 65000, '8h': 85000, '10h': 105000, '12h': 125000 };
  document.getElementById('baseTour4h').value = state.orcamento.valoresTour['4h'];
  document.getElementById('baseTour6h').value = state.orcamento.valoresTour['6h'];
  document.getElementById('baseTour8h').value = state.orcamento.valoresTour['8h'];
  document.getElementById('baseTour10h').value = state.orcamento.valoresTour['10h'];
  document.getElementById('baseTour12h').value = state.orcamento.valoresTour['12h'];`;

txt = txt.replace(targetNovo, replacement); // Both abrirOrcamento and novoOrcamento will run this safely

fs.writeFileSync('public/js/app.js', txt);
