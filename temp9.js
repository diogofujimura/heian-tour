const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

// Atualizar botão de cotação
const oldCotBtn = `<button id="btnEditarClienteCotacao" class="btn-secondary" style="font-size:12px; padding:4px 10px;" type="button" onclick="if(state.orcamento && state.orcamento.notionClienteId) { editarClienteNotion(state.orcamento.notionClienteId); } else { alert('Esta cotação não possui um cliente do Notion vinculado.'); }">👤 Editar Cliente</button>`;
const newCotBtn = `<button id="btnEditarClienteCotacao" class="btn-secondary" style="font-size:12px; padding:4px 10px;" type="button" onclick="handleAcaoClienteCotacao()">👤 Editar Cliente</button>`;

html = html.replace(oldCotBtn, newCotBtn);

// Atualizar botão de roteiro
const oldRotBtn = `<button id="btnEditarClienteRoteiro" class="btn-secondary" style="font-size:12px; padding:4px 10px;" type="button" onclick="if(typeof roteiroEmEdicao !== 'undefined' && roteiroEmEdicao && roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.notionClienteId) { editarClienteNotion(roteiroEmEdicao.cliente.notionClienteId); } else { alert('Este roteiro não possui um cliente do Notion vinculado.'); }">👤 Editar Cliente</button>`;
const newRotBtn = `<button id="btnEditarClienteRoteiro" class="btn-secondary" style="font-size:12px; padding:4px 10px;" type="button" onclick="handleAcaoClienteRoteiro()">👤 Editar Cliente</button>`;

html = html.replace(oldRotBtn, newRotBtn);

fs.writeFileSync('public/index.html', html);

// --- APP.JS (COTAÇÕES) ---
let appJs = fs.readFileSync('public/js/app.js', 'utf8');

// Inserir a checagem no abrirOrcamento
const checkCotTarget = `const lockedStyle = temCliente ? 'background:#f1f5f9; cursor:not-allowed' : '';`;
const checkCotInject = `const lockedStyle = temCliente ? 'background:#f1f5f9; cursor:not-allowed' : '';
  const btnEditarCot = document.getElementById('btnEditarClienteCotacao');
  if(btnEditarCot) btnEditarCot.innerHTML = temCliente ? '👤 Editar Cliente' : '💾 Salvar Cliente no Notion';`;
appJs = appJs.replace(checkCotTarget, checkCotInject);

// Inserir a logica handleAcaoClienteCotacao
const handlerCotLogic = `
window.handleAcaoClienteCotacao = async function() {
  if (state.orcamento && state.orcamento.notionClienteId) {
    editarClienteNotion(state.orcamento.notionClienteId);
  } else {
    // Modo "Salvar Cliente no Notion"
    const nome = document.getElementById('clienteNome').value.trim();
    if (!nome) return alert('Preencha pelo menos o Nome do Cliente para salvar no Notion.');
    
    const btn = document.getElementById('btnEditarClienteCotacao');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '⏳ Salvando...';
    btn.disabled = true;

    try {
      const payload = {
        nome: nome,
        adultos: document.getElementById('clienteAdultos').value,
        criancas: document.getElementById('clienteCriancas').value,
        dataInicio: document.getElementById('clienteDataOrcamento').value || '',
        dataFim: '',
        status: 'Lead',
        vooChegada: '',
        vooPartida: ''
      };

      const res = await fetch('/api/notion/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Falha ao salvar no Notion');
      
      const newClient = await res.json();
      state.orcamento.notionClienteId = newClient.id;
      
      // Salva localmente as estadias vazias se houver
      await fetch('/api/clientes/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newClient.id, estadias: state.orcamento.estadias || [] })
      });

      // Recarrega NotionClients
      window.notionClients = await fetch('/api/notion/clientes').then(r=>r.json());

      btn.innerHTML = '👤 Editar Cliente';
      btn.disabled = false;
      
      // Trava os campos e salva
      ['clienteNome', 'clienteAdultos', 'clienteCriancas'].forEach(id => {
        const el = document.getElementById(id);
        if(el) { el.readOnly = true; el.style = 'background:#f1f5f9; cursor:not-allowed'; }
      });
      
      document.getElementById('notionSelectWrapper').style.display = 'none';
      salvarOrcamentoAtual();
      
      alert('Cliente criado no Notion e vinculado com sucesso!');

    } catch (e) {
      console.error(e);
      alert('Erro ao salvar cliente no Notion.');
      btn.innerHTML = oldHtml;
      btn.disabled = false;
    }
  }
};
`;

appJs += '\n' + handlerCotLogic;
fs.writeFileSync('public/js/app.js', appJs);


// --- ROTEIROS.JS ---
let rotJs = fs.readFileSync('public/js/roteiros.js', 'utf8');

