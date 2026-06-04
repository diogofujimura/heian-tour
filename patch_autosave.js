const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

// Add autoSaveRoteiro function
const autoSaveCode = `
let _autoSaveRoteiroTimer = null;
window.autoSaveRoteiro = function() {
  if (!roteiroEmEdicao || !roteiroEmEdicao.dias || roteiroEmEdicao.dias.length === 0) return;
  clearTimeout(_autoSaveRoteiroTimer);
  
  const indicator = document.getElementById('roteiroAutoSaveIndicator');
  if (indicator) {
    indicator.textContent = 'Salvando...';
    indicator.style.opacity = '1';
  }

  _autoSaveRoteiroTimer = setTimeout(async () => {
    const nomeAtual = document.getElementById('editRoteiroNome')?.value.trim();
    const nameToSave = window.roteiroOriginalNome || nomeAtual;
    if (!nameToSave) return;
    
    try {
      const res = await fetch(\`/api/roteiros/\${encodeURIComponent(nameToSave)}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roteiroEmEdicao)
      });
      if (res.ok) {
        dbRotas[nameToSave] = roteiroEmEdicao;
        if (indicator) { 
           indicator.textContent = 'Salvo automaticamente'; 
           setTimeout(() => { if(indicator && indicator.textContent==='Salvo automaticamente') indicator.style.opacity = '0.4'; }, 2000);
        }
      } else {
        if (indicator) indicator.textContent = 'Erro ao salvar';
      }
    } catch(err) {
      console.error('AutoSave Roteiro Error:', err);
      if (indicator) indicator.textContent = 'Erro de conexão';
    }
  }, 1500);
};
`;

// Insert autoSaveRoteiro at the top or bottom of roteiros.js
if (!code.includes('window.autoSaveRoteiro = function()')) {
  code = autoSaveCode + code;
}

// Ensure autoSaveRoteiro is called inside renderEditDias
if (code.includes('window.renderEditDias = function() {')) {
  if (!code.includes("if (typeof autoSaveRoteiro === 'function') autoSaveRoteiro();")) {
    code = code.replace(
      /window\.renderEditDias = function\(\) \{/,
      "window.renderEditDias = function() {\\n    if (typeof autoSaveRoteiro === 'function') autoSaveRoteiro();"
    );
  }
}

fs.writeFileSync('public/js/roteiros.js', code);
console.log('Added autoSaveRoteiro to roteiros.js');
