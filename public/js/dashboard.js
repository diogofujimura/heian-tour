let chartEvolucaoVendas = null;
let chartTopDestinos = null;
let chartClienteFinanceiro = null;

async function renderDashboard() {
  if (!state || !state.orcamentosDB) return;

  // Popula o select de clientes para o Dashboard
  const select = document.getElementById('dashClienteSelect');
  const clientes = window.notionClients || [];
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

  const orcamentos = state.orcamentosDB;
  const roteirosObj = window.dbRotas || {};

  let totalFechadas = 0;
  let totalPendentes = 0;
  let totalPerdidas = 0;
  
  let receitaTotal = 0;
  let lucroTotal = 0;

  // For chart data
  const vendasPorMes = {};
  const cidadesCount = {};

  orcamentos.forEach(orc => {
    const status = orc.statusVenda || 'Pendente';
    if (status === 'Fechado') totalFechadas++;
    else if (status === 'Perdido') totalPerdidas++;
    else totalPendentes++;

    // Se tiver fechado, contabilizar receita e lucro
    if (status === 'Fechado') {
      const { valorTotalFinal, lucroTotalCalc } = calculateOrcamentoTotals(orc);
      receitaTotal += valorTotalFinal || 0;
      lucroTotal += lucroTotalCalc || 0;

      // Evolução de Vendas
      const mes = orc.criadoEm ? orc.criadoEm.substring(0, 7) : 'Sem Data'; // YYYY-MM
      if (!vendasPorMes[mes]) vendasPorMes[mes] = 0;
      vendasPorMes[mes] += valorTotalFinal || 0;

      // Destinos a partir do Roteiro
      if (orc.orcRoteiroVinculado) {
        const rot = roteirosObj[orc.orcRoteiroVinculado];
        if (rot && rot.dias) {
          rot.dias.forEach(dia => {
            const cityName = dia.cidadeBase || dia.cidade || 'Desconhecida';
            if (cityName && cityName !== 'Desconhecida') {
              cidadesCount[cityName] = (cidadesCount[cityName] || 0) + 1;
            }
          });
        }
      }
    }
  });

  const totalGeral = totalFechadas + totalPendentes + totalPerdidas;
  const taxaConversao = totalGeral > 0 ? ((totalFechadas / totalGeral) * 100).toFixed(1) : '0.0';

  document.getElementById('kpiVendasTotal').textContent = `¥ ${receitaTotal.toLocaleString('en-US')}`;
  document.getElementById('kpiLucroTotal').textContent = `¥ ${lucroTotal.toLocaleString('en-US')}`;
  document.getElementById('kpiConversao').textContent = `${taxaConversao}%`;
  document.getElementById('kpiStats').textContent = `${totalFechadas} Fechadas / ${totalGeral} Totais`;
  document.getElementById('kpiPendentes').textContent = totalPendentes;

  renderChartEvolucao(vendasPorMes);
  renderChartDestinos(cidadesCount);
  
  // Carrega e renderiza a agenda operacional (Ordens de Serviço do dia e da semana)
  await carregarAgendaOperacional();
}

function calculateOrcamentoTotals(orc) {
  let valorTotalFinal = 0;
  let lucroTotalCalc = 0;
  let custoTotalCalc = 0;

  ['tours', 'transportes', 'experiencias', 'estadias'].forEach(cat => {
    if (orc[cat]) {
      orc[cat].forEach(item => {
        let custo = 0; let markup = 0; let venda = 0;
        if (cat === 'tours') {
          custo = item.custoBase || 0;
          markup = orc.markupTours || 20;
          venda = custo / (1 - (markup / 100));
        } else if (cat === 'transportes') {
          custo = item.valorTotal || 0;
          markup = orc.markupTransportes || 15;
          venda = custo / (1 - (markup / 100));
        } else if (cat === 'experiencias') {
          custo = item.valorTotal || 0;
          markup = orc.markupExperiencias || 15;
          venda = custo / (1 - (markup / 100));
        } else if (cat === 'estadias') {
          custo = item.valorTotal || 0;
          markup = orc.markupEstadias || 15;
          venda = custo / (1 - (markup / 100));
        }
        valorTotalFinal += venda;
        custoTotalCalc += custo;
      });
    }
  });

  const cons = orc.consultoria?.ativa ? (parseFloat(orc.consultoria.valor) || 0) : 0;
  valorTotalFinal += cons;

  const taxaCC = orc.taxaCartao || 0;
  const taxaHeian = orc.taxaHeian || 0;

  const valorLiquido = valorTotalFinal * (1 - (taxaCC/100) - (taxaHeian/100));
  lucroTotalCalc = valorLiquido - custoTotalCalc;

  return { valorTotalFinal, lucroTotalCalc };
}

function renderChartEvolucao(vendasPorMes) {
  const ctx = document.getElementById('chartEvolucaoVendas').getContext('2d');
  
  const labels = Object.keys(vendasPorMes).sort();
  const data = labels.map(l => vendasPorMes[l]);

  if (chartEvolucaoVendas) chartEvolucaoVendas.destroy();

  chartEvolucaoVendas = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Vendas (¥)',
        data: data,
        backgroundColor: '#6b1f2a',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

function renderChartDestinos(cidadesCount) {
  const ctx = document.getElementById('chartTopDestinos').getContext('2d');
  
  // Sort descending
  const sorted = Object.entries(cidadesCount).sort((a,b) => b[1] - a[1]).slice(0, 5);
  const labels = sorted.map(s => s[0]);
  const data = sorted.map(s => s[1]);

  if (chartTopDestinos) chartTopDestinos.destroy();

  chartTopDestinos = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: ['#6b1f2a', '#d9a05b', '#0f172a', '#94a3b8', '#e2e8f0'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, font: {size: 10} } }
      }
    }
  });
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
