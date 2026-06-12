let chartClienteFinanceiro = null;

const KANBAN_STATUSES = [
  { name: 'Início/call de dúvidas', color: '#787878', bgColor: 'rgba(120, 120, 120, 0.08)', borderColor: '#cbd5e1' },
  { name: 'Em Negociação', color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.08)', borderColor: '#cbd5e1' },
  { name: 'Negociação Aprovada', color: '#0284c7', bgColor: 'rgba(2, 132, 199, 0.08)', borderColor: '#bae6fd' },
  { name: 'Roteiro Rascunho', color: '#db2777', bgColor: 'rgba(219, 39, 119, 0.08)', borderColor: '#fbcfe8' },
  { name: 'Roteiro versão final', color: '#ea580c', bgColor: 'rgba(234, 88, 12, 0.08)', borderColor: '#ffedd5' },
  { name: 'Em Viagem', color: '#7c3aed', bgColor: 'rgba(124, 58, 237, 0.08)', borderColor: '#e9d5ff' },
  { name: 'Cancelado', color: '#dc2626', bgColor: 'rgba(220, 38, 38, 0.08)', borderColor: '#fee2e2' },
  { name: 'Finalizados', color: '#16a34a', bgColor: 'rgba(22, 163, 74, 0.08)', borderColor: '#dcfce7' },
  { name: 'Atendimento Pós', color: '#b45309', bgColor: 'rgba(180, 83, 9, 0.08)', borderColor: '#fef3c7' }
];

async function renderDashboard() {
  // Popula o select de clientes para o Dashboard
  const select = document.getElementById('dashClienteSelect');
  let clientes = window.notionClients || [];

  if (clientes.length === 0) {
    try {
      const res = await fetch('/api/notion/clientes?t=' + Date.now(), { cache: 'no-store' });
      if (res.ok) {
        clientes = await res.json();
        window.notionClients = clientes;
      }
    } catch (e) {
      console.error('Erro ao buscar clientes no dashboard:', e);
    }
  }

  if (select && (select.options.length <= 1 || select.dataset.loadedCount != clientes.length)) {
    select.dataset.loadedCount = clientes.length;
    const currentVal = select.value;
    select.innerHTML = '<option value="">Geral (Todos os orçamentos locais)</option>';
    clientes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nome || 'Sem nome';
      select.appendChild(opt);
    });
    select.value = currentVal;
    if (select.value !== currentVal) select.value = "";
  }

  // Carrega e renderiza a agenda operacional (Ordens de Serviço do dia e da semana)
  await carregarAgendaOperacional();

  // Renderiza o Kanban
  renderKanban();
}

