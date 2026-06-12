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
    const { nome, email, viajantes, adultos, criancas, dataInicio, dataFim, vooChegada, vooPartida, hotel, observacoes } = req.body;
    
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    // Prepare proper date object
    let dateObj = undefined;
    if (dataInicio && dataFim && dataInicio !== dataFim) {
      dateObj = { date: { start: dataInicio, end: dataFim } };
    } else if (dataInicio) {
      dateObj = { date: { start: dataInicio } };
    }

    const properties = {
      "Nome do Cliente": { title: [{ text: { content: nome } }] },
      "Status do Cliente": { select: { name: "Novo" } },
      "Qtd Adultos": { number: parseInt(adultos) || 0 },
      "Qtd Crianças": { number: parseInt(criancas) || 0 }
    };
    
    if (vooChegada) properties["Voo de Chegada"] = { rich_text: [{ text: { content: vooChegada } }] };
    if (vooPartida) properties["Voo de Partida"] = { rich_text: [{ text: { content: vooPartida } }] };
    if (hotel) properties["Hotel"] = { rich_text: [{ text: { content: hotel } }] };
    if (dateObj) properties["Período da Viagem"] = dateObj;
    
    if (email) {
      const firstEmail = email.split('\n')[0].trim();
      if (firstEmail) properties['Email'] = { email: firstEmail };
    }
    if (viajantes) properties['Nome dos Viajantes'] = { rich_text: [{ text: { content: viajantes } }] };
    if (observacoes) properties['Observações'] = { rich_text: [{ text: { content: observacoes } }] };

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

    // Gravar no Supabase a estrutura local correspondente (incluindo fotoPerfil)
    const cliId = result.id;
    const currentEditingViajantes = [];
    if (viajantes) {
      viajantes.split('\n').filter(l => l.trim()).forEach(line => {
        const text = line.trim();
        const ageMatch = text.match(/\((\d+)\)$/);
        let idade = '';
        let namePart = text;
        if (ageMatch) {
          idade = ageMatch[1];
          namePart = text.substring(0, ageMatch.index).trim();
        }
        const parts = namePart.split(/\s+/);
        const sobrenome = parts.length > 1 ? parts.pop() : '';
        currentEditingViajantes.push({ id: Date.now() + Math.random(), nome: parts.join(' '), sobrenome, idade });
      });
    }

    const currentEditingEstadias = [];
    if (hotel) {
      hotel.split('\n').filter(l => l.trim()).forEach(line => {
        let cidade = ''; let hotelName = line.trim(); let dataInicioEst = ''; let dataFimEst = '';
        const dateMatch = line.match(/\((\d{2}\/\d{2}\/\d{4})\s*(?:a|-|até)\s*(\d{2}\/\d{2}\/\d{4})\)/);
        if (dateMatch) {
          const parseDate = d => { const p = d.split('/'); return p[2]+'-'+p[1]+'-'+p[0]; };
          dataInicioEst = parseDate(dateMatch[1]); dataFimEst = parseDate(dateMatch[2]);
          hotelName = line.substring(0, dateMatch.index).trim();
        }
        const dashIndex = hotelName.indexOf(' - ');
        if (dashIndex > -1) {
          cidade = hotelName.substring(0, dashIndex).trim();
          hotelName = hotelName.substring(dashIndex + 3).trim();
        }
        currentEditingEstadias.push({ id: Date.now() + Math.random(), cidade, dataInicio: dataInicioEst, dataFim: dataFimEst, hotel: hotelName });
      });
    }

    const currentEditingEmails = [];
    if (email) {
      email.split('\n').filter(l => l.trim()).forEach(line => {
        currentEditingEmails.push({ id: Date.now() + Math.random(), email: line.trim() });
      });
    }

    try {
      await supabase.from('clientes_locais').upsert({
        id: String(cliId),
        data: {
          id: cliId,
          estadias: currentEditingEstadias,
          viajantes: currentEditingViajantes,
          emails: currentEditingEmails,
          fotoPerfil: req.body.fotoPerfil || ""
        }
      });
    } catch (dbErr) {
      console.error('Erro ao gravar dados locais do cliente no Supabase via cadastro:', dbErr);
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
    
    const [cfgRes, transpRes, expRes, atrRes, orcsRes, clisRes, rotsRes, baseRes] = await Promise.all([
      supabase.from('config').select('data').eq('id', 'app_config').single(),
      supabase.from('config').select('data').eq('id', 'transportes').single(),
      supabase.from('config').select('data').eq('id', 'experiencias').single(),
      supabase.from('config').select('data').eq('id', 'atracoes').single(),
      supabase.from('orcamentos').select('data'),
      supabase.from('clientes_locais').select('data'),
      supabase.from('roteiros').select('*'),
      supabase.from('rotas_base').select('data').eq('id', 'base').single()
    ]);

    if (cfgRes.data && cfgRes.data.data) defaultData.config = cfgRes.data.data;
    if (transpRes.data && transpRes.data.data) defaultData.transportes = transpRes.data.data;
    if (expRes.data && expRes.data.data) defaultData.experiencias = expRes.data.data;
    if (atrRes.data && atrRes.data.data) defaultData.atracoes = atrRes.data.data;
    
    if (orcsRes.data) defaultData.orcamentosDB = orcsRes.data.map(r => r.data);
    if (clisRes.data) defaultData.clientesDB = clisRes.data.map(r => r.data);
    
    if (rotsRes.data) {
      rotsRes.data.forEach(r => {
        defaultData.rotas[r.nome] = r.data;
      });
    }
    
    if (baseRes.data && baseRes.data.data) {
      defaultData.rotas['[PLANILHA] Base de Rotas'] = { dias: baseRes.data.data };
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
  try {
    const { data, error } = await supabase.from('config').select('data').eq('id', 'app_config').single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data && data.data ? data.data : {});
  } catch(e) {
    console.error('Error getting config:', e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const { data, error: fetchErr } = await supabase.from('config').select('data').eq('id', 'app_config').single();
    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
    const existing = data && data.data ? data.data : {};
    const updated = { ...existing, ...req.body };
    const { error: upsertErr } = await supabase.from('config').upsert({ id: 'app_config', data: updated });
    if (upsertErr) throw upsertErr;
    res.json({ ok: true });
  } catch(e) {
    console.error('Error saving config:', e);
    res.status(500).json({error: e.message});
  }
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
app.get('/api/orcamentos', async (req, res) => {
  try {
    const { data, error } = await supabase.from('orcamentos').select('data');
    if (error) throw error;
    res.json(data ? data.map(r => r.data) : []);
  } catch(e) {
    console.error('Error getting orcamentos:', e);
    res.status(500).json({error: e.message});
  }
});
app.post('/api/orcamentos', async (req, res) => {
  try {
    const { error } = await supabase.from('orcamentos').upsert({ id: String(req.body.id), data: req.body });
    if (error) throw error;
    res.json({success:true});
  } catch(e) {
    res.status(500).json({error: e.message});
  }
});
app.delete('/api/orcamentos/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('orcamentos').delete().eq('id', String(req.params.id));
    if (error) throw error;
    res.json({success:true});
  } catch(e) {
    console.error('Error deleting orcamento:', e);
    res.status(500).json({error: e.message});
  }
});

// Clientes Local (Dados estruturados atrelados ao Notion)
app.get('/api/clientes/local/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('clientes_locais').select('data').eq('id', String(req.params.id)).single();
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    res.json(data && data.data ? data.data : { id: req.params.id, estadias: [] });
  } catch(e) {
    console.error('Error getting local client:', e);
    res.status(500).json({error: e.message});
  }
});
app.post('/api/clientes/local', async (req, res) => {
  try {
    const { error } = await supabase.from('clientes_locais').upsert({ id: String(req.body.id), data: req.body });
    if (error) throw error;
    res.json({success:true});
  } catch(e) {
    console.error('Error saving local client:', e);
    res.status(500).json({error: e.message});
  }
});
app.delete('/api/clientes/local/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('clientes_locais').delete().eq('id', String(req.params.id));
    if (error) throw error;
    res.json({success:true});
  } catch(e) {
    console.error('Error deleting local client:', e);
    res.status(500).json({error: e.message});
  }
});

