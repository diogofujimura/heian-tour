// ── MÓDULO: GESTÃO DE COLABORADORES & DASHBOARD FINANCEIRO (diárias/escala) ──
// Extraído de app.js em 2026-07-28 (Fatia 3 do fatiamento seguro). Carregado APÓS app.js.
// Funções globais (window.*) da aba Colaboradores: tabela, dashboard financeiro, diárias, lembretes.
// OBS: usa `calEventos` e `calColaboradores` declarados em app.js (escopo global; app.js carrega antes).

// ── SISTEMA DE GESTÃO DE COLABORADORES & DASHBOARD FINANCEIRO ───────────────
let calSelectedColaboradorId = null;
let colabDashOrdemData = 'desc'; // Começa decrescente por padrão

window.alternarOrdemDataColab = function() {
  colabDashOrdemData = colabDashOrdemData === 'asc' ? 'desc' : 'asc';
  
  const icones = [document.getElementById('colabOrdemDataIcon'), document.getElementById('colabOrdemDataIconFin')];
  icones.forEach(icon => {
    if (icon) icon.innerText = colabDashOrdemData === 'asc' ? ' ▲' : ' ▼';
  });
  
  filtrarDashColaborador();
};

window.setupColaboradoresTab = async function() {
  const listEl = document.getElementById('tabelaColaboradoresList');
  if (listEl) {
    listEl.innerHTML = '<div style="padding: 24px; text-align:center; color: var(--ink-lt);">Carregando colaboradores...</div>';
  }

  // Se a lista de colaboradores estiver vazia, carrega
  if (calColaboradores.length === 0) {
    try {
      const res = await fetch('/api/notion/colaboradores');
      if (res.ok) {
        calColaboradores = await res.json();
      }
    } catch (e) {
      console.error('Erro ao carregar colaboradores na aba:', e);
    }
  }
  
  renderColaboradoresTabela();
};

window.renderColaboradoresTabela = function() {
  const listEl = document.getElementById('tabelaColaboradoresList');
  const searchInput = document.getElementById('pesquisaColaboradoresList');
  if (!listEl) return;
  
  const query = (searchInput?.value || '').toLowerCase();
  const filtrados = calColaboradores.filter(c => c.name.toLowerCase().includes(query));
  
  if (filtrados.length === 0) {
    listEl.innerHTML = '<div style="padding: 24px; text-align:center; color: var(--ink-lt);">Nenhum colaborador encontrado</div>';
    return;
  }
  
  listEl.innerHTML = filtrados.map(c => {
    const isSelected = calSelectedColaboradorId === c.id;
    return `
      <div class="colab-list-item ${isSelected ? 'active' : ''}" 
           style="padding: 14px 24px; border-bottom: 1px solid var(--border); cursor:pointer; display:flex; align-items:center; gap:12px; transition: all 0.2s;"
           onclick="selecionarColaboradorDashboard('${c.id}')">
        <div style="width: 32px; height: 32px; border-radius:50%; background:var(--crimson-lt); color:var(--crimson); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; flex-shrink:0;">
          ${c.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div style="font-weight: 600; font-size: 13px; color: var(--ink-dk);">${c.name}</div>
          <div style="font-size:10px; color:var(--ink-lt); margin-top:2px;">Ativo</div>
        </div>
      </div>
    `;
  }).join('');
};

