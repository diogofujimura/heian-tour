/* ============================================================================
   HEIAN TOUR — PAINEL DE PROVISÕES / COMPRAS (camada nova, não-destrutiva)
   Quando o cliente está na etapa "Compras", lê roteiro + cotação, separa tudo
   que a Heian precisa comprar/reservar e mostra no Dashboard ordenado por
   urgência (janela que abre + prazo limite). A lista é DERIVADA ao vivo;
   só o estado "feito" é salvo (Supabase config/provisoes_status).
   Regras de prazo editáveis pelo usuário (config/provisoes_regras).
   Tudo em try/catch: se algo falhar aqui, o resto do app continua funcionando.
   ========================================================================== */
(function () {
  'use strict';

  // Regras-padrão de fábrica por tipo (base; o usuário ajusta em "⚙ Regras de prazo").
  var TIPO_DEFAULTS = {
    shinkansen:  { acao: 'Comprar',  janelaAbreDias: 30,   prazoDias: 25, notion: 'Shinkansen' },
    trem:        { acao: 'Comprar',  janelaAbreDias: null, prazoDias: 7,  notion: 'Trem' },
    onibus:      { acao: 'Comprar',  janelaAbreDias: 60,   prazoDias: 14, notion: 'ônibus' },
    transfer:    { acao: 'Reservar', janelaAbreDias: null, prazoDias: 7,  notion: 'Transfer' },
    experiencia: { acao: 'Reservar', janelaAbreDias: null, prazoDias: 10, notion: 'Experiência' },
    atracao:     { acao: 'Reservar', janelaAbreDias: null, prazoDias: 14, notion: 'Experiência' },
    restaurante: { acao: 'Reservar', janelaAbreDias: null, prazoDias: 7,  notion: 'Reserva de restaurante' }
  };
  var URG = { urgente: 3, breve: 7 };  // limites em dias até o prazo

  // REGRAS = regras efetivas em uso (defaults de fábrica + ajustes salvos pelo usuário).
  var REGRAS = JSON.parse(JSON.stringify(TIPO_DEFAULTS));
  var TIPO_LABEL = {
    shinkansen: 'Shinkansen', trem: 'Trem', onibus: 'Ônibus', transfer: 'Transfer',
    experiencia: 'Experiência', atracao: 'Reserva de atração', restaurante: 'Restaurante'
  };
  var TIPO_ORDEM = ['shinkansen', 'trem', 'onibus', 'transfer', 'experiencia', 'atracao', 'restaurante'];

  // ---------- utilidades de data ----------
  function normalizeDate(s) {
    if (!s) return null;
    s = String(s).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return m[3] + '-' + m[2] + '-' + m[1];
    return null;
  }
  function toUTC(dStr) {
    var d = normalizeDate(dStr); if (!d) return null;
    var p = d.split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }
  function daysBetween(aStr, bStr) { // bStr - aStr em dias inteiros
    var a = toUTC(aStr), b = toUTC(bStr);
    if (a == null || b == null) return null;
    return Math.round((b - a) / 86400000);
  }
  function addDays(dStr, n) {
    var u = toUTC(dStr); if (u == null) return null;
    var d = new Date(u - n * 86400000);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }
  function hojeStr() {
    var h = new Date();
    return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0');
  }
  function fmtBR(dStr) {
    var d = normalizeDate(dStr); if (!d) return '—';
    var p = d.split('-'); return p[2] + '/' + p[1] + '/' + p[0];
  }
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }

  // ---------- detecção de subtipo de transporte ----------
  function detectTipoTransporte(str) {
    var s = norm(str);
    if (!s) return null;
    if (s.indexOf('shinkansen') >= 0) return 'shinkansen';
    if (s.indexOf('transfer') >= 0 || s.indexOf('privativ') >= 0 || s.indexOf('privad') >= 0 || s.indexOf('translado') >= 0 || s.indexOf('carro') >= 0 || s.indexOf(' van') >= 0 || s.indexOf('taxi') >= 0 || s.indexOf('motorista') >= 0) return 'transfer';
    if (s.indexOf('onibus') >= 0 || s.indexOf('bus') >= 0 || s.indexOf('highway') >= 0) return 'onibus';
    if (s.indexOf('trem') >= 0 || s.indexOf('train') >= 0 || s.indexOf('metro') >= 0 || s.indexOf('romancecar') >= 0 || s.indexOf('express') >= 0 || s.indexOf('linha') >= 0 || s.indexOf('jr ') >= 0) return 'trem';
    return null;
  }

  // ---------- resolução da regra (regra efetiva + override por item da base) ----------
  function resolverRegra(categoria, subtipo, baseItem) {
    var key = categoria === 'transporte' ? (subtipo || 'transfer') : categoria;
    var def = REGRAS[key] || REGRAS.transfer;
    var regra = { acao: def.acao, janelaAbreDias: def.janelaAbreDias, prazoDias: def.prazoDias, notion: def.notion, semRegra: false };
    if (baseItem) {
      if (baseItem.acao) regra.acao = baseItem.acao;
      if (baseItem.janelaAbreDias !== undefined && baseItem.janelaAbreDias !== null && baseItem.janelaAbreDias !== '') regra.janelaAbreDias = num(baseItem.janelaAbreDias);
      if (baseItem.prazoDias !== undefined && baseItem.prazoDias !== null && baseItem.prazoDias !== '') regra.prazoDias = num(baseItem.prazoDias);
    }
    return regra;
  }

  // ---------- cálculo de urgência ----------
  function calcularUrgencia(hoje, dataServico, regra) {
    var dt = normalizeDate(dataServico);
    if (!dt) return { estado: 'revisar', motivo: 'sem data de serviço' };
    var prazo = regra.prazoDias != null ? addDays(dt, regra.prazoDias) : dt;
    var abre = regra.janelaAbreDias != null ? addDays(dt, regra.janelaAbreDias) : null;
    var diasPrazo = daysBetween(hoje, prazo);
    var diasAbre = abre ? daysBetween(hoje, abre) : null;
    var out = { deadline: prazo, abre: abre, diasPrazo: diasPrazo, abreEmDias: diasAbre };
    if (abre && diasAbre != null && diasAbre > 0) { out.estado = 'aguardando'; return out; }
    if (diasPrazo == null) { out.estado = 'revisar'; return out; }
    if (diasPrazo < 0) out.estado = 'atrasado';
    else if (diasPrazo <= URG.urgente) out.estado = 'urgente';
    else if (diasPrazo <= URG.breve) out.estado = 'breve';
    else out.estado = 'programado';
    return out;
  }

  // ---------- extração de tarefas (roteiro + cotação, dedup) ----------
  function findById(list, id) {
    if (!list || id == null) return null;
    for (var i = 0; i < list.length; i++) { if (String(list[i].id) === String(id)) return list[i]; }
    return null;
  }
  function findAtracaoByName(list, nome) {
    if (!list || !nome) return null;
    var n = norm(nome);
    for (var i = 0; i < list.length; i++) {
      var an = norm(list[i]['Nome da Atração'] || list[i].nome || list[i].nomeAtracao);
      if (an && (an === n || an.indexOf(n) >= 0 || n.indexOf(an) >= 0)) return list[i];
    }
    return null;
  }
  function chaveTarefa(t) {
    return [t.clienteId || '', t.categoria, t.subtipo || '', norm(t.ident), normalizeDate(t.data) || ''].join('|');
  }

  function extrairTarefas(cliente, roteiros, orcamentos, bases) {
    var tasksMap = {};
    var clienteId = cliente.id, clienteNome = cliente.nome || 'Sem nome';
    var paxCliente = num(cliente.adultos) + num(cliente.criancas);
    bases = bases || {};

    // 1. Processar Roteiros
    (roteiros || []).forEach(function (rot) {
      (rot.dias || []).forEach(function (dia) {
        var data = normalizeDate(dia.data);
        (dia.elementos || []).forEach(function (el) {
          if (el.tipo === 'transporte' && (el.tipoTransporte || el.trechoId || el.cidadeOrigem)) {
            var baseT = el.trechoId && el.trechoId !== 'custom' ? findById(bases.transportes, el.trechoId) : null;
            var subtipo = (baseT && baseT.tipo ? detectTipoTransporte(baseT.tipo) : null) || detectTipoTransporte(el.tipoTransporte || el.linha) || 'transfer';
            var nome = el.cidadeDestino ? ((el.cidadeOrigem || '?') + ' → ' + el.cidadeDestino) : (el.tipoTransporte || 'Deslocamento');
            var regra = resolverRegra('transporte', subtipo, baseT);
            var refId = el.refId;
            var key = refId ? ('ref:' + refId) : ('tr:' + clienteId + ':' + (data || '') + ':' + norm(nome).replace(/[^a-z0-9]/g, ''));
            tasksMap[key] = {
              key: key, refId: refId, categoria: 'transporte', subtipo: subtipo,
              ident: nome, titulo: nome, data: data,
              pessoas: (num(el.adultos) + num(el.criancas)) || paxCliente,
              regra: regra, compradoHeian: el.compradoHeian !== false, origem: 'roteiro'
            };
          } else if (el.tipo === 'experiencia' && (el.nomeExp || el.expId)) {
            var baseE = el.expId ? findById(bases.experiencias, el.expId) : null;
            var nomeE = el.nomeExp || (baseE && baseE.nome) || 'Experiência';
            var refId = el.refId;
            var key = refId ? ('ref:' + refId) : ('exp:' + clienteId + ':' + (data || '') + ':' + norm(nomeE).replace(/[^a-z0-9]/g, ''));
            tasksMap[key] = {
              key: key, refId: refId, categoria: 'experiencia', subtipo: '',
              ident: nomeE, titulo: nomeE, data: data,
              pessoas: (num(el.adultos) + num(el.criancas)) || paxCliente,
              regra: resolverRegra('experiencia', '', baseE), compradoHeian: el.compradoHeian !== false, origem: 'roteiro'
            };
          } else if (el.tipo === 'sequencia' && Array.isArray(el.atracoesDoDia)) {
            el.atracoesDoDia.forEach(function (nomeA) {
              var baseA = findAtracaoByName(bases.atracoes, nomeA);
              if (baseA && (baseA.precisaReserva === true || baseA.precisaReserva === 'sim')) {
                var key = 'atr:' + clienteId + ':' + (data || '') + ':' + norm(nomeA).replace(/[^a-z0-9]/g, '');
                tasksMap[key] = {
                  key: key, categoria: 'atracao', subtipo: '',
                  ident: nomeA, titulo: nomeA, data: data, pessoas: paxCliente,
                  regra: resolverRegra('atracao', '', baseA), compradoHeian: true, origem: 'roteiro'
                };
              }
            });
          }
        });
      });
    });

    // 2. Processar Cotações (Enriquecer/Desduplicar com Roteiro)
    (orcamentos || []).forEach(function (orc) {
      (orc.transportes || []).forEach(function (tr) {
        var refId = tr._roteiroRefId;
        var key = refId ? ('ref:' + refId) : null;
        var data = normalizeDate(tr.data);

        if (!key) {
          var descClean = norm(tr.descricao).replace(/[^a-z0-9]/g, '');
          Object.keys(tasksMap).forEach(function (k) {
            var item = tasksMap[k];
            if (item.categoria === 'transporte' && item.data === data) {
              var identClean = norm(item.ident).replace(/[^a-z0-9]/g, '');
              if (descClean.indexOf(identClean) >= 0 || identClean.indexOf(descClean) >= 0) {
                key = k;
              }
            }
          });
        }

        if (key && tasksMap[key]) {
          if (tr.descricao && tr.descricao.length > tasksMap[key].titulo.length) {
            tasksMap[key].titulo = tr.descricao;
          }
          var subtipo = detectTipoTransporte(tr.descricao) || tasksMap[key].subtipo;
          tasksMap[key].subtipo = subtipo;
          tasksMap[key].regra = resolverRegra('transporte', subtipo, null);
          if (tr.compradoHeian === false) tasksMap[key].compradoHeian = false;
        } else if (tr.compradoHeian !== false) {
          var subtipo = detectTipoTransporte(tr.descricao) || 'transfer';
          var nome = tr.descricao || 'Transporte';
          key = key || ('cot_tr:' + (tr.id || Math.random()));
          tasksMap[key] = {
            key: key, refId: refId, categoria: 'transporte', subtipo: subtipo,
            ident: nome, titulo: nome, data: data,
            pessoas: (num(tr.adultos) + num(tr.criancas)) || paxCliente,
            regra: resolverRegra('transporte', subtipo, null), compradoHeian: true, origem: 'cotacao'
          };
        }
      });

      (orc.experiencias || []).forEach(function (ex) {
        var refId = ex._roteiroRefId;
        var key = refId ? ('ref:' + refId) : null;
        var data = normalizeDate(ex.data);
        var nome = ex.nome || ex.descricao || 'Experiência';

        if (!key) {
          var descClean = norm(nome).replace(/[^a-z0-9]/g, '');
          Object.keys(tasksMap).forEach(function (k) {
            var item = tasksMap[k];
            if (item.categoria === 'experiencia' && item.data === data) {
              var identClean = norm(item.ident).replace(/[^a-z0-9]/g, '');
              if (descClean.indexOf(identClean) >= 0 || identClean.indexOf(descClean) >= 0) {
                key = k;
              }
            }
          });
        }

        if (key && tasksMap[key]) {
          if (nome && nome.length > tasksMap[key].titulo.length) tasksMap[key].titulo = nome;
          if (ex.compradoHeian === false) tasksMap[key].compradoHeian = false;
        } else if (ex.compradoHeian !== false) {
          key = key || ('cot_ex:' + (ex.id || Math.random()));
          tasksMap[key] = {
            key: key, refId: refId, categoria: 'experiencia', subtipo: '',
            ident: nome, titulo: nome, data: data,
            pessoas: num(ex.pessoas) || paxCliente,
            regra: resolverRegra('experiencia', '', null), compradoHeian: true, origem: 'cotacao'
          };
        }
      });

      (orc.itensAdicionais || []).forEach(function (it) {
        var n = norm(it.nome);
        if (n.indexOf('restaurante') >= 0 || n.indexOf('reserva') >= 0 || n.indexOf('jantar') >= 0 || n.indexOf('almoco') >= 0) {
          var key = 'cot_it:' + (it.id || Math.random());
          tasksMap[key] = {
            key: key, categoria: 'restaurante', subtipo: '',
            ident: it.nome, titulo: it.nome, data: normalizeDate(it.data),
            pessoas: paxCliente, regra: resolverRegra('restaurante', '', null), compradoHeian: true, origem: 'cotacao'
          };
        }
      });
    });

    var outTasks = [];
    Object.keys(tasksMap).forEach(function (k) {
      var t = tasksMap[k];
      if (t.compradoHeian !== false) {
        t.clienteId = clienteId;
        t.clienteNome = clienteNome;
        t.chave = [clienteId, t.categoria, t.subtipo || '', norm(t.ident), t.data || ''].join('|');
        outTasks.push(t);
      }
    });

    return outTasks;
  }

  // ===================== DADOS / CACHE =====================
  function clienteIdsDe(rotOuOrc) {
    var d = rotOuOrc || {};
    var ids = [];
    if (d.notionClienteId) ids.push(String(d.notionClienteId));
    if (d.cliente && d.cliente.notionClienteId) ids.push(String(d.cliente.notionClienteId));
    return ids;
  }
  function nomeDe(rotOuOrc) {
    var d = rotOuOrc || {};
    return norm((d.cliente && d.cliente.nome) || d.nomeCliente || '').replace('familia ', '');
  }
  function casa(cliente, rotOuOrc) {
    if (!rotOuOrc) return false;
    var ids = clienteIdsDe(rotOuOrc);
    if (cliente.id && ids.indexOf(String(cliente.id)) >= 0) return true;
    var cn = norm(cliente.nome).replace('familia ', '');
    var rn = nomeDe(rotOuOrc);
    if (cn && rn && (cn === rn || cn.indexOf(rn) >= 0 || rn.indexOf(cn) >= 0)) return true;
    return false;
  }

  async function carregarDados() {
    var out = { clientes: [], roteiros: [], orcamentos: [], bases: {} };
    async function getJSON(url) { try { var r = await fetch(url); return r.ok ? await r.json() : null; } catch (e) { return null; } }
    var clientes = window.notionClients;
    if (!clientes || !clientes.length) clientes = (await getJSON('/api/notion/clientes?t=' + Date.now())) || [];
    out.clientes = clientes;
    var rotMap = (await getJSON('/api/roteiros')) || {};
    out.roteiros = Object.keys(rotMap).map(function (k) { var v = rotMap[k] || {}; v.__nome = k; return v; });
    out.orcamentos = (await getJSON('/api/orcamentos')) || [];
    out.bases.transportes = window.dbTransportesCache || (await getJSON('/api/transportes')) || [];
    out.bases.experiencias = window.dbExperienciasCache || (await getJSON('/api/experiencias')) || [];
    out.bases.atracoes = (window.state && window.state.atracoesDB) || window.dbAtracoes || (await getJSON('/api/atracoes')) || [];
    return out;
  }

  // estado "feito"
  var statusCache = null;
  async function carregarStatus() {
    if (statusCache) return statusCache;
    try { var r = await fetch('/api/config/provisoes_status'); var j = r.ok ? await r.json() : {}; statusCache = (j && typeof j === 'object' && !Array.isArray(j)) ? j : {}; }
    catch (e) { statusCache = {}; }
    return statusCache;
  }
  async function salvarStatus() {
    try { await fetch('/api/config/provisoes_status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(statusCache || {}) }); } catch (e) {}
  }

  // ---- regras editáveis (config/provisoes_regras) ----
  var regrasLoaded = false;
  function aplicarRegras(j) {
    if (!j || typeof j !== 'object') return;
    if (j.tipos) {
      Object.keys(REGRAS).forEach(function (k) {
        var s = j.tipos[k]; if (!s) return;
        if (s.acao) REGRAS[k].acao = s.acao;
        if ('janelaAbreDias' in s) REGRAS[k].janelaAbreDias = (s.janelaAbreDias === '' || s.janelaAbreDias == null) ? null : num(s.janelaAbreDias);
        if ('prazoDias' in s) REGRAS[k].prazoDias = (s.prazoDias === '' || s.prazoDias == null) ? null : num(s.prazoDias);
      });
    }
    if (j.urg) {
      if (j.urg.urgente != null && j.urg.urgente !== '') URG.urgente = num(j.urg.urgente);
      if (j.urg.breve != null && j.urg.breve !== '') URG.breve = num(j.urg.breve);
    }
  }
  async function carregarRegras() {
    if (regrasLoaded) return;
    regrasLoaded = true;
    try { var r = await fetch('/api/config/provisoes_regras'); var j = r.ok ? await r.json() : null; aplicarRegras(j); } catch (e) {}
  }
  async function salvarRegras() {
    var payload = { tipos: {}, urg: { urgente: URG.urgente, breve: URG.breve } };
    Object.keys(REGRAS).forEach(function (k) {
      payload.tipos[k] = { acao: REGRAS[k].acao, janelaAbreDias: REGRAS[k].janelaAbreDias, prazoDias: REGRAS[k].prazoDias };
    });
    try { await fetch('/api/config/provisoes_regras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch (e) {}
  }

  // ===================== RENDER =====================
  var EST = {
    atrasado:    { label: 'Atrasado',          cor: '#dc2626', bg: 'rgba(220,38,38,0.07)',  ord: 0 },
    urgente:     { label: 'Urgente',           cor: '#ea580c', bg: 'rgba(234,88,12,0.07)',  ord: 1 },
    revisar:     { label: 'Revisar',           cor: '#7c3aed', bg: 'rgba(124,58,237,0.07)', ord: 2 },
    breve:       { label: 'Em breve',          cor: '#ca8a04', bg: 'rgba(202,138,4,0.07)',  ord: 3 },
    programado:  { label: 'Programado',        cor: '#16a34a', bg: 'rgba(22,163,74,0.06)',  ord: 4 },
    aguardando:  { label: 'Aguardando janela', cor: '#64748b', bg: 'rgba(100,116,139,0.06)',ord: 5 }
  };

  function ensureCard() {
    var card = document.getElementById('provisoesCard');
    if (card) return card;
    // Âncora: logo após a Agenda Operacional, no Painel Geral
    // (antes ancorava no kanban, que agora vive na página Clientes)
    var agenda = document.querySelector('#dashboardGeralContainer .dashboard-agenda-card');
    var kan = agenda || document.querySelector('.dashboard-kanban-card');
    if (!kan || !kan.parentNode) return null;
    card = document.createElement('div');
    card.className = 'dashboard-provisoes-card';
    card.id = 'provisoesCard';
    card.style.cssText = 'background:var(--warm-white);padding:24px;border-radius:8px;border:1px solid var(--border);box-shadow:var(--shadow);margin-top:30px;';
    card.innerHTML =
      '<h3 style="font-size:16px;color:var(--crimson);font-weight:700;margin-bottom:6px;border-bottom:2px solid rgba(107,31,42,0.1);padding-bottom:8px;display:flex;align-items:center;gap:8px">' +
      '<svg class="v-icon" style="stroke:var(--crimson);"><use href="#icon-ticket"></use></svg> <span>Provisões — Compras da Heian</span>' +
      '<button type="button" id="provisoesRegrasBtn" style="margin-left:auto;cursor:pointer;border:1px solid var(--border);background:#fff;color:var(--ink-mid);border-radius:8px;font-size:12px;font-weight:600;padding:5px 11px;">⚙ Regras de prazo</button></h3>' +
      '<p style="font-size:12px;color:var(--ink-lt);margin:4px 0 16px;">Tudo que precisa ser comprado / reservado para os clientes na etapa <strong>Compras</strong>, por urgência.</p>' +
      '<div id="provisoesRegras" style="display:none;"></div>' +
      '<div id="provisoesBody"><p style="color:var(--ink-lt);font-size:12px;font-style:italic;">Carregando provisões…</p></div>';
    if (agenda) kan.parentNode.insertBefore(card, kan.nextSibling);
    else kan.parentNode.insertBefore(card, kan);
    var btn = card.querySelector('#provisoesRegrasBtn');
    if (btn) btn.addEventListener('click', toggleEditorRegras);
    return card;
  }

  function toggleEditorRegras() {
    var box = document.getElementById('provisoesRegras');
    if (!box) return;
    if (box.style.display === 'none' || !box.style.display) { renderEditorRegras(box); box.style.display = 'block'; }
    else { box.style.display = 'none'; }
  }

  function renderEditorRegras(box) {
    var linhas = TIPO_ORDEM.map(function (k) {
      var r = REGRAS[k];
      return '<tr style="border-bottom:1px solid var(--border);">' +
        '<td style="padding:6px 8px;font-size:12px;font-weight:600;color:var(--ink);">' + esc(TIPO_LABEL[k]) + '</td>' +
        '<td style="padding:6px 8px;"><select data-tipo="' + k + '" data-f="acao" style="font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;">' +
        '<option value="Comprar"' + (r.acao === 'Comprar' ? ' selected' : '') + '>Comprar</option>' +
        '<option value="Reservar"' + (r.acao === 'Reservar' ? ' selected' : '') + '>Reservar</option></select></td>' +
        '<td style="padding:6px 8px;"><input type="number" min="0" data-tipo="' + k + '" data-f="janelaAbreDias" value="' + (r.janelaAbreDias == null ? '' : r.janelaAbreDias) + '" placeholder="—" style="width:64px;font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;"></td>' +
        '<td style="padding:6px 8px;"><input type="number" min="0" data-tipo="' + k + '" data-f="prazoDias" value="' + (r.prazoDias == null ? '' : r.prazoDias) + '" style="width:64px;font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;"></td>' +
        '</tr>';
    }).join('');

    box.innerHTML =
      '<div style="background:rgba(0,0,0,0.02);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:16px;">' +
      '<div style="font-size:12px;color:var(--ink-mid);margin-bottom:10px;">' +
      '<strong>Abre (dias):</strong> a partir de quantos dias antes a compra <em>pode</em> ser feita (ex.: Shinkansen 30). Deixe vazio se não há janela. ' +
      '<strong>Prazo (dias):</strong> até quantos dias antes <em>tem</em> que estar feito (ex.: Shibuya Sky 14).</div>' +
      '<table style="width:100%;border-collapse:collapse;">' +
      '<thead><tr style="text-align:left;color:var(--ink-lt);font-size:11px;text-transform:uppercase;letter-spacing:0.03em;">' +
      '<th style="padding:4px 8px;">Tipo</th><th style="padding:4px 8px;">Ação</th><th style="padding:4px 8px;">Abre (dias)</th><th style="padding:4px 8px;">Prazo (dias)</th></tr></thead>' +
      '<tbody>' + linhas + '</tbody></table>' +
      '<div style="display:flex;align-items:center;gap:14px;margin-top:14px;padding-top:12px;border-top:1px dashed var(--border);font-size:12px;color:var(--ink-mid);flex-wrap:wrap;">' +
      '<span><strong>Urgente</strong> quando faltam até <input type="number" min="0" id="urgUrgente" value="' + URG.urgente + '" style="width:52px;font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;"> dias</span>' +
      '<span><strong>Em breve</strong> quando faltam até <input type="number" min="0" id="urgBreve" value="' + URG.breve + '" style="width:52px;font-size:12px;padding:4px 6px;border:1px solid var(--border);border-radius:6px;"> dias</span>' +
      '</div>' +
      '<div style="display:flex;gap:10px;margin-top:14px;">' +
      '<button type="button" id="provRegrasSalvar" style="cursor:pointer;border:none;background:var(--crimson);color:#fff;border-radius:8px;font-size:12px;font-weight:700;padding:8px 16px;">Salvar regras</button>' +
      '<button type="button" id="provRegrasFechar" style="cursor:pointer;border:1px solid var(--border);background:#fff;color:var(--ink-mid);border-radius:8px;font-size:12px;font-weight:600;padding:8px 16px;">Fechar</button>' +
      '</div></div>';

    box.querySelector('#provRegrasFechar').addEventListener('click', function () { box.style.display = 'none'; });
    box.querySelector('#provRegrasSalvar').addEventListener('click', function () {
      Array.prototype.forEach.call(box.querySelectorAll('[data-tipo]'), function (inp) {
        var k = inp.getAttribute('data-tipo'), f = inp.getAttribute('data-f');
        if (!REGRAS[k]) return;
        if (f === 'acao') REGRAS[k].acao = inp.value;
        else { var v = inp.value.trim(); REGRAS[k][f] = (v === '') ? null : num(v); }
      });
      var uU = box.querySelector('#urgUrgente'), uB = box.querySelector('#urgBreve');
      if (uU && uU.value.trim() !== '') URG.urgente = num(uU.value);
      if (uB && uB.value.trim() !== '') URG.breve = num(uB.value);
      salvarRegras();
      box.style.display = 'none';
      renderPainelProvisoes();
    });
  }

  function cardTarefaHTML(t, feito) {
    var e = EST[t.urg.estado] || EST.programado;
    var quando;
    if (t.urg.estado === 'aguardando') quando = 'Abre em ' + t.urg.abreEmDias + ' dia' + (t.urg.abreEmDias > 1 ? 's' : '');
    else if (t.urg.estado === 'revisar') quando = t.urg.motivo ? t.urg.motivo : 'sem prazo definido';
    else if (t.urg.diasPrazo < 0) quando = 'Atrasado ' + Math.abs(t.urg.diasPrazo) + ' dia' + (Math.abs(t.urg.diasPrazo) > 1 ? 's' : '');
    else if (t.urg.diasPrazo === 0) quando = 'Prazo é HOJE';
    else quando = 'Faltam ' + t.urg.diasPrazo + ' dia' + (t.urg.diasPrazo > 1 ? 's' : '') + ' pro prazo';

    var pax = t.pessoas ? (t.pessoas + ' pax') : '';
    var prazoData = t.urg.deadline ? ('prazo ' + fmtBR(t.urg.deadline)) : '';
    var meta = ['Serviço ' + fmtBR(t.data), prazoData, pax].filter(Boolean).join(' · ');

    return '' +
      '<div class="prov-task" data-chave="' + esc(t.chave) + '" style="display:flex;align-items:flex-start;gap:10px;padding:11px 13px;border:1px solid var(--border);border-left:4px solid ' + e.cor + ';border-radius:7px;background:' + (feito ? 'rgba(0,0,0,0.02)' : '#fff') + ';' + (feito ? 'opacity:0.55;' : '') + '">' +
      '<input type="checkbox" class="prov-check" ' + (feito ? 'checked' : '') + ' style="margin-top:3px;cursor:pointer;width:16px;height:16px;flex-shrink:0;" title="Marcar como feito">' +
      '<div style="flex:1;min-width:0;">' +
      '<div style="font-size:13px;font-weight:700;color:var(--ink);' + (feito ? 'text-decoration:line-through;' : '') + '">' +
      '<span style="display:inline-block;font-size:10px;font-weight:700;color:' + e.cor + ';background:' + e.bg + ';border:1px solid ' + e.cor + '33;border-radius:5px;padding:1px 6px;margin-right:7px;vertical-align:middle;">' + esc(t.regra.acao) + '</span>' +
      esc(t.titulo) + '</div>' +
      '<div style="font-size:11px;color:var(--ink-lt);margin-top:3px;">' + esc(t.clienteNome) + ' &nbsp;·&nbsp; ' + esc(meta) + '</div>' +
      '</div>' +
      '<div style="font-size:10px;font-weight:700;color:' + e.cor + ';white-space:nowrap;flex-shrink:0;text-align:right;">' + esc(quando) + '</div>' +
      '</div>';
  }

  function pintarPainel(tasks, status) {
    var body = document.getElementById('provisoesBody');
    if (!body) return;
    var hoje = hojeStr();
    tasks.forEach(function (t) { t.urg = calcularUrgencia(hoje, t.data, t.regra); });

    var pendentes = tasks.filter(function (t) { return !(status[t.chave] && status[t.chave].feito); });
    var feitas = tasks.filter(function (t) { return status[t.chave] && status[t.chave].feito; });

    if (!tasks.length) {
      body.innerHTML = '<p style="color:var(--ink-lt);font-size:12px;font-style:italic;padding:6px 0;">Nenhum cliente na etapa <strong>Compras</strong> com itens a provisionar. Mova um cliente para "Compras" no Quadro abaixo.</p>';
      return;
    }

    pendentes.sort(function (a, b) {
      var oa = (EST[a.urg.estado] || EST.programado).ord, ob = (EST[b.urg.estado] || EST.programado).ord;
      if (oa !== ob) return oa - ob;
      var da = a.urg.diasPrazo == null ? 99999 : a.urg.diasPrazo, db = b.urg.diasPrazo == null ? 99999 : b.urg.diasPrazo;
      return da - db;
    });

    var grupos = {};
    pendentes.forEach(function (t) { (grupos[t.urg.estado] = grupos[t.urg.estado] || []).push(t); });

    var html = '';
    Object.keys(EST).sort(function (a, b) { return EST[a].ord - EST[b].ord; }).forEach(function (estado) {
      var arr = grupos[estado]; if (!arr || !arr.length) return;
      var e = EST[estado];
      html += '<div style="margin:14px 0 6px;display:flex;align-items:center;gap:8px;">' +
        '<span style="width:9px;height:9px;border-radius:50%;background:' + e.cor + ';"></span>' +
        '<span style="font-size:12px;font-weight:700;color:' + e.cor + ';text-transform:uppercase;letter-spacing:0.04em;">' + e.label + '</span>' +
        '<span style="font-size:11px;color:var(--ink-lt);">(' + arr.length + ')</span></div>';
      html += '<div style="display:flex;flex-direction:column;gap:7px;">';
      arr.forEach(function (t) { html += cardTarefaHTML(t, false); });
      html += '</div>';
    });

    if (feitas.length) {
      html += '<details style="margin-top:18px;"><summary style="cursor:pointer;font-size:12px;color:var(--ink-lt);font-weight:600;">Concluídas (' + feitas.length + ')</summary>' +
        '<div style="display:flex;flex-direction:column;gap:7px;margin-top:8px;">';
      feitas.forEach(function (t) { html += cardTarefaHTML(t, true); });
      html += '</div></details>';
    }

    body.innerHTML = html;

    Array.prototype.forEach.call(body.querySelectorAll('.prov-task'), function (row) {
      var chave = row.getAttribute('data-chave');
      var cb = row.querySelector('.prov-check');
      if (!cb) return;
      cb.addEventListener('change', function () {
        if (!statusCache) statusCache = {};
        if (cb.checked) statusCache[chave] = { feito: true, quando: hojeStr() };
        else delete statusCache[chave];
        salvarStatus();
        pintarPainel(tasks, statusCache);
      });
    });
  }

  var _rendering = false;
  async function renderPainelProvisoes() {
    try {
      if (_rendering) return; _rendering = true;
      var card = ensureCard();
      if (!card) { _rendering = false; return; }
      await carregarRegras();
      var dados = await carregarDados();
      var status = await carregarStatus();
      var emCompras = (dados.clientes || []).filter(function (c) { return norm(c.status) === 'compras'; });
      var todas = [];
      emCompras.forEach(function (cli) {
        var rots = dados.roteiros.filter(function (r) { return casa(cli, r); });
        var orcs = dados.orcamentos.filter(function (o) { return casa(cli, o); });
        todas = todas.concat(extrairTarefas(cli, rots, orcs, dados.bases));
      });
      pintarPainel(todas, status);
    } catch (e) {
      var body = document.getElementById('provisoesBody');
      if (body) body.innerHTML = '<p style="color:#dc2626;font-size:12px;">Falha ao montar as provisões.</p>';
      if (window.console) console.error('Provisões:', e);
    } finally { _rendering = false; }
  }

  // ===================== WIRING =====================
  function wrapRender() {
    if (window.__provWrapped) return;
    var orig = window.renderDashboard;
    if (typeof orig !== 'function') return;
    window.__provWrapped = true;
    window.renderDashboard = function () {
      var r = orig.apply(this, arguments);
      Promise.resolve(r).then(function () { renderPainelProvisoes(); }).catch(function () { renderPainelProvisoes(); });
      return r;
    };
  }
  function boot() {
    wrapRender();
    var page = document.getElementById('page-dashboard');
    if (page && page.classList.contains('active')) renderPainelProvisoes();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(wrapRender, 1500);

  window.renderPainelProvisoes = renderPainelProvisoes;
  window.__prov = {
    TIPO_DEFAULTS: TIPO_DEFAULTS, REGRAS: REGRAS, URG: URG,
    aplicarRegras: aplicarRegras,
    normalizeDate: normalizeDate, daysBetween: daysBetween, addDays: addDays,
    detectTipoTransporte: detectTipoTransporte, resolverRegra: resolverRegra,
    calcularUrgencia: calcularUrgencia, extrairTarefas: extrairTarefas, chaveTarefa: chaveTarefa
  };
})();
