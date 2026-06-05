const fs = require('fs');
let lines = fs.readFileSync('public/js/app.js', 'utf8').split('\n');
lines[614] = "  const val6h = (state.orcamento.valoresTour && state.orcamento.valoresTour['6h']) || 65000;\n  state.orcamento.tours.push({ id: Date.now(), data: '', descricao: '', pontos: '', duracao: '6h', valor: val6h, descontoAtivo: false, desconto: 5, observacao: '' });";
fs.writeFileSync('public/js/app.js', lines.join('\n'));