function renderKanban() {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;

  const clientes = window.notionClients || [];
  board.innerHTML = '';

  KANBAN_STATUSES.forEach(statusConfig => {
    const colStatus = statusConfig.name;
    const colClients = clientes.filter(c => (c.status || 'Início/call de dúvidas').toLowerCase() === colStatus.toLowerCase());

    const column = document.createElement('div');
    column.className = 'kanban-column';
    column.style.borderColor = statusConfig.borderColor;
    
    // Header
    const header = document.createElement('div');
    header.className = 'kanban-column-header';
    header.style.backgroundColor = statusConfig.bgColor;
    header.style.borderTop = `3px solid ${statusConfig.color}`;
    
    const titleSpan = document.createElement('span');
    titleSpan.textContent = colStatus;
    titleSpan.style.color = statusConfig.color;
    
    const countSpan = document.createElement('span');
    countSpan.className = 'kanban-column-count';
    countSpan.textContent = colClients.length;

    header.appendChild(titleSpan);
    header.appendChild(countSpan);
    column.appendChild(header);

    // Cards Container
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'kanban-cards-container';
    cardsContainer.dataset.status = colStatus;

    // Listeners do Drag and Drop
    cardsContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      cardsContainer.classList.add('drag-over');
    });

    cardsContainer.addEventListener('dragleave', () => {
      cardsContainer.classList.remove('drag-over');
    });

    cardsContainer.addEventListener('drop', async (e) => {
      e.preventDefault();
      cardsContainer.classList.remove('drag-over');
      const clientStr = e.dataTransfer.getData('text/plain');
      if (!clientStr) return;
      
      const { id, fromStatus } = JSON.parse(clientStr);
      if (fromStatus.toLowerCase() !== colStatus.toLowerCase()) {
        await atualizarStatusClienteKanban(id, colStatus);
      }
    });

    // Renderiza os cards de cliente
    if (colClients.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.color = 'var(--ink-lt)';
      emptyMsg.style.fontSize = '11px';
      emptyMsg.style.fontStyle = 'italic';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.padding = '20px 0';
      emptyMsg.textContent = 'Sem clientes';
      cardsContainer.appendChild(emptyMsg);
    } else {
      colClients.forEach(c => {
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.draggable = true;

        // Ao arrastar
        card.addEventListener('dragstart', (e) => {
          card.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', JSON.stringify({ id: c.id, fromStatus: c.status || 'Início/call de dúvidas' }));
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
        });

        // Click simples para navegar
        card.addEventListener('click', () => {
          const navItem = document.querySelector('.sidebar-nav a[data-page="clientes"]');
          if (navItem) {
            navItem.click();
            setTimeout(() => {
              if (typeof window.abrirDetalhesCliente === 'function') {
                window.abrirDetalhesCliente(c.id);
              }
            }, 100);
          }
        });

        // Nome
        const nameEl = document.createElement('div');
        nameEl.className = 'kanban-card-title';
        nameEl.textContent = c.nome || 'Sem Nome';

        // Meta
        const metaEl = document.createElement('div');
        metaEl.className = 'kanban-card-meta';

        // Período
        if (c.dataInicio) {
          const dtStart = fmtDataBRAgenda(c.dataInicio);
          const dtEnd = c.dataFim ? fmtDataBRAgenda(c.dataFim) : '';
          const periodStr = dtEnd ? `📅 ${dtStart} - ${dtEnd}` : `📅 A partir de ${dtStart}`;
          
          const pEl = document.createElement('span');
          pEl.textContent = periodStr;
          metaEl.appendChild(pEl);
        }

        // Pax
        if (c.adultos > 0 || c.criancas > 0) {
          const paxArr = [];
          if (c.adultos > 0) paxArr.push(`${c.adultos} ad`);
          if (c.criancas > 0) paxArr.push(`${c.criancas} cr`);
          
          const paxEl = document.createElement('span');
          paxEl.textContent = `👥 ${paxArr.join(' · ')}`;
          metaEl.appendChild(paxEl);
        }

        // Valor
        if (c.valorTotal > 0) {
          const valEl = document.createElement('span');
          valEl.innerHTML = `<strong style="color:var(--crimson)">¥ ${c.valorTotal.toLocaleString('en-US')}</strong>`;
          metaEl.appendChild(valEl);
        }

        // Hotel
        if (c.hotel) {
          const hotEl = document.createElement('span');
          hotEl.textContent = `🏨 ${c.hotel}`;
          hotEl.style.whiteSpace = 'nowrap';
          hotEl.style.overflow = 'hidden';
          hotEl.style.textOverflow = 'ellipsis';
          metaEl.appendChild(hotEl);
        }

        card.appendChild(nameEl);
        card.appendChild(metaEl);
        cardsContainer.appendChild(card);
      });
    }

    column.appendChild(cardsContainer);
    board.appendChild(column);
  });
}

