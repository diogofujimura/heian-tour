const fs = require('fs');

let app = fs.readFileSync('public/js/app.js', 'utf8');

if (!app.includes('function setupNotion')) {
  const notionCode = `
// ── NOTION SETUP ────────────────────────────────────────────────────────────
let notionClients = [];

function setupNotion() {
  const btn = document.getElementById('btnImportNotion');
  const selectWrapper = document.getElementById('notionSelectWrapper');
  const select = document.getElementById('notionClienteSelect');

  if (!btn || !select) return;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    if (selectWrapper.style.display === 'none') {
      selectWrapper.style.display = 'block';
      if (notionClients.length === 0) {
        select.innerHTML = '<option>Carregando clientes...</option>';
        try {
          const res = await fetch('/api/notion/clientes');
          if (!res.ok) throw new Error('Erro na API');
          notionClients = await res.json();
          let html = '<option value="">Selecione um cliente...</option>';
          notionClients.forEach(c => {
            html += \`<option value="\${c.id}">\${c.nome} (\${c.status || 'Sem status'})</option>\`;
          });
          select.innerHTML = html;
        } catch (e) {
          console.error(e);
          select.innerHTML = '<option>Erro ao carregar do Notion</option>';
        }
      }
    } else {
      selectWrapper.style.display = 'none';
    }
  });

  select.addEventListener('change', (e) => {
    const id = e.target.value;
    if (!id) return;
    const c = notionClients.find(x => x.id === id);
    if (c) {
      document.getElementById('orcNome').value = \`Orçamento - \${c.nome}\`;
      document.getElementById('clienteNome').value = c.nome;
      document.getElementById('clienteAdultos').value = c.adultos || 2;
      document.getElementById('clienteCriancas').value = c.criancas || 0;
      
      try { updateStateFromUI(); } catch(e) { console.error('updateStateFromUI failed:', e) }
      selectWrapper.style.display = 'none';
      select.value = '';
      alert('Dados do cliente ' + c.nome + ' importados do Notion com sucesso!');
    }
  });
}
`;

  app += notionCode;
  fs.writeFileSync('public/js/app.js', app);
  console.log('Fixed app.js: added setupNotion implementation');
} else {
  console.log('Already had setupNotion implementation');
}
