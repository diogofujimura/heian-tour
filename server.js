require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const NOTION_TOKEN = process.env.NOTION_API_KEY;
const NOTION_CLIENTS_DB_ID = process.env.NOTION_CLIENTS_DB_ID;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'database.json');
const defaultData = { config: {}, transportes: [], experiencias: [], atracoes: [], rotas: {}, orcamentosDB: [], clientesDB: [] };

// --- PUBLIC ROUTES (No Auth Required) ---
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/assets', express.static(path.join(__dirname, 'public', 'assets')));
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));

app.get('/cadastro', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cadastro.html'));
});

app.post('/api/public/cadastro', async (req, res) => {
  try {
    const { nome, adultos, criancas, dataInicio, dataFim, vooChegada, vooPartida, hotel } = req.body;
    
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    const fetch = require('node-fetch');
    // Prepare proper date object
    let dateObj = undefined;
    if (dataInicio && dataFim && dataInicio !== dataFim) {
      dateObj = { date: { start: dataInicio, end: dataFim } };
    } else if (dataInicio) {
      dateObj = { date: { start: dataInicio } };
    }

    const properties = {
      "Name": { title: [{ text: { content: nome } }] },
      "Status": { select: { name: "Novo" } },
      "Adultos": { number: parseInt(adultos) || 0 },
      "Crianças": { number: parseInt(criancas) || 0 },
      "Voo Chegada": { rich_text: [{ text: { content: vooChegada || '' } }] },
      "Voo Partida": { rich_text: [{ text: { content: vooPartida || '' } }] },
      "Hotel": { rich_text: [{ text: { content: hotel || '' } }] }
    };
    if (dateObj) properties["Data da Viagem"] = dateObj;

    const response = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_CLIENTS_DB_ID },
        properties: properties
      })
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('Notion API Error:', result);
      return res.status(500).json({ error: 'Erro ao criar cliente no Notion', details: result });
    }

    res.json({ success: true, client: result });
  } catch (error) {
    console.error('Erro na rota /api/public/cadastro:', error);
    res.status(500).json({ error: error.message });
  }
});
// ----------------------------------------

const basicAuth = require('express-basic-auth');
if (process.env.APP_PASS) {
  const users = {};
  users[process.env.APP_USER || 'admin'] = process.env.APP_PASS;
  app.use(basicAuth({
    users: users,
    challenge: true,
    realm: 'HeianQuoteAuth'
  }));
}

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Helpers
async function readDB() {
  try {
    const defaultData = { config: {}, transportes: [], experiencias: [], atracoes: [], rotas: {}, orcamentosDB: [], clientesDB: [] };
    
    // Traz config
    const { data: cfg } = await supabase.from('config').select('data').eq('id', 'app_config').single();
    if (cfg && cfg.data) defaultData.config = cfg.data;
    
    // Traz transportes, experiencias, atracoes da config
    const { data: transp } = await supabase.from('config').select('data').eq('id', 'transportes').single();
    if (transp && transp.data) defaultData.transportes = transp.data;

    const { data: exp } = await supabase.from('config').select('data').eq('id', 'experiencias').single();
    if (exp && exp.data) defaultData.experiencias = exp.data;

    const { data: atr } = await supabase.from('config').select('data').eq('id', 'atracoes').single();
    if (atr && atr.data) defaultData.atracoes = atr.data;

    // Traz orcamentos
    const { data: orcs } = await supabase.from('orcamentos').select('data');
    if (orcs) defaultData.orcamentosDB = orcs.map(r => r.data);

    // Traz clientes_locais
    const { data: clis } = await supabase.from('clientes_locais').select('data');
    if (clis) defaultData.clientesDB = clis.map(r => r.data);

    // Traz roteiros
    const { data: rots } = await supabase.from('roteiros').select('*');
    if (rots) {
      rots.forEach(r => {
        defaultData.rotas[r.nome] = r.data;
      });
    }

    // Traz rotas_base
    const { data: base } = await supabase.from('rotas_base').select('data').eq('id', 'base').single();
    if (base && base.data) {
      defaultData.rotas['[PLANILHA] Base de Rotas'] = { dias: base.data };
    }

    return defaultData;
  } catch(e) {
    console.error('Erro no readDB do Supabase:', e);
    return { config: {}, transportes: [], experiencias: [], atracoes: [], rotas: {}, orcamentosDB: [], clientesDB: [] };
  }
}

