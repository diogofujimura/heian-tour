// ── MÓDULO: EMAILS (formulário dinâmico de e-mails do cliente) ──
// Extraído de app.js em 2026-07-28 (Fatia 6 do fatiamento seguro). Carregado APÓS app.js.
// Só funções globais; sem estado próprio. Carrega também `syncHoteisNotion` + o registro do
// listener do botão #btnSyncHoteisNotion (a função é definida ANTES do registro, no mesmo bloco).

// ── EMAILS (Formulário dinâmico) ─────────────────────────────────────────────
function renderEmailsForm() {
  const cont = document.getElementById('emailsList');
  if(!cont) return;
  cont.innerHTML = '';
  currentEditingEmails.forEach((em, i) => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex; gap:8px; align-items:center; margin-bottom:6px;';
    const label = i === 0 ? 'E-mail principal (responsável)' : `E-mail ${i+1}`;
    div.innerHTML = `
      <div class="field" style="flex:1; margin-bottom:0;"><label style="font-size:10px;">${label}</label><input type="email" value="${em.email}" placeholder="email@exemplo.com" oninput="updEmail(${em.id},this.value)"></div>
      <button class="btn-remove" onclick="rmEmail(${em.id})" style="margin-top:14px;">✕</button>`;
    cont.appendChild(div);
  });
}

window.rmEmail = function(id) { currentEditingEmails = currentEditingEmails.filter(e => e.id !== id); renderEmailsForm(); };
window.updEmail = function(id, v) { const e = currentEditingEmails.find(x => x.id === id); if (e) e.email = v; };

window.obterCoresStatus = function(status) {
  const s = (status || 'Início/call de dúvidas').toLowerCase();
  if (s.includes('dúvida') || s.includes('duvida')) return { color: '#787878', bg: 'rgba(120, 120, 120, 0.08)', border: 'rgba(120, 120, 120, 0.2)' };
  if (s.includes('negociação') || s.includes('negociacao')) {
    if (s.includes('aprovada')) return { color: '#0284c7', bg: 'rgba(2, 132, 199, 0.08)', border: 'rgba(2, 132, 199, 0.2)' };
    return { color: '#64748b', bg: 'rgba(100, 116, 139, 0.08)', border: 'rgba(100, 116, 139, 0.2)' };
  }
  if (s.includes('rascunho')) return { color: '#db2777', bg: 'rgba(219, 39, 119, 0.08)', border: 'rgba(219, 39, 119, 0.2)' };
  if (s.includes('versão final') || s.includes('versao final')) return { color: '#ea580c', bg: 'rgba(234, 88, 12, 0.08)', border: 'rgba(234, 88, 12, 0.2)' };
  if (s.includes('viagem')) return { color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.08)', border: 'rgba(124, 58, 237, 0.2)' };
  if (s.includes('cancelado')) return { color: '#dc2626', bg: 'rgba(220, 38, 38, 0.08)', border: 'rgba(220, 38, 38, 0.2)' };
  if (s.includes('finalizados') || s.includes('finalizado')) return { color: '#16a34a', bg: 'rgba(22, 163, 74, 0.08)', border: 'rgba(22, 163, 74, 0.2)' };
  if (s.includes('pós') || s.includes('pos')) return { color: '#b45309', bg: 'rgba(180, 83, 9, 0.08)', border: 'rgba(180, 83, 9, 0.2)' };
  
  return { color: '#9c8248', bg: 'rgba(196, 163, 90, 0.08)', border: 'rgba(196, 163, 90, 0.2)' };
};

