const fs = require('fs');

let app = fs.readFileSync('public/js/app.js', 'utf8');

// 1. Declare currentEditingEstadias at the top of the Clientes tab logic
if (!app.includes('let currentEditingEstadias = [];')) {
  app = app.replace(
    'let currentEditingClienteId = null;',
    'let currentEditingClienteId = null;\nlet currentEditingEstadias = [];'
  );
}

// 2. Remove the old addEventListener for btnAddEstadia inside setupNav / setupOrcamento
app = app.replace(
  "document.getElementById('btnAddEstadia')?.addEventListener('click', () => {",
  "// removed old btnAddEstadia listener"
);
app = app.replace(
  "state.orcamento.estadias.push({ id: Date.now(), cidade: '', dataInicio: '', dataFim: '', hotel: '' });\n    renderEstadiasForm();\n  });",
  "// ..."
);

// 3. Move the btnAddEstadia listener to setupClientesTab
if (!app.includes('btnAddEstadiaModal')) {
  app = app.replace(
    'if(btnSalvar) btnSalvar.addEventListener(\'click\', salvarClienteNotion);',
    `if(btnSalvar) btnSalvar.addEventListener('click', salvarClienteNotion);
  const btnAdd = document.getElementById('btnAddEstadia');
  if(btnAdd) btnAdd.addEventListener('click', () => {
    currentEditingEstadias.push({ id: Date.now(), cidade: '', dataInicio: '', dataFim: '', hotel: '' });
    renderEstadiasForm();
  });`
  );
}

// 4. Update rmEstadia and updEstadia to use currentEditingEstadias
app = app.replace(
  'function rmEstadia(id) { state.orcamento.estadias = state.orcamento.estadias.filter(e => e.id !== id); renderEstadiasForm(); }',
  'function rmEstadia(id) { currentEditingEstadias = currentEditingEstadias.filter(e => e.id !== id); renderEstadiasForm(); }'
);
app = app.replace(
  'function updEstadia(id, f, v) { const e = state.orcamento.estadias.find(x => x.id === id); if (e) e[f] = v; }',
  'function updEstadia(id, f, v) { const e = currentEditingEstadias.find(x => x.id === id); if (e) e[f] = v; }'
);

// 5. Update renderEstadiasForm to use currentEditingEstadias
app = app.replace(
  'state.orcamento.estadias.forEach((est, i) => {',
  'currentEditingEstadias.forEach((est, i) => {'
);

// 6. Add renderEstadiasReadOnlyForm and inject it where needed
const readOnlyFn = `
function renderEstadiasReadOnlyForm() {
  const cont = document.getElementById('estadiasReadOnlyList');
  if (!cont) return;
  if (!state.orcamento.estadias || state.orcamento.estadias.length === 0) {
    cont.innerHTML = '<p class="hint" style="margin:0;">Nenhuma estadia. Edite o cliente na aba "Clientes (Notion)" para adicionar estadias.</p>';
    return;
  }
  let html = '';
  state.orcamento.estadias.forEach((est, i) => {
    const dates = (est.dataInicio || est.dataFim) ? \`\${fmtDataBR(est.dataInicio)} – \${fmtDataBR(est.dataFim)}\` : '';
    html += \`<div style="margin-bottom: 8px;"><strong>Estadia \${i+1}:</strong> \${est.cidade} \${est.hotel ? '- '+est.hotel : ''} \${dates ? '('+dates+')' : ''}</div>\`;
  });
  cont.innerHTML = html;
}
`;
if (!app.includes('renderEstadiasReadOnlyForm()')) {
  app = app.replace('function renderEstadiasForm() {', readOnlyFn + '\nfunction renderEstadiasForm() {');
}

// Update setupOrcamento to render read-only list instead of form
app = app.replace(
  'renderEstadiasForm(); renderToursForm(); renderTransportesForm(); renderExperienciasForm(); renderItensAdicionaisForm();',
  'renderEstadiasReadOnlyForm(); renderToursForm(); renderTransportesForm(); renderExperienciasForm(); renderItensAdicionaisForm();'
);
app = app.replace(
  'renderEstadiasForm(); renderToursForm(); renderTransportesForm(); renderExperienciasForm(); renderItensAdicionaisForm();', // if there's a second one
  'renderEstadiasReadOnlyForm(); renderToursForm(); renderTransportesForm(); renderExperienciasForm(); renderItensAdicionaisForm();'
);

// 7. Update abrirClienteModal to fetch local data
const searchAbrir = `document.getElementById('mcDataFim').value = cliente.dataFim || '';`;
const replaceAbrir = `document.getElementById('mcDataFim').value = cliente.dataFim || '';
    fetch(\`/api/clientes/local/\${cliente.id}\`).then(r=>r.json()).then(d => {
      currentEditingEstadias = d.estadias || [];
      renderEstadiasForm();
    }).catch(e => { console.error(e); currentEditingEstadias = []; renderEstadiasForm(); });`;

const searchAbrirNew = `document.getElementById('mcDataFim').value = '';`;
const replaceAbrirNew = `document.getElementById('mcDataFim').value = '';
    currentEditingEstadias = [];
    renderEstadiasForm();`;

if (!app.includes('fetch(`/api/clientes/local/${cliente.id}`)')) {
  app = app.replace(searchAbrir, replaceAbrir);
  app = app.replace(searchAbrirNew, replaceAbrirNew);
}

// 8. Update salvarClienteNotion to POST local estadias
const searchSalvar = `const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });`;

const replaceSalvar = `const hoteisStr = currentEditingEstadias.map(e => {
      let txt = e.cidade;
      if (e.hotel) txt += \` - \${e.hotel}\`;
      return txt;
    }).join('\\n');
    if (hoteisStr) payload.hotel = hoteisStr;

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const cliId = currentEditingClienteId || (await res.clone().json()).id;
    await fetch('/api/clientes/local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cliId, estadias: currentEditingEstadias })
    });`;

if (!app.includes('await fetch(\'/api/clientes/local\'')) {
  app = app.replace(searchSalvar, replaceSalvar);
}

// 9. Update setupNotion to fetch estadias into state.orcamento.estadias
const searchSetupNotionChange = `state.orcamento.notionClienteId = c.id; // Vincula ID do Notion
    document.getElementById('orcNome').value = c.nome;`;

const replaceSetupNotionChange = `state.orcamento.notionClienteId = c.id; // Vincula ID do Notion
    document.getElementById('orcNome').value = c.nome;
    fetch(\`/api/clientes/local/\${c.id}\`).then(r=>r.json()).then(d => {
      state.orcamento.estadias = d.estadias || [];
      renderEstadiasReadOnlyForm();
    }).catch(console.error);`;

if (!app.includes('fetch(`/api/clientes/local/${c.id}`)')) {
  app = app.replace(searchSetupNotionChange, replaceSetupNotionChange);
}

fs.writeFileSync('public/js/app.js', app);
console.log('app.js patched for estadias move logic');