async function writeDB(db) {
  try {
    // Para simplificar essa transição imediata 1:1, gravamos as tabelas chaves
    const resCfg = await supabase.from('config').upsert({ id: 'app_config', data: db.config || {} });
    if (resCfg.error) throw new Error('Error upsert app_config: ' + resCfg.error.message);
    const resTransp = await supabase.from('config').upsert({ id: 'transportes', data: db.transportes || [] });
    if (resTransp.error) throw new Error('Error upsert transportes: ' + resTransp.error.message);
    const resExp = await supabase.from('config').upsert({ id: 'experiencias', data: db.experiencias || [] });
    if (resExp.error) throw new Error('Error upsert experiencias: ' + resExp.error.message);
    const resAtr = await supabase.from('config').upsert({ id: 'atracoes', data: db.atracoes || [] });
    if (resAtr.error) throw new Error('Error upsert atracoes: ' + resAtr.error.message);

    for (let o of db.orcamentosDB || []) {
      const resOrc = await supabase.from('orcamentos').upsert({ id: String(o.id), data: o });
      if (resOrc.error) throw new Error('Error upsert orcamento ' + o.id + ': ' + resOrc.error.message);
    }
    for (let c of db.clientesDB || []) {
      const resCli = await supabase.from('clientes_locais').upsert({ id: String(c.id), data: c });
      if (resCli.error) throw new Error('Error upsert cliente_local ' + c.id + ': ' + resCli.error.message);
    }

    // Deleta rotas velhas e insere novas
    for (let [nome, dados] of Object.entries(db.rotas || {})) {
      if (nome === '[PLANILHA] Base de Rotas') {
        const resBase = await supabase.from('rotas_base').upsert({ id: 'base', data: dados.dias });
        if (resBase.error) throw new Error('Error upsert rotas_base: ' + resBase.error.message);
      } else {
        const resRoteiro = await supabase.from('roteiros').upsert({ nome, data: dados });
        if (resRoteiro.error) throw new Error('Error upsert roteiro ' + nome + ': ' + resRoteiro.error.message);
      }
    }
  } catch(e) {
    console.error('Erro no writeDB:', e);
    throw e;
  }
}

const globalErrorLogs = [];
const originalConsoleError = console.error;
console.error = function(...args) {
  globalErrorLogs.unshift({ time: new Date().toISOString(), args: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)) });
  if (globalErrorLogs.length > 50) globalErrorLogs.pop();
  originalConsoleError.apply(console, args);
};

