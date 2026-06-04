const fs = require('fs');
let content = fs.readFileSync('public/js/app.js', 'utf-8');

// Patch abrirOrcamento to save state
const regexAbrir = /function abrirOrcamento\(id\) \{([\s\S]*?)const orc = state\.orcamentosDB\.find\(o => o\.id === id\);/;
const replaceAbrir = `function abrirOrcamento(id) {
  localStorage.setItem('heian_last_orcamento_id', id);
  const orc = state.orcamentosDB.find(o => o.id === id);`;
if (content.match(regexAbrir)) {
  content = content.replace(regexAbrir, replaceAbrir);
}

// Patch novoOrcamento to clear state
const regexNovo = /function novoOrcamento\(\) \{([\s\S]*?)state\.orcamento = emptyOrc\(\);/;
const replaceNovo = `function novoOrcamento() {
  localStorage.removeItem('heian_last_orcamento_id');
  state.orcamento = emptyOrc();`;
if (content.match(regexNovo)) {
  content = content.replace(regexNovo, replaceNovo);
}

// Patch setupNav to read state on reload
const regexSetupNav = /if \(hash === 'orcamento'\) novoOrcamento\(\);\s*else navToPage\(hash\);/;
const replaceSetupNav = `if (hash === 'orcamento') {
      const lastId = localStorage.getItem('heian_last_orcamento_id');
      if (lastId) {
        const idNum = parseInt(lastId, 10);
        // Ensure state.orcamentosDB is populated before trying to open it
        setTimeout(() => abrirOrcamento(idNum), 100); 
      } else {
        novoOrcamento();
      }
    } else navToPage(hash);`;
if (content.match(regexSetupNav)) {
  content = content.replace(regexSetupNav, replaceSetupNav);
}

fs.writeFileSync('public/js/app.js', content, 'utf-8');
console.log('Patched app.js for orcamentos state persistence');
