// ── MÓDULO: SISTEMA DE CALENDÁRIO (render, navegação, modal de detalhe, delete, sync) ──
// Extraído de app.js em 2026-07-28 (Fatia 2 do fatiamento seguro). Carregado APÓS app.js.
// Funções globais (window.* e declarações de função) do calendário operacional.
// OBS: `calEventos` e `calColaboradores` continuam declarados em app.js (compartilhados com a
//      seção Colaboradores/Dashboard); este módulo os acessa via escopo global (app.js carrega antes).

// ── SISTEMA DE CALENDÁRIO COM INTEGRAÇÃO DE GUIAS ────────────────────────────
let calCurrentDate = new Date();
let calSelectedEvent = null;

// Inicialização e navegação de meses do calendário (Lista padrão no Mobile)
let calViewMode = window.innerWidth <= 768 ? 'list' : 'grid';

async function sincronizarCalendarioDoNotion() {
  const btn = document.getElementById('btnSyncNotionCalendario');
  if (!btn) return;

  const oldText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '⌛ Sincronizando...';
  document.body.style.cursor = 'wait';

  try {
    const response = await fetch('/api/calendario/sincronizar-do-notion', {
      method: 'POST'
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Erro na requisição');
    }

    const data = await response.json();
    alert(`Calendário sincronizado com sucesso! ${data.count} eventos carregados do Notion.`);
    
    if (typeof renderCalendario === 'function') {
      renderCalendario();
    }
  } catch (err) {
    console.error(err);
    alert('Erro ao sincronizar calendário do Notion: ' + err.message);
  } finally {
    document.body.style.cursor = 'default';
    btn.disabled = false;
    btn.innerHTML = oldText;
  }
}
window.sincronizarCalendarioDoNotion = sincronizarCalendarioDoNotion;

document.addEventListener('DOMContentLoaded', () => {
  const prevBtn = document.getElementById('calendarPrevMonthBtn');
  const nextBtn = document.getElementById('calendarNextMonthBtn');
  const filterCliente = document.getElementById('calendarFilterCliente');
  const refreshBtn = document.getElementById('btnRefreshCalendario');
  const modalSaveBtn = document.getElementById('calEventModalSaveBtn');
  const gridViewBtn = document.getElementById('btnCalViewGrid');
  const listViewBtn = document.getElementById('btnCalViewList');

  if (prevBtn) prevBtn.addEventListener('click', () => navegarMesCalendario(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => navegarMesCalendario(1));
  if (filterCliente) filterCliente.addEventListener('change', () => renderCalendario());
  if (refreshBtn) refreshBtn.addEventListener('click', () => renderCalendario());
  if (modalSaveBtn) modalSaveBtn.addEventListener('click', salvarAtribuicaoGuia);

  // Configurar display inicial ativo de acordo com o modo calViewMode
  if (calViewMode === 'list') {
    if (listViewBtn) listViewBtn.classList.add('active');
    if (gridViewBtn) gridViewBtn.classList.remove('active');
    const gw = document.getElementById('calendarioGridWrapper');
    const lw = document.getElementById('calendarioListaWrapper');
    if (gw) gw.style.display = 'none';
    if (lw) lw.style.display = 'flex';
  } else {
    if (gridViewBtn) gridViewBtn.classList.add('active');
    if (listViewBtn) listViewBtn.classList.remove('active');
    const gw = document.getElementById('calendarioGridWrapper');
    const lw = document.getElementById('calendarioListaWrapper');
    if (gw) gw.style.display = 'grid';
    if (lw) lw.style.display = 'none';
  }

  if (gridViewBtn) {
    gridViewBtn.addEventListener('click', () => {
      calViewMode = 'grid';
      gridViewBtn.classList.add('active');
      if (listViewBtn) listViewBtn.classList.remove('active');
      document.getElementById('calendarioGridWrapper').style.display = 'grid';
      document.getElementById('calendarioListaWrapper').style.display = 'none';
      renderCalendario();
    });
  }
  if (listViewBtn) {
    listViewBtn.addEventListener('click', () => {
      calViewMode = 'list';
      listViewBtn.classList.add('active');
      if (gridViewBtn) gridViewBtn.classList.remove('active');
      document.getElementById('calendarioGridWrapper').style.display = 'none';
      document.getElementById('calendarioListaWrapper').style.display = 'flex';
      renderCalendario();
    });
  }
});

async function navegarMesCalendario(direcao) {
  calCurrentDate.setMonth(calCurrentDate.getMonth() + direcao);
  await renderCalendario();
}

function gerarEventCardHTML(ev, simplificado = false) {
  // Obter nome do cliente (com fallback)
  let clienteNomeStr = ev.clienteNome || '';
  if (!clienteNomeStr) {
    if (ev.clientes && ev.clientes.length > 0) {
      const cli = typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === ev.clientes[0]) : null;
      clienteNomeStr = cli ? cli.nome : 'Cliente Vinculado';
    } else {
      clienteNomeStr = 'Nenhum cliente';
    }
  }

  // Obter cidade (com fallback)
  let cidadeStr = ev.cidade || '';
  if (!cidadeStr) {
    const clientNotionId = ev.clientes && ev.clientes.length > 0 ? ev.clientes[0] : null;
    let roteiroCliente = null;
    if (clientNotionId && typeof dbRotas !== 'undefined') {
      roteiroCliente = Object.values(dbRotas).find(rot => rot.notionClienteId === clientNotionId);
    }
    if (roteiroCliente && roteiroCliente.cliente?.dataInicio) {
      const parseDateUTC = (dateStr) => {
        const [yy, mm, dd] = dateStr.split('-').map(Number);
        return new Date(Date.UTC(yy, mm - 1, dd));
      };
      const diffDays = Math.round((parseDateUTC(ev.dataServico) - parseDateUTC(roteiroCliente.cliente.dataInicio)) / (1000 * 60 * 60 * 24));
      if (roteiroCliente.dias && roteiroCliente.dias[diffDays]) {
        const diaRoteiro = roteiroCliente.dias[diffDays];
        const sequencias = (diaRoteiro.elementos || []).filter(el => el.tipo === 'sequencia');
        if (sequencias.length > 0) {
          cidadeStr = sequencias[0].cidade || '';
        }
      }
    }
    if (!cidadeStr) cidadeStr = 'Japão';
  }

  // Colaboradores (Guias) - Lógica de renderização dinâmica de rodapé
  let footerGuiaHTML = '';
  if (simplificado) {
    const guiasNomes = ev.assignee && ev.assignee.length > 0 ? ev.assignee.map(a => a.name).join(', ') : 'Nenhum guia designado';
    footerGuiaHTML = `
      <div style="border-top:1px solid var(--border); padding-top:4.2px; font-size:8.2px; color:var(--ink-mid); display:flex; align-items:center; gap:4px;">
        <span style="color:var(--ink-lt); display:inline-flex; align-items:center; gap:2px;"><svg class="v-icon no-margin" style="width:1em; height:1em;"><use href="#icon-user"></use></svg> Guia:</span> <strong>${guiasNomes}</strong>
      </div>
    `;
  } else {
    if (ev.assignee && ev.assignee.length > 1) {
      const chips = ev.assignee.map(a => 
        `<span class="colab-card-chip" style="background:rgba(107,31,42,0.06); color:var(--crimson); font-size:8px; font-weight:700; padding:1px 5px; border-radius:4px; display:inline-flex; align-items:center; gap:2px; border:1px solid rgba(107,31,42,0.12);">
          <svg class="v-icon no-margin" style="width:1em; height:1em;"><use href="#icon-user"></use></svg> ${a.name}
        </span>`
      ).join('');
      
      footerGuiaHTML = `
        <div style="border-top:1px solid var(--border); padding-top:4px; display:flex; align-items:center; justify-content:space-between; width:100%; gap:4px;" onclick="event.stopPropagation(); abrirCalendarioEventModal('${ev.id}')">
          <div style="display:flex; flex-wrap:wrap; gap:2px; align-items:center; max-width:85%; overflow:hidden;">
            ${chips}
          </div>
          <span style="font-size:9px; color:var(--ink-lt); cursor:pointer; text-decoration:underline; font-weight:600; white-space:nowrap; padding:1px 4px;">Editar</span>
        </div>
      `;
    } else {
      const guiaIdAtual = ev.assignee && ev.assignee.length > 0 ? ev.assignee[0].id : '';
      const optionsColaboradores = calColaboradores.map(col => {
        return `<option value="${col.id}" ${col.id === guiaIdAtual ? 'selected' : ''}>${col.name}</option>`;
      }).join('');
      
      footerGuiaHTML = `
        <div style="border-top:1px solid var(--border); padding-top:4px; display:flex; align-items:center; justify-content:space-between; width:100%; gap:4px;" onclick="event.stopPropagation();">
          <div style="display:flex; align-items:center; gap:4px; flex-grow:1;">
            <span style="font-size:8px; font-weight:600; color:var(--ink-mid); white-space:nowrap; display:inline-flex; align-items:center; gap:2px;"><svg class="v-icon no-margin" style="width:1em; height:1em;"><use href="#icon-user"></use></svg> Guia:</span>
            <select onchange="atualizarGuiaRapidoLista('${ev.id}', this)" class="calendar-card-select" style="flex-grow:1; max-width:110px;">
              <option value="">Nenhum guia designado</option>
              ${optionsColaboradores}
            </select>
          </div>
          <button class="btn-secondary" style="margin:0; padding:1px 4px; font-size:8px; height:18px; line-height:1; border-radius:3px; border-color:var(--border);" onclick="abrirCalendarioEventModal('${ev.id}')" title="Designar múltiplos colaboradores">
            +
          </button>
        </div>
      `;
    }
  }

  // Badges e Cores
  let badgeBg = 'rgba(107,31,42,0.06)';
  let badgeColor = 'var(--crimson)';
  const tLower = ev.tipoServico ? ev.tipoServico.toLowerCase() : '';
  
  if (tLower.includes('shinkansen') || tLower.includes('romancecar') || tLower.includes('trem') || tLower.includes('ônibus') || tLower.includes('onibus') || tLower.includes('transfer') || tLower.includes('transporte')) {
    badgeBg = 'rgba(196,163,90,0.08)';
    badgeColor = 'var(--gold-dk)';
  } else if (tLower.includes('experiência') || tLower.includes('experiencia')) {
    badgeBg = 'rgba(135,75,45,0.06)';
    badgeColor = '#7a3e20';
  }

  // Determinar classe do card para cores específicas de borda/background
  let tipoClassSuffix = 'transporte';
  if (tLower.includes('roteiro')) {
    tipoClassSuffix = 'tour';
  } else if (tLower.includes('experiência') || tLower.includes('experiencia')) {
    tipoClassSuffix = 'experiencia';
  } else {
    tipoClassSuffix = 'transporte';
  }

  const meetingTime = ev.horaEncontro || '-';

  // Se for simplificado (popover), removemos o onclick do card para não atrapalhar no hover
  const clickAttr = simplificado ? '' : `onclick="abrirCalendarioEventModal('${ev.id}')"`;

  return `
    <div class="calendar-list-event-card card-type-${tipoClassSuffix}" ${clickAttr} style="${simplificado ? 'box-shadow:none; border:none; background:transparent; padding:0; margin:0;' : ''}">
      <!-- Parte Superior do Card -->
      <div style="display:flex; flex-direction:column; gap:3px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px;">
          <span class="compact-card-status" style="background:${badgeBg}; color:${badgeColor}; font-size:8px; text-transform:uppercase; padding:1px 4px; border-radius:3px; font-weight:600;">
            ${ev.tipoServico || 'Serviço'}
          </span>
          <span style="font-size:9px; font-weight:700; color:var(--ink-mid);">
            ${meetingTime}
          </span>
        </div>
        <h4 style="margin:1px 0 0 0; font-family:var(--ff-display); font-size:11px; font-weight:700; color:var(--ink-dk); line-height:1.3;">
          ${ev.titulo}
        </h4>
        <div style="display:flex; flex-direction:column; gap:1px; margin-top:1px; font-size:9px; color:var(--ink-mid);">
          <div>
            <span style="color:var(--ink-lt);">Cliente:</span> <strong>${clienteNomeStr}</strong>
          </div>
          <div>
            <span style="color:var(--ink-lt);">Cidade:</span> <strong>${cidadeStr}</strong>
          </div>
        </div>
      </div>

      <!-- Parte Inferior do Card: Guia -->
      ${footerGuiaHTML}
    </div>
  `;
}

function criarEventPopover() {
  let popover = document.getElementById('calendarioEventPopover');
  if (!popover) {
    popover = document.createElement('div');
    popover.id = 'calendarioEventPopover';
    popover.className = 'calendar-event-popover';
    popover.style.display = 'none';
    document.body.appendChild(popover);
  }
}

function showEventPopover(e, eventId) {
  const badge = e.currentTarget;
  const ev = calEventos.find(item => item.id === eventId);
  if (!ev) return;

  criarEventPopover();
  const popover = document.getElementById('calendarioEventPopover');
  if (!popover) return;

  // Injetar o HTML do card simplificado
  popover.innerHTML = gerarEventCardHTML(ev, true);

  // Posicionar
  const rect = badge.getBoundingClientRect();
  let topPos = rect.bottom + 8;
  let leftPos = rect.left;

  // Ajustar se passar da altura ou largura da tela
  if (topPos + 180 > window.innerHeight) {
    topPos = rect.top - 190;
  }
  if (leftPos + 300 > window.innerWidth) {
    leftPos = window.innerWidth - 320;
  }
  if (leftPos < 10) leftPos = 10;

  popover.style.top = topPos + 'px';
  popover.style.left = leftPos + 'px';
  popover.style.display = 'block';
  // Forçar reflow para ativar transição de opacidade
  popover.offsetHeight; 
  popover.classList.add('visible');
}

function hideEventPopover() {
  const popover = document.getElementById('calendarioEventPopover');
  if (popover) {
    popover.classList.remove('visible');
    popover.style.display = 'none';
  }
}

async function atualizarDataEvento(eventId, novaData) {
  showToast('Atualizando data do serviço...');
  try {
    const res = await fetch(`/api/calendario/eventos/${eventId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ dataServico: novaData })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Falha ao atualizar data no servidor');
    }
    
    // Atualizar no cache local de eventos
    const evIndex = calEventos.findIndex(e => e.id === eventId);
    if (evIndex > -1) {
      calEventos[evIndex].dataServico = novaData;
    }
    
    showToast('Data atualizada com sucesso!');
    await renderCalendario(); // Re-renderizar calendário
  } catch (err) {
    console.error('Erro ao mover evento:', err);
    alert('Erro ao alterar data do evento: ' + err.message);
    await renderCalendario(); // Resetar visual em caso de erro
  }
}

window.renderCalendario = async function() {
  const titleEl = document.getElementById('calendarMonthYearTitle');
  const gridEl = document.getElementById('calendarioGrid');
  const filterCliente = document.getElementById('calendarFilterCliente');
  const listEl = document.getElementById('calendarioListaWrapper');
  if (!titleEl || !gridEl) return;

  // 1. Atualizar Título do Mês/Ano
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  titleEl.innerText = `${meses[calCurrentDate.getMonth()]} ${calCurrentDate.getFullYear()}`;

  if (calViewMode === 'grid') {
    gridEl.innerHTML = '<div style="grid-column: span 7; text-align: center; padding: 40px; color: var(--ink-lt);">Carregando calendário do Notion...</div>';
  } else if (listEl) {
    listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--ink-lt);">Carregando calendário do Notion...</div>';
  }

  // 2. Carregar Colaboradores (Guias) se necessário
  if (calColaboradores.length === 0) {
    try {
      const res = await fetch('/api/notion/colaboradores');
      if (res.ok) {
        calColaboradores = await res.json();
        window.calColaboradores = calColaboradores;
        // Popular dropdown no modal de edição
        const select = document.getElementById('calEventModalAssigneeSelect');
        if (select) {
          select.innerHTML = '<option value="">Nenhum guia designado</option>';
          calColaboradores.forEach(col => {
            select.innerHTML += `<option value="${col.id}">${col.name}</option>`;
          });
        }
      }
    } catch (e) {
      console.error('Erro ao carregar colaboradores:', e);
    }
  }

  // 3. Carregar Clientes se necessário para o Dropdown de filtro
  if (filterCliente && filterCliente.options.length <= 1) {
    let clis = [];
    if (typeof notionClients !== 'undefined' && notionClients.length > 0) {
      clis = notionClients;
    } else {
      try {
        const res = await fetch('/api/notion/clientes');
        if (res.ok) clis = await res.json();
      } catch (e) {
        console.error(e);
      }
    }
    clis.forEach(c => {
      filterCliente.innerHTML += `<option value="${c.id}">${c.nome}</option>`;
    });
  }

  // 4. Determinar datas de início e fim do mês
  const ano = calCurrentDate.getFullYear();
  const mes = calCurrentDate.getMonth();
  
  // Data de início (YYYY-MM-DD): primeiro dia do mês
  const dataInicioStr = `${ano}-${String(mes + 1).padStart(2, '0')}-01`;
  
  // Data de fim (YYYY-MM-DD): último dia do mês
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const dataFimStr = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

  // 5. Carregar Eventos da API
  const clienteFiltroId = filterCliente ? filterCliente.value : '';
  let url = `/api/calendario/eventos?data_inicio=${dataInicioStr}&data_fim=${dataFimStr}`;
  if (clienteFiltroId) url += `&cliente_id=${clienteFiltroId}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Falha ao buscar eventos');
    calEventos = await res.json();
  } catch (err) {
    console.error(err);
    const errHTML = '<div style="text-align: center; padding: 40px; color: #c00;">Erro ao carregar eventos do Notion. Verifique as credenciais no .env.</div>';
    if (calViewMode === 'grid') gridEl.innerHTML = errHTML;
    else if (listEl) listEl.innerHTML = errHTML;
    return;
  }

  // 6. Desenhar baseado no modo selecionado
  const hoje = new Date();
  const hojeReset = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  if (calViewMode === 'grid') {
    gridEl.innerHTML = '';

    const primeiroDiaSemana = new Date(ano, mes, 1).getDay(); // 0 (Dom) a 6 (Sáb)
    const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
    const totalDiasMesAnterior = new Date(ano, mes, 0).getDate();

    // Dias do Mês Anterior (células vazias/cinza)
    for (let i = primeiroDiaSemana - 1; i >= 0; i--) {
      const diaNum = totalDiasMesAnterior - i;
      let anoAnt = ano;
      let mesAnt = mes - 1;
      if (mesAnt < 0) {
        mesAnt = 11;
        anoAnt--;
      }
      const diaDataAnt = new Date(anoAnt, mesAnt, diaNum);
      const isPastAnt = diaDataAnt < hojeReset;

      gridEl.innerHTML += `
        <div class="calendar-cell other-month ${isPastAnt ? 'past-day' : ''}">
          <span class="calendar-cell-num">${diaNum}</span>
          <div class="calendar-events-list"></div>
        </div>
      `;
    }

    // Dias do Mês Atual
    for (let dia = 1; dia <= totalDiasMes; dia++) {
      const dateKey = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const isToday = hoje.getFullYear() === ano && hoje.getMonth() === mes && hoje.getDate() === dia;
      
      // Filtrar eventos do dia
      const eventosDia = calEventos.filter(ev => ev.dataServico === dateKey);

      let eventosHTML = eventosDia.map(ev => {
        let tipoClass = 'event-type-transfer';
        const tLower = ev.tipoServico ? ev.tipoServico.toLowerCase() : '';
        const titleLower = ev.titulo ? ev.titulo.toLowerCase() : '';
        const idLower = ev.id ? ev.id.toLowerCase() : '';

        if (idLower.startsWith('cal_exp_') || tLower.includes('experiência') || tLower.includes('experiencia') || titleLower.includes('disney') || titleLower.includes('universal') || titleLower.includes('teamlab') || titleLower.includes('sky') || titleLower.includes('museum') || titleLower.includes('ingresso') || titleLower.includes('atração') || titleLower.includes('atracao')) {
          tipoClass = 'event-type-experiencia';
        } else if (tLower.includes('roteiro') || tLower.includes('guia') || tLower.includes('tour') || titleLower.includes('tour') || titleLower.includes('guiado') || titleLower.includes('clássica') || titleLower.includes('classica') || titleLower.includes('oeste') || titleLower.includes('moderna')) {
          tipoClass = 'event-type-roteiro';
        } else {
          tipoClass = 'event-type-transfer';
        }
        
        const guiaText = ev.assignee.length > 0 ? ` [${ev.assignee.map(a => a.name).join(', ')}]` : '';
        return `
          <div class="calendar-event-badge calendar-event-item ${tipoClass} draggable-event" draggable="true" data-event-id="${ev.id}" onclick="event.stopPropagation(); abrirCalendarioEventModal('${ev.id}')">
            ${ev.titulo}${guiaText}
          </div>
        `;
      }).join('');

      const diaData = new Date(ano, mes, dia);
      const isPast = diaData < hojeReset;

      gridEl.innerHTML += `
        <div class="calendar-cell drop-zone-cell ${isToday ? 'today' : ''} ${isPast ? 'past-day' : ''}" data-date="${dateKey}">
          <span class="calendar-cell-num">${dia}</span>
          <div class="calendar-events-list">
            ${eventHTMLs(eventosHTML)}
          </div>
        </div>
      `;
    }

    // Dias do Mês Seguinte
    const totalCelulasAteAgora = primeiroDiaSemana + totalDiasMes;
    const celulasRestantes = (7 - (totalCelulasAteAgora % 7)) % 7;
    for (let dia = 1; dia <= celulasRestantes; dia++) {
      let anoSeg = ano;
      let mesSeg = mes + 1;
      if (mesSeg > 11) {
        mesSeg = 0;
        anoSeg++;
      }
      const diaDataSeg = new Date(anoSeg, mesSeg, dia);
      const isPastSeg = diaDataSeg < hojeReset;

      gridEl.innerHTML += `
        <div class="calendar-cell other-month ${isPastSeg ? 'past-day' : ''}">
          <span class="calendar-cell-num">${dia}</span>
          <div class="calendar-events-list"></div>
        </div>
      `;
    }

    // Adicionar listeners do Popover nas badges da grade
    gridEl.querySelectorAll('.calendar-event-badge').forEach(badge => {
      badge.addEventListener('mouseenter', (e) => {
        const evId = badge.getAttribute('data-event-id');
        showEventPopover(e, evId);
      });
      badge.addEventListener('mouseleave', hideEventPopover);
    });

    // Configurar listeners de Drag & Drop nas badges
    gridEl.querySelectorAll('.draggable-event').forEach(badge => {
      badge.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', badge.getAttribute('data-event-id'));
        badge.classList.add('dragging');
        hideEventPopover(); // Ocultar o popover no início do arraste
      });
      badge.addEventListener('dragend', () => {
        badge.classList.remove('dragging');
      });
    });

    // Configurar drop zones nas células de dia
    gridEl.querySelectorAll('.drop-zone-cell').forEach(cell => {
      cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        cell.classList.add('drag-over');
      });
      cell.addEventListener('dragleave', () => {
        cell.classList.remove('drag-over');
      });
      cell.addEventListener('drop', async (e) => {
        cell.classList.remove('drag-over');
        const eventId = e.dataTransfer.getData('text/plain');
        const novaData = cell.getAttribute('data-date');
        if (eventId && novaData) {
          await atualizarDataEvento(eventId, novaData);
        }
      });
    });
  } else {
    // VISUALIZAÇÃO EM LISTA
    if (!listEl) return;
    listEl.innerHTML = '';

    const eventosValidos = calEventos.filter(ev => ev.dataServico).sort((a, b) => {
      return new Date(a.dataServico) - new Date(b.dataServico);
    });

    if (eventosValidos.length === 0) {
      listEl.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--ink-lt); font-size:14px;">Nenhum serviço ou tour guiado agendado para este mês.</div>';
      return;
    }

    const eventosPorData = {};
    eventosValidos.forEach(ev => {
      if (!eventosPorData[ev.dataServico]) eventosPorData[ev.dataServico] = [];
      eventosPorData[ev.dataServico].push(ev);
    });

    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    
    Object.keys(eventosPorData).sort().forEach(dateKey => {
      const evs = eventosPorData[dateKey];
      const [y, m, d] = dateKey.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const diaSemana = diasSemana[dateObj.getDay()];
      const dataFormatada = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;

      const isPast = dateObj < hojeReset;

      let diaRowHTML = `
        <div class="calendar-list-day-row ${isPast ? 'past-day' : ''}">
          <!-- Coluna da Esquerda: Informações do Dia -->
          <div class="calendar-list-day-header">
            <div class="calendar-list-day-date">
              ${dataFormatada}
            </div>
            <div class="calendar-list-day-weekday">
              ${diaSemana}
            </div>
            <div class="calendar-list-day-count">
              ${evs.length} evento(s)
            </div>
          </div>
          
          <!-- Coluna da Direita: Lista Horizontal de Cards -->
          <div class="calendar-list-cards-row">
      `;

      evs.forEach(ev => {
        diaRowHTML += gerarEventCardHTML(ev);
      });

      diaRowHTML += `
          </div>
        </div>
      `;

      listEl.innerHTML += diaRowHTML;
    });
  }
};