async function loadClientesTabela() {
  const tbody = document.querySelector('#clientesTable tbody');
  if(tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px;">Atualizando do Notion...</td></tr>';
  
  try {
    const res = await fetch('/api/notion/clientes?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('Erro na API');
    notionClients = await res.json(); window.notionClients = notionClients;
    renderClientesTabela();
    if (typeof renderDashboard === 'function') renderDashboard();
  } catch(e) {
    console.error(e);
    if(tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 20px; color: red;">Erro ao carregar clientes do Notion.</td></tr>';
  }
}

function renderClientesTabela() {
  const listContainer = document.getElementById('tabelaClientesList');
  if(!listContainer) return;
  
  const selectFiltro = document.getElementById('filtroMesAnoClientes');
  if (selectFiltro && (selectFiltro.options.length <= 1 || selectFiltro.dataset.loadedCount != notionClients.length)) {
    selectFiltro.dataset.loadedCount = notionClients.length;
    const selectedValue = selectFiltro.value;
    
    const getMesAnoStr = (dateStr) => {
      if (!dateStr) return null;
      const parts = dateStr.split('-');
      if (parts.length < 2) return null;
      const year = parts[0];
      const monthIdx = parseInt(parts[1]) - 1;
      const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      if (monthIdx < 0 || monthIdx > 11) return null;
      return `${months[monthIdx]}/${year}`;
    };
    
    const periodos = [];
    const chavesPeriodos = new Set();
    notionClients.forEach(c => {
      if (c.dataInicio) {
        const parts = c.dataInicio.split('-');
        if (parts.length >= 2) {
          const key = `${parts[0]}-${parts[1]}`;
          if (!chavesPeriodos.has(key)) {
            chavesPeriodos.add(key);
            periodos.push({ key, label: getMesAnoStr(c.dataInicio) });
          }
        }
      }
    });
    
    periodos.sort((a, b) => a.key.localeCompare(b.key));
    
    selectFiltro.innerHTML = '<option value="">Todos os meses</option>';
    periodos.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.key;
      opt.textContent = p.label;
      selectFiltro.appendChild(opt);
    });
    
    selectFiltro.value = selectedValue;
    if (selectFiltro.value !== selectedValue) {
      selectFiltro.value = "";
    }
  }
  
  const termoNome = (document.getElementById('pesquisaClientesList')?.value || '').toLowerCase();
  const filtroMesAno = selectFiltro ? selectFiltro.value : '';
  
  const clientesFiltrados = notionClients.filter(c => {
    const matchNome = (c.nome || '').toLowerCase().includes(termoNome) || (c.email || '').toLowerCase().includes(termoNome);
    
    let matchMesAno = true;
    if (filtroMesAno) {
      if (c.dataInicio) {
        matchMesAno = c.dataInicio.startsWith(filtroMesAno);
      } else {
        matchMesAno = false;
      }
    }
    
    return matchNome && matchMesAno;
  });

  listContainer.innerHTML = '';

  if(clientesFiltrados.length === 0) {
    listContainer.innerHTML = '<div style="text-align: center; padding: 20px; color:#999;">Nenhum cliente encontrado.</div>';
    return;
  }
  
  clientesFiltrados.forEach(c => {
    const coresStatus = window.obterCoresStatus(c.status);
    const isSelected = window.clienteAtualVisualizado === c.id ? 'selected' : '';

    const card = document.createElement('div');
    card.className = 'list-card ' + isSelected;
    card.dataset.id = c.id;
    card.onclick = () => abrirDetalhesCliente(c.id);
    
    let datasViagem = 'Sem data';
    if (c.dataInicio && c.dataFim) {
      datasViagem = `${fmtDataBR(c.dataInicio)} a ${fmtDataBR(c.dataFim)}`;
    } else if (c.dataInicio) {
      datasViagem = `${fmtDataBR(c.dataInicio)}`;
    }

    let passageiros = '';
    if (c.viajantes) {
      const lines = c.viajantes.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 0) {
        let ad = 0, cr = 0;
        lines.forEach(line => {
          const match = line.match(/\((\d+)\)$/);
          if (match) {
            const idade = parseInt(match[1]);
            if (idade < 12) cr++;
            else ad++;
          } else {
            ad++; // padrão
          }
        });
        passageiros = `${lines.length} viajante(s)`;
        if (ad > 0 || cr > 0) {
          const parts = [];
          if (ad > 0) parts.push(`${ad} Ad`);
          if (cr > 0) parts.push(`${cr} Cr`);
          passageiros += ` (${parts.join(', ')})`;
        }
        passageiros = `${passageiros}`;
      }
    }
    
    if (!passageiros) {
      let ad = parseInt(c.adultos) || 0;
      let cr = parseInt(c.criancas) || 0;
      if (ad > 0 || cr > 0) {
        const parts = [];
        if (ad > 0) parts.push(`${ad} Ad`);
        if (cr > 0) parts.push(`${cr} Cr`);
        passageiros = `${parts.join(', ')}`;
      } else {
        passageiros = 'Sem passageiros';
      }
    }

    card.innerHTML = `
      <div class="list-card-title-row" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
        <div class="list-card-title" style="color:var(--crimson); font-weight: 600; margin-bottom: 0;">${c.nome}</div>
        <button class="btn-card-edit-minimalist" onclick="event.stopPropagation(); editarClienteCard('${c.id}')" title="Editar">
          <svg class="v-icon no-margin"><use href="#icon-edit"></use></svg>
        </button>
      </div>
      <div class="list-card-subtitle" style="margin-top: 4px; font-size: 11px; color: var(--ink-lt); display: flex; gap: 8px; flex-wrap: wrap;">
        <span>${datasViagem}</span>
        <span>·</span>
        <span>${passageiros}</span>
      </div>
      <div class="list-card-meta" style="margin-top: 8px; font-size: 11px; display: flex; justify-content: space-between; align-items: center;">
        <span style="color:${coresStatus.color}; font-weight:600; background: ${coresStatus.bg}; border: 1px solid ${coresStatus.border}; padding: 2px 6px; border-radius: 4px;">${c.status || 'Novo'}</span>
      </div>
    `;
    listContainer.appendChild(card);
  });
}
function abrirClienteModal(cliente = null) {
  
  document.getElementById('clientesEmptyState').style.display = 'none';
  document.getElementById('clientesDetailWrapper').style.display = 'block';
  document.getElementById('clientesPreviewContainer').style.display = 'none';
  document.getElementById('clientesEditorContainer').style.display = 'block';
  window.mostrarDetailMobile('page-clientes');

  // Configurar input dinâmico de iniciais ao digitar
  const mcNomeInput = document.getElementById('mcNome');
  if (mcNomeInput) {
    mcNomeInput.oninput = () => {
      if (!editFotoPerfilBase64) {
        const previewCont = document.getElementById('mcFotoPerfilPreview');
        if (previewCont) {
          previewCont.innerHTML = window.obterAvatarFallbackHTML(mcNomeInput.value);
        }
      }
    };
  }

  if(cliente) {
    currentEditingClienteId = cliente.id;
    document.getElementById('modalClienteTitle').innerText = 'Editar Cliente';
    document.getElementById('mcNome').value = cliente.nome || '';
    document.getElementById('mcStatus').value = cliente.status || 'Início/call de dúvidas';
    document.getElementById('mcDataInicio').value = cliente.dataInicio || '';
    document.getElementById('mcDataFim').value = cliente.dataFim || '';

    // Voo separado (num + hora)
    const elChegadaNum = document.getElementById('mcVooChegadaNum');
    const elChegadaHora = document.getElementById('mcVooChegadaHora');
    const elPartidaNum = document.getElementById('mcVooPartidaNum');
    const elPartidaHora = document.getElementById('mcVooPartidaHora');
    if (elChegadaNum) elChegadaNum.value = cliente.vooChegadaNum || '';
    if (elChegadaHora) elChegadaHora.value = cliente.vooChegadaHora || '';
    if (elPartidaNum) elPartidaNum.value = cliente.vooPartidaNum || '';
    if (elPartidaHora) elPartidaHora.value = cliente.vooPartidaHora || '';

    // Fallback: se não tem campos separados mas tem o campo legado combinado
    if (!cliente.vooChegadaNum && cliente.vooChegada) {
      if (cliente.vooChegada.includes('|')) {
        const parts = cliente.vooChegada.split('|').map(s => s.trim());
        if (elChegadaNum) elChegadaNum.value = parts[0] || '';
        if (elChegadaHora) elChegadaHora.value = parts[1] || '';
      } else {
        if (elChegadaNum) elChegadaNum.value = cliente.vooChegada;
      }
    }
    if (!cliente.vooPartidaNum && cliente.vooPartida) {
      if (cliente.vooPartida.includes('|')) {
        const parts = cliente.vooPartida.split('|').map(s => s.trim());
        if (elPartidaNum) elPartidaNum.value = parts[0] || '';
        if (elPartidaHora) elPartidaHora.value = parts[1] || '';
      } else {
        if (elPartidaNum) elPartidaNum.value = cliente.vooPartida;
      }
    }

    const estadiasListEl = document.getElementById('estadiasList');
    if (estadiasListEl) {
      estadiasListEl.innerHTML = '<p class="hint" style="margin:10px 0;">Carregando estadias atualizadas...</p>';
    }

    let estadiasCarregadasNoEditor = false;
    fetch(`/api/clientes/local/${cliente.id}?t=${Date.now()}`, { cache: 'no-store' }).then(async r => {
      if (!r.ok) {
        const erro = await r.json().catch(() => ({}));
        throw new Error(erro.error || `Falha ao carregar estadias (${r.status})`);
      }
      return r.json();
    }).then(d => {
      currentEditingEstadias = (Array.isArray(d.estadias) ? d.estadias : []).map(e => {
        const toISO = str => {
          if (!str) return '';
          if (str.includes('/')) {
            const p = str.split('/');
            if (p.length === 3) return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
          }
          return str;
        };
        return {
          ...e,
          dataInicio: toISO(e.dataInicio),
          dataFim: toISO(e.dataFim)
        };
      });
      currentEditingVouchers = Array.isArray(d.vouchers) ? d.vouchers : [];
      if (!d._temRegistroLocal && cliente.hotel) {
        cliente.hotel.split('\n').filter(l => l.trim()).forEach(line => {
          let cidade = ''; let hotel = line.trim(); let dataInicio = ''; let dataFim = '';
          const dateMatch = line.match(/\((?:(\d{2}\/\d{2}\/\d{4})|(\d{4}-\d{2}-\d{2}))\s*(?:a|-|até)\s*(?:(\d{2}\/\d{2}\/\d{4})|(\d{4}-\d{2}-\d{2}))\)/i);
          if (dateMatch) {
            const d1 = dateMatch[1] || dateMatch[2];
            const d2 = dateMatch[3] || dateMatch[4];
            const parseToISO = dStr => {
              if (!dStr) return '';
              if (dStr.includes('/')) {
                const p = dStr.split('/');
                return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
              }
              return dStr;
            };
            dataInicio = parseToISO(d1);
            dataFim = parseToISO(d2);
            hotel = line.substring(0, dateMatch.index).trim();
          }
          const dashIndex = hotel.indexOf(' - ');
          if (dashIndex > -1) {
            cidade = hotel.substring(0, dashIndex).trim();
            hotel = hotel.substring(dashIndex + 3).trim();
          }
          currentEditingEstadias.push({ id: 'estadia_' + Date.now() + Math.random(), cidade, dataInicio, dataFim, hotel });
        });
      }
      renderEstadiasForm();
      estadiasCarregadasNoEditor = true;

      // Viajantes: tentar local primeiro, fallback do Notion
      currentEditingViajantes = Array.isArray(d.viajantes) ? d.viajantes : [];
      const viajantesTextoLegado = typeof d.viajantes === 'string' && d.viajantes.trim()
        ? d.viajantes
        : cliente.viajantes;
      if (currentEditingViajantes.length === 0 && viajantesTextoLegado) {
        viajantesTextoLegado.split('\n').filter(l => l.trim()).forEach(line => {
          const text = line.trim();
          const ageMatch = text.match(/\((\d+)\)$/);
          let idade = '';
          let namePart = text;
          if (ageMatch) {
            idade = ageMatch[1];
            namePart = text.substring(0, ageMatch.index).trim();
          }
          const parts = namePart.split(/\s+/);
          const sobrenome = parts.length > 1 ? parts.pop() : '';
          currentEditingViajantes.push({ id: Date.now() + Math.random(), nome: parts.join(' '), sobrenome, idade });
        });
      }
      renderViajantesForm();

      // Emails: tentar local primeiro, fallback do Notion
      currentEditingEmails = Array.isArray(d.emails) ? d.emails : [];
      const emailsTextoLegado = typeof d.emails === 'string' && d.emails.trim()
        ? d.emails
        : cliente.email;
      if (currentEditingEmails.length === 0 && emailsTextoLegado) {
        emailsTextoLegado.split('\n').filter(l => l.trim()).forEach(line => {
          currentEditingEmails.push({ id: Date.now() + Math.random(), email: line.trim() });
        });
      }
      renderEmailsForm();

      // Foto de perfil
      editFotoPerfilBase64 = d.fotoPerfil || "";
      const previewCont = document.getElementById('mcFotoPerfilPreview');
      const btnRemover = document.getElementById('mcBtnRemoverFoto');
      if (previewCont) {
        if (editFotoPerfilBase64) {
          previewCont.innerHTML = `<img src="${editFotoPerfilBase64}" style="width:100%; height:100%; object-fit:cover;">`;
          if (btnRemover) btnRemover.style.display = 'inline-block';
        } else {
          previewCont.innerHTML = window.obterAvatarFallbackHTML(cliente.nome || "");
          if (btnRemover) btnRemover.style.display = 'none';
        }
      }

      // Perfil & Preferencias (camada nova): injeta a secao e preenche com o que esta salvo
      try { if (window.HeianPerfil) window.HeianPerfil.carregar(d.preferencias || {}); } catch (e) {}

      formatHubButtons();
    }).catch(e => {
      console.error(e); 
      if (!estadiasCarregadasNoEditor) currentEditingEstadias = [];
      currentEditingViajantes = [];
      currentEditingVouchers = [];
      currentEditingEmails = [];
      editFotoPerfilBase64 = "";
      if (!estadiasCarregadasNoEditor && cliente.hotel) {
        cliente.hotel.split('\n').filter(l => l.trim()).forEach(line => {
          let cidade = ''; let hotel = line.trim(); let dataInicio = ''; let dataFim = '';
          const dateMatch = line.match(/\((\d{2}\/\d{2}\/\d{4})\s*(?:a|-|até)\s*(\d{2}\/\d{2}\/\d{4})\)/);
          if (dateMatch) {
            const parseDate = d => { const p = d.split('/'); return p[2]+'-'+p[1]+'-'+p[0]; };
            dataInicio = parseDate(dateMatch[1]); dataFim = parseDate(dateMatch[2]);
            hotel = line.substring(0, dateMatch.index).trim();
          }
          const dashIndex = hotel.indexOf(' - ');
          if (dashIndex > -1) { cidade = hotel.substring(0, dashIndex).trim(); hotel = hotel.substring(dashIndex + 3).trim(); }
          currentEditingEstadias.push({ id: Date.now() + Math.random(), cidade, dataInicio, dataFim, hotel });
        });
      }
      if (cliente.viajantes) {
        cliente.viajantes.split('\n').filter(l => l.trim()).forEach(line => {
          const text = line.trim();
          const ageMatch = text.match(/\((\d+)\)$/);
          let idade = '';
          let namePart = text;
          if (ageMatch) {
            idade = ageMatch[1];
            namePart = text.substring(0, ageMatch.index).trim();
          }
          const parts = namePart.split(/\s+/);
          const sobrenome = parts.length > 1 ? parts.pop() : '';
          currentEditingViajantes.push({ id: Date.now() + Math.random(), nome: parts.join(' '), sobrenome, idade });
        });
      }
      if (cliente.email) {
        cliente.email.split('\n').filter(l => l.trim()).forEach(line => {
          currentEditingEmails.push({ id: Date.now() + Math.random(), email: line.trim() });
        });
      }
      renderEstadiasForm();
      renderViajantesForm();
      renderEmailsForm();

      const previewCont = document.getElementById('mcFotoPerfilPreview');
      if (previewCont) {
        previewCont.innerHTML = window.obterAvatarFallbackHTML(cliente.nome || "");
      }
      const btnRemover = document.getElementById('mcBtnRemoverFoto');
      if (btnRemover) btnRemover.style.display = 'none';
      const estadiasListEl = document.getElementById('estadiasList');
      if (!estadiasCarregadasNoEditor && estadiasListEl) {
        estadiasListEl.innerHTML = `<p class="hint" style="margin:10px 0; color:#a12f3f;">Não foi possível carregar as estadias atualizadas: ${e.message}</p>`;
      }
    });
  } else {
    currentEditingClienteId = null;
    editFotoPerfilBase64 = "";
    document.getElementById('modalClienteTitle').innerText = 'Novo Cliente';
    document.getElementById('mcNome').value = '';
    document.getElementById('mcStatus').value = 'Início/call de dúvidas';
    document.getElementById('mcDataInicio').value = '';
    document.getElementById('mcDataFim').value = '';
    const elChegadaNum = document.getElementById('mcVooChegadaNum');
    const elChegadaHora = document.getElementById('mcVooChegadaHora');
    const elPartidaNum = document.getElementById('mcVooPartidaNum');
    const elPartidaHora = document.getElementById('mcVooPartidaHora');
    if (elChegadaNum) elChegadaNum.value = '';
    if (elChegadaHora) elChegadaHora.value = '';
    if (elPartidaNum) elPartidaNum.value = '';
    if (elPartidaHora) elPartidaHora.value = '';
    currentEditingEstadias = [];
    currentEditingViajantes = [];
    currentEditingEmails = [];
    currentEditingVouchers = [];
    renderEstadiasForm();
    renderViajantesForm();
    renderEmailsForm();

    const previewCont = document.getElementById('mcFotoPerfilPreview');
    if (previewCont) {
      previewCont.innerHTML = `<span>HT</span>`;
    }
    const btnRemover = document.getElementById('mcBtnRemoverFoto');
    if (btnRemover) btnRemover.style.display = 'none';

    formatHubButtons();
  }
}

