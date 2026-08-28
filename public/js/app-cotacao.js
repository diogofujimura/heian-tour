// ── MÓDULO: CONSTRUTOR DE COTAÇÃO (textos, estadias, tours, experiências, itens, cálculos) ──
// Extraído de app.js em 2026-07-28 (Fatia 5 do fatiamento seguro). Carregado APÓS app.js.
// Só funções globais; sem estado próprio. Lê/grava o estado global do app.js (`state.orcamento` etc.)
// via escopo compartilhado (app.js carrega antes; chamadas são todas em runtime/eventos).

// ── ORÇAMENTO SETUP ───────────────────────────────────────────────────────────

// ── TEXTOS CUSTOMIZÁVEIS ──────────────────────────────────────────────────────
function toggleCardTextos() {
  const form = document.getElementById('textosCustomForm');
  const btn = document.getElementById('btnToggleTextos');
  const hidden = form.classList.toggle('hidden');
  btn.textContent = hidden ? 'Expandir' : 'Recolher';
}

function txVal(id, fallback) {
  const el = document.getElementById(id);
  return (el && el.value.trim()) ? el.value.trim() : fallback;
}

function preencherTextosForm(textos) {
  const t = textos || {};
  const campos = {
    tx_coverLabel: t.coverLabel || '', tx_coverSub: t.coverSub || '',
    tx_secEstadias: t.secEstadias || '', tx_secTransp: t.secTransp || '',
    tx_secTours: t.secTours || '', tx_secExp: t.secExp || '',
    tx_secResumo: t.secResumo || '', tx_lblTours: t.lblTours || '',
    tx_lblTransp: t.lblTransp || '', tx_lblExp: t.lblExp || '',
    tx_lblCons: t.lblCons || '', tx_lblTotal: t.lblTotal || '',
    tx_lblSinal: t.lblSinal || '', tx_secObs: t.secObs || '',
    tx_secCond: t.secCond || '', tx_secCanc: t.secCanc || ''
  };
  Object.entries(campos).forEach(([id, val]) => {
    const el = document.getElementById(id); if (el) el.value = val;
  });
}

function coletarTextos() {
  return {
    coverLabel: document.getElementById('tx_coverLabel')?.value.trim() || '',
    coverSub:   document.getElementById('tx_coverSub')?.value.trim() || '',
    secEstadias:document.getElementById('tx_secEstadias')?.value.trim() || '',
    secTransp:  document.getElementById('tx_secTransp')?.value.trim() || '',
    secTours:   document.getElementById('tx_secTours')?.value.trim() || '',
    secExp:     document.getElementById('tx_secExp')?.value.trim() || '',
    secResumo:  document.getElementById('tx_secResumo')?.value.trim() || '',
    lblTours:   document.getElementById('tx_lblTours')?.value.trim() || '',
    lblTransp:  document.getElementById('tx_lblTransp')?.value.trim() || '',
    lblExp:     document.getElementById('tx_lblExp')?.value.trim() || '',
    lblCons:    document.getElementById('tx_lblCons')?.value.trim() || '',
    lblTotal:   document.getElementById('tx_lblTotal')?.value.trim() || '',
    lblSinal:   document.getElementById('tx_lblSinal')?.value.trim() || '',
    secObs:     document.getElementById('tx_secObs')?.value.trim() || '',
    secCond:    document.getElementById('tx_secCond')?.value.trim() || '',
    secCanc:    document.getElementById('tx_secCanc')?.value.trim() || ''
  };
}

function setupOrcamento() {
  document.getElementById('btnAddEstadia')?.addEventListener('click', () => addEstadia());
  document.getElementById('btnAddTour')?.addEventListener('click', () => addTour());
  document.getElementById('btnAddTransporte')?.addEventListener('click', () => addTransporte());
  document.getElementById('btnAddExperiencia')?.addEventListener('click', () => addExperiencia());
  document.getElementById('btnAddItemAdicional')?.addEventListener('click', () => addItemAdicional());
  const _btnSalvar = document.getElementById('btnSalvarOrc');
  if (_btnSalvar) _btnSalvar.addEventListener('click', salvarOrcamentoAtual);
  document.getElementById('clienteAdultos')?.addEventListener('change', propagarPessoas);
  document.getElementById('clienteCriancas')?.addEventListener('change', propagarPessoas);
  document.getElementById('consultoriaToggle')?.addEventListener('change', e => {
    document.getElementById('consultoriaFields')?.classList.toggle('hidden', !e.target.checked);
    updateResumo();
  });
  document.getElementById('consultoriaValor')?.addEventListener('input', updateResumo);
  // Auto-save quando dados do cliente mudam
  ['orcNome','clienteNome','clienteAdultos','clienteCriancas','clienteDataOrcamento','consultoriaDesc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', autoSave);
  });
}

// ── ESTADIAS ──────────────────────────────────────────────────────────────────
function addEstadia() {
  state.orcamento.estadias.push({ id: Date.now(), cidade: '', dataInicio: '', dataFim: '', hotel: '' });
  renderEstadiasForm();
}

function updBaseTour(horas, val) {
  if (!state.orcamento.valoresTour) state.orcamento.valoresTour = { '4h': 45000, '6h': 65000, '8h': 85000, '10h': 105000, '12h': 125000 };
  const numVal = parseFloat(val) || 0;
  state.orcamento.valoresTour[horas] = numVal;
  
  let changed = false;
  state.orcamento.tours.forEach(t => {
    if (t.duracao === horas) {
      t.valor = numVal;
      changed = true;
    }
  });
  if (changed) {
    renderToursForm();
    updateResumo();
  }
  autoSave();
}

function renderEstadiasReadOnlyForm() {
  const cont = document.getElementById('estadiasReadOnlyList');
  if (!cont) return;
  if (!state.orcamento.estadias || state.orcamento.estadias.length === 0) {
    cont.innerHTML = '<p class="hint" style="margin:0;">Nenhuma estadia. Edite o cliente na aba "Clientes (Notion)" para adicionar estadias.</p>';
    return;
  }
  let html = '';
  state.orcamento.estadias.forEach((est, i) => {
    const dates = (est.dataInicio || est.dataFim) ? `${fmtDataBR(est.dataInicio)} – ${fmtDataBR(est.dataFim)}` : '';
    html += `<div style="margin-bottom: 8px;"><strong>Estadia ${i+1}:</strong> ${est.cidade} ${est.hotel ? '- '+est.hotel : ''} ${dates ? '('+dates+')' : ''}</div>`;
  });
  cont.innerHTML = html;
}

