const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

const regex = /<div class="field" style="margin-top: 16px;">[\\s\\S]*?<!-- Checkboxes virão aqui -->[\\s\\S]*?<\/div>\s*<\/div>/;

const newHtml = `<div class="field" style="margin-top: 16px;">
      <label>Atrações Selecionadas na Rota (Arraste para reordenar, clique no 'x' para remover)</label>
      <div id="modalRotSelected" class="modal-rot-selected" style="min-height: 48px; padding: 12px; border: 1px dashed var(--gold); border-radius: 6px; background: rgba(201,160,90,0.05); display: flex; flex-wrap: wrap; gap: 8px;">
      </div>
    </div>

    <div class="field" style="margin-top: 16px;">
      <label>Atrações Disponíveis (Clique para adicionar)</label>
      <div id="modalRotAvailable" style="max-height: 200px; overflow-y: auto; padding: 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-alt); display: flex; flex-wrap: wrap; gap: 8px;">
      </div>
    </div>`;

code = code.replace(regex, newHtml);

fs.writeFileSync('public/js/app.js', code);
console.log('Replaced HTML correctly');
