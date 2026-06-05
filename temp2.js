const fs = require('fs');
let txt = fs.readFileSync('public/js/sync_roteiro_cotacao.js', 'utf8');
txt = txt.replace('desconto: 0, descontoAtivo: false, observacao: \'\'', 'desconto: 5, descontoAtivo: false, observacao: \'\'');
fs.writeFileSync('public/js/sync_roteiro_cotacao.js', txt);
