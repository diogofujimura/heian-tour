const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

// The first patch failed to replace abrirModalRota correctly because it didn't match.
// I will just replace the specific parts.

code = code.replace(/onchange="window\.updateAtracoesCheckboxes\(\)"/g, 'onchange="window.renderModalRotasUI()"');
code = code.replace(/window\.updateAtracoesCheckboxes\(\);/g, 'window.renderModalRotasUI();');

// Oh wait, did it replace ANY part of abrirModalRota?
// Let's check if modalRotSelected exists in the file.
if (!code.includes('modalRotSelected')) {
  // It didn't replace the html variable.
  const oldHtmlStart = `<div class="field" style="margin-top: 16px;">
      <label>Selecione as Atrações (aparecerão de acordo com a cidade escolhida)</label>
      <div id="modalRotCheckboxes" style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; max-height: 200px; overflow-y: auto; padding: 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-alt);">
        <!-- Checkboxes virão aqui -->
      </div>
    </div>`;
    
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
    
  code = code.replace(oldHtmlStart, newHtml);
}

fs.writeFileSync('public/js/app.js', code);
console.log('Fixed modal logic');