window.selecionarColaboradorDashboard = async function(id) {
  if (typeof window.mostrarDetailMobile === 'function') {
    window.mostrarDetailMobile('page-colaboradores');
  }
  calSelectedColaboradorId = id;
  renderColaboradoresTabela(); // Atualiza classe active
  
  const colab = calColaboradores.find(x => x.id === id);
  if (!colab) return;
  
  document.getElementById('colaboradoresEmptyState').style.display = 'none';
  document.getElementById('colaboradoresDetailWrapper').style.display = 'block';
  
  // Preencher cabeçalho completo (Card de Perfil Premium)
  document.getElementById('colabDashNome').innerText = colab.name;
  
  const avatarEl = document.getElementById('colabDashAvatar');
  if (avatarEl) {
    avatarEl.innerText = colab.name.charAt(0).toUpperCase();
  }
  
  const emailVal = colab.email || '';
  const emailEl = document.getElementById('colabDashEmail');
  const emailLinkEl = document.getElementById('colabDashEmailLink');
  if (emailEl) {
    emailEl.innerText = emailVal ? emailVal : 'Não informado';
  }
  if (emailLinkEl) {
    if (emailVal) {
      emailLinkEl.href = `mailto:${emailVal}`;
      emailLinkEl.style.cursor = 'pointer';
      emailLinkEl.style.pointerEvents = 'auto';
    } else {
      emailLinkEl.removeAttribute('href');
      emailLinkEl.style.cursor = 'default';
      emailLinkEl.style.pointerEvents = 'none';
    }
  }

  const waVal = colab.whatsapp || '';
  const waEl = document.getElementById('colabDashWhatsapp');
  const waLinkEl = document.getElementById('colabDashWhatsappLink');
  if (waEl) {
    waEl.innerText = waVal ? waVal : 'Não informado';
  }
  if (waLinkEl) {
    if (waVal) {
      const waNumOnly = waVal.replace(/\D/g, '');
      waLinkEl.href = `https://wa.me/${waNumOnly}`;
      waLinkEl.style.cursor = 'pointer';
      waLinkEl.style.pointerEvents = 'auto';
    } else {
      waLinkEl.removeAttribute('href');
      waLinkEl.style.cursor = 'default';
      waLinkEl.style.pointerEvents = 'none';
    }
  }

  document.getElementById('colabDashRate').innerText = `Taxa Padrão: ${colab.rate ? '¥ ' + colab.rate.toLocaleString() : 'Não informada'}`;
  document.getElementById('colabDashResidencia').innerText = `Residência: ${colab.residencia && colab.residencia.length > 0 ? colab.residencia.join(', ') : 'Não informado'}`;
  document.getElementById('colabDashLocais').innerText = `Atuação: ${colab.locais && colab.locais.length > 0 ? colab.locais.join(', ') : 'Não informado'}`;
  
  // Resetar para a sub-aba de Escala
  mudarSubAbaColab('escala');

  // Buscar eventos do calendário local
  try {
    const res = await fetch('/api/calendario/eventos');
    if (res.ok) {
      calEventos = await res.json();
    }
  } catch (e) {
    console.error('Erro ao buscar eventos para o dashboard:', e);
  }
  
  // Filtrar eventos onde o guia está designado
  const toursColab = calEventos.filter(ev => {
    return ev.assignee && ev.assignee.some(a => a.id === id);
  });
  
  // Popular filtro de Período (Mês/Ano)
  const filtroPeriodo = document.getElementById('colabDashFiltroPeriodo');
  if (filtroPeriodo) {
    const periodos = new Set();
    toursColab.forEach(ev => {
      if (ev.dataServico) {
        const cleanDate = ev.dataServico.includes('T') ? ev.dataServico.split('T')[0] : ev.dataServico;
        const [y, m] = cleanDate.split('-');
        periodos.add(`${y}-${m}`);
      }
    });
    
    const prevVal = filtroPeriodo.value || 'all';
    const mesesNomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
    let optionsHTML = '<option value="all">Todo o período</option>';
    Array.from(periodos).sort().reverse().forEach(p => {
      const [y, m] = p.split('-');
      const nomeMes = mesesNomes[parseInt(m) - 1];
      optionsHTML += `<option value="${p}">${nomeMes} ${y}</option>`;
    });
    filtroPeriodo.innerHTML = optionsHTML;
    
    if (Array.from(periodos).includes(prevVal) || prevVal === 'all') {
      filtroPeriodo.value = prevVal;
    } else {
      filtroPeriodo.value = 'all';
    }
  }
  
  filtrarDashColaborador();
};

