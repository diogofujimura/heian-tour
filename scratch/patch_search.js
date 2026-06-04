const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

// Replacement 1: Add input field
const target1 = `      <div class="field" style="margin-top: 16px;">
        <label>Atrações Disponíveis (Clique para adicionar)</label>
        <div id="modalRotAvailable" style="max-height: 200px;`;
const target1_fallback = target1.replace('Atrações Disponíveis', 'Atraes Disponveis'); // Handle encoding variations if any
const replacement1 = `      <div class="field" style="margin-top: 16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
          <label style="margin:0">Atrações Disponíveis (Clique para adicionar)</label>
          <input type="text" id="modalRotSearch" placeholder="🔍 Buscar..." oninput="window.renderModalRotasUI()" style="width:250px; padding:4px 8px; font-size:13px; border:1px solid #ccc; border-radius:4px;">
        </div>
        <div id="modalRotAvailable" style="max-height: 200px;`;

if (code.includes(target1)) code = code.replace(target1, replacement1);
else if (code.includes(target1_fallback)) code = code.replace(target1_fallback, replacement1);
else {
  // Regex fallback
  code = code.replace(/<label>Atra.*es Dispon.*veis \(Clique para adicionar\)<\/label>\s*<div id="modalRotAvailable" style="max-height: 200px;/g, replacement1);
}

// Replacement 2: Filter logic
const target2 = `    availContainer.innerHTML = '';
    const disponiveis = atracoesDaCidade.filter(a => !window._tempAtracoesSelecionadas.includes(a));
    if (disponiveis.length === 0) {`;
const replacement2 = `    availContainer.innerHTML = '';
    const busca = (document.getElementById('modalRotSearch')?.value || '').trim().toLowerCase();
    const disponiveis = atracoesDaCidade.filter(a => !window._tempAtracoesSelecionadas.includes(a) && a.toLowerCase().includes(busca));
    if (disponiveis.length === 0) {`;

code = code.replace(target2, replacement2);

fs.writeFileSync('public/js/app.js', code, 'utf8');
console.log('Patch applied successfully.');
