// ── MÓDULO: CADASTRO/EDIÇÃO MANUAL DE EVENTOS OPERACIONAIS ──────────────────
// Extraído de app.js em 2026-07-27 (fatiamento seguro). Carregado APÓS app.js.
// Funções globais (window.*): abrir/fechar/preencher/salvar modal de evento do calendário.

// ── FUNÇÕES PARA CADASTRO MANUAL DE EVENTOS OPERACIONAIS ───────────────────
console.log("[Novo Evento] Script app.js com cadastro de eventos carregado (v20260612_v2).");

window.abrirModalCriarEventoCalendario = function(eventoEdicao) {
  console.log("[Novo Evento] abrirModalCriarEventoCalendario() chamada.", eventoEdicao ? '(edição)' : '(novo)');
  const modoEdicao = !!(eventoEdicao && eventoEdicao.id);
  window.__calEditandoEventoId = modoEdicao ? eventoEdicao.id : null;
  // 1. Carregar clientes no select
  const selectCli = document.getElementById('modalCriarEvCliente');
  if (selectCli) {
    selectCli.innerHTML = '<option value="cliente_desconhecido">Nenhum / Cliente Avulso</option>';
    if (typeof notionClients !== 'undefined' && notionClients.length > 0) {
      notionClients.forEach(c => {
        selectCli.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
      });
    }
  }

  // 2. Carregar colaboradores no container
  const containerGuias = document.getElementById('modalCriarEvGuiasContainer');
  if (containerGuias) {
    if (typeof calColaboradores !== 'undefined' && calColaboradores.length > 0) {
      containerGuias.innerHTML = calColaboradores.map(col => `
        <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--ink-dk); cursor:pointer; margin:0;">
          <input type="checkbox" class="modal-criar-ev-guia-checkbox" value="${col.id}" style="width:14px; height:14px; margin:0; cursor:pointer;">
          <span>${col.name}</span>
        </label>
      `).join('');
    } else {
      containerGuias.innerHTML = '<span style="font-size:11px; color:var(--ink-lt);">Nenhum colaborador carregado</span>';
    }
  }

  // 3. Carregar contas do Notion no select contábil
  const selectConta = document.getElementById('modalCriarEvConta');
  if (selectConta) {
    selectConta.innerHTML = '<option value="">Carregando contas...</option>';
    fetch('/api/notion/contas')
      .then(res => res.json())
      .then(contas => {
        selectConta.innerHTML = '';
        if (contas && contas.length > 0) {
          contas.forEach(c => {
            selectConta.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
          });
        } else {
          selectConta.innerHTML = '<option value="">Nenhuma conta encontrada</option>';
        }
      })
      .catch(err => {
        console.error('Erro ao carregar contas:', err);
        selectConta.innerHTML = '<option value="">Erro ao obter contas</option>';
      });
  }

  // 4. Resetar inputs e campos
  document.getElementById('modalCriarEvTitulo').value = '';
  document.getElementById('modalCriarEvCidade').value = '';
  document.getElementById('modalCriarEvValorDiaria').value = '';
  document.getElementById('modalCriarEvTourHora').value = '';
  document.getElementById('modalCriarEvTourLocal').value = '';
  document.getElementById('modalCriarEvTourDuracao').value = '';
  document.getElementById('modalCriarEvTranspHora').value = '';
  document.getElementById('modalCriarEvTranspOrigem').value = '';
  document.getElementById('modalCriarEvTranspDestino').value = '';
  document.getElementById('modalCriarEvTranspLinha').value = '';
  document.getElementById('modalCriarEvTranspCategoria').value = '';
  document.getElementById('modalCriarEvTranspTempo').value = '';
  document.getElementById('modalCriarEvExpNome').value = '';
  document.getElementById('modalCriarEvExpHora').value = '';
  document.getElementById('modalCriarEvExpLocalEncontro').value = '';
  document.getElementById('modalCriarEvPassageiros').value = '2';
  document.getElementById('modalCriarEvObservacoes').value = '';

  // Resetar contabilidade
  document.getElementById('modalCriarEvCustoValor').value = '';
  const checkLancar = document.getElementById('modalCriarEvLancarFinanceiro');
  if (checkLancar) checkLancar.checked = false;
  window.onLancarFinanceiroChange();

  // Resetar data
  const inputData = document.getElementById('modalCriarEvData');
  if (inputData) {
    const hoje = new Date();
    const y = hoje.getFullYear();
    const m = String(hoje.getMonth() + 1).padStart(2, '0');
    const d = String(hoje.getDate()).padStart(2, '0');
    inputData.value = `${y}-${m}-${d}`;
  }

  // Forçar Roteiro padrão
  document.getElementById('modalCriarEvTipoServico').value = 'Roteiro';
  window.onTipoServicoCriarChange();

  // === Ajustar cabeçalho/botão e pré-preencher se estiver editando ===
  const tituloModalEl = document.getElementById('modalCriarEvHeaderTitle');
  const btnConfirmar = document.getElementById('btnConfirmarCriarEvento');
  if (modoEdicao) {
    if (tituloModalEl) tituloModalEl.innerText = 'Editar Evento';
    if (btnConfirmar) btnConfirmar.innerText = 'Salvar Alterações';
    window.preencherModalEdicaoEvento(eventoEdicao);
  } else {
    if (tituloModalEl) tituloModalEl.innerText = 'Novo Evento no Calendário';
    if (btnConfirmar) btnConfirmar.innerText = 'Salvar Evento';
  }

  // Exibir Modal
  const modal = document.getElementById('modalAdicionarEventoCalendario');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    modal.classList.add('active');
  }
};

