const fs = require('fs');

// Patch index.html
let html = fs.readFileSync('public/index.html', 'utf8');
const searchHTML = '<div class="subsection-title">Estadias</div>';
const replaceHTML = `
  <div style="display: flex; justify-content: space-between; align-items: center;">
    <div class="subsection-title" style="margin: 0;">Estadias</div>
    <button id="btnSyncHoteisNotion" class="btn-secondary" style="font-size: 11px; padding: 4px 8px;">↻ Enviar p/ Notion</button>
  </div>
`;
if (html.includes(searchHTML)) {
  html = html.replace(searchHTML, replaceHTML);
  fs.writeFileSync('public/index.html', html);
  console.log('index.html patched with button');
}

// Patch app.js
let app = fs.readFileSync('public/js/app.js', 'utf8');

if (!app.includes('notionClienteId')) {
  // Update emptyOrc
  app = app.replace(
    "return { id: null, nome: '', cliente: { nome: '', pessoas: '', dataOrcamento: '' }",
    "return { id: null, notionClienteId: null, nome: '', cliente: { nome: '', pessoas: '', dataOrcamento: '' }"
  );

  // Update setupNotion selection
  const searchSetupNotion = `const c = notionClients.find(x => x.id === id);
    if (!c) return;
    document.getElementById('orcNome').value = c.nome;`;
    
  const replaceSetupNotion = `const c = notionClients.find(x => x.id === id);
    if (!c) return;
    state.orcamento.notionClienteId = c.id; // Vincula ID do Notion
    document.getElementById('orcNome').value = c.nome;`;
    
  app = app.replace(searchSetupNotion, replaceSetupNotion);

  // Add event listener in setupOrcamento (or at the end)
  const syncHoteisCode = `
window.syncHoteisNotion = async function() {
  if (!state.orcamento.notionClienteId) {
    alert('Esta cotação não está vinculada a um cliente do Notion. Selecione o cliente em "Importar do Notion" acima.');
    return;
  }
  
  if (state.orcamento.estadias.length === 0) {
    alert('Nenhuma estadia adicionada na cotação.');
    return;
  }

  const btn = document.getElementById('btnSyncHoteisNotion');
  const oldText = btn.innerText;
  btn.innerText = 'Enviando...';
  btn.disabled = true;

  try {
    const hoteisStr = state.orcamento.estadias.map(e => {
      let txt = e.cidade;
      if (e.hotel) txt += \` - \${e.hotel}\`;
      return txt;
    }).join('\\n');

    const res = await fetch(\`/api/notion/clientes/\${state.orcamento.notionClienteId}\`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotel: hoteisStr })
    });

    if (!res.ok) throw new Error('Falha na API Notion');
    alert('Hotéis atualizados com sucesso no Notion!');
  } catch (err) {
    console.error(err);
    alert('Erro ao sincronizar: ' + err.message);
  } finally {
    btn.innerText = oldText;
    btn.disabled = false;
  }
};

document.getElementById('btnSyncHoteisNotion')?.addEventListener('click', window.syncHoteisNotion);
`;
  app += syncHoteisCode;
  fs.writeFileSync('public/js/app.js', app);
  console.log('app.js patched with sync logic');
}