function renderEstadiasForm() {
  const cont = document.getElementById('estadiasList');
  cont.innerHTML = '';
  currentEditingEstadias.forEach((est, i) => {
    const div = document.createElement('div');
    div.className = 'item-row';
    const isFirst = i === 0;
    const isLast = i === currentEditingEstadias.length - 1;
    div.innerHTML = `
      <div class="item-row-header" style="display: flex; align-items: center; justify-content: space-between;">
        <span class="item-row-num">Estadia ${i+1}</span>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button type="button" class="btn-move-up" onclick="moverEstadia(${i}, -1)" ${isFirst ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''} style="background:none; border:none; color:var(--ink-mid); cursor:pointer; padding:2px 6px; font-size:12px;">▲</button>
          <button type="button" class="btn-move-down" onclick="moverEstadia(${i}, 1)" ${isLast ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''} style="background:none; border:none; color:var(--ink-mid); cursor:pointer; padding:2px 6px; font-size:12px;">▼</button>
          <button type="button" class="btn-remove" onclick="rmEstadia('${est.id}')">✕</button>
        </div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Cidade</label><input type="text" value="${est.cidade}" placeholder="Ex: Tokyo" oninput="updEstadia('${est.id}','cidade',this.value); filtrarDatalistHoteis('${est.id}',this.value)"></div>
        <div class="field"><label>Data Início</label>${window.hdField(est.dataInicio, 'data-hd="cot-estadia" data-hd-id="' + est.id + '" data-hd-f="dataInicio"', false, cotHintISO())}</div>
        <div class="field"><label>Data Fim</label>${window.hdField(est.dataFim, 'data-hd="cot-estadia" data-hd-id="' + est.id + '" data-hd-f="dataFim"', false, cotHintISO())}</div>
        <div class="field"><label>Hotel</label><input type="text" list="datalist-hoteis-${est.id}" value="${est.hotel}" placeholder="Busque na lista ou digite novo..." oninput="updEstadia('${est.id}','hotel',this.value)"></div>
      </div>
      <datalist id="datalist-hoteis-${est.id}"></datalist>`;
    cont.appendChild(div);
    // Popula o datalist de hotéis com o filtro inicial da cidade
    filtrarDatalistHoteis(est.id, est.cidade);
  });
}
function rmEstadia(id) { currentEditingEstadias = currentEditingEstadias.filter(e => String(e.id) !== String(id)); renderEstadiasForm(); }
function cotHintISO(){
  try{
    var arr=(state.orcamento && state.orcamento.estadias) || [];
    var ds=arr.map(function(e){return e.dataInicio;}).filter(function(x){return x && x.length===10 && x.charAt(4)==='-';}).sort();
    return ds.length ? ds[0] : '';
  }catch(e){ return ''; }
}
function updEstadia(id, f, v) { const e = currentEditingEstadias.find(x => String(x.id) === String(id)); if (e) e[f] = v; }

window.moverEstadia = function(index, direcao) {
  const targetIndex = index + direcao;
  if (targetIndex < 0 || targetIndex >= currentEditingEstadias.length) return;
  const temp = currentEditingEstadias[index];
  currentEditingEstadias[index] = currentEditingEstadias[targetIndex];
  currentEditingEstadias[targetIndex] = temp;
  renderEstadiasForm();
};

window.ordenarEstadiasPorData = function() {
  currentEditingEstadias.sort((a, b) => {
    if (!a.dataInicio) return 1;
    if (!b.dataInicio) return -1;
    return a.dataInicio.localeCompare(b.dataInicio);
  });
  renderEstadiasForm();
};

function filtrarDatalistHoteis(estId, cidadeDigitada) {
  const datalist = document.getElementById(`datalist-hoteis-${estId}`);
  if (!datalist) return;
  const cidadeNorm = (cidadeDigitada || '').trim().toLowerCase();
  const hoteisCadastrados = state.hoteisDB || [];
  
  const hoteisFiltrados = cidadeNorm 
    ? hoteisCadastrados.filter(h => {
        const hCid = (h.Cidade || '').trim().toLowerCase();
        return hCid.includes(cidadeNorm) || cidadeNorm.includes(hCid);
      })
    : hoteisCadastrados;
    
  datalist.innerHTML = hoteisFiltrados.map(h => `<option value="${h['Nome do Hotel']}"></option>`).join('');
}

// ── TOURS ─────────────────────────────────────────────────────────────────────
// CORREÇÃO: sem re-render durante digitação — só atualiza estado e subtotal
function calcTotalTour(t) {
  let base = parseFloat(t.valor) || 0;
  if (t.descontoAtivo && t.desconto > 0) base = base - (base * (t.desconto / 100));
  return base;
}
function addTour() {
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
  const val6h = (state.orcamento.valoresTour && state.orcamento.valoresTour['6h']) || 65000;
  state.orcamento.tours.push({ id: Date.now(), data: '', descricao: '', pontos: '', duracao: '6h', valor: val6h, descontoAtivo: false, desconto: 5, observacao: '' });
  renderToursForm(); updateResumo();
}
// [heian-fix] Normaliza ids dos itens da cotacao para numeros unicos.
// Cotacoes importadas/retroativas vinham com ids em texto (ex: "tour-1"), que
// entravam sem aspas nos handlers inline (onchange="updTourField(tour-1,...)")
// e disparavam "ReferenceError: tour is not defined". Tambem cura ids duplicados.
function normalizeOrcamentoIds(o) {
  if (!o) return;
  var arrs = ['tours', 'transportes', 'experiencias', 'itensAdicionais', 'estadias'];
  var seen = {}, seq = Date.now();
  arrs.forEach(function (k) {
    if (!Array.isArray(o[k])) { o[k] = []; return; }
    o[k].forEach(function (it) {
      if (!it) return;
      var raw = it.id;
      var n = (typeof raw === 'number') ? raw : (/^\d+$/.test(String(raw)) ? Number(raw) : NaN);
      if (!isFinite(n) || seen[n]) { n = seq++; }
      seen[n] = true;
      it.id = n;
    });
  });
}

