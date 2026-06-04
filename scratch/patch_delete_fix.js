const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

// Fix the button emoji
code = code.replace(/<button class="btn-icon" onclick="deletarRota\(\$\{r\.id\}\)">.*?<\/button>/g, '<button class="btn-icon" onclick="deletarRota(${r.id})">❌</button>');

// Insert window.deletarRota
const regex = /window\.editarRota = function\(id\) \{[\s\S]*?\};/g;
const replacement = `window.editarRota = function(id) {
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

code = code.replace(regex, replacement);

fs.writeFileSync('public/js/app.js', code, 'utf8');
console.log('Delete button fixed and function added successfully.');