window.fecharModalCriarEventoCalendario = function() {
  const modal = document.getElementById('modalAdicionarEventoCalendario');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.add('hidden');
    modal.classList.remove('active');
  }
};

window.onTipoServicoCriarChange = function() {
  const tipo = document.getElementById('modalCriarEvTipoServico').value;
  document.getElementById('modalCriarEvPainelTour').style.display = tipo === 'Roteiro' ? 'block' : 'none';
  document.getElementById('modalCriarEvPainelTransporte').style.display = tipo === 'Transporte' ? 'block' : 'none';
  document.getElementById('modalCriarEvPainelExperiencia').style.display = tipo === 'Experiência' ? 'block' : 'none';
  
  // Atualizar contabilidade
  window.atualizarVisibilidadeSecaoContabil();
};

window.atualizarVisibilidadeSecaoContabil = function() {
  const tipo = document.getElementById('modalCriarEvTipoServico').value;
  let emitidoHeian = false;

  if (tipo === 'Transporte') {
    const radio = document.querySelector('input[name="modalCriarEvTranspCompradoHeian"]:checked');
    emitidoHeian = radio ? radio.value === 'sim' : true;
  } else if (tipo === 'Experiência') {
    const radio = document.querySelector('input[name="modalCriarEvExpCompradoHeian"]:checked');
    emitidoHeian = radio ? radio.value === 'sim' : true;
  }

  const secao = document.getElementById('modalCriarEvSecaoContabil');
  if (secao) {
    secao.style.display = (emitidoHeian && (tipo === 'Transporte' || tipo === 'Experiência')) ? 'block' : 'none';
  }
};

window.onLancarFinanceiroChange = function() {
  const checkbox = document.getElementById('modalCriarEvLancarFinanceiro');
  const contaWrapper = document.getElementById('modalCriarEvContaWrapper');
  if (contaWrapper) {
    contaWrapper.style.display = checkbox && checkbox.checked ? 'block' : 'none';
  }
};