// Inserir a checagem no abrirRoteiro
const checkRotTarget = `const temCliente = roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.notionClienteId;
  const lockedStyle = temCliente ? 'background:#f1f5f9; cursor:not-allowed' : '';`;
const checkRotInject = `const temCliente = roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.notionClienteId;
  const lockedStyle = temCliente ? 'background:#f1f5f9; cursor:not-allowed' : '';
  const btnEditarRot = document.getElementById('btnEditarClienteRoteiro');
  if(btnEditarRot) btnEditarRot.innerHTML = temCliente ? '👤 Editar Cliente' : '💾 Salvar Cliente no Notion';`;
rotJs = rotJs.replace(checkRotTarget, checkRotInject);


// Inserir a logica handleAcaoClienteRoteiro
const handlerRotLogic = `
window.handleAcaoClienteRoteiro = async function() {
  if (typeof roteiroEmEdicao !== 'undefined' && roteiroEmEdicao && roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.notionClienteId) {
    editarClienteNotion(roteiroEmEdicao.cliente.notionClienteId);
  } else {
    // Modo "Salvar Cliente no Notion"
    const nome = document.getElementById('rotClienteNome').value.trim();
    if (!nome) return alert('Preencha pelo menos o Nome do Cliente para salvar no Notion.');
    
    const btn = document.getElementById('btnEditarClienteRoteiro');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '⏳ Salvando...';
    btn.disabled = true;

    try {
      if(!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {};
      
      const payload = {
        nome: nome,
        adultos: document.getElementById('rotClienteAdultos').value,
        criancas: document.getElementById('rotClienteCriancas').value,
        dataInicio: document.getElementById('rotClienteData') ? document.getElementById('rotClienteData').value : '',
        dataFim: document.getElementById('rotClienteDataFim') ? document.getElementById('rotClienteDataFim').value : '',
        status: 'Lead',
        vooChegada: document.getElementById('rotClienteVooChegada') ? document.getElementById('rotClienteVooChegada').value : '',
        vooPartida: document.getElementById('rotClienteVooPartida') ? document.getElementById('rotClienteVooPartida').value : ''
      };

      const res = await fetch('/api/notion/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Falha ao salvar no Notion');
      
      const newClient = await res.json();
      roteiroEmEdicao.cliente.notionClienteId = newClient.id;
      
      // Salva localmente as estadias
      const estadiasArr = roteiroEmEdicao.estadias ? roteiroEmEdicao.estadias : [];
      await fetch('/api/clientes/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newClient.id, estadias: estadiasArr })
      });

      // Recarrega NotionClients
      window.notionClients = await fetch('/api/notion/clientes').then(r=>r.json());

      btn.innerHTML = '👤 Editar Cliente';
      btn.disabled = false;
      
      // Trava os campos
      ['rotClienteNome', 'rotClienteAdultos', 'rotClienteCriancas'].forEach(id => {
        const el = document.getElementById(id);
        if(el) { el.readOnly = true; el.style = 'background:#f1f5f9; cursor:not-allowed'; }
      });
      
      document.getElementById('rotNotionSelectWrapper').style.display = 'none';
      if(typeof triggerRoteiroAutoSave === 'function') triggerRoteiroAutoSave();
      if(typeof updateRoteiroHeader === 'function') updateRoteiroHeader();
      
      alert('Cliente criado no Notion e vinculado com sucesso!');

    } catch (e) {
      console.error(e);
      alert('Erro ao salvar cliente no Notion.');
      btn.innerHTML = oldHtml;
      btn.disabled = false;
    }
  }
};
`;

rotJs += '\n' + handlerRotLogic;

// Tambem precisamos arrumar as funcoes de importar (vincular) pra trocar o botao pra "Editar" na hora.
// Em app.js: select.addEventListener('change' ...
// E em roteiros.js: vincularClienteRoteiroFromSelect

// app.js - vincular via select
appJs = appJs.replace(
  `alert('Dados do cliente ' + c.nome + ' importados do Notion com sucesso!');`,
  `const bEdit = document.getElementById('btnEditarClienteCotacao'); if(bEdit) bEdit.innerHTML = '👤 Editar Cliente';\n      alert('Dados do cliente ' + c.nome + ' importados do Notion com sucesso!');`
);
fs.writeFileSync('public/js/app.js', appJs);

// roteiros.js - vincular via select
rotJs = rotJs.replace(
  `alert('Dados do cliente ' + c.nome + ' importados do Notion com sucesso!');`,
  `const bEdit = document.getElementById('btnEditarClienteRoteiro'); if(bEdit) bEdit.innerHTML = '👤 Editar Cliente';\n    alert('Dados do cliente ' + c.nome + ' importados do Notion com sucesso!');`
);
fs.writeFileSync('public/js/roteiros.js', rotJs);

console.log("Feito!");