function renderToursForm() {
  if (state && state.orcamento) normalizeOrcamentoIds(state.orcamento);
  const cont = document.getElementById('toursList');
  cont.innerHTML = '';
  state.orcamento.tours.forEach((t, i) => {
    let valorFinal = parseFloat(t.valor) || 0;
    if (t.descontoAtivo && t.desconto > 0) {
      valorFinal = valorFinal - (valorFinal * (t.desconto / 100));
    }
    
    const div = document.createElement('div');
    div.className = 'item-row';
    div.dataset.itemId = t.id;
    div.innerHTML = `
      <div class="item-row-header">
        <span class="item-row-num">Tour ${i+1}</span>
        <span class="item-subtotal" id="subtotal-tour-${t.id}">¥${fmt(valorFinal)} · ${fmtUSD(valorFinal * getUSD())}</span>
        <button class="btn-remove" onclick="rmTour(${t.id})">✕</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Data</label>
          ${window.hdField(t.data, 'data-hd="cot-tour" data-hd-id="' + t.id + '"', false, cotHintISO())}</div>
        <div class="field"><label>Descrição</label>
          <input type="text" value="${t.descricao}" placeholder="Ex: Tour em Tokyo" oninput="updTourField(${t.id},'descricao',this.value)"></div>
        <div class="field full-width"><label>Pontos Visitados (um por linha)</label>
          <textarea id="tour-pontos-${t.id}" rows="3" placeholder="Asakusa&#10;Ueno Park&#10;Yanaka Ginza" oninput="updTourField(${t.id},'pontos',this.value)">${t.pontos}</textarea></div>
        <div class="field"><label>Duração do Tour</label>
          <select onchange="updTourDuracao(${t.id}, this.value)">
            <option value="" ${!t.duracao ? 'selected' : ''}>-- Selecione --</option>
            <option value="4h" ${t.duracao==='4h' ? 'selected' : ''}>4 horas</option>
            <option value="6h" ${t.duracao==='6h' ? 'selected' : ''}>6 horas</option>
            <option value="8h" ${t.duracao==='8h' ? 'selected' : ''}>8 horas</option>
            <option value="10h" ${t.duracao==='10h' ? 'selected' : ''}>10 horas</option>
            <option value="12h" ${t.duracao==='12h' ? 'selected' : ''}>12 horas</option>
          </select>
        </div>
        <div class="field"><label>Valor do Tour ¥</label>
          <input type="number" id="tour-valor-${t.id}" value="${t.valor||''}" placeholder="Ex: 55000"
            oninput="updTourNum(${t.id},'valor',this.value)"
            onblur="finalizarNum(${t.id},'tour','valor',this.value)"></div>
        <div class="field">
          <label>Desconto Aplicado</label>
          <div style="display:flex;align-items:center;gap:10px;margin-top:4px">
            <label class="toggle"><input type="checkbox" ${t.descontoAtivo?'checked':''} onchange="updTourToggleDesconto(${t.id},this.checked)"><span class="toggle-slider"></span></label>
            <input type="number" value="${t.desconto||''}" placeholder="%" min="0" max="100"
              style="width:80px;padding:8px 10px;border:1px solid var(--border-dk);border-radius:4px;font-family:var(--ff-num);font-size:13px;outline:none"
              ${t.descontoAtivo?'':'disabled'}
              oninput="updTourNum(${t.id},'desconto',this.value)">
            <span style="font-size:12px;color:var(--ink-lt)">%</span>
          </div>
        </div>
        <div class="field full-width"><label>Observações</label>
          <input type="text" id="obs-tour-${t.id}" value="${t.observacao}" placeholder="Ex: 8hrs com guia brasileiro · transporte público" oninput="updTourField(${t.id},'observacao',this.value)">
          ${renderSugestoesHtml(t.id, 'tour', state.config.sugestoes_tours)}</div>
      </div>`;
    cont.appendChild(div);
    // Initialize rich text for this tour's textarea
    initRichText(`tour-pontos-${t.id}`, 'Asakusa\nUeno Park\nYanaka Ginza');
  });
}

function updTourDuracao(id, duracao) {
  const t = state.orcamento.tours.find(x => x.id === id); if (!t) return;
  t.duracao = duracao;
  if (duracao && state.orcamento.valoresTour && state.orcamento.valoresTour[duracao]) {
    t.valor = state.orcamento.valoresTour[duracao];
  }
  renderToursForm();
  updateResumo();
}
function rmTour(id) {
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
  state.orcamento.tours = state.orcamento.tours.filter(t => t.id !== id);
  renderToursForm();
  updateResumo();
}
function updTourField(id, f, v) {
  const t = state.orcamento.tours.find(x => x.id === id); if (!t) return;
  t[f] = v;
  updateResumo();
}
function updTourToggleDesconto(id, checked) {
  const t = state.orcamento.tours.find(x => x.id === id); if (!t) return;
  t.descontoAtivo = checked;
  // trigger recalculation visually in HTML if needed
  renderToursForm();
  updateResumo();
}
function updTourNum(id, f, rawVal) {
  // Atualiza estado sem re-render — deixa o usuário digitar livremente
  const t = state.orcamento.tours.find(x => x.id === id); if (!t) return;
  t[f] = parseFloat(rawVal) || 0;
  
  // Recalcula o total
  let valorFinal = parseFloat(t.valor) || 0;
  if (t.descontoAtivo && t.desconto > 0) {
    valorFinal = valorFinal - (valorFinal * (t.desconto / 100));
  }

  // Só atualiza o subtotal no header, sem re-renderizar o form
  const el = document.getElementById(`subtotal-tour-${id}`);
  if (el) el.textContent = `¥${fmt(valorFinal)} · ${fmtUSD(valorFinal * getUSD())}`;
  updateResumo();
}
function finalizarNum(id, tipo, f, rawVal) {
  // Ao sair do campo (blur), garante valor correto
  if (tipo === 'tour') {
    const t = state.orcamento.tours.find(x => x.id === id); if (!t) return;
    t[f] = parseFloat(rawVal) || 0;
  }
  updateResumo();
}

function addTransporte() {
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
  const ad = parseInt(document.getElementById('clienteAdultos')?.value) || 2;
  const cr = parseInt(document.getElementById('clienteCriancas')?.value) || 0;
  state.orcamento.transportes.push({
    id: Date.now(), data: '', descricao: '',
    cidadeOrigem: '', cidadeDestino: '',
    preco: 0, precoInfantil: 0,
    adultos: ad, criancas: cr,
    taxaAtiva: false, taxaTipo: 'grupo', taxaValor: 3000, observacao: '', _dbId: null
  });
  renderTransportesForm(); updateResumo();
}
function calcTotalTransporteBruto(t) {
  const adultos = t.adultos || 0;
  const criancas = t.criancas || 0;
  const descLow = t.descricao ? t.descricao.toLowerCase() : '';
  const isTransfer = descLow.includes('transfer') || descLow.includes('privado') || descLow.includes('privativo');
  
  let base = 0;
  if (isTransfer) {
    base = t.preco || 0;
  } else {
    base = (t.preco || 0) * adultos + (t.precoInfantil || 0) * criancas;
  }
  
  let totalPessoas = adultos + criancas;
  if (t.taxaAtiva) {
    base += t.taxaTipo === 'grupo' ? (t.taxaValor || 3000) : (t.taxaValor || 3000) * (totalPessoas > 0 ? totalPessoas : 1);
  }
  return base;
}

