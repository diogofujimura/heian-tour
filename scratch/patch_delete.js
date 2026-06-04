const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

// Replacement 1: Add the delete button
const targetBtn = `      <td>
        <button class="btn-icon" onclick="editarRota(\${r.id})">`;
const replacementBtn = `      <td>
        <button class="btn-icon" onclick="editarRota(\${r.id})">✏️</button>
        <button class="btn-icon" onclick="deletarRota(\${r.id})">🗑️</button>
      </td>`;
// Find the exact line in code using regex to avoid unicode issues
code = code.replace(/<td>\s*<button class="btn-icon" onclick="editarRota\(\$\{r\.id\}\)">.*?<\/button>\s*<\/td>/g, replacementBtn);

// Replacement 2: Add deletarRota function
const targetFunc = `  window.editarRota = function(id) {
    const r = state.rotasDB.find(x => x.id == id);
    if (r) abrirModalRota(r);
  };`;
const replacementFunc = `  window.editarRota = function(id) {
    const r = state.rotasDB.find(x => x.id == id);
    if (r) abrirModalRota(r);
  };

  window.deletarRota = async function(id) {
    if(!confirm('Remover esta Rota Base do App? (Ela não será apagada da Planilha, pois o robô de Rotas não apaga coisas lá)')) return;
    try {
      const res = await fetch(\`/api/rotas-base/\${id}\`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao deletar Rota Base');
      state.rotasDB = state.rotasDB.filter(x => x.id != id);
      renderTabelaRotas();
      showToast('Rota deletada com sucesso!');
    } catch (err) {
      alert(err.message);
    }
  };`;
code = code.replace(targetFunc, replacementFunc);

fs.writeFileSync('public/js/app.js', code, 'utf8');
console.log('Delete button patch applied successfully.');
