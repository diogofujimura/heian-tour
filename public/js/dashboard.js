let chartClienteFinanceiro = null;
window.notionContas = [];
window.appConfig = {};
let currentPagamentoGuia = null;

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
  const titleEl = document.getElementById('dashboardPageTitle');
  const select = document.getElementById('dashClienteSelect');
  const selectVal = select ? select.value : '';
  if (titleEl && !selectVal) {
    titleEl.textContent = 'Painel Geral & Operacional';
  }

  // Inicializa dados de contas e taxas se necessário
  if (!window.notionContas || window.notionContas.length === 0) {
    await inicializarDashboardFinanceiro();
  }

  // Busca a ordenação personalizada do Kanban do Supabase
  if (window.kanbanOrdem === undefined) {
    try {
      const ordRes = await fetch('/api/config/kanban_ordem');
      if (ordRes.ok) {
        window.kanbanOrdem = await ordRes.json();
      } else {
        window.kanbanOrdem = {};
      }
    } catch(e) {
      console.error('Erro ao carregar ordenação do Kanban:', e);
      window.kanbanOrdem = {};
    }
  }

  // Popula o select de clientes para o Dashboard
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

  // Carrega os saldos das contas
  await carregarSaldosContas();
}

async function salvarOrdemKanbanDOM() {
  const ordem = {};
  const colunas = document.querySelectorAll('.kanban-column');
  colunas.forEach(col => {
    const cardsContainer = col.querySelector('.kanban-cards-container');
    if (!cardsContainer) return;
    const status = cardsContainer.dataset.status;
    const cards = col.querySelectorAll('.kanban-card');
    const ids = Array.from(cards).map(card => card.dataset.id).filter(Boolean);
    ordem[status] = ids;
  });

  window.kanbanOrdem = ordem;

  try {
    await fetch('/api/config/kanban_ordem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ordem)
    });
  } catch(e) {
    console.error('Erro ao salvar ordenação do Kanban no Supabase:', e);
  }
}

