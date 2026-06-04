const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const old1 = `               setTimeout(() => {
                 if (typeof preencherSelectRoteiros === 'function') preencherSelectRoteiros(nomeRoteiro);
                 const selRoteiro = document.getElementById('selectRoteiroExibir');
                 if (selRoteiro) selRoteiro.value = nomeRoteiro;
                 if (typeof carregarRoteiroSelecionado === 'function') carregarRoteiroSelecionado();
               }, 300);`;

const new1 = `               setTimeout(() => {
                 if (typeof preencherSelectRoteiros === 'function') preencherSelectRoteiros(nomeRoteiro);
                 const selRoteiro = document.getElementById('selectRoteiroBase');
                 if (selRoteiro) {
                   selRoteiro.value = nomeRoteiro;
                   document.getElementById('btnEditarRoteiro').style.display = 'inline-block';
                   document.getElementById('btnExcluirRoteiro').style.display = 'inline-block';
                   document.getElementById('btnEditarRoteiro').click();
                 }
               }, 300);`;

const old2 = `            setTimeout(() => {
              if (typeof preencherSelectRoteiros === 'function') preencherSelectRoteiros(nomeRoteiro);
              const selRoteiro = document.getElementById('selectRoteiroBase');
              if (selRoteiro) {
                 selRoteiro.value = nomeRoteiro;
                 if (typeof renderizarRoteiro === 'function') renderizarRoteiro(nomeRoteiro);
                 document.getElementById('btnEditarRoteiro').style.display = 'inline-block';
                 document.getElementById('btnExcluirRoteiro').style.display = 'inline-block';
              }
            }, 300);`;

const new2 = `            setTimeout(() => {
              if (typeof preencherSelectRoteiros === 'function') preencherSelectRoteiros(nomeRoteiro);
              const selRoteiro = document.getElementById('selectRoteiroBase');
              if (selRoteiro) {
                 selRoteiro.value = nomeRoteiro;
                 document.getElementById('btnEditarRoteiro').style.display = 'inline-block';
                 document.getElementById('btnExcluirRoteiro').style.display = 'inline-block';
                 document.getElementById('btnEditarRoteiro').click();
              }
            }, 300);`;

app = app.replace(old1, new1);
app = app.replace(old2, new2);

fs.writeFileSync('public/js/app.js', app);
console.log('Fixed post-generation navigation to open Editor');