async function atualizarStatusClienteKanban(id, novoStatus) {
  document.body.style.cursor = 'progress';

  try {
    // 1. Notion PATCH
    const notionRes = await fetch(`/api/notion/clientes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus })
    });

    if (!notionRes.ok) {
      throw new Error('Erro ao atualizar status no Notion');
    }

    // 2. Supabase POST
    const index = window.notionClients.findIndex(c => c.id === id);
    if (index !== -1) {
      const clienteOriginal = window.notionClients[index];
      const clienteAtualizado = { ...clienteOriginal, status: novoStatus };
      
      const localRes = await fetch('/api/clientes/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clienteAtualizado)
      });

      if (!localRes.ok) {
        console.warn('Erro ao atualizar status no banco local, continuando...');
      }

      window.notionClients[index] = clienteAtualizado;
    }

    // 3. UI Sync
    renderKanban();
    
    if (typeof window.renderClientesTabela === 'function') {
      window.renderClientesTabela();
    }

    const select = document.getElementById('dashClienteSelect');
    if (select) {
      select.dataset.loadedCount = window.notionClients.length;
      const currentVal = select.value;
      select.innerHTML = '<option value="">Geral (Todos os orçamentos locais)</option>';
      window.notionClients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.nome || 'Sem nome';
        select.appendChild(opt);
      });
      select.value = currentVal;
    }

  } catch (err) {
    console.error('Erro ao atualizar status do cliente:', err);
    alert('Erro ao atualizar status do cliente: ' + err.message);
    renderKanban();
  } finally {
    document.body.style.cursor = 'default';
  }
}


async function selecionarClienteDashboard(clientId) {
  const containerGeral = document.getElementById('dashboardGeralContainer');
  const containerCliente = document.getElementById('dashboardClienteContainer');
  if (!containerGeral || !containerCliente) return;

  if (!clientId) {
    containerGeral.classList.remove('hidden');
    containerCliente.classList.add('hidden');
    renderDashboard();
    return;
  }

  containerGeral.classList.add('hidden');
  containerCliente.classList.remove('hidden');

  // Set loading state
  document.getElementById('kpiCliRecebido').textContent = 'Carregando...';
  document.getElementById('kpiCliDespesas').textContent = 'Carregando...';
  document.getElementById('kpiCliLucroReal').textContent = 'Carregando...';
  document.getElementById('kpiCliTaxas').textContent = 'Carregando...';
  document.getElementById('kpiCliLucroProjetado').textContent = 'Carregando...';

  document.getElementById('cliFichaValorTotal').textContent = '...';
  document.getElementById('cliFichaTotalPago').textContent = '...';
  document.getElementById('cliFichaSaldoPagar').textContent = '...';
  document.getElementById('cliFichaStatusPgto').textContent = '...';

  try {
    const res = await fetch(`/api/dashboard/notion-data/${clientId}`);
    if (!res.ok) throw new Error('Erro ao buscar dados do Notion');
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Erro desconhecido');

    const summary = data.summary;
    const details = data.details;

    // Fill KPI cards
    document.getElementById('kpiCliRecebido').textContent = `¥ ${summary.totalRecebido.toLocaleString('en-US')}`;
    document.getElementById('kpiCliDespesas').textContent = `¥ ${summary.totalDespesas.toLocaleString('en-US')}`;
    
    const lucroRealEl = document.getElementById('kpiCliLucroReal');
    lucroRealEl.textContent = `¥ ${summary.lucroReal.toLocaleString('en-US')}`;
    if (summary.lucroReal < 0) {
      lucroRealEl.style.color = '#e74c3c';
    } else {
      lucroRealEl.style.color = 'var(--gold-dk)';
    }

    document.getElementById('kpiCliTaxas').textContent = `¥ ${summary.totalTaxas.toLocaleString('en-US')}`;
    document.getElementById('kpiCliLucroProjetado').textContent = `¥ ${summary.totalLucroProjetado.toLocaleString('en-US')}`;

    // Fill client ficha info
    const clientInfo = (window.notionClients || []).find(c => c.id === clientId);
    if (clientInfo) {
      document.getElementById('cliFichaValorTotal').textContent = `¥ ${(clientInfo.valorTotal || 0).toLocaleString('en-US')}`;
      document.getElementById('cliFichaTotalPago').textContent = `¥ ${(clientInfo.totalPago || 0).toLocaleString('en-US')}`;
      document.getElementById('cliFichaSaldoPagar').textContent = `¥ ${(clientInfo.saldoPagar || 0).toLocaleString('en-US')}`;
      
      const statusEl = document.getElementById('cliFichaStatusPgto');
      statusEl.textContent = clientInfo.statusPagamento || 'Sem status';
      
      // Color status based on value
      if (clientInfo.statusPagamento === 'Pago') {
        statusEl.style.color = '#2ecc71';
        statusEl.style.background = 'rgba(46, 204, 113, 0.1)';
      } else if (clientInfo.statusPagamento === 'Pendente') {
        statusEl.style.color = '#f1c40f';
        statusEl.style.background = 'rgba(241, 196, 15, 0.1)';
      } else {
        statusEl.style.color = 'var(--ink-lt)';
        statusEl.style.background = 'rgba(0, 0, 0, 0.04)';
      }
    }

    // Render bar chart for comparison
    renderChartCliente(summary.totalRecebido, summary.totalDespesas, summary.lucroReal);

    // Populate Tables
    renderTableCliEntradas(details.entradas);
    renderTableCliSaidas(details.saidas);
    renderTableCliTasks(details.tasks);

  } catch (err) {
    console.error(err);
    alert('Erro ao carregar dados do dashboard do cliente: ' + err.message);
  }
}

function renderChartCliente(recebido, despesas, lucro) {
  const ctx = document.getElementById('chartClienteFinanceiro')?.getContext('2d');
  if (!ctx) return;

  if (chartClienteFinanceiro) chartClienteFinanceiro.destroy();

  chartClienteFinanceiro = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Recebido', 'Despesas', 'Lucro Líquido Real'],
      datasets: [{
        label: 'Valor (¥)',
        data: [recebido, despesas, lucro],
        backgroundColor: [
          'rgba(46, 204, 113, 0.75)',
          'rgba(231, 76, 60, 0.75)',
          'rgba(196, 163, 90, 0.75)'
        ],
        borderColor: [
          '#2ecc71',
          '#e74c3c',
          '#c4a35a'
        ],
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '¥ ' + value.toLocaleString('en-US');
            }
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

function renderTableCliEntradas(entradas) {
  const tbody = document.querySelector('#tableCliEntradas tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (entradas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:15px; color:#888;">Nenhum pagamento registrado.</td></tr>';
    return;
  }
  entradas.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.data ? fmtDataBR(e.data) : '-'}</td>
      <td><strong>${e.descricao}</strong></td>
      <td><span class="pdf-tag" style="margin-top:0">${e.tipo || '-'}</span></td>
      <td style="text-align:right; font-family:var(--ff-num); font-weight:600; color:#2ecc71">¥ ${e.valor.toLocaleString('en-US')}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTableCliSaidas(saidas) {
  const tbody = document.querySelector('#tableCliSaidas tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (saidas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:15px; color:#888;">Nenhuma despesa registrada.</td></tr>';
    return;
  }
  saidas.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.data ? fmtDataBR(s.data) : '-'}</td>
      <td><strong>${s.descricao}</strong></td>
      <td><span class="pdf-tag" style="margin-top:0">${s.categoria || '-'}</span></td>
      <td>${s.tipoServico || '-'}</td>
      <td style="text-align:right; font-family:var(--ff-num); font-weight:600; color:#e74c3c">¥ ${s.valor.toLocaleString('en-US')}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderTableCliTasks(tasks) {
  const tbody = document.querySelector('#tableCliTasks tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (tasks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:15px; color:#888;">Nenhuma task registrada.</td></tr>';
    return;
  }
  tasks.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.dataServico ? fmtDataBR(t.dataServico) : '-'}</td>
      <td><strong>${t.nome}</strong></td>
      <td><span class="pdf-tag" style="margin-top:0">${t.status || '-'}</span></td>
      <td style="text-align:right; font-family:var(--ff-num)">¥ ${t.totalCliente.toLocaleString('en-US')}</td>
      <td style="text-align:right; font-family:var(--ff-num); color:var(--crimson)">¥ ${t.taxa.toLocaleString('en-US')}</td>
      <td style="text-align:right; font-family:var(--ff-num); color:var(--gold-dk)">¥ ${t.lucro.toLocaleString('en-US')}</td>
    `;
    tbody.appendChild(tr);
  });
}