// Auxiliar para sincronização em duas vias com o Google Sheets via Apps Script Web App
async function syncToGoogleSheets(type, action, data, oldData = null) {
  const db = await readDB();
  const { sheets_script_url, sheets_aba_transportes, sheets_aba_experiencias, sheets_aba_atracoes, sheets_aba_rotas } = db.config;
  if (!sheets_script_url) return; // Se não houver URL configurada, ignora silenciosamente

  let sheetName = '';
  if (type === 'transportes') sheetName = sheets_aba_transportes || 'Base';
  else if (type === 'experiencias') sheetName = sheets_aba_experiencias || 'BaseEX';
  else if (type === 'atracoes') sheetName = sheets_aba_atracoes || 'Atracoes';
  else if (type === 'rotas') sheetName = sheets_aba_rotas || 'Rotas';

  try {
    const payload = { action, type, sheetName, data, oldData };
    // Dispara em background de forma assíncrona sem travar a resposta HTTP local
    fetch(sheets_script_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(async r => {
      const resVal = await r.json();
      console.log(`[Google Sheets Sync] ${action.toUpperCase()} ${type}:`, resVal);
    }).catch(err => {
      console.error(`[Google Sheets Sync Error] Falha ao enviar para o Sheets:`, err.message);
    });
  } catch (err) {
    console.error(`[Google Sheets Sync Error] Erro ao preparar requisição:`, err.message);
  }
}

// ── API: Config / Câmbio ────────────────────────────────────────────────────
app.get('/api/config', async (req, res) => {
  const db = await readDB();
  res.json(db.config);
});

app.post('/api/config', async (req, res) => {
  const db = await readDB();
  db.config = { ...db.config, ...req.body };
  await writeDB(db);
  res.json({ ok: true });
});

app.get('/api/debug', async (req, res) => {
  try {
    const { data: cfg, error: cfgErr } = await supabase.from('config').select('data').eq('id', 'app_config').single();
    res.json({
      supabaseUrl: !!process.env.SUPABASE_URL,
      supabaseKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      cfgData: cfg,
      cfgErr: cfgErr
    });
  } catch (e) {
    res.json({ error: e.message, stack: e.stack });
  }
});

app.get('/api/debug-logs', (req, res) => {
  res.json(globalErrorLogs);
});

// ── API: Transportes ────────────────────────────────────────────────────────
app.get('/api/orcamentos', async (req, res) => res.json((await readDB()).orcamentosDB));
app.post('/api/orcamentos', async (req, res) => {
  try {
    const db = await readDB();
    const index = db.orcamentosDB.findIndex(o => o.id === req.body.id);
    if(index > -1) db.orcamentosDB[index] = req.body;
    else db.orcamentosDB.push(req.body);
    await writeDB(db);
    res.json({success:true});
  } catch(e) {
    res.status(500).json({error: e.message});
  }
});
app.delete('/api/orcamentos/:id', async (req, res) => {
  const db = await readDB();
  db.orcamentosDB = db.orcamentosDB.filter(o => o.id !== req.params.id);
  await writeDB(db);
  res.json({success:true});
});

// Clientes Local (Dados estruturados atrelados ao Notion)
app.get('/api/clientes/local/:id', async (req, res) => {
  const db = await readDB();
  const cliente = db.clientesDB.find(c => c.id === req.params.id);
  res.json(cliente || { id: req.params.id, estadias: [] });
});
app.post('/api/clientes/local', async (req, res) => {
  const db = await readDB();
  const index = db.clientesDB.findIndex(c => c.id === req.body.id);
  if(index > -1) db.clientesDB[index] = req.body;
  else db.clientesDB.push(req.body);
  await writeDB(db);
  res.json({success:true});
});

app.get('/api/transportes', async (req, res) => {
  const db = await readDB();
  res.json(db.transportes);
});

app.post('/api/transportes', async (req, res) => {
  const db = await readDB();
  const novo = { ...req.body, id: Date.now() };
  db.transportes.push(novo);
  await writeDB(db);
  
  // Sincroniza em background
  await syncToGoogleSheets('transportes', 'insert', novo);
  
  res.json(novo);
});

app.put('/api/transportes/:id', async (req, res) => {
  const db = await readDB();
  const idx = db.transportes.findIndex(t => t.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
  const oldItem = db.transportes[idx];
  db.transportes[idx] = { ...db.transportes[idx], ...req.body };
  await writeDB(db);
  
  // Sincroniza em background
  await syncToGoogleSheets('transportes', 'update', db.transportes[idx], oldItem);
  
  res.json(db.transportes[idx]);
});

app.delete('/api/transportes/:id', async (req, res) => {
  const db = await readDB();
  // EXCLUSÃO DO GOOGLE SHEETS DESATIVADA A PEDIDO DO USUÁRIO
  db.transportes = db.transportes.filter(t => t.id != req.params.id);
  await writeDB(db);
  res.json({ ok: true });
});

// ── API: Experiências ───────────────────────────────────────────────────────
app.get('/api/experiencias', async (req, res) => {
  const db = await readDB();
  res.json(db.experiencias);
});

app.post('/api/experiencias', async (req, res) => {
  const db = await readDB();
  const novo = { ...req.body, id: Date.now() };
  db.experiencias.push(novo);
  await writeDB(db);
  
  // Sincroniza em background
  await syncToGoogleSheets('experiencias', 'insert', novo);
  
  res.json(novo);
});

app.put('/api/experiencias/:id', async (req, res) => {
  const db = await readDB();
  const idx = db.experiencias.findIndex(e => e.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
  const oldItem = db.experiencias[idx];
  db.experiencias[idx] = { ...db.experiencias[idx], ...req.body };
  await writeDB(db);
  
  // Sincroniza em background
  await syncToGoogleSheets('experiencias', 'update', db.experiencias[idx], oldItem);
  
  res.json(db.experiencias[idx]);
});

app.delete('/api/experiencias/:id', async (req, res) => {
  const db = await readDB();
  // EXCLUSÃO DO GOOGLE SHEETS DESATIVADA A PEDIDO DO USUÁRIO
  db.experiencias = db.experiencias.filter(e => e.id != req.params.id);
  await writeDB(db);
  res.json({ ok: true });
});

// ── API: Roteiros & Atrações ────────────────────────────────────────────────
app.get('/api/atracoes', async (req, res) => {
  const db = await readDB();
  res.json(db.atracoes || []);
});

app.post('/api/atracoes', async (req, res) => {
  const db = await readDB();
  if (!db.atracoes) db.atracoes = [];
  const novo = { ...req.body, id: Date.now() };
  db.atracoes.push(novo);
  await writeDB(db);
  
  // Sincroniza em background
  await syncToGoogleSheets('atracoes', 'insert', novo);
  
  res.json(novo);
});

app.put('/api/atracoes/:id', async (req, res) => {
  const db = await readDB();
  const idx = db.atracoes.findIndex(a => a.id == req.params.id || a['Nome da Atração'] === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
  const oldItem = db.atracoes[idx];
  db.atracoes[idx] = { ...db.atracoes[idx], ...req.body };
  await writeDB(db);
  
  // Sincroniza em background
  await syncToGoogleSheets('atracoes', 'update', db.atracoes[idx], oldItem);
  
  res.json(db.atracoes[idx]);
});

app.delete('/api/atracoes/:id', async (req, res) => {
  const db = await readDB();
  const oldItem = db.atracoes.find(a => a.id == req.params.id || a['Nome da Atração'] === req.params.id);
  db.atracoes = db.atracoes.filter(a => a.id != req.params.id && a['Nome da Atração'] !== req.params.id);
  await writeDB(db);
  if (oldItem) await syncToGoogleSheets('atracoes', 'delete', oldItem);
  res.json({ ok: true });
});

app.get('/api/roteiros', async (req, res) => {
  const db = await readDB();
  res.json(db.rotas || {});
});

app.post('/api/roteiros/:name', async (req, res) => {
  const db = await readDB();
  if (!db.rotas) db.rotas = {};
  const name = req.params.name;
  db.rotas[name] = req.body; // Expects an array of days
  await writeDB(db);
  res.json({ ok: true, name, roteiro: db.rotas[name] });
});

app.delete('/api/roteiros/:name', async (req, res) => {
  const db = await readDB();
  const name = req.params.name;
  if (db.rotas && db.rotas[name]) {
    delete db.rotas[name];
    await writeDB(db);
  }
  res.json({ ok: true });
});

// ── API: Gestão de Sequências (Aba Rotas) ───────────────────────────────────
app.get('/api/rotas-base', async (req, res) => {
  const db = await readDB();
  const base = db.rotas && db.rotas['[PLANILHA] Base de Rotas'] ? db.rotas['[PLANILHA] Base de Rotas'].dias : [];
  res.json(base);
});

app.post('/api/rotas-base', async (req, res) => {
  const db = await readDB();
  if (!db.rotas) db.rotas = {};
  if (!db.rotas['[PLANILHA] Base de Rotas']) db.rotas['[PLANILHA] Base de Rotas'] = { dias: [] };
  
  const novo = { id: Date.now(), ...req.body };
  db.rotas['[PLANILHA] Base de Rotas'].dias.push(novo);
  await writeDB(db);
  
  await syncToGoogleSheets('rotas', 'insert', novo);
  res.json(novo);
});

app.put('/api/rotas-base/:id', async (req, res) => {
  const db = await readDB();
  if (!db.rotas || !db.rotas['[PLANILHA] Base de Rotas']) return res.status(404).json({ error: 'Base vazia' });
  
  const dias = db.rotas['[PLANILHA] Base de Rotas'].dias;
  const idx = dias.findIndex(d => d.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
  
  const oldItem = dias[idx];
  dias[idx] = { ...dias[idx], ...req.body };
  await writeDB(db);
  
  await syncToGoogleSheets('rotas', 'update', dias[idx], oldItem);
  res.json(dias[idx]);
});

app.delete('/api/rotas-base/:id', async (req, res) => {
  const db = await readDB();
  if (!db.rotas || !db.rotas['[PLANILHA] Base de Rotas']) return res.status(404).json({ error: 'Base vazia' });
  
  const dias = db.rotas['[PLANILHA] Base de Rotas'].dias;
  const oldItem = dias.find(d => d.id == req.params.id);
  db.rotas['[PLANILHA] Base de Rotas'].dias = dias.filter(d => d.id != req.params.id);
  await writeDB(db);
  
  if (oldItem) await syncToGoogleSheets('rotas', 'delete', oldItem);
  res.json({ ok: true });
});


// ── API: Sync Google Sheets ─────────────────────────────────────────────────
app.post('/api/sync', async (req, res) => {
  const db = await readDB();
  const { sheets_id, sheets_aba_transportes, sheets_aba_experiencias, sheets_aba_atracoes, sheets_aba_rotas } = db.config;

  if (!sheets_id) {
    return res.status(400).json({ error: 'ID do Google Sheets não configurado nas Configurações.' });
  }

  const abaT = sheets_aba_transportes || 'Base';
  const abaE = sheets_aba_experiencias || 'BaseEX';
  const abaA = sheets_aba_atracoes || 'Atracoes';
  const abaRotas = sheets_aba_rotas || 'Rotas';

  // Busca uma aba via gviz usando o range completo (inclui linhas em branco)
  async function fetchAba(nomeAba) {
    const url = `https://docs.google.com/spreadsheets/d/${sheets_id}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(nomeAba)}`;
    const resp = await fetch(url);
    const text = await resp.text();
    const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const json = JSON.parse(jsonStr);
    return json.table;
  }

  function cellVal(cell) {
    if (!cell) return '';
    if (cell.f != null) return String(cell.f).trim();
    if (cell.v != null) return String(cell.v).trim();
    return '';
  }

  // Para colunas de preço: usa sempre o valor numérico bruto (cell.v)
  // evitando que o formato da célula (ex: "14.17" de ¥14.170) distorça o número
  function cellNum(cell) {
    if (!cell) return 0;
    if (cell.v != null && typeof cell.v === 'number') return cell.v;
    // fallback: tenta extrair número do valor formatado
    return parsePreco(cellVal(cell));
  }

  try {
    let nTransp = 0, nExp = 0, nAtracoes = 0;

    // ── TRANSPORTES (aba "Base") ─────────────────────────────────────
    // Estrutura: cabeçalho aparece numa linha que começa com "Trecho".
    // Colunas: Trecho | Tipo | Linha | Categoria | Preço | Tempo | Observações | Comprar | TrechoCompleto
    try {
      const table = await fetchAba(abaT);
      const rows = table.rows || [];

      // Procura a linha de cabeçalho
      let headerIdx = -1;
      let headers = [];
      
      // Tenta ler dos 'cols' do gviz primeiro
      if (table.cols && table.cols.length > 0 && table.cols[0].label) {
        headers = table.cols.map(c => (c.label || '').toLowerCase().trim());
      } else {
        for (let i = 0; i < rows.length; i++) {
          const firstCell = cellVal(rows[i].c?.[0]);
          if (firstCell && firstCell.toLowerCase() === 'trecho') { 
            headerIdx = i; 
            headers = (rows[i].c || []).map(cell => (cellVal(cell) || '').toLowerCase().trim());
            break; 
          }
        }
      }
      
      const idxTrecho = headers.indexOf('trecho') > -1 ? headers.indexOf('trecho') : 0;
      const idxIdade = headers.findIndex(h => h.includes('idade') || h.includes('adulto') || h.includes('infantil'));
      const idxTipo = headers.findIndex(h => h.includes('tipo') && !h.includes('idade') && !h.includes('adulto'));
      const idxLinha = headers.findIndex(h => h.includes('linha'));
      const idxCategoria = headers.findIndex(h => h.includes('categoria'));
      const idxPreco = headers.findIndex(h => h.includes('preço') || h.includes('preco') || h.includes('unitário'));
      const idxTempo = headers.findIndex(h => h.includes('tempo'));
      const idxObs = headers.findIndex(h => h.includes('observação') || h.includes('observacao'));
      const idxLink = headers.findIndex(h => h.includes('link'));
      const idxId = headers.findIndex(h => h === 'id');

      const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;

      console.log('HEADERS:', headers); console.log('IDXs:', idxTrecho, idxIdade, idxTipo, idxLinha, idxCategoria, idxPreco, idxTempo); const transportes = dataRows
        .map((r, i) => {
          const c = r.c || [];
          const trecho = cellVal(c[idxTrecho]);
          if (!trecho) return null;
          
          // Se encontrou Idade, sabemos que todas as colunas originais andaram 1 casa
          const offset = idxIdade > -1 ? 1 : 0;
          
          return {
            id: (idxId > -1 ? cellVal(c[idxId]) : null) || cellVal(c[12 + offset]) || (i + 1),
            trecho,
            idade:      (idxIdade > -1 ? cellVal(c[idxIdade]) : ''),
            tipo:       (idxTipo > -1 ? cellVal(c[idxTipo]) : cellVal(c[1 + offset])),
            linha:      (idxLinha > -1 ? cellVal(c[idxLinha]) : cellVal(c[2 + offset])),
            categoria:  (idxCategoria > -1 ? cellVal(c[idxCategoria]) : cellVal(c[3 + offset])),
            preco_jpy:  cellNum(c[idxPreco > -1 ? idxPreco : 4 + offset]),
            tempo:      (idxTempo > -1 ? cellVal(c[idxTempo]) : cellVal(c[5 + offset])),
            observacao: (idxObs > -1 ? cellVal(c[idxObs]) : cellVal(c[6 + offset])),
            link:       (idxLink > -1 ? cellVal(c[idxLink]) : cellVal(c[7 + offset]))
          };
        })
        .filter(Boolean);

      if (transportes.length > 0) { db.transportes = transportes; nTransp = transportes.length; }
    } catch (e) { console.error('Erro aba transportes:', e.message); }

    // ── EXPERIÊNCIAS (aba "BaseEX") ──────────────────────────────────
    // Estrutura SEM cabeçalho. Colunas: Nome | Tipo | (vazio) | Categoria | Preço | ...
    try {
      const table = await fetchAba(abaE);
      const rows = table.rows || [];

      // Se a primeira linha for cabeçalho (primeira célula vazia ou "nome"/"experiência"), pula
      let dataRows = rows;
      const first = cellVal(rows[0]?.c?.[0]).toLowerCase();
      if (first === 'nome' || first === 'experiência' || first === 'experiencia' || first === '') {
        dataRows = rows.slice(1);
      }

      const experiencias = dataRows
        .map((r, i) => {
          const c = r.c || [];
          const nome = cellVal(c[0]);
          if (!nome) return null;
          return {
            id: cellVal(c[10]) || (i + 1),
            nome,
            tipo:       cellVal(c[1]) || 'Ingresso',
            preco_jpy:  cellNum(c[4]),  // Preço está na 5ª coluna (índice 4)
            observacao: '',
            link:       cellVal(c[7])
          };
        })
        .filter(Boolean);

      if (experiencias.length > 0) { db.experiencias = experiencias; nExp = experiencias.length; }
    } catch (e) { console.error('Erro aba experiências:', e.message); }

    // ── ATRAÇÕES (aba "Atracoes") ────────────────────────────────────
    try {
      const table = await fetchAba(abaA);
      const rows = table.rows || [];

      if (rows.length > 0) {
        // Encontra a linha de cabeçalho (procura nas primeiras 5 linhas)
        let headerIdx = 0;
        let foundHeader = false;
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const cells = rows[i].c || [];
          const rowVals = cells.map(cellVal).map(v => v.toLowerCase());
          if (rowVals.some(v => v.includes('atração') || v.includes('atracao') || v.includes('atrações') || v.includes('atracoes') || v.includes('nome'))) {
            headerIdx = i;
            foundHeader = true;
            break;
          }
        }

        const headerCells = rows[headerIdx]?.c || [];
        const headerVals = headerCells.map(cellVal).map(v => v.toLowerCase());

        const getIdx = (keywords, defaultVal) => {
          const idx = headerVals.findIndex(h => keywords.some(k => h.includes(k)));
          return idx >= 0 ? idx : defaultVal;
        };

        const idxCidade = getIdx(['cidade', 'city', 'local'], 0);
        const idxBairro = getIdx(['bairro', 'neighborhood', 'região', 'regiao', 'zona'], 1);
        const idxNome = getIdx(['nome', 'atração', 'atracao', 'name', 'título', 'titulo'], 2);
        const idxDescricao = getIdx(['descrição', 'descricao', 'detalhes', 'detalhada', 'description', 'sobre'], 3);
        const idxPreco = getIdx(['preço', 'preco', 'ingresso', 'valor', 'price', 'custo'], 4);
        const idxOrigem = getIdx(['origem', 'source', 'casal'], 5);

        const dataRows = foundHeader ? rows.slice(headerIdx + 1) : rows;

        const atracoes = dataRows
          .map((r, i) => {
            const c = r.c || [];
            const nome = cellVal(c[idxNome]);
            if (!nome) return null;
            return {
              id: cellVal(c[6]) || (i + 1),
              Cidade: cellVal(c[idxCidade]) || 'Geral',
              Bairro: cellVal(c[idxBairro]) || '',
              'Nome da Atração': nome,
              'Descrição Detalhada': cellVal(c[idxDescricao]) || '',
              'Preço (Ingresso)': cellVal(c[idxPreco]) || 'Gratuito',
              Origem: cellVal(c[idxOrigem]) || 'Google Sheets'
            };
          })
          .filter(Boolean);

        if (atracoes.length > 0) {
          db.atracoes = atracoes;
          nAtracoes = atracoes.length;
        }
      }
    } catch (e) { console.error('Erro aba atrações:', e.message); }

    // ── ROTAS (aba "Rotas") ──────────────────────────────────────────
    try {
      const table = await fetchAba(abaRotas);
      const rows = table.rows || [];
      let diasImportados = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row.c) continue;
        
        const cidade = cellVal(row.c[0]);
        const nomeDaRota = cellVal(row.c[1]);
        const atracoesRaw = cellVal(row.c[2]);
        const idStr = cellVal(row.c[3]); // Lę ID da coluna D
        const id = idStr ? idStr : i; // Fallback para i se estiver vazio
        
        if (cidade && nomeDaRota) {
          diasImportados.push({ 
            id: id,
            cidade, 
            nomeDaRota, 
            atracoesDoDia: atracoesRaw ? atracoesRaw.split(',').map(s => s.trim()).filter(Boolean) : [] 
          });
        }
      }
      if (diasImportados.length > 0) {
        if (!db.rotas) db.rotas = {};
        db.rotas['[PLANILHA] Base de Rotas'] = { dias: diasImportados };
      }
    } catch (e) { console.error('Erro aba Rotas:', e.message); }


    db.config.ultima_sincronizacao = new Date().toISOString();
    await writeDB(db);
    res.json({ ok: true, ultima_sincronizacao: db.config.ultima_sincronizacao, nTransp, nExp, nAtracoes });

  } catch (err) {
    console.error('Erro no sync:', err);
    res.status(500).json({ error: 'Erro ao sincronizar. Verifique se a planilha está pública e se os nomes das abas estão corretos.' });
  }
});

app.get('/api/cambio', async (req, res) => {
  try {
    // API gratuita de câmbio, sem necessidade de chave
    const resp = await fetch('https://open.er-api.com/v6/latest/JPY');
    const data = await resp.json();
    if (data && data.rates) {
      const usd = data.rates.USD;
      const brl = data.rates.BRL;
      res.json({ ok: true, cambio_jpy_usd: usd, cambio_jpy_brl: brl, data: data.time_last_update_utc });
    } else {
      res.status(500).json({ error: 'Resposta inesperada da API de câmbio.' });
    }
  } catch (err) {
    console.error('Erro câmbio:', err);
    res.status(500).json({ error: 'Erro ao buscar câmbio. Verifique sua conexão.' });
  }
});

function parsePreco(v) {
  if (!v) return 0;
  // Remove símbolo ¥ e espaços
  let s = String(v).replace(/[¥\s]/g, '');
  // Se tiver ponto E vírgula: formato europeu/BR (ex: 14.170,00) → remove ponto, troca vírgula por ponto
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',') && !s.includes('.')) {
    // Só vírgula: pode ser decimal (1.200,50) ou milhar (1,200)
    // Se tiver mais de 3 dígitos após a vírgula, é separador de milhar
    const partes = s.split(',');
    if (partes[partes.length - 1].length !== 2 && partes[partes.length - 1].length !== 1) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(/,/g, '.');
    }
  } else {
    // Remove vírgulas (separador de milhar estilo inglês: 14,170)
    s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ── Integração Notion ───────────────────────────────────────────────────────
app.get('/api/notion/clientes', async (req, res) => {
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_CLIENTS_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sorts: [
          { timestamp: 'created_time', direction: 'descending' }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Notion API Error:', errorData);
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    
    // Mapeamento das propriedades do Notion para o nosso objeto Cliente
    const clientes = data.results.map(page => {
      const p = page.properties;
      
      const getTitle = (prop) => prop?.title?.map(t => t.plain_text).join('') || '';
      const getRichText = (prop) => prop?.rich_text?.map(t => t.plain_text).join('') || '';
      const getNumber = (prop) => prop?.number || 0;
      const getSelect = (prop) => prop?.select?.name || '';
      const getDateStart = (prop) => prop?.date?.start || '';
      const getDateEnd = (prop) => prop?.date?.end || '';
      const getFormulaNumber = (prop) => prop?.formula?.number || 0;
      const getFormulaString = (prop) => prop?.formula?.string || '';
      const getRollupNumber = (prop) => prop?.rollup?.number || 0;

      return {
        id: page.id,
        nome: getTitle(p['Nome do Cliente'] || p['Name'] || p['Nome']),
        status: getSelect(p['Status do Cliente'] || p['Status']),
        adultos: getNumber(p['Qtd Adultos']),
        criancas: getNumber(p['Qtd Crianças']),
        vooChegada: getRichText(p['Voo de Chegada']),
        vooPartida: getRichText(p['Voo de Partida']),
        vooChegadaNum: '',
        vooChegadaHora: '',
        vooPartidaNum: '',
        vooPartidaHora: '',
        dataInicio: getDateStart(p['Período da Viagem']),
        dataFim: getDateEnd(p['Período da Viagem']),
        hotel: getRichText(p['Hotel']),
        email: p['Email']?.email || '',
        viajantes: getRichText(p['Nome dos Viajantes'] || p['Viajantes']),
        valorTotal: getNumber(p['Valor Total']),
        totalPago: getRollupNumber(p['Total Pago']),
        saldoPagar: getFormulaNumber(p['Saldo a Pagar']),
        statusPagamento: getFormulaString(p['Status de pagamento'])
      };
    });

    // Parse voo fields into components
    clientes.forEach(c => {
      if (c.vooChegada && c.vooChegada.includes('|')) {
        const parts = c.vooChegada.split('|').map(s => s.trim());
        c.vooChegadaNum = parts[0] || '';
        c.vooChegadaHora = parts[1] || '';
      } else {
        c.vooChegadaNum = c.vooChegada || '';
        c.vooChegadaHora = '';
      }
      if (c.vooPartida && c.vooPartida.includes('|')) {
        const parts = c.vooPartida.split('|').map(s => s.trim());
        c.vooPartidaNum = parts[0] || '';
        c.vooPartidaHora = parts[1] || '';
      } else {
        c.vooPartidaNum = c.vooPartida || '';
        c.vooPartidaHora = '';
      }
    });

    res.json(clientes);
  } catch (error) {
    console.error('Erro ao buscar clientes no Notion:', error);
      return res.status(500).json({ error: 'Erro ao buscar clientes no Notion', details: error.message });
  }
});

// Criar cliente no Notion
app.post('/api/notion/clientes', async (req, res) => {
  try {
    const { nome, status, adultos, criancas, vooChegada, vooPartida, vooChegadaNum, vooChegadaHora, vooPartidaNum, vooPartidaHora, dataInicio, dataFim, hotel, email, viajantes } = req.body;
    
    const properties = {
      'Nome do Cliente': { title: [{ text: { content: nome || 'Novo Cliente' } }] }
    };
    if (status) properties['Status do Cliente'] = { select: { name: status } };
    if (adultos !== undefined) properties['Qtd Adultos'] = { number: parseInt(adultos) || 0 };
    if (criancas !== undefined) properties['Qtd Crianças'] = { number: parseInt(criancas) || 0 };
    const vooChegadaCombined = [vooChegadaNum, vooChegadaHora].filter(Boolean).join(' | ');
    const vooPartidaCombined = [vooPartidaNum, vooPartidaHora].filter(Boolean).join(' | ');
    if (vooChegadaCombined || vooChegada) properties['Voo de Chegada'] = { rich_text: [{ text: { content: vooChegadaCombined || vooChegada } }] };
    if (vooPartidaCombined || vooPartida) properties['Voo de Partida'] = { rich_text: [{ text: { content: vooPartidaCombined || vooPartida } }] };
    if (hotel) properties['Hotel'] = { rich_text: [{ text: { content: hotel } }] };
    if (email) {
      const firstEmail = email.split('\n')[0].trim();
      if (firstEmail) properties['Email'] = { email: firstEmail };
    }
    if (viajantes) properties['Nome dos Viajantes'] = { rich_text: [{ text: { content: viajantes } }] };
    
    if (dataInicio) {
      properties['Período da Viagem'] = { date: { start: dataInicio, end: dataFim || null } };
    }

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_CLIENTS_DB_ID },
        properties
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json(err);
    }
    const data = await response.json();
    res.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Erro ao criar no Notion:', error);
    res.status(500).json({ error: error.message });
  }
});

