const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

// Replace abrirModalRota
code = code.replace(/function abrirModalRota\([\\s\\S]*?openModal\(\);\n\}/, `function abrirModalRota(r = null) {
  const isEdit = !!r;
  const id = r ? r.id : '';
  const cidade = r ? (r.cidade || '') : '';
  const nomeDaRota = r ? (r.nomeDaRota || '') : '';
  const atracoes = r ? (r.atracoesDoDia || []) : [];

  const cidadesSet = new Set();
  if (state.atracoesDB) {
    state.atracoesDB.forEach(a => {
      if (a.Cidade) cidadesSet.add(a.Cidade.trim());
    });
  }
  if (cidade) cidadesSet.add(cidade);
  const cidadesOpts = Array.from(cidadesSet).sort();

  const optionsHTML = '<option value="">-- Selecione uma Cidade --</option>' + 
    cidadesOpts.map(c => \`<option value="\${c}" \${c === cidade ? 'selected' : ''}>\${c}</option>\`).join('');

  const html = \`
    <h2 style="margin-bottom:16px">\${isEdit ? 'Editar Rota' : 'Nova Rota'}</h2>
    <div class="form-grid">
      <div class="field">
        <label>Cidade</label>
        <select id="modalRotCidade" onchange="window.renderModalRotasUI()">
          \${optionsHTML}
        </select>
      </div>
      <div class="field"><label>Nome da Rota (Sequência)</label><input type="text" id="modalRotNome" value="\${nomeDaRota}" placeholder="Ex: Tokyo Clássico"></div>
    </div>
    
    <div class="field" style="margin-top: 16px;">
      <label>Atrações Selecionadas na Rota (Arraste para reordenar, clique no 'x' para remover)</label>
      <div id="modalRotSelected" style="min-height: 48px; padding: 12px; border: 1px dashed var(--gold); border-radius: 6px; background: rgba(201,160,90,0.05); display: flex; flex-wrap: wrap; gap: 8px;">
      </div>
    </div>

    <div class="field" style="margin-top: 16px;">
      <label>Atrações Disponíveis (Clique para adicionar)</label>
      <div id="modalRotAvailable" style="max-height: 200px; overflow-y: auto; padding: 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-alt); display: flex; flex-wrap: wrap; gap: 8px;">
      </div>
    </div>
    
    <div style="display:flex;justify-content:flex-end;margin-top:24px">
      <button class="btn-primary" onclick="salvarRotaModal(\${id ? id : 'null'})">Salvar no Sheets</button>
    </div>
  \`;
  document.getElementById('modalContent').innerHTML = html;
  
  window._tempAtracoesSelecionadas = [...atracoes];
  window.renderModalRotasUI();
  openModal();
}`);

// Replace updateAtracoesCheckboxes
code = code.replace(/window\.updateAtracoesCheckboxes = function\(\) \{[\s\S]*?\};\n\nif\(document\.getElementById\('btnNovaRota'\)\)/, `window.renderModalRotasUI = function() {
  const cidadeSelect = document.getElementById('modalRotCidade');
  const selContainer = document.getElementById('modalRotSelected');
  const availContainer = document.getElementById('modalRotAvailable');
  if (!cidadeSelect || !selContainer || !availContainer) return;

  const cidade = cidadeSelect.value;
  if (!cidade) {
    selContainer.innerHTML = '';
    availContainer.innerHTML = '<span style="color:var(--ink-lt); font-size:12px;">Selecione uma cidade primeiro.</span>';
    return;
  }

  const atracoesDaCidade = state.atracoesDB.filter(a => (a.Cidade || '').trim() === cidade).map(a => a['Nome da Atração']).filter(Boolean);
  
  selContainer.innerHTML = '';
  if (window._tempAtracoesSelecionadas.length === 0) {
    selContainer.innerHTML = '<span style="color:var(--ink-lt); font-size:12px; margin:auto">Nenhuma atração selecionada.</span>';
  } else {
    window._tempAtracoesSelecionadas.forEach((nome, i) => {
      const chip = document.createElement('div');
      chip.className = 'chip-atracao';
      chip.style.display = 'inline-flex';
      chip.style.alignItems = 'center';
      chip.style.gap = '8px';
      chip.draggable = true;
      chip.innerHTML = \`<span>\${nome}</span><span onclick="window.removerAtracaoModal(\${i})" style="color:var(--crimson); cursor:pointer; font-weight:bold; padding-left:4px">&times;</span>\`;
      
      chip.addEventListener('dragstart', (e) => { window._dragModalIdx = i; e.dataTransfer.effectAllowed = 'move'; chip.style.opacity = '0.5'; });
      chip.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      chip.addEventListener('drop', (e) => {
        e.preventDefault();
        chip.style.opacity = '1';
        if (window._dragModalIdx === undefined || window._dragModalIdx === i) return;
        const arr = window._tempAtracoesSelecionadas;
        const item = arr.splice(window._dragModalIdx, 1)[0];
        arr.splice(i, 0, item);
        window._dragModalIdx = undefined;
        renderModalRotasUI();
      });
      chip.addEventListener('dragend', () => { chip.style.opacity = '1'; });
      selContainer.appendChild(chip);
    });
  }
  
  availContainer.innerHTML = '';
  const disponiveis = atracoesDaCidade.filter(a => !window._tempAtracoesSelecionadas.includes(a));
  if (disponiveis.length === 0) {
    availContainer.innerHTML = '<span style="color:var(--ink-lt); font-size:12px;">Todas as atrações da cidade já foram adicionadas.</span>';
  } else {
    disponiveis.forEach(nome => {
      const chip = document.createElement('div');
      chip.className = 'chip-atracao';
      chip.style.background = 'var(--cream)';
      chip.style.color = 'var(--ink-mid)';
      chip.style.border = '1px dashed var(--border-dk)';
      chip.textContent = '+ ' + nome;
      chip.onclick = () => {
        window._tempAtracoesSelecionadas.push(nome);
        renderModalRotasUI();
      };
      availContainer.appendChild(chip);
    });
  }
};

window.removerAtracaoModal = function(idx) {
  window._tempAtracoesSelecionadas.splice(idx, 1);
  renderModalRotasUI();
};

if(document.getElementById('btnNovaRota'))`);


// Replace salvarRotaModal body
code = code.replace(/const checkboxes = document\.querySelectorAll\('\.chk-atracao:checked'\);\n  const atracoesDoDia = Array\.from\(checkboxes\)\.map\(cb => cb\.value\);/, `const atracoesDoDia = window._tempAtracoesSelecionadas || [];`);

fs.writeFileSync('public/js/app.js', code);
console.log('Patched modal UI');