window.mudarSubAbaColab = function(aba) {
  const btnEscala = document.getElementById('btnColabTabEscala');
  const btnFinanceiro = document.getElementById('btnColabTabFinanceiro');
  const wrapperEscala = document.getElementById('colabSubWrapperEscala');
  const wrapperFinanceiro = document.getElementById('colabSubWrapperFinanceiro');
  
  if (aba === 'escala') {
    btnEscala?.classList.add('active');
    btnFinanceiro?.classList.remove('active');
    if (wrapperEscala) wrapperEscala.style.display = 'block';
    if (wrapperFinanceiro) wrapperFinanceiro.style.display = 'none';
  } else {
    btnEscala?.classList.remove('active');
    btnFinanceiro?.classList.add('active');
    if (wrapperEscala) wrapperEscala.style.display = 'none';
    if (wrapperFinanceiro) wrapperFinanceiro.style.display = 'block';
  }
};

window.filtrarDashColaborador = function() {
  const id = calSelectedColaboradorId;
  const colab = calColaboradores.find(x => x.id === id);
  if (!colab) return;
  
  const periodSelected = document.getElementById('colabDashFiltroPeriodo')?.value || 'all';
  
  // Todos os tours designados para agenda
  let tours = calEventos.filter(ev => {
    return ev.assignee && ev.assignee.some(a => a.id === id);
  });
  
  // Filtrar por período se selecionado
  if (periodSelected !== 'all') {
    tours = tours.filter(ev => {
      if (!ev.dataServico) return false;
      const cleanDate = ev.dataServico.includes('T') ? ev.dataServico.split('T')[0] : ev.dataServico;
      const [y, m] = cleanDate.split('-');
      return `${y}-${m}` === periodSelected;
    });
  }
  
  // Ordenar tours por data (crescente ou decrescente)
  tours.sort((a, b) => {
    return colabDashOrdemData === 'asc'
      ? a.dataServico.localeCompare(b.dataServico)
      : b.dataServico.localeCompare(a.dataServico);
  });
  
  // ── SUB-ABA 1: RENDERIZAR TABELA DE ESCALA (TODOS OS SERVIÇOS) ──
  const tbodyEscala = document.getElementById('colabEscalaTableBody');
  if (tbodyEscala) {
    if (tours.length === 0) {
      tbodyEscala.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding: 24px; color: var(--ink-lt); font-style:italic;">
            Nenhum serviço ou escala atribuída neste período.
          </td>
        </tr>
      `;
    } else {
      tbodyEscala.innerHTML = tours.map(ev => {
        const dataFormatada = fmtDataBR(ev.dataServico);
        
        let localStr = ev.localEncontro || '-';
        if (!localStr && ev.cidade) localStr = ev.cidade;
        
        return `
          <tr style="border-bottom:1px solid var(--border); transition: background 0.15s;">
            <td style="padding:12px 16px; font-size:12px; color:var(--ink-dk); font-weight:600;">${dataFormatada}</td>
            <td style="padding:12px 16px; font-size:12px; color:var(--ink-dk); font-weight:600;">${ev.clienteNome || 'Cliente'}</td>
            <td style="padding:12px 16px; font-size:12px; cursor:pointer;" class="colab-servico-popover" data-id="${ev.id}" onclick="abrirCalendarioEventModal('${ev.id}')">
              <span class="compact-card-status" style="font-size:8px; text-transform:uppercase; padding:1px 4px; border-radius:3px; font-weight:600; background:rgba(0,0,0,0.04); color:var(--ink-mid);">
                ${ev.tipoServico}
              </span>
              <strong style="margin-left:4px; font-size:12px; color:var(--ink-dk);">${ev.titulo}</strong>
            </td>
            <td style="padding:12px 16px; font-size:12px; color:var(--ink-mid);">${ev.horaEncontro || '-'}</td>
            <td style="padding:12px 16px; font-size:12px; color:var(--ink-mid);">${localStr}</td>
            <td style="padding:12px 16px; font-size:12px; text-align:right;">
              <div style="display:flex; gap:6px; justify-content:flex-end; align-items:center;">
                <button class="btn-secondary" style="margin:0; padding:4px 8px; font-size:11px; border-radius:4px; border-color:var(--border);" onclick="enviarLembreteTrabalho('${ev.id}', 'email')">
                  E-mail
                </button>
                <button class="btn-secondary" style="margin:0; padding:4px 8px; font-size:11px; border-radius:4px; border-color:#25D366; color:#25D366; background:#f0fff4;" onclick="enviarLembreteTrabalho('${ev.id}', 'whatsapp')">
                  WhatsApp
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
  
  // ── SUB-ABA 2: CONTROLE FINANCEIRO (SERVIÇOS REMUNERADOS) ──
  const toursFinanceiro = tours.filter(ev => {
    const isRoteiro = ev.tipoServico && ev.tipoServico.toLowerCase() === 'roteiro';
    
    let temDiariaRemunerada = false;
    if (ev.valorDiariaColab && typeof ev.valorDiariaColab[id] === 'number') {
      temDiariaRemunerada = ev.valorDiariaColab[id] > 0;
    } else {
      temDiariaRemunerada = typeof ev.valorDiaria === 'number' && ev.valorDiaria > 0;
    }
    
    return isRoteiro || temDiariaRemunerada;
  });
  
  // Calcular KPIs (somente para Tours Guiados ou outros serviços remunerados)
  const totalTours = toursFinanceiro.length;
  let totalDevido = 0;
  let totalPago = 0;
  
  toursFinanceiro.forEach(ev => {
    let valor = colab.rate || 35000;
    if (ev.valorDiariaColab && typeof ev.valorDiariaColab[id] === 'number') {
      valor = ev.valorDiariaColab[id];
    } else if (typeof ev.valorDiaria === 'number') {
      valor = ev.valorDiaria;
    }
    
    let isPago = false;
    if (ev.pagoColab && ev.pagoColab[id] !== undefined) {
      isPago = !!ev.pagoColab[id];
    } else {
      isPago = ev.pago === true;
    }

    totalDevido += valor;
    if (isPago) {
      totalPago += valor;
    }
  });
  
  const totalPendente = totalDevido - totalPago;
  
  // Exibir KPIs formatados em ienes
  document.getElementById('kpiColabToursCount').innerText = totalTours;
  document.getElementById('kpiColabTotalDevido').innerText = `¥ ${totalDevido.toLocaleString()}`;
  document.getElementById('kpiColabTotalPago').innerText = `¥ ${totalPago.toLocaleString()}`;
  document.getElementById('kpiColabTotalPendente').innerText = `¥ ${totalPendente.toLocaleString()}`;
  
  // Renderizar tabela de tours financeiros
  const tbodyFinanceiro = document.getElementById('colabToursTableBody');
  if (tbodyFinanceiro) {
    if (toursFinanceiro.length === 0) {
      tbodyFinanceiro.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding: 24px; color: var(--ink-lt); font-style:italic;">
            Nenhum serviço remunerado atribuído neste período para faturamento.
          </td>
        </tr>
      `;
      return;
    }
    
    tbodyFinanceiro.innerHTML = toursFinanceiro.map(ev => {
      let valor = colab.rate || 35000;
      if (ev.valorDiariaColab && typeof ev.valorDiariaColab[id] === 'number') {
        valor = ev.valorDiariaColab[id];
      } else if (typeof ev.valorDiaria === 'number') {
        valor = ev.valorDiaria;
      }
      
      let isPago = false;
      if (ev.pagoColab && ev.pagoColab[id] !== undefined) {
        isPago = !!ev.pagoColab[id];
      } else {
        isPago = ev.pago === true;
      }
      
      const dataFormatada = fmtDataBR(ev.dataServico);
      
      return `
        <tr style="border-bottom:1px solid var(--border); transition: background 0.15s;">
          <td style="padding:12px 16px; font-size:12px; color:var(--ink-dk); font-weight:600;">${dataFormatada}</td>
          <td style="padding:12px 16px; font-size:12px; color:var(--ink-dk); font-weight:600;">${ev.clienteNome || 'Cliente'}</td>
          <td style="padding:12px 16px; font-size:12px; cursor:pointer;" class="colab-servico-popover" data-id="${ev.id}" onclick="abrirCalendarioEventModal('${ev.id}')">
            <span class="compact-card-status" style="font-size:8px; text-transform:uppercase; padding:1px 4px; border-radius:3px; font-weight:600; background:rgba(0,0,0,0.04); color:var(--ink-mid);">
              ${ev.tipoServico}
            </span>
            <strong style="margin-left:4px; font-size:12px; color:var(--ink-dk);">${ev.titulo}</strong>
          </td>
          <td style="padding:12px 16px; font-size:12px;">
            <input type="number" id="diaria_input_${ev.id}" class="search-input-modern" style="width:100px; padding:4px 8px; font-size:12px; margin:0;" value="${valor}">
          </td>
          <td style="padding:12px 16px; font-size:12px;">
            <select id="pago_select_${ev.id}" class="calendar-card-select" style="width:110px; height:26px; padding:2px 4px; font-size:11px; margin:0; border:1px solid var(--border);">
              <option value="false" ${!isPago ? 'selected' : ''}>Pendente</option>
               <option value="true" ${isPago ? 'selected' : ''}>Pago</option>
            </select>
          </td>
          <td style="padding:12px 16px; font-size:12px; text-align:right;">
            <button class="btn-primary" style="margin-top:0; padding:4px 10px; font-size:11px; border-radius:4px;" onclick="salvarDiariaEStatusTour('${ev.id}', this)">
              Salvar
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Adicionar listeners para o popover flutuante nos serviços
    tbodyFinanceiro.querySelectorAll('.colab-servico-popover').forEach(el => {
      el.addEventListener('mouseenter', (e) => showEventPopover(e, el.getAttribute('data-id')));
      el.addEventListener('mouseleave', hideEventPopover);
    });
  }
  
  // Adicionar listeners para o popover flutuante nos serviços da tabela de escala também
  if (tbodyEscala) {
    tbodyEscala.querySelectorAll('.colab-servico-popover').forEach(el => {
      el.addEventListener('mouseenter', (e) => showEventPopover(e, el.getAttribute('data-id')));
      el.addEventListener('mouseleave', hideEventPopover);
    });
  }
};

window.salvarDiariaEStatusTour = async function(eventoId, btnEl) {
  const colabId = calSelectedColaboradorId;
  if (!colabId) return;

  const inputValor = document.getElementById(`diaria_input_${eventoId}`);
  const selectPago = document.getElementById(`pago_select_${eventoId}`);
  if (!inputValor || !selectPago) return;
  
  const valor = Number(inputValor.value);
  const pago = selectPago.value === 'true';
  
  // Buscar evento original para checar status anterior
  const ev = typeof calEventos !== 'undefined' ? calEventos.find(e => e.id === eventoId) : null;
  const colab = typeof calColaboradores !== 'undefined' ? calColaboradores.find(x => x.id === colabId) : null;
  const colabName = colab ? colab.name : 'Colaborador';
  const isOriginallyPago = ev && ev.pagoColab && ev.pagoColab[colabId] === true;

  // Se o usuário mudou para Pago mas antes não estava Pago, abre o modal de Pagamento do Notion
  if (pago && !isOriginallyPago) {
    if (typeof window.iniciarPagamentoGuia === 'function') {
      window.iniciarPagamentoGuia(eventoId, colabId, colabName, ev ? ev.titulo : 'Serviço', valor, ev ? ev.clienteId : null);
      return;
    }
  }
  
  btnEl.disabled = true;
  btnEl.innerText = 'Salvando...';
  
  try {
    const res = await fetch(`/api/calendario/eventos/${eventoId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        colaboradorId: colabId,
        valorDiariaColab: valor,
        pagoColab: pago
      })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erro ao atualizar pagamento do tour');
    }
    
    // Atualizar dados localmente em calEventos
    const evIndex = calEventos.findIndex(e => e.id === eventoId);
    if (evIndex !== -1) {
      const ev = calEventos[evIndex];
      if (!ev.valorDiariaColab) ev.valorDiariaColab = {};
      if (!ev.pagoColab) ev.pagoColab = {};
      ev.valorDiariaColab[colabId] = valor;
      ev.pagoColab[colabId] = pago;

      // Sincroniza campos globais de compatibilidade se for o primeiro guia
      const primaryId = ev.assignee && ev.assignee.length > 0 ? ev.assignee[0].id : null;
      if (colabId === primaryId || !primaryId) {
        ev.valorDiaria = valor;
        ev.pago = pago;
      }
    }
    
    // Recalcular KPIs e remontar a tabela
    filtrarDashColaborador();
    alert('Informações de pagamento salvas localmente!');
  } catch (err) {
    console.error(err);
    alert(`Erro ao salvar: ${err.message}`);
  } finally {
    btnEl.disabled = false;
    btnEl.innerText = 'Salvar';
  }
};

window.enviarLembreteTrabalho = function(eventoId, meio = 'email') {
  const ev = calEventos.find(e => e.id === eventoId);
  if (!ev) return;
  
  const colab = calColaboradores.find(x => x.id === calSelectedColaboradorId);
  const nomeGuia = colab ? colab.name : 'Guia';
  const emailGuia = colab && colab.email ? colab.email : '';
  const whatsappGuia = colab && colab.whatsapp ? colab.whatsapp.replace(/\D/g, '') : '';
  
  const dataFormatada = fmtDataBR(ev.dataServico);
  
  let localStr = ev.localEncontro || '-';
  if (!localStr && ev.cidade) localStr = ev.cidade;
  
  // Mapear o tipo de serviço para exibição amigável
  let tipoTraduzido = ev.tipoServico || 'Serviço';
  if (tipoTraduzido.toLowerCase() === 'roteiro') tipoTraduzido = 'Tour Guiado (Roteiro)';
  if (tipoTraduzido.toLowerCase() === 'transporte') tipoTraduzido = 'Transporte / Transfer';
  if (tipoTraduzido.toLowerCase() === 'experiencia') tipoTraduzido = 'Experiência / Atração';
  
  const textoBase = 
    `Olá, ${nomeGuia}!\n\n` +
    `Confirmando o seu serviço designado para o dia ${dataFormatada}:\n\n` +
    `• Tipo: ${tipoTraduzido}\n` +
    `• Cliente: ${ev.clienteNome || 'Cliente'}\n` +
    `• Serviço: ${ev.titulo}\n` +
    `• Horário de Encontro: ${ev.horaEncontro || '-'}\n` +
    `• Local de Encontro: ${localStr}\n\n` +
    `Desejamos um excelente dia de trabalho!\n\n` +
    `Atenciosamente,\n` +
    `Equipe Heian Tour`;
    
  if (meio === 'email') {
    const emailDest = emailGuia || 'guia@heiantour.com';
    const assunto = encodeURIComponent(`[Escala Heian Tour] Detalhes do Serviço em ${dataFormatada}`);
    const corpo = encodeURIComponent(textoBase);
    const mailtoUrl = `mailto:${emailDest}?subject=${assunto}&body=${corpo}`;
    window.open(mailtoUrl, '_blank');
    alert(`E-mail de escala preparado para ${nomeGuia}${emailGuia ? ' (' + emailGuia + ')' : ''}! O seu aplicativo de e-mail foi aberto.`);
  } else {
    const textoWapp = encodeURIComponent(textoBase);
    const wappUrl = whatsappGuia 
      ? `https://wa.me/${whatsappGuia}?text=${textoWapp}`
      : `https://api.whatsapp.com/send?text=${textoWapp}`;
    window.open(wappUrl, '_blank');
    alert(`Mensagem do WhatsApp preparada para ${nomeGuia}! O WhatsApp foi aberto.`);
  }
};

