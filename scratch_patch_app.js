const fs = require('fs');

let code = fs.readFileSync('public/js/app.js', 'utf8');

// 1. Add rotasDB to state
code = code.replace(
  'atracoesDB: [],',
  'atracoesDB: [],\n  rotasDB: [],'
);

// 2. Add fetching rotasDB in loadDB
code = code.replace(
  'const [tRes, eRes, aRes] = await Promise.all([',
  'const [tRes, eRes, aRes, rRes] = await Promise.all(['
);
code = code.replace(
  "fetch('/api/atracoes')",
  "fetch('/api/atracoes'),\n    fetch('/api/rotas-base')"
);
code = code.replace(
  'state.atracoesDB = await aRes.json();',
  'state.atracoesDB = await aRes.json();\n  state.rotasDB = await rRes.json();'
);
code = code.replace(
  'renderTabelaAtracoes();',
  'renderTabelaAtracoes();\n  renderTabelaRotas();'
);

// 3. Remove delete buttons
code = code.replace(/<button class="btn-danger" onclick="excluirTransporte\(\$\{t\.id\}\)">✕<\/button>/g, '');
code = code.replace(/<button class="btn-danger" onclick="excluirExperiencia\(\$\{e\.id\}\)">✕<\/button>/g, '');
code = code.replace(/<button class="btn-danger" onclick="excluirAtracao\(\$\{a\.id\}\)">✕<\/button>/g, '');

// 4. Update config saving to include abaRotas
code = code.replace(
  "document.getElementById('abaAtracoes').value = state.config.sheets_aba_atracoes || '';",
  "document.getElementById('abaAtracoes').value = state.config.sheets_aba_atracoes || '';\n  if (document.getElementById('abaRotas')) document.getElementById('abaRotas').value = state.config.sheets_aba_rotas || '';"
);

code = code.replace(
  "sheets_aba_atracoes: document.getElementById('abaAtracoes').value.trim()",
  "sheets_aba_atracoes: document.getElementById('abaAtracoes').value.trim(),\n    sheets_aba_rotas: (document.getElementById('abaRotas') ? document.getElementById('abaRotas').value.trim() : '')"
);

// 5. Add search event listener for rotas
code = code.replace(
  "document.getElementById('searchAtracao').addEventListener('input', e => renderTabelaAtracoes(e.target.value));",
  "document.getElementById('searchAtracao').addEventListener('input', e => renderTabelaAtracoes(e.target.value));\n  if(document.getElementById('searchRota')) document.getElementById('searchRota').addEventListener('input', e => renderTabelaRotas(e.target.value));"
);

// 6. Add Rotas modal and logic
const rotasLogic = `
// ── ROTAS (ABA ADMIN) ────────────────────────────────────────────────────────
function renderTabelaRotas(filtro='') {
  const tbody = document.querySelector('#tabelaRotas tbody');
  if(!tbody) return;
  const lista = filtro ? state.rotasDB.filter(r => [r.cidade, r.nomeDaRota].join(' ').toLowerCase().includes(filtro.toLowerCase())) : state.rotasDB;
  tbody.innerHTML = lista.map(r => \`<tr>
    <td>\${r.cidade || ''}</td>
    <td>\${r.nomeDaRota || ''}</td>
    <td>\${(r.atracoesDoDia || []).join(', ')}</td>
    <td>
      <button class="btn-icon" onclick="editarRota(\${r.id})">✎</button>
    </td>
  </tr>\`).join('');
}

function abrirModalRota(r = null) {
  const isEdit = !!r;
  const id = r ? r.id : '';
  const cidade = r ? (r.cidade || '') : '';
  const nomeDaRota = r ? (r.nomeDaRota || '') : '';
  const atracoes = r ? (r.atracoesDoDia || []).join(', ') : '';

  const html = \`
    <h2 style="margin-bottom:16px">\${isEdit ? 'Editar Rota' : 'Nova Rota'}</h2>
    <div class="form-grid">
      <div class="field"><label>Cidade</label><input type="text" id="modalRotCidade" value="\${cidade}"></div>
      <div class="field"><label>Nome da Rota (Sequência)</label><input type="text" id="modalRotNome" value="\${nomeDaRota}"></div>
      <div class="field" style="grid-column: span 2"><label>Atrações do Dia (separadas por vírgula)</label><textarea id="modalRotAtracoes" rows="3">\${atracoes}</textarea></div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:24px">
      <button class="btn-primary" onclick="salvarRotaModal(\${id ? id : 'null'})">Salvar no Sheets</button>
    </div>
  \`;
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.remove('hidden');
}

if(document.getElementById('btnNovaRota')) {
  document.getElementById('btnNovaRota').addEventListener('click', () => abrirModalRota());
}

async function salvarRotaModal(id) {
  const cidade = document.getElementById('modalRotCidade').value.trim();
  const nomeDaRota = document.getElementById('modalRotNome').value.trim();
  const atracoesStr = document.getElementById('modalRotAtracoes').value;
  const atracoesDoDia = atracoesStr.split(',').map(s => s.trim()).filter(Boolean);

  if (!cidade || !nomeDaRota) return alert('Cidade e Nome são obrigatórios!');
  
  const payload = { cidade, nomeDaRota, atracoesDoDia };
  
  try {
    const url = id ? \`/api/rotas-base/\${id}\` : '/api/rotas-base';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Erro ao salvar Rota');
    
    document.getElementById('modalOverlay').classList.add('hidden');
    loadDB();
    showToast('Rota salva no App e enviada ao Sheets!');
  } catch (err) {
    alert('Erro ao salvar: ' + err.message);
  }
}

window.editarRota = function(id) {
  const r = state.rotasDB.find(x => x.id == id);
  if (r) abrirModalRota(r);
};
`;

// Append rotas logic to end of file
code += '\n' + rotasLogic;

fs.writeFileSync('public/js/app.js', code);
console.log('app.js patched successfully.');
