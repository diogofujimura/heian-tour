// ── MÓDULO: HUB / FICHA DO CLIENTE (visão geral, abas Resumo/Vouchers/Dados/Roteiros/Cotações) ──
// Extraído de app.js em 2026-07-28 (Fatia 4 do fatiamento seguro). Carregado APÓS app.js.
// Só funções globais (window.* e declarações); sem estado próprio. Lê estado global do app.js
// (`notionClients`, `state`, `dbRotas`, `roteiroEmEdicao`...) via escopo compartilhado (app.js carrega antes).

function _escHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function normalizarViajantesArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v.map(item => {
      if (typeof item === 'string') return { nome: item.trim() };
      return item || {};
    });
  }
  if (typeof v === 'string' && v.trim().length > 0) {
    return v.split('\n').filter(line => line.trim().length > 0).map(line => ({ nome: line.trim() }));
  }
  return [];
}


// ── HUB DO CLIENTE (ATALHOS) ────────────────────────────────────────────────────────

function formatHubButtons() {
  const btnCotacao = document.getElementById('btnAcessoCotacao');
  const btnRoteiro = document.getElementById('btnAcessoRoteiro');
  if (!btnCotacao || !btnRoteiro) return;
  
  if (!currentEditingClienteId) {
    btnCotacao.style.display = 'none';
    btnRoteiro.style.display = 'none';
    return;
  }
  
  btnCotacao.style.display = 'block';
  btnRoteiro.style.display = 'block';
  
  const cliente = typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === currentEditingClienteId) : null;
  const clienteNome = cliente ? cliente.nome : '';

  let roteiroNome = null;
  if (typeof dbRotas !== 'undefined' && clienteNome) {
    for (const [k, v] of Object.entries(dbRotas)) {
      if (v.cliente && v.cliente.nome === clienteNome) {
        roteiroNome = k;
        break;
      }
    }
  }

  // Buscar orcamento
  const orc = state.orcamentosDB.find(o => o.notionClienteId === currentEditingClienteId);

  // LOGIC FOR COTAÇÃO
  if (orc) {
    btnCotacao.innerText = 'Abrir Cotação';
    btnCotacao.onclick = () => { closeClienteModal(); abrirOrcamento(orc.id); navToPage('orcamento'); };
  } else {
    btnCotacao.innerText = 'Gerar Cotação';
    btnCotacao.onclick = () => { 
      closeClienteModal(); 
      novoOrcamento();
      state.orcamento.notionClienteId = currentEditingClienteId;
      const nome = document.getElementById('mcNome').value || '';
      document.getElementById('orcNome').value = nome;
      document.getElementById('clienteNome').value = nome;
      document.getElementById('clienteAdultos').value = document.getElementById('mcAdultos').value || '2';
      document.getElementById('clienteCriancas').value = document.getElementById('mcCriancas').value || '0';
      state.orcamento.cliente.nome = nome;
      
      state.orcamento.estadias = JSON.parse(JSON.stringify(currentEditingEstadias));
      renderEstadiasReadOnlyForm();
      navToPage('orcamento'); 
    };
  }

  // LOGIC FOR ROTEIRO
  const rotNomeLinkado = (orc && orc.orcRoteiroVinculado) ? orc.orcRoteiroVinculado : roteiroNome;
  
  if (rotNomeLinkado) {
    btnRoteiro.innerText = 'Abrir Roteiro';
    btnRoteiro.onclick = () => { 
      closeClienteModal(); 
      if (orc) abrirOrcamento(orc.id); 
      document.getElementById('orcRoteiroVinculado').value = rotNomeLinkado; 
      navToPage('roteiros'); 
      
      setTimeout(() => {
        if (typeof preencherSelectRoteiros === 'function') preencherSelectRoteiros(rotNomeLinkado);
        const selRoteiro = document.getElementById('selectRoteiroBase');
        if (selRoteiro) {
          selRoteiro.value = rotNomeLinkado;
          const btnEd = document.getElementById('btnEditarRoteiro');
          const btnEx = document.getElementById('btnExcluirRoteiro');
          if (btnEd) {
            btnEd.style.display = 'inline-block';
            btnEd.click();
          }
          if (btnEx) btnEx.style.display = 'inline-block';
        }
      }, 300);
    };
  } else {
    btnRoteiro.innerText = 'Gerar Roteiro';
    btnRoteiro.onclick = async () => {
      closeClienteModal(); 
      novoOrcamento();
      state.orcamento.notionClienteId = currentEditingClienteId;
      const nome = document.getElementById('mcNome').value || '';
      document.getElementById('orcNome').value = nome;
      document.getElementById('clienteNome').value = nome;
      document.getElementById('clienteAdultos').value = document.getElementById('mcAdultos').value || '2';
      document.getElementById('clienteCriancas').value = document.getElementById('mcCriancas').value || '0';
      state.orcamento.cliente.nome = nome;
      state.orcamento.estadias = JSON.parse(JSON.stringify(currentEditingEstadias));
      renderEstadiasReadOnlyForm();
      
      if (typeof salvarOrcamentoAtual === 'function') salvarOrcamentoAtual();

      const nomeRoteiro = 'Roteiro - ' + (nome || 'Novo');
      
      let diasList = [];
      const safeNome = document.getElementById('mcNome') ? document.getElementById('mcNome').value : '';
      const safeAdultos = document.getElementById('mcAdultos') ? document.getElementById('mcAdultos').value : '2';
      const safeCriancas = document.getElementById('mcCriancas') ? document.getElementById('mcCriancas').value : '0';
      const safeDataInicio = document.getElementById('mcDataInicio') ? document.getElementById('mcDataInicio').value : '';
      const safeDataFim = document.getElementById('mcDataFim') ? document.getElementById('mcDataFim').value : '';
      const safeVooChegada = document.getElementById('mcVooChegada') ? document.getElementById('mcVooChegada').value : '';
      const safeVooPartida = document.getElementById('mcVooPartida') ? document.getElementById('mcVooPartida').value : '';
      
      const novoRoteiroObj = {
        cliente: {
          nome: safeNome,
          adultos: safeAdultos,
          criancas: safeCriancas,
          notionClienteId: currentEditingClienteId,
          dataOrcamento: new Date().toISOString().split('T')[0],
          dataInicio: safeDataInicio,
          dataFim: safeDataFim,
          vooChegada: safeVooChegada,
          vooPartida: safeVooPartida,
          estadias: typeof currentEditingEstadias !== 'undefined' ? JSON.parse(JSON.stringify(currentEditingEstadias)) : []
        },
        dias: diasList
      };
      
      try {
        const resp = await fetch('/api/roteiros/' + encodeURIComponent(nomeRoteiro), {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(novoRoteiroObj)
        });
        
        if (resp.status === 409) {
          const errData = await resp.json();
          alert(errData.message || 'Já existe um roteiro com este nome associado a outro cliente. Por favor, escolha outro nome.');
          return;
        }

        if (resp.ok) {
          // Guarda o ID imutável devolvido pelo servidor
          try {
            const j = await resp.json();
            if (j && j.id) {
              novoRoteiroObj.id = j.id;
              novoRoteiroObj.nome = j.nome || nomeRoteiro;
              state.orcamento.roteiroId = j.id;
            }
          } catch (e) { /* segue */ }
          if (typeof dbRotas !== 'undefined') dbRotas[nomeRoteiro] = novoRoteiroObj;
          document.getElementById('orcRoteiroVinculado').value = nomeRoteiro;
          state.orcamento.orcRoteiroVinculado = nomeRoteiro;
          if (typeof salvarOrcamentoAtual === 'function') salvarOrcamentoAtual();
          
          navToPage('roteiros');
          setTimeout(() => {
            if (typeof preencherSelectRoteiros === 'function') preencherSelectRoteiros(nomeRoteiro);
            const selRoteiro = document.getElementById('selectRoteiroBase');
            if (selRoteiro) {
               selRoteiro.value = nomeRoteiro;
               const btnEd = document.getElementById('btnEditarRoteiro');
               const btnEx = document.getElementById('btnExcluirRoteiro');
               if (btnEd) {
                 btnEd.style.display = 'inline-block';
                 btnEd.click();
               }
               if (btnEx) btnEx.style.display = 'inline-block';
            }
          }, 300);
        } else {
          alert('Erro ao criar roteiro autônomo.');
        }
      } catch(e) {
        console.error(e);
      }
    };
  }
}

window.abrirVisaoGeralCliente = function(clientId) {
try {
  const cliente = notionClients.find(c => c.id === clientId);
  if (!cliente) return;
  
  const orc = state.orcamentosDB.find(o => o.notionClienteId === clientId);
  
  let roteiroInfo = null;
  if (typeof dbRotas !== 'undefined') {
    for (const [k, v] of Object.entries(dbRotas)) {
      if (v.cliente && v.cliente.nome === cliente.nome) {
        roteiroInfo = { nome: k, data: v };
        break;
      }
    }
  }
  
  if (!orc && !roteiroInfo) {
    alert('Nenhum Roteiro ou Cotação encontrado para este cliente ainda.');
    return;
  }
  
  // Injeta o botão de alternância no header do preview
  let btnToggle = document.getElementById('btnTogglePreviewView');
  if (!btnToggle) {
    btnToggle = document.createElement('button');
    btnToggle.id = 'btnTogglePreviewView';
    btnToggle.className = 'btn-secondary';
    btnToggle.style.marginRight = '10px';
    btnToggle.style.color = '#fff';
    btnToggle.style.borderColor = 'rgba(255,255,255,0.4)';
    const headerDiv = document.querySelector('#previewOverlay .preview-toolbar div');
    headerDiv.insertBefore(btnToggle, document.getElementById('btnPrintFromPreview'));
  }
  
  if (orc && roteiroInfo) {
    btnToggle.style.display = 'inline-block';
    btnToggle.dataset.view = roteiroInfo ? 'roteiro' : 'cotacao';
    btnToggle.innerHTML = roteiroInfo ? 'Mudar para Cotação' : 'Mudar para Roteiro';
    
    btnToggle.onclick = function() {
      if (this.dataset.view === 'roteiro') {
        this.dataset.view = 'cotacao';
        this.innerHTML = 'Mudar para Roteiro';
        // Populate DOM before preview to prevent syncDOMToState from wiping it out
        state.orcamento = JSON.parse(JSON.stringify(orc));
        document.getElementById('orcNome').value = orc.nome || '';
        document.getElementById('clienteNome').value = orc.cliente?.nome || '';
        document.getElementById('clienteAdultos').value = orc.cliente?.adultos || '2';
        document.getElementById('clienteCriancas').value = orc.cliente?.criancas || '0';
        document.getElementById('clienteDataOrcamento').value = orc.cliente?.dataOrcamento || '';
        if (typeof preencherTextosForm === 'function') preencherTextosForm(orc.textos || {});
        renderPreview(); 
      } else {
        this.dataset.view = 'roteiro';
        this.innerHTML = 'Mudar para Cotação';
        roteiroOriginalNome = roteiroInfo.nome;
        roteiroEmEdicao = JSON.parse(JSON.stringify(roteiroInfo.data));
        document.getElementById('editRoteiroNome').value = roteiroInfo.nome;
        const btn = document.getElementById('btnPrevisualizarRoteiro');
        if(btn) btn.click();
      }
    };
  } else {
    btnToggle.style.display = 'none';
  }
  
  // Abre o que existir primeiro (dá preferencia pro roteiro)
  if (roteiroInfo) {
    roteiroOriginalNome = roteiroInfo.nome;
    roteiroEmEdicao = JSON.parse(JSON.stringify(roteiroInfo.data));
    document.getElementById('editRoteiroNome').value = roteiroInfo.nome;
    const btn = document.getElementById('btnPrevisualizarRoteiro');
    if(btn) btn.click();
  } else {
    // Populate DOM before preview
    state.orcamento = JSON.parse(JSON.stringify(orc));
    document.getElementById('orcNome').value = orc.nome || '';
    document.getElementById('clienteNome').value = orc.cliente?.nome || '';
    document.getElementById('clienteAdultos').value = orc.cliente?.adultos || '2';
    document.getElementById('clienteCriancas').value = orc.cliente?.criancas || '0';
    document.getElementById('clienteDataOrcamento').value = orc.cliente?.dataOrcamento || '';
    if (typeof preencherTextosForm === 'function') preencherTextosForm(orc.textos || {});
    renderPreview();
    document.getElementById('previewOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
} catch (err) {
  alert('DEBUG ERRO: ' + err.message + '\n' + err.stack);
  console.error(err);
}
};


// --- MOBILE MENU TOGGLE ---
document.addEventListener('DOMContentLoaded', () => {
  const mobileBtn = document.getElementById('mobileMenuToggle');
  const sidebar = document.querySelector('.sidebar');
  if(mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    
    // Close when clicking nav items on mobile
    const navItems = sidebar.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        if(window.innerWidth <= 768) {
          sidebar.classList.remove('open');
        }
      });
    });
  }
});

// --- MOBILE MASTER-DETAIL TOGGLE ---
window.mostrarDetailMobile = function(pageId) {
  if (window.innerWidth <= 768) {
    const layout = document.getElementById(pageId);
    if (layout) {
      layout.classList.add('show-detail');
      // Rolar painel de detalhes para o topo
      const paneContent = layout.querySelector('.pane-content');
      if (paneContent) paneContent.scrollTop = 0;
    }
  }
};

window.fecharDetailMobile = function(pageId) {
  const layout = document.getElementById(pageId);
  if (layout) {
    layout.classList.remove('show-detail');
  }
};


window.handleAcaoClienteCotacao = async function() {
  if (state.orcamento && state.orcamento.notionClienteId) {
    editarClienteNotion(state.orcamento.notionClienteId);
  } else {
    // Modo "Salvar Cliente no Notion"
    const nome = document.getElementById('clienteNome').value.trim();
    if (!nome) return alert('Preencha pelo menos o Nome do Cliente para salvar no Notion.');
    
    const btn = document.getElementById('btnEditarClienteCotacao');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = 'Salvando...';
    btn.disabled = true;

    try {
      const payload = {
        nome: nome,
        adultos: document.getElementById('clienteAdultos').value,
        criancas: document.getElementById('clienteCriancas').value,
        dataInicio: document.getElementById('clienteDataOrcamento').value || '',
        dataFim: '',
        status: 'Lead',
        vooChegada: '',
        vooPartida: ''
      };

      const res = await fetch('/api/notion/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Falha ao salvar no Notion');
      
      const newClient = await res.json();
      state.orcamento.notionClienteId = newClient.id;
      
      // Salva localmente as estadias vazias se houver
      await fetch('/api/clientes/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newClient.id, estadias: state.orcamento.estadias || [] })
      });

      // Recarrega NotionClients
      notionClients = await fetch('/api/notion/clientes?t=' + Date.now(), { cache: 'no-store' }).then(r=>r.json()); window.notionClients = notionClients;

      btn.innerHTML = '<svg class="v-icon" style="margin-right:2px;"><use href="#icon-user"></use></svg> Editar Cliente';
      btn.disabled = false;
      
      // Trava os campos e salva
      ['clienteNome', 'clienteAdultos', 'clienteCriancas'].forEach(id => {
        const el = document.getElementById(id);
        if(el) { el.readOnly = true; el.style = 'background:#f1f5f9; cursor:not-allowed'; }
      });
      
      document.getElementById('notionSelectWrapper').style.display = 'none';
      salvarOrcamentoAtual();
      
      alert('Cliente criado no Notion e vinculado com sucesso!');

    } catch (e) {
      console.error(e);
      alert('Erro ao salvar cliente no Notion.');
      btn.innerHTML = oldHtml;
      btn.disabled = false;
    }
  }
};

window.editarCotacaoAtual = function() {
  // Se tiver um overlay antigo escondemos
  const overlay = document.getElementById('previewOverlay');
  if(overlay) { overlay.classList.add('hidden'); document.body.style.overflow = ''; }
  
  document.getElementById('orcamentosPreviewWrapper').style.display = 'none';
  document.getElementById('orcamentosEditorWrapper').style.display = 'block';
};

window.excluirCotacaoAtual = async function() {
  if (!state.orcamento || !state.orcamento.id) return;
  if (!confirm('Tem certeza que deseja excluir esta cotação?')) return;
  
  try {
    // Attempt to delete from the server if it exists
    await fetch(`/api/orcamentos/${state.orcamento.id}`, { method: 'DELETE' }).catch(() => {});
  } catch(e) {}
  
  state.orcamentosDB = state.orcamentosDB.filter(o => o.id !== state.orcamento.id);
  saveOrcamentos(); 
  renderListaOrcamentos();
  
  document.getElementById('orcamentosPreviewWrapper').style.display = 'none';
  document.getElementById('orcamentosEditorWrapper').style.display = 'none';
  document.getElementById('orcamentosEmptyState').style.display = 'block';
  
  const overlay = document.getElementById('previewOverlay');
  if(overlay) { overlay.classList.add('hidden'); document.body.style.overflow = ''; }
  
  state.orcamento = null;
};