function renderKanban() {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;

  const clientes = window.notionClients || [];
  board.innerHTML = '';

  KANBAN_STATUSES.forEach(statusConfig => {
    const colStatus = statusConfig.name;
    const colClients = clientes.filter(c => (c.status || 'Início/call de dúvidas').toLowerCase() === colStatus.toLowerCase());

    // Ordenação personalizada vinda do Supabase
    const ordemIds = window.kanbanOrdem && window.kanbanOrdem[colStatus] ? window.kanbanOrdem[colStatus] : [];
    if (ordemIds.length > 0) {
      colClients.sort((a, b) => {
        const idxA = ordemIds.indexOf(a.id);
        const idxB = ordemIds.indexOf(b.id);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }

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
      } else {
        await salvarOrdemKanbanDOM();
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

        let isDraggingAction = false;

        // Ao arrastar (Desktop)
        card.addEventListener('dragstart', (e) => {
          isDraggingAction = true;
          card.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', JSON.stringify({ id: c.id, fromStatus: c.status || 'Início/call de dúvidas' }));
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
          setTimeout(() => { isDraggingAction = false; }, 100);
        });

        // Reordenação dinâmica interativa no Desktop
        card.addEventListener('dragover', (e) => {
          e.preventDefault();
          const draggingCard = document.querySelector('.kanban-card.dragging');
          if (draggingCard && draggingCard !== card) {
            const bounding = card.getBoundingClientRect();
            const offset = e.clientY - bounding.top - bounding.height / 2;
            if (offset < 0) {
              card.parentNode.insertBefore(draggingCard, card);
            } else {
              card.parentNode.insertBefore(draggingCard, card.nextSibling);
            }
          }
        });

        // Eventos de Toque (Mobile / Tablet Drag & Drop)
        let startX, startY;
        let ghostEl = null;
        let activeContainer = null;

        card.addEventListener('touchstart', (e) => {
          isDraggingAction = false;
          const touch = e.touches[0];
          startX = touch.clientX;
          startY = touch.clientY;
          card.dataset.id = c.id;
          card.dataset.fromStatus = c.status || 'Início/call de dúvidas';
        }, { passive: true });

        card.addEventListener('touchmove', (e) => {
          const touch = e.touches[0];
          const diffX = touch.clientX - startX;
          const diffY = touch.clientY - startY;

          // Considera arrasto se mover mais de 10px
          if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
            isDraggingAction = true;
          }

          if (!isDraggingAction) return;

          // Previne scroll de tela ao arrastar o card
          if (e.cancelable) e.preventDefault();

          if (!ghostEl) {
            ghostEl = card.cloneNode(true);
            ghostEl.style.position = 'fixed';
            ghostEl.style.width = card.offsetWidth + 'px';
            ghostEl.style.height = card.offsetHeight + 'px';
            ghostEl.style.opacity = '0.85';
            ghostEl.style.pointerEvents = 'none';
            ghostEl.style.zIndex = '9999';
            ghostEl.style.transform = 'scale(1.03)';
            ghostEl.style.boxShadow = '0 10px 25px rgba(0,0,0,0.18)';
            document.body.appendChild(ghostEl);
            card.classList.add('dragging');
          }

          ghostEl.style.left = (touch.clientX - card.offsetWidth / 2) + 'px';
          ghostEl.style.top = (touch.clientY - card.offsetHeight / 2) + 'px';

          const elementUnder = document.elementFromPoint(touch.clientX, touch.clientY);
          if (elementUnder) {
            // Reordenação dinâmica por toque
            const targetCard = elementUnder.closest('.kanban-card');
            if (targetCard && targetCard !== card) {
              const bounding = targetCard.getBoundingClientRect();
              const offset = touch.clientY - bounding.top - bounding.height / 2;
              if (offset < 0) {
                targetCard.parentNode.insertBefore(card, targetCard);
              } else {
                targetCard.parentNode.insertBefore(card, targetCard.nextSibling);
              }
            } else {
              // Se está sobre o contêiner
              const container = elementUnder.closest('.kanban-cards-container');
              if (container) {
                if (activeContainer && activeContainer !== container) {
                  activeContainer.classList.remove('drag-over');
                }
                activeContainer = container;
                activeContainer.classList.add('drag-over');

                const cardsInCol = container.querySelectorAll('.kanban-card');
                if (cardsInCol.length === 0) {
                  container.appendChild(card);
                }
              } else {
                if (activeContainer) {
                  activeContainer.classList.remove('drag-over');
                  activeContainer = null;
                }
              }
            }
          }
        }, { passive: false });

        card.addEventListener('touchend', async (e) => {
          if (ghostEl) {
            ghostEl.remove();
            ghostEl = null;
          }
          card.classList.remove('dragging');

          if (activeContainer) {
            activeContainer.classList.remove('drag-over');
            const targetStatus = activeContainer.dataset.status;
            const fromStatus = card.dataset.fromStatus;
            const id = card.dataset.id;
            activeContainer = null;

            if (targetStatus && fromStatus && targetStatus.toLowerCase() !== fromStatus.toLowerCase()) {
              await atualizarStatusClienteKanban(id, targetStatus);
            } else {
              await salvarOrdemKanbanDOM();
            }
          } else {
            // Se soltou na mesma coluna por movimento sutil
            if (isDraggingAction) {
              await salvarOrdemKanbanDOM();
            }
          }

          if (isDraggingAction) {
            setTimeout(() => { isDraggingAction = false; }, 100);
          }
        });

        // Click simples para navegar (só se não for arrasto)
        card.addEventListener('click', (e) => {
          if (isDraggingAction) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
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
    await salvarOrdemKanbanDOM();
    renderKanban();
    
    if (typeof window.renderClientesTabela === 'function') {
      window.renderClientesTabela();
    }

    // Se a ficha desse cliente estiver aberta no momento, atualiza ela também!
    if (window.clienteAtualVisualizado === id && typeof window.abrirDetalhesCliente === 'function') {
      window.abrirDetalhesCliente(id);
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
  const select = document.getElementById('dashClienteSelect');
  if (select) {
    select.value = clientId || '';
  }
  const containerGeral = document.getElementById('dashboardGeralContainer');
  const containerCliente = document.getElementById('dashboardClienteContainer');
  const titleEl = document.getElementById('dashboardPageTitle');
  if (!containerGeral || !containerCliente) return;

  const btnLink = document.getElementById('btnFichaLinkCliente');
  if (btnLink) {
    btnLink.style.display = clientId ? 'inline-flex' : 'none';
  }

  if (!clientId) {
    if (titleEl) titleEl.textContent = 'Painel Geral & Operacional';
    containerGeral.classList.remove('hidden');
    containerCliente.classList.add('hidden');
    renderDashboard();
    return;
  }

  const clientInfo = (window.notionClients || []).find(c => c.id === clientId);
  if (titleEl && clientInfo) {
    titleEl.textContent = `Financeiro do Cliente: ${clientInfo.nome || 'Sem nome'}`;
  }

  containerGeral.classList.add('hidden');
  containerCliente.classList.remove('hidden');

  // Set loading state
  document.getElementById('kpiCliRecebido').textContent = 'Carregando...';
  document.getElementById('kpiCliDespesas').textContent = 'Carregando...';
  document.getElementById('kpiCliCustoGuias').textContent = 'Carregando...';
  document.getElementById('kpiCliCaixaAtual').textContent = 'Carregando...';
  document.getElementById('kpiCliLucroProjetadoFinal').textContent = 'Carregando...';

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
    document.getElementById('kpiCliCustoGuias').textContent = `¥ ${summary.custoGuiasTotal.toLocaleString('en-US')}`;
    
    const detEl = document.getElementById('kpiCliCustoGuiasDet');
    if (detEl) {
      detEl.textContent = `¥ ${summary.custoGuiasPago.toLocaleString('en-US')} Pago / ¥ ${summary.custoGuiasPendente.toLocaleString('en-US')} Pendente`;
    }

    document.getElementById('kpiCliCaixaAtual').textContent = `¥ ${summary.caixaAtual.toLocaleString('en-US')}`;

    // Fill client ficha info
    const clientInfo = (window.notionClients || []).find(c => c.id === clientId);
    const contrato = clientInfo ? (clientInfo.valorTotal || 0) : 0;
    const lucroProjetadoFinal = contrato - summary.totalDespesas - summary.custoGuiasTotal;

    const lucroProjEl = document.getElementById('kpiCliLucroProjetadoFinal');
    lucroProjEl.textContent = `¥ ${lucroProjetadoFinal.toLocaleString('en-US')}`;
    if (lucroProjetadoFinal < 0) {
      lucroProjEl.style.color = '#e74c3c';
    } else {
      lucroProjEl.style.color = 'var(--crimson)';
    }

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
    renderChartCliente(summary.totalRecebido, summary.totalDespesas + summary.custoGuiasTotal, summary.caixaAtual, lucroProjetadoFinal);

    // Populate Tables
    renderTableCliEntradas(details.entradas);
    renderTableCliSaidas(details.saidas);
    renderTableCliTasks(details.tasks);
    renderTableCliGuias(details.guias);

  } catch (err) {
    console.error(err);
    alert('Erro ao carregar dados do dashboard do cliente: ' + err.message);
  }
}

function renderChartCliente(recebido, despesas, caixa, lucro) {
  const ctx = document.getElementById('chartClienteFinanceiro')?.getContext('2d');
  if (!ctx) return;

  if (chartClienteFinanceiro) chartClienteFinanceiro.destroy();

  chartClienteFinanceiro = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Recebido', 'Custos Totais', 'Caixa Líquido', 'Lucro Projetado'],
      datasets: [{
        label: 'Valor (¥)',
        data: [recebido, despesas, caixa, lucro],
        backgroundColor: [
          'rgba(46, 204, 113, 0.75)',
          'rgba(231, 76, 60, 0.75)',
          'rgba(52, 152, 219, 0.75)',
          'rgba(196, 163, 90, 0.75)'
        ],
        borderColor: [
          '#2ecc71',
          '#e74c3c',
          '#3498db',
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
    let tipoClassSuffix = 'transporte';
    const tLower = (ev.tipoServico || '').toLowerCase();
    
    if (tLower.includes('roteiro')) {
      tipoClassSuffix = 'tour';
    } else if (tLower.includes('experiência') || tLower.includes('experiencia')) {
      tipoClassSuffix = 'experiencia';
    } else {
      tipoClassSuffix = 'transporte';
    }

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
    card.className = `calendar-event-item card-type-${tipoClassSuffix}`;
    Object.assign(card.style, {
      padding: '12px 14px',
      borderRadius: '6px',
      borderLeft: '4px solid',
      border: '1px solid',
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

// --- Novas Funções de Controle Financeiro e Diárias ---

async function inicializarDashboardFinanceiro() {
  try {
    const resContas = await fetch('/api/notion/contas');
    if (resContas.ok) {
      window.notionContas = await resContas.json();
      const selectConta = document.getElementById('modalPagarGuiaConta');
      if (selectConta) {
        selectConta.innerHTML = '<option value="">Selecione uma conta...</option>';
        window.notionContas.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.nome;
          selectConta.appendChild(opt);
        });
      }
    }
    const resConfig = await fetch('/api/config');
    if (resConfig.ok) {
      window.appConfig = await resConfig.json();
    }
  } catch (e) {
    console.error('Erro ao inicializar dados financeiros:', e);
  }
}

async function carregarSaldosContas() {
  const container = document.getElementById('saldosContasContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/dashboard/saldos-contas');
    if (!res.ok) throw new Error('Erro ao buscar saldos de contas');
    const contas = await res.json();
    window.notionSaldosContas = contas;

    // 1. Calcular KPIs Consolidados
    let totalCaixaJPY = 0;
    let totalEntradasMesJPY = 0;
    let totalSaidasMesJPY = 0;

    const rateBRL = window.appConfig?.cambio_jpy_brl || 0.031670;
    const rateUSD = window.appConfig?.cambio_jpy_usd || 0.006280;

    const hoje = new Date();
    const anoMesAtual = hoje.toISOString().substring(0, 7); // "yyyy-mm"

    contas.forEach(c => {
      // Caixa consolidado
      totalCaixaJPY += c.saldoJPY;
      if (c.saldoBRL !== 0) {
        totalCaixaJPY += Math.round(c.saldoBRL / rateBRL);
      }
      if (c.saldoUSD !== 0) {
        totalCaixaJPY += Math.round(c.saldoUSD / rateUSD);
      }

      // Entradas e saídas do mês
      (c.movimentacoes || []).forEach(m => {
        if (m.data && m.data.startsWith(anoMesAtual)) {
          const valorMovJPY = m.valorJPY || 0;
          if (m.tipo === 'entrada') {
            totalEntradasMesJPY += valorMovJPY;
          } else {
            totalSaidasMesJPY += valorMovJPY;
          }
        }
      });
    });

    // Renderizar KPIs
    const kpiCaixa = document.getElementById('kpiCaixaConsolidado');
    const kpiEntradas = document.getElementById('kpiEntradasMes');
    const kpiSaidas = document.getElementById('kpiSaidasMes');
    const subkpiEntradas = document.getElementById('subkpiEntradasMes');
    const subkpiSaidas = document.getElementById('subkpiSaidasMes');

    const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const mesAtualNome = mesesNomes[hoje.getMonth()];

    if (kpiCaixa) kpiCaixa.textContent = `¥ ${totalCaixaJPY.toLocaleString('en-US')}`;
    if (kpiEntradas) kpiEntradas.textContent = `¥ ${totalEntradasMesJPY.toLocaleString('en-US')}`;
    if (kpiSaidas) kpiSaidas.textContent = `¥ ${totalSaidasMesJPY.toLocaleString('en-US')}`;
    if (subkpiEntradas) subkpiEntradas.textContent = `${mesAtualNome} / ${hoje.getFullYear()}`;
    if (subkpiSaidas) subkpiSaidas.textContent = `${mesAtualNome} / ${hoje.getFullYear()}`;

    // Atualizar diárias pendentes na coluna da direita
    if (typeof carregarDiariasPendentesContabilidade === 'function') {
      carregarDiariasPendentesContabilidade();
    }

    container.innerHTML = '';
    if (contas.length === 0) {
      container.innerHTML = '<div style="color:var(--ink-lt); font-size:12px; font-style:italic;">Nenhuma conta encontrada.</div>';
      return;
    }

    contas.forEach(c => {
      const card = document.createElement('div');
      card.className = 'kpi-card';
      card.style.cursor = 'pointer';
      card.onclick = () => abrirVisaoGeralConta(c.id);

      Object.assign(card.style, {
        background: 'var(--warm-white)',
        padding: '20px 24px',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'transform 0.2s, box-shadow 0.2s'
      });

      card.onmouseover = () => { 
        card.style.transform = 'translateY(-2px)'; 
        card.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)'; 
      };
      card.onmouseout = () => { 
        card.style.transform = 'none'; 
        card.style.boxShadow = 'var(--shadow)'; 
      };

      const title = document.createElement('h4');
      Object.assign(title.style, {
        fontSize: '14px',
        color: 'var(--crimson)',
        fontWeight: '700',
        margin: '0',
        textTransform: 'uppercase',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      });
      title.innerHTML = `<span>💳 ${c.nome}</span> <span style="font-size:10px; color:var(--ink-lt); font-weight:500; text-transform:none;">Ver Extrato ➔</span>`;
      card.appendChild(title);

      const saldosWrapper = document.createElement('div');
      Object.assign(saldosWrapper.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        marginTop: '6px'
      });

      const hasBRL = c.saldoBRL !== 0;
      const hasJPY = c.saldoJPY !== 0;
      const hasUSD = c.saldoUSD !== 0;

      if (!hasBRL && !hasJPY && !hasUSD) {
        const p = document.createElement('p');
        Object.assign(p.style, {
          fontFamily: 'var(--ff-display)',
          fontSize: '18px',
          color: 'var(--ink-mid)',
          margin: '0',
          fontWeight: '600'
        });
        p.textContent = '¥ 0';
        saldosWrapper.appendChild(p);
      } else {
        if (hasJPY) {
          const p = document.createElement('p');
          Object.assign(p.style, {
            fontFamily: 'var(--ff-display)',
            fontSize: '18px',
            color: 'var(--gold-dk)',
            margin: '0',
            fontWeight: '600'
          });
          p.textContent = `¥ ${Math.round(c.saldoJPY).toLocaleString('en-US')}`;
          saldosWrapper.appendChild(p);
        }
        if (hasBRL) {
          const p = document.createElement('p');
          Object.assign(p.style, {
            fontFamily: 'var(--ff-display)',
            fontSize: '18px',
            color: '#2ecc71',
            margin: '0',
            fontWeight: '600'
          });
          p.textContent = `R$ ${c.saldoBRL.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          saldosWrapper.appendChild(p);
        }
        if (hasUSD) {
          const p = document.createElement('p');
          Object.assign(p.style, {
            fontFamily: 'var(--ff-display)',
            fontSize: '18px',
            color: '#3498db',
            margin: '0',
            fontWeight: '600'
          });
          p.textContent = `$ ${c.saldoUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          saldosWrapper.appendChild(p);
        }
      }

      card.appendChild(saldosWrapper);

      // Histórico de Movimentações (10 últimas)
      const movSection = document.createElement('div');
      Object.assign(movSection.style, {
        marginTop: '12px',
        borderTop: '1px dashed var(--border)',
        paddingTop: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      });

      const movTitle = document.createElement('div');
      Object.assign(movTitle.style, {
        fontSize: '10px',
        fontWeight: '700',
        color: 'var(--ink-lt)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '2px'
      });
      movTitle.textContent = 'Últimas Movimentações';
      movSection.appendChild(movTitle);

      const ultimas = c.movimentacoes.slice(0, 10);
      if (ultimas.length === 0) {
        const p = document.createElement('div');
        Object.assign(p.style, {
          fontSize: '11px',
          color: 'var(--ink-lt)',
          fontStyle: 'italic',
          padding: '4px 0'
        });
        p.textContent = 'Sem movimentações recentes';
        movSection.appendChild(p);
      } else {
        ultimas.forEach(m => {
          const row = document.createElement('div');
          Object.assign(row.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            gap: '8px'
          });

          const left = document.createElement('div');
          Object.assign(left.style, {
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: 'var(--ink-mid)',
            flex: '1'
          });
          
          const icon = m.tipo === 'entrada' ? '🟢' : '🔴';
          const dtFormated = m.data ? m.data.substring(5, 10).split('-').reverse().join('/') : '--/--';
          
          left.innerHTML = `<span style="margin-right:4px;">${icon}</span><span style="font-weight:600; margin-right:4px;">[${dtFormated}]</span><span>${m.descricao}</span>`;
          
          const right = document.createElement('div');
          Object.assign(right.style, {
            fontFamily: 'var(--ff-num)',
            fontWeight: '600',
            color: m.tipo === 'entrada' ? '#2ecc71' : '#e74c3c',
            whiteSpace: 'nowrap'
          });

          let valStr = '';
          if (m.moedaOriginal === 'BRL') valStr = `R$ ${m.valorOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          else if (m.moedaOriginal === 'USD') valStr = `$ ${m.valorOriginal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          else valStr = `¥ ${Math.round(m.valorOriginal).toLocaleString('en-US')}`;

          right.textContent = `${m.tipo === 'entrada' ? '+' : '-'} ${valStr}`;

          row.appendChild(left);
          row.appendChild(right);
          movSection.appendChild(row);
        });
      }

      card.appendChild(movSection);
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = '<div style="color:#e74c3c; font-size:12px;">Erro ao carregar saldos.</div>';
  }
}

function renderTableCliGuias(guias) {
  const tbody = document.querySelector('#tableCliGuias tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!guias || guias.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:15px; color:#888;">Nenhuma diária de guia registrada.</td></tr>';
    return;
  }
  guias.forEach(g => {
    const tr = document.createElement('tr');
    const idCheckbox = `chk-guia-${g.id}-${g.colabId}`;
    const isChecked = g.pago ? 'checked disabled' : '';
    const labelStatus = g.pago 
      ? '<span class="pdf-tag" style="background:#2ecc71; color:white; margin:0;">Pago</span>'
      : '<span class="pdf-tag" style="background:#f1c40f; color:white; margin:0;">Pendente</span>';
    
    tr.innerHTML = `
      <td>${g.dataServico ? fmtDataBR(g.dataServico) : '-'}</td>
      <td><strong>${g.titulo}</strong></td>
      <td>👤 ${g.colabName}</td>
      <td style="text-align:right; font-family:var(--ff-num); font-weight:600;">¥ ${g.valor.toLocaleString('en-US')}</td>
      <td style="text-align:center; display:flex; align-items:center; justify-content:center; gap:8px; height:100%; border:none;">
        <input type="checkbox" id="${idCheckbox}" ${isChecked} onchange="iniciarPagamentoGuia('${g.id}', '${g.colabId}', '${g.colabName}', '${g.titulo}', ${g.valor})" style="width:16px; height:16px; cursor:pointer;">
        ${labelStatus}
      </td>
      <td style="text-align:center;">
        <button onclick="deletarItemCalendarioTabela('${g.id}', '${g.titulo.replace(/'/g, "\\'")}')" style="background:none; border:none; color:#e74c3c; cursor:pointer; font-size:14px; padding: 4px;" title="Excluir Item do Calendário">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function deletarItemCalendarioTabela(id, titulo) {
  if (!confirm(`Deseja realmente excluir o dia/serviço "${titulo}" do calendário local e arquivar o card correspondente no Notion? Esta ação não pode ser desfeita.`)) {
    return;
  }
  
  try {
    const res = await fetch(`/api/calendario/eventos/${id}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao deletar dia do calendário');
    }
    
    alert('Dia excluído com sucesso do calendário e arquivado no Notion!');
    
    // Recarrega os dados do dashboard do cliente selecionado
    const clientId = document.getElementById('dashClienteSelect').value;
    if (clientId) {
      await selecionarClienteDashboard(clientId);
    }
  } catch (err) {
    console.error(err);
    alert(`Erro ao excluir dia: ${err.message}`);
  }
}

function iniciarPagamentoGuia(eventoId, colaboradorId, colaboradorNome, servicoNome, valorDiaria) {
  const chk = document.getElementById(`chk-guia-${eventoId}-${colaboradorId}`);
  if (chk && !chk.checked) {
    return;
  }
  
  currentPagamentoGuia = {
    eventoId,
    colaboradorId,
    clienteId: document.getElementById('dashClienteSelect').value,
    valorDiaria
  };

  document.getElementById('modalPagarGuiaServicoInfo').textContent = `Serviço: ${servicoNome}`;
  document.getElementById('modalPagarGuiaColab').value = colaboradorNome;
  
  const selectMoeda = document.getElementById('modalPagarGuiaMoeda');
  selectMoeda.value = 'JPY';
  
  const inputValor = document.getElementById('modalPagarGuiaValor');
  inputValor.value = valorDiaria;
  
  document.getElementById('modalPagarGuiaPreviewJPYWrapper').style.display = 'none';
  
  const modal = document.getElementById('modalPagarGuia');
  modal.style.display = 'flex';
  modal.classList.remove('hidden');
  modal.classList.add('active');
}

function fecharModalPagarGuia() {
  const modal = document.getElementById('modalPagarGuia');
  modal.style.display = 'none';
  modal.classList.add('hidden');
  modal.classList.remove('active');
  
  if (currentPagamentoGuia) {
    const chk = document.getElementById(`chk-guia-${currentPagamentoGuia.eventoId}-${currentPagamentoGuia.colaboradorId}`);
    if (chk && !chk.disabled) {
      chk.checked = false;
    }
  }
  currentPagamentoGuia = null;
}

function onChangeMoedaPagarGuia() {
  const moeda = document.getElementById('modalPagarGuiaMoeda').value;
  const valorInput = Number(document.getElementById('modalPagarGuiaValor').value) || 0;
  const wrapper = document.getElementById('modalPagarGuiaPreviewJPYWrapper');
  const previewText = document.getElementById('modalPagarGuiaPreviewJPY');
  
  if (moeda === 'JPY') {
    wrapper.style.display = 'none';
    return;
  }

  let rate = 1;
  if (moeda === 'BRL') {
    rate = window.appConfig?.cambio_jpy_brl || 0.031670;
  } else if (moeda === 'USD') {
    rate = window.appConfig?.cambio_jpy_usd || 0.006280;
  }

  const valorJPY = Math.round(valorInput / rate);
  previewText.textContent = `¥ ${valorJPY.toLocaleString('en-US')} JPY`;
  wrapper.style.display = 'block';
}

// Adicionar eventos e handlers
document.addEventListener('DOMContentLoaded', () => {
  const inputVal = document.getElementById('modalPagarGuiaValor');
  if (inputVal) {
    inputVal.addEventListener('input', onChangeMoedaPagarGuia);
  }

  const btnConfirmar = document.getElementById('btnConfirmarPagarGuia');
  if (btnConfirmar) {
    btnConfirmar.addEventListener('click', async () => {
      if (!currentPagamentoGuia) return;
      
      const contaId = document.getElementById('modalPagarGuiaConta').value;
      const moeda = document.getElementById('modalPagarGuiaMoeda').value;
      const valorInput = Number(document.getElementById('modalPagarGuiaValor').value) || 0;
      
      if (!contaId) {
        alert('Selecione a conta pagadora do Notion.');
        return;
      }
      if (valorInput <= 0) {
        alert('Preencha um valor válido para o pagamento.');
        return;
      }

      document.body.style.cursor = 'progress';
      btnConfirmar.disabled = true;
      const oldText = btnConfirmar.textContent;
      btnConfirmar.textContent = 'Enviando...';

      try {
        const response = await fetch('/api/calendario/pagar-guia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventoId: currentPagamentoGuia.eventoId,
            colaboradorId: currentPagamentoGuia.colaboradorId,
            clienteId: currentPagamentoGuia.clienteId,
            contaId: contaId,
            moeda: moeda,
            valorMoedaOriginal: valorInput
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Erro na requisição');
        }

        alert('Pagamento registrado com sucesso no Supabase e na base de Saídas do Notion!');
        fecharModalPagarGuia();
        
        const clientId = document.getElementById('dashClienteSelect').value;
        await selecionarClienteDashboard(clientId);
        await carregarSaldosContas();
        
      } catch (err) {
        console.error(err);
        alert('Erro ao registrar pagamento: ' + err.message);
      } finally {
        document.body.style.cursor = 'default';
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = oldText;
      }
    });
  }
});

// --- Modal de Visão Geral e Extrato de Conta ---

function abrirVisaoGeralConta(contaId) {
  const conta = (window.notionSaldosContas || []).find(c => c.id === contaId);
  if (!conta) return;

  window.currentVisaoGeralContaId = contaId;

  // Preencher título
  document.getElementById('modalVisaoGeralContaTitulo').textContent = `Extrato da Conta: ${conta.nome}`;

  // Preencher link para editar a conta no Notion
  const linkEditar = document.getElementById('modalVisaoGeralContaEditarLink');
  if (linkEditar) {
    linkEditar.href = `https://notion.so/${conta.id.replace(/-/g, '')}`;
  }

  // Preencher select de meses/anos com base nas movimentações
  const selectFiltro = document.getElementById('modalVisaoGeralContaMesFiltro');
  selectFiltro.innerHTML = '<option value="">Todos os meses</option>';

  const periodosUnicos = new Set();
  conta.movimentacoes.forEach(m => {
    if (m.data && m.data.length >= 7) {
      periodosUnicos.add(m.data.substring(0, 7)); // yyyy-mm
    }
  });

  const periodosSorted = Array.from(periodosUnicos).sort().reverse();
  const mesesNomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  periodosSorted.forEach(p => {
    const parts = p.split('-');
    const ano = parts[0];
    const mesIndex = parseInt(parts[1]) - 1;
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = `${mesesNomes[mesIndex]} / ${ano}`;
    selectFiltro.appendChild(opt);
  });

  // Chamar função de filtro inicial (Todos os meses)
  onFiltroMesVisaoGeralConta();

  // Exibir modal
  const modal = document.getElementById('modalVisaoGeralConta');
  modal.style.display = 'flex';
  modal.classList.remove('hidden');
  modal.classList.add('active');
}

function fecharModalVisaoGeralConta() {
  const modal = document.getElementById('modalVisaoGeralConta');
  modal.style.display = 'none';
  modal.classList.add('hidden');
  modal.classList.remove('active');
  window.currentVisaoGeralContaId = null;
}

function onFiltroMesVisaoGeralConta() {
  const contaId = window.currentVisaoGeralContaId;
  const conta = (window.notionSaldosContas || []).find(c => c.id === contaId);
  if (!conta) return;

  const periodo = document.getElementById('modalVisaoGeralContaMesFiltro').value; // yyyy-mm ou ""

  // Filtrar
  const filtradas = periodo
    ? conta.movimentacoes.filter(m => m.data && m.data.startsWith(periodo))
    : conta.movimentacoes;

  // Calcular balanço do período filtrado
  const balanco = {
    JPY: { entradas: 0, saidas: 0 },
    BRL: { entradas: 0, saidas: 0 },
    USD: { entradas: 0, saidas: 0 }
  };

  filtradas.forEach(m => {
    const moeda = m.moedaOriginal || 'JPY';
    const val = Number(m.valorOriginal) || 0;
    if (m.tipo === 'entrada') {
      if (balanco[moeda]) balanco[moeda].entradas += val;
    } else {
      if (balanco[moeda]) balanco[moeda].saidas += val;
    }
  });

  // Renderizar Balanço no display
  const balancoWrapper = document.getElementById('modalVisaoGeralContaBalancoWrapper');
  balancoWrapper.innerHTML = '';

  const moedasAtivas = Object.keys(balanco).filter(moeda => balanco[moeda].entradas !== 0 || balanco[moeda].saidas !== 0);

  if (moedasAtivas.length === 0) {
    balancoWrapper.innerHTML = '<span style="color:var(--ink-lt); font-style:italic;">Sem movimentações no período selecionado.</span>';
  } else {
    moedasAtivas.forEach(moeda => {
      const data = balanco[moeda];
      const saldo = data.entradas - data.saidas;
      
      let symb = '¥';
      let format = (v) => Math.round(v).toLocaleString('en-US');
      
      if (moeda === 'BRL') {
        symb = 'R$';
        format = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else if (moeda === 'USD') {
        symb = '$';
        format = (v) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      const div = document.createElement('div');
      Object.assign(div.style, {
        background: 'rgba(255,255,255,0.8)',
        padding: '6px 12px',
        borderRadius: '6px',
        border: '1px solid var(--border)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        fontWeight: '500'
      });

      const spanEntradas = `<span style="color:#2ecc71;">Entradas: +${symb}${format(data.entradas)}</span>`;
      const spanSaidas = `<span style="color:#e74c3c;">Saídas: -${symb}${format(data.saidas)}</span>`;
      const spanSaldo = `<strong style="color:${saldo >= 0 ? '#2ecc71' : '#e74c3c'}">Balanço: ${saldo >= 0 ? '+' : ''}${symb}${format(saldo)}</strong>`;

      div.innerHTML = `${spanEntradas} | ${spanSaidas} | ${spanSaldo}`;
      balancoWrapper.appendChild(div);
    });
  }

  // Preencher Tabela
  const tbody = document.querySelector('#tableModalVisaoGeralConta tbody');
  tbody.innerHTML = '';

  if (filtradas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#888; font-style:italic;">Nenhuma movimentação para o período.</td></tr>';
    return;
  }

  filtradas.forEach(m => {
    const tr = document.createElement('tr');
    
    // Formatar data
    let dateStr = '-';
    if (m.data) {
      const parts = m.data.split('-');
      if (parts.length === 3) dateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    const tipoLabel = m.tipo === 'entrada'
      ? '<span style="background:rgba(46, 204, 113, 0.1); color:#2ecc71; padding:2px 8px; border-radius:4px; font-weight:600; font-size:11px;">🟢 Entrada</span>'
      : '<span style="background:rgba(231, 76, 60, 0.1); color:#e74c3c; padding:2px 8px; border-radius:4px; font-weight:600; font-size:11px;">🔴 Saída</span>';

    let valorOrigStr = '';
    if (m.moedaOriginal === 'BRL') valorOrigStr = `R$ ${m.valorOriginal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    else if (m.moedaOriginal === 'USD') valorOrigStr = `$ ${m.valorOriginal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    else valorOrigStr = `¥ ${Math.round(m.valorOriginal).toLocaleString('en-US')}`;

    const notionPageUrl = `https://notion.so/${m.id.replace(/-/g, '')}`;
    const btnAcao = `<a href="${notionPageUrl}" target="_blank" class="btn-secondary" style="padding: 4px 10px; font-size: 11px; text-decoration: none; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--border);">✏️ Editar no Notion</a>`;

    tr.innerHTML = `
      <td style="padding: 10px 12px; font-size: 12px; border-bottom:1px solid rgba(0,0,0,0.04);">${dateStr}</td>
      <td style="padding: 10px 12px; border-bottom:1px solid rgba(0,0,0,0.04);">${tipoLabel}</td>
      <td style="padding: 10px 12px; font-size: 12px; font-weight:500; border-bottom:1px solid rgba(0,0,0,0.04);">${m.descricao}</td>
      <td style="padding: 10px 12px; font-size: 12px; border-bottom:1px solid rgba(0,0,0,0.04); color:var(--ink-mid);">${m.clienteNome || '-'}</td>
      <td style="padding: 10px 12px; font-size: 12px; border-bottom:1px solid rgba(0,0,0,0.04); color:var(--ink-mid);">${m.colaboradorNome || '-'}</td>
      <td style="padding: 10px 12px; text-align: right; font-family:var(--ff-num); font-size: 12px; font-weight:600; color:${m.tipo === 'entrada' ? '#2ecc71' : '#e74c3c'}; border-bottom:1px solid rgba(0,0,0,0.04);">${valorOrigStr}</td>
      <td style="padding: 10px 12px; text-align: right; font-family:var(--ff-num); font-size: 12px; font-weight:600; border-bottom:1px solid rgba(0,0,0,0.04);">¥ ${Math.round(m.valorJPY).toLocaleString('en-US')}</td>
      <td style="padding: 10px 12px; text-align: center; border-bottom:1px solid rgba(0,0,0,0.04);">${btnAcao}</td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Modal de Registrar Entrada / Recebimento de Cliente ---

window.copiarLinkClienteFromId = function(clientId) {
  if (!clientId || clientId === 'Geral') {
    alert('Selecione um cliente no menu superior para copiar o link correspondente.');
    return;
  }

  const link = `${window.location.origin}/cliente.html?id=${clientId}`;
  
  navigator.clipboard.writeText(link).then(() => {
    alert('Link da Área do Cliente copiado com sucesso para a área de transferência!');
  }).catch(err => {
    console.error('Erro ao copiar link:', err);
    const tempInput = document.createElement('input');
    tempInput.value = link;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
      document.execCommand('copy');
      alert('Link da Área do Cliente copiado com sucesso!');
    } catch (e) {
      alert('Não foi possível copiar o link automaticamente. Copie manualmente: ' + link);
    }
    document.body.removeChild(tempInput);
  });
};

window.copiarLinkCliente = function() {
  const clientId = document.getElementById('dashClienteSelect').value;
  window.copiarLinkClienteFromId(clientId);
};

async function abrirModalRegistrarEntrada() {
  const clienteId = document.getElementById('dashClienteSelect').value;
  if (!clienteId) {
    alert('Selecione um cliente primeiro.');
    return;
  }

  // Preencher descrição padrão com o nome do cliente selecionado
  const selectCli = document.getElementById('dashClienteSelect');
  const clienteNome = selectCli.options[selectCli.selectedIndex].text;
  document.getElementById('modalRegistrarEntradaDesc').value = `Pagamento - ${clienteNome}`;
  
  // Preencher e desabilitar o select de cliente do modal
  const selectCliModal = document.getElementById('modalRegistrarEntradaCliente');
  if (selectCliModal) {
    selectCliModal.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = clienteId;
    opt.textContent = clienteNome;
    selectCliModal.appendChild(opt);
    selectCliModal.value = clienteId;
    selectCliModal.disabled = true;
  }
  
  // Resetar outros campos
  document.getElementById('modalRegistrarEntradaMoeda').value = 'JPY';
  document.getElementById('modalRegistrarEntradaValor').value = '';
  document.getElementById('modalRegistrarEntradaPreviewJPYWrapper').style.display = 'none';
  document.getElementById('modalRegistrarEntradaData').value = new Date().toISOString().substring(0, 10);

  // Carregar contas
  const selectConta = document.getElementById('modalRegistrarEntradaConta');
  selectConta.innerHTML = '<option value="">Selecione a conta receptora...</option>';

  try {
    const res = await fetch('/api/notion/contas');
    if (!res.ok) throw new Error('Erro ao buscar contas');
    const contas = await res.json();
    
    contas.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nome;
      selectConta.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    selectConta.innerHTML = '<option value="">Erro ao carregar contas</option>';
  }

  // Exibir modal
  const modal = document.getElementById('modalRegistrarEntrada');
  modal.style.display = 'flex';
  modal.classList.remove('hidden');
  modal.classList.add('active');
}

function fecharModalRegistrarEntrada() {
  const modal = document.getElementById('modalRegistrarEntrada');
  modal.style.display = 'none';
  modal.classList.add('hidden');
  modal.classList.remove('active');
}

function onMoedaChangeRegistrarEntrada() {
  onValorChangeRegistrarEntrada();
}

function onValorChangeRegistrarEntrada() {
  const moeda = document.getElementById('modalRegistrarEntradaMoeda').value;
  const valorInput = Number(document.getElementById('modalRegistrarEntradaValor').value) || 0;
  const wrapper = document.getElementById('modalRegistrarEntradaPreviewJPYWrapper');
  const previewText = document.getElementById('modalRegistrarEntradaPreviewJPY');

  if (moeda === 'JPY' || valorInput === 0) {
    wrapper.style.display = 'none';
    return;
  }

  const rateBRL = parseFloat(state.config.cambio_jpy_brl) || 0.031670;
  const rateUSD = parseFloat(state.config.cambio_jpy_usd) || 0.006280;

  let estimadoJPY = 0;
  if (moeda === 'BRL') {
    estimadoJPY = Math.round(valorInput / rateBRL);
  } else if (moeda === 'USD') {
    estimadoJPY = Math.round(valorInput / rateUSD);
  }

  previewText.textContent = `¥ ${estimadoJPY.toLocaleString('en-US')}`;
  wrapper.style.display = 'flex';
}

// Configurar o listener para confirmar o recebimento
document.addEventListener('DOMContentLoaded', () => {
  const btnConfirmar = document.getElementById('btnConfirmarRegistrarEntrada');
  if (btnConfirmar) {
    btnConfirmar.addEventListener('click', async () => {
      let clienteId = document.getElementById('modalRegistrarEntradaCliente').value;
      if (!clienteId) {
        clienteId = document.getElementById('dashClienteSelect').value;
      }
      
      const descricao = document.getElementById('modalRegistrarEntradaDesc').value.trim();
      const moeda = document.getElementById('modalRegistrarEntradaMoeda').value;
      const valorOriginal = Number(document.getElementById('modalRegistrarEntradaValor').value) || 0;
      const contaId = document.getElementById('modalRegistrarEntradaConta').value;
      const data = document.getElementById('modalRegistrarEntradaData').value;

      if (!clienteId || clienteId === 'Geral') {
        alert('Selecione o cliente vinculado ao pagamento.');
        return;
      }
      if (!descricao) {
        alert('Por favor, insira a descrição da entrada.');
        return;
      }
      if (valorOriginal <= 0) {
        alert('Por favor, insira un valor válido maior que zero.');
        return;
      }
      if (!contaId) {
        alert('Por favor, selecione a conta receptora.');
        return;
      }

      const oldText = btnConfirmar.textContent;
      btnConfirmar.disabled = true;
      btnConfirmar.textContent = 'Gravando...';
      document.body.style.cursor = 'wait';

      try {
        const response = await fetch('/api/notion/registrar-entrada', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clienteId,
            descricao,
            valorOriginal,
            moeda,
            contaId,
            data
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Erro na requisição');
        }

        alert('Recebimento registrado com sucesso no Notion!');
        fecharModalRegistrarEntrada();

        // Recarregar os dados do cliente e os saldos/extrato de contabilidade
        const clientId = document.getElementById('dashClienteSelect').value;
        if (typeof selecionarClienteDashboard === 'function') {
          await selecionarClienteDashboard(clientId);
        }
        if (typeof carregarSaldosContas === 'function') {
          await carregarSaldosContas();
        }

      } catch (err) {
        console.error(err);
        alert('Erro ao registrar recebimento: ' + err.message);
      } finally {
        document.body.style.cursor = 'default';
        btnConfirmar.disabled = false;
        btnConfirmar.textContent = oldText;
      }
    });
  }

  // Configurar o listener para confirmar a saída/pagamento
  const btnConfirmarSaida = document.getElementById('btnConfirmarRegistrarSaida');
  if (btnConfirmarSaida) {
    btnConfirmarSaida.addEventListener('click', async () => {
      const descricao = document.getElementById('modalRegistrarSaidaDesc').value.trim();
      const moeda = document.getElementById('modalRegistrarSaidaMoeda').value;
      const valorOriginal = Number(document.getElementById('modalRegistrarSaidaValor').value) || 0;
      const contaId = document.getElementById('modalRegistrarSaidaConta').value;
      const data = document.getElementById('modalRegistrarSaidaData').value;
      const clienteId = document.getElementById('modalRegistrarSaidaCliente').value;
      const colaboradorId = document.getElementById('modalRegistrarSaidaColab').value;
      const eventoId = document.getElementById('modalRegistrarSaidaEventoId').value;
      const taskId = document.getElementById('modalRegistrarSaidaTask')?.value || undefined;

      if (!descricao) {
        alert('Por favor, insira a descrição da saída.');
        return;
      }
      if (valorOriginal <= 0) {
        alert('Por favor, insira um valor válido maior que zero.');
        return;
      }
      if (!contaId) {
        alert('Por favor, selecione a conta debitada.');
        return;
      }

      const oldText = btnConfirmarSaida.textContent;
      btnConfirmarSaida.disabled = true;
      btnConfirmarSaida.textContent = 'Gravando...';
      document.body.style.cursor = 'wait';

      try {
        const response = await fetch('/api/notion/registrar-saida', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clienteId: clienteId || undefined,
            colaboradorId: colaboradorId || undefined,
            eventoId: eventoId || undefined,
            descricao,
            valorOriginal,
            moeda,
            contaId,
            data,
            taskId: taskId || undefined
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Erro na requisição');
        }

        alert('Lançamento de Saída registrado com sucesso no Notion!');
        fecharModalRegistrarSaida();

        // Recarregar os dados do cliente e os saldos/extrato de contabilidade
        const clientId = document.getElementById('dashClienteSelect').value;
        if (clientId && clientId !== 'Geral' && typeof selecionarClienteDashboard === 'function') {
          await selecionarClienteDashboard(clientId);
        }
        if (typeof carregarSaldosContas === 'function') {
          await carregarSaldosContas();
        }

      } catch (err) {
        console.error(err);
        alert('Erro ao registrar saída: ' + err.message);
      } finally {
        document.body.style.cursor = 'default';
        btnConfirmarSaida.disabled = false;
        btnConfirmarSaida.textContent = oldText;
      }
    });
  }
});

// --- Novas Funções de Ações Financeiras Rápidas da Contabilidade ---

window.abrirModalRegistrarEntradaGeral = async function() {
  // Resetar campos
  document.getElementById('modalRegistrarEntradaDesc').value = 'Recebimento de Cliente';
  document.getElementById('modalRegistrarEntradaMoeda').value = 'JPY';
  document.getElementById('modalRegistrarEntradaValor').value = '';
  document.getElementById('modalRegistrarEntradaPreviewJPYWrapper').style.display = 'none';
  document.getElementById('modalRegistrarEntradaData').value = new Date().toISOString().substring(0, 10);

  // Popular select de clientes com a lista global notionClients
  const selectCliModal = document.getElementById('modalRegistrarEntradaCliente');
  if (selectCliModal) {
    selectCliModal.innerHTML = '<option value="">Selecione o cliente...</option>';
    const clientes = window.notionClients || [];
    clientes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nome;
      selectCliModal.appendChild(opt);
    });
    selectCliModal.disabled = false;
  }

  // Carregar contas
  const selectConta = document.getElementById('modalRegistrarEntradaConta');
  selectConta.innerHTML = '<option value="">Selecione a conta receptora...</option>';

  try {
    const res = await fetch('/api/notion/contas');
    if (!res.ok) throw new Error('Erro ao buscar contas');
    const contas = await res.json();
    
    contas.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nome;
      selectConta.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    selectConta.innerHTML = '<option value="">Erro ao carregar contas</option>';
  }

  // Exibir modal
  const modal = document.getElementById('modalRegistrarEntrada');
  modal.style.display = 'flex';
  modal.classList.remove('hidden');
  modal.classList.add('active');
};

window.abrirModalRegistrarSaidaGeral = async function() {
  // Resetar campos
  document.getElementById('modalRegistrarSaidaDesc').value = '';
  document.getElementById('modalRegistrarSaidaMoeda').value = 'JPY';
  document.getElementById('modalRegistrarSaidaValor').value = '';
  document.getElementById('modalRegistrarSaidaPreviewJPYWrapper').style.display = 'none';
  document.getElementById('modalRegistrarSaidaData').value = new Date().toISOString().substring(0, 10);
  document.getElementById('modalRegistrarSaidaEventoId').value = '';

  // Carregar contas
  const selectConta = document.getElementById('modalRegistrarSaidaConta');
  selectConta.innerHTML = '<option value="">Selecione a conta debitada...</option>';

  // Carregar clientes
  const selectCli = document.getElementById('modalRegistrarSaidaCliente');
  selectCli.innerHTML = '<option value="">Nenhum cliente (Despesa geral)</option>';

  // Carregar colaboradores
  const selectColab = document.getElementById('modalRegistrarSaidaColab');
  selectColab.innerHTML = '<option value="">Nenhum colaborador</option>';

  // Setup select de Tasks
  const selectTask = document.getElementById('modalRegistrarSaidaTask');
  if (selectTask) {
    selectTask.innerHTML = '<option value="">Selecione um cliente primeiro...</option>';
  }

  // Função para carregar as tasks do cliente
  window.carregarTasksDoClienteNoModal = async function(clientId) {
    if (!selectTask) return;
    if (!clientId) {
      selectTask.innerHTML = '<option value="">Selecione um cliente primeiro...</option>';
      return;
    }
    selectTask.innerHTML = '<option value="">Carregando serviços...</option>';
    try {
      const res = await fetch(`/api/notion/tasks-cliente/${clientId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      selectTask.innerHTML = '<option value="">Nenhum (Despesa avulsa)</option>';
      if (data.success && data.tasks && data.tasks.length > 0) {
        data.tasks.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = t.nome;
          selectTask.appendChild(opt);
        });
      }
    } catch (e) {
      console.error(e);
      selectTask.innerHTML = '<option value="">Erro ao carregar serviços</option>';
    }
  };

  selectCli.onchange = function() {
    window.carregarTasksDoClienteNoModal(this.value);
  };

  try {
    // 1. Contas
    const res = await fetch('/api/notion/contas');
    if (!res.ok) throw new Error('Erro ao buscar contas');
    const contas = await res.json();
    contas.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nome;
      selectConta.appendChild(opt);
    });

    // 2. Clientes
    const clis = window.notionClients || [];
    clis.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nome;
      selectCli.appendChild(opt);
    });

    // 3. Colaboradores
    const colabs = window.calColaboradores || [];
    colabs.forEach(col => {
      const opt = document.createElement('option');
      opt.value = col.id;
      opt.textContent = col.name;
      selectColab.appendChild(opt);
    });

    // Se já houver um cliente selecionado na tela do dashboard
    const currentClientId = document.getElementById('dashClienteSelect')?.value || '';
    if (currentClientId && currentClientId !== 'Geral') {
      selectCli.value = currentClientId;
      window.carregarTasksDoClienteNoModal(currentClientId);
    } else {
      window.carregarTasksDoClienteNoModal('');
    }

  } catch (err) {
    console.error(err);
    selectConta.innerHTML = '<option value="">Erro ao carregar contas</option>';
  }

  // Exibir modal
  const modal = document.getElementById('modalRegistrarSaida');
  modal.style.display = 'flex';
  modal.classList.remove('hidden');
  modal.classList.add('active');
};

window.fecharModalRegistrarSaida = function() {
  const modal = document.getElementById('modalRegistrarSaida');
  modal.style.display = 'none';
  modal.classList.add('hidden');
  modal.classList.remove('active');
};

window.onMoedaChangeRegistrarSaida = function() {
  onValorChangeRegistrarSaida();
};

window.onValorChangeRegistrarSaida = function() {
  const moeda = document.getElementById('modalRegistrarSaidaMoeda').value;
  const valorInput = Number(document.getElementById('modalRegistrarSaidaValor').value) || 0;
  const wrapper = document.getElementById('modalRegistrarSaidaPreviewJPYWrapper');
  const previewText = document.getElementById('modalRegistrarSaidaPreviewJPY');

  if (moeda === 'JPY' || valorInput === 0) {
    wrapper.style.display = 'none';
    return;
  }

  const rateBRL = window.appConfig?.cambio_jpy_brl || 0.031670;
  const rateUSD = window.appConfig?.cambio_jpy_usd || 0.006280;

  let estimadoJPY = 0;
  if (moeda === 'BRL') {
    estimadoJPY = Math.round(valorInput / rateBRL);
  } else if (moeda === 'USD') {
    estimadoJPY = Math.round(valorInput / rateUSD);
  }

  previewText.textContent = `¥ ${estimadoJPY.toLocaleString('en-US')}`;
  wrapper.style.display = 'flex';
};

// --- Funções de Gestão de Diárias Pendentes na Contabilidade ---

window.carregarDiariasPendentesContabilidade = async function() {
  const container = document.getElementById('diarasPendentesContabilidadeContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/financeiro/diarias-pendentes');
    if (!res.ok) throw new Error('Erro ao buscar diárias pendentes');
    const diarias = await res.json();

    container.innerHTML = '';
    if (diarias.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 24px; color: var(--ink-lt); font-style: italic; font-size: 13px;">
          🎉 Todas as diárias de guias foram pagas!
        </div>`;
      return;
    }

    diarias.forEach(d => {
      const item = document.createElement('div');
      Object.assign(item.style, {
        background: 'rgba(0,0,0,0.01)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        fontSize: '12px'
      });

      // Formatação de data
      let dateStr = d.dataServico || '';
      if (dateStr) {
        const parts = dateStr.split('-');
        if (parts.length === 3) dateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }

      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:4px;">
          <strong style="color:var(--crimson); font-size:13px;">👤 ${d.colaboradorNome}</strong>
          <span style="font-size:10px; background:rgba(0,0,0,0.05); color:var(--ink-mid); padding:2px 6px; border-radius:4px; font-weight:600;">📅 ${dateStr}</span>
        </div>
        <div style="font-weight:600; color:var(--ink-dk); margin-top:2px;">${d.eventoTitulo}</div>
        <div style="font-size:11px; color:var(--ink-lt);">
          Cliente: <span style="color:var(--ink-mid); font-weight:500;">${d.clienteNome}</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; border-top:1px dashed var(--border); padding-top:8px;">
          <span style="font-family:var(--ff-num); font-size:13px; font-weight:700; color:var(--gold-dk);">¥ ${d.valorDiaria.toLocaleString('en-US')}</span>
          <button class="btn-primary" onclick="iniciarPagamentoGuiaDeContabilidade('${d.eventoId}', '${d.colaboradorId}', '${d.colaboradorNome}', '${d.eventoTitulo}', ${d.valorDiaria}, '${d.clienteId}')" style="margin:0; padding:6px 12px; font-size:11px; border-radius:6px; font-weight:600; background-color:#e74c3c; border-color:#c0392b;">
            💸 Pagar Guia
          </button>
        </div>
      `;
      container.appendChild(item);
    });

  } catch (err) {
    console.error('Erro ao carregar diárias pendentes:', err);
    container.innerHTML = '<div style="color:#e74c3c; font-size:12px;">Erro ao carregar diárias pendentes.</div>';
  }
};

window.iniciarPagamentoGuiaDeContabilidade = async function(eventoId, colaboradorId, colaboradorNome, servicoNome, valorDiaria, clienteId) {
  currentPagamentoGuia = {
    eventoId,
    colaboradorId,
    clienteId: clienteId || 'cliente_desconhecido',
    valorDiaria
  };

  document.getElementById('modalPagarGuiaServicoInfo').textContent = `Serviço: ${servicoNome}`;
  document.getElementById('modalPagarGuiaColab').value = colaboradorNome;
  
  const selectMoeda = document.getElementById('modalPagarGuiaMoeda');
  selectMoeda.value = 'JPY';
  
  const inputValor = document.getElementById('modalPagarGuiaValor');
  inputValor.value = valorDiaria;
  
  document.getElementById('modalPagarGuiaPreviewJPYWrapper').style.display = 'none';
  
  // Carregar contas
  const selectConta = document.getElementById('modalPagarGuiaConta');
  selectConta.innerHTML = '<option value="">Carregando contas...</option>';
  
  try {
    const res = await fetch('/api/notion/contas');
    if (!res.ok) throw new Error('Erro ao buscar contas');
    const contas = await res.json();
    
    selectConta.innerHTML = '<option value="">Selecione a conta pagadora...</option>';
    contas.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.nome;
      selectConta.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
    selectConta.innerHTML = '<option value="">Erro ao carregar contas</option>';
  }

  const modal = document.getElementById('modalPagarGuia');
  modal.style.display = 'flex';
  modal.classList.remove('hidden');
  modal.classList.add('active');
};