window.closeClienteModal = function() {
  if (window.clienteAtualVisualizado) {
    document.getElementById('clientesPreviewContainer').style.display = 'block';
    document.getElementById('clientesEditorContainer').style.display = 'none';
    abrirDetalhesCliente(window.clienteAtualVisualizado);
  } else {
    document.getElementById('clientesEmptyState').style.display = 'block';
    document.getElementById('clientesDetailWrapper').style.display = 'none';
  }
}

window.editarClienteNotion = async function(id) {
    if (!notionClients || notionClients.length === 0) {
      try {
        const res = await fetch('/api/notion/clientes?t=' + Date.now(), { cache: 'no-store' });
        notionClients = await res.json(); window.notionClients = notionClients;
      } catch (e) {
        console.error('Erro ao carregar clientes do Notion:', e);
      }
    }
    const c = notionClients.find(x => x.id === id);
    if(c) {
      window.clienteAtualVisualizado = id;
      if (typeof navToPage === 'function') navToPage('clientes');
      if (typeof renderClientesTabela === 'function') renderClientesTabela();
      abrirClienteModal(c);
    }
    else alert('Cliente não encontrado no Notion.');
  }

async function salvarClienteNotion() {
  // Calcular adultos/crianças a partir dos viajantes
  let adultos = 0, criancas = 0;
  currentEditingViajantes.forEach(v => {
    const idade = parseInt(v.idade);
    if (isNaN(idade) || idade >= 12) adultos++;
    else criancas++;
  });
  // Se não há viajantes, default adultos=2
  if (currentEditingViajantes.length === 0) { adultos = 2; criancas = 0; }

  const vooChegadaNum = (document.getElementById('mcVooChegadaNum')?.value || '').trim();
  const vooChegadaHora = (document.getElementById('mcVooChegadaHora')?.value || '').trim();
  const vooPartidaNum = (document.getElementById('mcVooPartidaNum')?.value || '').trim();
  const vooPartidaHora = (document.getElementById('mcVooPartidaHora')?.value || '').trim();

  // Serializar viajantes para Notion: "Nome Sobrenome (Idade)" por linha
  const viajantesStr = currentEditingViajantes.map(v => {
    let txt = v.nome || '';
    if (v.sobrenome) txt += ' ' + v.sobrenome;
    if (v.idade) txt += ` (${v.idade})`;
    return txt.trim();
  }).filter(Boolean).join('\n');

  // Serializar emails para Notion: um por linha
  const emailsStr = currentEditingEmails.map(e => e.email).filter(Boolean).join('\n');

  const payload = {
    nome: document.getElementById('mcNome').value.trim(),
    status: document.getElementById('mcStatus').value,
    adultos,
    criancas,
    vooChegadaNum,
    vooChegadaHora,
    vooPartidaNum,
    vooPartidaHora,
    dataInicio: document.getElementById('mcDataInicio').value,
    dataFim: document.getElementById('mcDataFim').value,
    viajantes: viajantesStr,
    email: emailsStr
  };
  
  if(!payload.nome) return alert('Nome é obrigatório');
  
  const btn = document.getElementById('btnSalvarClienteModal');
  btn.innerText = 'Salvando e sincronizando...';
  btn.disabled = true;
  
  try {
    const hoteisStr = currentEditingEstadias.map(e => {
      let txt = e.cidade || 'S/N';
      if (e.hotel) txt += ` - ${e.hotel}`;
      
      let d1 = e.dataInicio ? e.dataInicio.split('-').reverse().join('/') : '';
      let d2 = e.dataFim ? e.dataFim.split('-').reverse().join('/') : '';
      let dates = (d1 && d2) ? ` (${d1} a ${d2})` : (d1 || d2 ? ` (${d1||d2})` : '');
      
      return txt + dates;
    }).join('\n');
    payload.hotel = hoteisStr;

    const urlUnificada = currentEditingClienteId ? `/api/clientes/${currentEditingClienteId}` : '/api/clientes';
    const methodUnificado = currentEditingClienteId ? 'PATCH' : 'POST';

    // Perfil & Preferencias (camada nova): inclui as preferencias e as colunas no salvar
    const _perfil = (window.HeianPerfil ? window.HeianPerfil.coletar() : null);
    if (_perfil && _perfil.colunas) {
      if (_perfil.colunas.profissoes !== undefined) payload.profissoes = _perfil.colunas.profissoes;
      if (_perfil.colunas.ocasiaoEspecial !== undefined) payload.ocasiaoEspecial = _perfil.colunas.ocasiaoEspecial;
      if (_perfil.colunas.necessidadesEspeciais !== undefined) payload.necessidadesEspeciais = _perfil.colunas.necessidadesEspeciais;
      if (_perfil.colunas.observacoes !== undefined) payload.observacoes = _perfil.colunas.observacoes;
    }

    const res = await fetch(urlUnificada, {
      method: methodUnificado,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notionPayload: payload,
        localPayload: {
          nome: payload.nome,
          estadias: currentEditingEstadias,
          viajantes: currentEditingViajantes,
          emails: currentEditingEmails,
          fotoPerfil: editFotoPerfilBase64,
          vouchers: currentEditingVouchers,
          preferencias: (_perfil ? _perfil.preferencias : undefined)
        }
      })
    });
    
    if (!res.ok) {
      const errInfo = await res.json();
      throw new Error(errInfo.error || errInfo.message || 'Falha ao salvar dados unificados do cliente');
    }

    const data = await res.json();
    const cliId = data.id || currentEditingClienteId;
    currentEditingClienteId = cliId;

    const assinaturaEstadias = lista => (Array.isArray(lista) ? lista : []).map(e => ({
      id: String(e.id || ''),
      cidade: String(e.cidade || '').trim(),
      hotel: String(e.hotel || '').trim(),
      dataInicio: String(e.dataInicio || ''),
      dataFim: String(e.dataFim || '')
    }));
    const confirmacaoRes = await fetch(`/api/clientes/local/${cliId}?t=${Date.now()}`, { cache: 'no-store' });
    if (!confirmacaoRes.ok) throw new Error('O servidor salvou, mas não consegui confirmar a ficha atualizada.');
    const confirmacaoLocal = await confirmacaoRes.json();
    const esperado = JSON.stringify(assinaturaEstadias(currentEditingEstadias));
    const persistido = JSON.stringify(assinaturaEstadias(confirmacaoLocal.estadias));
    if (esperado !== persistido) {
      throw new Error('A conferência detectou que as estadias não foram persistidas. Nada foi confirmado como salvo.');
    }
    currentEditingEstadias = Array.isArray(confirmacaoLocal.estadias)
      ? JSON.parse(JSON.stringify(confirmacaoLocal.estadias))
      : [];
    
    window.clienteAtualVisualizado = cliId;
    await loadClientesTabela(); // Recarrega a lista
    
    // Mostra o preview atualizado diretamente
    abrirDetalhesCliente(cliId);
    
    if (typeof syncClienteAtivo === 'function') {
        await syncClienteAtivo(cliId);
    }

    alert('Cliente salvo e hospedagens sincronizadas com sucesso!');
  } catch(e) {
    console.error(e);
    alert('Erro ao salvar e sincronizar: ' + e.message);
  } finally {
    btn.innerText = 'Salvar alterações';
    btn.disabled = false;
  }
}

