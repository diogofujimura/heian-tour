const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const badCode1 = `              const selRoteiro = document.getElementById('selectRoteiroExibir');
              if (selRoteiro) selRoteiro.value = nomeRoteiro;
              if (typeof carregarRoteiroSelecionado === 'function') carregarRoteiroSelecionado();`;

const goodCode1 = `              const selRoteiro = document.getElementById('selectRoteiroBase');
              if (selRoteiro) {
                 selRoteiro.value = nomeRoteiro;
                 if (typeof renderizarRoteiro === 'function') renderizarRoteiro(nomeRoteiro);
                 document.getElementById('btnEditarRoteiro').style.display = 'inline-block';
                 document.getElementById('btnExcluirRoteiro').style.display = 'inline-block';
              }`;

app = app.replaceAll(badCode1, goodCode1);

fs.writeFileSync('public/js/app.js', app);