// Atualizar cliente no Notion
app.patch('/api/notion/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, status, adultos, criancas, vooChegada, vooPartida, vooChegadaNum, vooChegadaHora, vooPartidaNum, vooPartidaHora, dataInicio, dataFim, hotel, email, viajantes } = req.body;
    
    const properties = {};
    if (nome) properties['Nome do Cliente'] = { title: [{ text: { content: nome } }] };
    if (status) properties['Status do Cliente'] = { select: { name: status } };
    if (adultos !== undefined) properties['Qtd Adultos'] = { number: parseInt(adultos) || 0 };
    if (criancas !== undefined) properties['Qtd Crianças'] = { number: parseInt(criancas) || 0 };
    if (email !== undefined) {
      if (email) {
        const firstEmail = email.split('\n')[0].trim();
        properties['Email'] = { email: firstEmail || null };
      } else {
        properties['Email'] = { email: null };
      }
    }
    if (viajantes !== undefined) properties['Nome dos Viajantes'] = { rich_text: viajantes ? [{ text: { content: viajantes } }] : [] };
    const vooChegadaCombined = [vooChegadaNum, vooChegadaHora].filter(Boolean).join(' | ');
    const vooPartidaCombined = [vooPartidaNum, vooPartidaHora].filter(Boolean).join(' | ');
    
    const finalVooChegada = vooChegadaCombined || vooChegada || '';
    if (vooChegada !== undefined || vooChegadaCombined) properties['Voo de Chegada'] = { rich_text: finalVooChegada ? [{ text: { content: finalVooChegada } }] : [] };
    
    const finalVooPartida = vooPartidaCombined || vooPartida || '';
    if (vooPartida !== undefined || vooPartidaCombined) properties['Voo de Partida'] = { rich_text: finalVooPartida ? [{ text: { content: finalVooPartida } }] : [] };
    
    if (hotel !== undefined) properties['Hotel'] = { rich_text: hotel ? [{ text: { content: hotel } }] : [] };
    
    if (dataInicio !== undefined) {
      if (dataInicio) {
        properties['Período da Viagem'] = { date: { start: dataInicio, end: dataFim || null } };
      } else {
        properties['Período da Viagem'] = { date: null };
      }
    }

    const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json(err);
    }
    const data = await response.json();
    res.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Erro ao atualizar no Notion:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── API: Dashboard Consolidação Notion (Somente Leitura) ───────────────────