app.get('/api/transportes', async (req, res) => {
  try {
    const { data, error } = await supabase.from('config').select('data').eq('id', 'transportes').single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data && data.data ? data.data : []);
  } catch(e) {
    console.error('Error getting transportes:', e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/transportes', async (req, res) => {
  try {
    const { data, error: fetchErr } = await supabase.from('config').select('data').eq('id', 'transportes').single();
    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
    const list = data && data.data ? data.data : [];
    const novo = { ...req.body, id: Date.now() };
    list.push(novo);
    const { error: upsertErr } = await supabase.from('config').upsert({ id: 'transportes', data: list });
    if (upsertErr) throw upsertErr;
    
    // Sincroniza em background
    await syncToGoogleSheets('transportes', 'insert', novo);
    
    res.json(novo);
  } catch(e) {
    console.error('Error saving transporte:', e);
    res.status(500).json({error: e.message});
  }
});

app.put('/api/transportes/:id', async (req, res) => {
  try {
    const { data, error: fetchErr } = await supabase.from('config').select('data').eq('id', 'transportes').single();
    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
    const list = data && data.data ? data.data : [];
    const idx = list.findIndex(t => t.id == req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
    const oldItem = list[idx];
    list[idx] = { ...list[idx], ...req.body };
    const { error: upsertErr } = await supabase.from('config').upsert({ id: 'transportes', data: list });
    if (upsertErr) throw upsertErr;
    
    // Sincroniza em background
    await syncToGoogleSheets('transportes', 'update', list[idx], oldItem);
    
    res.json(list[idx]);
  } catch(e) {
    console.error('Error updating transporte:', e);
    res.status(500).json({error: e.message});
  }
});

app.delete('/api/transportes/:id', async (req, res) => {
  try {
    const { data, error: fetchErr } = await supabase.from('config').select('data').eq('id', 'transportes').single();
    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
    let list = data && data.data ? data.data : [];
    list = list.filter(t => t.id != req.params.id);
    const { error: upsertErr } = await supabase.from('config').upsert({ id: 'transportes', data: list });
    if (upsertErr) throw upsertErr;
    res.json({ ok: true });
  } catch(e) {
    console.error('Error deleting transporte:', e);
    res.status(500).json({error: e.message});
  }
});

// ── API: Experiências ───────────────────────────────────────────────────────
app.get('/api/experiencias', async (req, res) => {
  try {
    const { data, error } = await supabase.from('config').select('data').eq('id', 'experiencias').single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data && data.data ? data.data : []);
  } catch(e) {
    console.error('Error getting experiencias:', e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/experiencias', async (req, res) => {
  try {
    const { data, error: fetchErr } = await supabase.from('config').select('data').eq('id', 'experiencias').single();
    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
    const list = data && data.data ? data.data : [];
    const novo = { ...req.body, id: Date.now() };
    list.push(novo);
    const { error: upsertErr } = await supabase.from('config').upsert({ id: 'experiencias', data: list });
    if (upsertErr) throw upsertErr;
    
    // Sincroniza em background
    await syncToGoogleSheets('experiencias', 'insert', novo);
    
    res.json(novo);
  } catch(e) {
    console.error('Error saving experiencia:', e);
    res.status(500).json({error: e.message});
  }
});

app.put('/api/experiencias/:id', async (req, res) => {
  try {
    const { data, error: fetchErr } = await supabase.from('config').select('data').eq('id', 'experiencias').single();
    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
    const list = data && data.data ? data.data : [];
    const idx = list.findIndex(e => e.id == req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
    const oldItem = list[idx];
    list[idx] = { ...list[idx], ...req.body };
    const { error: upsertErr } = await supabase.from('config').upsert({ id: 'experiencias', data: list });
    if (upsertErr) throw upsertErr;
    
    // Sincroniza em background
    await syncToGoogleSheets('experiencias', 'update', list[idx], oldItem);
    
    res.json(list[idx]);
  } catch(e) {
    console.error('Error updating experiencia:', e);
    res.status(500).json({error: e.message});
  }
});

app.delete('/api/experiencias/:id', async (req, res) => {
  try {
    const { data, error: fetchErr } = await supabase.from('config').select('data').eq('id', 'experiencias').single();
    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
    let list = data && data.data ? data.data : [];
    list = list.filter(e => e.id != req.params.id);
    const { error: upsertErr } = await supabase.from('config').upsert({ id: 'experiencias', data: list });
    if (upsertErr) throw upsertErr;
    res.json({ ok: true });
  } catch(e) {
    console.error('Error deleting experiencia:', e);
    res.status(500).json({error: e.message});
  }
});

// ── API: Roteiros & Atrações ────────────────────────────────────────────────
app.get('/api/atracoes', async (req, res) => {
  try {
    const { data, error } = await supabase.from('config').select('data').eq('id', 'atracoes').single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data && data.data ? data.data : []);
  } catch(e) {
    console.error('Error getting atracoes:', e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/atracoes', async (req, res) => {
  try {
    const { data, error: fetchErr } = await supabase.from('config').select('data').eq('id', 'atracoes').single();
    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
    const list = data && data.data ? data.data : [];
    
    // Strip any HTML codes from the description
    if (req.body && req.body['Descrição Detalhada']) {
      req.body['Descrição Detalhada'] = req.body['Descrição Detalhada'].replace(/<[^>]*>?/gm, '').trim();
    }
    
    const novo = { ...req.body, id: Date.now() };
    list.push(novo);
    const { error: upsertErr } = await supabase.from('config').upsert({ id: 'atracoes', data: list });
    if (upsertErr) throw upsertErr;
    
    // Sincroniza em background
    await syncToGoogleSheets('atracoes', 'insert', novo);
    
    res.json(novo);
  } catch(e) {
    console.error('Error saving atracao:', e);
    res.status(500).json({error: e.message});
  }
});

app.put('/api/atracoes/:id', async (req, res) => {
  try {
    const { data, error: fetchErr } = await supabase.from('config').select('data').eq('id', 'atracoes').single();
    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
    const list = data && data.data ? data.data : [];
    const idx = list.findIndex(a => a.id == req.params.id || a['Nome da Atração'] === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
    
    // Strip any HTML codes from the description
    if (req.body && req.body['Descrição Detalhada']) {
      req.body['Descrição Detalhada'] = req.body['Descrição Detalhada'].replace(/<[^>]*>?/gm, '').trim();
    }
    
    const oldItem = list[idx];
    list[idx] = { ...list[idx], ...req.body };
    const { error: upsertErr } = await supabase.from('config').upsert({ id: 'atracoes', data: list });
    if (upsertErr) throw upsertErr;
    
    // Sincroniza em background
    await syncToGoogleSheets('atracoes', 'update', list[idx], oldItem);
    
    res.json(list[idx]);
  } catch(e) {
    console.error('Error updating atracao:', e);
    res.status(500).json({error: e.message});
  }
});

app.delete('/api/atracoes/:id', async (req, res) => {
  try {
    const { data, error: fetchErr } = await supabase.from('config').select('data').eq('id', 'atracoes').single();
    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
    const list = data && data.data ? data.data : [];
    const oldItem = list.find(a => a.id == req.params.id || a['Nome da Atração'] === req.params.id);
    const filteredList = list.filter(a => a.id != req.params.id && a['Nome da Atração'] !== req.params.id);
    const { error: upsertErr } = await supabase.from('config').upsert({ id: 'atracoes', data: filteredList });
    if (upsertErr) throw upsertErr;
    
    if (oldItem) await syncToGoogleSheets('atracoes', 'delete', oldItem);
    res.json({ ok: true });
  } catch(e) {
    console.error('Error deleting atracao:', e);
    res.status(500).json({error: e.message});
  }
});

app.get('/api/roteiros', async (req, res) => {
  try {
    const [rotsRes, baseRes] = await Promise.all([
      supabase.from('roteiros').select('*'),
      supabase.from('rotas_base').select('data').eq('id', 'base').single()
    ]);
    if (rotsRes.error) throw rotsRes.error;
    
    const rotasMap = {};
    for (const r of rotsRes.data || []) {
      rotasMap[r.nome] = r.data;
    }
    if (baseRes.data && baseRes.data.data) {
      rotasMap['[PLANILHA] Base de Rotas'] = { dias: baseRes.data.data };
    }
    res.json(rotasMap);
  } catch(e) {
    console.error('Error getting roteiros:', e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/roteiros/:name', async (req, res) => {
  try {
    const name = req.params.name;
    const dias = req.body; // Expects an array of days
    
    if (name === '[PLANILHA] Base de Rotas') {
      const { error } = await supabase.from('rotas_base').upsert({
        id: 'base',
        data: dias.dias || dias
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.from('roteiros').upsert({
        nome: name,
        data: dias
      }, { onConflict: 'nome' });
      if (error) throw error;
    }
    
    res.json({ ok: true, name, roteiro: dias });
  } catch(e) {
    console.error('Error saving roteiro:', e);
    res.status(500).json({error: e.message});
  }
});

app.delete('/api/roteiros/:name', async (req, res) => {
  try {
    const name = req.params.name;
    if (name === '[PLANILHA] Base de Rotas') {
      const { error } = await supabase.from('rotas_base').delete().eq('id', 'base');
      if (error) throw error;
    } else {
      const { error } = await supabase.from('roteiros').delete().eq('nome', name);
      if (error) throw error;
    }
    res.json({ ok: true });
  } catch(e) {
    console.error('Error deleting roteiro:', e);
    res.status(500).json({error: e.message});
  }
});

// ── API: Gestão de Sequências (Aba Rotas) ───────────────────────────────────
app.get('/api/rotas-base', async (req, res) => {
  try {
    const { data, error } = await supabase.from('rotas_base').select('data').eq('id', 'base').single();
    if (error && error.code !== 'PGRST116') throw error;
    const base = data && data.data ? data.data : [];
    res.json(base);
  } catch(e) {
    console.error('Error getting rotas-base:', e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/rotas-base', async (req, res) => {
  try {
    const { data, error: fetchErr } = await supabase.from('rotas_base').select('data').eq('id', 'base').single();
    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
    
    const list = data && data.data ? data.data : [];
    const novo = { id: Date.now(), ...req.body };
    list.push(novo);
    
    const { error: upsertErr } = await supabase.from('rotas_base').upsert({
      id: 'base',
      data: list
    });
    if (upsertErr) throw upsertErr;
    
    await syncToGoogleSheets('rotas', 'insert', novo);
    res.json(novo);
  } catch(e) {
    console.error('Error saving rotas-base:', e);
    res.status(500).json({error: e.message});
  }
});

app.put('/api/rotas-base/:id', async (req, res) => {
  try {
    const { data, error: fetchErr } = await supabase.from('rotas_base').select('data').eq('id', 'base').single();
    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
    
    const list = data && data.data ? data.data : [];
    const idx = list.findIndex(d => d.id == req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
    
    const oldItem = list[idx];
    list[idx] = { ...list[idx], ...req.body };
    
    const { error: upsertErr } = await supabase.from('rotas_base').upsert({
      id: 'base',
      data: list
    });
    if (upsertErr) throw upsertErr;
    
    await syncToGoogleSheets('rotas', 'update', list[idx], oldItem);
    res.json(list[idx]);
  } catch(e) {
    console.error('Error updating rotas-base:', e);
    res.status(500).json({error: e.message});
  }
});

app.delete('/api/rotas-base/:id', async (req, res) => {
  try {
    const { data, error: fetchErr } = await supabase.from('rotas_base').select('data').eq('id', 'base').single();
    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
    
    const list = data && data.data ? data.data : [];
    const oldItem = list.find(d => d.id == req.params.id);
    const filteredList = list.filter(d => d.id != req.params.id);
    
    const { error: upsertErr } = await supabase.from('rotas_base').upsert({
      id: 'base',
      data: filteredList
    });
    if (upsertErr) throw upsertErr;
    
    if (oldItem) await syncToGoogleSheets('rotas', 'delete', oldItem);
    res.json({ ok: true });
  } catch(e) {
    console.error('Error deleting rotas-base:', e);
    res.status(500).json({error: e.message});
  }
});


// ── API: Sync Google Sheets ─────────────────────────────────────────────────
app.post('/api/sync', async (req, res) => {
  try {
    const { data: cfgData, error: cfgErr } = await supabase.from('config').select('data').eq('id', 'app_config').single();
    if (cfgErr) throw cfgErr;
    const config = cfgData?.data || {};
    const { sheets_id, sheets_aba_transportes, sheets_aba_experiencias, sheets_aba_atracoes, sheets_aba_rotas } = config;

    if (!sheets_id) {
      return res.status(400).json({ error: 'ID do Google Sheets não configurado nas Configurações.' });
    }

    const abaT = sheets_aba_transportes || 'Base';
    const abaE = sheets_aba_experiencias || 'BaseEX';
    const abaA = sheets_aba_atracoes || 'Atracoes';
    const abaRotas = sheets_aba_rotas || 'Rotas';

    const db = {
      config,
      transportes: [],
      experiencias: [],
      atracoes: [],
      rotas: {}
    };

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
      
      const idxTrecho = headers.findIndex(h => h.includes('trecho')) > -1 ? headers.findIndex(h => h.includes('trecho')) : 0;
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
              'Descrição Detalhada': (cellVal(c[idxDescricao]) || '').replace(/<[^>]*>?/gm, '').trim(),
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
    
    // Grava apenas as tabelas alteradas em paralelo
    const syncPromises = [
      supabase.from('config').upsert({ id: 'app_config', data: db.config || {} }).then(r => { if (r.error) throw r.error; }),
      supabase.from('config').upsert({ id: 'transportes', data: db.transportes || [] }).then(r => { if (r.error) throw r.error; }),
      supabase.from('config').upsert({ id: 'experiencias', data: db.experiencias || [] }).then(r => { if (r.error) throw r.error; }),
      supabase.from('config').upsert({ id: 'atracoes', data: db.atracoes || [] }).then(r => { if (r.error) throw r.error; })
    ];
    
    if (db.rotas?.['[PLANILHA] Base de Rotas']?.dias) {
      syncPromises.push(
        supabase.from('rotas_base').upsert({ id: 'base', data: db.rotas['[PLANILHA] Base de Rotas'].dias }).then(r => { if (r.error) throw r.error; })
      );
    }
    
    await Promise.all(syncPromises);

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

// ── APIs DO CALENDÁRIO & COLABORADORES NOTION ────────────────────────────────
app.get('/api/notion/colaboradores', async (req, res) => {
  try {
    const DB_ID = process.env.NOTION_COLABORADORES_DB_ID || '2a0b6e48f954816082afde2815056602';
    const response = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro ao consultar banco de colaboradores: ${errText}`);
    }
    const data = await response.json();
    const colaboradores = (data.results || []).map(item => {
      const nameProp = item.properties.Name || item.properties.Nome;
      const name = nameProp?.title?.[0]?.plain_text || 'Sem Nome';
      const email = item.properties.Email?.email || '';
      const whatsapp = item.properties.Whatsapp?.phone_number || '';
      const rate = item.properties.Rate?.number || 35000;
      const locais = (item.properties.Locais?.multi_select || []).map(x => x.name);
      const residencia = (item.properties.Residência?.multi_select || []).map(x => x.name);
      return {
        id: item.id,
        name: name,
        email: email,
        whatsapp: whatsapp,
        rate: rate,
        locais: locais,
        residencia: residencia,
        avatar: null
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
    res.json(colaboradores);
  } catch (error) {
    console.error('Erro ao buscar colaboradores no Notion:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/calendario/eventos', async (req, res) => {
  try {
    const { data_inicio, data_fim, cliente_id } = req.query;
    
    const { data: calCfg, error: calErr } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
    let eventos = [];
    if (calCfg && calCfg.data) {
      eventos = Array.isArray(calCfg.data) ? calCfg.data : [];
    }

    // Aplicar filtros se fornecidos
    if (data_inicio) {
      eventos = eventos.filter(ev => ev.dataServico >= data_inicio);
    }
    if (data_fim) {
      eventos = eventos.filter(ev => ev.dataServico <= data_fim);
    }
    if (cliente_id) {
      eventos = eventos.filter(ev => ev.clienteId === cliente_id || (ev.clientes && ev.clientes.includes(cliente_id)));
    }

    res.json(eventos);
  } catch (error) {
    console.error('Erro ao buscar eventos do calendário local:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/calendario/eventos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { assigneeIds, dataServico, valorDiaria, pago, colaboradorId, valorDiariaColab, pagoColab } = req.body;

    // Buscar colaboradores do Notion (somente leitura) para preencher nome/avatar
    let collaborators = [];
    if (NOTION_TOKEN) {
      try {
        const DB_ID = process.env.NOTION_COLABORADORES_DB_ID || '2a0b6e48f954816082afde2815056602';
        const response = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          }
        });
        if (response.ok) {
          const data = await response.json();
          collaborators = (data.results || []).map(item => {
            const nameProp = item.properties.Name || item.properties.Nome;
            const rateProp = item.properties.Rate;
            return {
              id: item.id,
              name: nameProp?.title?.[0]?.plain_text || 'Sem Nome',
              avatar: null,
              rate: rateProp && typeof rateProp.number === 'number' ? rateProp.number : 35000
            };
          });
        }
      } catch (e) {
        console.error('Erro ao buscar colaboradores no Notion para o PATCH:', e);
      }
    }

    const { data: calCfg, error: calErr } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
    let eventos = [];
    if (calCfg && calCfg.data) {
      eventos = Array.isArray(calCfg.data) ? calCfg.data : [];
    }

    let updated = false;
    eventos = eventos.map(ev => {
      if (ev.id === id) {
        updated = true;
        const newEv = { ...ev };

        // Inicializar objetos individuais caso não existam
        if (!newEv.valorDiariaColab) newEv.valorDiariaColab = {};
        if (!newEv.pagoColab) newEv.pagoColab = {};

        // Caso 1: Atualização individualizada de faturamento vinda do dashboard
        if (colaboradorId) {
          if (valorDiariaColab !== undefined) {
            newEv.valorDiariaColab[colaboradorId] = valorDiariaColab === null ? null : Number(valorDiariaColab);
          }
          if (pagoColab !== undefined) {
            newEv.pagoColab[colaboradorId] = !!pagoColab;
          }

          // Compatibilidade global: Se for o colaborador principal (primeiro da lista), atualiza o campo global
          const primaryId = newEv.assignee && newEv.assignee.length > 0 ? newEv.assignee[0].id : null;
          if (colaboradorId === primaryId || !primaryId) {
            if (valorDiariaColab !== undefined) {
              newEv.valorDiaria = valorDiariaColab === null ? null : Number(valorDiariaColab);
            }
            if (pagoColab !== undefined) {
              newEv.pago = !!pagoColab;
            }
          }
        }

        // Caso 2: Atualização de atribuição (designação de guias) vinda do modal ou do card
        if (assigneeIds !== undefined) {
          newEv.assignee = assigneeIds.map(userId => {
            const found = collaborators.find(c => c.id === userId);
            return found ? { id: found.id, name: found.name, avatar: found.avatar } : { id: userId, name: userId };
          });

          // Limpar diárias de colaboradores desmarcados
          Object.keys(newEv.valorDiariaColab).forEach(uid => {
            if (!assigneeIds.includes(uid)) {
              delete newEv.valorDiariaColab[uid];
              delete newEv.pagoColab[uid];
            }
          });

          // Inicializar diárias de novos colaboradores marcados
          assigneeIds.forEach(uid => {
            if (newEv.valorDiariaColab[uid] === undefined || newEv.valorDiariaColab[uid] === null) {
              const isRoteiro = newEv.tipoServico && newEv.tipoServico.toLowerCase() === 'roteiro';
              const colFound = collaborators.find(c => c.id === uid);
              const defaultRate = colFound ? colFound.rate : 35000;
              
              // Se já houver um valorDiaria global definido no evento e for maior que zero, usa ele; senão, usa a taxa do guia
              if (typeof valorDiaria === 'number' && valorDiaria > 0) {
                newEv.valorDiariaColab[uid] = valorDiaria;
              } else if (typeof newEv.valorDiaria === 'number' && newEv.valorDiaria > 0) {
                newEv.valorDiariaColab[uid] = newEv.valorDiaria;
              } else {
                newEv.valorDiariaColab[uid] = isRoteiro ? defaultRate : 0;
              }
            }
            if (newEv.pagoColab[uid] === undefined) {
              newEv.pagoColab[uid] = pago !== undefined ? !!pago : (newEv.pago || false);
            }
          });

          // Compatibilidade global: Sincroniza campos globais com o primeiro colaborador
          if (assigneeIds.length > 0) {
            const primaryId = assigneeIds[0];
            newEv.valorDiaria = newEv.valorDiariaColab[primaryId];
            newEv.pago = newEv.pagoColab[primaryId];
          } else {
            newEv.valorDiaria = null;
            newEv.pago = false;
          }
        }

        // Outros campos globais
        if (dataServico !== undefined) {
          newEv.dataServico = dataServico;
        }
        if (valorDiaria !== undefined && assigneeIds === undefined && !colaboradorId) {
          newEv.valorDiaria = valorDiaria === null ? null : Number(valorDiaria);
          // Atualiza também para o primeiro colaborador se houver
          if (newEv.assignee && newEv.assignee.length > 0) {
            newEv.valorDiariaColab[newEv.assignee[0].id] = newEv.valorDiaria;
          }
        }
        if (pago !== undefined && assigneeIds === undefined && !colaboradorId) {
          newEv.pago = !!pago;
          // Atualiza também para o primeiro colaborador se houver
          if (newEv.assignee && newEv.assignee.length > 0) {
            newEv.pagoColab[newEv.assignee[0].id] = newEv.pago;
          }
        }

        return newEv;
      }
      return ev;
    });

    if (updated) {
      const { error: upsertErr } = await supabase.from('config').upsert({ id: 'calendario_eventos', data: eventos });
      if (upsertErr) throw upsertErr;

      // Espelhar alteração na Agenda do Notion (se for um ID válido e o Token/DB existirem)
      const NOTION_AGENDA_DB_ID = process.env.NOTION_AGENDA_DB_ID;
      if (NOTION_TOKEN && NOTION_AGENDA_DB_ID && id && !id.startsWith('cal_')) {
        try {
          const properties = {};
          const evUpdated = eventos.find(e => e.id === id);
          if (evUpdated) {
            if (assigneeIds !== undefined) {
              properties['Responsável'] = {
                relation: assigneeIds.map(uid => ({ id: uid }))
              };
            }
            if (dataServico !== undefined) {
              properties['Data do Tour'] = dataServico ? { date: { start: dataServico } } : null;
            }
            
            // Gravar diária global no Notion (que representa o guia principal do card)
            if (evUpdated.valorDiaria !== undefined) {
              properties['Valor diária do Guia'] = evUpdated.valorDiaria === null ? null : { number: Number(evUpdated.valorDiaria) };
            }
            if (evUpdated.pago !== undefined) {
              properties['Pagamento concluído '] = {
                status: { name: evUpdated.pago ? "Concluído" : "Não iniciado" }
              };
            }
            
            console.log(`Espelhando alteração do evento ${id} na Agenda do Notion...`);
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
              const errText = await response.text();
              console.error('Erro na resposta do PATCH no Notion:', errText);
            }
          }
        } catch (notionErr) {
          console.error('Erro ao espelhar alteração na Agenda do Notion:', notionErr);
        }
      }

      res.json({ success: true, id });
    } else {
      res.status(404).json({ error: 'Evento não encontrado' });
    }
  } catch (error) {
    console.error('Erro ao atualizar evento do calendário local:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/calendario/eventos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: calCfg, error: calErr } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
    let eventos = [];
    if (calCfg && calCfg.data) {
      eventos = Array.isArray(calCfg.data) ? calCfg.data : [];
    }

    const eventIndex = eventos.findIndex(ev => ev.id === id);
    if (eventIndex !== -1) {
      // 1. Arquivar card correspondente na Agenda do Notion (se for um ID real do Notion e as chaves existirem)
      const NOTION_AGENDA_DB_ID = process.env.NOTION_AGENDA_DB_ID;
      if (NOTION_TOKEN && NOTION_AGENDA_DB_ID && id && !id.startsWith('cal_')) {
        try {
          console.log(`Arquivando evento ${id} na Agenda do Notion via DELETE...`);
          const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${NOTION_TOKEN}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ archived: true })
          });
          if (!response.ok) {
            const errText = await response.text();
            console.error('Erro ao arquivar card no Notion:', errText);
          }
        } catch (notionErr) {
          console.error('Erro ao arquivar card na Agenda do Notion no DELETE:', notionErr);
        }
      }

      // 2. Remover do array local
      eventos.splice(eventIndex, 1);

      // 3. Gravar a lista atualizada de volta no Supabase
      const { error: upsertErr } = await supabase.from('config').upsert({ id: 'calendario_eventos', data: eventos });
      if (upsertErr) throw upsertErr;

      res.json({ success: true, id });
    } else {
      res.status(404).json({ error: 'Evento não encontrado no banco local.' });
    }
  } catch (error) {
    console.error('Erro ao excluir evento do calendário local:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/calendario/sincronizar-roteiro', async (req, res) => {
  try {
    const { roteiroNome } = req.body;
    if (!roteiroNome) return res.status(400).json({ error: 'Parâmetro roteiroNome é obrigatório' });

    // Buscar roteiro no Supabase
    const { data: rotData, error: rotErr } = await supabase.from('roteiros').select('data').eq('nome', roteiroNome).single();
    if (rotErr || !rotData) {
      return res.status(404).json({ error: `Roteiro "${roteiroNome}" não encontrado no banco local.` });
    }

    const roteiro = rotData.data;
    
    // Obter clienteId (relaxado: sem obrigação de estar no Notion)
    const clienteId = roteiro.notionClienteId || roteiro.cliente?.notionClienteId || roteiro.cliente?.nome || roteiro.nome || 'cliente_desconhecido';
    const clienteNome = roteiro.cliente?.nome || roteiro.nome || 'Cliente';

    const dataInicio = roteiro.cliente?.dataInicio;
    if (!dataInicio) {
      return res.status(400).json({ error: 'Defina uma data de início no roteiro antes de sincronizar com o calendário.' });
    }

    // Função auxiliar para somar dias a data string YYYY-MM-DD
    const somarDias = (dataStr, diasParaSomar) => {
      const [year, month, day] = dataStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      date.setDate(date.getDate() + diasParaSomar);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const novasTarefas = [];

    (roteiro.dias || []).forEach((dia, index) => {
      const dataServico = somarDias(dataInicio, index);

      // A) Roteiro (Passeios/Atrações do Dia) - Apenas se dia.tourGuiado === true
      const sequencias = (dia.elementos || []).filter(el => el.tipo === 'sequencia');
      const infos = (dia.elementos || []).filter(el => el.tipo === 'info');
      const textos = (dia.elementos || []).filter(el => el.tipo === 'texto');

      let cidade = '';
      const nomesAtracoes = [];
      const rotasNomes = [];
      sequencias.forEach(seq => {
        if (seq.cidade) cidade = seq.cidade;
        if (seq.nomeDaRota) rotasNomes.push(seq.nomeDaRota);
        if (seq.atracoesDoDia) {
          seq.atracoesDoDia.forEach(atr => {
            if (atr.nome) nomesAtracoes.push(atr.nome);
          });
        }
      });

      if (dia.tourGuiado === true) {
        let tituloRoteiro = `Dia ${index + 1} - Tour`;
        if (cidade) tituloRoteiro += ` em ${cidade}`;

        let horaEncontro = '';
        let localEncontro = '';
        let duracaoTour = '';
        if (infos.length > 0) {
          horaEncontro = infos[0].horarioEncontro || '';
          localEncontro = infos[0].localEncontro || '';
          duracaoTour = infos[0].duracaoTour || '';
        }

        novasTarefas.push({
          id: `cal_rot_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
          titulo: tituloRoteiro,
          dataServico,
          tipoServico: 'Roteiro',
          clienteId,
          clientes: [clienteId],
          clienteNome,
          cidade: cidade || 'Japão',
          horaEncontro,
          localEncontro,
          duracaoTour,
          atracoes: nomesAtracoes,
          rotas: rotasNomes,
          textos: textos.map(t => t.conteudo).filter(Boolean),
          assignee: []
        });
      }

      // B) Transportes - Adiciona sempre que existirem no dia
      const transportes = (dia.elementos || []).filter(el => el.tipo === 'transporte');
      transportes.forEach((t, tIdx) => {
        const orig = t.cidadeOrigem || 'Origem';
        const dest = t.cidadeDestino || 'Destino';
        const hora = t.horario || '';
        const nomeTr = t.tipoTransporte || 'Deslocamento';
        const tituloTr = `Transporte: ${orig} ➔ ${dest} (${nomeTr})`;

        novasTarefas.push({
          id: `cal_tr_${Date.now()}_${index}_${tIdx}_${Math.random().toString(36).substr(2, 9)}`,
          titulo: tituloTr,
          dataServico,
          tipoServico: nomeTr,
          clienteId,
          clientes: [clienteId],
          clienteNome,
          cidade: `${orig} ➔ ${dest}`,
          horaEncontro: hora,
          localEncontro: t.cidadeOrigem ? `Estação/Aeroporto de ${t.cidadeOrigem}` : '',
          transportInfo: {
            origem: orig,
            destino: dest,
            tipoTransporte: nomeTr,
            horario: hora,
            linha: t.linha || '',
            categoria: t.categoria || '',
            tempo: t.tempo || '',
            adultos: t.adultos || '',
            compradoHeian: t.compradoHeian !== false,
            observacoes: t.observacoes || ''
          },
          assignee: []
        });
      });

      // C) Experiências / Tickets - Adiciona sempre que existirem no dia
      const experiencias = (dia.elementos || []).filter(el => el.tipo === 'experiencia');
      experiencias.forEach((e, eIdx) => {
        const hora = e.horaPartida || '';
        const nome = e.nomeExp || 'Experiência';
        const tituloExp = `${nome}`;

        novasTarefas.push({
          id: `cal_exp_${Date.now()}_${index}_${eIdx}_${Math.random().toString(36).substr(2, 9)}`,
          titulo: tituloExp,
          dataServico,
          tipoServico: 'Experiência',
          clienteId,
          clientes: [clienteId],
          clienteNome,
          cidade: cidade || 'Japão',
          horaEncontro: hora,
          localEncontro: e.localEncontro || e.observacoes || '',
          expInfo: {
            nomeExp: nome,
            horaPartida: hora,
            adultos: e.adultos || '',
            compradoHeian: e.compradoHeian !== false,
            observacoes: e.observacoes || ''
          },
          assignee: []
        });
      });
    });

    // Buscar eventos existentes para outras cotações/clientes
    const { data: calCfg, error: calErr } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
    let eventosExistentes = [];
    if (calCfg && calCfg.data) {
      eventosExistentes = Array.isArray(calCfg.data) ? calCfg.data : [];
    }

    // Filtrar eventos antigos deste roteiro para removê-los
    const eventosFiltrados = eventosExistentes.filter(ev => {
      const matchCliente = ev.clienteId && ev.clienteId === clienteId;
      const matchRoteiro = ev.roteiroNome && ev.roteiroNome === roteiroNome;
      return !matchCliente && !matchRoteiro;
    });

    // Mapear guias que já estavam atribuídos para preservá-los
    const encontrarGuiaExistente = (tipo, data) => {
      const match = eventosExistentes.find(ev => 
        ev.dataServico === data && 
        (ev.clienteId === clienteId || ev.roteiroNome === roteiroNome) &&
        (ev.tipoServico === tipo || (tipo !== 'Roteiro' && tipo !== 'Experiência' && ev.tipoServico !== 'Roteiro' && ev.tipoServico !== 'Experiência'))
      );
      return match ? match.assignee : [];
    };

    // Aplicar a busca de guias e roteiroNome nos novos eventos
    novasTarefas.forEach(ev => {
      ev.assignee = encontrarGuiaExistente(ev.tipoServico, ev.dataServico);
      ev.roteiroNome = roteiroNome;
    });

    // ── CONFIGURAÇÃO DE SINCRONIZAÇÃO COM A AGENDA DO NOTION ──
    const NOTION_AGENDA_DB_ID = process.env.NOTION_AGENDA_DB_ID;
    
    if (NOTION_TOKEN && NOTION_AGENDA_DB_ID && clienteId && clienteId !== 'cliente_desconhecido') {
      try {
        console.log(`Buscando eventos antigos na Agenda do Notion para o cliente ${clienteId}...`);
        const queryResponse = await fetch(`https://api.notion.com/v1/databases/${NOTION_AGENDA_DB_ID}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filter: {
              property: '🎀 Clientes',
              relation: { contains: clienteId }
            }
          })
        });

        if (queryResponse.ok) {
          const queryData = await queryResponse.json();
          const oldEvents = queryData.results || [];
          console.log(`Arquivando ${oldEvents.length} eventos antigos na Agenda do Notion...`);
          
          for (const evPage of oldEvents) {
            try {
              await fetch(`https://api.notion.com/v1/pages/${evPage.id}`, {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${NOTION_TOKEN}`,
                  'Notion-Version': '2022-06-28',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ archived: true })
              });
            } catch (err) {
              console.error(`Erro ao arquivar card ${evPage.id} na Agenda do Notion:`, err);
            }
          }
        }
      } catch (notionQueryErr) {
        console.error('Erro ao limpar eventos na Agenda do Notion:', notionQueryErr);
      }
    }

    // Criar as novas tarefas na Agenda do Notion e associar os IDs retornados
    for (const tf of novasTarefas) {
      if (NOTION_TOKEN && NOTION_AGENDA_DB_ID && clienteId && clienteId !== 'cliente_desconhecido') {
        try {
          let valorDiariaPadrao = 0;
          const isRoteiro = tf.tipoServico && tf.tipoServico.toLowerCase() === 'roteiro';
          
          if (isRoteiro) {
            valorDiariaPadrao = 35000; // Valor de fallback padrão
          }

          // Montar o descritivo rico e estruturado para a coluna de Observações
          let obsTexto = '';
          const parts = [];
          
          if (isRoteiro) {
            if (tf.horaEncontro) parts.push(`🕒 Horário de Encontro: ${tf.horaEncontro}`);
            if (tf.localEncontro) parts.push(`📍 Local de Encontro: ${tf.localEncontro}`);
            if (tf.duracaoTour) parts.push(`⏳ Duração: Tour de ${tf.duracaoTour}`);
            if (tf.rotas && tf.rotas.length > 0) parts.push(`🗺️ Rota:\n${tf.rotas.join(' ➔ ')}`);
            if (tf.atracoes && tf.atracoes.length > 0) parts.push(`⭐ Atrações:\n${tf.atracoes.join(', ')}`);
            if (tf.textos && tf.textos.length > 0) parts.push(`📝 Detalhes:\n${tf.textos.join('\n')}`);
          } else if (tf.transportInfo) {
            if (tf.transportInfo.tipoTransporte) parts.push(`Transporte: ${tf.transportInfo.tipoTransporte}`);
            if (tf.transportInfo.origem && tf.transportInfo.destino) parts.push(`Trajeto: ${tf.transportInfo.origem} ➔ ${tf.transportInfo.destino}`);
            if (tf.transportInfo.horario) parts.push(`Horário Encontro: ${tf.transportInfo.horario}`);
            if (tf.transportInfo.observacoes) parts.push(`Detalhes: ${tf.transportInfo.observacoes}`);
          } else if (tf.expInfo) {
            if (tf.expInfo.nomeExp) parts.push(`Experiência: ${tf.expInfo.nomeExp}`);
            if (tf.expInfo.horaPartida) parts.push(`Horário Encontro: ${tf.expInfo.horaPartida}`);
            if (tf.expInfo.observacoes) parts.push(`Detalhes: ${tf.expInfo.observacoes}`);
          }
          
          obsTexto = parts.join('\n\n').trim();

          const properties = {
            'Nome': {
              title: [{ text: { content: tf.titulo } }]
            },
            'Data do Tour': {
              date: { start: tf.dataServico }
            },
            '🎀 Clientes': {
              relation: [{ id: clienteId }]
            }
          };

          if (tf.cidade) {
            const cidadeClean = tf.cidade.substring(0, 50).trim();
            properties['Cidade'] = {
              select: { name: cidadeClean }
            };
          }

          if (tf.assignee && tf.assignee.length > 0) {
            properties['Responsável'] = {
              relation: tf.assignee.map(a => ({ id: a.id }))
            };
          }

          properties['Valor diária do Guia'] = {
            number: isRoteiro ? valorDiariaPadrao : 0
          };

          if (obsTexto) {
            properties['Observações'] = {
              rich_text: [{ text: { content: obsTexto.substring(0, 2000) } }]
            };
          }

          const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${NOTION_TOKEN}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              parent: { database_id: NOTION_AGENDA_DB_ID },
              properties
            })
          });

          if (response.ok) {
            const pageData = await response.json();
            tf.id = pageData.id; // Substitui o ID pseudo-aleatório pelo ID real do Notion!
            tf.valorDiaria = isRoteiro ? valorDiariaPadrao : 0;
            tf.pago = false;
          } else {
            const errText = await response.text();
            console.error('Erro ao cadastrar evento na Agenda do Notion:', errText);
          }
        } catch (err) {
          console.error('Erro ao cadastrar card na Agenda do Notion:', err);
        }
      }
    }

    const todosEventos = [...eventosFiltrados, ...novasTarefas];

    // Gravar localmente no Supabase
    const { error: upsertErr } = await supabase.from('config').upsert({ id: 'calendario_eventos', data: todosEventos });
    if (upsertErr) throw upsertErr;

    res.json({ success: true, count: novasTarefas.length });
  } catch (error) {
    console.error('Erro ao sincronizar roteiro com calendário local:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── API: Dashboard Financeiro e Contas do Notion ─────────────────────────────

app.get('/api/notion/contas', async (req, res) => {
  try {
    const NOTION_CONTAS_DB_ID = '2bab6e48f954803bae65d962d2b529f5';
    const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_CONTAS_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro ao consultar base de contas: ${errText}`);
    }

    const data = await response.json();
    const contas = (data.results || [])
      .map(item => {
        const p = item.properties;
        return {
          id: item.id,
          nome: p['Nome']?.title?.map(t => t.plain_text).join('') || 'Sem Nome'
        };
      })
      .filter(c => !c.nome.toLowerCase().includes('wise da mocreia') && !c.nome.toLowerCase().includes('wise da mocréia'));

    res.json(contas);
  } catch (error) {
    console.error('Erro ao buscar contas no Notion:', error);
    res.status(500).json({ error: 'Erro ao buscar contas no Notion', details: error.message });
  }
});

app.post('/api/calendario/pagar-guia', async (req, res) => {
  try {
    const { eventoId, colaboradorId, clienteId, contaId, moeda, valorMoedaOriginal } = req.body;
    if (!eventoId || !colaboradorId || !clienteId || !contaId || !moeda || !valorMoedaOriginal) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes: eventoId, colaboradorId, clienteId, contaId, moeda, valorMoedaOriginal.' });
    }

    // 1. Obter evento local
    const { data: calCfg } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
    let eventos = [];
    if (calCfg && calCfg.data) {
      eventos = Array.isArray(calCfg.data) ? calCfg.data : [];
    }

    const evIndex = eventos.findIndex(e => e.id === eventoId);
    if (evIndex === -1) {
      return res.status(404).json({ error: 'Evento não encontrado no calendário.' });
    }

    const ev = eventos[evIndex];

    // Obter as taxas de câmbio da config do Supabase
    const { data: appConfig } = await supabase.from('config').select('data').eq('id', 'app_config').single();
    let rateBRL = 0.031670;
    let rateUSD = 0.006280;
    if (appConfig && appConfig.data) {
      rateBRL = parseFloat(appConfig.data.cambio_jpy_brl) || rateBRL;
      rateUSD = parseFloat(appConfig.data.cambio_jpy_usd) || rateUSD;
    }

    // 2. Calcular valor em JPY
    const valorOriginalNum = Number(valorMoedaOriginal) || 0;
    let valorJPY = valorOriginalNum;
    let descCambioText = '';

    if (moeda === 'BRL') {
      valorJPY = Math.round(valorOriginalNum / rateBRL);
      descCambioText = ` [Original: R$ ${valorOriginalNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Câmbio JPY/BRL: ${rateBRL.toFixed(6)}]`;
    } else if (moeda === 'USD') {
      valorJPY = Math.round(valorOriginalNum / rateUSD);
      descCambioText = ` [Original: $ ${valorOriginalNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Câmbio JPY/USD: ${rateUSD.toFixed(6)}]`;
    } else {
      descCambioText = ` [Original: ¥ ${valorOriginalNum.toLocaleString('en-US')} JPY]`;
    }

    // 3. Criar registro de Saída no Notion
    const NOTION_SAIDAS_DB_ID = process.env.NOTION_SAIDAS_DB_ID;
    
    const colabObj = ev.assignee ? ev.assignee.find(a => a.id === colaboradorId) : null;
    const colabName = colabObj ? colabObj.name : 'Colaborador';
    
    const descricaoSaida = `Pagamento Guia: ${colabName} - ${ev.titulo || 'Serviço'}${descCambioText}`;

    const properties = {
      'Descrição': { title: [{ text: { content: descricaoSaida } }] },
      'Valor (JPY)': { number: valorJPY },
      'Data de pagamento': { date: { start: ev.dataServico || new Date().toISOString().substring(0, 10) } },
      'Categoria': { select: { name: 'Pagamento Guia' } },
      'Tipo de serviço': { select: { name: 'guia' } },
      '🎀 Clientes': { relation: [{ id: clienteId }] },
      '🫂 Colaboradores': { relation: [{ id: colaboradorId }] },
      '💳 Contas': { relation: [{ id: contaId }] }
    };

    const notionRes = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_SAIDAS_DB_ID },
        properties
      })
    });

    if (!notionRes.ok) {
      const errTxt = await notionRes.text();
      throw new Error(`Erro ao criar Saída no Notion: ${errTxt}`);
    }

    const notionData = await notionRes.json();

    // 4. Atualizar evento local no Supabase
    if (!ev.pagoColab) ev.pagoColab = {};
    if (!ev.valorDiariaColab) ev.valorDiariaColab = {};

    ev.pagoColab[colaboradorId] = true;
    
    // Sempre mantemos a diária local em JPY (convertida se necessário)
    ev.valorDiariaColab[colaboradorId] = valorJPY;
    
    const primaryId = ev.assignee && ev.assignee.length > 0 ? ev.assignee[0].id : null;
    if (colaboradorId === primaryId) {
      ev.pago = true;
      ev.valorDiaria = valorJPY;
    }

    const { error: upsertErr } = await supabase.from('config').upsert({ id: 'calendario_eventos', data: eventos });
    if (upsertErr) throw upsertErr;

    res.json({ success: true, notionPageId: notionData.id, valorJPY });
  } catch (error) {
    console.error('Erro ao processar pagamento do guia no backend:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard/saldos-contas', async (req, res) => {
  try {
    const NOTION_CONTAS_DB_ID = '2bab6e48f954803bae65d962d2b529f5';
    const NOTION_ENTRADAS_DB_ID = process.env.NOTION_ENTRADAS_DB_ID;
    const NOTION_SAIDAS_DB_ID = process.env.NOTION_SAIDAS_DB_ID;

    // Função genérica para buscar todas as páginas de uma base do Notion (paginação)
    const queryAllNotion = async (dbId) => {
      let results = [];
      let hasMore = true;
      let startCursor = undefined;

      while (hasMore) {
        const body = {};
        if (startCursor) {
          body.start_cursor = startCursor;
        }

        const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Erro ao consultar base ${dbId} do Notion: ${errText}`);
        }

        const data = await response.json();
        results = results.concat(data.results || []);
        hasMore = data.has_more;
        startCursor = data.next_cursor;
      }

      return { results };
    };

    // Buscar contas
    const contasData = await queryAllNotion(NOTION_CONTAS_DB_ID);
    const contas = (contasData.results || [])
      .map(item => {
        const p = item.properties;
        return {
          id: item.id,
          nome: p['Nome']?.title?.map(t => t.plain_text).join('') || 'Sem Nome',
          saldoBRL: 0,
          saldoJPY: 0,
          saldoUSD: 0,
          movimentacoes: []
        };
      })
      .filter(c => !c.nome.toLowerCase().includes('wise da mocreia') && !c.nome.toLowerCase().includes('wise da mocréia'));

    const NOTION_COLABORADORES_DB_ID = process.env.NOTION_COLABORADORES_DB_ID || '2a0b6e48f954816082afde2815056602';

    const [entradasData, saidasData, clientesData, colaboradoresData, appConfig] = await Promise.all([
      queryAllNotion(NOTION_ENTRADAS_DB_ID),
      queryAllNotion(NOTION_SAIDAS_DB_ID),
      queryAllNotion(NOTION_CLIENTS_DB_ID),
      queryAllNotion(NOTION_COLABORADORES_DB_ID),
      supabase.from('config').select('data').eq('id', 'app_config').single()
    ]);

    // Construir mapas de ID -> Nome para Clientes e Colaboradores do Notion
    const clientesMap = {};
    (clientesData.results || []).forEach(item => {
      const p = item.properties;
      const nome = p['Nome']?.title?.map(t => t.plain_text).join('') || 'Sem Nome';
      clientesMap[item.id] = nome;
    });

    const colaboradoresMap = {};
    (colaboradoresData.results || []).forEach(item => {
      const p = item.properties;
      const nameProp = p.Name || p.Nome;
      const nome = nameProp?.title?.[0]?.plain_text || 'Sem Nome';
      colaboradoresMap[item.id] = nome;
    });

    let rateBRL = 0.031670;
    let rateUSD = 0.006280;
    if (appConfig && appConfig.data) {
      rateBRL = parseFloat(appConfig.data.cambio_jpy_brl) || rateBRL;
      rateUSD = parseFloat(appConfig.data.cambio_jpy_usd) || rateUSD;
    }

    const rates = { brl: rateBRL, usd: rateUSD };

    const extrairInfoVal = (descricao, valorJPY, moedaOriginal) => {
      const match = descricao && descricao.match(/\[Original:\s*([BRL|USD|JPY$¥]+)\s*([\d.,\s]+)/i);
      if (match) {
        const valStr = match[2].replace(/[.\s]/g, '').replace(',', '.');
        const parsedVal = parseFloat(valStr);
        if (!isNaN(parsedVal)) {
          const coinText = match[1].toUpperCase();
          let parsedMoeda = 'JPY';
          if (coinText.includes('R$') || coinText.includes('BRL')) parsedMoeda = 'BRL';
          else if (coinText.includes('$') || coinText.includes('USD')) parsedMoeda = 'USD';
          
          return { valor: parsedVal, moeda: parsedMoeda };
        }
      }

      if (moedaOriginal === 'BRL') return { valor: valorJPY * rates.brl, moeda: 'BRL' };
      if (moedaOriginal === 'USD') return { valor: valorJPY * rates.usd, moeda: 'USD' };
      return { valor: valorJPY, moeda: 'JPY' };
    };

    // Entradas
    (entradasData.results || []).forEach(item => {
      const p = item.properties;
      const valorJPY = p['Valor (JPY)']?.number || 0;
      const moedaOriginal = p['Moeda Original']?.select?.name || 'JPY';
      const descricao = p['Descrição da Entrada']?.title?.map(t => t.plain_text).join('') || 'Entrada sem nome';
      const data = p['Data do pagamento']?.date?.start || '';
      const contasRel = p['💳 Contas']?.relation || [];

      // Mapear Cliente
      const clienteRel = p['Cliente (Relação)']?.relation || [];
      const clienteId = clienteRel[0]?.id;
      const clienteNome = clienteId ? (clientesMap[clienteId] || 'Desconhecido') : '';

      const info = extrairInfoVal(descricao, valorJPY, moedaOriginal);

      contasRel.forEach(cRel => {
        const conta = contas.find(c => c.id === cRel.id);
        if (conta) {
          if (info.moeda === 'BRL') conta.saldoBRL += info.valor;
          else if (info.moeda === 'USD') conta.saldoUSD += info.valor;
          else conta.saldoJPY += info.valor;

          conta.movimentacoes.push({
            id: item.id,
            tipo: 'entrada',
            data,
            descricao,
            valorOriginal: info.valor,
            moedaOriginal: info.moeda,
            valorJPY,
            clienteNome,
            colaboradorNome: ''
          });
        }
      });
    });

    // Saídas
    (saidasData.results || []).forEach(item => {
      const p = item.properties;
      const valorJPY = p['Valor (JPY)']?.number || 0;
      const descricao = p['Descrição']?.title?.map(t => t.plain_text).join('') || 'Saída sem nome';
      const data = p['Data de pagamento']?.date?.start || '';
      const contasRel = p['💳 Contas']?.relation || [];

      // Mapear Cliente e Colaborador
      const clienteRel = p['🎀 Clientes']?.relation || [];
      const clienteId = clienteRel[0]?.id;
      const clienteNome = clienteId ? (clientesMap[clienteId] || 'Desconhecido') : '';

      const colabRel = p['🫂 Colaboradores']?.relation || [];
      const colabId = colabRel[0]?.id;
      const colaboradorNome = colabId ? (colaboradoresMap[colabId] || 'Desconhecido') : '';

      const info = extrairInfoVal(descricao, valorJPY, 'JPY');

      contasRel.forEach(cRel => {
        const conta = contas.find(c => c.id === cRel.id);
        if (conta) {
          if (info.moeda === 'BRL') conta.saldoBRL -= info.valor;
          else if (info.moeda === 'USD') conta.saldoUSD -= info.valor;
          else conta.saldoJPY -= info.valor;

          conta.movimentacoes.push({
            id: item.id,
            tipo: 'saida',
            data,
            descricao,
            valorOriginal: info.valor,
            moedaOriginal: info.moeda,
            valorJPY,
            clienteNome,
            colaboradorNome
          });
        }
      });
    });

    // Ordenar movimentações de cada conta por data descrescente
    contas.forEach(c => {
      c.movimentacoes.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    });

    res.json(contas);
  } catch (error) {
    console.error('Erro ao calcular saldos das contas:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard/notion-data/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const NOTION_TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;
    const NOTION_SAIDAS_DB_ID = process.env.NOTION_SAIDAS_DB_ID;
    const NOTION_ENTRADAS_DB_ID = process.env.NOTION_ENTRADAS_DB_ID;

    if (!NOTION_TOKEN || !NOTION_TASKS_DB_ID || !NOTION_SAIDAS_DB_ID || !NOTION_ENTRADAS_DB_ID) {
      return res.status(400).json({ error: 'Configuração do Notion incompleta no arquivo .env.' });
    }

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

    const [entradasData, saidasData, tasksData, calCfg] = await Promise.all([
      queryNotionDB(NOTION_ENTRADAS_DB_ID, 'Cliente (Relação)'),
      queryNotionDB(NOTION_SAIDAS_DB_ID, '🎀 Clientes'),
      queryNotionDB(NOTION_TASKS_DB_ID, '🎀 Clientes'),
      supabase.from('config').select('data').eq('id', 'calendario_eventos').single()
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

    // Processar Diárias dos Guias do Calendário Local
    let eventos = [];
    if (calCfg && calCfg.data && Array.isArray(calCfg.data)) {
      eventos = calCfg.data.filter(ev => ev.clienteId === clientId || (ev.clientes && ev.clientes.includes(clientId)));
    }

    let custoGuiasPago = 0;
    let custoGuiasPendente = 0;
    const guias = [];

    eventos.forEach(ev => {
      if (ev.assignee && ev.assignee.length > 0) {
        ev.assignee.forEach(colab => {
          const valor = ev.valorDiariaColab && ev.valorDiariaColab[colab.id] !== undefined
            ? Number(ev.valorDiariaColab[colab.id]) || 0
            : 0;
          const pago = ev.pagoColab && ev.pagoColab[colab.id] !== undefined
            ? !!ev.pagoColab[colab.id]
            : false;

          if (pago) {
            custoGuiasPago += valor;
          } else {
            custoGuiasPendente += valor;
          }

          guias.push({
            id: ev.id,
            dataServico: ev.dataServico,
            titulo: ev.titulo,
            colabId: colab.id,
            colabName: colab.name,
            valor,
            pago
          });
        });
      }
    });

    res.json({
      success: true,
      summary: {
        totalRecebido,
        totalDespesas,
        lucroReal: totalRecebido - totalDespesas - custoGuiasPago,
        totalTaxas,
        totalLucroProjetado,
        custoGuiasPago,
        custoGuiasPendente,
        custoGuiasTotal: custoGuiasPago + custoGuiasPendente,
        caixaAtual: totalRecebido - totalDespesas - custoGuiasPago
      },
      details: {
        entradas,
        saidas,
        tasks,
        guias
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