window.previewOrcamento = function(id) {
  // Só atualiza o preview se estivermos vendo um preview, nao se estivermos editando!
  if (document.getElementById('orcamentosEditorWrapper').style.display === 'block') {
    return;
  }
  // Se ja esta selecionado, nao faz nada
  if (state.orcamento && state.orcamento.id === id) return;
  
  // Carrega e renderiza o preview sutilmente
  const orc = state.orcamentosDB.find(o => String(o.id) === String(id));
  if (!orc) return;
  state.orcamento = JSON.parse(JSON.stringify(orc));
  
  document.getElementById('orcamentosEmptyState').style.display = 'none';
  document.getElementById('orcamentosEditorWrapper').style.display = 'none';
  document.getElementById('orcamentosPreviewWrapper').style.display = 'block';
  
  renderPreview();
  
  // Atualiza visual selection na lista de forma performática
  const listContainer = document.getElementById('orcamentosLista');
  if (listContainer) {
    listContainer.querySelectorAll('.list-card').forEach(card => {
      if (card.dataset.id === String(id)) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }
};

window.filterOrcamentosList = function() {
  const q = document.getElementById('pesquisaOrcamentosList').value.toLowerCase();
  renderListaOrcamentos(q);
};

// FASE 2 — Excluir cliente (cascata reversível). Confirma, chama o endpoint que arquiva no
// Notion (cliente + entradas/saídas/tasks) e faz soft-delete do roteiro/cotação no app.
window.excluirClienteFicha = async function(id) {
  try {
    const lista = (typeof notionClients !== 'undefined' && notionClients) || window.notionClients || [];
    const c = lista.find(x => String(x.id) === String(id));
    const nome = (c && (c.nome || c.Nome)) || 'este cliente';
    const ok = window.confirm('Excluir "' + nome + '"?\n\nIsto vai ARQUIVAR no Notion o cliente e os lançamentos dele (Entradas, Saídas e Tarefas) e mandar o roteiro e a cotação para a lixeira do app.\n\nTudo é REVERSÍVEL pela lixeira. Continuar?');
    if (!ok) return;
    const resp = await fetch('/api/notion/cliente/' + encodeURIComponent(id), { method: 'DELETE' });
    const j = await resp.json().catch(() => ({}));
    if (!resp.ok || j.success === false) {
      alert('Não consegui excluir: ' + (j.error || ('HTTP ' + resp.status)));
      return;
    }
    const a = j.arquivados || {};
    alert('Cliente excluído (foi para a lixeira).\n\nNotion arquivado: ' + (j.clienteArquivado ? 'cliente, ' : '') + (a.entradas||0) + ' entrada(s), ' + (a.saidas||0) + ' saída(s), ' + (a.tasks||0) + ' tarefa(s).\nApp: ' + (j.roteirosDeletados||0) + ' roteiro(s) e ' + (j.cotacoesDeletadas||0) + ' cotação(ões).');
    if (typeof window.closeClienteModal === 'function') window.closeClienteModal();
    if (typeof loadClientesTabela === 'function') { try { await loadClientesTabela(); } catch(e){} }
    else if (typeof renderClientesTabela === 'function') { try { renderClientesTabela(); } catch(e){} }
  } catch (e) {
    alert('Erro ao excluir cliente: ' + e.message);
  }
};
window.__clienteLocalLeveCache = window.__clienteLocalLeveCache || new Map();
window.__clienteLocalLevePending = window.__clienteLocalLevePending || new Map();

window.invalidarClienteLocalLeve = function(clienteId) {
  window.__clienteLocalLeveCache.delete(String(clienteId));
  window.__clienteLocalLevePending.delete(String(clienteId));
};

window.carregarClienteLocalLeve = function(clienteId, force = false) {
  const id = String(clienteId);
  if (force) window.invalidarClienteLocalLeve(id);
  if (window.__clienteLocalLeveCache.has(id)) {
    return Promise.resolve(window.__clienteLocalLeveCache.get(id));
  }
  if (window.__clienteLocalLevePending.has(id)) {
    return window.__clienteLocalLevePending.get(id);
  }
  const pending = fetch(`/api/clientes/local/${encodeURIComponent(id)}?light=1`, { cache: 'no-store' })
    .then(async response => {
      if (!response.ok) throw new Error(`Erro ao carregar ficha do cliente (${response.status})`);
      const data = await response.json();
      window.__clienteLocalLeveCache.set(id, data);
      return data;
    })
    .finally(() => window.__clienteLocalLevePending.delete(id));
  window.__clienteLocalLevePending.set(id, pending);
  return pending;
};

window.abrirDetalhesCliente = function(id, isHover = false) {
  if (typeof notionClients === 'undefined') return;
  const c = notionClients.find(x => x.id === id);
  if (!c) return;
  
  window.clienteAtualVisualizado = id;

  // Ocultar a barra lateral de clientes para focar nos detalhes do cliente selecionado APENAS se não for hover
  if (!isHover) {
    window.mostrarDetailMobile('page-clientes');
  }
  
  // Atualiza classe selected de forma performática
  const listContainer = document.getElementById('tabelaClientesList');
  if (listContainer) {
    listContainer.querySelectorAll('.list-card').forEach(card => {
      if (card.dataset.id === id) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }
  
  const emptyState = document.getElementById('clientesEmptyState');
  if (emptyState) emptyState.style.display = 'none';
  const detailWrapper = document.getElementById('clientesDetailWrapper');
  if (detailWrapper) detailWrapper.style.display = 'block';
  
  document.getElementById('clientesPreviewContainer').style.display = 'block';
  document.getElementById('clientesEditorContainer').style.display = 'none';
  
  window.carregarClienteLocalLeve(c.id, true).then(d => {
    const estadias = d.estadias || [];
    const viajantes = normalizarViajantesArray(d.viajantes || c.viajantes);
    const emails = d.emails || [];
    renderPreviewCliente(c, estadias, viajantes, emails, d.fotoPerfil || "", d.vouchers || [], d.marcos || {}, d.portalAtivo);
  }).catch(e => {
    console.error(e);
    const estadias = [];
    if (c.hotel) {
      c.hotel.split('\n').filter(l => l.trim()).forEach(line => {
        let cidade = ''; let hotel = line.trim(); let dataInicio = ''; let dataFim = '';
        const dateMatch = line.match(/\((\d{2}\/\d{2}\/\d{4})\s*(?:a|-|até)\s*(\d{2}\/\d{2}\/\d{4})\)/);
        if (dateMatch) {
          const parseDate = d => { const p = d.split('/'); return p[2]+'-'+p[1]+'-'+p[0]; };
          dataInicio = parseDate(dateMatch[1]); dataFim = parseDate(dateMatch[2]);
          hotel = line.substring(0, dateMatch.index).trim();
        }
        const dashIndex = hotel.indexOf(' - ');
        if (dashIndex > -1) { cidade = hotel.substring(0, dashIndex).trim(); hotel = hotel.substring(dashIndex + 3).trim(); }
        estadias.push({ id: Date.now() + Math.random(), cidade, dataInicio, dataFim, hotel });
      });
    }
    renderPreviewCliente(c, estadias, [], [], "", []);
  });
};

window.hoverCliente = function(id) {
  if (window.clienteAtualVisualizado === id) return;
  abrirDetalhesCliente(id, true);
};

window.editarClienteCard = function(id) {
  if (typeof notionClients === 'undefined') return;
  const c = notionClients.find(x => x.id === id);
  if (!c) return;

  window.clienteAtualVisualizado = id;
  renderClientesTabela();

  document.getElementById('clientesPreviewContainer').style.display = 'none';
  document.getElementById('clientesEditorContainer').style.display = 'block';

  abrirClienteModal(c);
};

window.calcularEstagioCliente = function(cliente, estadias = [], viajantes = [], vouchers = []) {
  if (!Array.isArray(estadias)) estadias = [];
  viajantes = normalizarViajantesArray(viajantes);
  if (!Array.isArray(vouchers)) vouchers = [];
  const etapas = [
    { id: 'cotacao', label: 'Cotação', status: 'pending', pendencias: [] },
    { id: 'passageiros', label: 'Passageiros', status: 'pending', pendencias: [] },
    { id: 'hoteis', label: 'Hotéis', status: 'pending', pendencias: [] },
    { id: 'emissoes', label: 'Emissões', status: 'pending', pendencias: [] },
    { id: 'pronto', label: 'Viagem', status: 'pending', pendencias: [] }
  ];

  // 1. COTAÇÃO
  const statusCli = (cliente.status || '').toLowerCase().trim();
  const isCotacao = statusCli === 'cotação' || statusCli === 'cotacao' || statusCli === 'leads' || statusCli === 'novo' || statusCli === '';
  if (isCotacao) {
    etapas[0].status = 'active';
    etapas[0].pendencias.push({ texto: 'Aprovar orçamento e alterar o status do cliente (atualmente em Cotação).', acao: 'editar', labelAcao: 'Alterar Status' });
    return { etapaAtiva: 'cotacao', etapas };
  } else {
    etapas[0].status = 'completed';
  }

  // 2. PASSAGEIROS
  const viajArr = viajantes;
  if (viajArr.length === 0) {
    etapas[1].status = 'active';
    etapas[1].pendencias.push({ texto: 'Nenhum viajante cadastrado para esta viagem.', acao: 'dados', labelAcao: 'Adicionar Viajantes' });
    return { etapaAtiva: 'passageiros', etapas };
  } else {
    etapas[1].status = 'completed';
  }

  // 3. HOTÉIS (ESTADIAS)
  if (!cliente.dataInicio || !cliente.dataFim) {
    etapas[2].status = 'active';
    etapas[2].pendencias.push({ texto: 'Definir as datas de início e fim da viagem no cadastro do cliente.', acao: 'editar', labelAcao: 'Definir Datas' });
    return { etapaAtiva: 'hoteis', etapas };
  }

  // Cobertura REAL por calendário (noites distintas dentro da viagem) — evita falso "coberto"
  const _toISO = (d) => {
    if (!d) return '';
    d = String(d);
    if (d.includes('/')) { const p = d.split('/'); if (p.length === 3) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`; }
    return d.slice(0, 10);
  };
  const _utc = (iso) => { const p = String(iso).split('-'); return Date.UTC(+p[0], (+p[1] || 1) - 1, +p[2] || 1); };
  const DIA = 86400000;
  const tStart = _utc(_toISO(cliente.dataInicio));
  const tEnd = _utc(_toISO(cliente.dataFim));
  const noitesViagem = Math.round((tEnd - tStart) / DIA);

  const noitesSet = new Set();
  estadias.forEach(est => {
    if (est.dataInicio && est.dataFim) {
      const a = _utc(_toISO(est.dataInicio));
      const b = _utc(_toISO(est.dataFim));
      if (!isNaN(a) && !isNaN(b) && b > a) {
        for (let t = a; t < b; t += DIA) {
          if (t >= tStart && t < tEnd) noitesSet.add(t);
        }
      }
    }
  });
  const noitesCobertas = noitesSet.size;

  if (noitesCobertas < noitesViagem) {
    etapas[2].status = 'active';
    const noitesFaltantes = noitesViagem - noitesCobertas;
    etapas[2].pendencias.push({ 
      texto: `Faltam cobrir ${noitesFaltantes} noite(s) de hotel na viagem (Cobertura: ${noitesCobertas} de ${noitesViagem} noites).`, 
      acao: 'dados', 
      labelAcao: 'Adicionar Hotel' 
    });
    return { etapaAtiva: 'hoteis', etapas };
  } else {
    etapas[2].status = 'completed';
  }

  // 4. EMISSÕES (TICKETS E INGRESSOS)
  const clienteNome = cliente.nome || '';
  const roteiro = typeof window.dbRotas !== 'undefined' ? Object.values(window.dbRotas).find(rot => {
    return rot.notionClienteId === cliente.id || (rot.cliente && rot.cliente.nome === clienteNome);
  }) : null;

  if (!roteiro) {
    etapas[3].status = 'active';
    etapas[3].pendencias.push({ texto: 'Roteiro do cliente ainda não foi criado no montador de roteiros.', acao: 'roteiros', labelAcao: 'Criar Roteiro' });
    return { etapaAtiva: 'emissoes', etapas };
  }

  let pendenciasEmissao = [];
  if (roteiro && roteiro.dias) {
    roteiro.dias.forEach((dia, dIdx) => {
      const diaLabel = `Dia ${dIdx + 1} (${dia.cidade || ''})`;
      if (dia.elementos) {
        dia.elementos.forEach(el => {
          if (el.tipo === 'transporte') {
            const emitido = el.compradoHeian === true;
            const temVoucher = el.refId ? vouchers.some(v => v.atracaoNome === 'ref:' + el.refId) : vouchers.some(v => v.atracaoNome && v.atracaoNome.startsWith('transporte:') && v.atracaoNome.includes(el.tipoTransporte));
            if (!emitido && !temVoucher) {
              const desc = `${el.tipoTransporte || 'Transporte'}${el.cidadeOrigem && el.cidadeDestino ? ` (${el.cidadeOrigem} ➔ ${el.cidadeDestino})` : ''}`;
              pendenciasEmissao.push({ texto: `Pendente emitir ticket de Transporte: ${desc} (${diaLabel}).`, acao: 'vouchers', labelAcao: 'Anexar Voucher' });
            }
          } else if (el.tipo === 'experiencia') {
            const emitido = el.compradoHeian === true;
            const temVoucher = el.refId ? vouchers.some(v => v.atracaoNome === 'ref:' + el.refId) : vouchers.some(v => v.atracaoNome && v.atracaoNome.startsWith('experiencia:') && v.atracaoNome.includes(el.nomeExp));
            if (!emitido && !temVoucher) {
              pendenciasEmissao.push({ texto: `Pendente emitir voucher de Experiência: ${el.nomeExp} (${diaLabel}).`, acao: 'vouchers', labelAcao: 'Anexar Voucher' });
            }
          }
        });
      }
    });
  }

  if (pendenciasEmissao.length > 0) {
    etapas[3].status = 'active';
    etapas[3].pendencias = pendenciasEmissao;
    return { etapaAtiva: 'emissoes', etapas };
  } else {
    etapas[3].status = 'completed';
  }

  // 5. VIAGEM PRONTA
  etapas[4].status = 'active';
  return { etapaAtiva: 'pronto', etapas };
};

// ── SELETOR DE STATUS NA FICHA (mover o cliente de etapa direto do selo) ──────
window.abrirSeletorStatusCliente = async function(id, anchorEl) {
  const jaAberto = document.getElementById('statusDropdownFicha');
  if (jaAberto) { jaAberto.remove(); return; }
  let lista = Array.isArray(window.kanbanStatusesFromNotion) ? window.kanbanStatusesFromNotion : null;
  if (!lista) { try { const r = await fetch('/api/notion/status-opcoes'); if (r.ok) lista = await r.json(); } catch (e) {} }
  if (!lista || !lista.length) {
    lista = ['Início/call de dúvidas','Em Negociação','Negociação Aprovada','Roteiro Rascunho','Compras','Roteiro versão final','Em Viagem','Finalizados','Cancelado'].map(n => ({ name: n, color: '#64748b' }));
  }
  const cli = (window.notionClients || []).find(c => c.id === id);
  const atual = cli ? (cli.status || '') : '';
  const dd = document.createElement('div');
  dd.id = 'statusDropdownFicha';
  const rect = anchorEl.getBoundingClientRect();
  dd.style.cssText = 'position:fixed;z-index:9999;background:#fff;border:1px solid var(--border,#e5e0d8);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,0.15);padding:6px;min-width:230px;max-height:340px;overflow:auto;top:' + (rect.bottom + 6) + 'px;left:' + rect.left + 'px;';
  lista.forEach(sOpt => {
    const isAtual = String(sOpt.name).toLowerCase() === String(atual).toLowerCase();
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;cursor:pointer;font-size:12.5px;' + (isAtual ? 'background:rgba(142,28,28,0.06);font-weight:700;' : '');
    row.onmouseenter = () => { if (!isAtual) row.style.background = 'rgba(0,0,0,0.04)'; };
    row.onmouseleave = () => { if (!isAtual) row.style.background = 'transparent'; };
    row.innerHTML = '<span style="width:9px;height:9px;border-radius:50%;flex-shrink:0;background:' + (sOpt.color || '#64748b') + ';"></span><span style="flex:1;">' + sOpt.name + '</span>' + (isAtual ? '<span style="color:var(--crimson);font-size:11px;">atual</span>' : '');
    row.onclick = (e) => { e.stopPropagation(); dd.remove(); if (!isAtual) window.mudarStatusClienteFicha(id, sOpt.name); };
    dd.appendChild(row);
  });
  document.body.appendChild(dd);
  setTimeout(() => { document.addEventListener('click', function fecha(ev) { const d = document.getElementById('statusDropdownFicha'); if (d && !d.contains(ev.target)) { d.remove(); document.removeEventListener('click', fecha); } }); }, 0);
};

window.mudarStatusClienteFicha = async function(id, novoStatus) {
  try {
    document.body.style.cursor = 'progress';
    const res = await fetch('/api/notion/clientes/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: novoStatus }) });
    if (!res.ok) throw new Error('Falha ao atualizar no Notion');
    // Atualiza o status NO OBJETO (mutando em lugar) nas DUAS referências — a `notionClients` que a
    // ficha relê e a `window.notionClients` que o kanban usa (elas podem divergir).
    const aplicar = (arr) => { if (Array.isArray(arr)) { const o = arr.find(c => c && c.id === id); if (o) o.status = novoStatus; } };
    try { if (typeof notionClients !== 'undefined') aplicar(notionClients); } catch (e) {}
    aplicar(window.notionClients);
    const cliObj = ((typeof notionClients !== 'undefined' && Array.isArray(notionClients)) ? notionClients.find(c => c.id === id) : null) || (window.notionClients || []).find(c => c.id === id);
    if (cliObj) fetch('/api/clientes/local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cliObj) }).catch(() => {});
    if (typeof window.abrirDetalhesCliente === 'function') window.abrirDetalhesCliente(id);
    if (typeof window.renderKanban === 'function') window.renderKanban();
  } catch (e) {
    console.error('mudarStatusClienteFicha:', e);
    alert('Não consegui mudar o status: ' + e.message);
  } finally {
    document.body.style.cursor = 'default';
  }
};

// ── TIMELINE DO CLIENTE (6 marcos automáticos) ────────────────────────────────
window.renderTimelineClienteHTML = function(cliente, vouchers, marcos) {
  try {
    vouchers = Array.isArray(vouchers) ? vouchers : [];
    marcos = marcos || {};
    const num = v => Number(v) || 0;
    const valorTotal = num(cliente.valorTotal);
    const totalPago = num(cliente.totalPago);
    const entrada = num(cliente.sinalDevido); // 1º pagamento vindo do servidor (30% tours + 100% do resto)
    const status = (cliente.status || '').toLowerCase();

    // Emissões: todos os itens compradoHeian (transporte/experiência) têm voucher
    let heianTotal = 0, heianComVoucher = 0;
    const roteiro = (typeof window.dbRotas !== 'undefined')
      ? Object.values(window.dbRotas).find(r => r && (r.notionClienteId === cliente.id || (r.cliente && r.cliente.nome === (cliente.nome || '')))) : null;
    if (roteiro && Array.isArray(roteiro.dias)) {
      roteiro.dias.forEach(dia => (dia.elementos || []).forEach(el => {
        if ((el.tipo === 'transporte' || el.tipo === 'experiencia') && el.compradoHeian === true) {
          heianTotal++;
          if (el.refId && vouchers.some(v => v.atracaoNome === 'ref:' + el.refId)) heianComVoucher++;
        }
      }));
    }

    let emViagem = false;
    if (cliente.dataInicio) { const di = new Date(cliente.dataInicio); if (!isNaN(di.getTime()) && di <= new Date()) emViagem = true; }
    if (['em viagem','finaliz','atendimento pós','atendimento pos','concluíd','concluid'].some(x => status.includes(x))) emViagem = true;

    const marcosDef = [
      { label: '1º pagamento',   done: entrada > 0 ? totalPago >= entrada : (valorTotal > 0 && totalPago >= 0.3 * valorTotal) },
      { label: 'Roteiro pronto', done: status.includes('versão final') || status.includes('versao final') || emViagem },
      { label: 'Enviado',        done: !!marcos.materialEnviado },
      { label: 'Emissões',       done: heianTotal > 0 && heianComVoucher === heianTotal },
      { label: 'Saldo quitado',  done: valorTotal > 0 && totalPago >= valorTotal - 1 },
      { label: 'Em viagem',      done: emViagem }
    ];
    const feitos = marcosDef.filter(m => m.done).length;
    const percentual = Math.round((feitos / marcosDef.length) * 100);

    let cells = '';
    marcosDef.forEach((m, i) => {
      const isCurrent = !m.done && marcosDef.slice(0, i).every(x => x.done);
      const stateClass = m.done ? 'is-complete' : (isCurrent ? 'is-current' : 'is-pending');
      const inner = m.done
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>'
        : (isCurrent ? '<span class="client-journey-current-dot"></span>' : '');
      const connLeft = i === 0 ? '' : `<span class="client-journey-rail client-journey-rail--before ${marcosDef[i - 1].done ? 'is-filled' : ''}"></span>`;
      const connRight = i === marcosDef.length - 1 ? '' : `<span class="client-journey-rail client-journey-rail--after ${m.done ? 'is-filled' : ''}"></span>`;
      cells += `
        <div class="client-journey-step ${stateClass}">
          ${connLeft}${connRight}
          <span class="client-journey-dot">${inner}</span>
          <span class="client-journey-label">${m.label}</span>
        </div>`;
    });

    return `
      <section class="client-timeline client-journey-card" aria-label="Progresso do cliente">
        <div class="client-journey-head">
          <div>
            <span class="client-section-eyebrow">Jornada do cliente</span>
            <span class="client-journey-subtitle">Acompanhamento das etapas essenciais da viagem</span>
          </div>
          <span class="client-journey-count"><strong>${feitos}</strong><span>de ${marcosDef.length}</span></span>
        </div>
        <div class="client-journey-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentual}">
          <span style="width:${percentual}%"></span>
        </div>
        <div class="client-journey-steps">${cells}</div>
      </section>`;
  } catch (e) { console.error('renderTimelineClienteHTML:', e); return ''; }
};

window.renderPreviewCliente = function(cliente, estadias = [], viajantes = [], emails = [], fotoPerfil = "", vouchers = [], marcos = {}, portalAtivo = true) {
  if (!Array.isArray(estadias)) estadias = [];
  if (!Array.isArray(viajantes)) viajantes = [];
  if (!Array.isArray(emails)) emails = [];
  if (!Array.isArray(vouchers)) vouchers = [];
  const container = document.getElementById('clientesPreviewContainer');
  if (!container) return;

  const coresStatus = window.obterCoresStatus(cliente.status);

  // Serializar coleções locais para a alternância rápida de abas
  const estadiasStr = encodeURIComponent(JSON.stringify(estadias));
  const viajantesStr = encodeURIComponent(JSON.stringify(viajantes));
  const emailsStr = encodeURIComponent(JSON.stringify(emails));

  // Calcular estágios dinâmicos do cliente
  const { etapaAtiva, etapas } = window.calcularEstagioCliente(cliente, estadias, viajantes, vouchers);
  window.currentClientProcessStages = etapas;

  // Renderizar o cabeçalho estático (Dynamics 365 Style)
  let avatarHTML = "";
  if (fotoPerfil) {
    avatarHTML = `<div class="client-avatar-container"><img src="${fotoPerfil}"></div>`;
  } else {
    avatarHTML = `<div class="client-avatar-container">${window.obterAvatarFallbackHTML(cliente.nome || "")}</div>`;
  }

  const portalControlHTML = portalAtivo !== false ? `
    <button class="client-portal-control is-active" onclick="window.alternarStatusPortalCliente('${cliente.id}', false)" title="Clique para desativar o link do cliente">
      <span class="client-portal-dot"></span>
      Portal ativo
    </button>
  ` : `
    <button class="client-portal-control is-inactive" onclick="window.alternarStatusPortalCliente('${cliente.id}', true)" title="Clique para reativar o link do cliente">
      <span class="client-portal-dot"></span>
      Portal desativado
    </button>
  `;

  container.innerHTML = `
    <section class="client-overview-shell">
    <div class="client-detail-header">
      <div class="client-profile-summary">
        ${avatarHTML}
        <div class="client-info-meta">
          <span class="client-section-eyebrow">Perfil do cliente</span>
          <h2>${cliente.nome || 'Cliente sem nome'}</h2>
          <div class="client-badges-row">
            <button class="client-status-badge" onclick="window.abrirSeletorStatusCliente('${cliente.id}', this)" title="Clique para mudar o status" style="color:${coresStatus.color}; background:${coresStatus.bg}; border-color:${coresStatus.border};">
              ${cliente.status || 'Início/call de dúvidas'}
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            ${portalControlHTML}
          </div>
        </div>
      </div>
      <div class="client-actions-section">
        <span class="client-actions-label">Ações rápidas</span>
        <div class="client-actions-bar">
        <button class="btn-secondary client-action-btn" data-mob-label="E-mail" onclick="window.location.href='mailto:${emails && emails[0] ? emails[0].email : (cliente.email || '')}'" title="Enviar E-mail" ${!(emails && emails[0] || cliente.email) ? 'disabled' : ''}>
          <svg class="v-icon"><use href="#icon-mail"></use></svg><span>E-mail</span>
        </button>
        <button class="btn-secondary client-action-btn" data-mob-label="WhatsApp" onclick="if('${cliente.telefone || ''}') window.open('https://wa.me/${(cliente.telefone || '').replace(/\D/g,'')}', '_blank');" title="WhatsApp" ${!cliente.telefone ? 'disabled' : ''}>
          <svg class="v-icon"><use href="#icon-message-square"></use></svg><span>WhatsApp</span>
        </button>
        <button class="btn-secondary client-action-btn" data-mob-label="Link" onclick="if(typeof copiarLinkClienteFromId === 'function') copiarLinkClienteFromId('${cliente.id}');" title="Copiar Link da Área do Cliente">
          <svg class="v-icon"><use href="#icon-link"></use></svg><span>Link do cliente</span>
        </button>
        <button class="btn-secondary client-action-btn" data-mob-label="Financeiro" onclick="navToPage('dashboard'); if(typeof selecionarClienteDashboard === 'function') selecionarClienteDashboard('${cliente.id}'); closeClienteModal();" title="Painel Financeiro do Cliente">
          <svg class="v-icon"><use href="#icon-dollar-sign"></use></svg><span>Financeiro</span>
        </button>
        <button class="btn-primary client-action-btn client-action-edit" data-mob-label="Editar" onclick="editarClienteCard('${cliente.id}')">
          <svg class="v-icon"><use href="#icon-edit"></use></svg><span>Editar cliente</span>
        </button>
        <button class="btn-secondary client-action-btn client-action-delete" data-mob-label="Excluir" onclick="window.excluirClienteFicha('${cliente.id}')" title="Excluir cliente (arquiva no Notion + lixeira, reversível)">
          <svg class="v-icon"><use href="#icon-trash"></use></svg><span>Excluir</span>
        </button>
        </div>
      </div>
    </div>

    ${window.renderTimelineClienteHTML(cliente, vouchers, marcos)}

    <!-- Barra de Navegação de Abas -->
    <div class="tabs-client-nav">
      <button class="tab-client-btn active" data-tab="resumo" onclick="window.switchClientTab('resumo', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')"><svg class="v-icon"><use href="#icon-file"></use></svg><span class="tab-label">Resumo de Pendências</span></button>
      <button class="tab-client-btn" data-tab="dados" onclick="window.switchClientTab('dados', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')"><svg class="v-icon"><use href="#icon-user"></use></svg><span class="tab-label">Dados do Cliente</span></button>
      <button class="tab-client-btn" data-tab="roteiros" onclick="window.switchClientTab('roteiros', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')"><svg class="v-icon"><use href="#icon-map"></use></svg><span class="tab-label">Roteiros</span></button>
      <button class="tab-client-btn" data-tab="cotacoes" onclick="window.switchClientTab('cotacoes', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')"><svg class="v-icon"><use href="#icon-dollar"></use></svg><span class="tab-label">Cotações</span></button>
      <button class="tab-client-btn" data-tab="vouchers" onclick="window.switchClientTab('vouchers', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')"><svg class="v-icon"><use href="#icon-ticket"></use></svg><span class="tab-label">Vouchers & Ingressos</span></button>
    </div>
    </section>

    <!-- Conteúdo da Aba Ativa -->
    <div id="clientTabContent" class="tab-client-content"></div>
  `;

  // Renderizar a primeira aba por padrão (Resumo de Pendências)
  window.switchClientTab('resumo', cliente.id, estadiasStr, viajantesStr, emailsStr);
};

window.renderAbaResumoCliente = async function(cliente, estadias = [], viajantes = []) {
  viajantes = normalizarViajantesArray(viajantes);
  const contentDiv = document.getElementById('clientTabContent');
  if (!contentDiv) return;

  contentDiv.innerHTML = `
    <div style="display:flex; justify-content:center; align-items:center; padding: 40px; gap: 8px;">
      <div class="spinner-mini" style="border: 2px solid rgba(107,31,42,0.1); border-top-color: var(--crimson); width: 16px; height: 16px; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <strong style="color:var(--crimson); font-size:13px; font-weight:500;">Carregando resumo de pendências...</strong>
    </div>
    <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
  `;

  let vouchers = [];
  try {
    const localData = await window.carregarClienteLocalLeve(cliente.id);
    vouchers = localData.vouchers || [];
    window.currentEditingVouchers = vouchers;
  } catch (e) {
    console.error("Erro ao carregar vouchers para resumo:", e);
  }

  // Se o usuário já trocou de aba enquanto os dados carregavam, não sobrescreve
  if (window.__activeClientTab && window.__activeClientTab !== 'resumo') return;

  const estadiasStr = encodeURIComponent(JSON.stringify(estadias));
  const viajantesStr = encodeURIComponent(JSON.stringify(viajantes));
  const emailsStr = encodeURIComponent(JSON.stringify(cliente.emails || []));

  // --- SEÇÃO 1: VIAJANTES E DADOS GERAIS ---
  const pendenciasDados = [];
  if (!cliente.email || cliente.email.trim() === '') {
    pendenciasDados.push({
      texto: "E-mail de contato principal não cadastrado.",
      tipo: "warning",
      labelAcao: "Preencher",
      onclick: `editarClienteCard('${cliente.id}')`
    });
  }
  if (!cliente.telefone || cliente.telefone.trim() === '') {
    pendenciasDados.push({
      texto: "Telefone de contato principal não cadastrado.",
      tipo: "warning",
      labelAcao: "Preencher",
      onclick: `editarClienteCard('${cliente.id}')`
    });
  }

  const statusCli = (cliente.status || '').toLowerCase().trim();
  const isCotacao = statusCli === 'cotação' || statusCli === 'cotacao' || statusCli === 'leads' || statusCli === 'novo' || statusCli === '';
  if (isCotacao) {
    pendenciasDados.push({
      texto: `Orçamento pendente de aprovação (Status: ${cliente.status || 'Novo'}).`,
      tipo: "warning",
      labelAcao: "Alterar",
      onclick: `editarClienteCard('${cliente.id}')`
    });
  }

  if (!viajantes || viajantes.length === 0) {
    pendenciasDados.push({
      texto: "Nenhum viajante cadastrado para esta viagem.",
      tipo: "error",
      labelAcao: "Adicionar",
      onclick: `window.switchClientTab('dados', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
    });
  }

  // --- SEÇÃO 2: HOSPEDAGEM (ESTADIAS) ---
  const pendenciasHospedagem = [];
  if (!cliente.dataInicio || !cliente.dataFim) {
    pendenciasHospedagem.push({
      texto: "Definir as datas de início e fim da viagem no cadastro do cliente.",
      tipo: "error",
      labelAcao: "Definir Datas",
      onclick: `editarClienteCard('${cliente.id}')`
    });
  } else {
    // Cobertura REAL por calendário (não soma de noites): conta noites DISTINTAS
    // dentro da janela da viagem. Assim buraco, sobreposição e datas fora da viagem
    // não geram falso "100% coberto".
    const _toISO = (d) => {
      if (!d) return '';
      d = String(d);
      if (d.includes('/')) { const p = d.split('/'); if (p.length === 3) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`; }
      return d.slice(0, 10);
    };
    const _utc = (iso) => { const p = String(iso).split('-'); return Date.UTC(+p[0], (+p[1] || 1) - 1, +p[2] || 1); };
    const DIA = 86400000;
    const tStart = _utc(_toISO(cliente.dataInicio));
    const tEnd = _utc(_toISO(cliente.dataFim));
    const noitesViagem = Math.round((tEnd - tStart) / DIA);

    const noitesSet = new Set();
    let temEstadiaSemHotel = false;
    let temEstadiaSemCidade = false;
    let temEstadiaSemData = false;

    estadias.forEach(est => {
      if (!est.hotel || est.hotel.trim() === '') {
        temEstadiaSemHotel = true;
      }
      if (!est.cidade || est.cidade.trim() === '') {
        temEstadiaSemCidade = true;
      }
      if (est.dataInicio && est.dataFim) {
        const a = _utc(_toISO(est.dataInicio));
        const b = _utc(_toISO(est.dataFim));
        if (!isNaN(a) && !isNaN(b) && b > a) {
          for (let t = a; t < b; t += DIA) {
            if (t >= tStart && t < tEnd) noitesSet.add(t); // conta só noites dentro da viagem
          }
        } else {
          temEstadiaSemData = true;
        }
      } else {
        temEstadiaSemData = true;
      }
    });

    const noitesCobertas = noitesSet.size;

    if (temEstadiaSemHotel) {
      pendenciasHospedagem.push({
        texto: "Existem estadias adicionadas sem nome de hotel definido.",
        tipo: "error",
        labelAcao: "Gerenciar",
        onclick: `window.switchClientTab('dados', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
      });
    }
    if (temEstadiaSemCidade) {
      pendenciasHospedagem.push({
        texto: "Existem estadias cadastradas sem cidade definida.",
        tipo: "error",
        labelAcao: "Gerenciar",
        onclick: `window.switchClientTab('dados', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
      });
    }
    if (temEstadiaSemData) {
      pendenciasHospedagem.push({
        texto: "Uma ou mais estadias cadastradas estão sem data definida.",
        tipo: "error",
        labelAcao: "Gerenciar",
        onclick: `window.switchClientTab('dados', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
      });
    }

    if (noitesCobertas < noitesViagem) {
      const noitesFaltantes = noitesViagem - noitesCobertas;
      pendenciasHospedagem.push({
        texto: `Faltam cobrir ${noitesFaltantes} noite(s) de hotel (Cobertura: ${noitesCobertas} de ${noitesViagem} noites).`,
        tipo: "error",
        labelAcao: "Adicionar Hotel",
        onclick: `window.switchClientTab('dados', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
      });
    }
  }

  // --- SEÇÃO 3: ROTEIRO & EMISSÕES ---
  const pendenciasEmissoes = [];
  const clienteNome = cliente.nome || '';
  const roteiro = typeof window.dbRotas !== 'undefined' ? Object.values(window.dbRotas).find(rot => {
    return rot.notionClienteId === cliente.id || (rot.cliente && rot.cliente.nome === clienteNome);
  }) : null;

  if (!roteiro) {
    pendenciasEmissoes.push({
      texto: "Roteiro do cliente ainda não foi criado no montador.",
      tipo: "error",
      labelAcao: "Criar Roteiro",
      onclick: `window.switchClientTab('roteiros', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
    });
  } else if (roteiro.dias) {
    roteiro.dias.forEach((dia, dIdx) => {
      const diaLabel = `Dia ${dIdx + 1} (${dia.cidade || ''})`;
      if (dia.elementos) {
        dia.elementos.forEach(el => {
          if (el.tipo === 'transporte') {
            const t = el.transportInfo || {};
            // tipoTransporte e campos ficam direto em el.*
            const transpNome = el.tipoTransporte || t.tipoTransporte || el.tipoServico || 'Transporte';
            const origem = el.cidadeOrigem || t.origem || '';
            const destino = el.cidadeDestino || t.destino || '';
            const trechoValido = origem && destino && origem.toLowerCase() !== destino.toLowerCase();
            const desc = `${transpNome}${trechoValido ? ` (${origem} ➔ ${destino})` : (origem ? ` (${origem})` : '')}`;
            const hora = el.horario || t.horario || el.horaEncontro;

            // 1. Shinkansen/trem sem horário
            const isTrem = transpNome.toLowerCase().includes('shinkansen') || transpNome.toLowerCase().includes('trem');
            if (isTrem && (!hora || hora === 'Definir' || hora.trim() === '')) {
              pendenciasEmissoes.push({
                texto: `Shinkansen/Trem sem horário definido: ${desc} (${diaLabel}).`,
                tipo: "error",
                labelAcao: "Ver Roteiro",
                onclick: `window.switchClientTab('roteiros', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
              });
            }

            // 2. Comprado Heian sem voucher
            const compradoPelaHeian = el.compradoHeian !== false && t.compradoHeian !== false;
            if (compradoPelaHeian) {
              const trechoSlug = origem && destino ? `|${origem}>${destino}` : '';
              const transpKey = `transporte:${transpNome}${trechoSlug}:d${dIdx}`;
              const temVoucher = el.refId ? vouchers.some(vx => vx.atracaoNome === 'ref:' + el.refId)
                : (vouchers.some(vx => vx.atracaoNome === transpKey) || vouchers.some(vx => vx.atracaoNome === `transporte:${transpNome}`));
              if (!temVoucher) {
                pendenciasEmissoes.push({
                  texto: `Falta bilhete/voucher de ${transpNome}${trechoValido ? `: ${origem} ➔ ${destino}` : ''} (${diaLabel}).`,
                  tipo: "error",
                  labelAcao: "Anexar",
                  onclick: `window.switchClientTab('vouchers', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
                });
              }
            }
          } else if (el.tipo === 'experiencia') {
            const e = el.expInfo || {};
            // nomeExp e campos ficam direto em el.*
            const nomeExp = el.nomeExp || e.nomeExp || el.titulo || 'Experiência';
            // Ignorar itens sem nome real (evita "Experiência (Dia X ())")
            if (!nomeExp || nomeExp === 'Experiência') return;
            const hora = el.horaPartida || e.horaPartida || el.horaEncontro || e.horaEncontro;

            // 1. Experiência sem horário (apenas se realmente não tiver)
            if (!hora || hora === 'Definir' || hora.trim() === '') {
              pendenciasEmissoes.push({
                texto: `Horário não definido: ${nomeExp} (${diaLabel}).`,
                tipo: "warning",
                labelAcao: "Ver Roteiro",
                onclick: `window.switchClientTab('roteiros', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
              });
            }

            // 2. Comprado Heian sem voucher
            const compradoPelaHeian = el.compradoHeian !== false && e.compradoHeian !== false;
            if (compradoPelaHeian) {
              const expKey = `experiencia:${nomeExp}:d${dIdx}`;
              const temVoucher = el.refId ? vouchers.some(vx => vx.atracaoNome === 'ref:' + el.refId)
                : (vouchers.some(vx => vx.atracaoNome === expKey) || vouchers.some(vx => vx.atracaoNome === `experiencia:${nomeExp}`));
              if (!temVoucher) {
                pendenciasEmissoes.push({
                  texto: `Falta ingresso/voucher: ${nomeExp} (${diaLabel}).`,
                  tipo: "error",
                  labelAcao: "Anexar",
                  onclick: `window.switchClientTab('vouchers', '${cliente.id}', '${estadiasStr}', '${viajantesStr}', '${emailsStr}')`
                });
              }
            }
          }
        });
      }
    });
  }

  // --- RENDERIZAÇÃO DO GRID ---
  let html = `<div class="pendencias-grid">`;

  // 1. Coluna Viajantes & Dados
  html += `
    <div class="pendencias-block">
      <div class="pendencias-block-title" style="display:inline-flex; align-items:center; gap:6px;"><svg class="v-icon" style="stroke:var(--gold-dk); width:1.15em; height:1.15em; margin-right:0;"><use href="#icon-users"></use></svg> Viajantes & Dados Gerais</div>
      <div class="pendencias-list">
  `;
  if (pendenciasDados.length === 0) {
    html += `
      <div class="pendencia-empty-state">
        <span style="color:#2ecc71; font-weight:bold; margin-right:4px;">✓</span> Viajantes e dados 100% preenchidos!
      </div>
    `;
  } else {
    pendenciasDados.forEach(p => {
      html += `
        <div class="pendencia-item-row">
          <span class="pendencia-item-badge ${p.tipo}">${p.tipo === 'error' ? 'Pendente' : 'Aviso'}</span>
          <span style="flex:1;">${p.texto}</span>
          <button class="pendencia-btn-action" onclick="${p.onclick}">${p.labelAcao}</button>
        </div>
      `;
    });
  }
  html += `</div></div>`;

  // 2. Coluna Hospedagem
  html += `
    <div class="pendencias-block">
      <div class="pendencias-block-title" style="display:inline-flex; align-items:center; gap:6px;"><svg class="v-icon" style="stroke:var(--gold-dk); width:1.15em; height:1.15em; margin-right:0;"><use href="#icon-home"></use></svg> Hospedagem (Estadias)</div>
      <div class="pendencias-list">
  `;
  if (pendenciasHospedagem.length === 0) {
    html += `
      <div class="pendencia-empty-state">
        <span style="color:#2ecc71; font-weight:bold; margin-right:4px;">✓</span> Hotéis e estadias 100% cobertos!
      </div>
    `;
  } else {
    pendenciasHospedagem.forEach(p => {
      html += `
        <div class="pendencia-item-row">
          <span class="pendencia-item-badge ${p.tipo}">${p.tipo === 'error' ? 'Pendente' : 'Aviso'}</span>
          <span style="flex:1;">${p.texto}</span>
          <button class="pendencia-btn-action" onclick="${p.onclick}">${p.labelAcao}</button>
        </div>
      `;
    });
  }
  html += `</div></div>`;

  // 3. Coluna Roteiro & Emissões
  html += `
    <div class="pendencias-block">
      <div class="pendencias-block-title" style="display:inline-flex; align-items:center; gap:6px;"><svg class="v-icon" style="stroke:var(--gold-dk); width:1.15em; height:1.15em; margin-right:0;"><use href="#icon-map"></use></svg> Roteiro & Emissões (Heian)</div>
      <div class="pendencias-list">
  `;
  if (pendenciasEmissoes.length === 0) {
    html += `
      <div class="pendencia-empty-state">
        <span style="color:#2ecc71; font-weight:bold; margin-right:4px;">✓</span> Roteiro e emissões concluídos com sucesso!
      </div>
    `;
  } else {
    pendenciasEmissoes.forEach(p => {
      html += `
        <div class="pendencia-item-row">
          <span class="pendencia-item-badge ${p.tipo}">${p.tipo === 'error' ? 'Pendente' : 'Aviso'}</span>
          <span style="flex:1;">${p.texto}</span>
          <button class="pendencia-btn-action" onclick="${p.onclick}">${p.labelAcao}</button>
        </div>
      `;
    });
  }
  html += `</div></div>`;

  html += `</div>`;
  contentDiv.innerHTML = html;
};

window.switchClientTab = async function(tabName, clienteId, estadiasJson, viajantesJson, emailsJson) {
  // Guarda a aba ativa: renderizações assíncronas conferem antes de escrever,
  // para não sobrescrever o conteúdo de outra aba (corrida de carregamento).
  window.__activeClientTab = tabName;
  const nav = document.querySelector('.tabs-client-nav');
  if (nav) {
    nav.querySelectorAll('.tab-client-btn').forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  const cliente = typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === clienteId) : null;
  if (!cliente) return;

  const estadias = JSON.parse(decodeURIComponent(estadiasJson));
  let viajantes = [];
  try {
    viajantes = normalizarViajantesArray(JSON.parse(decodeURIComponent(viajantesJson)));
  } catch(e) {
    viajantes = normalizarViajantesArray(decodeURIComponent(viajantesJson));
  }
  const emails = JSON.parse(decodeURIComponent(emailsJson));

  // Pré-carrega vouchers em background para garantir dados atualizados nas abas
  try {
    window.currentEditingVouchers = (await window.carregarClienteLocalLeve(clienteId)).vouchers || [];
  } catch (e) {
    console.error("Erro ao pré-carregar vouchers:", e);
  }

  if (tabName === 'resumo') {
    window.renderAbaResumoCliente(cliente, estadias, viajantes);
  } else if (tabName === 'dados') {
    renderAbaDadosCliente(cliente, estadias, viajantes, emails);
  } else if (tabName === 'roteiros') {
    renderAbaRoteiros(cliente);
  } else if (tabName === 'cotacoes') {
    renderAbaCotacoes(cliente);
  } else if (tabName === 'vouchers') {
    window.renderAbaVouchersCliente(cliente, viajantes);
  }
};

window.renderAbaVouchersCliente = async function(cliente, viajantes = []) {
  const contentDiv = document.getElementById('clientTabContent');
  if (!contentDiv) return;

  contentDiv.innerHTML = `<div style="text-align:center; padding: 20px;"><strong style="color:var(--crimson)">Carregando Vouchers...</strong></div>`;

  try {
    const localData = await window.carregarClienteLocalLeve(cliente.id);
    const vouchers = localData.vouchers || [];
    
    window.currentEditingVouchers = vouchers;

    const templatesRes = await fetch('/api/templates-vouchers');
    const templates = await templatesRes.json();

    const clienteNome = cliente.nome || '';
    const roteiroVinculado = typeof dbRotas !== 'undefined' ? Object.values(dbRotas).find(rot => {
      return rot.notionClienteId === cliente.id || (rot.cliente && rot.cliente.nome === clienteNome);
    }) : null;

    let itensRoteiro = [];
    let emissoesHeian = [];
    // Normaliza data (BR/ISO) p/ o plano B de casamento de voucher quando o refId desalinha
    const _normDia = (d) => { if (!d) return ''; d = String(d); if (d.includes('/')) { const p = d.split('/'); if (p.length === 3) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`; } return d.slice(0, 10); };
    // refIds que existem no roteiro — o plano B nunca adota voucher que já pertence a outro serviço
    const _refKeys = new Set();
    if (roteiroVinculado && roteiroVinculado.dias) {
      roteiroVinculado.dias.forEach(_d => (_d.elementos || []).forEach(_e => { if (_e.refId) _refKeys.add('ref:' + _e.refId); }));
    }

    if (roteiroVinculado && roteiroVinculado.dias) {
      roteiroVinculado.dias.forEach((dia, dIdx) => {
        const diaLabel = `Dia ${dIdx + 1} (${dia.cidade || ''})`;
        itensRoteiro.push({ val: `dia:${dIdx + 1}`, label: diaLabel });

        let dataDoDiaStr = '';
        if (cliente.dataInicio) {
          try {
            const dt = new Date(cliente.dataInicio + 'T00:00:00');
            if (!isNaN(dt.getTime())) {
              dt.setDate(dt.getDate() + dIdx);
              const y = dt.getFullYear();
              const m = String(dt.getMonth() + 1).padStart(2, '0');
              const d = String(dt.getDate()).padStart(2, '0');
              dataDoDiaStr = `${y}-${m}-${d}`;
            }
          } catch(err) {
            console.error("Erro ao calcular data do dia na aba vouchers:", err);
          }
        }

        if (dia.elementos) {
          dia.elementos.forEach(el => {
            if (el.tipo === 'sequencia' && el.atracoesDoDia) {
              el.atracoesDoDia.forEach(atr => {
                itensRoteiro.push({ val: `atracao:${atr}`, label: `Atração: ${atr} (${diaLabel})` });
              });
            } else if (el.tipo === 'experiencia') {
              const e = el.expInfo || {};
              // nomeExp vive direto em el.nomeExp — expInfo é apenas fallback
              const nomeExp = el.nomeExp || e.nomeExp || el.titulo || 'Experiência';
              itensRoteiro.push({ val: `experiencia:${nomeExp}`, label: `Exp: ${nomeExp} (${diaLabel})` });

              const compradoPelaHeian = el.compradoHeian !== false && e.compradoHeian !== false;
              if (compradoPelaHeian) {
                // Chave única: tipo + nome + dia — evita falso match entre itens iguais em dias diferentes
                // Chave por refId (único). Fallback p/ chave antiga só se o elemento não tiver refId.
                const expKey = el.refId ? ('ref:' + el.refId) : `experiencia:${nomeExp}:d${dIdx}`;
                let v = vouchers.find(x => x.atracaoNome === expKey);
                if (!v && el.refId) {
                  const _d = _normDia(el.dataDoTour || dataDoDiaStr);
                  const _n = (nomeExp || '').toLowerCase();
                  if (_d && _n) v = vouchers.find(x => x.dataUso && _normDia(x.dataUso) === _d && ((x.nome || '') + ' ' + (x.atracaoNome || '')).toLowerCase().includes(_n) && !_refKeys.has(x.atracaoNome));
                }
                const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : '');
                emissoesHeian.push({
                  tipo: 'experiencia',
                  tipoLabel: 'Experiência',
                  tituloItem: nomeExp,
                  desc: nomeExp,
                  diaLabel: diaLabel,
                  key: expKey,
                  voucher: v,
                  dataSugerida: el.dataDoTour || e.dataDoTour || dataDoDiaStr || '',
                  horario: el.horaPartida || e.horaPartida || '',
                  local: el.localEncontro || e.localEncontro || '',
                  pessoasText: pText,
                  instrucoesPreCompra: el.instrucoesPreCompra || ''
                });
              }
            } else if (el.tipo === 'transporte') {
              const t = el.transportInfo || {};
              // tipoTransporte vive direto em el.tipoTransporte
              const transpNome = el.tipoTransporte || t.tipoTransporte || el.tipoServico || 'Transporte';
              const origem = el.cidadeOrigem || t.origem || '';
              const destino = el.cidadeDestino || t.destino || '';
              const desc = `${transpNome}${origem && destino ? ` (${origem} ➔ ${destino})` : ''}`;
              itensRoteiro.push({ val: `transporte:${transpNome}`, label: `Transp: ${desc} (${diaLabel})` });

              const compradoPelaHeian = el.compradoHeian !== false && t.compradoHeian !== false;
              if (compradoPelaHeian) {
                // Chave única: tipo + nome + trecho + dia — cada trecho em cada dia é independente
                const trechoSlug = origem && destino ? `|${origem}>${destino}` : '';
                // Chave por refId (único). Fallback p/ chave antiga só se o elemento não tiver refId.
                const transpKey = el.refId ? ('ref:' + el.refId) : `transporte:${transpNome}${trechoSlug}:d${dIdx}`;
                let v = vouchers.find(x => x.atracaoNome === transpKey);
                if (!v && el.refId) {
                  const _d = _normDia(el.dataDoTour || dataDoDiaStr);
                  const _n = (transpNome || '').toLowerCase();
                  if (_d && _n) v = vouchers.find(x => x.dataUso && _normDia(x.dataUso) === _d && ((x.nome || '') + ' ' + (x.atracaoNome || '')).toLowerCase().includes(_n) && !_refKeys.has(x.atracaoNome));
                }
                const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : '');
                emissoesHeian.push({
                  tipo: 'transporte',
                  tipoLabel: transpNome,
                  tituloItem: transpNome,
                  desc: desc,
                  origemDestino: `${origem || 'A definir'} ➔ ${destino || 'A definir'}`,
                  diaLabel: diaLabel,
                  key: transpKey,
                  voucher: v,
                  dataSugerida: el.data || dataDoDiaStr || '',
                  linha: el.linha || t.linha || '',
                  categoria: el.categoria || t.categoria || '',
                  horario: el.horario || t.horario || '',
                  duracao: el.tempo || t.tempo || '',
                  pessoasText: pText,
                  instrucoesPreCompra: el.instrucoesPreCompra || ''
                });
              }
            }
          });
        }
      });
    }

    // --- RENDERIZAR TABELA DE EMISSÕES HEIAN ---
    let emissoesHTML = '';
    if (emissoesHeian.length === 0) {
      emissoesHTML = `<p style="color:var(--ink-lt); font-size:13px; font-style:italic; padding:10px 0;">Não há nenhum item marcado para emissão pela Heian neste roteiro.</p>`;
    } else {
      emissoesHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(310px, 1fr)); gap: 16px; margin-top: 8px;">
          ${emissoesHeian.map(eh => {
            let statusBadge = '';
            let acaoHTML = '';
            let cardBorderColor = '#e5e7eb';
            let cardBg = '#fff';
            let cardBorderLeft = '#C4A35A';

            if (eh.voucher) {
              cardBorderColor = '#10b981';
              cardBg = '#f6fdf9';
              cardBorderLeft = '#10b981';
              statusBadge = `<span style="background:#d1fae5; color:#065f46; padding:3px 8px; font-size:10px; font-weight:700; text-transform:uppercase; border-radius:4px; letter-spacing:0.04em;">✔ Emitido</span>`;

              let linkHTML = '';
              if (eh.voucher.arquivos && eh.voucher.arquivos.length > 0) {
                linkHTML = eh.voucher.arquivos.map((arq, idx) => {
                  return `<a href="${arq.url}" target="_blank" style="color:var(--gold-dk); font-weight:600; font-size:11.5px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border:1px solid var(--gold-lt); border-radius:4px; background:#fff; margin-right:6px;"><svg class="v-icon" style="stroke:var(--gold-dk); width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-file"></use></svg> Doc ${idx+1}</a>`;
                }).join('');
              } else if (eh.voucher.url) {
                linkHTML = `<a href="${eh.voucher.url}" target="_blank" style="color:var(--gold-dk); font-weight:600; font-size:11.5px; text-decoration:none; display:inline-flex; align-items:center; gap:4px; padding:2px 6px; border:1px solid var(--gold-lt); border-radius:4px; background:#fff;"><svg class="v-icon" style="stroke:var(--gold-dk); width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-link"></use></svg> Abrir Link</a>`;
              } else {
                linkHTML = `<span style="color:var(--ink-lt); font-size:11.5px; font-style:italic; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="stroke:var(--ink-lt); width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-file-text"></use></svg> Instrução escrita</span>`;
              }

              const editAction = `window.uploadRapidoVoucherAdmin('${cliente.id}', '${eh.voucher.atracaoNome.replace(/'/g, "\\'")}', '${eh.voucher.nome.replace(/'/g, "\\'")}', '${eh.voucher.dataUso || ''}', '${eh.voucher.id}')`;
              acaoHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #d1fae5; padding-top:10px; margin-top:10px; gap:8px;">
                  <div style="flex:1; display:flex; flex-wrap:wrap; gap:4px;">${linkHTML}</div>
                  <button onclick="${editAction}" style="padding:4px 10px; font-size:11px; cursor:pointer; background:#fff; border:1px solid #a7f3d0; border-radius:4px; color:#065f46; font-weight:600; white-space:nowrap; flex-shrink:0; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon no-margin" style="stroke:#065f46; width:1.1em; height:1.1em;"><use href="#icon-edit"></use></svg> Alterar</button>
                </div>
              `;
            } else {
              cardBorderColor = '#fca5a5';
              cardBorderLeft = '#ef4444';
              statusBadge = `<span style="background:#fee2e2; color:#991b1b; padding:3px 8px; font-size:10px; font-weight:700; text-transform:uppercase; border-radius:4px; letter-spacing:0.04em;">Pendente</span>`;

              const suggestionsName = eh.tipo === 'transporte' ? `Bilhete - ${eh.tituloItem || eh.desc}` : `Ingresso - ${eh.tituloItem || eh.desc}`;
              const actionClick = `window.uploadRapidoVoucherAdmin('${cliente.id}', '${eh.key.replace(/'/g, "\\'")}', '${suggestionsName.replace(/'/g, "\\'")}', '${eh.dataSugerida}')`;

              acaoHTML = `
                <div style="border-top:1px solid #fee2e2; padding-top:10px; margin-top:10px;">
                  <button onclick="${actionClick}" style="padding:7px 0; font-size:12px; border-radius:6px; font-weight:600; cursor:pointer; background:var(--crimson); border:none; color:white; width:100%; display:flex; align-items:center; justify-content:center; gap:6px;">
                    <svg class="v-icon no-margin" style="stroke:white; width:1.1em; height:1.1em;"><use href="#icon-plus"></use></svg> Anexar Bilhete / Ingresso
                  </button>
                </div>
              `;
            }

            // Detalhes extras por tipo
            let detalhesPrincipais = '';
            if (eh.tipo === 'transporte') {
              // Sanitização: só mostrar trecho se origem ≠ destino
              const [trechoOrigem, trechoDestino] = (eh.origemDestino || '').split(' ➔ ').map(s => s.trim());
              const trechoValido = trechoOrigem && trechoDestino && trechoOrigem.toLowerCase() !== trechoDestino.toLowerCase();
              // Sanitização: ignorar categoria se for puramente numérica (ex: preço "40000")
              const categoriaValida = eh.categoria && !/^\d+$/.test(String(eh.categoria).trim()) && eh.categoria !== '-';
              detalhesPrincipais = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px;">
                  ${trechoValido ? `<div style="grid-column:span 2; background:#f0f4f9; border-radius:6px; padding:8px 10px;">
                    <div style="font-size:10px; font-weight:600; color:var(--ink-lt); text-transform:uppercase; margin-bottom:3px;">Trecho</div>
                    <div style="font-size:14px; color:var(--ink-dk); font-weight:700;">${eh.origemDestino}</div>
                  </div>` : ''}
                  ${eh.linha ? `<div style="background:#f9f9f9; border-radius:6px; padding:8px 10px;">
                    <div style="font-size:10px; font-weight:600; color:var(--ink-lt); text-transform:uppercase; margin-bottom:3px;">Trem / Voo / Linha</div>
                    <div style="font-size:13px; color:var(--ink-dk); font-weight:700;">${eh.linha}</div>
                  </div>` : ''}
                  ${categoriaValida ? `<div style="background:#f5f0ff; border:1px solid #ede9fe; border-radius:6px; padding:8px 10px;">
                    <div style="font-size:10px; font-weight:600; color:#6d28d9; text-transform:uppercase; margin-bottom:3px;">Classe / Tipo</div>
                    <div style="font-size:13px; color:#4c1d95; font-weight:700;">${eh.categoria}</div>
                  </div>` : ''}
                  ${eh.horario ? `<div style="background:#fff8e6; border:1px solid #fef3c7; border-radius:6px; padding:8px 10px;">
                    <div style="font-size:10px; font-weight:600; color:#b45309; text-transform:uppercase; margin-bottom:3px;">Horário de Partida</div>
                    <div style="font-size:22px; color:#92400e; font-weight:800; line-height:1;">${eh.horario}</div>
                  </div>` : ''}
                  ${eh.duracao ? `<div style="background:#f9f9f9; border-radius:6px; padding:8px 10px;">
                    <div style="font-size:10px; font-weight:600; color:var(--ink-lt); text-transform:uppercase; margin-bottom:3px;">Duração</div>
                    <div style="font-size:13px; color:var(--ink-dk); font-weight:600;">${eh.duracao}</div>
                  </div>` : ''}
                </div>
              `;
            } else {
              detalhesPrincipais = `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px;">
                  ${eh.horario ? `<div style="background:#fff8e6; border:1px solid #fef3c7; border-radius:6px; padding:8px 10px;">
                    <div style="font-size:10px; font-weight:600; color:#b45309; text-transform:uppercase; margin-bottom:2px;">Horário</div>
                    <div style="font-size:16px; color:#000; font-weight:800;">${eh.horario}</div>
                  </div>` : ''}
                  ${eh.local ? `<div style="background:#f9f9f9; border-radius:6px; padding:8px 10px; grid-column:${eh.horario ? '1' : 'span 2'};">
                    <div style="font-size:10px; font-weight:600; color:var(--ink-lt); text-transform:uppercase; margin-bottom:2px;">Local de Encontro</div>
                    <div style="font-size:12px; color:var(--ink-dk); font-weight:600;">${eh.local}</div>
                  </div>` : ''}
                </div>
              `;
            }

            // Passageiros
            const nomesViajantes = viajantes.length > 0 ? viajantes.map(v => v.nomeCompleto || v.nome || '').filter(Boolean).join(', ') : '';
            const passageirosLabel = eh.pessoasText || (nomesViajantes ? `${viajantes.length} passageiro(s)` : '');
            const passageirosDetalhe = nomesViajantes ? `<div style="font-size:11px; color:var(--ink-lt); margin-top:2px;">${nomesViajantes}</div>` : '';

            // Nota de compra
            let notaCompra = '';
            if (eh.instrucoesPreCompra) {
              notaCompra = `
                <div style="background:#fffbeb; border-left:3px solid #f59e0b; padding:8px 10px; border-radius:0 6px 6px 0; margin-top:10px;">
                  <div style="font-size:10px; font-weight:700; color:#92400e; text-transform:uppercase; margin-bottom:3px;">Nota de Compra</div>
                  <div style="font-size:12px; color:#78350f;">${eh.instrucoesPreCompra}</div>
                </div>
              `;
            }

            return `
              <div style="border: 1px solid ${cardBorderColor}; border-left: 4px solid ${cardBorderLeft}; border-radius: 10px; padding: 14px; background: ${cardBg}; display: flex; flex-direction: column; box-shadow: 0 1px 4px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:8px;">
                  <div style="flex:1;">
                    <div style="font-size:16px; font-weight:800; color:var(--ink-dk); letter-spacing:-0.02em;">${eh.dataSugerida ? fmtDataBR(eh.dataSugerida) : 'Sem data definida'}</div>
                    <div style="font-size:11.5px; color:var(--ink-lt); font-weight:500; margin-top:1px;">${eh.diaLabel}</div>
                  </div>
                  ${statusBadge}
                </div>

                <div style="font-size:11px; color:${eh.tipo === 'transporte' ? '#9c8248' : 'var(--crimson)'}; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px;">${eh.tipoLabel}</div>
                <div style="font-size:15px; font-weight:700; color:var(--ink-dk); line-height:1.3;">${(eh.tituloItem && eh.tituloItem !== 'Transporte') ? eh.tituloItem : (eh.desc && eh.desc !== 'Transporte' ? eh.desc : 'Transfer')}</div>

                ${detalhesPrincipais}

                ${passageirosLabel ? `<div style="margin-top:10px; background:#f0f4ff; border-radius:6px; padding:8px 10px;">
                  <div style="font-size:10px; font-weight:600; color:#3730a3; text-transform:uppercase; margin-bottom:2px;">Passageiros</div>
                  <div style="font-size:12.5px; color:#1e1b4b; font-weight:600;">${passageirosLabel}</div>
                  ${passageirosDetalhe}
                </div>` : ''}

                ${notaCompra}
                ${acaoHTML}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // --- RENDERIZAR TABELA DE VOUCHERS GERAIS ---
    let vouchersHTML = '';
    if (vouchers.length === 0) {
      vouchersHTML = `<p style="text-align:center; color:var(--ink-lt); padding: 20px; font-size:13.5px;">Nenhum voucher cadastrado para este cliente.</p>`;
    } else {
      vouchersHTML = `
        <div style="overflow-x:auto;">
          <table class="data-table" style="width:100%;">
            <thead>
              <tr>
                <th>Nome / Item</th>
                <th>Tipo</th>
                <th>Associação</th>
                <th>Data</th>
                <th style="width: 80px; text-align:center;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${vouchers.map(v => {
                let badgeColor = '#6b7280';
                if (v.tipo === 'qr_code') badgeColor = '#10b981';
                else if (v.tipo === 'pdf') badgeColor = '#ef4444';
                else if (v.tipo === 'link') badgeColor = '#3b82f6';
                else if (v.tipo === 'instrucao') badgeColor = '#f59e0b';

                let assocLabel = 'Nenhuma';
                if (v.atracaoNome) {
                  if (v.atracaoNome.startsWith('dia:')) assocLabel = `Dia ${v.atracaoNome.split(':')[1]}`;
                  else if (v.atracaoNome.startsWith('atracao:')) assocLabel = v.atracaoNome.split(':')[1];
                  else if (v.atracaoNome.startsWith('experiencia:')) assocLabel = v.atracaoNome.split(':')[1];
                  else if (v.atracaoNome.startsWith('transporte:')) assocLabel = v.atracaoNome.split(':')[1];
                  else assocLabel = v.atracaoNome;
                }

                let filesCount = 1;
                if (v.arquivos && Array.isArray(v.arquivos)) {
                  filesCount = v.arquivos.length;
                } else if (v.url) {
                  filesCount = 1;
                } else {
                  filesCount = 0;
                }
                const filesLabel = filesCount > 1 ? `<span style="font-size:10.5px; padding: 2px 5px; background: #eee; border-radius: 4px; color: #555; margin-left: 6px; font-weight: normal;">${filesCount} arquivos</span>` : '';

                return `
                  <tr>
                    <td>
                      <strong>${v.nome}</strong> ${filesLabel}
                      ${v.instrucao ? `<div style="font-size:11px; color:var(--ink-lt); margin-top:2px; white-space:pre-line;">${v.instrucao.substring(0, 100)}${v.instrucao.length > 100 ? '...' : ''}</div>` : ''}
                    </td>
                    <td><span class="meta-badge" style="background:${badgeColor}22; color:${badgeColor}; border:none; padding:2px 8px; font-size:11px; font-weight:600;">${v.tipo.toUpperCase()}</span></td>
                    <td style="font-size:12.5px;">${assocLabel}</td>
                    <td style="font-size:12.5px;">${v.dataUso ? fmtDataBR(v.dataUso) : '—'}</td>
                    <td style="text-align:center;">
                      <div style="display:inline-flex; gap:6px; justify-content:center; align-items:center;">
                        <button class="btn-secondary" onclick="window.uploadRapidoVoucherAdmin('${cliente.id}', '${v.atracaoNome || ''}', '${v.nome.replace(/'/g, "\\'")}', '${v.dataUso || ''}', '${v.id}')" style="padding:4px 8px; font-size:11px; color:#3b82f6; border-color:#eff6ff; cursor:pointer;" title="Editar"><svg class="v-icon no-margin"><use href="#icon-edit"></use></svg></button>
                        <button class="btn-secondary" onclick="window.excluirVoucherCliente('${cliente.id}', '${v.id}')" style="padding:4px 8px; font-size:11px; color:#c00; border-color:#fee; cursor:pointer;" title="Excluir"><svg class="v-icon no-margin" style="stroke:#c00;"><use href="#icon-trash"></use></svg></button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Se o usuário já trocou de aba enquanto os vouchers carregavam, não sobrescreve
    if (window.__activeClientTab && window.__activeClientTab !== 'vouchers') return;

    contentDiv.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:20px;">
        
        <!-- Controle de Emissões Heian (Roteiro) -->
        <div class="info-card" style="padding:16px; border: 1px solid rgba(196,163,90,0.22); background: linear-gradient(to bottom, #fdfaf5, #ffffff);">
          <h3 class="info-card-title" style="margin-bottom:12px; font-size:14px; font-weight:600; color:var(--crimson); display:flex; justify-content:space-between; align-items:center;">
            <span>Controle de Emissões Heian (Roteiro)</span>
            <span style="font-size:11px; color:var(--ink-lt); font-weight:normal;">Mapeado dinamicamente do roteiro</span>
          </h3>
          ${emissoesHTML}
        </div>

        <!-- Lista de Vouchers -->
        <div class="info-card" style="padding:16px;">
          <h3 class="info-card-title" style="margin-bottom:12px; font-size:14px; font-weight:600; display:flex; justify-content:space-between; align-items:center;">
            <span>Todos os Ingressos e Vouchers Enviados</span>
            <span style="font-size:11px; color:var(--ink-lt); font-weight:normal;">${vouchers.length} item(ns)</span>
          </h3>
          ${vouchersHTML}
        </div>

        <!-- Formulário de Cadastro -->
        <div class="info-card" style="padding:16px; border:1px dashed var(--border); background:#fdfdfd;">
          <h3 class="info-card-title" style="margin-bottom:12px; font-size:14px; font-weight:600; color:var(--crimson);">Cadastrar Novo Voucher Avulso</h3>
          
          <form id="formNovoVoucher" onsubmit="window.salvarNovoVoucherCliente(event, '${cliente.id}')" style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
            
            <div style="display:flex; flex-direction:column; gap:4px; grid-column:span 2;">
              <label style="font-size:12px; font-weight:600; color:var(--ink-mid);">Nome do Ingresso / Reserva</label>
              <input type="text" id="vchNome" required placeholder="Ex: Entrada Disneyland Tokyo, Bilhete Shinkansen Kyoto" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; font-weight:600; color:var(--ink-mid);">Tipo de Voucher</label>
              <select id="vchTipo" onchange="window.toggleVchFields()" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:#fff;">
                <option value="qr_code">QR Code (Imagem)</option>
                <option value="pdf">Documento PDF</option>
                <option value="link">Link Externo (Google Drive, etc)</option>
                <option value="instrucao">Apenas Instruções por escrito</option>
              </select>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:12px; font-weight:600; color:var(--ink-mid);">Data de Uso (Opcional)</label>
              <input type="date" id="vchDataUso" style="padding:7px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
            </div>

            <!-- Campo de Arquivo (Imagens/PDF) -->
            <div id="vchFileWrapper" style="display:flex; flex-direction:column; gap:4px; grid-column:span 2;">
              <label style="font-size:12px; font-weight:600; color:var(--ink-mid);">Upload do Arquivo (Imagem ou PDF)</label>
              <input type="file" id="vchFile" accept="image/*,application/pdf" multiple style="padding:6px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:#fff;">
              <span style="font-size:11px; color:var(--ink-lt);">Selecione um ou mais arquivos (imagens de QR Code ou PDFs). Tamanho máximo individual recomendado: 3MB.</span>
            </div>

            <!-- Campo de URL (Para Links) -->
            <div id="vchUrlWrapper" style="display:none; flex-direction:column; gap:4px; grid-column:span 2;">
              <label style="font-size:12px; font-weight:600; color:var(--ink-mid);">Link Externo (URL)</label>
              <input type="url" id="vchUrl" placeholder="https://drive.google.com/..." style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
            </div>

            <div style="display:flex; flex-direction:column; gap:4px; grid-column:span 2;">
              <label style="font-size:12px; font-weight:600; color:var(--ink-mid);">Vincular a Item do Roteiro (Opcional)</label>
              <select id="vchAtracaoNome" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:#fff;">
                <option value="">-- Selecionar item do roteiro --</option>
                ${itensRoteiro.map(item => `<option value="${item.val}">${item.label}</option>`).join('')}
              </select>
            </div>

            <!-- Dropdown de Templates de Instruções do Sheets -->
            <div style="display:flex; flex-direction:column; gap:4px; grid-column:span 2;">
              <label style="font-size:12px; font-weight:600; color:var(--ink-mid);">Carregar Modelo de Instrução do Google Sheets</label>
              <select id="vchTemplate" onchange="window.aplicarTemplateInstrucao()" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:#fff; border-color:var(--accent);">
                <option value="">-- Escolha um modelo para autocompletar --</option>
                ${templates.map(t => `<option value="${t.id}">${t.titulo}</option>`).join('')}
              </select>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px; grid-column:span 2;">
              <label style="font-size:12px; font-weight:600; color:var(--ink-mid);">Instruções Específicas para o Cliente</label>
              <textarea id="vchInstrucao" rows="4" placeholder="Ex: Apresente o QR code no celular para entrar..." style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; font-family:var(--ff-body); resize:vertical;"></textarea>
            </div>

            <div style="grid-column:span 2; display:flex; justify-content:flex-end; margin-top:8px;">
              <button type="submit" class="btn-primary" style="padding:10px 20px; font-size:13px; font-weight:600; border-radius:6px;">
                Adicionar e Salvar Ficha
              </button>
            </div>
            
          </form>
        </div>

      </div>
    `;

    window.vchTemplatesCache = templates;

  } catch(e) {
    console.error(e);
    contentDiv.innerHTML = `<div style="text-align:center; padding: 20px; color:#c00;">Erro ao carregar a aba de Vouchers: ${e.message}</div>`;
  }
};

window.toggleVchFields = function() {
  const tipo = document.getElementById('vchTipo').value;
  const fileWrapper = document.getElementById('vchFileWrapper');
  const urlWrapper = document.getElementById('vchUrlWrapper');

  if (tipo === 'qr_code' || tipo === 'pdf') {
    if (fileWrapper) fileWrapper.style.display = 'flex';
    if (urlWrapper) urlWrapper.style.display = 'none';
  } else if (tipo === 'link') {
    if (fileWrapper) fileWrapper.style.display = 'none';
    if (urlWrapper) urlWrapper.style.display = 'flex';
  } else {
    if (fileWrapper) fileWrapper.style.display = 'none';
    if (urlWrapper) urlWrapper.style.display = 'none';
  }
};

window.aplicarTemplateInstrucao = function() {
  const templateId = document.getElementById('vchTemplate').value;
  if (!templateId || !window.vchTemplatesCache) return;
  const template = window.vchTemplatesCache.find(t => t.id === templateId);
  if (template) {
    const el = document.getElementById('vchInstrucao');
    if (el) el.value = template.instrucoes || '';
  }
};

window.excluirVoucherCliente = async function(clienteId, voucherId) {
  if (!confirm('Deseja realmente excluir este voucher/ingresso? Isso não poderá ser desfeito.')) return;

  try {
    const resLocal = await fetch(`/api/clientes/local/${clienteId}?t=${Date.now()}`);
    const localData = await resLocal.json();
    
    localData.vouchers = (localData.vouchers || []).filter(v => v.id !== voucherId);
    
    window.currentEditingVouchers = localData.vouchers;

    const saveRes = await fetch('/api/clientes/local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localData)
    });

    if (!saveRes.ok) throw new Error('Erro ao persistir exclusão');
    window.invalidarClienteLocalLeve(clienteId);
    alert('Voucher excluído com sucesso!');
    
    const cliente = typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === clienteId) : { id: clienteId };
    window.renderAbaVouchersCliente(cliente);

  } catch (err) {
    console.error(err);
    alert('Erro ao excluir voucher: ' + err.message);
  }
};

window.salvarNovoVoucherCliente = async function(e, clienteId) {
  e.preventDefault();

  const btn = e.target.querySelector('button[type="submit"]');
  const oldText = btn.innerText;
  btn.disabled = true;
  btn.innerText = 'Processando e Salvando...';

  try {
    const nome = document.getElementById('vchNome').value.trim();
    const tipo = document.getElementById('vchTipo').value;
    const dataUso = document.getElementById('vchDataUso').value;
    const atracaoNome = document.getElementById('vchAtracaoNome').value;
    const instrucao = document.getElementById('vchInstrucao').value.trim();
    
    let url = '';
    let fileName = '';
    let arquivos = [];

    if (tipo === 'qr_code' || tipo === 'pdf') {
      const fileInput = document.getElementById('vchFile');
      if (fileInput.files.length > 0) {
        const promessasLeitura = Array.from(fileInput.files).map(file => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({
              id: String(Date.now() + Math.random()),
              url: reader.result,
              fileName: file.name
            });
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
          });
        });
        
        arquivos = await Promise.all(promessasLeitura);
        
        // Mantém compatibilidade com campos raiz de arquivo único (compatibilidade de fallback)
        url = arquivos[0].url;
        fileName = arquivos[0].fileName;
      } else {
        throw new Error('Por favor, selecione ao menos um arquivo de imagem ou PDF para fazer upload.');
      }
    } else if (tipo === 'link') {
      url = document.getElementById('vchUrl').value.trim();
      if (!url) throw new Error('Por favor, digite a URL para o link externo.');
      arquivos = [{ id: String(Date.now()), url, fileName: 'Link Externo' }];
    }

    const resLocal = await fetch(`/api/clientes/local/${clienteId}?t=${Date.now()}`);
    const localData = await resLocal.json();
    
    if (!localData.vouchers) localData.vouchers = [];

    const novoVoucher = {
      id: String(Date.now() + Math.random()),
      nome,
      tipo,
      url,
      fileName,
      arquivos, // Injeta o array de múltiplos arquivos
      atracaoNome,
      dataUso,
      instrucao
    };

    localData.vouchers.push(novoVoucher);
    
    window.currentEditingVouchers = localData.vouchers;

    const saveRes = await fetch('/api/clientes/local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localData)
    });

    if (!saveRes.ok) throw new Error('Erro ao salvar no banco');
    
    window.invalidarClienteLocalLeve(clienteId);
    alert('Voucher cadastrado e salvo com sucesso!');
    
    const cliente = typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === clienteId) : { id: clienteId };
    window.renderAbaVouchersCliente(cliente);

  } catch(err) {
    console.error(err);
    alert('Erro ao salvar voucher: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = oldText;
  }
};

// Modal dinâmico de upload rápido de voucher (Suporta Criação e Edição)
window.uploadRapidoVoucherAdmin = async function(clienteId, atracaoNome, nomeSugestionado, dataUso, voucherId = null) {
  let modal = document.getElementById('modalUploadRapidoVoucher');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalUploadRapidoVoucher';
    modal.style.position = 'fixed';
    modal.style.zIndex = '9999';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    document.body.appendChild(modal);
  }

  // Feedback visual de carregamento
  modal.innerHTML = `
    <div style="background:#fff; padding:24px; border-radius:12px; width:90%; max-width:500px; box-shadow:0 10px 30px rgba(0,0,0,0.25); display:flex; align-items:center; justify-content:center; min-height:200px;">
      <strong style="color:var(--crimson)">Carregando informações do voucher...</strong>
    </div>
  `;
  modal.style.display = 'flex';

  let templates = [];
  let voucherExistente = null;
  
  try {
    const templatesRes = await fetch('/api/templates-vouchers');
    templates = await templatesRes.json();
    
    const resLocal = await fetch(`/api/clientes/local/${clienteId}?t=${Date.now()}`);
    const localData = await resLocal.json();
    if (voucherId && localData.vouchers) {
      voucherExistente = localData.vouchers.find(v => v.id === voucherId);
    }
  } catch(e) {
    console.error(e);
  }

  const isEdit = !!voucherExistente;
  const nomeVal = isEdit ? voucherExistente.nome : nomeSugestionado;
  const tipoVal = isEdit ? voucherExistente.tipo : 'qr_code';
  const dataVal = isEdit ? (voucherExistente.dataUso || '') : (dataUso || '');
  const instrucoesVal = isEdit ? (voucherExistente.instrucao || '') : '';
  const urlVal = (isEdit && voucherExistente.tipo === 'link') ? (voucherExistente.url || '') : '';
  const targetAtracao = isEdit ? (voucherExistente.atracaoNome || atracaoNome) : atracaoNome;

  let labelVinculo = 'Nenhum';
  if (targetAtracao) {
    if (targetAtracao.startsWith('dia:')) labelVinculo = `Dia ${targetAtracao.split(':')[1]}`;
    else if (targetAtracao.startsWith('atracao:')) labelVinculo = `Atração: ${targetAtracao.split(':')[1]}`;
    else if (targetAtracao.startsWith('experiencia:')) labelVinculo = `Experiência: ${targetAtracao.split(':')[1]}`;
    else if (targetAtracao.startsWith('transporte:')) labelVinculo = `Transporte: ${targetAtracao.split(':')[1]}`;
    else labelVinculo = targetAtracao;
  }

  let arquivosFeedbackHTML = '';
  if (isEdit && (tipoVal === 'qr_code' || tipoVal === 'pdf') && voucherExistente.arquivos && voucherExistente.arquivos.length > 0) {
    const nomesFls = voucherExistente.arquivos.map(a => a.fileName || 'Arquivo').join(', ');
    arquivosFeedbackHTML = `
      <div id="vchRapidoFileFeedback" style="font-size:11px; color:#1e40af; background:#eff6ff; border:1px solid #bfdbfe; padding:8px 10px; border-radius:6px; margin-top:4px;">
        <strong>Arquivos atuais:</strong> ${nomesFls}
        <br><span style="color:#6b7280; font-size:10px;">Selecione novos arquivos para substituir, ou deixe em branco para manter os atuais.</span>
      </div>
    `;
  }

  modal.innerHTML = `
    <div style="background:#fff; padding:24px; border-radius:12px; width:90%; max-width:500px; box-shadow:0 10px 30px rgba(0,0,0,0.25); display:flex; flex-direction:column; gap:16px; position:relative;" onclick="event.stopPropagation()">
      <span onclick="window.fecharModalUploadRapido()" style="position:absolute; top:12px; right:16px; font-size:20px; font-weight:bold; cursor:pointer; color:#7f7f7f;">✕</span>
      <h3 style="margin:0; font-family:var(--ff-display); color:var(--crimson); font-size:16px; font-weight:600;">
        ${isEdit ? 'Editar Ingresso / Passagem' : 'Enviar Ingresso / Passagem'}
      </h3>
      
      <div style="font-size:12px; color:var(--text-sec); border-bottom:1px solid var(--border); padding-bottom:8px; margin-bottom:4px;">
        <strong>Vínculo:</strong> <span style="color:var(--crimson); font-weight:600;">${labelVinculo}</span>
      </div>
      
      <form id="formUploadRapido" onsubmit="window.salvarUploadRapidoVoucher(event, '${clienteId}', '${targetAtracao.replace(/'/g, "\\'")}', '${voucherId || ''}')" style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Nome do Ingresso / Voucher</label>
          <input type="text" id="vchRapidoNome" required value="${nomeVal.replace(/"/g, '&quot;')}" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:11.5px; font-weight:600; color:#555;">Tipo</label>
            <select id="vchRapidoTipo" onchange="window.toggleVchRapidoFields()" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:#fff;">
              <option value="qr_code" ${tipoVal === 'qr_code' ? 'selected' : ''}>QR Code (Imagem)</option>
              <option value="pdf" ${tipoVal === 'pdf' ? 'selected' : ''}>Documento PDF</option>
              <option value="link" ${tipoVal === 'link' ? 'selected' : ''}>Link Externo</option>
              <option value="instrucao" ${tipoVal === 'instrucao' ? 'selected' : ''}>Apenas Instruções por escrito</option>
            </select>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:11.5px; font-weight:600; color:#555;">Data de Uso (Opcional)</label>
            <input type="date" id="vchRapidoData" value="${dataVal}" style="padding:7px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
          </div>
        </div>

        <div id="vchRapidoFileWrapper" style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Upload de Arquivos</label>
          <input type="file" id="vchRapidoFile" accept="image/*,application/pdf" multiple style="padding:6px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:#fff;">
          ${arquivosFeedbackHTML}
        </div>

        <div id="vchRapidoUrlWrapper" style="display:none; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Link do Documento (URL)</label>
          <input type="url" id="vchRapidoUrl" value="${urlVal}" placeholder="https://drive.google.com/..." style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
        </div>

        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Modelo de Instrução (Sheets)</label>
          <select id="vchRapidoTemplate" onchange="window.aplicarTemplateRapido()" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:#fff; border-color:var(--accent);">
            <option value="">-- Escolha um modelo para preencher --</option>
            ${templates.map(t => `<option value="${t.id}">${t.titulo}</option>`).join('')}
          </select>
        </div>

        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Instruções ao Cliente</label>
          <textarea id="vchRapidoInstrucoes" rows="3" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; font-family:var(--ff-body); resize:vertical;">${instrucoesVal}</textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
          <button type="button" onclick="window.fecharModalUploadRapido()" class="btn-secondary" style="padding:8px 16px; font-size:12.5px;">Cancelar</button>
          <button type="submit" class="btn-primary" style="padding:8px 20px; font-size:12.5px; font-weight:600;">
            ${isEdit ? 'Salvar Alterações' : 'Enviar'}
          </button>
        </div>
      </form>
    </div>
  `;

  window.vchRapidoTemplatesCache = templates;
  window.toggleVchRapidoFields();
};

window.fecharModalUploadRapido = function() {
  const modal = document.getElementById('modalUploadRapidoVoucher');
  if (modal) modal.style.display = 'none';
};

window.toggleVchRapidoFields = function() {
  const tipo = document.getElementById('vchRapidoTipo').value;
  const fileWrapper = document.getElementById('vchRapidoFileWrapper');
  const urlWrapper = document.getElementById('vchRapidoUrlWrapper');
  if (tipo === 'qr_code' || tipo === 'pdf') {
    if (fileWrapper) fileWrapper.style.display = 'flex';
    if (urlWrapper) urlWrapper.style.display = 'none';
  } else if (tipo === 'link') {
    if (fileWrapper) fileWrapper.style.display = 'none';
    if (urlWrapper) urlWrapper.style.display = 'flex';
  } else {
    if (fileWrapper) fileWrapper.style.display = 'none';
    if (urlWrapper) urlWrapper.style.display = 'none';
  }
};

window.aplicarTemplateRapido = function() {
  const tId = document.getElementById('vchRapidoTemplate').value;
  if (!tId || !window.vchRapidoTemplatesCache) return;
  const template = window.vchRapidoTemplatesCache.find(t => t.id === tId);
  if (template) {
    document.getElementById('vchRapidoInstrucoes').value = template.instrucoes || '';
  }
};

window.salvarUploadRapidoVoucher = async function(e, clienteId, atracaoNome, voucherId = null) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerText = 'Processando...';

  try {
    const nome = document.getElementById('vchRapidoNome').value.trim();
    const tipo = document.getElementById('vchRapidoTipo').value;
    const dataUso = document.getElementById('vchRapidoData').value;
    const instrucao = document.getElementById('vchRapidoInstrucoes').value.trim();
    
    // Obter dados locais atualizados do cliente
    const resLocal = await fetch(`/api/clientes/local/${clienteId}?t=${Date.now()}`);
    const localData = await resLocal.json();
    if (!localData.vouchers) localData.vouchers = [];

    let voucherExistente = null;
    if (voucherId) {
      voucherExistente = localData.vouchers.find(v => v.id === voucherId);
    }

    let url = '';
    let fileName = '';
    let arquivos = [];

    if (tipo === 'qr_code' || tipo === 'pdf') {
      const fileInput = document.getElementById('vchRapidoFile');
      if (fileInput.files.length > 0) {
        // Lemos novos arquivos em paralelo
        const promessasLeitura = Array.from(fileInput.files).map(file => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({
              id: String(Date.now() + Math.random()),
              url: reader.result,
              fileName: file.name
            });
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
          });
        });
        
        arquivos = await Promise.all(promessasLeitura);
        url = arquivos[0].url;
        fileName = arquivos[0].fileName;
      } else {
        // Se for edição e não forneceu novos arquivos, mantém os arquivos anteriores
        if (voucherExistente && (voucherExistente.tipo === 'qr_code' || voucherExistente.tipo === 'pdf')) {
          arquivos = voucherExistente.arquivos || [];
          url = voucherExistente.url || '';
          fileName = voucherExistente.fileName || '';
        } else {
          throw new Error('Por favor, selecione ao menos um arquivo.');
        }
      }
    } else if (tipo === 'link') {
      url = document.getElementById('vchRapidoUrl').value.trim();
      if (!url) throw new Error('Por favor, insira a URL.');
      arquivos = [{ id: String(Date.now()), url, fileName: 'Link Externo' }];
    }

    if (voucherExistente) {
      // Editar existente
      voucherExistente.nome = nome;
      voucherExistente.tipo = tipo;
      voucherExistente.url = url;
      voucherExistente.fileName = fileName;
      voucherExistente.arquivos = arquivos;
      voucherExistente.atracaoNome = atracaoNome;
      voucherExistente.dataUso = dataUso;
      voucherExistente.instrucao = instrucao;
    } else {
      // Criar novo
      const novoVoucher = {
        id: String(Date.now() + Math.random()),
        nome,
        tipo,
        url,
        fileName,
        arquivos,
        atracaoNome,
        dataUso,
        instrucao
      };
      localData.vouchers.push(novoVoucher);
    }

    window.currentEditingVouchers = localData.vouchers;

    const saveRes = await fetch('/api/clientes/local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localData)
    });

    if (!saveRes.ok) throw new Error('Erro ao salvar no banco');
    
    window.invalidarClienteLocalLeve(clienteId);
    alert(voucherExistente ? 'Ingresso atualizado com sucesso!' : 'Ingresso anexado com sucesso!');
    window.fecharModalUploadRapido();
    
    // Atualizar visualização simulando o clique do botão ativo de abas para recarregar com dados novos
    const activeTabBtn = document.querySelector('.tab-client-btn.active');
    if (activeTabBtn) {
      activeTabBtn.click();
    } else {
      const cli = typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === clienteId) : { id: clienteId };
      renderAbaRoteiros(cli);
    }

  } catch(err) {
    console.error(err);
    alert('Erro ao salvar ingresso: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = voucherId ? 'Salvar Alterações' : 'Enviar';
  }
};

window.visualizarVoucherAdmin = function(voucherId) {
  const tabBtn = document.querySelector('.tab-client-btn[data-tab="vouchers"]');
  if (tabBtn) {
    tabBtn.click();
    setTimeout(() => {
      const rows = document.querySelectorAll('.data-table tbody tr');
      rows.forEach(row => {
        if (row.innerHTML.includes(voucherId) || row.innerHTML.includes(`excluirVoucherCliente`)) {
          row.style.background = '#e6f7ed';
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            row.style.transition = 'background 1s';
            row.style.background = '';
          }, 3000);
        }
      });
    }, 400);
  }
};

function buildPreferenciasHTML(preferencias) {
  let prioridadesHTML = '';
  if (preferencias.prioridades && preferencias.prioridades.length > 0) {
    const prioArr = Array.isArray(preferencias.prioridades) ? preferencias.prioridades : [preferencias.prioridades];
    prioridadesHTML = prioArr.map(p => `
      <span style="display:inline-block; font-size:12px; background:rgba(196,163,90,0.06); border:1px solid rgba(196,163,90,0.25); color:var(--gold-dk); padding:4px 10px; border-radius:12px; margin-right:6px; margin-bottom:6px; font-weight:500;">${p}</span>
    `).join('');
  } else {
    prioridadesHTML = '<span style="font-size:12px; color:var(--ink-lt); font-style:italic;">Nenhuma prioridade selecionada</span>';
  }

  let toursHTML = '';
  if (preferencias.interessesTour && preferencias.interessesTour.length > 0) {
    const tourArr = Array.isArray(preferencias.interessesTour) ? preferencias.interessesTour : [preferencias.interessesTour];
    toursHTML = tourArr.map(t => `
      <span style="display:inline-block; font-size:12px; background:rgba(107,31,42,0.04); border:1px solid rgba(107,31,42,0.12); color:var(--crimson); padding:4px 10px; border-radius:12px; margin-right:6px; margin-bottom:6px; font-weight:500;">${t}</span>
    `).join('');
  }

  return `
    <div style="margin-top: 16px; border-top: 1px solid var(--border); padding-top: 24px;">
      <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold-dk); margin-bottom: 16px; font-weight: 600; display:inline-flex; align-items:center; gap:4px;">
        <svg class="v-icon" style="width:1.1em; height:1.1em; margin-right:0;"><use href="#icon-star"></use></svg> Preferências & Perfil de Viagem
      </h3>

      ${preferencias.cidadesPretendeVisitar ? `
      <div style="background: rgba(196,163,90,0.06); border: 1px solid rgba(196,163,90,0.25); border-radius: 12px; padding: 12px 16px; margin-bottom: 16px;">
        <div style="font-size: 11px; color: var(--ink-lt); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; font-weight: 600;">🗺️ Cidades que pretende visitar</div>
        <div style="font-size: 14px; color: var(--ink-dk); font-weight: 600;">${preferencias.cidadesPretendeVisitar}</div>
      </div>
      ` : ''}

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
        <!-- Card 1: Ritmo & Perfil Físico -->
        <div style="background: rgba(196,163,90,0.02); border: 1px solid var(--border); border-radius: 12px; padding: 16px; box-sizing: border-box;">
          <h4 style="font-size: 12px; color: var(--crimson); text-transform: uppercase; margin-top: 0; margin-bottom: 12px; font-weight: 600; letter-spacing:0.04em;">🏃 Ritmo & Estilo</h4>
          <div style="font-size: 13px; display: flex; flex-direction: column; gap: 8px; color: var(--ink-dk); line-height: 1.4;">
            <div><strong>Ritmo dos dias:</strong> ${preferencias.ritmo || 'Não informado'}</div>
            <div><strong>Visitas a Templos:</strong> ${preferencias.templos || 'Não informado'}</div>
            <div><strong>Caminhadas Diárias:</strong> ${preferencias.caminhada || 'Não informado'}</div>
            <div><strong>Alimentação no Dia a Dia:</strong> ${preferencias.refeicoes || 'Não informado'}</div>
          </div>
        </div>

        <!-- Card 2: Foco & Interesses -->
        <div style="background: rgba(196,163,90,0.02); border: 1px solid var(--border); border-radius: 12px; padding: 16px; box-sizing: border-box;">
          <h4 style="font-size: 12px; color: var(--crimson); text-transform: uppercase; margin-top: 0; margin-bottom: 12px; font-weight: 600; letter-spacing:0.04em;">🎯 Prioridades & Focos</h4>
          <div style="margin-bottom: 10px;">
            <div style="font-size: 11px; color: var(--ink-lt); margin-bottom: 6px; font-weight:500; text-transform: uppercase; letter-spacing: 0.05em;">Prioridades Gerais:</div>
            <div>${prioridadesHTML}</div>
          </div>
          ${toursHTML ? `
          <div>
            <div style="font-size: 11px; color: var(--ink-lt); margin-bottom: 6px; font-weight:500; text-transform: uppercase; letter-spacing: 0.05em;">Foco nos Tours Guiados:</div>
            <div>${toursHTML}</div>
          </div>
          ` : ''}
        </div>

        <!-- Card 3: Informações de Onboarding & Especial -->
        <div style="background: rgba(196,163,90,0.02); border: 1px solid var(--border); border-radius: 12px; padding: 16px; box-sizing: border-box;">
          <h4 style="font-size: 12px; color: var(--crimson); text-transform: uppercase; margin-top: 0; margin-bottom: 12px; font-weight: 600; letter-spacing:0.04em;">✨ Detalhes do Grupo</h4>
          <div style="font-size: 13px; display: flex; flex-direction: column; gap: 8px; color: var(--ink-dk); line-height: 1.4;">
            <div><strong>Primeira vez no Japão?</strong> ${preferencias.primeiraVez || 'Não informado'}</div>
            <div><strong>Interesse Sazonal:</strong> ${preferencias.experienciasSazonais || 'Não informado'}</div>
            ${preferencias.profissoes ? `<div><strong>Profissão dos Viajantes:</strong> ${preferencias.profissoes}</div>` : ''}
            ${preferencias.ocasiaoEspecial ? `<div style="background: rgba(196,163,90,0.06); padding: 8px 12px; border-radius: 6px; border-left: 3px solid var(--gold); margin-top: 4px; font-size: 12.5px; color: var(--ink-dk);">🎉 <strong>Celebração:</strong> ${preferencias.ocasiaoEspecial}</div>` : ''}
            ${preferencias.necessidadesEspeciais ? `<div style="background: rgba(220,53,69,0.03); padding: 8px 12px; border-radius: 6px; border-left: 3px solid var(--crimson); margin-top: 4px; font-size: 12.5px; color: var(--ink-dk);">⚠️ <strong>Necessidades Especiais:</strong> ${preferencias.necessidadesEspeciais}</div>` : ''}
          </div>
        </div>
      </div>

      ${preferencias.experienciasImperdiveis ? `
      <!-- Destaque: Experiências dos Sonhos -->
      <div style="background: rgba(107,31,42,0.02); border: 1px dashed rgba(107,31,42,0.25); border-radius: 12px; padding: 16px; margin-top: 16px; box-sizing: border-box;">
        <h4 style="font-size: 12px; color: var(--crimson); text-transform: uppercase; margin-top: 0; margin-bottom: 8px; font-weight: 600; letter-spacing:0.04em; display:flex; align-items:center; gap:4px;">🌸 Experiência dos Sonhos / Imperdível</h4>
        <p style="font-size: 13px; color: var(--ink-dk); font-style: italic; margin: 0; line-height: 1.5;">"${preferencias.experienciasImperdiveis}"</p>
      </div>
      ` : ''}
    </div>
  `;
}

async function renderAbaDadosCliente(cliente, estadias, viajantes, emails) {
  if (!Array.isArray(estadias)) estadias = [];
  if (!Array.isArray(viajantes)) viajantes = [];
  if (!Array.isArray(emails)) emails = [];
  const contentDiv = document.getElementById('clientTabContent');
  if (!contentDiv) return;

  try {
    const locData = await window.carregarClienteLocalLeve(cliente.id);
    if (locData && Array.isArray(locData.estadias)) {
      estadias = locData.estadias;
    }
  } catch (e) {}

  let datasViagem = 'Sem data definida';
  if (cliente.dataInicio && cliente.dataFim) {
    datasViagem = `${fmtDataBR(cliente.dataInicio)} a ${fmtDataBR(cliente.dataFim)}`;
  } else if (cliente.dataInicio) {
    datasViagem = `${fmtDataBR(cliente.dataInicio)}`;
  }

  let passageiros = '';
  if (viajantes && viajantes.length > 0) {
    let ad = 0, cr = 0;
    viajantes.forEach(v => {
      const idade = parseInt(v.idade);
      if (isNaN(idade) || idade >= 12) ad++;
      else cr++;
    });
    passageiros = `${viajantes.length} viajante(s)`;
    if (ad > 0) passageiros += ` · ${ad} adulto(s)`;
    if (cr > 0) passageiros += ` · ${cr} criança(s)`;
  } else {
    const ad = parseInt(cliente.adultos) || 0;
    const cr = parseInt(cliente.criancas) || 0;
    if (ad > 0) passageiros += `${ad} Adulto(s)`;
    if (cr > 0) passageiros += `, ${cr} Criança(s)`;
    if (!passageiros) passageiros = 'Nenhum passageiro informado';
  }

  let vooChegadaStr = 'Não informado';
  if (cliente.vooChegadaNum || cliente.vooChegadaHora) {
    vooChegadaStr = [cliente.vooChegadaNum, cliente.vooChegadaHora].filter(Boolean).join(' · ');
  } else if (cliente.vooChegada) {
    vooChegadaStr = cliente.vooChegada;
  }
  let vooPartidaStr = 'Não informado';
  if (cliente.vooPartidaNum || cliente.vooPartidaHora) {
    vooPartidaStr = [cliente.vooPartidaNum, cliente.vooPartidaHora].filter(Boolean).join(' · ');
  } else if (cliente.vooPartida) {
    vooPartidaStr = cliente.vooPartida;
  }

  let viajantesHTML = '';
  if (viajantes && viajantes.length > 0) {
    viajantesHTML = `<div class="client-travelers">` +
      viajantes.map(v => {
        const nomeCompleto = [v.nome, v.sobrenome].filter(Boolean).join(' ') || 'Sem nome';
        const tag = (parseInt(v.idade) < 12 && !isNaN(parseInt(v.idade))) ? 'Criança' : 'Adulto';
        const ageStr = v.idade ? `${v.idade} anos` : '';
        return `<div class="client-trav"><div class="who"><span class="tag">${tag}</span><span class="nm">${nomeCompleto}</span></div><span class="age">${ageStr}</span></div>`;
      }).join('') + `</div>`;
  } else {
    if (cliente.viajantes) {
      viajantesHTML = `<div style="font-size:13px; color:var(--ink-dk); white-space:pre-wrap;">${cliente.viajantes}</div>`;
    } else {
      viajantesHTML = `<p style="font-size: 13px; color: var(--ink-lt); font-style: italic;">Nenhum viajante cadastrado.</p>`;
    }
  }

  let emailsHTML = '';
  if (emails && emails.length > 0) {
    emailsHTML = emails.map((e, i) => {
      const badge = i === 0 ? ' <span style="font-size:9px; background:var(--crimson); color:#fff; padding:1px 4px; border-radius:3px; vertical-align:middle;">Principal</span>' : '';
      return `<div style="font-size:13px; color:var(--ink-dk); padding:4px 0;">${e.email}${badge}</div>`;
    }).join('');
  } else if (cliente.email) {
    emailsHTML = `<div style="font-size:13px; color:var(--ink-dk); white-space:pre-wrap;">${cliente.email}</div>`;
  } else {
    emailsHTML = `<p style="font-size: 13px; color: var(--ink-lt); font-style: italic;">Nenhum e-mail cadastrado.</p>`;
  }

  let estadiasHTML = '';
  if (estadias && estadias.length > 0) {
    estadiasHTML = estadias.map(est => `
      <div class="preview-estadia-card" style="padding: 12px 16px; border-radius: 8px; background: rgba(196,163,90,0.04); border: 1px solid var(--border); margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <strong style="color: var(--crimson); font-size: 14px;">${_escHtml(est.cidade || 'Cidade não informada')}</strong>
          <span style="font-size: 12px; color: var(--ink-lt);">
            ${est.dataInicio && est.dataFim ? `${fmtDataBR(est.dataInicio)} a ${fmtDataBR(est.dataFim)}` : 'Sem período informado'}
          </span>
        </div>
        <div style="font-size: 13px; color: var(--ink-dk);">${_escHtml(est.hotel || 'Hotel não informado')}</div>
      </div>
    `).join('');
  } else {
    estadiasHTML = `<p style="font-size: 13px; color: var(--ink-lt); font-style: italic;">Nenhuma estadia cadastrada.</p>`;
  }

  contentDiv.innerHTML = `
    <div class="preview-body" style="display: flex; flex-direction: column; gap: 24px;">
      <div class="client-facts">
        <div class="client-fact"><div class="k">Período (Chegada ↔ Partida)</div><div class="v">${datasViagem}</div></div>
        <div class="client-fact"><div class="k">Passageiros</div><div class="v">${passageiros}</div></div>
        <div class="client-fact"><div class="k"><svg class="v-icon"><use href="#icon-plane"></use></svg> Voo de Chegada</div><div class="v">${vooChegadaStr}</div></div>
        <div class="client-fact"><div class="k"><svg class="v-icon"><use href="#icon-plane"></use></svg> Voo de Partida</div><div class="v">${vooPartidaStr}</div></div>
      </div>

      <div>
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold-dk); margin-bottom: 12px; font-weight: 600; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon"><use href="#icon-users"></use></svg> Viajantes</h3>
        ${viajantesHTML}
      </div>

      <div>
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold-dk); margin-bottom: 12px; font-weight: 600; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon"><use href="#icon-file"></use></svg> E-mails</h3>
        ${emailsHTML}
      </div>

      <div>
        <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold-dk); margin-bottom: 12px; font-weight: 600;">Estadias e Hotéis</h3>
        <div class="preview-estadias-list">
          ${estadiasHTML}
        </div>
      </div>
      
      <div id="preferenciasContainer"></div>
    </div>
  `;

  // Busca assincronamente as preferências locais do cliente
  window.carregarClienteLocalLeve(cliente.id)
    .then(localData => {
      if (localData && localData.preferencias) {
        const container = document.getElementById('preferenciasContainer');
        if (container) {
          container.innerHTML = buildPreferenciasHTML(localData.preferencias);
        }
      }
    })
    .catch(err => console.error("Erro ao carregar preferências locais no painel:", err));
}

function renderAbaRoteiros(cliente) {
  const contentDiv = document.getElementById('clientTabContent');
  if (!contentDiv) return;

  const clienteNome = cliente.nome || '';
  // Normaliza nomes para comparação (ignora acentos, caixa e espaços duplicados)
  const normNome = (n) => (n || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
  const alvoNome = normNome(clienteNome);
  const idNorm = (v) => (v || '').toString().replace(/-/g, '').toLowerCase();
  const alvoId = idNorm(cliente.id);

  // Roteiros vinculados a este cliente através das cotações (por nome e por ID imutável)
  const cotacoesDoCliente = (typeof state !== 'undefined' && state && Array.isArray(state.orcamentosDB) ? state.orcamentosDB : [])
    .filter(o => o && idNorm(o.notionClienteId) === alvoId);
  const roteirosViaCotacao = new Set(
    cotacoesDoCliente.filter(o => o.orcRoteiroVinculado || o.roteiroVinculado)
      .map(o => o.orcRoteiroVinculado || o.roteiroVinculado)
  );
  const roteiroIdsViaCotacao = new Set(
    cotacoesDoCliente.filter(o => o.roteiroId).map(o => o.roteiroId)
  );

  const roteiros = typeof dbRotas !== 'undefined' ? Object.entries(dbRotas)
    .filter(([nome, rot]) => {
      if (!rot) return false;
      if (rot.id && roteiroIdsViaCotacao.has(rot.id)) return true;
      if (idNorm(rot.notionClienteId) === alvoId) return true;
      if (rot.cliente && idNorm(rot.cliente.notionClienteId) === alvoId) return true;
      if (rot.cliente && alvoNome && normNome(rot.cliente.nome) === alvoNome) return true;
      if (roteirosViaCotacao.has(nome)) return true;
      return false;
    })
    .map(([nome, rot]) => ({ nome, ...rot })) : [];

  if (roteiros.length === 0) {
    contentDiv.innerHTML = `
      <div style="text-align:center; padding: 40px 20px;">
        <p style="color:var(--ink-lt); font-size:14px; margin-bottom:16px;">Nenhum roteiro vinculado a este cliente.</p>
        <button class="btn-primary" onclick="window.criarRoteiroParaCliente('${cliente.id}')" style="display:inline-flex; align-items:center; gap:8px; padding: 10px 18px; border-radius: 8px;">
          Criar Roteiro
        </button>
      </div>
    `;
    return;
  }

  let cardsHTML = roteiros.map(r => {
    const totalDias = (r.dias || []).length;
    const meta = `${totalDias} dia(s)`;
    return `
      <div class="compact-card" data-roteiro-name="${r.nome}" onclick="window.selectRoteiroCompact('${r.nome}')">
        <div class="compact-card-title">${r.nome}</div>
        <div class="compact-card-meta">${meta}</div>
        <div class="compact-card-footer">
          <span class="compact-card-price" style="font-size:11px;">Roteiro</span>
          <span class="compact-card-status" style="background:rgba(196,163,90,0.08); color:var(--gold-dk);">Ativo</span>
        </div>
      </div>
    `;
  }).join('');

  contentDiv.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <span style="font-size:13px; color:var(--ink-lt); font-weight:500;">Histórico de Roteiros</span>
      <button class="btn-primary" onclick="window.criarRoteiroParaCliente('${cliente.id}')" style="display:inline-flex; align-items:center; gap:6px; padding: 6px 12px; font-size:12px; border-radius: 6px;">
        Novo Roteiro
      </button>
    </div>
    <div class="compact-cards-grid" style="margin-bottom:16px;">
      ${cardsHTML}
    </div>
    <div id="roteiroActivePreviewHeader" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding: 12px; background: #fafafa; border-radius: 8px; border: 1px solid var(--border);">
      <strong id="roteiroActiveTitle" style="color:var(--crimson); font-size:15px;"></strong>
      <div style="display:flex; gap:8px;">
        <button class="btn-secondary" id="btnSincronizarCalendarioPreview" style="padding: 6px 12px; font-size:12px; background:var(--crimson); color:white; border-color:var(--crimson); cursor:pointer; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="stroke:#fff; margin-right:2px;"><use href="#icon-calendar"></use></svg>Sincronizar Calendário</button>
        <button class="btn-secondary" id="btnPrevisualizarRoteiroActive" style="padding: 6px 12px; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="margin-right:2px;"><use href="#icon-file"></use></svg>Pré-visualizar</button>
        <button class="btn-secondary" id="btnAbrirRoteiroPreview" style="padding: 6px 12px; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="margin-right:2px;"><use href="#icon-edit"></use></svg>Abrir Editor</button>
        <button class="btn-secondary" id="btnExcluirRoteiroPreview" style="padding: 6px 12px; font-size:12px; color:#c00; border-color:#fee; cursor:pointer; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="stroke:#c00; margin-right:2px;"><use href="#icon-trash"></use></svg>Excluir</button>
      </div>
    </div>
    <div id="roteiroActivePreview" class="tab-preview-section"></div>
  `;

  // Selecionar o primeiro roteiro da lista por padrão
  window.selectRoteiroCompact(roteiros[0].nome);
}

window.selectRoteiroCompact = function(roteiroNome) {
  const cardsGrid = document.querySelector('.compact-cards-grid');
  if (cardsGrid) {
    cardsGrid.querySelectorAll('.compact-card').forEach(card => {
      if (card.dataset.roteiroName === roteiroNome) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  const titleEl = document.getElementById('roteiroActiveTitle');
  if (titleEl) titleEl.innerText = roteiroNome;

  const btnSinc = document.getElementById('btnSincronizarCalendarioPreview');
  if (btnSinc) {
    btnSinc.onclick = () => {
      if (typeof window.sincronizarRoteiroCalendario === 'function') {
        window.sincronizarRoteiroCalendario(roteiroNome);
      }
    };
  }

  const btnPre = document.getElementById('btnPrevisualizarRoteiroActive');
  if (btnPre) {
    btnPre.onclick = () => {
      window.roteiroAtualVisualizado = roteiroNome;
      const btnGerar = document.getElementById('btnGerarRoteiro');
      if (btnGerar) {
        btnGerar.disabled = false;
        btnGerar.click();
      } else {
        alert("Botão de geração de roteiro não encontrado.");
      }
    };
  }

  const btnAbrir = document.getElementById('btnAbrirRoteiroPreview');
  if (btnAbrir) {
    btnAbrir.onclick = () => {
      closeClienteModal();
      if (typeof navToPage === 'function') navToPage('roteiros');
      if (typeof window.editarRoteiroCard === 'function') {
        window.editarRoteiroCard(roteiroNome);
      }
    };
  }

  const btnExcluir = document.getElementById('btnExcluirRoteiroPreview');
  if (btnExcluir) {
    btnExcluir.onclick = async () => {
      if (!confirm(`Tem certeza que deseja excluir o roteiro "${roteiroNome}"?`)) return;
      try {
        await fetch(`/api/roteiros/${encodeURIComponent(roteiroNome)}`, { method: 'DELETE' });
        if (typeof dbRotas !== 'undefined') {
          delete dbRotas[roteiroNome];
        }
        const cli = notionClients.find(x => x.id === window.clienteAtualVisualizado);
        renderAbaRoteiros(cli);
        
        // Limpa o preview ativo
        const previewDiv = document.getElementById('roteiroActivePreview');
        if (previewDiv) {
          previewDiv.innerHTML = '<div style="color:var(--ink-lt); padding:20px; text-align:center;">Selecione um roteiro para ver a prévia.</div>';
        }
        if (typeof renderListaRoteiros === 'function') {
          renderListaRoteiros();
        }
      } catch(err) {
        console.error(err);
        alert('Erro ao excluir roteiro.');
      }
    };
  }

  const previewDiv = document.getElementById('roteiroActivePreview');
  if (previewDiv) {
    previewDiv.innerHTML = '<div style="color:var(--ink-lt); padding:20px;">Carregando roteiro...</div>';
    setTimeout(() => {
      if (window.renderizarRoteiroNoElemento) {
        window.renderizarRoteiroNoElemento(roteiroNome, previewDiv);
      }
    }, 50);
  }
};

window.criarRoteiroParaCliente = function(clienteId) {
  closeClienteModal();
  if (typeof navToPage === 'function') navToPage('roteiros');
  
  const cliente = typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === clienteId) : null;
  if (!cliente) return;

  roteiroOriginalNome = '';
  roteiroEmEdicao = { 
    notionClienteId: clienteId,
    cliente: {
      nome: cliente.nome,
      adultos: cliente.adultos || 2,
      criancas: cliente.criancas || 0,
      dataInicio: cliente.dataInicio || '',
      dataFim: cliente.dataFim || '',
      vooChegada: cliente.vooChegada || '',
      vooPartida: cliente.vooPartida || '',
      estadias: []
    },
    dias: []
  };
  
  document.getElementById('roteirosEmptyState').style.display = 'none';
  document.getElementById('roteirosDetailWrapper').style.display = 'block';
  if (typeof abrirEditorRoteiro === 'function') abrirEditorRoteiro('Novo Roteiro');
  
  fetch(`/api/clientes/local/${clienteId}`).then(r => r.json()).then(d => {
    roteiroEmEdicao.cliente.estadias = JSON.parse(JSON.stringify(d.estadias || []));
    if (typeof renderRotEstadias === 'function') renderRotEstadias();
  }).catch(e => console.error(e));
};

function renderAbaCotacoes(cliente) {
  const contentDiv = document.getElementById('clientTabContent');
  if (!contentDiv) return;

  const cotacoes = state.orcamentosDB.filter(o => {
    return o.notionClienteId === cliente.id || (o.cliente && o.cliente.nome === cliente.nome);
  });

  if (cotacoes.length === 0) {
    contentDiv.innerHTML = `
      <div style="text-align:center; padding: 40px 20px;">
        <p style="color:var(--ink-lt); font-size:14px; margin-bottom:16px;">Nenhuma cotação vinculada a este cliente.</p>
        <button class="btn-primary" onclick="window.criarCotacaoParaCliente('${cliente.id}')" style="display:inline-flex; align-items:center; gap:8px; padding: 10px 18px; border-radius: 8px;">
          Criar Cotação
        </button>
      </div>
    `;
    return;
  }

  let cardsHTML = cotacoes.map(c => {
    const tT  = (c.tours || []).reduce((s,t)=>s+calcTotalTour(t),0);
    const tTr = (c.transportes || []).reduce((s,t)=>s+calcTotalTransporte(t),0);
    const tEx = (c.experiencias || []).reduce((s,e)=>s+calcTotalExp(e),0);
    const tItens = (c.itensAdicionais||[]).reduce((s,i)=>s+(i.valor||0),0);
    const cons = (c.consultoria && c.consultoria.ativa) ? (c.consultoria.valor || 0) : 0;
    const total = tT+tTr+tEx+tItens+cons;

    const dataOrc = c.cliente && c.cliente.dataOrcamento ? fmtDataBR(c.cliente.dataOrcamento) : '—';
    
    return `
      <div class="compact-card" data-cotacao-id="${c.id}" onclick="window.selectCotacaoCompact('${c.id}')">
        <div class="compact-card-title">${c.nome || 'Sem título'}</div>
        <div class="compact-card-meta">Data: ${dataOrc}</div>
        <div class="compact-card-footer">
          <span class="compact-card-price">¥ ${Math.round(total).toLocaleString('pt-BR')}</span>
          <span class="compact-card-status" style="background:rgba(107,31,42,0.08); color:var(--crimson);">${c.status || 'Orçamento'}</span>
        </div>
      </div>
    `;
  }).join('');

  contentDiv.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <span style="font-size:13px; color:var(--ink-lt); font-weight:500;">Histórico de Cotações</span>
      <button class="btn-primary" onclick="window.criarCotacaoParaCliente('${cliente.id}')" style="display:inline-flex; align-items:center; gap:6px; padding: 6px 12px; font-size:12px; border-radius: 6px;">
        Nova Cotação
      </button>
    </div>
    <div class="compact-cards-grid" style="margin-bottom:16px;">
      ${cardsHTML}
    </div>
    <div id="cotacaoActivePreviewHeader" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding: 12px; background: #fafafa; border-radius: 8px; border: 1px solid var(--border);">
      <strong id="cotacaoActiveTitle" style="color:var(--crimson); font-size:15px;"></strong>
      <div style="display:flex; gap:8px;">
        <button class="btn-secondary" id="btnAbrirCotacaoPreview" style="padding: 6px 12px; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="margin-right:2px;"><use href="#icon-edit"></use></svg>Abrir Editor</button>
        <button class="btn-secondary" id="btnExcluirCotacaoPreview" style="padding: 6px 12px; font-size:12px; color:#c00; border-color:#fee; cursor:pointer; display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="stroke:#c00; margin-right:2px;"><use href="#icon-trash"></use></svg>Excluir</button>
      </div>
    </div>
    <div id="cotacaoActivePreview" class="tab-preview-section" style="max-height: 600px; overflow-y: auto;"></div>
  `;

  // Selecionar a primeira cotação da lista por padrão
  window.selectCotacaoCompact(cotacoes[0].id);
}

window.selectCotacaoCompact = function(cotacaoId) {
  const cardsGrid = document.querySelector('.compact-cards-grid');
  if (cardsGrid) {
    cardsGrid.querySelectorAll('.compact-card').forEach(card => {
      if (card.dataset.cotacaoId === String(cotacaoId)) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  const orc = state.orcamentosDB.find(o => String(o.id) === String(cotacaoId));
  if (!orc) return;

  const titleEl = document.getElementById('cotacaoActiveTitle');
  if (titleEl) titleEl.innerText = orc.nome || 'Cotação';

  const btnAbrir = document.getElementById('btnAbrirCotacaoPreview');
  if (btnAbrir) {
    btnAbrir.onclick = () => {
      closeClienteModal();
      if (typeof navToPage === 'function') navToPage('orcamento');
      if (typeof abrirOrcamento === 'function') {
        abrirOrcamento(cotacaoId, true);
      }
    };
  }

  const btnExcluir = document.getElementById('btnExcluirCotacaoPreview');
  if (btnExcluir) {
    btnExcluir.onclick = async () => {
      if (!confirm('Tem certeza que deseja excluir esta cotação?')) return;
      try {
        await fetch(`/api/orcamentos/${cotacaoId}`, { method: 'DELETE' });
        state.orcamentosDB = state.orcamentosDB.filter(x => x.id !== cotacaoId);
        const cli = notionClients.find(x => x.id === window.clienteAtualVisualizado);
        renderAbaCotacoes(cli);
        
        // Limpa o preview ativo
        const previewDiv = document.getElementById('cotacaoActivePreview');
        if (previewDiv) {
          previewDiv.innerHTML = '<div style="color:var(--ink-lt); padding:20px; text-align:center;">Selecione uma cotação para ver o resumo.</div>';
        }
        if (typeof renderListaOrcamentos === 'function') {
          renderListaOrcamentos();
        }
      } catch(err) {
        console.error(err);
        alert('Erro ao excluir cotação.');
      }
    };
  }

  const previewDiv = document.getElementById('cotacaoActivePreview');
  if (previewDiv) {
    previewDiv.innerHTML = '<div style="color:var(--ink-lt); padding:20px;">Carregando cotação...</div>';
    setTimeout(() => {
      if (window.renderPreviewOrcamentoNoElemento) {
        window.renderPreviewOrcamentoNoElemento(cotacaoId, previewDiv);
      }
    }, 50);
  }
};

window.criarCotacaoParaCliente = function(clienteId) {
  closeClienteModal(); 
  if (typeof navToPage === 'function') navToPage('orcamento');
  
  const cliente = typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === clienteId) : null;
  if (!cliente) return;

  novoOrcamento();
  state.orcamento.notionClienteId = clienteId;
  const nome = cliente.nome || '';
  document.getElementById('orcNome').value = 'Cotação - ' + nome;
  document.getElementById('clienteNome').value = nome;
  document.getElementById('clienteAdultos').value = cliente.adultos || '2';
  document.getElementById('clienteCriancas').value = cliente.criancas || '0';
  
  const btnImport = document.getElementById('btnImportNotion');
  if (btnImport) btnImport.style.display = 'none';
  ['clienteNome', 'clienteAdultos', 'clienteCriancas'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.readOnly = true; el.style.cssText = 'background:#f1f5f9; cursor:not-allowed'; }
  });
  const btnEditarCot = document.getElementById('btnEditarClienteCotacao');
  if(btnEditarCot) btnEditarCot.innerHTML = '👤 Editar Cliente';

  state.orcamento.cliente.nome = nome;
  state.orcamento.cliente.adultos = cliente.adultos || '2';
  state.orcamento.cliente.criancas = cliente.criancas || '0';
  state.orcamento.nome = 'Cotação - ' + nome;
  
  fetch(`/api/clientes/local/${clienteId}`).then(r=>r.json()).then(d => {
    state.orcamento.estadias = JSON.parse(JSON.stringify(d.estadias || []));
    if (typeof renderEstadiasReadOnlyForm === 'function') renderEstadiasReadOnlyForm();
  }).catch(e => {
    console.error(e);
  }).finally(() => {
    document.getElementById('orcamentosEmptyState').style.display = 'none';
    document.getElementById('orcamentosPreviewWrapper').style.display = 'none';
    document.getElementById('orcamentosEditorWrapper').style.display = 'block';
    if (typeof updateResumo === 'function') updateResumo();
  });
};

window.renderPreviewOrcamentoNoElemento = function(orcId, element) {
  const orc = state.orcamentosDB.find(o => String(o.id) === String(orcId));
  if (!orc || !element) return;
  
  const originalOrcamento = state.orcamento;
  state.orcamento = JSON.parse(JSON.stringify(orc));
  
  const tempInline = document.getElementById('previewContainerInline');
  if (tempInline) {
    tempInline.removeAttribute('id');
  }
  
  element.setAttribute('id', 'previewContainerInline');
  
  try {
    renderPreview();
  } finally {
    element.removeAttribute('id');
    if (tempInline) {
      tempInline.setAttribute('id', 'previewContainerInline');
    }
    state.orcamento = originalOrcamento;
  }
};

window.alternarStatusPortalCliente = async function(id, novoStatus) {
  const msg = novoStatus 
    ? 'Deseja reativar o acesso ao Portal do Cliente? O link voltará a funcionar normalmente.' 
    : 'Deseja desativar o acesso ao Portal do Cliente? O link parará de funcionar imediatamente para este cliente.';
  
  if (!confirm(msg)) return;

  try {
    const res = await fetch(`/api/clientes/${id}/portal-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativo: novoStatus })
    });
    const text = await res.text();
    let d = {};
    try {
      d = JSON.parse(text);
    } catch (parseErr) {
      throw new Error('O servidor Node precisa ser reiniciado para carregar a nova rota do backend. Por favor, feche e abra o arquivo .bat.');
    }
    if (!d.success) throw new Error(d.error || 'Erro ao alterar status do portal');

    if (typeof showToast === 'function') {
      showToast(`Acesso ao portal ${novoStatus ? 'reativado' : 'desativado'} com sucesso!`);
    } else {
      alert(`Acesso ao portal ${novoStatus ? 'reativado' : 'desativado'} com sucesso!`);
    }
    
    if (typeof window.abrirDetalhesCliente === 'function') {
      window.abrirDetalhesCliente(id);
    }
  } catch (e) {
    alert('Erro: ' + e.message);
  }
};
