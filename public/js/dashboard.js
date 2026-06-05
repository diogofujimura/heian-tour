let chartEvolucaoVendas = null;
let chartTopDestinos = null;

function renderDashboard() {
  if (!state || !state.orcamentosDB || !state.roteirosDB) return;

  const orcamentos = state.orcamentosDB;
  const roteiros = state.roteirosDB;

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
        const rot = roteiros.find(r => r.id == orc.orcRoteiroVinculado);
        if (rot && rot.dias) {
          rot.dias.forEach(dia => {
            const cityName = dia.cidadeBase || 'Desconhecida';
            if (cityName) {
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