function calcTotalTransporte(t) {
  if (t.compradoHeian === false) return 0;
  return calcTotalTransporteBruto(t);
}
function renderTransportesForm() {
  const cont = document.getElementById('transportesList');
  cont.innerHTML = '';
  
  const groupedDB = [];
  const mapGroup = new Map();
  state.transportesDB.forEach(tr => {
    const key = `${tr.trecho}|${tr.tipo}|${tr.linha}|${tr.categoria}`;
    if (!mapGroup.has(key)) {
      mapGroup.set(key, { ...tr, precos: {} });
      groupedDB.push(mapGroup.get(key));
    }
    const g = mapGroup.get(key);
    if ((tr.idade || 'adulto').toLowerCase().includes('infantil')) {
      g.precos.infantil = tr.preco_jpy;
      g._dbIdInfantil = tr.id;
    } else {
      g.precos.adulto = tr.preco_jpy;
      g._dbIdAdulto = tr.id;
    }
  });

  state.orcamento.transportes.forEach((t, i) => {
    const total = calcTotalTransporte(t);
    const totalPessoas = (t.adultos||0) + (t.criancas||0);
    
    const opts = groupedDB.map(g => {
      const pAd = g.precos.adulto || 0;
      const pInf = g.precos.infantil || 0;
      const isSelected = t._dbId && (t._dbId === g._dbIdAdulto || t._dbId === g._dbIdInfantil || t._dbId === g.id);
      return `<option value="${g.id}" ${isSelected ? 'selected' : ''}>` +
      `${g.trecho} | ${g.tipo} | ${g.linha} | ${g.categoria} ${g.tempo ? '(' + g.tempo + ') ' : ''}— Ad: ¥${fmt(pAd)} / Inf: ¥${fmt(pInf)}</option>`;
    }).join('');
    
    const div = document.createElement('div');
    div.className = 'item-row';
    const isHeian = t.compradoHeian !== false;
    const bruto = calcTotalTransporteBruto(t);
    div.innerHTML = `
      <div class="item-row-header" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
        <span class="item-row-num">Transporte ${i+1}</span>
        <div style="display:inline-flex; align-items:center; gap:8px;">
          <span class="item-subtotal" id="subtotal-transp-${t.id}">
            ${isHeian ? `¥${fmt(total)} · ${fmtUSD(total*getUSD())}` : `<span style="opacity:0.6; text-decoration:line-through; font-size:11px;">¥${fmt(bruto)}</span> <span style="font-weight:700; color:#5c4a3d;">¥0 (Pelo Cliente)</span>`}
          </span>
          <button class="btn-remove" onclick="rmTransporte(${t.id})">✕</button>
        </div>
      </div>
      <div class="heian-emite-row" style="display:flex; align-items:center; gap:8px; margin:4px 0 10px; flex-wrap:wrap;">
        <label class="toggle" style="flex-shrink:0;" title="Ligado = emitido pela Heian (entra no valor do pacote). Desligado = comprado pelo cliente (¥0, informativo).">
          <input type="checkbox" ${isHeian?'checked':''} onchange="updTranspToggleCompradoHeian('${t.id}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
        <span style="font-size:12px; font-weight:600; color:${isHeian?'#15803d':'#c2410c'};">${isHeian?'🛡️ Incluso / Comprado pela Heian':'👤 Compra pelo Viajante'}</span>
        ${t.categoria === 'Sem Reserva' || (t.descricao && t.descricao.toLowerCase().includes('sem reserva')) ? '<span style="font-size:11px; font-weight:700; color:#0284c7; background:rgba(2,132,199,0.08); border:1px solid rgba(2,132,199,0.25); padding:2px 8px; border-radius:6px;">💳 Cartão IC (Sem Reserva)</span>' : ''}
      </div>
      <div class="form-grid">
        <div class="field"><label>Data</label>
          ${window.hdField(t.data, 'data-hd="cot-transp" data-hd-id="' + t.id + '"', false, cotHintISO())}</div>
        <div class="field"><label>Origem (filtro)</label>
          <input type="text" list="datalistCidades" autocomplete="off" placeholder="De onde sai?" value="${(t.cidadeOrigem||'').replace(/"/g,'&quot;')}" oninput="updTranspCidade(${t.id},'cidadeOrigem',this.value)"></div>
        <div class="field"><label>Destino (filtro)</label>
          <input type="text" list="datalistCidades" autocomplete="off" placeholder="Para onde vai?" value="${(t.cidadeDestino||'').replace(/"/g,'&quot;')}" oninput="updTranspCidade(${t.id},'cidadeDestino',this.value)"></div>
        <div class="field full-width"><label>Selecionar da base</label>
          <select id="selTranspCot-${t.id}" onchange="preencherTransporte(${t.id},this.value)">
            <option value="">— digitar manualmente —</option>${opts}
          </select></div>
        <div class="field full-width"><label>Descrição</label>
          <input type="text" value="${t.descricao}" placeholder="Ex: Asakusa Station → Tobu Nikko | Spacia X | Reservado*"
            oninput="updTranspField(${t.id},'descricao',this.value)"></div>
            
        <div class="field"><label>Valor Adulto ¥</label>
          <input type="number" value="${t.preco||0}"
            oninput="updTranspNum(${t.id},'preco',this.value)"
            onblur="updTranspRefresh(${t.id},'preco',this.value)"></div>
        <div class="field"><label>Nº Adultos</label>
          <input type="number" value="${t.adultos||0}" min="0"
            oninput="updTranspNum(${t.id},'adultos',this.value)"
            onblur="updTranspRefresh(${t.id},'adultos',this.value)"></div>
            
        <div class="field"><label>Valor Infantil ¥</label>
          <input type="number" value="${t.precoInfantil||0}"
            oninput="updTranspNum(${t.id},'precoInfantil',this.value)"
            onblur="updTranspRefresh(${t.id},'precoInfantil',this.value)"></div>
        <div class="field"><label>Nº Crianças</label>
          <input type="number" value="${t.criancas||0}" min="0"
            oninput="updTranspNum(${t.id},'criancas',this.value)"
            onblur="updTranspRefresh(${t.id},'criancas',this.value)"></div>
            
        <div class="field full-width">
          <label>Taxa Adicional</label>
          <div class="taxa-row" style="margin-top:6px">
            <label class="toggle" style="flex-shrink:0">
              <input type="checkbox" ${t.taxaAtiva?'checked':''} onchange="updTranspToggleTaxa(${t.id},this.checked)">
              <span class="toggle-slider"></span>
            </label>
            <select ${t.taxaAtiva?'':'style="opacity:0.4;pointer-events:none"'} onchange="updTranspRefresh(${t.id},'taxaTipo',this.value)">
              <option value="grupo" ${t.taxaTipo==='grupo'?'selected':''}>Por grupo</option>
              <option value="pessoa" ${t.taxaTipo==='pessoa'?'selected':''}>Por pessoa</option>
            </select>
            <input type="number" value="${t.taxaValor||0}" style="width:110px${t.taxaAtiva?'':';opacity:0.4;pointer-events:none'}"
              oninput="updTranspNum(${t.id},'taxaValor',this.value)"
              onblur="updTranspRefresh(${t.id},'taxaValor',this.value)">
            <span class="taxa-label" style="color:var(--ink-mid)" id="taxa-label-transp-${t.id}"></span>
          </div>
        </div>
        <div class="field full-width"><label>Observações</label>
          <input type="text" id="obs-transporte-${t.id}" value="${t.observacao||''}" placeholder="Ex: Apenas reserva do assento. Tarifa básica paga na hora."
            oninput="updTranspField(${t.id},'observacao',this.value)">
          ${renderSugestoesHtml(t.id, 'transporte', state.config.sugestoes_transportes)}</div>
      </div>
    `;
    cont.appendChild(div);
  });
  // Aplica o agrupamento por cidade (origem/destino) em cada select de transporte
  state.orcamento.transportes.forEach(t => filtrarTransportesCotacao(t.id));
}