function switchCliDashTab(event, tabId) {
  event.preventDefault();
  const tabContainer = event.target.closest('.card');
  const tabs = tabContainer.querySelectorAll('.tab');
  const tabContents = tabContainer.querySelectorAll('.tab-content');

  tabs.forEach(t => t.classList.remove('active'));
  tabContents.forEach(c => {
    c.classList.remove('active');
    c.style.display = 'none';
  });

  event.target.classList.add('active');
  const activeContent = document.getElementById(tabId);
  if (activeContent) {
    activeContent.classList.add('active');
    activeContent.style.display = 'block';
  }
}

async function carregarAgendaOperacional() {
  const listHoje = document.getElementById('agendaHojeLista');
  const listSemana = document.getElementById('agendaSemanaLista');
  const dateHojeText = document.getElementById('agendaHojeData');
  
  if (!listHoje || !listSemana) return;

  try {
    const hoje = new Date();
    const y = hoje.getFullYear();
    const m = String(hoje.getMonth() + 1).padStart(2, '0');
    const d = String(hoje.getDate()).padStart(2, '0');
    const hojeStr = `${y}-${m}-${d}`;
    
    // Atualizar texto de Hoje
    if (dateHojeText) {
      dateHojeText.textContent = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    // Buscar eventos
    const res = await fetch('/api/calendario/eventos');
    if (!res.ok) throw new Error('Erro ao buscar eventos');
    const eventos = await res.json();

    // Data de 7 dias à frente
    const limiteSemana = new Date(hoje);
    limiteSemana.setDate(limiteSemana.getDate() + 7);
    const yL = limiteSemana.getFullYear();
    const mL = String(limiteSemana.getMonth() + 1).padStart(2, '0');
    const dL = String(limiteSemana.getDate()).padStart(2, '0');
    const limiteSemanaStr = `${yL}-${mL}-${dL}`;

    // Filtrar eventos de Hoje
    const eventosHoje = eventos.filter(ev => ev.dataServico === hojeStr).sort((a,b) => (a.horaEncontro || '').localeCompare(b.horaEncontro || ''));

    // Filtrar eventos da Semana (excluindo hoje e limitando aos próximos 7 dias)
    const eventosSemana = eventos.filter(ev => ev.dataServico > hojeStr && ev.dataServico <= limiteSemanaStr).sort((a,b) => {
      const dataDiff = a.dataServico.localeCompare(b.dataServico);
      if (dataDiff !== 0) return dataDiff;
      return (a.horaEncontro || '').localeCompare(b.horaEncontro || '');
    });

    // Renderizar lista de Hoje
    renderListaAgenda(eventosHoje, listHoje, true);

    // Renderizar lista de Semana
    renderListaAgenda(eventosSemana, listSemana, false);

  } catch (err) {
    console.error('Erro na agenda operacional:', err);
    listHoje.innerHTML = `<p style="color:#e74c3c; font-size:12px;">Falha ao carregar a agenda.</p>`;
    listSemana.innerHTML = `<p style="color:#e74c3c; font-size:12px;">Falha ao carregar a agenda.</p>`;
  }
}

function renderListaAgenda(eventos, container, ehHoje) {
  container.innerHTML = '';
  if (eventos.length === 0) {
    container.innerHTML = `<p style="color:var(--ink-lt); font-size:12px; font-style:italic; padding:10px 0;">Nenhum serviço agendado para este período.</p>`;
    return;
  }

  eventos.forEach(ev => {
    let tipoClass = 'event-type-transfer';
    const tLower = ev.tipoServico.toLowerCase();
    if (tLower.includes('roteiro') || tLower.includes('guia')) tipoClass = 'event-type-roteiro';
    else if (tLower.includes('shinkansen')) tipoClass = 'event-type-shinkansen';
    else if (tLower.includes('romancecar')) tipoClass = 'event-type-romancecar';
    else if (tLower.includes('trem')) tipoClass = 'event-type-trem';
    else if (tLower.includes('ônibus') || tLower.includes('onibus')) tipoClass = 'event-type-onibus';
    else if (tLower.includes('experiência') || tLower.includes('experiencia')) tipoClass = 'event-type-experiencia';
    else if (tLower.includes('transfer') || tLower.includes('carro')) tipoClass = 'event-type-transfer';

    const dataFormatada = !ehHoje ? fmtDataBRAgenda(ev.dataServico) : '';
    const dateBadge = dataFormatada ? `<span style="font-size:10px; background:rgba(0,0,0,0.06); color:var(--ink-mid); padding:2px 6px; border-radius:4px; font-weight:600;">📅 ${dataFormatada}</span>` : '';
    
    // Chips de colaboradores
    const colabs = ev.assignee && ev.assignee.length > 0
      ? `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:6px;">
           ${ev.assignee.map(a => `<span style="font-size:10px; background:rgba(107,31,42,0.08); color:var(--crimson); padding:2px 6px; border-radius:12px; font-weight:600;">👤 ${a.name}</span>`).join('')}
         </div>`
      : `<span style="font-size:10px; color:var(--ink-lt); font-style:italic; display:block; margin-top:6px;">👤 Sem colaborador designado</span>`;

    const hora = ev.horaEncontro ? `🕒 ${ev.horaEncontro}` : '';
    const local = ev.localEncontro ? `📍 ${ev.localEncontro}` : '';
    const details = [hora, local].filter(Boolean).join(' &nbsp;·&nbsp; ');

    const card = document.createElement('div');
    card.className = `calendar-event-item ${tipoClass}`;
    Object.assign(card.style, {
      padding: '12px 14px',
      borderRadius: '6px',
      borderLeft: '4px solid',
      boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      marginBottom: '4px',
      whiteSpace: 'normal',
      overflow: 'visible',
      textOverflow: 'clip'
    });

    card.onclick = () => {
      if (typeof window.abrirCalendarioEventModal === 'function') {
        // Altera a aba para calendário e abre o modal
        const navItem = document.querySelector('.sidebar-nav a[data-page="calendario"]');
        if (navItem) {
          navItem.click();
          setTimeout(() => {
            window.abrirCalendarioEventModal(ev.id);
          }, 300);
        }
      }
    };

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:8px;">
        <span style="font-size:13px; font-weight:700; color:var(--ink); line-height:1.3;">${ev.titulo}</span>
        ${dateBadge}
      </div>
      <div style="font-size:11px; color:var(--ink-lt); font-weight:500;">
        Cliente: <strong style="color:var(--ink-mid)">${ev.clienteNome || 'Geral'}</strong>
      </div>
      ${details ? `<div style="font-size:11px; color:var(--ink-mid); font-style:italic; margin-top:2px;">${details}</div>` : ''}
      ${colabs}
    `;

    container.appendChild(card);
  });
}

function fmtDataBRAgenda(str) {
  if(!str) return '—';
  const parts = str.split('-');
  if(parts.length !== 3) return str;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
