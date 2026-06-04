const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'database.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helpers
function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// Auxiliar para sincronização em duas vias com o Google Sheets via Apps Script Web App
async function syncToGoogleSheets(type, action, data) {
  const db = readDB();
  const { sheets_script_url, sheets_aba_transportes, sheets_aba_experiencias, sheets_aba_atracoes } = db.config;
  if (!sheets_script_url) return; // Se não houver URL configurada, ignora silenciosamente

  let sheetName = '';
  if (type === 'transportes') sheetName = sheets_aba_transportes || 'Base';
  else if (type === 'experiencias') sheetName = sheets_aba_experiencias || 'BaseEX';
  else if (type === 'atracoes') sheetName = sheets_aba_atracoes || 'Atracoes';

  try {
    const payload = { action, type, sheetName, data };
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
app.get('/api/config', (req, res) => {
  const db = readDB();
  res.json(db.config);
});

app.post('/api/config', (req, res) => {
  const db = readDB();
  db.config = { ...db.config, ...req.body };
  writeDB(db);
  res.json({ ok: true });
});

// ── API: Transportes ────────────────────────────────────────────────────────
app.get('/api/transportes', (req, res) => {
  const db = readDB();
  res.json(db.transportes);
});

app.post('/api/transportes', (req, res) => {
  const db = readDB();
  const novo = { ...req.body, id: Date.now() };
  db.transportes.push(novo);
  writeDB(db);
  
  // Sincroniza em background
  syncToGoogleSheets('transportes', 'insert', novo);
  
  res.json(novo);
});

app.put('/api/transportes/:id', (req, res) => {
  const db = readDB();
  const idx = db.transportes.findIndex(t => t.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
  db.transportes[idx] = { ...db.transportes[idx], ...req.body };
  writeDB(db);
  
  // Sincroniza em background
  syncToGoogleSheets('transportes', 'update', db.transportes[idx]);
  
  res.json(db.transportes[idx]);
});

app.delete('/api/transportes/:id', (req, res) => {
  const db = readDB();
  const deletado = db.transportes.find(t => t.id == req.params.id);
  if (deletado) {
    syncToGoogleSheets('transportes', 'delete', deletado);
  }
  db.transportes = db.transportes.filter(t => t.id != req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// ── API: Experiências ───────────────────────────────────────────────────────
app.get('/api/experiencias', (req, res) => {
  const db = readDB();
  res.json(db.experiencias);
});

app.post('/api/experiencias', (req, res) => {
  const db = readDB();
  const novo = { ...req.body, id: Date.now() };
  db.experiencias.push(novo);
  writeDB(db);
  
  // Sincroniza em background
  syncToGoogleSheets('experiencias', 'insert', novo);
  
  res.json(novo);
});

app.put('/api/experiencias/:id', (req, res) => {
  const db = readDB();
  const idx = db.experiencias.findIndex(e => e.id == req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
  db.experiencias[idx] = { ...db.experiencias[idx], ...req.body };
  writeDB(db);
  
  // Sincroniza em background
  syncToGoogleSheets('experiencias', 'update', db.experiencias[idx]);
  
  res.json(db.experiencias[idx]);
});

app.delete('/api/experiencias/:id', (req, res) => {
  const db = readDB();
  const deletado = db.experiencias.find(e => e.id == req.params.id);
  if (deletado) {
    syncToGoogleSheets('experiencias', 'delete', deletado);
  }
  db.experiencias = db.experiencias.filter(e => e.id != req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

// ── API: Roteiros & Atrações ────────────────────────────────────────────────
app.get('/api/atracoes', (req, res) => {
  const db = readDB();
  res.json(db.atracoes || []);
});

app.post('/api/atracoes', (req, res) => {
  const db = readDB();
  if (!db.atracoes) db.atracoes = [];
  const novo = { ...req.body, id: Date.now() };
  db.atracoes.push(novo);
  writeDB(db);
  
  // Sincroniza em background
  syncToGoogleSheets('atracoes', 'insert', novo);
  
  res.json(novo);
});

app.put('/api/atracoes/:id', (req, res) => {
  const db = readDB();
  const idx = db.atracoes.findIndex(a => a.id == req.params.id || a['Nome da Atração'] === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Não encontrado' });
  db.atracoes[idx] = { ...db.atracoes[idx], ...req.body };
  writeDB(db);
  
  // Sincroniza em background
  syncToGoogleSheets('atracoes', 'update', db.atracoes[idx]);
  
  res.json(db.atracoes[idx]);
});

app.delete('/api/atracoes/:id', (req, res) => {
  const db = readDB();
  const deletado = db.atracoes.find(a => a.id == req.params.id || a['Nome da Atração'] === req.params.id);
  if (deletado) {
    syncToGoogleSheets('atracoes', 'delete', deletado);
  }
  db.atracoes = db.atracoes.filter(a => a.id != req.params.id && a['Nome da Atração'] !== req.params.id);
  writeDB(db);
  res.json({ ok: true });
});

app.get('/api/roteiros', (req, res) => {
  const db = readDB();
  res.json(db.rotas || {});
});

app.post('/api/roteiros/:name', (req, res) => {
  const db = readDB();
  if (!db.rotas) db.rotas = {};
  const name = req.params.name;
  db.rotas[name] = req.body; // Expects an array of days
  writeDB(db);
  res.json({ ok: true, name, roteiro: db.rotas[name] });
});

app.delete('/api/roteiros/:name', (req, res) => {
  const db = readDB();
  const name = req.params.name;
  if (db.rotas && db.rotas[name]) {
    delete db.rotas[name];
    writeDB(db);
  }
  res.json({ ok: true });
});


// ── API: Sync Google Sheets ─────────────────────────────────────────────────
app.post('/api/sync', async (req, res) => {
  const db = readDB();
  const { sheets_id, sheets_aba_transportes, sheets_aba_experiencias, sheets_aba_atracoes } = db.config;

  if (!sheets_id) {
    return res.status(400).json({ error: 'ID do Google Sheets não configurado nas Configurações.' });
  }

  const abaT = sheets_aba_transportes || 'Base';
  const abaE = sheets_aba_experiencias || 'BaseEX';
  const abaA = sheets_aba_atracoes || 'Atracoes';

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

      // Procura a linha de cabeçalho (primeira célula = "Trecho")
      let headerIdx = -1;
      for (let i = 0; i < rows.length; i++) {
        if (cellVal(rows[i].c?.[0]).toLowerCase() === 'trecho') { headerIdx = i; break; }
      }
      const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;

      const transportes = dataRows
        .map((r, i) => {
          const c = r.c || [];
          const trecho = cellVal(c[0]);
          if (!trecho) return null;
          return {
            id: i + 1,
            trecho,
            tipo:       cellVal(c[1]),
            linha:      cellVal(c[2]),
            categoria:  cellVal(c[3]),
            preco_jpy:  cellNum(c[4]),
            tempo:      cellVal(c[5]),
            observacao: cellVal(c[6]),
            link:       cellVal(c[7])
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
            id: i + 1,
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
              id: i + 1,
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
      const table = await fetchAba('Rotas');
      const rows = table.rows || [];
      let diasImportados = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row.c) continue;
        const cidade = cellVal(row.c[0]);
        const nomeDaRota = cellVal(row.c[1]);
        const atracoesRaw = cellVal(row.c[2]);
        if (cidade && nomeDaRota) {
          diasImportados.push({ 
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
    writeDB(db);
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