// Filtra/agrupa as opções do select de transporte pela cidade de origem/destino digitada
// (mesmo comportamento do montador de roteiro: Recomendados → Mesma origem → Mesmo destino → Outras).
function filtrarTransportesCotacao(id) {
  const t = state.orcamento.transportes.find(x => String(x.id) === String(id));
  const sel = document.getElementById('selTranspCot-' + id);
  if (!t || !sel) return;
  const origem = (t.cidadeOrigem || '').toLowerCase().trim();
  const destino = (t.cidadeDestino || '').toLowerCase().trim();

  const grouped = [];
  const mapG = new Map();
  (state.transportesDB || []).forEach(tr => {
    const key = `${tr.trecho}|${tr.tipo}|${tr.linha}|${tr.categoria}`;
    if (!mapG.has(key)) { mapG.set(key, { ...tr, precos: {} }); grouped.push(mapG.get(key)); }
    const g = mapG.get(key);
    if ((tr.idade || 'adulto').toLowerCase().includes('infantil')) { g.precos.infantil = tr.preco_jpy; g._dbIdInfantil = tr.id; }
    else { g.precos.adulto = tr.preco_jpy; g._dbIdAdulto = tr.id; }
  });

  const mkOpt = (g) => {
    const pAd = g.precos.adulto || 0, pInf = g.precos.infantil || 0;
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = `${g.trecho} | ${g.tipo} | ${g.linha} | ${g.categoria} ${g.tempo ? '(' + g.tempo + ') ' : ''}— Ad: ¥${fmt(pAd)} / Inf: ¥${fmt(pInf)}`;
    if (t._dbId && (t._dbId === g._dbIdAdulto || t._dbId === g._dbIdInfantil || t._dbId === g.id)) opt.selected = true;
    return opt;
  };

  sel.innerHTML = '';
  const base = document.createElement('option');
  base.value = ''; base.textContent = '— digitar manualmente —';
  sel.appendChild(base);

  if (!origem && !destino) { grouped.forEach(g => sel.appendChild(mkOpt(g))); return; }

  const grpExact = document.createElement('optgroup'); grpExact.label = 'Recomendados (origem e destino)';
  const grpOrig = document.createElement('optgroup'); grpOrig.label = 'Mesma origem';
  const grpDest = document.createElement('optgroup'); grpDest.label = 'Mesmo destino';
  const grpOther = document.createElement('optgroup'); grpOther.label = 'Todas as outras opções';
  grouped.forEach(g => {
    const trecho = (g.trecho || '').toLowerCase();
    const mO = origem && trecho.includes(origem);
    const mD = destino && trecho.includes(destino);
    const opt = mkOpt(g);
    if (mO && mD) grpExact.appendChild(opt);
    else if (mO) grpOrig.appendChild(opt);
    else if (mD) grpDest.appendChild(opt);
    else grpOther.appendChild(opt);
  });
  if (grpExact.children.length) sel.appendChild(grpExact);
  if (grpOrig.children.length) sel.appendChild(grpOrig);
  if (grpDest.children.length) sel.appendChild(grpDest);
  if (grpOther.children.length) sel.appendChild(grpOther);
}

window.updTranspCidade = function(id, campo, v) {
  const t = state.orcamento.transportes.find(x => String(x.id) === String(id));
  if (!t) return;
  t[campo] = v;
  filtrarTransportesCotacao(id);
};
function rmTransporte(id) {
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
  state.orcamento.transportes = state.orcamento.transportes.filter(t => t.id !== id);
  renderTransportesForm();
  updateResumo();
}
function updTranspField(id, f, v) {
  const t = state.orcamento.transportes.find(x=>x.id===id); if(!t) return;
  t[f]=v; updateResumo();
  if (f === 'data') { sincronizarCamposComRoteiro(t, 'transporte', { data: v }); refletirItemLocal(t, 'transporte', { data: v }); }
}
function updTranspNum(id, f, rawVal) {
  const t = state.orcamento.transportes.find(x=>x.id===id); if(!t) return;
  t[f] = parseFloat(rawVal)||0;
  const total = calcTotalTransporte(t);
  const el = document.getElementById(`subtotal-transp-${id}`);
  if(el) el.textContent = `¥${fmt(total)} · ${fmtUSD(total*getUSD())}`;
  const taxaEl = document.getElementById(`taxa-label-transp-${id}`);
  const totalPessoas = (t.adultos||0) + (t.criancas||0);
  if(taxaEl) taxaEl.textContent = t.taxaAtiva ? (`= ¥${fmt(t.taxaTipo==='grupo'?t.taxaValor:t.taxaValor * (totalPessoas > 0 ? totalPessoas : 1))}`) : '';
  updateResumo();
}
function updTranspRefresh(id, f, v) {
  const t = state.orcamento.transportes.find(x=>x.id===id); if(!t) return;
  t[f] = (f==='taxaTipo' || f==='precoTipo') ? v : (parseFloat(v)||0);
  renderTransportesForm(); updateResumo();
}
function updTranspToggleTaxa(id, checked) {
  const t = state.orcamento.transportes.find(x=>x.id===id); if(!t) return;
  t.taxaAtiva = checked; renderTransportesForm(); updateResumo();
}
function updTranspToggleCompradoHeian(id, checked) {
  const t = state.orcamento.transportes.find(x=>String(x.id)===String(id)); if(!t) return;
  t.compradoHeian = checked;
  renderTransportesForm();
  updateResumo(); // dispara o autosave, que grava a cotação E faz o writeback no roteiro (ÚNICO escritor)
  // NÃO chamar sincronizarStatusCompradoComRoteiro aqui: era um 2º write imediato no MESMO roteiro,
  // corria com o writeback do autosave (last-write-wins) e perdia toggles / defasava o portal.
  refletirCompradoHeianLocal(t, 'transporte', checked); // só reflexo LOCAL (cache/editor), sem tocar o servidor
}
function preencherTransporte(id, dbId) {
  const t = state.orcamento.transportes.find(x=>x.id===id);
  const db = state.transportesDB.find(x=>x.id==dbId);
  if(t&&db){
    t._dbId = db.id;
    t.descricao = `${db.trecho} | ${db.tipo} | ${db.linha} | ${db.categoria}`;
    
    let preco = db.preco_jpy || 0;
    let precoInfantil = 0;
    
    const matches = state.transportesDB.filter(x => x.trecho === db.trecho && x.tipo === db.tipo && x.linha === db.linha && x.categoria === db.categoria);
    matches.forEach(m => {
      if ((m.idade || '').toLowerCase().includes('infantil')) {
        precoInfantil = m.preco_jpy || 0;
      } else if ((m.idade || '').toLowerCase().includes('adulto')) {
        preco = m.preco_jpy || 0;
        t._dbId = m.id;
      }
    });
    
    t.preco = preco;
    t.precoInfantil = precoInfantil;
    t.observacao = db.observacao || '';
    t.categoria = db.categoria || t.categoria || 'Comum';
    // Sync da classe (ex.: Reservado -> Green Car) para o Roteiro + Portal
    const _pt = String(db.trecho || '').split('➔').map(x => x.trim());
    const _campos = {
      categoria: t.categoria,
      trechoId: t._dbId,
      cidadeOrigem: _pt.length === 2 ? _pt[0] : undefined,
      cidadeDestino: _pt.length === 2 ? _pt[1] : undefined,
      tipoTransporte: db.tipo || undefined,
      linha: db.linha || undefined
    };
    sincronizarCamposComRoteiro(t, 'transporte', _campos);
    refletirItemLocal(t, 'transporte', _campos);
  }
  else if(t) t._dbId=null;
  renderTransportesForm(); updateResumo();
}