window.preencherModalEdicaoEvento = function(ev) {
  // Campos comuns
  document.getElementById('modalCriarEvTitulo').value = ev.titulo || '';
  document.getElementById('modalCriarEvCidade').value = ev.cidade || '';
  if (ev.dataServico) document.getElementById('modalCriarEvData').value = ev.dataServico;

  // Cliente
  const selCli = document.getElementById('modalCriarEvCliente');
  if (selCli) {
    const cliId = ev.clienteId || (ev.clientes && ev.clientes[0]) || 'cliente_desconhecido';
    selCli.value = cliId;
    if (selCli.value !== cliId) selCli.value = 'cliente_desconhecido';
  }

  // Observações (guardadas em textos[0], ou nos richInfo)
  const obs = (ev.textos && ev.textos[0]) || ev.observacoes ||
              (ev.transportInfo && ev.transportInfo.observacoes) ||
              (ev.expInfo && ev.expInfo.observacoes) || '';
  document.getElementById('modalCriarEvObservacoes').value = obs;

  // Tipo de serviço + painel
  const tipo = ev.tipoServico || 'Roteiro';
  const selTipo = document.getElementById('modalCriarEvTipoServico');
  if (selTipo) { selTipo.value = tipo; window.onTipoServicoCriarChange(); }

  if (tipo === 'Roteiro') {
    document.getElementById('modalCriarEvValorDiaria').value = (ev.valorDiaria != null ? ev.valorDiaria : '');
    document.getElementById('modalCriarEvTourHora').value = ev.horaEncontro || '';
    document.getElementById('modalCriarEvTourLocal').value = ev.localEncontro || '';
    document.getElementById('modalCriarEvTourDuracao').value = ev.duracaoTour || '';
    // Marcar guias designados
    const ids = (ev.assignee || []).map(a => a.id);
    document.querySelectorAll('.modal-criar-ev-guia-checkbox').forEach(cb => {
      cb.checked = ids.includes(cb.value);
    });
  } else if (tipo === 'Transporte') {
    const ti = ev.transportInfo || {};
    const selTT = document.getElementById('modalCriarEvTranspTipo');
    if (selTT && ti.tipoTransporte) selTT.value = ti.tipoTransporte;
    document.getElementById('modalCriarEvTranspHora').value = ti.horario || '';
    document.getElementById('modalCriarEvTranspOrigem').value = ti.origem || '';
    document.getElementById('modalCriarEvTranspDestino').value = ti.destino || '';
    document.getElementById('modalCriarEvTranspLinha').value = ti.linha || '';
    document.getElementById('modalCriarEvTranspCategoria').value = ti.categoria || '';
    document.getElementById('modalCriarEvTranspTempo').value = ti.tempo || '';
    if (ti.adultos) document.getElementById('modalCriarEvPassageiros').value = ti.adultos;
    const radioT = document.querySelector(`input[name="modalCriarEvTranspCompradoHeian"][value="${ti.compradoHeian === false ? 'nao' : 'sim'}"]`);
    if (radioT) radioT.checked = true;
    const custoT = document.getElementById('modalCriarEvCustoValor');
    if (custoT && ti.custoValor != null) custoT.value = ti.custoValor;
    window.atualizarVisibilidadeSecaoContabil();
  } else if (tipo === 'Experiência') {
    const ei = ev.expInfo || {};
    document.getElementById('modalCriarEvExpNome').value = ei.nomeExp || '';
    document.getElementById('modalCriarEvExpHora').value = ei.horaPartida || '';
    document.getElementById('modalCriarEvExpLocalEncontro').value = ev.localEncontro || ei.localEncontro || '';
    if (ei.adultos) document.getElementById('modalCriarEvPassageiros').value = ei.adultos;
    const radioE = document.querySelector(`input[name="modalCriarEvExpCompradoHeian"][value="${ei.compradoHeian === false ? 'nao' : 'sim'}"]`);
    if (radioE) radioE.checked = true;
    const custoE = document.getElementById('modalCriarEvCustoValor');
    if (custoE && ei.custoValor != null) custoE.value = ei.custoValor;
    window.atualizarVisibilidadeSecaoContabil();
  }
};