app.get('/api/dashboard/notion-data/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const NOTION_TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;
    const NOTION_SAIDAS_DB_ID = process.env.NOTION_SAIDAS_DB_ID;
    const NOTION_ENTRADAS_DB_ID = process.env.NOTION_ENTRADAS_DB_ID;

    if (!NOTION_TOKEN || !NOTION_TASKS_DB_ID || !NOTION_SAIDAS_DB_ID || !NOTION_ENTRADAS_DB_ID) {
      return res.status(400).json({ error: 'Configuração do Notion incompleta no arquivo .env.' });
    }

    // Função auxiliar para fazer query nas bases do Notion de forma estritamente somente-leitura
    const queryNotionDB = async (dbId, filterProp) => {
      const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter: {
            property: filterProp,
            relation: {
              contains: clientId
            }
          }
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Erro ao consultar base ${dbId}: ${errText}`);
      }
      return await response.json();
    };

    // Consultas paralelas em background
    const [entradasData, saidasData, tasksData] = await Promise.all([
      queryNotionDB(NOTION_ENTRADAS_DB_ID, 'Cliente (Relação)'),
      queryNotionDB(NOTION_SAIDAS_DB_ID, '🎀 Clientes'),
      queryNotionDB(NOTION_TASKS_DB_ID, '🎀 Clientes')
    ]);

    // Parse de Entradas
    let totalRecebido = 0;
    const entradas = (entradasData.results || []).map(item => {
      const p = item.properties;
      const valor = p['Valor (JPY)']?.number || 0;
      totalRecebido += valor;
      return {
        id: item.id,
        descricao: p['Descrição da Entrada']?.title?.map(t => t.plain_text).join('') || 'Entrada sem nome',
        valor,
        data: p['Data do pagamento']?.date?.start || '',
        tipo: p['Tipo de pagamento']?.select?.name || ''
      };
    });

    // Parse de Saídas
    let totalDespesas = 0;
    const saidas = (saidasData.results || []).map(item => {
      const p = item.properties;
      const valor = p['Valor (JPY)']?.number || 0;
      totalDespesas += valor;
      return {
        id: item.id,
        descricao: p['Descrição']?.title?.map(t => t.plain_text).join('') || 'Saída sem nome',
        valor,
        data: p['Data de pagamento']?.date?.start || '',
        categoria: p['Categoria']?.select?.name || '',
        tipoServico: p['Tipo de serviço']?.select?.name || ''
      };
    });

    // Parse de Tasks
    let totalLucroProjetado = 0;
    let totalTaxas = 0;
    const tasks = (tasksData.results || []).map(item => {
      const p = item.properties;
      const lucro = p['Lucro']?.formula?.number || 0;
      const taxa = p['Taxa serviço']?.number || 0;
      totalLucroProjetado += lucro;
      totalTaxas += taxa;
      return {
        id: item.id,
        nome: p['Task name']?.title?.map(t => t.plain_text).join('') || 'Task sem nome',
        status: p['Status']?.status?.name || '',
        lucro,
        taxa,
        totalCliente: p['Total Cliente']?.formula?.number || 0,
        dataServico: p['Data do Serviço']?.date?.start || ''
      };
    });

    res.json({
      success: true,
      summary: {
        totalRecebido,
        totalDespesas,
        lucroReal: totalRecebido - totalDespesas,
        totalTaxas,
        totalLucroProjetado
      },
      details: {
        entradas,
        saidas,
        tasks
      }
    });

  } catch (error) {
    console.error('Erro na API de consolidação do Dashboard do Notion:', error);
    res.status(500).json({ error: 'Erro ao consolidar dados do Notion', details: error.message });
  }
});

// ── Inicia servidor ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║       HEIAN TOUR — Gerador de Orçamentos     ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Acesse: http://localhost:${PORT}              ║`);
  console.log('║  Para fechar: Ctrl + C                   ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Abre automaticamente no browser (Windows e Mac)
  const { exec } = require('child_process');
  const url = `http://localhost:${PORT}`;
  const cmd = process.platform === 'darwin' ? `open ${url}` : `start ${url}`;
  exec(cmd);
});