// ── EXPERIÊNCIAS ──────────────────────────────────────────────────────────────
function addExperiencia() {
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
  state.orcamento.experiencias.push({ id: Date.now(), data: '', nome: '', preco: 0, pessoas: 2, taxaAtiva: false, taxaTipo: 'grupo', taxaValor: 3000, observacao: '', _dbId: null });
  renderExperienciasForm(); updateResumo();
}
function calcTotalExpBruto(e) {
  let base = (e.preco||0) * (e.precoTipo === 'grupo' ? 1 : (e.pessoas||1));
  if (e.taxaAtiva) base += e.taxaTipo==='grupo' ? (e.taxaValor||3000) : (e.taxaValor||3000)*(e.pessoas||1);
  return base;
}

function calcTotalExp(e) {
  if (e.compradoHeian === false) return 0;
  return calcTotalExpBruto(e);
}
function renderExperienciasForm() {
  const cont = document.getElementById('experienciasList');
  cont.innerHTML = '';
  state.orcamento.experiencias.forEach((e, i) => {
    const total = calcTotalExp(e);
    const taxaVal = e.taxaAtiva ? (e.taxaTipo==='grupo' ? e.taxaValor : e.taxaValor*e.pessoas) : 0;
    const opts = state.experienciasDB.map(ex =>
      `<option value="${ex.id}" ${e._dbId==ex.id?'selected':''}>${ex.nome} — ¥${fmt(ex.preco_jpy)}</option>`
    ).join('');
    const div = document.createElement('div');
    div.className = 'item-row';
    const isHeianExp = e.compradoHeian !== false;
    const brutoExp = calcTotalExpBruto(e);
    div.innerHTML = `
      <div class="item-row-header" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
        <span class="item-row-num">Experiência ${i+1}</span>
        <div style="display:inline-flex; align-items:center; gap:8px;">
          <span class="item-subtotal" id="subtotal-exp-${e.id}">
            ${isHeianExp ? `¥${fmt(e.preco)} × ${e.pessoas}${e.taxaAtiva?` + taxa`:''} = ¥${fmt(total)} · ${fmtUSD(total*getUSD())}` : `<span style="opacity:0.6; text-decoration:line-through; font-size:11px;">¥${fmt(brutoExp)}</span> <span style="font-weight:700; color:#5c4a3d;">¥0 (Pelo Cliente)</span>`}
          </span>
          <button class="btn-remove" onclick="rmExp(${e.id})">✕</button>
        </div>
      </div>
      <div class="heian-emite-row" style="display:flex; align-items:center; gap:8px; margin:4px 0 10px;">
        <label class="toggle" style="flex-shrink:0;" title="Ligado = emitido pela Heian (entra no valor do pacote). Desligado = comprado pelo cliente (¥0, informativo).">
          <input type="checkbox" ${isHeianExp?'checked':''} onchange="updExpToggleCompradoHeian('${e.id}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
        <span style="font-size:12px; font-weight:600; color:${isHeianExp?'var(--crimson)':'#6b7280'};">${isHeianExp?'Comprado pela Heian':'Comprado pelo cliente'}</span>
      </div>
      <div class="form-grid">
        <div class="field"><label>Data</label>
          ${window.hdField(e.data, 'data-hd="cot-exp" data-hd-id="' + e.id + '"', false, cotHintISO())}</div>
        <div class="field"><label>Selecionar da base</label>
          <select onchange="preencherExp(${e.id},this.value)">
            <option value="">— digitar manualmente —</option>${opts}
          </select></div>
        <div class="field full-width"><label>Nome / Descrição</label>
          <input type="text" value="${e.nome}" placeholder="Ex: Cerimônia do Chá - Kyoto"
            oninput="updExpField(${e.id},'nome',this.value)"></div>
        <div class="field"><label>Valor Unitário ¥</label>
          <input type="number" value="${e.preco||''}"
            oninput="updExpNum(${e.id},'preco',this.value)"
            onblur="updExpRefresh(${e.id},'preco',this.value)"></div>
        <div class="field"><label>Nº Pessoas</label>
          <input type="number" value="${e.pessoas}" min="1"
            oninput="updExpNum(${e.id},'pessoas',this.value)"
            onblur="updExpRefresh(${e.id},'pessoas',this.value)"></div>
        <div class="field full-width">
          <label>Taxa Adicional</label>
          <div class="taxa-row" style="margin-top:6px">
            <label class="toggle" style="flex-shrink:0">
              <input type="checkbox" ${e.taxaAtiva?'checked':''} onchange="updExpToggleTaxa(${e.id},this.checked)">
              <span class="toggle-slider"></span>
            </label>
            <select ${e.taxaAtiva?'':'style="opacity:0.4;pointer-events:none"'} onchange="updExpRefresh(${e.id},'taxaTipo',this.value)">
              <option value="grupo" ${e.taxaTipo==='grupo'?'selected':''}>Por grupo</option>
              <option value="pessoa" ${e.taxaTipo==='pessoa'?'selected':''}>Por pessoa</option>
            </select>
            <input type="number" value="${e.taxaValor}" style="width:110px${e.taxaAtiva?'':';opacity:0.4;pointer-events:none'}"
              oninput="updExpNum(${e.id},'taxaValor',this.value)"
              onblur="updExpRefresh(${e.id},'taxaValor',this.value)">
            <span class="taxa-label" style="color:var(--ink-mid)" id="taxa-label-exp-${e.id}"></span>
          </div>
        </div>
        <div class="field full-width"><label>Observações</label>
          <input type="text" id="obs-experiencia-${e.id}" value="${e.observacao}" placeholder="Ex: Ingresso emitido eletronicamente. Não reembolsável." oninput="updExpField(${e.id},'observacao',this.value)">
          ${renderSugestoesHtml(e.id, 'experiencia', state.config.sugestoes_experiencias)}</div>
      </div>`;
    cont.appendChild(div);
  });
}
function rmExp(id) {
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
  state.orcamento.experiencias = state.orcamento.experiencias.filter(e => e.id !== id);
  renderExperienciasForm();
  updateResumo();
}
function updExpField(id, f, v) {
  const e = state.orcamento.experiencias.find(x=>x.id===id); if(!e) return;
  e[f]=v; updateResumo();
  if (f === 'data') { sincronizarCamposComRoteiro(e, 'experiencia', { data: v }); refletirItemLocal(e, 'experiencia', { data: v }); }
}
function updExpNum(id, f, rawVal) {
  const e = state.orcamento.experiencias.find(x=>x.id===id); if(!e) return;
  e[f] = parseFloat(rawVal)||0;
  const total = calcTotalExp(e);
  const el = document.getElementById(`subtotal-exp-${e.id}`);
  if(el) el.textContent = `¥${fmt(e.preco)} × ${e.pessoas}${e.taxaAtiva?` + taxa`:''} = ¥${fmt(total)} · ${fmtUSD(total*getUSD())}`;
  const taxaEl = document.getElementById(`taxa-label-exp-${id}`);
  if(taxaEl) taxaEl.textContent = e.taxaAtiva ? (`= ¥${fmt(e.taxaTipo==='grupo'?e.taxaValor:e.taxaValor*e.pessoas)}`) : '';
  updateResumo();
}
function updExpRefresh(id, f, v) {
  const e = state.orcamento.experiencias.find(x=>x.id===id); if(!e) return;
  e[f] = (f==='taxaTipo' || f==='precoTipo') ? v : (parseFloat(v)||0);
  renderExperienciasForm(); updateResumo();
}
function updExpToggleTaxa(id, checked) {
  const e = state.orcamento.experiencias.find(x=>x.id===id); if(!e) return;
  e.taxaAtiva = checked; renderExperienciasForm(); updateResumo();
}
function updExpToggleCompradoHeian(id, checked) {
  const e = state.orcamento.experiencias.find(x=>String(x.id)===String(id)); if(!e) return;
  e.compradoHeian = checked;
  renderExperienciasForm();
  updateResumo(); // dispara o autosave, que grava a cotação E faz o writeback no roteiro (ÚNICO escritor)
  // NÃO chamar sincronizarStatusCompradoComRoteiro aqui (ver nota no toggle de transporte): evita a corrida.
  refletirCompradoHeianLocal(e, 'experiencia', checked); // só reflexo LOCAL (cache/editor), sem tocar o servidor
}
async function sincronizarStatusCompradoComRoteiro(item, tipo) {
  const notionClienteId = state.orcamento?.notionClienteId || state.orcamento?.cliente?.notionClienteId;
  let roteiroId = state.orcamento?.roteiroId || state.orcamento?.roteiroVinculado;
  if (!roteiroId && typeof state.orcamento?.orcRoteiroVinculado === 'string' && state.orcamento.orcRoteiroVinculado.startsWith('rot_')) roteiroId = state.orcamento.orcRoteiroVinculado;
  if (!notionClienteId && !roteiroId) return;

  try {
    await fetch('/api/orcamentos/sync-roteiro-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notionClienteId,
        roteiroId,
        tipo,
        item
      })
    });
  } catch (err) {
    console.error('Erro ao sincronizar status do item com o roteiro:', err);
  }
}
// Sincroniza um conjunto de campos (classe/categoria, data, trecho, etc.) da Cotação para o
// Roteiro no banco (endpoint sync-roteiro-item, que grava por item casado por refId/_dbId).
async function sincronizarCamposComRoteiro(item, tipo, campos) {
  const notionClienteId = state.orcamento?.notionClienteId || state.orcamento?.cliente?.notionClienteId;
  let roteiroId = state.orcamento?.roteiroId || state.orcamento?.roteiroVinculado;
  if (!roteiroId && typeof state.orcamento?.orcRoteiroVinculado === 'string' && state.orcamento.orcRoteiroVinculado.startsWith('rot_')) roteiroId = state.orcamento.orcRoteiroVinculado;
  if (!notionClienteId && !roteiroId) return;
  const limpos = {};
  Object.keys(campos || {}).forEach(k => { if (campos[k] !== undefined && campos[k] !== null && campos[k] !== '') limpos[k] = campos[k]; });
  if (!Object.keys(limpos).length) return;
  try {
    await fetch('/api/orcamentos/sync-roteiro-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notionClienteId, roteiroId, tipo, item, campos: limpos })
    });
  } catch (err) {
    console.error('Erro ao sincronizar campos com o roteiro:', err);
  }
}
// Reflete o status compradoHeian na cópia local do roteiro (dbRotas) e, se o editor do
// roteiro estiver aberto no mesmo roteiro, atualiza na hora. O servidor já grava no banco
// (sincronizarStatusCompradoComRoteiro); isto garante que NENHUMA tela do admin fique velha.
function refletirItemLocal(item, tipo, campos) {
  try {
    const patch = {};
    Object.keys(campos || {}).forEach(k => { if (campos[k] !== undefined && campos[k] !== null && campos[k] !== '') patch[k] = campos[k]; });
    if (!Object.keys(patch).length) return;
    const rid = state.orcamento && state.orcamento.roteiroId;
    const rvinc = state.orcamento && state.orcamento.roteiroVinculado;
    let chave = null;
    if (typeof window.dbRotas !== 'undefined' && window.dbRotas) {
      if (rvinc && window.dbRotas[rvinc]) chave = rvinc;
      else if (rid && typeof window.chaveRoteiroPorId === 'function') chave = window.chaveRoteiroPorId(rid);
    }
    const casa = (el) => {
      if (!el || el.tipo !== tipo) return false;
      // refId (único) primeiro; _dbId só como fallback p/ item sem refId — evita contaminar
      // outro elemento do mesmo tipo/rota (bug do "desmarca no F5").
      if (item._roteiroRefId) return el.refId === item._roteiroRefId;
      const idAlvo = tipo === 'transporte' ? el.trechoId : el.expId;
      if (item._dbId) return String(idAlvo) === String(item._dbId);
      return false;
    };
    const aplicarEm = (rot) => {
      if (!rot) return false;
      const dias = Array.isArray(rot) ? rot : (rot.dias || []);
      let mudou = false;
      dias.forEach(d => (d.elementos || []).forEach(el => {
        if (casa(el)) {
          Object.keys(patch).forEach(k => {
            // eslint-disable-next-line eqeqeq
            if (el[k] != patch[k]) { el[k] = patch[k]; mudou = true; }
          });
        }
      }));
      return mudou;
    };
    // 1) cache dbRotas: abrir o roteiro depois já vem com o valor certo
    if (chave && window.dbRotas[chave]) {
      aplicarEm(window.dbRotas[chave]);
      // 1b) se a VISUALIZAÇÃO (não-editor) do mesmo roteiro está na tela, re-renderiza na hora
      try {
        if (typeof window.roteiroAtualVisualizado !== 'undefined' && window.roteiroAtualVisualizado === chave
            && typeof window.renderizarRoteiro === 'function') {
          window.renderizarRoteiro(chave);
        }
      } catch (e3) {}
    }
    // 2) editor aberto no mesmo roteiro: atualiza na hora
    try {
      if (typeof roteiroEmEdicao !== 'undefined' && roteiroEmEdicao) {
        const mesmo = (rid && roteiroEmEdicao.id === rid) ||
                      (chave && typeof roteiroOriginalNome !== 'undefined' && roteiroOriginalNome === chave);
        if (mesmo) {
          const mudou = aplicarEm(roteiroEmEdicao);
          if (mudou && typeof window.renderEditDias === 'function') window.renderEditDias();
        }
      }
    } catch (e2) {}
  } catch (e) {}
}
// Wrapper retrocompatível: usado pelos toggles de compradoHeian.
function refletirCompradoHeianLocal(item, tipo, isHeian) {
  refletirItemLocal(item, tipo, { compradoHeian: isHeian });
}