window.syncHoteisNotion = async function() {
  if (!state.orcamento.notionClienteId) {
    alert('Esta cotação não está vinculada a um cliente do Notion. Selecione o cliente em "Importar do Notion" acima.');
    return;
  }
  
  if (state.orcamento.estadias.length === 0) {
    alert('Nenhuma estadia adicionada na cotação.');
    return;
  }

  const btn = document.getElementById('btnSyncHoteisNotion');
  const oldText = btn.innerText;
  btn.innerText = 'Enviando...';
  btn.disabled = true;

  try {
    const hoteisStr = state.orcamento.estadias.map(e => {
      let txt = e.cidade;
      if (e.hotel) txt += ` - ${e.hotel}`;
      return txt;
    }).join('\n');

    const res = await fetch(`/api/notion/clientes/${state.orcamento.notionClienteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hotel: hoteisStr })
    });

    if (!res.ok) throw new Error('Falha na API Notion');
    alert('Hotéis atualizados com sucesso no Notion!');
  } catch (err) {
    console.error(err);
    alert('Erro ao sincronizar: ' + err.message);
  } finally {
    btn.innerText = oldText;
    btn.disabled = false;
  }
};

document.getElementById('btnSyncHoteisNotion')?.addEventListener('click', window.syncHoteisNotion);
