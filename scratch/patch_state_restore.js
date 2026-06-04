const fs = require('fs');
let content = fs.readFileSync('public/js/roteiros.js', 'utf-8');

const regexSetup = /function setupEvents\(\) \{[\s\S]*?select\.addEventListener\('change', \(e\) => \{[\s\S]*?const roteiro = e\.target\.value;/;
const replaceSetup = `function setupEvents() {
  const select = document.getElementById('selectRoteiroBase');
  if (select) {
    select.addEventListener('change', (e) => {
      const roteiro = e.target.value;
      if (roteiro) {
        localStorage.setItem('heian_last_roteiro', roteiro);
      } else {
        localStorage.removeItem('heian_last_roteiro');
      }`;

content = content.replace(regexSetup, replaceSetup);

const regexCarregar = /preencherSelectRoteiros\(\);\s*criarDatalistCidades\(\);/;
const replaceCarregar = `preencherSelectRoteiros();
    criarDatalistCidades();
    
    if (window.location.hash.replace('#', '') === 'roteiros') {
      const lastRoteiro = localStorage.getItem('heian_last_roteiro');
      if (lastRoteiro && dbRotas && dbRotas[lastRoteiro]) {
        const select = document.getElementById('selectRoteiroBase');
        if (select) {
          select.value = lastRoteiro;
          select.dispatchEvent(new Event('change'));
        }
      }
    }`;

content = content.replace(regexCarregar, replaceCarregar);

fs.writeFileSync('public/js/roteiros.js', content, 'utf-8');
console.log('Patched setupEvents and carregarBases in roteiros.js');