function preencherExp(id, dbId) {
  const e = state.orcamento.experiencias.find(x=>x.id===id);
  const db = state.experienciasDB.find(x=>x.id==dbId);
  if(e&&db){ e._dbId=db.id; e.nome=db.nome; e.preco=db.preco_jpy; e.observacao=db.observacao||'';
    const _campos = { expId: e._dbId, nomeExp: e.nome };
    sincronizarCamposComRoteiro(e, 'experiencia', _campos);
    refletirItemLocal(e, 'experiencia', _campos);
  }
  else if(e) e._dbId=null;
  renderExperienciasForm(); updateResumo();
}

// ── PROPAGAR PESSOAS ─────────────────────────────────────────────────────────
function propagarPessoas() {
  const ad = parseInt(document.getElementById('clienteAdultos')?.value) || 0;
  const cr = parseInt(document.getElementById('clienteCriancas')?.value) || 0;
  const num = ad + cr;
  if (!num || isNaN(num)) return;
  state.orcamento.transportes.forEach(t => { t.adultos = ad; t.criancas = cr; });
  state.orcamento.experiencias.forEach(e => { e.pessoas = num; });
  renderTransportesForm();
  renderExperienciasForm();
  updateResumo();
}

// ── ITENS ADICIONAIS ──────────────────────────────────────────────────────────
function addItemAdicional() {
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
  if (!state.orcamento.itensAdicionais) state.orcamento.itensAdicionais = [];
  state.orcamento.itensAdicionais.push({ id: Date.now(), descricao: '', valor: 0 });
  renderItensAdicionaisForm();
  updateResumo();
}