window.salvarNovoEventoCalendario = function() {
  const titulo = document.getElementById('modalCriarEvTitulo').value.trim();
  const tipoServico = document.getElementById('modalCriarEvTipoServico').value;
  const dataServico = document.getElementById('modalCriarEvData').value;

  if (!titulo || !dataServico) {
    alert('Por favor, preencha os campos obrigatórios (*): Título e Data do Serviço.');
    return;
  }

  const clienteId = document.getElementById('modalCriarEvCliente').value;
  const cidade = document.getElementById('modalCriarEvCidade').value.trim();
  const passageiros = document.getElementById('modalCriarEvPassageiros').value || 2;
  const observacoes = document.getElementById('modalCriarEvObservacoes').value.trim();

  let richData = {};
  let valorDiaria = null;
  let assigneeIds = [];
  
  // Coletar dados contábeis se visíveis
  let lancarFinanceiro = false;
  let contaFinanceiraId = null;
  let valorCusto = null;

  const secaoContabil = document.getElementById('modalCriarEvSecaoContabil');
  if (secaoContabil && secaoContabil.style.display !== 'none') {
    valorCusto = Number(document.getElementById('modalCriarEvCustoValor').value) || null;
    const checkLancar = document.getElementById('modalCriarEvLancarFinanceiro');
    lancarFinanceiro = checkLancar ? checkLancar.checked : false;
    if (lancarFinanceiro) {
      contaFinanceiraId = document.getElementById('modalCriarEvConta').value;
      if (!contaFinanceiraId || !valorCusto) {
        alert('Por favor, defina o Valor do Custo e selecione a Conta de Origem para lançar na contabilidade.');
        return;
      }
    }
  }

  if (tipoServico === 'Roteiro') {
    valorDiaria = Number(document.getElementById('modalCriarEvValorDiaria').value) || null;
    richData = {
      horaEncontro: document.getElementById('modalCriarEvTourHora').value.trim(),
      localEncontro: document.getElementById('modalCriarEvTourLocal').value.trim(),
      duracaoTour: document.getElementById('modalCriarEvTourDuracao').value.trim()
    };
    const checkboxes = document.querySelectorAll('.modal-criar-ev-guia-checkbox:checked');
    checkboxes.forEach(cb => assigneeIds.push(cb.value));
  } else if (tipoServico === 'Transporte') {
    const radioComp = document.querySelector('input[name="modalCriarEvTranspCompradoHeian"]:checked');
    richData = {
      tipoTransporte: document.getElementById('modalCriarEvTranspTipo').value,
      horario: document.getElementById('modalCriarEvTranspHora').value.trim(),
      origem: document.getElementById('modalCriarEvTranspOrigem').value.trim(),
      destino: document.getElementById('modalCriarEvTranspDestino').value.trim(),
      linha: document.getElementById('modalCriarEvTranspLinha').value.trim(),
      categoria: document.getElementById('modalCriarEvTranspCategoria').value.trim(),
      tempo: document.getElementById('modalCriarEvTranspTempo').value.trim(),
      adultos: passageiros,
      compradoHeian: radioComp ? radioComp.value === 'sim' : true
    };
  } else if (tipoServico === 'Experiência') {
    const radioComp = document.querySelector('input[name="modalCriarEvExpCompradoHeian"]:checked');
    richData = {
      nomeExp: document.getElementById('modalCriarEvExpNome').value.trim() || titulo,
      horaPartida: document.getElementById('modalCriarEvExpHora').value.trim(),
      localEncontro: document.getElementById('modalCriarEvExpLocalEncontro').value.trim(),
      adultos: passageiros,
      compradoHeian: radioComp ? radioComp.value === 'sim' : true,
      observacoes: observacoes
    };
  }

  const editandoId = window.__calEditandoEventoId || null;
  const btn = document.getElementById('btnConfirmarCriarEvento');
  const labelBtn = editandoId ? 'Salvar Alterações' : 'Salvar Evento';
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Salvando...';
  }

  const payload = {
    titulo,
    tipoServico,
    dataServico,
    clienteId,
    cidade,
    valorDiaria,
    assigneeIds,
    observacoes,
    richData,
    lancarFinanceiro,
    contaFinanceiraId,
    valorCusto
  };

  const url = editandoId ? `/api/calendario/eventos/${editandoId}` : '/api/calendario/eventos';
  const method = editandoId ? 'PATCH' : 'POST';

  fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      if (editandoId) {
        alert('Evento atualizado com sucesso!');
        window.__calEditandoEventoId = null;
      } else {
        alert('Evento cadastrado e sincronizado com sucesso!');
        if (typeof calEventos !== 'undefined' && data.event) {
          calEventos.push(data.event);
        }
      }
      window.fecharModalCriarEventoCalendario();
      if (typeof carregarCalendario !== 'undefined') {
        carregarCalendario();
      } else {
        window.location.reload();
      }
    } else {
      alert('Erro ao salvar o evento: ' + (data.error || 'Erro desconhecido'));
    }
  })
  .catch(err => {
    console.error('Erro na requisição:', err);
    alert('Erro ao conectar com o servidor para salvar o evento.');
  })
  .finally(() => {
    if (btn) {
      btn.disabled = false;
      btn.innerText = labelBtn;
    }
  });
};


