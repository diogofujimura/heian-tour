const fs = require('fs');

let code = fs.readFileSync('public/js/app.js', 'utf8');

// Replace the old abrirModalRota logic with the new one
const oldLogicStart = code.indexOf('function abrirModalRota(r = null) {');
const oldLogicEnd = code.indexOf('window.editarRota = function(id) {');

if (oldLogicStart !== -1 && oldLogicEnd !== -1) {
  const newLogic = `
function abrirModalRota(r = null) {
  const isEdit = !!r;
  const id = r ? r.id : '';
  const cidade = r ? (r.cidade || '') : '';
  const nomeDaRota = r ? (r.nomeDaRota || '') : '';
  const atracoes = r ? (r.atracoesDoDia || []) : [];

  // Obter cidades únicas
  const cidadesSet = new Set();
  if (state.atracoesDB) {
    state.atracoesDB.forEach(a => {
      if (a.Cidade) cidadesSet.add(a.Cidade.trim());
    });
  }
  if (cidade) cidadesSet.add(cidade); // Garante que a cidade atual apareça mesmo se não tiver atração
  const cidadesOpts = Array.from(cidadesSet).sort();

  const optionsHTML = '<option value="">-- Selecione uma Cidade --</option>' + 
    cidadesOpts.map(c => \`<option value="\${c}" \${c === cidade ? 'selected' : ''}>\${c}</option>\`).join('');

  const html = \`
    <h2 style="margin-bottom:16px">\${isEdit ? 'Editar Rota' : 'Nova Rota'}</h2>
    <div class="form-grid">
      <div class="field">
        <label>Cidade</label>
        <select id="modalRotCidade" onchange="window.updateAtracoesCheckboxes()">
          \${optionsHTML}
        </select>
      </div>
      <div class="field"><label>Nome da Rota (Sequência)</label><input type="text" id="modalRotNome" value="\${nomeDaRota}" placeholder="Ex: Tokyo Clássico"></div>
    </div>
    
    <div class="field" style="margin-top: 16px;">
      <label>Selecione as Atrações (aparecerão de acordo com a cidade escolhida)</label>
      <div id="modalRotCheckboxes" style="display:grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; max-height: 200px; overflow-y: auto; padding: 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-alt);">
        <!-- Checkboxes virão aqui -->
      </div>
    </div>
    
    <div style="display:flex;justify-content:flex-end;margin-top:24px">
      <button class="btn-primary" onclick="salvarRotaModal(\${id ? id : 'null'})">Salvar no Sheets</button>
    </div>
  \`;
  document.getElementById('modalContent').innerHTML = html;
  
  // Expor a função globalmente para o onchange do select
  window._tempAtracoesSelecionadas = atracoes; // guardar para marcar
  window.updateAtracoesCheckboxes();

  openModal();
}

window.updateAtracoesCheckboxes = function() {
  const cidadeSelect = document.getElementById('modalRotCidade');
  const container = document.getElementById('modalRotCheckboxes');
  if (!cidadeSelect || !container) return;

  const cidade = cidadeSelect.value;
  if (!cidade) {
    container.innerHTML = '<span style="color:var(--ink-lt); font-size:12px; grid-column: span 2;">Selecione uma cidade primeiro.</span>';
    return;
  }

  // Filtrar atrações da cidade selecionada
  const atracoesDaCidade = state.atracoesDB.filter(a => (a.Cidade || '').trim() === cidade);
  
  if (atracoesDaCidade.length === 0) {
    container.innerHTML = '<span style="color:var(--ink-lt); font-size:12px; grid-column: span 2;">Nenhuma atração cadastrada para esta cidade.</span>';
    return;
  }

  // Marcar as que já estavam selecionadas
  const sel = window._tempAtracoesSelecionadas || [];
  
  let cbHtml = '';
  atracoesDaCidade.forEach(a => {
    const nome = a['Nome da Atração'];
    if (!nome) return;
    const checked = sel.includes(nome) ? 'checked' : '';
    cbHtml += \`
      <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;">
        <input type="checkbox" value="\${nome}" class="chk-atracao" \${checked}>
        \${nome}
      </label>
    \`;
  });

  // Também adiciona as selecionadas que por acaso não estão na cidade ou não estão no DB (para não perder dados)
  sel.forEach(s => {
    if (!atracoesDaCidade.find(a => a['Nome da Atração'] === s)) {
      cbHtml += \`
        <label style="display:flex; align-items:center; gap:6px; font-size:13px; cursor:pointer;">
          <input type="checkbox" value="\${s}" class="chk-atracao" checked>
          \${s} <span style="opacity:0.5">(Extra/Outra)</span>
        </label>
      \`;
    }
  });

  container.innerHTML = cbHtml;
};

if(document.getElementById('btnNovaRota')) {
  document.getElementById('btnNovaRota').addEventListener('click', () => abrirModalRota());
}

async function salvarRotaModal(id) {
  const cidade = document.getElementById('modalRotCidade').value.trim();
  const nomeDaRota = document.getElementById('modalRotNome').value.trim();
  
  // Pegar todas as atrações marcadas
  const checkboxes = document.querySelectorAll('.chk-atracao:checked');
  const atracoesDoDia = Array.from(checkboxes).map(cb => cb.value);

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
    
    closeModal();
    loadDB();
    showToast('Rota salva no App e enviada ao Sheets!');
  } catch (err) {
    alert('Erro ao salvar: ' + err.message);
  }
}

`;
  
  code = code.substring(0, oldLogicStart) + newLogic + code.substring(oldLogicEnd);
  fs.writeFileSync('public/js/app.js', code);
  console.log('patched app.js modal rotas');
} else {
  console.log('Could not find old logic to replace');
}