function eventHTMLs(html) {
  return html || '<div style="color:#eee; font-size:10px; font-style:italic; padding:4px 0;">Sem eventos</div>';
}

window.atualizarGuiaRapidoLista = async function(eventoId, selectEl) {
  const userId = selectEl.value;
  selectEl.disabled = true;

  try {
    const res = await fetch(`/api/calendario/eventos/${eventoId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assigneeIds: userId ? [userId] : []
      })
    });

    if (!res.ok) throw new Error('Erro ao salvar guia no Notion');
    
    // Atualizar no array local
    const ev = calEventos.find(x => x.id === eventoId);
    if (ev) {
      if (!ev.valorDiariaColab) ev.valorDiariaColab = {};
      if (!ev.pagoColab) ev.pagoColab = {};

      if (userId) {
        const col = calColaboradores.find(x => x.id === userId);
        ev.assignee = col ? [{ id: col.id, name: col.name, avatar: col.avatar }] : [{ id: userId, name: userId }];
        
        // Sincronizar diárias e pagamentos individuais no estado local
        if (ev.valorDiariaColab[userId] === undefined || ev.valorDiariaColab[userId] === null) {
          const isRoteiro = ev.tipoServico && ev.tipoServico.toLowerCase() === 'roteiro';
          const defaultRate = col ? col.rate : 35000;
          ev.valorDiariaColab[userId] = isRoteiro ? defaultRate : 0;
        }
        if (ev.pagoColab[userId] === undefined) {
          ev.pagoColab[userId] = ev.pago || false;
        }

        // Remover outros colaboradores
        Object.keys(ev.valorDiariaColab).forEach(uid => {
          if (uid !== userId) {
            delete ev.valorDiariaColab[uid];
            delete ev.pagoColab[uid];
          }
        });

        ev.valorDiaria = ev.valorDiariaColab[userId];
        ev.pago = ev.pagoColab[userId];
      } else {
        ev.assignee = [];
        ev.valorDiariaColab = {};
        ev.pagoColab = {};
        ev.valorDiaria = null;
        ev.pago = false;
      }
      
      // Recarregar calendário para desenhar botões/chips
      renderCalendario();
    }
  } catch (err) {
    console.error(err);
    alert('Erro ao atualizar guia no Notion. Tente novamente.');
    renderCalendario();
  } finally {
    selectEl.disabled = false;
  }
};

window.abrirCalendarioEventModal = function(eventoId) {
  const ev = calEventos.find(x => x.id === eventoId);
  if (!ev) return;

  calSelectedEvent = ev;

  document.getElementById('calEventModalTitle').innerText = ev.titulo;
  
  // Badge de tipo
  const badge = document.getElementById('calEventModalTypeBadge');
  if (badge) {
    badge.innerText = ev.tipoServico;
    badge.className = 'compact-card-status';
    let bg = 'rgba(107,31,42,0.06)'; let color = 'var(--crimson)';
    const tLower = ev.tipoServico.toLowerCase();
    if (tLower.includes('shinkansen') || tLower.includes('romancecar') || tLower.includes('trem') || tLower.includes('ônibus') || tLower.includes('onibus') || tLower.includes('transfer') || tLower.includes('transporte')) {
      bg = 'rgba(196,163,90,0.08)'; color = 'var(--gold-dk)';
    } else if (tLower.includes('experiência') || tLower.includes('experiencia')) {
      bg = 'rgba(135,75,45,0.06)'; color = '#7a3e20';
    }
    badge.style.background = bg;
    badge.style.color = color;
  }

  // Data formatada
  document.getElementById('calEventModalData').innerText = fmtDataBR(ev.dataServico);

  // Nome do cliente
  const cliNameEl = document.getElementById('calEventModalCliente');
  if (cliNameEl) {
    cliNameEl.innerText = ev.clienteNome || (ev.clientes && ev.clientes.length > 0
      ? (typeof notionClients !== 'undefined' && notionClients.find(c => c.id === ev.clientes[0])?.nome || 'Cliente Vinculado')
      : 'Nenhum cliente vinculado');
  }

  // Renderizar checkboxes de guias designados
  const container = document.getElementById('calEventModalAssigneesContainer');
  if (container) {
    container.innerHTML = calColaboradores.map(col => {
      const isChecked = ev.assignee && ev.assignee.some(a => a.id === col.id);
      return `
        <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--ink-dk); cursor:pointer; margin:0;">
          <input type="checkbox" class="cal-modal-assignee-checkbox" value="${col.id}" ${isChecked ? 'checked' : ''} onchange="onCalEventModalAssigneeChange()" style="width:15px; height:15px; margin:0; cursor:pointer;">
          <span>${col.name}</span>
        </label>
      `;
    }).join('');
  }

  // Especificações adicionais do roteiro (atrações/transportes/experiencias)
  const specContainer = document.getElementById('calEventModalEspecificacoesContainer');
  if (specContainer) {
    specContainer.style.display = 'none';
    specContainer.innerHTML = '';

    let specHTML = '';
    const typeLower = ev.tipoServico.toLowerCase();

    // 1. Tentar renderizar a partir das informações ricas salvas no próprio evento
    if (ev.cidade || ev.horaEncontro || ev.localEncontro || ev.atracoes || ev.transportInfo || ev.expInfo) {
      if (typeLower.includes('roteiro')) {
        specHTML += `<div style="font-weight:700; color:var(--crimson); font-size:12px; margin-bottom:12px; text-transform:uppercase;">Roteiro do Dia:</div>`;

        const parts = [];
        if (ev.horaEncontro) parts.push(`Encontro: <strong>${ev.horaEncontro}</strong><br>`);
        if (ev.localEncontro) parts.push(`Local: <strong>${ev.localEncontro}</strong><br>`);
        if (ev.duracaoTour) parts.push(`Duração: <strong>${ev.duracaoTour}</strong>`);
        
        if (parts.length > 0) {
          specHTML += `<div style="font-size:12px; background:#f9f6f6; border-left:3px solid var(--crimson); padding:8px 12px; border-radius:6px; margin-bottom:12px; color:var(--ink-mid); display:block; line-height:1.4;">${parts.join('')}</div>`;
        }

        if (ev.rotas && ev.rotas.length > 0) {
          specHTML += `<div style="font-size:12px; margin-bottom:8px; color:var(--ink);"><strong>Rotas:</strong> ${ev.rotas.join(' ➔ ')}</div>`;
        }
        
        if (ev.atracoes && ev.atracoes.length > 0) {
          const chipsHTML = ev.atracoes.map(atr => 
            `<span style="background:rgba(196,163,90,0.12); color:#8a703b; border:1px solid rgba(196,163,90,0.2); padding:3px 8px; border-radius:12px; font-size:11px; font-weight:600; display:inline-block; margin:2px 4px 2px 0;">${atr}</span>`
          ).join('');
          specHTML += `<div style="margin-top:8px;"><strong>Atrações:</strong><div style="margin-top:6px; display:flex; flex-wrap:wrap; gap:4px;">${chipsHTML}</div></div>`;
        }

        if (ev.textos && ev.textos.length > 0) {
          specHTML += `<div style="margin-top:12px; font-size:11px; font-style:italic; border-left:2px solid var(--gold-lt); padding-left:8px; color:var(--ink-mid);">`;
          ev.textos.forEach(t => {
            specHTML += `<p style="margin:4px 0;">"${t}"</p>`;
          });
          specHTML += `</div>`;
        }
      } else if (ev.transportInfo || typeLower.includes('shinkansen') || typeLower.includes('romancecar') || typeLower.includes('trem') || typeLower.includes('ônibus') || typeLower.includes('onibus') || typeLower.includes('transfer') || typeLower.includes('transporte')) {
        specHTML += `<div style="font-weight:700; color:#9c8248; font-size:12px; margin-bottom:12px; text-transform:uppercase;">Detalhes do Transporte:</div>`;
        
        const t = ev.transportInfo || {};
        const orig = t.origem || ev.cidade?.split(' ➔ ')[0] || 'Origem';
        const dest = t.destino || ev.cidade?.split(' ➔ ')[1] || 'Destino';
        const hora = t.horario || ev.horaEncontro || 'Definir';
        const meio = t.tipoTransporte || ev.tipoServico || 'Deslocamento';
        const heianEmitido = t.compradoHeian !== false
          ? `<span style="font-size:10px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; font-weight:bold; text-transform:uppercase;">Comprado pela Heian</span>`
          : `<span style="font-size:10px; background:#f3f3f3; color:#888; padding:2px 6px; border-radius:4px; font-weight:bold; text-transform:uppercase;">Comprado pelo cliente</span>`;

        specHTML += `
          <div style="background:#fdfaf6; border:1px solid rgba(196,163,90,0.25); border-radius:8px; padding:12px; font-size:12px; line-height:1.6;">
            <div style="font-weight:bold; color:var(--ink-dk); font-size:14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
              <span>${orig} ➔ ${dest}</span>
              ${heianEmitido}
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; color:var(--ink-mid);">
              <div><strong>Meio:</strong> ${meio}</div>
              <div><strong>Horário:</strong> ${hora}</div>
              <div><strong>Linha:</strong> ${t.linha || '-'}</div>
              <div><strong>Categoria:</strong> ${t.categoria || '-'}</div>
              <div><strong>Duração:</strong> ${t.tempo || '-'}</div>
              <div><strong>Passageiros:</strong> ${t.adultos ? t.adultos + ' Adultos' : '-'}</div>
            </div>
            ${t.observacoes ? `<div style="margin-top:10px; font-style:italic; border-top:1px dashed rgba(196,163,90,0.2); padding-top:8px; color:var(--ink-lt);">Obs: ${t.observacoes}</div>` : ''}
          </div>`;
      } else if (ev.expInfo || typeLower.includes('experiência') || typeLower.includes('experiencia')) {
        specHTML += `<div style="font-weight:700; color:#a3522b; font-size:12px; margin-bottom:12px; text-transform:uppercase;">Tickets & Experiências:</div>`;
        
        const e = ev.expInfo || {};
        const hora = e.horaPartida || ev.horaEncontro || 'Definir';
        const nome = e.nomeExp || ev.titulo || 'Experiência';
        const heianEmitido = e.compradoHeian !== false
          ? `<span style="font-size:10px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; font-weight:bold; text-transform:uppercase;">Comprado pela Heian</span>`
          : `<span style="font-size:10px; background:#f3f3f3; color:#888; padding:2px 6px; border-radius:4px; font-weight:bold; text-transform:uppercase;">Comprado pelo cliente</span>`;

        specHTML += `
          <div style="background:#faf8f5; border:1px solid rgba(163,82,43,0.25); border-radius:8px; padding:12px; font-size:12px; line-height:1.6;">
            <div style="font-weight:bold; color:var(--ink-dk); font-size:14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
              <span>${nome}</span>
              ${heianEmitido}
            </div>
            <div style="color:var(--ink-mid); display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <div><strong>Horário:</strong> ${hora}</div>
              <div><strong>Passageiros:</strong> ${e.adultos ? e.adultos + ' Adultos' : '-'}</div>
              ${ev.localEncontro ? `<div style="grid-column: span 2;"><strong>Local Encontro:</strong> ${ev.localEncontro}</div>` : ''}
            </div>
            ${e.observacoes ? `<div style="margin-top:10px; font-style:italic; border-top:1px dashed rgba(163,82,43,0.2); padding-top:8px; color:var(--ink-lt);">Obs: ${e.observacoes}</div>` : ''}
          </div>`;
      }
    }

    // 2. Se não renderizou nada com as informações ricas, usar a lógica antiga (fallback)
    if (!specHTML) {
      const clientNotionId = ev.clientes && ev.clientes.length > 0 ? ev.clientes[0] : null;
      let roteiroCliente = null;
      if (clientNotionId && typeof dbRotas !== 'undefined') {
        roteiroCliente = Object.values(dbRotas).find(rot => rot.notionClienteId === clientNotionId);
      }

      if (roteiroCliente && roteiroCliente.cliente?.dataInicio) {
        const parseDateUTC = (dateStr) => {
          const [y, m, d] = dateStr.split('-').map(Number);
          return new Date(Date.UTC(y, m - 1, d));
        };

        const diffDays = Math.round((parseDateUTC(ev.dataServico) - parseDateUTC(roteiroCliente.cliente.dataInicio)) / (1000 * 60 * 60 * 24));

        if (roteiroCliente.dias && roteiroCliente.dias[diffDays]) {
          const diaRoteiro = roteiroCliente.dias[diffDays];
          const typeLower = ev.tipoServico.toLowerCase();

          if (typeLower.includes('roteiro')) {
            const sequencias = (diaRoteiro.elementos || []).filter(el => el.tipo === 'sequencia');
            const infos = (diaRoteiro.elementos || []).filter(el => el.tipo === 'info');
            const textos = (diaRoteiro.elementos || []).filter(el => el.tipo === 'texto');

            if (sequencias.length > 0 || infos.length > 0 || textos.length > 0) {
              specHTML += `<div style="font-weight:700; color:var(--crimson); font-size:12px; margin-bottom:8px; text-transform:uppercase;">Roteiro do Dia:</div>`;

              infos.forEach(inf => {
                const parts = [];
                if (inf.horarioEncontro) parts.push(`${inf.horarioEncontro}`);
                if (inf.localEncontro) parts.push(`Encontro: ${inf.localEncontro}`);
                if (inf.duracaoTour) parts.push(`${inf.duracaoTour}`);
                if (parts.length > 0) {
                  specHTML += `<div style="font-size:11px; background:#f5f7fa; padding:6px 10px; border-radius:6px; margin-bottom:8px; color:var(--ink-mid);">${parts.join(' &nbsp;|&nbsp; ')}</div>`;
                }
              });

              sequencias.forEach(seq => {
                const cidadeName = seq.cidade ? `<strong style="color:var(--gold-dk);">${seq.cidade}:</strong> ` : '';
                const atrs = seq.atracoesDoDia && seq.atracoesDoDia.length > 0
                  ? seq.atracoesDoDia.map(a => `<span style="background:rgba(196,163,90,0.1); color:#9c8248; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600; display:inline-block; margin:2px 2px 2px 0;">${a.nome}</span>`).join(' ')
                  : '<span style="color:var(--ink-lt);">Nenhuma atração</span>';

                specHTML += `
                  <div style="margin-bottom:8px; font-size:12px;">
                    <div>${cidadeName}${seq.nomeDaRota || ''}</div>
                    <div style="margin-top:4px;">${atrs}</div>
                  </div>`;
              });

              textos.forEach(txt => {
                if (txt.conteudo) {
                  specHTML += `<div style="font-size:11px; font-style:italic; border-left:2px solid var(--gold-lt); padding-left:8px; color:var(--ink-mid); margin-top:8px;">"${txt.conteudo}"</div>`;
                }
              });
            }
          } else if (typeLower.includes('shinkansen') || typeLower.includes('romancecar') || typeLower.includes('trem') || typeLower.includes('ônibus') || typeLower.includes('onibus') || typeLower.includes('transfer')) {
            const transportes = (diaRoteiro.elementos || []).filter(el => el.tipo === 'transporte');
            if (transportes.length > 0) {
              specHTML += `<div style="font-weight:700; color:#9c8248; font-size:12px; margin-bottom:8px; text-transform:uppercase;">Detalhes do Transporte:</div>`;
              transportes.forEach(t => {
                const heianEmitido = t.compradoHeian !== false
                  ? `<span style="font-size:9px; background:var(--gold); color:white; padding:1px 4px; border-radius:4px; font-weight:bold; margin-left:6px; text-transform:uppercase;">Comprado pela Heian</span>`
                  : `<span style="font-size:9px; background:#f3f3f3; color:#888; padding:1px 4px; border-radius:4px; font-weight:bold; margin-left:6px; text-transform:uppercase;">Comprado pelo cliente</span>`;

                specHTML += `
                  <div style="background:#fdfaf6; border:1px solid rgba(196,163,90,0.2); border-radius:8px; padding:10px; margin-bottom:8px; font-size:11px; line-height:1.5;">
                    <div style="font-weight:bold; color:var(--ink); font-size:12px; margin-bottom:4px;">
                      ${t.cidadeOrigem || 'Origem'} ➔ ${t.cidadeDestino || 'Destino'} ${heianEmitido}
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; color:var(--ink-mid);">
                      <div><strong>Meio:</strong> ${t.tipoTransporte || 'Deslocamento'}</div>
                      <div><strong>Horário:</strong> ${t.horario || 'Definir'}</div>
                      <div><strong>Linha:</strong> ${t.linha || '-'}</div>
                      <div><strong>Categoria:</strong> ${t.categoria || '-'}</div>
                      <div><strong>Duração:</strong> ${t.tempo || '-'}</div>
                      <div><strong>Passageiros:</strong> ${t.adultos ? t.adultos + ' Adultos' : ''}</div>
                    </div>
                    ${t.observacoes ? `<div style="margin-top:6px; font-style:italic; border-top:1px dashed rgba(196,163,90,0.2); padding-top:4px; color:var(--ink-lt);">Obs: ${t.observacoes}</div>` : ''}
                  </div>`;
              });
            }
          } else if (typeLower.includes('experiência') || typeLower.includes('experiencia')) {
            const experiencias = (diaRoteiro.elementos || []).filter(el => el.tipo === 'experiencia');
            if (experiencias.length > 0) {
              specHTML += `<div style="font-weight:700; color:#a3522b; font-size:12px; margin-bottom:8px; text-transform:uppercase;">Tickets & Experiências:</div>`;
              experiencias.forEach(e => {
                const heianEmitido = e.compradoHeian !== false
                  ? `<span style="font-size:9px; background:var(--gold); color:white; padding:1px 4px; border-radius:4px; font-weight:bold; margin-left:6px; text-transform:uppercase;">Comprado pela Heian</span>`
                  : `<span style="font-size:9px; background:#f3f3f3; color:#888; padding:1px 4px; border-radius:4px; font-weight:bold; margin-left:6px; text-transform:uppercase;">Comprado pelo cliente</span>`;

                specHTML += `
                  <div style="background:#faf8f5; border:1px solid rgba(163,82,43,0.15); border-radius:8px; padding:10px; margin-bottom:8px; font-size:11px; line-height:1.5;">
                    <div style="font-weight:bold; color:var(--ink); font-size:12px; margin-bottom:4px;">
                      ${e.nomeExp || 'Experiência'} ${heianEmitido}
                    </div>
                    <div style="color:var(--ink-mid);">
                      <div><strong>Horário:</strong> ${e.horaPartida || 'Definir'}</div>
                      <div><strong>Passageiros:</strong> ${e.adultos ? e.adultos + ' Adultos' : ''}</div>
                    </div>
                    ${e.observacoes ? `<div style="margin-top:6px; font-style:italic; border-top:1px dashed rgba(163,82,43,0.15); padding-top:4px; color:var(--ink-lt);">Obs: ${e.observacoes}</div>` : ''}
                  </div>`;
              });
            }
          }
        }
      }
    }

    if (specHTML) {
      specContainer.innerHTML = specHTML;
      specContainer.style.display = 'block';
    }
  }

  // Configurar campos de finanças iniciais baseado no guia do evento
  if (typeof onCalEventModalAssigneeChange === 'function') {
    onCalEventModalAssigneeChange();
  }

  const backdrop = document.getElementById('calendarioEventModal');
  if (backdrop) backdrop.classList.add('active');
};

window.fecharCalendarioEventModal = function() {
  const backdrop = document.getElementById('calendarioEventModal');
  if (backdrop) backdrop.classList.remove('active');
  calSelectedEvent = null;
};

window.editarEventoCalendario = function() {
  const ev = calSelectedEvent;
  if (!ev) return;
  window.fecharCalendarioEventModal();
  window.abrirModalCriarEventoCalendario(ev);
};

window.toggleCalEventModalValorDiaria = function() {
  const checkbox = document.getElementById('calEventModalGeraPagamento');
  const wrapper = document.getElementById('calEventModalValorDiariaWrapper');
  const input = document.getElementById('calEventModalValorDiaria');
  
  if (checkbox && checkbox.checked) {
    if (wrapper) wrapper.style.display = 'flex';
    // Se o input estiver vazio, tentar preencher com a taxa padrão do primeiro guia marcado
    if (input && !input.value) {
      const checkedBox = document.querySelector('.cal-modal-assignee-checkbox:checked');
      const firstGuideId = checkedBox ? checkedBox.value : '';
      const colab = calColaboradores.find(c => c.id === firstGuideId);
      input.value = colab ? colab.rate : 35000;
    }
  } else {
    if (wrapper) wrapper.style.display = 'none';
  }
};

window.onCalEventModalAssigneeChange = function() {
  const checkedBoxes = document.querySelectorAll('.cal-modal-assignee-checkbox:checked');
  const guideIds = Array.from(checkedBoxes).map(cb => cb.value);
  const container = document.getElementById('calEventModalFinancasContainer');
  const checkbox = document.getElementById('calEventModalGeraPagamento');
  const wrapper = document.getElementById('calEventModalValorDiariaWrapper');
  const input = document.getElementById('calEventModalValorDiaria');
  
  if (guideIds.length > 0) {
    if (container) container.style.display = 'block';
    
    // Configuração inicial padrão baseada no tipo se não houver evento já configurado
    if (calSelectedEvent) {
      const isRoteiro = calSelectedEvent.tipoServico && calSelectedEvent.tipoServico.toLowerCase() === 'roteiro';
      const temDiaria = typeof calSelectedEvent.valorDiaria === 'number';
      
      if (temDiaria) {
        const geraPato = calSelectedEvent.valorDiaria > 0;
        if (checkbox) checkbox.checked = geraPato;
        if (wrapper) wrapper.style.display = geraPato ? 'flex' : 'none';
        if (input) input.value = calSelectedEvent.valorDiaria;
      } else {
        // Sem diária salva ainda
        if (checkbox) checkbox.checked = isRoteiro;
        if (wrapper) wrapper.style.display = isRoteiro ? 'flex' : 'none';
        if (input) {
          const colab = calColaboradores.find(c => c.id === guideIds[0]);
          input.value = isRoteiro ? (colab ? colab.rate : 35000) : '';
        }
      }
    }
  } else {
    if (container) container.style.display = 'none';
    if (checkbox) checkbox.checked = false;
    if (wrapper) wrapper.style.display = 'none';
    if (input) input.value = '';
  }
};

async function salvarAtribuicaoGuia() {
  if (!calSelectedEvent) return;
  
  const checkedBoxes = document.querySelectorAll('.cal-modal-assignee-checkbox:checked');
  const assigneeIds = Array.from(checkedBoxes).map(cb => cb.value);
  
  const checkbox = document.getElementById('calEventModalGeraPagamento');
  const geraPagamento = checkbox ? checkbox.checked : false;
  
  const inputValor = document.getElementById('calEventModalValorDiaria');
  let valor = 0;
  if (geraPagamento && inputValor) {
    valor = inputValor.value ? Number(inputValor.value) : 0;
    if (valor <= 0) {
      const firstColab = calColaboradores.find(c => c.id === assigneeIds[0]);
      valor = firstColab ? firstColab.rate : 35000;
    }
  }

  const btn = document.getElementById('calEventModalSaveBtn');
  const originalText = btn.innerText;
  btn.innerText = 'Salvando...';
  btn.disabled = true;

  try {
    const res = await fetch(`/api/calendario/eventos/${calSelectedEvent.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        assigneeIds: assigneeIds,
        valorDiaria: assigneeIds.length > 0 ? valor : null,
        pago: assigneeIds.length > 0 ? (calSelectedEvent.pago || false) : false
      })
    });

    if (!res.ok) throw new Error('Erro ao salvar guias e diária');
    
    // Atualizar no array local para que o reflexo na UI seja instantaneo
    const ev = calEventos.find(x => x.id === calSelectedEvent.id);
    if (ev) {
      ev.assignee = assigneeIds.map(uid => {
        const col = calColaboradores.find(c => c.id === uid);
        return col ? { id: col.id, name: col.name, avatar: col.avatar } : { id: uid, name: uid };
      });
      
      // Sincronizar diárias e pagamentos individuais no estado local
      if (!ev.valorDiariaColab) ev.valorDiariaColab = {};
      if (!ev.pagoColab) ev.pagoColab = {};
      
      // Remover diárias de colaboradores desmarcados
      Object.keys(ev.valorDiariaColab).forEach(uid => {
        if (!assigneeIds.includes(uid)) {
          delete ev.valorDiariaColab[uid];
          delete ev.pagoColab[uid];
        }
      });
      
      // Inicializar diárias de novos colaboradores marcados
      assigneeIds.forEach(uid => {
        if (ev.valorDiariaColab[uid] === undefined || ev.valorDiariaColab[uid] === null) {
          const isRoteiro = ev.tipoServico && ev.tipoServico.toLowerCase() === 'roteiro';
          const colFound = calColaboradores.find(c => c.id === uid);
          const defaultRate = colFound ? colFound.rate : 35000;
          
          if (typeof valor === 'number' && valor > 0) {
            ev.valorDiariaColab[uid] = valor;
          } else {
            ev.valorDiariaColab[uid] = isRoteiro ? defaultRate : 0;
          }
        }
        if (ev.pagoColab[uid] === undefined) {
          ev.pagoColab[uid] = ev.pago || false;
        }
      });

      ev.valorDiaria = assigneeIds.length > 0 ? valor : null;
      if (assigneeIds.length === 0) {
        ev.pago = false;
        ev.valorDiariaColab = {};
        ev.pagoColab = {};
      } else {
        // Compatibilidade global: Sincroniza campos globais com o primeiro colaborador
        const primaryId = assigneeIds[0];
        ev.valorDiaria = ev.valorDiariaColab[primaryId];
        ev.pago = ev.pagoColab[primaryId];
      }
    }
    
    fecharCalendarioEventModal();
    renderCalendario(); // Recarregar
    if (typeof filtrarDashColaborador === 'function') {
      filtrarDashColaborador();
    }
  } catch (err) {
    console.error(err);
    alert('Erro ao atualizar guias e diária. Tente novamente.');
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

window.deletarEventoCalendario = async function() {
  if (!calSelectedEvent) return;
  
  if (!confirm(`Deseja realmente excluir o dia/serviço "${calSelectedEvent.titulo}" do calendário local e arquivar o card correspondente no Notion? Esta ação não pode ser desfeita.`)) {
    return;
  }
  
  const btn = document.getElementById('calEventModalDeleteBtn');
  const originalText = btn.innerText;
  btn.innerText = 'Excluindo...';
  btn.disabled = true;
  
  try {
    const res = await fetch(`/api/calendario/eventos/${calSelectedEvent.id}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao deletar dia do calendário');
    }
    
    // Remover do array local calEventos
    const idx = calEventos.findIndex(e => e.id === calSelectedEvent.id);
    if (idx !== -1) {
      calEventos.splice(idx, 1);
    }
    
    fecharCalendarioEventModal();
    renderCalendario(); // Re-renderizar calendário
    if (typeof filtrarDashColaborador === 'function') {
      filtrarDashColaborador();
    }
    alert('Dia excluído com sucesso do calendário e arquivado no Notion!');
  } catch (err) {
    console.error(err);
    alert(`Erro ao excluir dia: ${err.message}`);
  } finally {
    if (btn) {
      btn.innerText = originalText;
      btn.disabled = false;
    }
  }
};

// Inserir lógica de sincronização na UI do roteiro (Aba Roteiros)
window.sincronizarRoteiroCalendario = async function(roteiroNome) {
  if (!confirm(`Deseja sincronizar o roteiro "${roteiroNome}" com o calendário do Notion? Isso irá limpar eventos anteriores deste cliente e registrar os novos.`)) {
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.background = 'rgba(255,255,255,0.7)';
  overlay.style.backdropFilter = 'blur(2px)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '9999';
  overlay.innerHTML = `
    <div style="background:#fff; padding:24px; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.15); border:1px solid var(--border); text-align:center;">
      <div style="font-size:32px; margin-bottom:12px; animation:spin 2s linear infinite; display:inline-flex; align-items:center; justify-content:center;"><svg class="v-icon v-icon-lg" style="stroke:var(--gold-dk); width:40px; height:40px; margin-right:0;"><use href="#icon-clock"></use></svg></div>
      <strong style="color:var(--crimson); font-size:14px; display:block; margin-bottom:4px;">Sincronizando com o Notion...</strong>
      <span style="font-size:12px; color:var(--ink-lt);">Isso pode demorar alguns segundos</span>
    </div>
  `;
  document.body.appendChild(overlay);

  try {
    const res = await fetch('/api/calendario/sincronizar-roteiro', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ roteiroNome })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao sincronizar');
    }

    const data = await res.json();
    alert(`Roteiro sincronizado com sucesso! ${data.count} eventos criados no calendário.`);
  } catch (err) {
    console.error(err);
    alert(`Erro ao sincronizar com o calendário: ${err.message}`);
  } finally {
    overlay.remove();
  }
};