function renderItensAdicionaisForm() {
  const cont = document.getElementById('itensAdicionaisList');
  if (!cont) return;
  cont.innerHTML = '';
  const itens = state.orcamento.itensAdicionais || [];
  itens.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div class="item-row-header">
        <span class="item-row-num">Item Adicional ${i+1}</span>
        <span class="item-subtotal" id="subtotal-item-adicional-${item.id}">¥${fmt(item.valor)} · ${fmtUSD(item.valor * getUSD())}</span>
        <button class="btn-remove" onclick="rmItemAdicional(${item.id})">✕</button>
      </div>
      <div class="form-grid">
        <div class="field full-width"><label>Descrição</label>
          <input type="text" value="${item.descricao}" placeholder="Ex: Serviço de guia noturno adicional ou taxas extras" oninput="updItemAdicionalField(${item.id},'descricao',this.value)"></div>
        <div class="field"><label>Valor ¥</label>
          <input type="number" value="${item.valor||''}" placeholder="Ex: 15000"
            oninput="updItemAdicionalNum(${item.id},'valor',this.value)"
            onblur="updItemAdicionalRefresh(${item.id},'valor',this.value)"></div>
      </div>`;
    cont.appendChild(div);
  });
}

function rmItemAdicional(id) {
  if (typeof window.registrarEstadoCotacao === 'function') {
    window.registrarEstadoCotacao(state.orcamento);
  }
  state.orcamento.itensAdicionais = (state.orcamento.itensAdicionais || []).filter(item => item.id !== id);
  renderItensAdicionaisForm();
  updateResumo();
}

function updItemAdicionalField(id, f, v) {
  const item = (state.orcamento.itensAdicionais || []).find(x => x.id === id);
  if (item) {
    item[f] = v;
    updateResumo();
  }
}

function updItemAdicionalNum(id, f, rawVal) {
  const item = (state.orcamento.itensAdicionais || []).find(x => x.id === id);
  if (!item) return;
  item[f] = parseFloat(rawVal) || 0;
  const el = document.getElementById(`subtotal-item-adicional-${id}`);
  if (el) el.textContent = `¥${fmt(item.valor)} · ${fmtUSD(item.valor * getUSD())}`;
  updateResumo();
}

function updItemAdicionalRefresh(id, f, v) {
  const item = (state.orcamento.itensAdicionais || []).find(x => x.id === id);
  if (!item) return;
  item[f] = parseFloat(v) || 0;
  renderItensAdicionaisForm();
  updateResumo();
}

// ── CÁLCULOS ──────────────────────────────────────────────────────────────────
function getUSD() { return parseFloat(state?.config?.cambio_jpy_usd)||0.006280; }
function getConsultoriaVal() {
  const tog = document.getElementById('consultoriaToggle');
  return tog?.checked ? (parseFloat(document.getElementById('consultoriaValor')?.value)||0) : 0;
}

function updateResumo() {
  autoSave();
  const tT = (state.orcamento.tours||[]).reduce((sum, t) => sum + calcTotalTour(t), 0);
  const tTr = state.orcamento.transportes.filter(t=>t.compradoHeian!==false).reduce((s,t)=>s+calcTotalTransporte(t),0);
  const tEx = state.orcamento.experiencias.filter(e=>e.compradoHeian!==false).reduce((s,e)=>s+calcTotalExp(e),0);
  const tItens = (state.orcamento.itensAdicionais||[]).reduce((s,i)=>s+(i.valor||0),0);
  const cons = getConsultoriaVal();
  const total = tT+tTr+tEx+tItens+cons;
  const sinal = tT*0.30 + tTr + tEx + tItens + cons; // ENTRADA = 30% tours + 100% do resto (= total - 70% tours)
  const usd = getUSD();
  const tx = state.orcamento.textos || {};
  const lblCons = tx.lblCons || document.getElementById('tx_lblCons')?.value.trim() || 'Roteirização e Suporte';
  document.getElementById('resumoGrid').innerHTML = `
    <div class="resumo-item"><div class="resumo-label">Total Tours</div><div class="resumo-valor">¥${fmt(tT)}</div><div class="resumo-sub">${fmtUSD(tT*usd)}</div></div>
    <div class="resumo-item"><div class="resumo-label">Total Transportes</div><div class="resumo-valor">¥${fmt(tTr)}</div><div class="resumo-sub">${fmtUSD(tTr*usd)}</div></div>
    <div class="resumo-item"><div class="resumo-label">Total Experiências</div><div class="resumo-valor">¥${fmt(tEx)}</div><div class="resumo-sub">${fmtUSD(tEx*usd)}</div></div>
    ${tItens>0?`<div class="resumo-item"><div class="resumo-label">Itens Adicionais</div><div class="resumo-valor">¥${fmt(tItens)}</div><div class="resumo-sub">${fmtUSD(tItens*usd)}</div></div>`:''}
    ${cons>0?`<div class="resumo-item"><div class="resumo-label">${lblCons}</div><div class="resumo-valor">¥${fmt(cons)}</div><div class="resumo-sub">${fmtUSD(cons*usd)}</div></div>`:''}
    <div class="resumo-item destaque"><div class="resumo-label">Total Geral</div><div class="resumo-valor">¥${fmt(total)}</div><div class="resumo-sub">${fmtUSD(total*usd)}</div></div>
    <div class="resumo-item gold"><div class="resumo-label">Primeiro Pagamento (Entrada)</div><div class="resumo-valor">¥${fmt(sinal)}</div><div class="resumo-sub">${fmtUSD(sinal*usd)}</div></div>
    <div class="resumo-item"><div class="resumo-label">Saldo (70% dos Tours)</div><div class="resumo-valor">¥${fmt(total-sinal)}</div><div class="resumo-sub">${fmtUSD((total-sinal)*usd)}</div></div>`;
}
