
window.formatPeriodo = function(d1, d2) {
    if (!d1 && !d2) return '';
    const f1 = d1 ? d1.split('-').reverse().slice(0, 2).join('/') : '';
    const f2 = d2 ? d2.split('-').reverse().slice(0, 2).join('/') : '';
    if (f1 && f2) return f1 + ' a ' + f2;
    return f1 || f2;
};

window.normalizarNome = function(nome) {
  if (!nome) return '';
  return nome.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/museum/g, 'museu')
    .replace(/tokyo/g, 'toquio')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

window.verificarSimilaridade = function(nome1, nome2, taxaMinima = 0.75) {
  const n1 = window.normalizarNome(nome1);
  const n2 = window.normalizarNome(nome2);
  
  if (n1 === n2) return true;
  
  const palavras1 = n1.split(' ').filter(Boolean);
  const palavras2 = n2.split(' ').filter(Boolean);
  
  if (palavras1.length === 0 || palavras2.length === 0) return false;
  
  const todas1em2 = palavras1.every(p => palavras2.includes(p));
  const todas2em1 = palavras2.every(p => palavras1.includes(p));
  
  if (todas1em2 && todas2em1) return true;
  
  const ignorar = ['de', 'do', 'da', 'o', 'a', 'e', 'em'];
  const p1Filtradas = palavras1.filter(p => !ignorar.includes(p));
  const p2Filtradas = palavras2.filter(p => !ignorar.includes(p));
  
  if (p1Filtradas.length > 0 && p2Filtradas.length > 0) {
    const intersec = p1Filtradas.filter(p => p2Filtradas.includes(p));
    const taxa1 = intersec.length / p1Filtradas.length;
    const taxa2 = intersec.length / p2Filtradas.length;
    if (taxa1 >= taxaMinima || taxa2 >= taxaMinima) return true;
  }
  
  return false;
};

window.buscarAtracaoNoMapa = function(nome) {
  if (!nome) return null;
  if (typeof atracaoMap === 'undefined') return null;
  const nomeLower = nome.toLowerCase().trim();
  if (atracaoMap.has(nomeLower)) {
    return atracaoMap.get(nomeLower);
  }
  
  // 1º passo: Match perfeito de palavras (100%, ordem indiferente)
  let match = Array.from(atracaoMap.values()).find(a => window.verificarSimilaridade(a['Nome da Atração'], nome, 1.0));
  
  // 2º passo: Match parcial (75%)
  if (!match) {
    match = Array.from(atracaoMap.values()).find(a => window.verificarSimilaridade(a['Nome da Atração'], nome, 0.75));
  }
  
  return match;
};

window.verificarFuncionamentoAtracao = function(nome, dataStr) {
  if (!dataStr || !nome) return { fechado: false };
  
  let list = [];
  if (typeof state !== 'undefined' && state.atracoesDB) {
    list = state.atracoesDB;
  } else if (typeof dbAtracoes !== 'undefined') {
    list = dbAtracoes;
  }
  
  if (!list || list.length === 0) return { fechado: false };
  
  // 1º passo: Match perfeito de palavras (100%, ordem indiferente)
  let atracao = list.find(a => window.verificarSimilaridade(a['Nome da Atração'], nome, 1.0));
  
  // 2º passo: Match parcial (75%)
  if (!atracao) {
    atracao = list.find(a => window.verificarSimilaridade(a['Nome da Atração'], nome, 0.75));
  }
  
  if (!atracao) return { fechado: false };
  
  // 1) Checagem de Manutenção/Reforma
  if (atracao.manutencaoInicio && atracao.manutencaoFim) {
    if (dataStr >= atracao.manutencaoInicio && dataStr <= atracao.manutencaoFim) {
      return { 
        fechado: true, 
        tipoBloqueio: 'manutencao', 
        motivo: atracao.manutencaoMotivo || 'Fechado para manutenção/reforma',
        inicio: atracao.manutencaoInicio,
        fim: atracao.manutencaoFim
      };
    }
  }
  
  // 2) Checagem de Dia da Semana Recorrente
  if (atracao.diasFechados && Array.isArray(atracao.diasFechados) && atracao.diasFechados.length > 0) {
    const [yy, mm, dd] = dataStr.split('-').map(Number);
    const dateObj = new Date(yy, mm - 1, dd);
    const dayOfWeek = dateObj.getDay(); // 0 = Dom, 1 = Seg, etc.
    
    if (atracao.diasFechados.includes(dayOfWeek)) {
      const diasSemanaNomes = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
      return {
        fechado: true,
        tipoBloqueio: 'semanal',
        diaSemanaNome: diasSemanaNomes[dayOfWeek]
      };
    }
  }
  
  return { fechado: false };
};



let _autoSaveRoteiroTimer = null;
window.autoSaveRoteiro = function() {
  if (!roteiroEmEdicao || !roteiroEmEdicao.dias || roteiroEmEdicao.dias.length === 0) return;
  clearTimeout(_autoSaveRoteiroTimer);
  
  const indicator = document.getElementById('roteiroAutoSaveIndicator');
  if (indicator) {
    indicator.textContent = 'Salvando...';
    indicator.style.opacity = '1';
  }

  _autoSaveRoteiroTimer = setTimeout(async () => {
    const nomeAtual = document.getElementById('editRoteiroNome')?.value.trim();
    const nameToSave = window.roteiroOriginalNome || nomeAtual;
    if (!nameToSave) return;
    
    try {
      const res = await fetch(`/api/roteiros/${encodeURIComponent(nameToSave)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roteiroEmEdicao)
      });
      if (res.ok) {
        dbRotas[nameToSave] = roteiroEmEdicao;
        if (indicator) { 
           indicator.textContent = 'Salvo automaticamente'; 
           setTimeout(() => { if(indicator && indicator.textContent==='Salvo automaticamente') indicator.style.opacity = '0.4'; }, 2000);
        }
      } else {
        if (indicator) indicator.textContent = 'Erro ao salvar';
      }
    } catch(err) {
      console.error('AutoSave Roteiro Error:', err);
      if (indicator) indicator.textContent = 'Erro de conexão';
    }
  }, 1500);
};
function migrarDiaParaNovaEstrutura(dia) {
  if (!dia) return { tourGuiado: false, elementos: [] };
  if (dia.elementos) return dia;
  const novoDia = { tourGuiado: dia.tourGuiado || false, elementos: [] };
  if (dia.dataDoTour || dia.horarioEncontro || dia.localEncontro || !dia.blocos) {
    novoDia.elementos.push({
      tipo: 'info',
      dataDoTour: dia.dataDoTour || '',
      horarioEncontro: dia.horarioEncontro || '',
      localEncontro: dia.localEncontro || ''
    });
  }
  if (dia.blocos) {
    dia.blocos.forEach(b => {
      novoDia.elementos.push({
        tipo: 'sequencia', cidade: b.cidade || '', nomeDaRota: b.nomeDaRota || '', atracoesDoDia: b.atracoesDoDia ? [...b.atracoesDoDia] : []
      });
    });
  } else if (dia.atracoesDoDia) {
    novoDia.elementos.push({
      tipo: 'sequencia', cidade: dia.cidade || '', nomeDaRota: dia.nomeDaRota || '', atracoesDoDia: [...dia.atracoesDoDia]
    });
  }
  return novoDia;
}

// public/js/roteiros.js
let dbAtracoes = [];
let dbRotas = {};
window.dbRotas = dbRotas;
let atracaoMap = new Map(); // Mapa rápido de nome -> atracao

document.addEventListener('DOMContentLoaded', async () => {
  setupEvents();
  if (typeof setupEditorEvents === 'function') setupEditorEvents();
  await carregarBases();
  criarPopover();
});

async function carregarBases() {
  try {
    const [resAtr, resRotas] = await Promise.all([
      fetch('/api/atracoes'),
      fetch('/api/roteiros')
    ]);
    dbAtracoes = await resAtr.json();
    dbRotas = await resRotas.json(); window.dbRotas = dbRotas;

    // Criar mapa rápido
    dbAtracoes.forEach(a => {
      // Normalizar para buscas seguras (lower case)
      atracaoMap.set(a['Nome da Atração'].toLowerCase(), a);
    });

    preencherSelectRoteiros();
    criarDatalistCidades();
    
    if (window.location.hash.replace('#', '') === 'roteiros') {
      const lastRoteiro = localStorage.getItem('heian_last_roteiro');
      if (lastRoteiro && dbRotas && dbRotas[lastRoteiro]) {
        const select = document.getElementById('selectRoteiroBase');
        if (select) {
          select.value = lastRoteiro;
          select.dispatchEvent(new Event('change'));
        }
      }
    }
  } catch (err) {
    console.error('Erro ao carregar roteiros:', err);
  }
}
window.carregarRoteirosDoServidor = carregarBases;

function preencherSelectRoteiros(selectValue = '') {
  // Atualiza a lista lateral 3-pane de roteiros
  renderListaRoteiros();
  
  const input = document.getElementById('selectRoteiroBase');
  const dataList = document.getElementById('roteirosList');
  if (input && dataList) {
    dataList.innerHTML = '';
    Object.keys(dbRotas).forEach(roteiroName => {
      const opt = document.createElement('option');
      opt.value = roteiroName;
      dataList.appendChild(opt);
    });
    if (selectValue) {
      input.value = selectValue;
    }
  }
}

function setupEvents() {
  const select = document.getElementById('selectRoteiroBase');
  if (select) {
    select.addEventListener('change', (e) => {
      const roteiro = e.target.value;
      if (roteiro) {
        localStorage.setItem('heian_last_roteiro', roteiro);
      } else {
        localStorage.removeItem('heian_last_roteiro');
      }
      renderizarRoteiro(roteiro);
      
      const btnEditar = document.getElementById('btnEditarRoteiro');
      const btnExcluir = document.getElementById('btnExcluirRoteiro');
      
      btnEditar.style.display = roteiro ? 'inline-block' : 'none';
      btnExcluir.style.display = roteiro ? 'inline-block' : 'none';
      const btnGerarRoteiro = document.getElementById('btnGerarRoteiro');
      if (btnGerarRoteiro) {
        btnGerarRoteiro.disabled = !roteiro;
      }

      const btnIrParaCotacao = document.getElementById('btnIrParaCotacao');
      if (btnIrParaCotacao) {
        let vinculado = null;
        if (roteiro && typeof state !== 'undefined' && state && state.orcamentosDB) {
          vinculado = state.orcamentosDB.find(o => o.orcRoteiroVinculado === roteiro);
        }
        if (vinculado) {
          btnIrParaCotacao.style.display = 'inline-block';
          btnIrParaCotacao.onclick = () => {
            if (typeof navToPage === 'function') navToPage('orcamento');
            if (typeof abrirOrcamento === 'function') abrirOrcamento(vinculado.id);
          };
        } else {
          btnIrParaCotacao.style.display = 'none';
        }
      }
      
      // Auto-open editor to show the user the client data and avoid empty timeline confusion
      if (roteiro) {
        btnEditar.click();
      }
    });
  }
}

function criarPopover() {
  const popover = document.createElement('div');
  popover.className = 'atracao-popover';
  popover.id = 'atracaoPopover';
  popover.innerHTML = `
    <img class="popover-foto" id="popFoto" src="" alt="Atração" style="width: 100%; height: 140px; object-fit: cover; border-radius: 8px; margin-bottom: 12px; display: none;">
    <div class="popover-bairro" id="popBairro">Bairro</div>
    <div class="popover-titulo" id="popTitulo">Nome da Atração</div>
    <div class="popover-desc" id="popDesc">Descrição detalhada...</div>
    <div class="popover-preco" id="popPreco">
      <span>Preço:</span>
      <strong class="preco-brt">Grátis</strong>
    </div>
    <div class="popover-funcionamento" id="popFuncionamento" style="display:none; margin-top:8px; font-size:11px; padding:6px 10px; border-radius:6px; background:rgba(107,31,42,0.06); border:1px solid rgba(107,31,42,0.12); color:var(--crimson);">
      <span style="font-weight:700;">⚠️ Funcionamento:</span>
      <span id="popFuncionamentoTexto"></span>
    </div>
  `;
  document.body.appendChild(popover);
}

function criarDatalistCidades() {
  let datalist = document.getElementById('datalistCidades');
  if (!datalist) {
    datalist = document.createElement('datalist');
    datalist.id = 'datalistCidades';
    document.body.appendChild(datalist);
  }
  
  datalist.innerHTML = '';
  const cidadesUnicas = new Set();
  
  // Coletar de Atracoes
  if (typeof dbAtracoes !== 'undefined') {
    dbAtracoes.forEach(a => {
      if (a['Cidade']) cidadesUnicas.add(a['Cidade'].trim());
    });
  }

  // Coletar de Rotas (onde temos Kyoto, Osaka, etc)
  if (typeof dbRotas !== 'undefined') {
    Object.values(dbRotas).forEach(rotasData => {
      const rList = Array.isArray(rotasData) ? rotasData : (rotasData.dias || []);
      rList.forEach(r => {
        if (r.cidade) cidadesUnicas.add(r.cidade.trim());
        if (r.blocos) r.blocos.forEach(b => { if(b.cidade) cidadesUnicas.add(b.cidade.trim()); });
        if (r.elementos) r.elementos.forEach(e => { if(e.cidade) cidadesUnicas.add(e.cidade.trim()); });
      });
    });
  }

  Array.from(cidadesUnicas).sort().forEach(c => {
    if (c) {
      const opt = document.createElement('option');
      opt.value = c;
      datalist.appendChild(opt);
    }
  });
}

// Dicionário global de blocos compilados (Tours)
window.blocosRoteiro = {};

window.construirBlocosRoteiro = function() {
    window.blocosRoteiro = {};
    if (typeof state !== 'undefined' && state.rotasDB) {
        state.rotasDB.forEach(b => {
            if (b.nomeDaRota && b.atracoesDoDia && b.atracoesDoDia.length > 0) {
                const c = b.cidade || 'Diversos';
                if (!window.blocosRoteiro[c]) window.blocosRoteiro[c] = {};
                window.blocosRoteiro[c][b.nomeDaRota] = b.atracoesDoDia;
            }
        });
    }
};;

window.atualizarDatalists = function(idx, eIdx) {
  if (!roteiroEmEdicao || !roteiroEmEdicao.dias || !roteiroEmEdicao.dias[idx]) return;
  const bloco = roteiroEmEdicao.dias[idx].elementos[eIdx];
  if (!bloco || bloco.tipo !== 'sequencia') return;
  const cidade = bloco.cidade || '';
  let dlRotas = document.getElementById(`dlRotas_${idx}_${eIdx}`);
  let dlAtr = document.getElementById(`dlAtracoes_${idx}_${eIdx}`);
  if (!dlRotas || !dlAtr) return;
  dlRotas.innerHTML = dlAtr.innerHTML = '';
  construirBlocosRoteiro();
  const blocosDisponiveis = new Set();
  let cKey = null;
  if (cidade) { cKey = Object.keys(window.blocosRoteiro).find(k => k.toLowerCase() === cidade.toLowerCase()); }
  if (cKey && window.blocosRoteiro[cKey]) {
    Object.keys(window.blocosRoteiro[cKey]).forEach(nome => blocosDisponiveis.add(nome));
  } else if (!cidade) {
    Object.values(window.blocosRoteiro).forEach(bc => Object.keys(bc).forEach(nome => blocosDisponiveis.add(nome)));
  }
  Array.from(blocosDisponiveis).sort().forEach(nome => dlRotas.appendChild(new Option(nome)));
  const atracoes = new Set();
  dbAtracoes.forEach(a => {
    if (cidade && a['Cidade'] && a['Cidade'].toLowerCase() !== cidade.toLowerCase()) return;
    if (a['Nome da Atração']) atracoes.add(a['Nome da Atração']);
  });
  Array.from(atracoes).sort().forEach(a => dlAtr.appendChild(new Option(a)));
};;

window.selecionarBlocoRoteiro = function(idx, eIdx, nomeRota) {
  roteiroEmEdicao.dias[idx].elementos[eIdx].nomeDaRota = nomeRota;
  if (!nomeRota) {
    roteiroEmEdicao.dias[idx].elementos[eIdx].atracoesDoDia = [];
    renderEditDias();
    return;
  }
  const cidade = roteiroEmEdicao.dias[idx].elementos[eIdx].cidade || '';
  let atracoesParaAdicionar = null;

  // 1) Tenta no cache window.blocosRoteiro (já construído)
  construirBlocosRoteiro(); // Reconstrói sempre para garantir dados frescos
  if (cidade && window.blocosRoteiro[cidade] && window.blocosRoteiro[cidade][nomeRota]) {
    atracoesParaAdicionar = window.blocosRoteiro[cidade][nomeRota];
  } else {
    for (let c in window.blocosRoteiro) {
      if (window.blocosRoteiro[c][nomeRota]) { atracoesParaAdicionar = window.blocosRoteiro[c][nomeRota]; break; }
    }
  }

  // 2) Fallback: busca diretamente no state.rotasDB (cobre rotas recém-adicionadas)
  if (!atracoesParaAdicionar && typeof state !== 'undefined' && state.rotasDB) {
    const rotaEncontrada = state.rotasDB.find(r => r.nomeDaRota === nomeRota);
    if (rotaEncontrada && rotaEncontrada.atracoesDoDia) {
      // Garante que seja array mesmo se vier como string do Sheets
      atracoesParaAdicionar = Array.isArray(rotaEncontrada.atracoesDoDia)
        ? rotaEncontrada.atracoesDoDia
        : rotaEncontrada.atracoesDoDia.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  if (atracoesParaAdicionar && atracoesParaAdicionar.length > 0) {
    roteiroEmEdicao.dias[idx].elementos[eIdx].atracoesDoDia = [...atracoesParaAdicionar];
    
    // Validação em lote das atrações adicionadas
    const dia = roteiroEmEdicao.dias[idx];
    if (dia && dia.data) {
      const fechadas = [];
      atracoesParaAdicionar.forEach(atr => {
        const chk = window.verificarFuncionamentoAtracao(atr, dia.data);
        if (chk.fechado) {
          if (chk.tipoBloqueio === 'semanal') {
            fechadas.push(`- ${atr} (costuma fechar às ${chk.diaSemanaNome.toLowerCase()}s)`);
          } else if (chk.tipoBloqueio === 'manutencao') {
            fechadas.push(`- ${atr} (em manutenção: ${chk.motivo})`);
          }
        }
      });
      
      if (fechadas.length > 0) {
        setTimeout(() => {
          alert(`Aviso: Algumas das atrações adicionadas nesta rota podem estar fechadas no dia agendado:\n\n${fechadas.join('\n')}\n\nElas foram adicionadas ao roteiro, mas estarão destacadas com o ícone de aviso ⚠️.`);
        }, 100);
      }
    }
    
    renderEditDias();
  }
};;

function renderizarRoteiro(roteiroNome) {
  const timeline = document.getElementById('roteiroTimeline');
  if (!timeline) return;

  const btnGerarRoteiro = document.getElementById('btnGerarRoteiro');
  if (btnGerarRoteiro) {
    btnGerarRoteiro.disabled = !roteiroNome;
  }

  if (!roteiroNome) { timeline.innerHTML = '<div class="empty-state">Selecione um roteiro base acima para visualizar os dias.</div>'; return; }
  const rotasData = dbRotas[roteiroNome];
  if (!rotasData) { timeline.innerHTML = '<div class="empty-state">Este roteiro não possui dias cadastrados.</div>'; return; }
  const rotas = Array.isArray(rotasData) ? rotasData : (rotasData.dias || []);
  if (rotas.length === 0) { timeline.innerHTML = '<div class="empty-state">Este roteiro não possui dias cadastrados.</div>'; return; }
  
  timeline.innerHTML = '';
  rotas.forEach((rotaOrig, index) => {
    const rota = migrarDiaParaNovaEstrutura(rotaOrig);
    const card = document.createElement('div');
    card.className = 'dia-card';
    card.style.marginBottom = '24px';
    
    const temDeslocamento = rota.elementos.some(el => el.tipo === 'transporte');
    const temExperiencia = rota.elementos.some(el => el.tipo === 'experiencia');
    
    const badgeGuiado = rota.tourGuiado ? `<span class="badge" style="background:var(--gold); color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:8px; vertical-align:middle; display:inline-flex; align-items:center;">⭐ Tour Guiado</span>` : '';
    const badgeDeslocamento = temDeslocamento ? `<span class="badge" style="background:#C4A35A; color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; vertical-align:middle; display:inline-flex; align-items:center;">🚆 Deslocamento</span>` : '';
    const badgeExperiencia = temExperiencia ? `<span class="badge" style="background:var(--crimson); color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; vertical-align:middle; display:inline-flex; align-items:center; border: 1px solid rgba(255,255,255,0.4);">🎫 Experiência</span>` : '';

    let elementosHtml = rota.elementos.map(el => {
      if (el.tipo === 'info') {
        const parts = [];
        if (el.dataDoTour) {
          const d = new Date(el.dataDoTour);
          parts.push(`📅 ${isNaN(d) ? el.dataDoTour : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`);
        }
        if (el.horarioEncontro) parts.push(`🕒 ${el.horarioEncontro}`);
        if (el.duracaoTour) parts.push(`⏳ ${el.duracaoTour}`);
        if (el.localEncontro) parts.push(`📍 ${el.localEncontro}`);
        if (parts.length > 0) return `<div style="font-size:12px; color:var(--text-sec); margin-bottom:12px; font-weight:500; background:#f9f9f9; padding:6px 12px; border-radius:4px; display:inline-block">${parts.join(' &nbsp;|&nbsp; ')}</div>`;
        return '';
      } else if (el.tipo === 'texto') {
        return el.conteudo ? `<div style="font-size:13px; color:var(--text-main); margin-bottom:16px; line-height:1.6; border-left:3px solid var(--gold-lt); padding-left:12px; font-style:italic">${el.conteudo}</div>` : '';
      } else if (el.tipo === 'transporte') {
        const origem = el.cidadeOrigem || 'Origem';
        const destino = el.cidadeDestino || 'Destino';
        const transpNome = el.tipoTransporte ? `${el.tipoTransporte} (${el.linha})` : 'Deslocamento a definir';
        const ctg = el.categoria ? ` - ${el.categoria}` : '';
        const duracao = el.tempo ? ` <span style="color:var(--gold-dk); font-weight:bold;">[⏱ ${el.tempo}]</span>` : '';
        const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : ''); const pss = pText ? ` - ${pText}` : '';
        const h = el.horario ? `${el.horario}` : '';
        const horaText = h ? `<span style="color:#000; font-weight:bold; font-size:14px; margin-left:8px;">${h}</span>` : '';
        
        return `
          <div style="margin-bottom:16px; border-left:4px solid #C4A35A; padding-left:12px; background:linear-gradient(to right, rgba(196,163,90,0.06), transparent); padding-top:8px; padding-bottom:8px; border-radius:8px">
            <div style="margin-bottom:4px; display:flex; flex-wrap:wrap; align-items:center">
              <strong style="color:#9c8248; font-size:12px; text-transform:uppercase; margin-right:8px">Deslocamento ${horaText}</strong>
            </div>
            <div style="font-size:13px; color:var(--text-main); font-weight:600">${origem} ➔ ${destino}</div>
            <div style="font-size:11px; color:var(--text-sec); margin-top:2px">${transpNome}${ctg}${duracao}${pss} ${el.compradoHeian !== false ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em">✅ Emitido p/ Heian</span>' : ''}</div>
          </div>`;
      } else if (el.tipo === 'experiencia') {
        const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : ''); const p = pText ? (el.horaPartida ? ` &nbsp;|&nbsp; 👥 ${pText}` : `👥 ${pText}`) : '';
        const h = el.horaPartida ? `<span style="color:#000; font-weight:bold; font-size:14px; margin-right:8px;">${el.horaPartida}</span>` : '';
        return `
          <div style="margin-bottom:16px; border-left:4px solid var(--crimson); padding-left:12px; background:linear-gradient(to right, rgba(107,31,42,0.06), transparent); padding-top:8px; padding-bottom:8px; border-radius:8px">
            <div style="margin-bottom:4px; display:flex; flex-wrap:wrap; align-items:center">
              <strong style="color:var(--crimson); font-size:12px; text-transform:uppercase; margin-right:8px">Tickets & Experiências</strong>
            </div>
            <div style="font-size:13px; color:var(--text-main); font-weight:600">${el.nomeExp || 'Experiência a definir'}</div>
            <div style="font-size:11px; color:var(--text-sec); margin-top:2px">${h}${p} ${el.compradoHeian !== false ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em">✅ Emitido p/ Heian</span>' : ''}</div>
          </div>`;
      } else if (el.tipo === 'sequencia') {
        const tituloRota = el.nomeDaRota || 'Sequência';
        const cidadeText = el.cidade ? `<span style="color:var(--gold-dk); font-weight:600; font-size:11px; text-transform:uppercase; margin-right:8px">${el.cidade}</span>` : '';
        let atracoesHTML = `<div class="dia-atracoes">${el.atracoesDoDia.map(atr => criarChipAtracaoHTML(atr)).join('')}</div>`;
        return `
          <div style="margin-bottom:12px; position:relative">
            <div style="display:flex; flex-wrap:wrap; align-items:center; margin-bottom:10px">
              ${cidadeText}
              <strong style="color:var(--crimson); font-size:13px; font-weight:600">${tituloRota}</strong>
            </div>
            ${atracoesHTML}
          </div>
        `;
      }
      return '';
    }).join('');

    let dataText = '';
    if (rota.elementos.some(el => el.tipo === 'info' && el.dataDoTour)) {
      const dTour = rota.elementos.find(el => el.tipo === 'info').dataDoTour;
      const [yy, mm, dd] = dTour.split('-');
      const dateObj = new Date(yy, mm - 1, dd);
      const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      dataText = ` - ${dd}/${mm}/${yy} (${diasSemana[dateObj.getDay()]})`;
    }

    card.innerHTML = `
      <div class="dia-header" style="flex-direction:column; align-items:flex-start; background: linear-gradient(to right, rgba(107,31,42,0.08), transparent); padding: 8px 12px; border-radius: 6px; border-left: 4px solid var(--crimson); margin-bottom: 16px;">
        <div style="margin-bottom:0px; display:flex; flex-wrap:wrap; align-items:center;">
          <span class="dia-numero" style="font-size:20px; font-weight:800; margin-right:8px; color:var(--crimson)">Dia ${index + 1}${dataText}</span>
          ${badgeGuiado}
          ${badgeDeslocamento}
          ${badgeExperiencia}
        </div>
      </div>
      ${elementosHtml}
    `;
    timeline.appendChild(card);
  });
  if (typeof attachChipEvents === 'function') attachChipEvents();
}

window.renderizarRoteiroNoElemento = function(roteiroNome, timeline) {
  if (!timeline) return;
  if (!roteiroNome) { timeline.innerHTML = '<div class="empty-state">Selecione um roteiro base acima para visualizar os dias.</div>'; return; }
  const rotasData = dbRotas[roteiroNome];
  if (!rotasData) { timeline.innerHTML = '<div class="empty-state">Este roteiro não possui dias cadastrados.</div>'; return; }
  const rotas = Array.isArray(rotasData) ? rotasData : (rotasData.dias || []);
  if (rotas.length === 0) { timeline.innerHTML = '<div class="empty-state">Este roteiro não possui dias cadastrados.</div>'; return; }
  
  timeline.innerHTML = '';
  rotas.forEach((rotaOrig, index) => {
    const rota = migrarDiaParaNovaEstrutura(rotaOrig);
    const card = document.createElement('div');
    card.className = 'dia-card';
    card.style.marginBottom = '24px';
    
    const temDeslocamento = rota.elementos.some(el => el.tipo === 'transporte');
    const temExperiencia = rota.elementos.some(el => el.tipo === 'experiencia');
    
    const badgeGuiado = rota.tourGuiado ? `<span class="badge" style="background:var(--gold); color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:8px; vertical-align:middle; display:inline-flex; align-items:center;">⭐ Tour Guiado</span>` : '';
    const badgeDeslocamento = temDeslocamento ? `<span class="badge" style="background:#C4A35A; color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; vertical-align:middle; display:inline-flex; align-items:center;">🚆 Deslocamento</span>` : '';
    const badgeExperiencia = temExperiencia ? `<span class="badge" style="background:var(--crimson); color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; vertical-align:middle; display:inline-flex; align-items:center; border: 1px solid rgba(255,255,255,0.4);">🎫 Experiência</span>` : '';

    let elementosHtml = rota.elementos.map(el => {
      if (el.tipo === 'info') {
        const parts = [];
        if (el.dataDoTour) {
          const d = new Date(el.dataDoTour);
          parts.push(`📅 ${isNaN(d) ? el.dataDoTour : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`);
        }
        if (el.horarioEncontro) parts.push(`🕒 ${el.horarioEncontro}`);
        if (el.duracaoTour) parts.push(`⏳ ${el.duracaoTour}`);
        if (el.localEncontro) parts.push(`📍 ${el.localEncontro}`);
        if (parts.length > 0) return `<div style="font-size:12px; color:var(--text-sec); margin-bottom:12px; font-weight:500; background:#f9f9f9; padding:6px 12px; border-radius:4px; display:inline-block">${parts.join(' &nbsp;|&nbsp; ')}</div>`;
        return '';
      } else if (el.tipo === 'texto') {
        return el.conteudo ? `<div style="font-size:13px; color:var(--text-main); margin-bottom:16px; line-height:1.6; border-left:3px solid var(--gold-lt); padding-left:12px; font-style:italic">${el.conteudo}</div>` : '';
      } else if (el.tipo === 'transporte') {
        const origem = el.cidadeOrigem || 'Origem';
        const destino = el.cidadeDestino || 'Destino';
        const transpNome = el.tipoTransporte ? `${el.tipoTransporte} (${el.linha})` : 'Deslocamento a definir';
        const ctg = el.categoria ? ` - ${el.categoria}` : '';
        const duracao = el.tempo ? ` <span style="color:var(--gold-dk); font-weight:bold;">[⏱ ${el.tempo}]</span>` : '';
        const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : ''); const pss = pText ? ` - ${pText}` : '';
        const h = el.horario ? `${el.horario}` : '';
        const horaText = h ? `<span style="color:#000; font-weight:bold; font-size:14px; margin-left:8px;">${h}</span>` : '';
        
        return `
          <div style="margin-bottom:16px; border-left:4px solid #C4A35A; padding-left:12px; background:linear-gradient(to right, rgba(196,163,90,0.06), transparent); padding-top:8px; padding-bottom:8px; border-radius:8px">
            <div style="margin-bottom:4px; display:flex; flex-wrap:wrap; align-items:center">
              <strong style="color:#9c8248; font-size:12px; text-transform:uppercase; margin-right:8px">Deslocamento ${horaText}</strong>
            </div>
            <div style="font-size:13px; color:var(--text-main); font-weight:600">${origem} ➔ ${destino}</div>
            <div style="font-size:11px; color:var(--text-sec); margin-top:2px">${transpNome}${ctg}${duracao}${pss} ${el.compradoHeian !== false ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em">✅ Emitido p/ Heian</span>' : ''}</div>
          </div>`;
      } else if (el.tipo === 'experiencia') {
        const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : ''); const p = pText ? (el.horaPartida ? ` &nbsp;|&nbsp; 👥 ${pText}` : `👥 ${pText}`) : '';
        const h = el.horaPartida ? `<span style="color:#000; font-weight:bold; font-size:14px; margin-right:8px;">${el.horaPartida}</span>` : '';
        return `
          <div style="margin-bottom:16px; border-left:4px solid var(--crimson); padding-left:12px; background:linear-gradient(to right, rgba(107,31,42,0.06), transparent); padding-top:8px; padding-bottom:8px; border-radius:8px">
            <div style="margin-bottom:4px; display:flex; flex-wrap:wrap; align-items:center">
              <strong style="color:var(--crimson); font-size:12px; text-transform:uppercase; margin-right:8px">Tickets & Experiências</strong>
            </div>
            <div style="font-size:13px; color:var(--text-main); font-weight:600">${el.nomeExp || 'Experiência a definir'}</div>
            <div style="font-size:11px; color:var(--text-sec); margin-top:2px">${h}${p} ${el.compradoHeian !== false ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em">✅ Emitido p/ Heian</span>' : ''}</div>
          </div>`;
      } else if (el.tipo === 'sequencia') {
        const tituloRota = el.nomeDaRota || 'Sequência';
        const cidadeText = el.cidade ? `<span style="color:var(--gold-dk); font-weight:600; font-size:11px; text-transform:uppercase; margin-right:8px">${el.cidade}</span>` : '';
        let atracoesHTML = `<div class="dia-atracoes">${el.atracoesDoDia.map(atr => criarChipAtracaoHTML(atr)).join('')}</div>`;
        return `
          <div style="margin-bottom:12px; position:relative">
            <div style="display:flex; flex-wrap:wrap; align-items:center; margin-bottom:10px">
              ${cidadeText}
              <strong style="color:var(--crimson); font-size:13px; font-weight:600">${tituloRota}</strong>
            </div>
            ${atracoesHTML}
          </div>
        `;
      }
      return '';
    }).join('');

    let dataText = '';
    if (rota.elementos.some(el => el.tipo === 'info' && el.dataDoTour)) {
      const dTour = rota.elementos.find(el => el.tipo === 'info').dataDoTour;
      const [yy, mm, dd] = dTour.split('-');
      const dateObj = new Date(yy, mm - 1, dd);
      const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      dataText = ` - ${dd}/${mm}/${yy} (${diasSemana[dateObj.getDay()]})`;
    }

    card.innerHTML = `
      <div class="dia-header" style="flex-direction:column; align-items:flex-start; background: linear-gradient(to right, rgba(107,31,42,0.08), transparent); padding: 8px 12px; border-radius: 6px; border-left: 4px solid var(--crimson); margin-bottom: 16px;">
        <div style="margin-bottom:0px; display:flex; flex-wrap:wrap; align-items:center;">
          <span class="dia-numero" style="font-size:20px; font-weight:800; margin-right:8px; color:var(--crimson)">Dia ${index + 1}${dataText}</span>
          ${badgeGuiado}
          ${badgeDeslocamento}
          ${badgeExperiencia}
        </div>
      </div>
      ${elementosHtml}
    `;
    timeline.appendChild(card);
  });
  if (typeof attachChipEvents === 'function') attachChipEvents();
}

function criarChipAtracaoHTML(nomeAtracao) {
  const match = window.buscarAtracaoNoMapa(nomeAtracao);
  const isMissing = !match ? 'missing' : '';
  // Guarda o nome real no data-id para recuperar depois
  return `<div class="chip-atracao ${isMissing}" data-id="${nomeAtracao.replace(/"/g, '&quot;')}">${nomeAtracao}</div>`;
}

function showPopover(e) {
  const chip = e.target;
  const nome = chip.getAttribute('data-id');
  const atracao = window.buscarAtracaoNoMapa(nome);
  
  const popover = document.getElementById('atracaoPopover');
  const fotoEl = document.getElementById('popFoto');
  
  if (fotoEl) {
    fotoEl.onerror = function() {
      const fallbackUrl = 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=320&h=180&q=80';
      if (this.src !== fallbackUrl) {
        this.src = fallbackUrl;
      } else {
        this.style.display = 'none';
      }
    };

    if (atracao && atracao['Foto (URL)']) {
      fotoEl.src = atracao['Foto (URL)'];
    } else {
      const buscaNome = nome.replace(/[^a-zA-Z0-9 ]/g, '').trim();
      fotoEl.src = `https://loremflickr.com/320/180/japan,${encodeURIComponent(buscaNome)}`;
    }
    fotoEl.style.display = 'block';
  }
  
  const popFunc = document.getElementById('popFuncionamento');
  const popFuncTxt = document.getElementById('popFuncionamentoTexto');
  
  if (atracao) {
    document.getElementById('popBairro').textContent = atracao['Bairro'] || atracao['Cidade'] || 'Japão';
    document.getElementById('popTitulo').textContent = atracao['Nome da Atração'];
    document.getElementById('popDesc').textContent = (atracao['Descrição Detalhada'] || 'Visitação livre.').replace(/<[^>]*>?/gm, '').trim() || 'Visitação livre.';
    let preco = atracao['Preço (Ingresso)'];
    document.getElementById('popPreco').innerHTML = `<span>Preço:</span><strong class="preco-brt">${preco || 'Gratuito'}</strong>`;
    
    // Validar fechamento recorrente e manutenção para o popover
    let alertas = [];
    
    // 1) Dias fechados semanais
    if (atracao.diasFechados && Array.isArray(atracao.diasFechados) && atracao.diasFechados.length > 0) {
      const diasSemanaNomes = ["Domingos", "Segundas-feiras", "Terças-feiras", "Quartas-feiras", "Quintas-feiras", "Sextas-feiras", "Sábados"];
      const nomesFechados = atracao.diasFechados.map(d => diasSemanaNomes[d]);
      alertas.push(`Fecha às ${nomesFechados.join(' e ')}`);
    }
    
    // 2) Período de manutenção
    if (atracao.manutencaoInicio && atracao.manutencaoFim) {
      const formataDataSimples = (dStr) => dStr.split('-').reverse().slice(0, 2).join('/');
      const motivoStr = atracao.manutencaoMotivo ? ` (${atracao.manutencaoMotivo})` : '';
      alertas.push(`Manutenção de ${formataDataSimples(atracao.manutencaoInicio)} a ${formataDataSimples(atracao.manutencaoFim)}${motivoStr}`);
    }
    
    if (alertas.length > 0 && popFunc && popFuncTxt) {
      popFuncTxt.textContent = alertas.join(' | ');
      popFunc.style.display = 'block';
    } else if (popFunc) {
      popFunc.style.display = 'none';
    }
  } else {
    // Fallback para atrações que estão na rota mas não têm cadastro detalhado
    document.getElementById('popBairro').textContent = 'Ponto de Interesse';
    document.getElementById('popTitulo').textContent = nome;
    document.getElementById('popDesc').textContent = 'Atração apenas citada no roteiro. Detalhamento e preços não cadastrados no banco.';
    document.getElementById('popPreco').innerHTML = `<span>Aviso:</span><strong class="preco-brt" style="color:var(--ink-lt)">Sem dados</strong>`;
    if (popFunc) popFunc.style.display = 'none';
  }

  // Calcular posição do popover (flutuando perto do mouse).
  // Como o popover tem position: fixed, usamos apenas o getBoundingClientRect (relativo ao viewport).
  const rect = chip.getBoundingClientRect();
  
  // Garantir que não estoure a tela na direita ou embaixo
  let topPos = rect.bottom + 8;
  let leftPos = rect.left;
  
  // Abre para cima se não couber embaixo (considerando a altura adicional da imagem e do bloco de funcionamento)
  if (topPos + 350 > window.innerHeight) {
    topPos = rect.top - 360;
  }

  popover.style.top = topPos + 'px';
  popover.style.left = leftPos + 'px';
  popover.classList.add('visible');
}

function hidePopover() {
  const popover = document.getElementById('atracaoPopover');
  popover.classList.remove('visible');
}

// ── MODO EDIÇÃO DE ROTEIRO ──────────────────────────────────────────────────
let roteiroEmEdicao = { cliente: {nome:'', adultos:2, criancas:0, dataOrcamento:''}, dias: [] };
let roteiroOriginalNome = '';

// Garantir sincronização perfeita com o escopo global (window) para scripts externos e depuração
Object.defineProperty(window, 'roteiroEmEdicao', {
  get() { return roteiroEmEdicao; },
  set(val) { roteiroEmEdicao = val; },
  configurable: true
});

Object.defineProperty(window, 'roteiroOriginalNome', {
  get() { return roteiroOriginalNome; },
  set(val) { roteiroOriginalNome = val; },
  configurable: true
});

function setupEditorEvents() {
  // Removido listener antigo do btnNovoRoteiro
window.novoRoteiro = function() {
    roteiroOriginalNome = '';
    roteiroEmEdicao = { cliente: {nome:'', adultos:2, criancas:0, dataOrcamento:''}, dias: [] };
    
    document.getElementById('roteirosEmptyState').style.display = 'none';
    document.getElementById('roteirosDetailWrapper').style.display = 'block';
    
    abrirEditorRoteiro('Novo Roteiro');
};  document.getElementById('btnEditarRoteiro').addEventListener('click', () => {
    const nome = window.roteiroAtualVisualizado;
    const formatPeriodo = (d1, d2) => {
      if (!d1 && !d2) return
      const f1 = d1 ? d1.split('-').reverse().slice(0, 2).join('/') : '';
      const f2 = d2 ? d2.split('-').reverse().slice(0, 2).join('/') : '';
      if (f1 && f2) return `${f1} a ${f2}`;
      return f1 || f2;
    };
    if (!nome) return;
    roteiroOriginalNome = nome;
    
    // Suporte para legado (array puro) e novo formato
    const data = dbRotas[nome];
    if (Array.isArray(data)) {
      roteiroEmEdicao = { cliente: {nome:'', adultos:2, criancas:0, dataOrcamento:''}, dias: JSON.parse(JSON.stringify(data)) };
    } else {
      roteiroEmEdicao = JSON.parse(JSON.stringify(data));
      if (!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {nome:'', adultos:2, criancas:0, dataOrcamento:''};
      if (!roteiroEmEdicao.dias) roteiroEmEdicao.dias = [];
    }
    abrirEditorRoteiro(nome);
  });

  document.getElementById('btnExcluirRoteiro').addEventListener('click', async () => {
    const nome = window.roteiroAtualVisualizado;
    if (!nome) return;
    if (!confirm(`Tem certeza que deseja excluir o roteiro "${nome}"?`)) return;
    
    await fetch(`/api/roteiros/${encodeURIComponent(nome)}`, { method: 'DELETE' });
    delete dbRotas[nome];
    preencherSelectRoteiros();
    renderizarRoteiro('');
  });

  document.getElementById('chkIncluirDescricoesPdf')?.addEventListener('change', () => {
    const nome = window.roteiroAtualVisualizado;
    if (nome) renderizarRoteiro(nome);
  });

  document.getElementById('btnGerarRoteiro').addEventListener('click', () => {
    try {
      let nome = window.roteiroAtualVisualizado;
      const roteiroEditContainer = document.getElementById('roteiroEditContainer');
      const isEditMode = roteiroEditContainer && roteiroEditContainer.style.display !== 'none';
      
      if (isEditMode) {
         const editorName = document.getElementById('editRoteiroNome').value.trim();
         if (editorName) nome = editorName;
      }

      if (!nome && !isEditMode) {
        alert("Selecione um roteiro primeiro.");
        return;
      }
      
      const previewCont = document.getElementById('previewContainer');
      if (!previewCont) {
        alert("Erro: Elemento de preview não encontrado.");
        return;
      }

      let cliente = {};
      let diasArray = [];
      let nomeParaExibir = nome || 'Pré-visualização';
      
      if (isEditMode && typeof roteiroEmEdicao !== 'undefined') {
          if (roteiroEmEdicao.cliente) cliente = roteiroEmEdicao.cliente;
          if (roteiroEmEdicao.dias) diasArray = roteiroEmEdicao.dias;
          nomeParaExibir = document.getElementById('editRoteiroNome').value || 'Pré-visualização';
      } else if (dbRotas[nome]) {
          if (dbRotas[nome].cliente) cliente = dbRotas[nome].cliente;
          diasArray = Array.isArray(dbRotas[nome]) ? dbRotas[nome] : (dbRotas[nome].dias || []);
          nomeParaExibir = nome;
      }

      const formatPeriodo = (d1, d2) => {
        if (!d1 && !d2) return '';
        const f1 = d1 ? d1.split('-').reverse().slice(0, 2).join('/') : '';
        const f2 = d2 ? d2.split('-').reverse().slice(0, 2).join('/') : '';
        if (f1 && f2) return `${f1} a ${f2}`;
        return f1 || f2;
      };

      const txtPessoas = (cliente.adultos ? `${cliente.adultos} Adultos` : '') + (cliente.criancas > 0 ? `, ${cliente.criancas} Crianças` : '');
      
      const diasHtml = diasArray.map((diaOrig, index) => {
        const dia = migrarDiaParaNovaEstrutura(diaOrig);
        
        const temDeslocamento = dia.elementos.some(el => el.tipo === 'transporte');
        const temExperiencia = dia.elementos.some(el => el.tipo === 'experiencia');
        
        const badgeGuiado = dia.tourGuiado ? `<span class="badge" style="background:var(--gold); color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:8px; vertical-align:middle; display:inline-flex; align-items:center;">⭐ Tour Guiado</span>` : '';
        const badgeDeslocamento = temDeslocamento ? `<span class="badge" style="background:#C4A35A; color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; vertical-align:middle; display:inline-flex; align-items:center;">🚆 Deslocamento</span>` : '';
        const badgeExperiencia = temExperiencia ? `<span class="badge" style="background:var(--crimson); color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; vertical-align:middle; display:inline-flex; align-items:center; border: 1px solid rgba(255,255,255,0.4);">🎫 Experiência</span>` : '';
        
        let elementosHtml = dia.elementos.map((el, eIdx) => {
          if (el.tipo === 'info') {
            const parts = [];
            if (el.dataDoTour) {
              const d = new Date(el.dataDoTour);
              parts.push(`📅 ${isNaN(d) ? el.dataDoTour : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`);
            }
            if (el.horarioEncontro) parts.push(`🕒 ${el.horarioEncontro}`);
            if (el.duracaoTour) parts.push(`⏳ ${el.duracaoTour}`);
            if (el.localEncontro) parts.push(`📍 ${el.localEncontro}`);
            if (parts.length > 0) return `<div style="font-size:12px; color:var(--text-sec); margin-bottom:12px; font-weight:500; background:#f9f9f9; padding:6px 12px; border-radius:4px; display:inline-block">${parts.join(' &nbsp;|&nbsp; ')}</div>`;
            return '';
          } else if (el.tipo === 'texto') {
            return el.conteudo ? `<div style="font-size:13px; color:var(--text-main); margin-bottom:16px; line-height:1.6; border-left:3px solid var(--gold-lt); padding-left:12px; font-style:italic">${el.conteudo}</div>` : '';
          } else if (el.tipo === 'sequencia') {
            const tituloRota = el.nomeDaRota || 'Sequência';
            const cidadeText = el.cidade ? `<span style="color:var(--gold-dk); font-weight:600; font-size:11px; text-transform:uppercase; margin-right:8px">${el.cidade}</span>` : '';
            const incluirDesc = document.getElementById('chkIncluirDescricoesPdf')?.checked;
            
            let atracoesHTML = '';
            if (incluirDesc && el.atracoesDoDia) {
              atracoesHTML = '<div style="display:flex; flex-wrap:wrap; flex-direction:column; gap:8px; border-left:2px solid var(--gold-lt); padding-left:12px; margin-left:6px;">';
              el.atracoesDoDia.forEach((atrNome, idxAtr) => {
                const atr = window.buscarAtracaoNoMapa(atrNome);
                let desc = atr ? (atr['Descrição Detalhada'] || 'Visitação livre.') : 'Visitação livre.';
                desc = desc.replace(/<[^>]*>?/gm, '').trim() || 'Visitação livre.';
                const bairro = atr ? (atr['Bairro'] || '') : '';
                const isBairro = bairro && bairro.toLowerCase() === atrNome.toLowerCase();
                
                if (isBairro) {
                  const baseSpacing = idxAtr === 0 ? 'margin-top:4px;' : 'margin-top:12px;';
                  const bgStyle = 'background: linear-gradient(to right, rgba(212,175,55,0.12), transparent); padding: 6px 12px; border-radius: 6px;';
                  
                  atracoesHTML += `
                    <div style="${baseSpacing} ${bgStyle}">
                      <strong style="font-size:14px; color:var(--ink-dark); display:block;">
                        ${atrNome}
                      </strong>
                      ${desc !== 'Visitação livre.' ? `<div style="font-size:11px; color:var(--text-main); margin-top:2px; line-height:1.4;">${desc}</div>` : ''}
                    </div>`;
                } else {
                  atracoesHTML += `
                    <div style="font-size:12px; color:var(--text-main); margin-bottom:4px; line-height:1.4; padding-left:11px; text-indent:-11px;">
                      <span style="display:inline-block; width:5px; height:5px; background:var(--gold); border-radius:50%; margin-right:6px; vertical-align:middle; position:relative; top:-1px;"></span>
                      <strong>${atrNome}</strong>${desc !== 'Visitação livre.' ? ` <span style="color:var(--text-sec);">— ${desc}</span>` : ''}
                    </div>`;
                }
              });
              atracoesHTML += '</div>';
            } else if (el.atracoesDoDia) {
               atracoesHTML = `<div style="font-size:12px; color:var(--text-sec); margin-top:4px; border-left:2px solid var(--gold-lt); padding-left:10px;">${el.atracoesDoDia.join(' + ')}</div>`;
            }
            
            return `
              <div style="margin-bottom:12px; position:relative">
                <div style="display:flex; flex-wrap:wrap; align-items:center; margin-bottom:10px">
                  ${cidadeText}
                  <strong style="color:var(--crimson); font-size:13px; font-weight:600">${tituloRota}</strong>
                </div>
                ${atracoesHTML}
              </div>
            `;
          } else if (el.tipo === 'transporte') {
            const origem = el.cidadeOrigem || 'Origem';
            const destino = el.cidadeDestino || 'Destino';
            const transpNome = el.tipoTransporte ? `${el.tipoTransporte} (${el.linha})` : 'Deslocamento a definir';
            const ctg = el.categoria ? ` - ${el.categoria}` : '';
            const duracao = el.tempo ? ` <span style="color:var(--gold-dk); font-weight:bold;">[⏱ ${el.tempo}]</span>` : '';
            const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : ''); const pss = pText ? ` - ${pText}` : '';
            const h = el.horario ? `${el.horario}` : '';
            const horaText = h ? `<span style="color:#000; font-weight:bold; font-size:14px; margin-left:8px;">${h}</span>` : '';
            
            return `
              <div style="margin-bottom:16px; border-left:4px solid #C4A35A; padding-left:12px; background:linear-gradient(to right, rgba(196,163,90,0.06), transparent); padding-top:8px; padding-bottom:8px; border-radius:8px">
                <div style="margin-bottom:4px; display:flex; flex-wrap:wrap; align-items:center">
                  <strong style="color:#9c8248; font-size:12px; text-transform:uppercase; margin-right:8px">Deslocamento ${horaText}</strong>
                </div>
                <div style="font-size:13px; color:var(--text-main); font-weight:600">${origem} ➔ ${destino}</div>
                <div style="font-size:11px; color:var(--text-sec); margin-top:2px">${transpNome}${ctg}${duracao}${pss} ${el.compradoHeian !== false ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em">✅ Emitido p/ Heian</span>' : ''}</div>
              </div>`;
          } else if (el.tipo === 'experiencia') {
            const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : ''); const p = pText ? (el.horaPartida ? ` &nbsp;|&nbsp; 👥 ${pText}` : `👥 ${pText}`) : '';
            const h = el.horaPartida ? `<span style="color:#000; font-weight:bold; font-size:14px; margin-right:8px;">${el.horaPartida}</span>` : '';
            return `
              <div style="margin-bottom:16px; border-left:4px solid var(--crimson); padding-left:12px; background:linear-gradient(to right, rgba(107,31,42,0.06), transparent); padding-top:8px; padding-bottom:8px; border-radius:8px">
                <div style="margin-bottom:4px; display:flex; flex-wrap:wrap; align-items:center">
                  <strong style="color:var(--crimson); font-size:12px; text-transform:uppercase; margin-right:8px">Tickets & Experiências</strong>
                </div>
                <div style="font-size:13px; color:var(--text-main); font-weight:600">${el.nomeExp || 'Experiência a definir'}</div>
                <div style="font-size:11px; color:var(--text-sec); margin-top:2px">${h}${p} ${el.compradoHeian !== false ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em">✅ Emitido p/ Heian</span>' : ''}</div>
              </div>`;
          }
          return '';
        }).join('');
        
        let dataText = '';
        if (dia.data) {
          const [yy, mm, dd] = dia.data.split('-');
          const dateObj = new Date(yy, mm - 1, dd);
          const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
          dataText = ` - ${dd}/${mm}/${yy} (${diasSemana[dateObj.getDay()]})`;
        }
  
        return `
          <div class="dia-card">
            <div class="dia-header" style="flex-direction:column; align-items:flex-start; background: linear-gradient(to right, rgba(107,31,42,0.08), transparent); padding: 8px 12px; border-radius: 6px; border-left: 4px solid var(--crimson); margin-bottom: 16px;">
              <div style="margin-bottom:0px; display:flex; flex-wrap:wrap; align-items:center; flex-wrap:wrap;">
                <span class="dia-numero" style="font-size:20px; font-weight:800; margin-right:8px; color:var(--crimson)">Dia ${dia.numeroDia || (index + 1)}${dataText}</span>
                ${badgeGuiado}
                ${badgeDeslocamento}
                ${badgeExperiencia}
              </div>
            </div>
            ${elementosHtml}
          </div>
        `;
      }).join('');

      previewCont.innerHTML = `
        <div class="pdf-doc">
          <div class="pdf-cover">
            <img src="/assets/logo.png" class="pdf-cover-logo" alt="Heian Tour" onerror="this.style.display='none'">
            <div class="pdf-cover-divider"></div>
            <div class="pdf-cover-label">Roteiro de Viagem</div>
            <div class="pdf-cover-title">${nomeParaExibir}</div>
            ${Object.keys(cliente).length > 0 ? `<div class="pdf-cover-meta">
              ${formatPeriodo(cliente.dataOrcamento, cliente.dataFim) ? `<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Período</div><div class="pdf-cover-meta-value">${formatPeriodo(cliente.dataOrcamento, cliente.dataFim)}</div></div>` : ''}
              
              ${txtPessoas ? `<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Passageiros</div><div class="pdf-cover-meta-value">${txtPessoas}</div></div>` : ''}
            </div>` : ''}
          </div>
          <div class="pdf-body">
            <div style="background:white; border-radius:8px; padding:30px; box-shadow:0 10px 30px rgba(0,0,0,0.05)">
              
              ${(cliente.estadias && cliente.estadias.length > 0) ? `<div class="pdf-section" style="margin-bottom:30px">
                <div class="pdf-section-header" style="margin-bottom:16px"><div class="pdf-section-dot"></div><div class="pdf-section-title">Estadias</div></div>
                <div class="pdf-estadias-grid">
                  ${cliente.estadias.map(e => {
                    const f1 = e.dataInicio ? e.dataInicio.split('-').reverse().slice(0, 2).join('/') : '';
                    const f2 = e.dataFim ? e.dataFim.split('-').reverse().slice(0, 2).join('/') : '';
                    const per = (f1 && f2) ? `${f1} - ${f2}` : f1 || f2 || '';
                    return `<div class="pdf-estadia-item"><div class="pdf-estadia-cidade">${e.cidade||'-'}</div>${per?`<div class="pdf-estadia-datas">${per}</div>`:``} ${e.hotel?`<div class="pdf-estadia-hotel">${e.hotel}</div>`:``}</div>`;
                  }).join('')}
                </div>
              </div>` : ''}
              ${(cliente.vooChegada || cliente.vooPartida) ? `<div style="display:flex; flex-wrap:wrap; justify-content:space-between; background:var(--bg); border:1px solid #eaeaea; border-radius:8px; padding:20px; margin-bottom:30px;">
                ${cliente.vooChegada ? `<div style="flex:1"><div style="font-size:10px; color:var(--gold-dk); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px">Voo de Chegada</div><div style="font-size:14px; color:var(--ink); font-weight:500">${cliente.vooChegada}</div></div>` : ''}
                ${cliente.vooPartida ? `<div style="flex:1; padding-left:20px; border-left:1px solid #eaeaea"><div style="font-size:10px; color:var(--gold-dk); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px">Voo de Partida</div><div style="font-size:14px; color:var(--ink); font-weight:500">${cliente.vooPartida}</div></div>` : ''}
              </div>` : ''}
              
              <div class="roteiro-timeline" style="border-left: 2px solid rgba(196,163,90,0.3); padding-left: 20px;">
                ${diasHtml}
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.getElementById('previewOverlay').classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      
      if (typeof attachChipEvents === 'function') attachChipEvents();
    } catch(e) { alert("ERRO AO GERAR ROTEIRO: " + e.message); console.error(e); }
  });

  document.getElementById('btnCancelarEdicaoRoteiro').addEventListener('click', fecharEditorRoteiro);

  document.getElementById('btnAddDiaRoteiro').addEventListener('click', () => {
    roteiroEmEdicao.dias.push({ cidade: '', elementos: [] });
    renderEditDias();
  });

  document.getElementById('btnGerarDiasAutomaticamente').addEventListener('click', () => {
    const dataInicioStr = document.getElementById('rotClienteData').value;
    const dataFimStr = document.getElementById('rotClienteDataFim').value;
    
    if (!dataInicioStr || !dataFimStr) {
      alert("Por favor, preencha a Data de Início e a Data Final antes de gerar os dias automaticamente.");
      return;
    }
    
    const pInicio = dataInicioStr.split('-');
    const pFim = dataFimStr.split('-');
    const dInicio = new Date(Date.UTC(parseInt(pInicio[0]), parseInt(pInicio[1])-1, parseInt(pInicio[2])));
    const dFim = new Date(Date.UTC(parseInt(pFim[0]), parseInt(pFim[1])-1, parseInt(pFim[2])));
    
    if (dFim < dInicio) {
      alert("A Data Final deve ser maior ou igual a Data de Início.");
      return;
    }
    
    if (roteiroEmEdicao.dias && roteiroEmEdicao.dias.length > 0) {
      const confirmacao = confirm("AVISO: Gerar os dias automaticamente apagará todos os dias e passeios atuais deste roteiro. Deseja continuar?");
      if (!confirmacao) return;
    }
    
    const diffTime = Math.abs(dFim - dInicio);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    roteiroEmEdicao.dias = [];
    
    for (let i = 0; i < diffDays; i++) {
      const dataAtual = new Date(dInicio.getTime() + (i * 24 * 60 * 60 * 1000));
      const isoDate = dataAtual.toISOString().split('T')[0];
      roteiroEmEdicao.dias.push({ 
        cidade: '', 
        data: isoDate,
        elementos: [] 
      });
    }
    
    renderEditDias();
  });

  document.getElementById('btnSalvarVisualizarRoteiro').addEventListener('click', async () => {
    document.getElementById('btnSalvarEdicaoRoteiro').click();
    setTimeout(() => {
        const btnPreview = document.getElementById('btnGerarRoteiro');
        if (btnPreview) {
            btnPreview.disabled = false; // Force enable just in case
            btnPreview.click();
        }
    }, 800);
  });

  document.getElementById('btnSalvarEdicaoRoteiro').addEventListener('click', async () => {
    const novoNome = document.getElementById('editRoteiroNome').value.trim();
    if (!novoNome) return alert('Dê um nome ao roteiro.');
    if (!roteiroEmEdicao.dias || roteiroEmEdicao.dias.length === 0) return alert('Adicione pelo menos um dia ao roteiro.');

    if (!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {};
    roteiroEmEdicao.cliente.nome = document.getElementById('rotClienteNome').value;
    roteiroEmEdicao.cliente.adultos = document.getElementById('rotClienteAdultos').value;
    roteiroEmEdicao.cliente.criancas = document.getElementById('rotClienteCriancas').value;
    roteiroEmEdicao.cliente.dataInicio = document.getElementById('rotClienteData') ? document.getElementById('rotClienteData').value : '';
    roteiroEmEdicao.cliente.dataFim = document.getElementById('rotClienteDataFim') ? document.getElementById('rotClienteDataFim').value : '';
    roteiroEmEdicao.cliente.vooChegada = document.getElementById('rotClienteVooChegada') ? document.getElementById('rotClienteVooChegada').value : '';
    roteiroEmEdicao.cliente.vooPartida = document.getElementById('rotClienteVooPartida') ? document.getElementById('rotClienteVooPartida').value : '';

    const btn = document.getElementById('btnSalvarEdicaoRoteiro');
    btn.textContent = 'Salvando...'; btn.disabled = true;

    let res;
    if (roteiroOriginalNome && roteiroOriginalNome !== novoNome) {
      // Renomeação atômica e cascade update no backend
      res = await fetch(`/api/roteiros/${encodeURIComponent(roteiroOriginalNome)}/renomear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novoNome, roteiroObj: roteiroEmEdicao })
      });
      if (res.ok) {
        delete dbRotas[roteiroOriginalNome];
      }
    } else {
      // Salvamento comum
      res = await fetch(`/api/roteiros/${encodeURIComponent(novoNome)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roteiroEmEdicao)
      });
    }

    if (res.status === 409) {
      const errData = await res.json();
      alert(errData.message || 'Já existe um roteiro com este nome associado a outro cliente. Por favor, escolha um nome diferente.');
      btn.textContent = 'Salvar Roteiro'; btn.disabled = false;
      return;
    }

    if (res.ok) {
      dbRotas[novoNome] = roteiroEmEdicao;
      preencherSelectRoteiros(novoNome);
      fecharEditorRoteiro();
      renderizarRoteiro(novoNome);
      
      // Atualiza também o select de cotações, se a função existir no app.js
      if (typeof preencherSelectRoteiroVinculado === 'function') {
        preencherSelectRoteiroVinculado(novoNome);
      }
    } else {
      alert('Erro ao salvar roteiro.');
    }
    
    btn.textContent = 'Salvar Roteiro'; btn.disabled = false;
  });
}

function abrirEditorRoteiro(nome) {
  document.getElementById('editRoteiroNome').value = nome === 'Novo Roteiro' ? '' : nome;
  
  window.roteiroUndoStack = [];
  if (typeof window.registrarEstadoRoteiro === 'function') {
    window.registrarEstadoRoteiro(roteiroEmEdicao);
  }
  
  // Encontrar o notionClienteId baseado nas cotações vinculadas
  let notionId = null;
  if (typeof state !== 'undefined' && state && state.orcamentosDB && Array.isArray(state.orcamentosDB)) {
    const vinculado = state.orcamentosDB.find(o => o && o.orcRoteiroVinculado === nome);
    if (vinculado) notionId = vinculado.notionClienteId;
  }
  if (!notionId && typeof state !== 'undefined' && state && state.orcamento && state.orcamento.orcRoteiroVinculado === nome) {
    notionId = state.orcamento.notionClienteId;
  }
  
  const notionCli = notionId && typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === notionId) : null;

  // Preenche dados do cliente (prioriza Notion)
  document.getElementById('rotClienteNome').value = notionCli ? notionCli.nome : (roteiroEmEdicao.cliente?.nome || '');
  document.getElementById('rotClienteAdultos').value = notionCli ? notionCli.adultos : (roteiroEmEdicao.cliente?.adultos || '2');
  document.getElementById('rotClienteCriancas').value = notionCli ? notionCli.criancas : (roteiroEmEdicao.cliente?.criancas || '0');
  
  const rotTemCliente = !!roteiroEmEdicao.notionClienteId;
  const rotLockedStyle = rotTemCliente ? 'background:#f1f5f9; cursor:not-allowed' : '';
  ['rotClienteNome', 'rotClienteAdultos', 'rotClienteCriancas'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.readOnly = rotTemCliente; el.style.cssText = rotLockedStyle; }
  });
  const btnEditarRot = document.getElementById('btnEditarClienteRoteiro');
  if(btnEditarRot) btnEditarRot.innerHTML = rotTemCliente ? '👤 Editar Cliente' : '💾 Salvar Cliente no Notion';
  const btnImportRot = document.getElementById('btnImportNotionRoteiro');
  if (btnImportRot) btnImportRot.style.display = rotTemCliente ? 'none' : 'inline-block';
  
  // Datas e voos (não estão mais na UI do Roteiro como editáveis globalmente, mas para garantir preenchemos)
  document.getElementById('rotClienteData').value = notionCli ? notionCli.dataInicio : (roteiroEmEdicao.cliente?.dataInicio || roteiroEmEdicao.cliente?.dataOrcamento || '');
  if(document.getElementById('rotClienteDataFim')) document.getElementById('rotClienteDataFim').value = notionCli ? notionCli.dataFim : (roteiroEmEdicao.cliente?.dataFim || '');
  if(document.getElementById('rotClienteVooChegada')) document.getElementById('rotClienteVooChegada').value = notionCli ? notionCli.vooChegada : (roteiroEmEdicao.cliente?.vooChegada || '');
  if(document.getElementById('rotClienteVooPartida')) document.getElementById('rotClienteVooPartida').value = notionCli ? notionCli.vooPartida : (roteiroEmEdicao.cliente?.vooPartida || '');
  window.renderRotEstadias(); updateRoteiroHeader();

  document.getElementById('roteiroTimeline').style.display = 'none';
  document.getElementById('roteiroEditContainer').style.display = 'block';
  
  // Esconde botoes da header
  // Removido hide do btnNovoRoteiro
  document.getElementById('btnEditarRoteiro').style.display = 'none';
  document.getElementById('btnExcluirRoteiro').style.display = 'none';
  document.getElementById('btnGerarRoteiro').style.display = 'none';
  // document.getElementById('selectRoteiroBase').disabled = true;

  renderEditDias();
  
  if (roteiroEmEdicao && roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.notionClienteId && typeof syncClienteAtivo === 'function') {
      syncClienteAtivo(roteiroEmEdicao.cliente.notionClienteId);
  }
}

function fecharEditorRoteiro() {
  document.getElementById('roteiroEditContainer').style.display = 'none';
  document.getElementById('roteiroTimeline').style.display = 'block';
  
  const val = window.roteiroAtualVisualizado;
  document.getElementById('btnEditarRoteiro').style.display = val ? 'inline-block' : 'none';
  document.getElementById('btnExcluirRoteiro').style.display = val ? 'inline-block' : 'none';
  document.getElementById('btnGerarRoteiro').style.display = 'inline-block';

  // Se veio do contexto de um cliente, volta para a aba do cliente
  if (typeof roteiroEmEdicao !== 'undefined' && roteiroEmEdicao && roteiroEmEdicao.notionClienteId) {
    const clienteId = roteiroEmEdicao.notionClienteId;
    if (typeof navToPage === 'function') navToPage('clientes');
    if (typeof window.abrirDetalhesCliente === 'function') {
      window.abrirDetalhesCliente(clienteId);
      setTimeout(() => {
        const btnTab = document.querySelector('.tab-client-btn[data-tab="roteiros"]');
        if (btnTab) btnTab.click();
      }, 150);
    }
  }
}

window.atualizarBotoesCotacao = function() {
    const actionsDiv = document.getElementById('roteiroCotacaoActions');
    if (!actionsDiv) return;
    
    // Evita erro se roteiroEmEdicao não estiver disponível ainda
    if (typeof roteiroEmEdicao === 'undefined' || !roteiroEmEdicao) {
        actionsDiv.innerHTML = '';
        return;
    }
    
    const editInput = document.getElementById('editRoteiroNome');
    const roteiroNome = (typeof roteiroOriginalNome !== 'undefined' && roteiroOriginalNome) || (editInput ? editInput.value : '');
    if (!roteiroNome) return;
    
    if (typeof state === 'undefined' || !state || !state.orcamentosDB || !Array.isArray(state.orcamentosDB)) {
        actionsDiv.innerHTML = `
            <button class="btn-secondary" onclick="roteiroParaCotacao(roteiroEmEdicao, '${roteiroNome}', true)">📄 Gerar Cotação</button>
        `;
        return;
    }
    
    const existingCotacao = state.orcamentosDB.find(o => o && o.orcRoteiroVinculado === roteiroNome);
    
    if (existingCotacao) {
        actionsDiv.innerHTML = `
            <button class="btn-secondary" onclick="abrirOrcamento('${existingCotacao.id}'); navToPage('orcamento');" title="Visualizar a cotação existente sem alterar nada">👀 Ver Cotação</button>
            <button class="btn-secondary" onclick="roteiroParaCotacao(roteiroEmEdicao, '${roteiroNome}', false)" title="Atualizar a cotação existente com os dados atuais deste roteiro">🔄 Atualizar Cotação</button>
        `;
    } else {
        actionsDiv.innerHTML = `
            <button class="btn-secondary" onclick="roteiroParaCotacao(roteiroEmEdicao, '${roteiroNome}', true)">📄 Gerar Cotação</button>
        `;
    }
}
function renderEditDias() { updateRoteiroHeader(); triggerRoteiroAutoSave(); 
  const container = document.getElementById('editRoteiroDiasList');
  if (!container) return;
  container.innerHTML = '';
  if (!roteiroEmEdicao.dias || roteiroEmEdicao.dias.length === 0) {
    container.innerHTML = '<p style="color:var(--text-sec); font-size:12px; font-style:italic">Nenhum dia adicionado ainda.</p>';
    return;
  }
  roteiroEmEdicao.dias.forEach((diaOrig, idx) => {
    const dia = migrarDiaParaNovaEstrutura(diaOrig);
    roteiroEmEdicao.dias[idx] = dia; // Fix in-place just in case
    
    let elementosHtml = '';
    dia.elementos.forEach((el, eIdx) => {
      const isFirst = eIdx === 0;
      const isLast = eIdx === dia.elementos.length - 1;
      const btnUp = isFirst ? '' : `<button class="btn-icon" style="padding:2px 4px;font-size:12px" title="Mover para Cima" onclick="moverElemento(${idx}, ${eIdx}, -1)">⬆️</button>`;
      const btnDown = isLast ? '' : `<button class="btn-icon" style="padding:2px 4px;font-size:12px" title="Mover para Baixo" onclick="moverElemento(${idx}, ${eIdx}, 1)">⬇️</button>`;
      const controles = `<div style="display:flex; flex-wrap:wrap;gap:4px">${btnUp}${btnDown}<button class="btn-secondary" style="padding:2px 6px; font-size:10px" onclick="delElemento(${idx}, ${eIdx})">✕ Remover</button></div>`;

      if (el.tipo === 'info') {
        elementosHtml += `
          <div style="border-left: 2px solid var(--gold-lt); padding-left: 12px; margin-bottom: 16px; background:#fcfcfc; padding-top:8px; padding-bottom:8px; border-radius:8px">
            <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <strong style="color:var(--text-sec); font-size:11px; text-transform:uppercase">📅 Info de Encontro</strong>
              ${controles}
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px">
              <div class="field" style="margin:0"><label style="font-size:10px;color:var(--gold-dk)">Data</label><input type="date" value="${el.dataDoTour}" onchange="updElementoEdit(${idx}, ${eIdx}, 'dataDoTour', this.value)"></div>
              <div class="field" style="margin:0"><label style="font-size:10px;color:var(--gold-dk)">Horário</label><input type="time" value="${el.horarioEncontro}" onchange="updElementoEdit(${idx}, ${eIdx}, 'horarioEncontro', this.value)"></div>
              <div class="field" style="margin:0"><label style="font-size:10px;color:var(--gold-dk)">Duração</label><select onchange="updElementoEdit(${idx}, ${eIdx}, 'duracaoTour', this.value)">
                  <option value="4h" ${el.duracaoTour==='4h'?'selected':''}>4h</option>
                  <option value="5h" ${el.duracaoTour==='5h'?'selected':''}>5h</option>
                  <option value="6h" ${el.duracaoTour==='6h'||!el.duracaoTour?'selected':''}>6h</option>
                  <option value="8h" ${el.duracaoTour==='8h'?'selected':''}>8h</option>
                  <option value="10h" ${el.duracaoTour==='10h'?'selected':''}>10h</option>
                  <option value="12h" ${el.duracaoTour==='12h'?'selected':''}>12h</option>
                </select></div>
   <div class="field" style="margin:0"><label style="font-size:10px;color:var(--gold-dk)">Local</label><input type="text" placeholder="Local..." value="${el.localEncontro}" onchange="updElementoEdit(${idx}, ${eIdx}, 'localEncontro', this.value)"></div>
            </div>
          </div>`;
      } else if (el.tipo === 'texto') {
        elementosHtml += `
          <div style="border-left: 2px solid var(--ink-lt); padding-left: 12px; margin-bottom: 16px; padding-top:8px; padding-bottom:8px">
            <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <strong style="color:var(--text-sec); font-size:11px; text-transform:uppercase">📝 Texto Livre / Comunicação</strong>
              ${controles}
            </div>
            <div class="field" style="margin:0">
              <textarea id="txt_livre_${idx}_${eIdx}" rows="3" placeholder="Escreva uma mensagem ou anotação para o cliente..." oninput="updElementoEdit(${idx}, ${eIdx}, 'conteudo', this.value)">${el.conteudo || ''}</textarea>
            </div>
          </div>`;
      } else if (el.tipo === 'transporte') {
        elementosHtml += `
          <div style="border-left: 4px solid #C4A35A; padding-left: 12px; margin-bottom: 16px; background:rgba(196,163,90,0.08); padding-top:8px; padding-bottom:8px; border-radius:8px">
            <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <strong style="color:#9c8248; font-size:11px; text-transform:uppercase">Deslocamento</strong>
              ${controles}
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px">
              <div class="field" style="margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Origem (Filtro)</label>
                <input type="text" list="datalistCidades" autocomplete="off" placeholder="De onde sai?" value="${el.cidadeOrigem || ''}" oninput="updElementoEdit(${idx}, ${eIdx}, 'cidadeOrigem', this.value); atualizarOpcoesTransporte(${idx}, ${eIdx})">
              </div>
              <div class="field" style="margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Destino (Opcional)</label>
                <input type="text" list="datalistCidades" autocomplete="off" placeholder="Para onde vai?" value="${el.cidadeDestino || ''}" oninput="updElementoEdit(${idx}, ${eIdx}, 'cidadeDestino', this.value); atualizarOpcoesTransporte(${idx}, ${eIdx})">
              </div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px">
              <div class="field" style="flex:2; margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Opção de Transporte</label>
                <select id="selTransp_${idx}_${eIdx}" onchange="selecionarTransporte(${idx}, ${eIdx}, this.value)" style="width:100%; font-size:12px; padding:6px">
                  <option value="">Selecione...</option>
                </select>
              </div>
              <div class="field" style="margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Horário</label>
                <input type="time" value="${el.horario || ''}" onchange="updElementoEdit(${idx}, ${eIdx}, 'horario', this.value)">
              </div>
              <div class="field" style="margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Adultos</label>
                <input type="number" value="${el.adultos !== undefined ? el.adultos : (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.adultos) || 2}" onchange="updElementoEdit(${idx}, ${eIdx}, 'adultos', parseInt(this.value)||0)" style="width:50px">
              </div>
              <div class="field" style="margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Crianças</label>
                <input type="number" value="${el.criancas !== undefined ? el.criancas : (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.criancas) || 0}" onchange="updElementoEdit(${idx}, ${eIdx}, 'criancas', parseInt(this.value)||0)" style="width:50px">
              </div>
              <div class="field" style="margin:0; display:flex; flex-wrap:wrap; align-items:flex-end">
                <label style="font-size:11px; display:flex; flex-wrap:wrap; align-items:center; cursor:pointer; height:34px; padding:0 8px; border-radius:4px; font-weight:600; border:1px solid ${el.compradoHeian !== false ? 'var(--gold)' : '#ccc'}; background:${el.compradoHeian !== false ? 'var(--gold)' : '#fff'}; color:${el.compradoHeian !== false ? 'white' : 'var(--text-sec)'}">
                  <input type="checkbox" ${el.compradoHeian !== false ? 'checked' : ''} onchange="updElementoEdit(${idx}, ${eIdx}, 'compradoHeian', this.checked)" style="margin-right:6px"> EMITIDO P/ HEIAN
                </label>
              </div>
            </div>
            ${el.tipoTransporte ? `<div style="font-size:11px; margin-top:8px; color:var(--text-sec)">Selecionado: <strong>${el.tipoTransporte}</strong> (${el.linha}) - ${el.categoria} ${el.tempo ? `<strong style="color:var(--gold-dk); margin-left:8px;">⏱ ${el.tempo}</strong>` : ''}</div>` : ''}
          </div>`;
      } else if (el.tipo === 'experiencia') {
        const controles = `<span style="cursor:pointer; font-size:12px; margin-right:8px; color:var(--ink-mid)" onclick="moverElemento(${idx}, ${eIdx}, -1)">⬆️</span>` +
                          `<span style="cursor:pointer; font-size:12px; margin-right:12px; color:var(--ink-mid)" onclick="moverElemento(${idx}, ${eIdx}, 1)">⬇️</span>` +
                          `<span style="cursor:pointer; color:var(--crimson); font-size:12px" onclick="delElemento(${idx}, ${eIdx})">Excluir</span>`;
        elementosHtml += `
          <div style="border-left: 4px solid var(--crimson); padding-left: 12px; margin-bottom: 16px; background:rgba(107,31,42,0.08); padding-top:8px; padding-bottom:8px; border-radius:8px">
            <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <strong style="color:var(--crimson); font-size:12px; text-transform:uppercase">Tickets & Experiências</strong>
              <div>${controles}</div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px">
              <div class="field" style="flex:1; margin:0">
                <input type="text" placeholder="Buscar Experiência..." value="${el.filtro || ''}" oninput="updElementoEdit(${idx}, ${eIdx}, 'filtro', this.value); atualizarOpcoesExperiencia(${idx}, ${eIdx})">
              </div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px">
              <div class="field" style="flex:2; margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Item Encontrado</label>
                <select id="selExp_${idx}_${eIdx}" onchange="selecionarExperiencia(${idx}, ${eIdx}, this.value)" style="width:100%; font-size:12px; padding:6px; border: 1px solid var(--border); border-radius: 4px;">
                  <option value="">Digite para buscar...</option>
                </select>
              </div>
              <div class="field" style="margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Horário</label>
                <input type="time" value="${el.horaPartida || ''}" onchange="updElementoEdit(${idx}, ${eIdx}, 'horaPartida', this.value)">
              </div>
              <div class="field" style="margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Adultos</label>
                <input type="number" value="${el.adultos !== undefined ? el.adultos : (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.adultos) || 2}" onchange="updElementoEdit(${idx}, ${eIdx}, 'adultos', parseInt(this.value)||0)" style="width:50px">
              </div>
              <div class="field" style="margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Crianças</label>
                <input type="number" value="${el.criancas !== undefined ? el.criancas : (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.criancas) || 0}" onchange="updElementoEdit(${idx}, ${eIdx}, 'criancas', parseInt(this.value)||0)" style="width:50px">
              </div>
              <div class="field" style="margin:0; display:flex; flex-wrap:wrap; align-items:flex-end">
                <label style="font-size:11px; display:flex; flex-wrap:wrap; align-items:center; cursor:pointer; height:34px; padding:0 8px; border-radius:4px; font-weight:600; border:1px solid ${el.compradoHeian !== false ? 'var(--gold)' : '#ccc'}; background:${el.compradoHeian !== false ? 'var(--gold)' : '#fff'}; color:${el.compradoHeian !== false ? 'white' : 'var(--text-sec)'}">
                  <input type="checkbox" ${el.compradoHeian !== false ? 'checked' : ''} onchange="updElementoEdit(${idx}, ${eIdx}, 'compradoHeian', this.checked)" style="margin-right:6px"> EMITIDO P/ HEIAN
                </label>
              </div>
            </div>
            ${el.nomeExp ? `<div style="font-size:11px; margin-top:8px; color:var(--text-sec)">Selecionado: <strong>${el.nomeExp}</strong></div>` : ''}
          </div>
        `;
      } else if (el.tipo === 'sequencia') {
        const atracoesHtml = el.atracoesDoDia.map((atr, aIdx) => {
          const chk = window.verificarFuncionamentoAtracao(atr, dia.data);
          let extraClass = '';
          let warnTitle = '';
          let warnIcon = '';
          
          if (chk.fechado) {
            extraClass = ' fechada';
            if (chk.tipoBloqueio === 'semanal') {
              warnIcon = '⚠️ ';
              warnTitle = ` (fecha às ${chk.diaSemanaNome.toLowerCase()}s)`;
            } else if (chk.tipoBloqueio === 'manutencao') {
              warnIcon = '⚠️ ';
              warnTitle = ` (manutenção: ${chk.motivo})`;
            }
          }
          
          const missingClass = !window.buscarAtracaoNoMapa(atr) ? 'missing' : '';
          
          return `<div class="chip-atracao ${missingClass}${extraClass}"
                title="${atr}${warnTitle}"
                draggable="true" 
                ondragstart="dragStartAtracao(event, ${idx}, ${eIdx}, ${aIdx})"
                ondragover="dragOverAtracao(event)"
                ondrop="dropAtracao(event, ${idx}, ${eIdx}, ${aIdx})">
            <span style="cursor:grab; margin-right:4px; opacity:0.5; user-select:none">⋮⋮</span>${warnIcon}${atr}${warnTitle}<span style="margin-left:8px; cursor:pointer; color:#ff4444" onclick="delAtracaoBloco(${idx}, ${eIdx}, ${aIdx})">✕</span>
          </div>`;
        }).join('');
        elementosHtml += `
          <div style="border-left: 2px solid var(--gold); padding-left: 12px; margin-bottom: 16px; padding-top:8px; padding-bottom:8px">
            <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <strong style="color:var(--crimson); font-size:12px">🚩 Sequência de Atrações</strong>
              ${controles}
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px">
              <datalist id="dlRotas_${idx}_${eIdx}"></datalist>
              <datalist id="dlAtracoes_${idx}_${eIdx}"></datalist>
              <div class="field" style="margin:0"><input type="text" list="datalistCidades" autocomplete="off" placeholder="Cidade" value="${el.cidade || ''}" onchange="updElementoEdit(${idx}, ${eIdx}, 'cidade', this.value); atualizarDatalists(${idx}, ${eIdx})"></div>
              <div class="field" style="margin:0"><input type="text" list="dlRotas_${idx}_${eIdx}" autocomplete="off" placeholder="Título (ex: Asakusa + Ueno)" value="${el.nomeDaRota || ''}" onchange="selecionarBlocoRoteiro(${idx}, ${eIdx}, this.value)"></div>
            </div>
            <div class="dia-atracoes" style="margin-bottom:8px; min-height:30px" ondragover="dragOverAtracao(event)" ondrop="dropAtracaoBlock(event, ${idx}, ${eIdx})">${atracoesHtml}</div>
            <div class="field" style="margin:0">
              <input type="text" list="dlAtracoes_${idx}_${eIdx}" placeholder="+ Adicionar atração" onchange="addAtracaoBloco(${idx}, ${eIdx}, this.value); this.value=''" >
            </div>
          </div>`;
      }
    });

    const card = document.createElement('div');
    card.className = 'dia-card card';
    card.style.marginBottom = '16px';
    
    let dataText = '';
    let dataValue = '';
    if (dia.data) {
      dataValue = dia.data;
      const [yy, mm, dd] = dia.data.split('-');
      const dateObj = new Date(yy, mm - 1, dd);
      const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
      dataText = ` - ${diasSemana[dateObj.getDay()]}`;
    }

    card.innerHTML = `
      <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; margin:-20px -20px 16px -20px; border-radius:8px 8px 0 0; padding:12px 20px; background:var(--crimson); color:white">
        <div style="display:flex; flex-wrap:wrap; align-items:center;">
          <span style="margin:0; font-family:var(--ff-display); color:white; font-size:18px; margin-right: 6px;">Dia</span>
          <input type="number" min="1" max="99" value="${dia.numeroDia || (idx + 1)}" onchange="updDiaEdit(${idx}, 'numeroDia', this.value)" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; border-radius: 4px; padding: 2px 4px; font-size: 16px; font-family:var(--ff-display); font-weight: bold; width: 44px; margin-right: 12px; text-align:center;" />
          <input type="date" value="${dataValue}" onchange="updDiaEdit(${idx}, 'data', this.value)" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; border-radius: 4px; padding: 2px 6px; font-size: 13px; font-weight: bold; width: 130px; font-family: inherit; color-scheme: dark;" />
          <span style="font-size: 14px; font-weight: 600; margin-left: 6px;">${dataText}</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; align-items:center;">
          <label style="font-size:12px; margin-right:12px; cursor:pointer; display:flex; flex-wrap:wrap; align-items:center; padding:4px 12px; border-radius:16px; font-weight:600; background:${dia.tourGuiado ? '#fff' : 'rgba(255,255,255,0.2)'}; color:${dia.tourGuiado ? 'var(--crimson)' : '#fff'}; border: 1px solid ${dia.tourGuiado ? '#fff' : 'rgba(255,255,255,0.4)'}">
            <input type="checkbox" ${dia.tourGuiado ? 'checked' : ''} onchange="updDiaEdit(${idx}, 'tourGuiado', this.checked)" style="margin-right:6px; accent-color:var(--crimson)">
            ${dia.tourGuiado ? '⭐ TOUR GUIADO' : 'Tour Guiado'}
          </label>
          <div style="display:flex; flex-wrap:wrap; gap: 4px; margin-right: 8px;">
            <button class="btn-secondary" onclick="moverDia(${idx}, 'up')" style="padding:4px 8px; font-size:12px; border-color:white; color:white; background:transparent" title="Mover para cima">↑</button>
            <button class="btn-secondary" onclick="moverDia(${idx}, 'down')" style="padding:4px 8px; font-size:12px; border-color:white; color:white; background:transparent" title="Mover para baixo">↓</button>
          </div>
          <button class="btn-secondary" onclick="delDia(${idx})" style="padding:4px 8px; font-size:12px; border-color:white; color:white; background:transparent" title="Excluir Dia">✕</button>
        </div>
      </div>
      
      ${elementosHtml}
      
      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; flex-wrap:wrap">
        <button class="btn-secondary" style="flex:1; border-style:dashed; min-width:120px" onclick="adicionarElemento(${idx}, 'sequencia')">+ Sequência</button>
        <button class="btn-secondary" style="flex:1; border-style:dashed; min-width:120px" onclick="adicionarElemento(${idx}, 'texto')">+ Texto Livre</button>
        <button class="btn-secondary" style="flex:1; border-style:dashed; min-width:120px" onclick="adicionarElemento(${idx}, 'info')">+ Info Encontro</button>
        <button class="btn-secondary" style="flex:1; border-style:dashed; min-width:120px" onclick="adicionarElemento(${idx}, 'transporte')">+ Transporte</button>
        <button class="btn-secondary" style="flex:1; border-style:dashed; min-width:120px; color:var(--purple); border-color:var(--purple)" onclick="adicionarElemento(${idx}, 'experiencia')">+ Tickets & Experiências</button>
      </div>
    `;
    container.appendChild(card);
    
    dia.elementos.forEach((el, eIdx) => {
      if(el.tipo === 'sequencia') atualizarDatalists(idx, eIdx);
      if(el.tipo === 'texto' && typeof initRichText === 'function') {
        setTimeout(() => initRichText(`txt_livre_${idx}_${eIdx}`, 'Escreva uma mensagem ou anotação para o cliente...'), 50);
      }
    });
  });

  if (window.atualizarBotoesCotacao) {
      try {
          window.atualizarBotoesCotacao();
      } catch(e) {
          console.warn("Erro ao atualizar botões de cotação:", e);
      }
  }
}

window.updRotCliente = function(field, val) {
  if (!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {};
  roteiroEmEdicao.cliente[field] = val;
  updateRoteiroHeader();
  triggerRoteiroAutoSave();
};

window.updDiaEdit = function(diaIdx, field, val) {
    if (!roteiroEmEdicao || !roteiroEmEdicao.dias[diaIdx]) return;
    roteiroEmEdicao.dias[diaIdx][field] = val;
    
    // Ao marcar Tour Guiado, adiciona Info de Encontro automaticamente se não houver
    if (field === 'tourGuiado' && val === true) {
      const elementos = roteiroEmEdicao.dias[diaIdx].elementos || [];
      const jaTemInfo = elementos.some(el => el.tipo === 'info');
      if (!jaTemInfo) {
        roteiroEmEdicao.dias[diaIdx].elementos.unshift({
          tipo: 'info',
          dataDoTour: '',
          horarioEncontro: '',
          duracaoTour: '6h',
          localEncontro: ''
        });
      }
      renderEditDias();
      return;
    }
    
    if (field === 'data') renderEditDias();
};

window.moverDia = function(idx, direcao) {
  if (!roteiroEmEdicao || !roteiroEmEdicao.dias) return;
  const dias = roteiroEmEdicao.dias;
  
  if (direcao === 'up' && idx > 0) {
    const temp = dias[idx];
    dias[idx] = dias[idx-1];
    dias[idx-1] = temp;
  } else if (direcao === 'down' && idx < dias.length - 1) {
    const temp = dias[idx];
    dias[idx] = dias[idx+1];
    dias[idx+1] = temp;
  }
  
  renderEditDias();
};

window.delDia = function(idx) {
  if (confirm("Tem certeza que deseja remover este dia inteiro?")) {
    roteiroEmEdicao.dias.splice(idx, 1);
    renderEditDias();
  }
};

window.removerDiaEdit = function(diaIdx) {
  roteiroEmEdicao.dias.splice(diaIdx, 1);
  renderEditDias();
};

window.removerAtracaoEdit = function(diaIdx, atrIdx) {
  roteiroEmEdicao.dias[diaIdx].atracoesDoDia.splice(atrIdx, 1);
  renderEditDias();
};

window.adicionarAtracaoEdit = function(diaIdx) {
  const input = document.getElementById(`addAtrInput_${diaIdx}`);
  const val = input.value.trim();
  if (val) {
    roteiroEmEdicao.dias[diaIdx].atracoesDoDia.push(val);
    renderEditDias();
  }
};


window.moverElemento = function(dIdx, eIdx, direcao) {
  const arr = roteiroEmEdicao.dias[dIdx].elementos;
  if (eIdx + direcao < 0 || eIdx + direcao >= arr.length) return;
  const temp = arr[eIdx];
  arr[eIdx] = arr[eIdx + direcao];
  arr[eIdx + direcao] = temp;
  renderEditDias();
};


let deletedItemBackup = null;
let undoToastElement = null;

window.undoDeleteElement = function() {
  if (!deletedItemBackup || !roteiroEmEdicao) return;
  const { idx, eIdx, item } = deletedItemBackup;
  roteiroEmEdicao.dias[idx].elementos.splice(eIdx, 0, item);
  deletedItemBackup = null;
  if (undoToastElement) {
    undoToastElement.remove();
    undoToastElement = null;
  }
  renderEditDias();
  showToast('Ação desfeita! Item restaurado.');
};

window.delElemento = function(idx, eIdx) {
  const dia = roteiroEmEdicao.dias[idx];
  deletedItemBackup = { idx, eIdx, item: dia.elementos[eIdx] };
  dia.elementos.splice(eIdx, 1);
  renderEditDias();

  // Create custom undo toast
  if (undoToastElement) undoToastElement.remove();
  const t = document.createElement('div');
  t.style.position = 'fixed';
  t.style.bottom = '20px';
  t.style.left = '50%';
  t.style.transform = 'translateX(-50%)';
  t.style.background = '#333';
  t.style.color = '#fff';
  t.style.padding = '12px 24px';
  t.style.borderRadius = '30px';
  t.style.zIndex = 9999;
  t.style.fontFamily = 'Jost, sans-serif';
  t.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  t.style.display = 'flex';
  t.style.alignItems = 'center';
  t.style.gap = '15px';
  t.innerHTML = `
    <span>Item removido</span>
    <button onclick="undoDeleteElement()" style="background: #e8c688; color: #111; border: none; padding: 6px 12px; border-radius: 20px; cursor: pointer; font-weight: 500; font-family: Jost;">Desfazer (Ctrl+Z)</button>
  `;
  document.body.appendChild(t);
  undoToastElement = t;
  
  setTimeout(() => {
    if (undoToastElement === t) {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s ease';
      setTimeout(() => t.remove(), 300);
    }
  }, 6000);
};

// Global Ctrl+Z listener
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.key === 'z') {
    if (deletedItemBackup) {
      e.preventDefault();
      window.undoDeleteElement();
    }
  }
});

window.atualizarOpcoesTransporte = function(idx, eIdx) {
  const dia = roteiroEmEdicao.dias[idx];
  if(!dia) return;
  const el = dia.elementos[eIdx];
  if (!el || el.tipo !== 'transporte') return;

  const origem = (el.cidadeOrigem || '').toLowerCase().trim();
  const destino = (el.cidadeDestino || '').toLowerCase().trim();
  
  const sel = document.getElementById("selTransp_" + idx + "_" + eIdx);
  if (!sel) return;
  
  sel.innerHTML = '<option value="">Carregando...</option>';
  
  // Usar cache de transportes para não sobrecarregar o servidor
  const processarTransportes = (transportes) => {
    sel.innerHTML = '<option value="">Selecione...</option>';
    let count = 0;
    
    // Sempre adicionar a opção personalizada no topo
    const optCustom = document.createElement('option');
    optCustom.value = 'custom';
    optCustom.textContent = '✏️ + Adicionar Transporte Personalizado...';
    optCustom.style.fontWeight = 'bold';
    if (el.trechoId === 'custom') optCustom.selected = true;
    sel.appendChild(optCustom);
    
    const grouped = [];
    const mapG = new Map();
    transportes.forEach(tr => {
      const key = `${tr.trecho}|${tr.tipo}|${tr.linha}|${tr.categoria}`;
      if (!mapG.has(key)) {
        mapG.set(key, { ...tr, ids: [String(tr.id)] });
        grouped.push(mapG.get(key));
      } else {
        mapG.get(key).ids.push(String(tr.id));
      }
    });

    const grpExact = document.createElement('optgroup'); grpExact.label = 'Recomendados (Origem e Destino)';
    const grpOrig = document.createElement('optgroup'); grpOrig.label = 'Mesma Origem';
    const grpDest = document.createElement('optgroup'); grpDest.label = 'Mesmo Destino';
    const grpOther = document.createElement('optgroup'); grpOther.label = 'Todas as Outras Opções';

    grouped.forEach(t => {
      const trecho = (t.trecho || '').toLowerCase();
      const oEmpty = !origem;
      const dEmpty = !destino;
      
      let matchOrigem = !oEmpty && trecho.includes(origem);
      let matchDestino = !dEmpty && trecho.includes(destino);
      
      const opt = document.createElement('option');
      opt.value = t.id; // usa o id base
      opt.textContent = t.trecho + ' - ' + t.tipo + ' (' + t.linha + ') | ' + t.categoria + (t.tempo ? ' (⏱ ' + t.tempo + ')' : '');
      if (t.ids.includes(String(el.trechoId))) opt.selected = true;
      
      if ((matchOrigem && matchDestino) || (oEmpty && dEmpty)) {
          grpExact.appendChild(opt);
      } else if (matchOrigem) {
          grpOrig.appendChild(opt);
      } else if (matchDestino) {
          grpDest.appendChild(opt);
      } else {
          grpOther.appendChild(opt);
      }
    });

    if (grpExact.children.length > 0) sel.appendChild(grpExact);
    if (grpOrig.children.length > 0) sel.appendChild(grpOrig);
    if (grpDest.children.length > 0) sel.appendChild(grpDest);
    if (grpOther.children.length > 0) sel.appendChild(grpOther);
  };

  if (window.dbTransportesCache) {
    processarTransportes(window.dbTransportesCache);
  } else {
    fetch('/api/transportes').then(r => r.json()).then(transportes => {
      window.dbTransportesCache = transportes;
      processarTransportes(transportes);
    }).catch(err => {
      sel.innerHTML = '<option value="">Erro ao carregar transportes</option>';
    });
  }
};;


window.formatarPessoas = function(el) {
  let text = [];
  if (el.adultos) text.push(el.adultos + (el.adultos > 1 ? ' Adultos' : ' Adulto'));
  if (el.criancas) text.push(el.criancas + (el.criancas > 1 ? ' Crianças' : ' Criança'));
  // fallback for legacy
  if (text.length === 0 && el.passageiros) return el.passageiros + (el.passageiros > 1 ? ' Passageiros' : ' Passageiro');
  return text.join(', ');
};

window.selecionarTransporte = function(idx, eIdx, idTransp) {
  const el = roteiroEmEdicao.dias[idx].elementos[eIdx];
  
  if (idTransp === 'custom') {
     const nomePersonalizado = prompt("Digite o nome ou tipo do transporte (Ex: Transfer Privado, Táxi, Trem Local...):", el.tipoTransporte || "");
     if (nomePersonalizado !== null && nomePersonalizado.trim() !== "") {
        const precoStr = prompt("Digite o valor (em Ienes ¥). Deixe em branco se quiser preencher na Cotação:", "");
        el.trechoId = 'custom';
        el.tipoTransporte = nomePersonalizado.trim();
        el.linha = 'Personalizado';
        el.categoria = '-';
        el.tempo = '';
        el.precoManual = parseFloat(precoStr) || 0;
        if (el.adultos === undefined) el.adultos = parseInt((roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.adultos) || 2);
        if (el.criancas === undefined) el.criancas = parseInt((roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.criancas) || 0);
        renderEditDias();
     } else {
        renderEditDias(); // Reseta o select caso ele cancele
     }
     return;
  }

  const processar = (transportes) => {
    const t = transportes.find(x => x.id == idTransp);
    if (t) {
      el.trechoId = t.id;
      el.tipoTransporte = t.tipo;
      el.linha = t.linha;
      el.categoria = t.categoria;
      el.tempo = t.tempo;
      if (el.adultos === undefined) el.adultos = parseInt((roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.adultos) || 2);
      if (el.criancas === undefined) el.criancas = parseInt((roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.criancas) || 0);
      renderEditDias();
    }
  };

  if (window.dbTransportesCache) {
    processar(window.dbTransportesCache);
  } else {
    fetch('/api/transportes').then(r => r.json()).then(transportes => {
      window.dbTransportesCache = transportes;
      processar(transportes);
    });
  }
};

window.atualizarOpcoesExperiencia = function(idx, eIdx) {
  const dia = roteiroEmEdicao.dias[idx];
  if(!dia) return;
  const el = dia.elementos[eIdx];
  if (!el || el.tipo !== 'experiencia') return;

  const filtro = (el.filtro || '').toLowerCase().trim();
  const sel = document.getElementById("selExp_" + idx + "_" + eIdx);
  if (!sel) return;
  
  sel.innerHTML = '<option value="">Carregando...</option>';
  
  const processarExperiencias = (experiencias) => {
    sel.innerHTML = '<option value="">Selecione...</option>';
    let count = 0;
    experiencias.forEach(ex => {
      const nome = (ex.nome || '').toLowerCase();
      if (!filtro || nome.includes(filtro)) {
        const opt = document.createElement('option');
        opt.value = ex.id;
        opt.textContent = ex.nome + ' | ' + ex.tipo;
        if (ex.id == el.expId) opt.selected = true;
        sel.appendChild(opt);
        count++;
      }
    });
    if (count === 0 && filtro) {
       sel.innerHTML = '<option value="">Nenhuma opção encontrada...</option>';
    } else if (count === 0) {
       sel.innerHTML = '<option value="">Digite para filtrar...</option>';
    }
  };

  if (window.dbExperienciasCache) {
    processarExperiencias(window.dbExperienciasCache);
  } else {
    fetch('/api/experiencias').then(r => r.json()).then(exps => {
      window.dbExperienciasCache = exps;
      processarExperiencias(exps);
    }).catch(err => {
      sel.innerHTML = '<option value="">Erro ao carregar</option>';
    });
  }
};

window.selecionarExperiencia = function(idx, eIdx, idExp) {
  const el = roteiroEmEdicao.dias[idx].elementos[eIdx];
  
  const processar = (exps) => {
    const ex = exps.find(x => x.id == idExp);
    if (ex) {
      el.expId = ex.id;
      el.nomeExp = ex.nome;
      el.tipoExp = ex.tipo;
      el.observacao = ex.observacao;
      if (el.adultos === undefined) el.adultos = parseInt((roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.adultos) || 2);
      if (el.criancas === undefined) el.criancas = parseInt((roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.criancas) || 0);
      renderEditDias();
    }
  };

  if (window.dbExperienciasCache) {
    processar(window.dbExperienciasCache);
  } else {
    fetch('/api/experiencias').then(r => r.json()).then(exps => {
      window.dbExperienciasCache = exps;
      processar(exps);
    });
  }
};

if (typeof originalRenderEditDias === 'undefined') {
  window.originalRenderEditDias = renderEditDias;
  window.renderEditDias = function() {
    if (typeof autoSaveRoteiro === 'function') autoSaveRoteiro();
    originalRenderEditDias();
    if (roteiroEmEdicao && roteiroEmEdicao.dias) {
      roteiroEmEdicao.dias.forEach((dia, idx) => {
        if (dia.elementos) {
          dia.elementos.forEach((el, eIdx) => {
            if (el.tipo === 'transporte') {
              setTimeout(() => atualizarOpcoesTransporte(idx, eIdx), 0);
            }
            if (el.tipo === 'experiencia') {
              setTimeout(() => atualizarOpcoesExperiencia(idx, eIdx), 0);
            }
          });
        }
      });
    }
  };
}

window.adicionarElemento = function(idx, tipo) {
  if (!roteiroEmEdicao.dias[idx].elementos) {
    roteiroEmEdicao.dias[idx].elementos = [];
  }
  
  if (tipo === 'sequencia') {
    roteiroEmEdicao.dias[idx].elementos.push({ refId: Date.now() + Math.random().toString(36).substr(2, 5), tipo: 'sequencia', cidade: '', nomeDaRota: '', atracoesDoDia: [] });
  } else if (tipo === 'texto') {
    roteiroEmEdicao.dias[idx].elementos.push({ refId: Date.now() + Math.random().toString(36).substr(2, 5), tipo: 'texto', conteudo: '' });
  } else if (tipo === 'info') {
    roteiroEmEdicao.dias[idx].elementos.push({ refId: Date.now() + Math.random().toString(36).substr(2, 5), tipo: 'info', dataDoTour: '', horarioEncontro: '', duracaoTour: '6h', localEncontro: '' });
  } else if (tipo === 'transporte') {
    roteiroEmEdicao.dias[idx].elementos.push({ refId: Date.now() + Math.random().toString(36).substr(2, 5), 
        tipo: 'transporte', cidadeOrigem: '', cidadeDestino: '', trechoId: null,
        adultos: parseInt(document.getElementById('rotClienteAdultos')?.value || roteiroEmEdicao.cliente?.adultos || 2),
        criancas: parseInt(document.getElementById('rotClienteCriancas')?.value || roteiroEmEdicao.cliente?.criancas || 0),
        compradoHeian: true
    });
  } else if (tipo === 'experiencia') {
    roteiroEmEdicao.dias[idx].elementos.push({ refId: Date.now() + Math.random().toString(36).substr(2, 5), 
        tipo: 'experiencia', filtro: '', expId: null,
        adultos: parseInt(document.getElementById('rotClienteAdultos')?.value || roteiroEmEdicao.cliente?.adultos || 2),
        criancas: parseInt(document.getElementById('rotClienteCriancas')?.value || roteiroEmEdicao.cliente?.criancas || 0),
        compradoHeian: true
    });
  }
  
  if(typeof renderEditDias === 'function') {
    renderEditDias();
  }
};

window.updElementoEdit = function(idx, eIdx, campo, valor) {
  roteiroEmEdicao.dias[idx].elementos[eIdx][campo] = valor;
};

window.addAtracaoBloco = function(idx, eIdx, nome) {
  if(!nome.trim()) return;
  
  const dia = roteiroEmEdicao.dias[idx];
  if (dia && dia.data) {
    const chk = window.verificarFuncionamentoAtracao(nome.trim(), dia.data);
    if (chk.fechado) {
      let msg = '';
      if (chk.tipoBloqueio === 'semanal') {
        msg = `Aviso: A atração "${nome.trim()}" costuma estar FECHADA às ${chk.diaSemanaNome.toLowerCase()}s.\n\nDeseja adicionar mesmo assim?`;
      } else if (chk.tipoBloqueio === 'manutencao') {
        msg = `Aviso: A atração "${nome.trim()}" estará em manutenção/reforma de ${chk.inicio} a ${chk.fim} (${chk.motivo}).\n\nDeseja adicionar mesmo assim?`;
      }
      
      if (!confirm(msg)) {
        return;
      }
    }
  }
  
  roteiroEmEdicao.dias[idx].elementos[eIdx].atracoesDoDia.push(nome.trim());
  if(typeof renderEditDias === 'function') renderEditDias();
};

window.delAtracaoBloco = function(idx, eIdx, atrIdx) {
  roteiroEmEdicao.dias[idx].elementos[eIdx].atracoesDoDia.splice(atrIdx, 1);
  if(typeof renderEditDias === 'function') renderEditDias();
};

window.attachChipEvents = function() {
  document.querySelectorAll('.chip-atracao').forEach(chip => {
    chip.removeEventListener('mouseenter', showPopover);
    chip.removeEventListener('mouseleave', hidePopover);
    chip.addEventListener('mouseenter', showPopover);
    chip.addEventListener('mouseleave', hidePopover);
  });
};


let draggedAtr = null;

window.dragStartAtracao = function(e, dIdx, eIdx, aIdx) {
  draggedAtr = { dIdx, eIdx, aIdx };
  e.dataTransfer.effectAllowed = 'move';
  // Necessário para o Firefox:
  e.dataTransfer.setData('text/plain', aIdx);
  e.target.style.opacity = '0.5';
};

window.dragOverAtracao = function(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
};

window.dropAtracao = function(e, dIdx, eIdx, aIdx) {
  e.preventDefault();
  e.stopPropagation(); // Evita que caia no dropAtracaoBlock
  document.querySelectorAll('.chip-atracao').forEach(c => c.style.opacity = '1');
  
  if (!draggedAtr || draggedAtr.dIdx !== dIdx || draggedAtr.eIdx !== eIdx) return;
  if (draggedAtr.aIdx === aIdx) return; // Mesmo lugar
  
  const arr = roteiroEmEdicao.dias[dIdx].elementos[eIdx].atracoesDoDia;
  const item = arr.splice(draggedAtr.aIdx, 1)[0];
  arr.splice(aIdx, 0, item);
  
  draggedAtr = null;
  renderEditDias();
};

window.dropAtracaoBlock = function(e, dIdx, eIdx) {
  e.preventDefault();
  document.querySelectorAll('.chip-atracao').forEach(c => c.style.opacity = '1');
  
  if (!draggedAtr || draggedAtr.dIdx !== dIdx || draggedAtr.eIdx !== eIdx) return;
  
  // Caiu na área livre do bloco, joga pro final
  const arr = roteiroEmEdicao.dias[dIdx].elementos[eIdx].atracoesDoDia;
  const item = arr.splice(draggedAtr.aIdx, 1)[0];
  arr.push(item);
  
  draggedAtr = null;
  renderEditDias();
};

// Quando arrastar termina em qualquer lugar
document.addEventListener('dragend', function(e) {
  if (e.target && e.target.classList && e.target.classList.contains('chip-atracao')) {
    e.target.style.opacity = '1';
    draggedAtr = null;
  }
});


// ── ESTADIAS ROTEIROS ──────────────────────────────────────────
window.addRotEstadia = function() {
  if (!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {};
  if (!roteiroEmEdicao.cliente.estadias) roteiroEmEdicao.cliente.estadias = [];
  roteiroEmEdicao.cliente.estadias.push({ id: Date.now(), cidade: '', dataInicio: '', dataFim: '', hotel: '' });
  window.renderRotEstadias();
};

window.renderRotEstadias = function() {
  const cont = document.getElementById('rotEstadiasList');
  if (!cont) return;
  cont.innerHTML = '';
  if (!roteiroEmEdicao.cliente || !roteiroEmEdicao.cliente.estadias) return;
  roteiroEmEdicao.cliente.estadias.forEach((est, i) => {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <div class="item-row-header">
        <span class="item-row-num">Estadia ${i+1}</span>
        <button class="btn-remove" onclick="rmRotEstadia(${est.id})">✕</button>
      </div>
      <div class="form-grid-4">
        <div class="field"><label>Cidade</label><input type="text" value="${est.cidade}" placeholder="Ex: Tokyo" oninput="updRotEstadia(${est.id},'cidade',this.value)"></div>
        <div class="field"><label>Data Início</label><input type="date" value="${est.dataInicio}" oninput="updRotEstadia(${est.id},'dataInicio',this.value)"></div>
        <div class="field"><label>Data Fim</label><input type="date" value="${est.dataFim}" oninput="updRotEstadia(${est.id},'dataFim',this.value)"></div>
        <div class="field"><label>Hotel</label><input type="text" value="${est.hotel}" placeholder="Ex: The Celestine Tokyo" oninput="updRotEstadia(${est.id},'hotel',this.value)"></div>
      </div>`;
    cont.appendChild(div);
  });
};

window.rmRotEstadia = function(id) { 
  if (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.estadias) {
    roteiroEmEdicao.cliente.estadias = roteiroEmEdicao.cliente.estadias.filter(e => e.id !== id); 
    window.renderRotEstadias(); 
  }
};

window.updRotEstadia = function(id, f, v) { 
  if (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.estadias) {
    const e = roteiroEmEdicao.cliente.estadias.find(x => x.id === id); 
    if (e) e[f] = v; 
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnRotAddEstadia');
  if (btn) btn.addEventListener('click', window.addRotEstadia);
});

let _roteiroAutoSaveTimer = null;
window.triggerRoteiroAutoSave = function() {
  clearTimeout(_roteiroAutoSaveTimer);
  _roteiroAutoSaveTimer = setTimeout(async () => {
    if (!roteiroOriginalNome || !roteiroEmEdicao) return;
    if (typeof window.registrarEstadoRoteiro === 'function') {
      window.registrarEstadoRoteiro(roteiroEmEdicao);
    }
    const indicator = document.getElementById('roteiroAutoSaveIndicator');
    if (indicator) { indicator.textContent = 'Salvando...'; indicator.style.opacity = '1'; }
    
    try {
      dbRotas[roteiroOriginalNome] = roteiroEmEdicao;
      await fetch('/api/roteiros/' + encodeURIComponent(roteiroOriginalNome), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roteiroEmEdicao)
      });
      if (indicator) {
        indicator.textContent = 'Salvo automaticamente';
        setTimeout(() => { if(indicator) indicator.style.opacity = '0'; }, 1500);
      }
    } catch(e) {
      console.error('Erro no autosave', e);
      if (indicator) { indicator.textContent = 'Erro ao salvar'; }
    }
  }, 1000);
};

window.updateRoteiroHeader = function() {
  const t = document.getElementById('roteiroEditTitle');
  const s = document.getElementById('roteiroEditSubtitle');
  if(!t || !s) return;
  const cliente = roteiroEmEdicao.cliente || {};
  t.textContent = document.getElementById('editRoteiroNome')?.value || roteiroOriginalNome || 'Roteiro em Edição';
  const nome = cliente.nome || 'Sem nome';
  const data = cliente.dataOrcamento ? (cliente.dataOrcamento + (cliente.dataFim ? ' a ' + cliente.dataFim : '')) : 'Sem data definida';
  s.textContent = `Cliente: ${nome} | Viagem: ${data}`;
};


window.toggleImportNotionRoteiro = async function() {
    const btn = document.getElementById('btnImportNotionRoteiro');
    const selectWrapper = document.getElementById('rotNotionSelectWrapper');
    const select = document.getElementById('rotNotionClienteSelect');

    if (selectWrapper.style.display === 'none') {
        selectWrapper.style.display = 'block';
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Carregando...';
        
        try {
            if (typeof window.notionClients === 'undefined' || !window.notionClients || window.notionClients.length === 0) {
                const res = await fetch('/api/notion/clientes');
                if (res.ok) {
                    window.notionClients = await res.json();
                }
            }
            
            if (typeof window.notionClients === 'undefined' || !window.notionClients || window.notionClients.length === 0) {
                alert('Não foi possível carregar os clientes do Notion.');
                selectWrapper.style.display = 'none';
                return;
            }

            select.innerHTML = '<option value="">Selecione um cliente...</option>';
            window.notionClients.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.nome + ' (' + (c.adultos||0) + ' Ad / ' + (c.criancas||0) + ' Cr) - ' + (c.dataInicio || 'Sem Data');
                select.appendChild(opt);
            });
        } catch(e) {
            console.error(e);
            alert('Erro ao carregar clientes do Notion.');
            selectWrapper.style.display = 'none';
        } finally {
            btn.innerHTML = originalText;
        }
    } else {
        selectWrapper.style.display = 'none';
    }
}

window.vincularClienteRoteiroFromSelect = function() {
    const select = document.getElementById('rotNotionClienteSelect');
    const notionId = select.value;
    if (!notionId) return;
    
    const c = notionClients.find(x => x.id === notionId);
    if (!c) return;
    
    if (!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {};
    roteiroEmEdicao.cliente.notionClienteId = c.id;
    roteiroEmEdicao.cliente.nome = c.nome;
    roteiroEmEdicao.cliente.adultos = c.adultos;
    roteiroEmEdicao.cliente.criancas = c.criancas;
    roteiroEmEdicao.cliente.dataInicio = c.dataInicio;
    roteiroEmEdicao.cliente.dataFim = c.dataFim;
    roteiroEmEdicao.cliente.dataOrcamento = c.dataInicio;
    roteiroEmEdicao.cliente.vooChegada = c.vooChegada || '';
    roteiroEmEdicao.cliente.vooPartida = c.vooPartida || '';
    
    document.getElementById('rotClienteNome').value = c.nome || '';
    document.getElementById('rotClienteAdultos').value = c.adultos || '';
    document.getElementById('rotClienteCriancas').value = c.criancas || '';
    document.getElementById('rotClienteData').value = c.dataInicio || '';
    if(document.getElementById('rotClienteDataFim')) document.getElementById('rotClienteDataFim').value = c.dataFim || '';
    if(document.getElementById('rotClienteVooChegada')) document.getElementById('rotClienteVooChegada').value = c.vooChegada || '';
    if(document.getElementById('rotClienteVooPartida')) document.getElementById('rotClienteVooPartida').value = c.vooPartida || '';
    
    // Trava os campos imediatamente após o vínculo
    ['rotClienteNome', 'rotClienteAdultos', 'rotClienteCriancas'].forEach(id => {
      const el = document.getElementById(id);
      if(el) { el.readOnly = true; el.style = 'background:#f1f5f9; cursor:not-allowed'; }
    });
    
    document.getElementById('rotNotionSelectWrapper').style.display = 'none';
    select.value = '';
    const btnImport = document.getElementById('btnImportNotionRoteiro');
    if (btnImport) btnImport.style.display = 'none';
    
    if(typeof triggerRoteiroAutoSave === 'function') triggerRoteiroAutoSave();
    if(typeof updateRoteiroHeader === 'function') updateRoteiroHeader();
    const bEdit = document.getElementById('btnEditarClienteRoteiro'); if(bEdit) bEdit.innerHTML = '👤 Editar Cliente';
    alert('Dados do cliente ' + c.nome + ' importados do Notion com sucesso!');
}


window.handleAcaoClienteRoteiro = async function() {
  if (typeof roteiroEmEdicao !== 'undefined' && roteiroEmEdicao && roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.notionClienteId) {
    editarClienteNotion(roteiroEmEdicao.cliente.notionClienteId);
  } else {
    // Modo "Salvar Cliente no Notion"
    const nome = document.getElementById('rotClienteNome').value.trim();
    if (!nome) return alert('Preencha pelo menos o Nome do Cliente para salvar no Notion.');
    
    const btn = document.getElementById('btnEditarClienteRoteiro');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '⏳ Salvando...';
    btn.disabled = true;

    try {
      if(!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {};
      
      const payload = {
        nome: nome,
        adultos: document.getElementById('rotClienteAdultos').value,
        criancas: document.getElementById('rotClienteCriancas').value,
        dataInicio: document.getElementById('rotClienteData') ? document.getElementById('rotClienteData').value : '',
        dataFim: document.getElementById('rotClienteDataFim') ? document.getElementById('rotClienteDataFim').value : '',
        status: 'Lead',
        vooChegada: document.getElementById('rotClienteVooChegada') ? document.getElementById('rotClienteVooChegada').value : '',
        vooPartida: document.getElementById('rotClienteVooPartida') ? document.getElementById('rotClienteVooPartida').value : ''
      };

      const res = await fetch('/api/notion/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Falha ao salvar no Notion');
      
      const newClient = await res.json();
      roteiroEmEdicao.cliente.notionClienteId = newClient.id;
      
      // Salva localmente as estadias
      const estadiasArr = roteiroEmEdicao.estadias ? roteiroEmEdicao.estadias : [];
      await fetch('/api/clientes/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newClient.id, estadias: estadiasArr })
      });

      // Recarrega NotionClients
      window.notionClients = await fetch('/api/notion/clientes').then(r=>r.json());

      btn.innerHTML = '👤 Editar Cliente';
      btn.disabled = false;
      
      // Trava os campos
      ['rotClienteNome', 'rotClienteAdultos', 'rotClienteCriancas'].forEach(id => {
        const el = document.getElementById(id);
        if(el) { el.readOnly = true; el.style = 'background:#f1f5f9; cursor:not-allowed'; }
      });
      
      document.getElementById('rotNotionSelectWrapper').style.display = 'none';
      if(typeof triggerRoteiroAutoSave === 'function') triggerRoteiroAutoSave();
      if(typeof updateRoteiroHeader === 'function') updateRoteiroHeader();
      
      alert('Cliente criado no Notion e vinculado com sucesso!');

    } catch (e) {
      console.error(e);
      alert('Erro ao salvar cliente no Notion.');
      btn.innerHTML = oldHtml;
      btn.disabled = false;
    }
  }
};

window.selecionarRoteiro = function(nome, isHover = false) {
  if (document.getElementById('roteiroEditContainer').style.display === 'block') {
    if (isHover) return; // Não troca no hover se estiver no modo edição
  }
  
  if (nome && dbRotas[nome]) {
    window.roteiroAtualVisualizado = nome;
    
    // Atualiza a classe 'selected' nos cards de forma performática
    const listContainer = document.getElementById('roteirosLista');
    if (listContainer) {
      listContainer.querySelectorAll('.list-card').forEach(card => {
        if (card.dataset.nome === nome) {
          card.classList.add('selected');
        } else {
          card.classList.remove('selected');
        }
      });
    }
    
    document.getElementById('roteirosEmptyState').style.display = 'none';
    document.getElementById('roteirosDetailWrapper').style.display = 'block';
    
    // Mostra o preview
    document.getElementById('roteiroEditContainer').style.display = 'none';
    document.getElementById('roteiroTimeline').style.display = 'block';
    document.getElementById('roteiroPreviewHeader').style.display = 'flex';
    document.getElementById('roteiroPreviewTitle').textContent = nome;
    
    renderizarRoteiro(nome);
  }
};


window.filterRoteirosList = function() {
  const q = document.getElementById('pesquisaRoteirosList').value;
  renderListaRoteiros(q);
};

window.renderListaRoteiros = function(filtro = '') {
  const listContainer = document.getElementById('roteirosLista');
  if(!listContainer) return;
  listContainer.innerHTML = '';
  const q = filtro.toLowerCase();
  
  Object.keys(dbRotas).sort().forEach(nome => {
    if (!nome.toLowerCase().includes(q)) return;
    
    const r = dbRotas[nome];
    const isSelected = window.roteiroAtualVisualizado === nome ? 'selected' : '';
    const numDias = r.dias ? r.dias.length : 0;
    
    const card = document.createElement('div');
    card.className = 'list-card ' + isSelected;
    card.dataset.nome = nome;
    card.onclick = () => selecionarRoteiro(nome);
    card.onmouseenter = () => { if(window.roteiroAtualVisualizado !== nome) selecionarRoteiro(nome, true); };
    
    card.innerHTML = `
      <div class="list-card-title-row" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
        <div class="list-card-title" style="color:var(--crimson); font-weight: 600; margin-bottom: 0;">${nome}</div>
        <button class="btn-card-edit-minimalist" onclick="event.stopPropagation(); window.editarRoteiroCard('${nome}')" title="Editar">
          ✏️
        </button>
      </div>
      <div class="list-card-subtitle" style="margin-top: 4px;">${numDias} dia(s) de roteiro</div>
      <div class="list-card-meta">
        <span>${r.cliente?.notionClienteId ? 'Vinc. Cliente' : ''}</span>
      </div>
    `;
    listContainer.appendChild(card);
  });
};

window.editarRoteiroCard = function(nome) {
  if (!nome) return;
  if (nome !== 'Novo Roteiro' && !dbRotas[nome]) return;
  
  if (typeof navToPage === 'function') navToPage('roteiros');
  window.roteiroAtualVisualizado = nome;
  
  renderListaRoteiros(document.getElementById('pesquisaRoteirosList')?.value || '');
  
  roteiroOriginalNome = nome;
  const data = dbRotas[nome];
  if (Array.isArray(data)) {
    roteiroEmEdicao = { cliente: {nome:'', adultos:2, criancas:0, dataOrcamento:''}, dias: JSON.parse(JSON.stringify(data)) };
  } else {
    roteiroEmEdicao = JSON.parse(JSON.stringify(data));
    if (!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {nome:'', adultos:2, criancas:0, dataOrcamento:''};
    if (!roteiroEmEdicao.dias) roteiroEmEdicao.dias = [];
  }
  
  document.getElementById('roteirosEmptyState').style.display = 'none';
  document.getElementById('roteirosDetailWrapper').style.display = 'block';
  
  abrirEditorRoteiro(nome);
};

// Vincula o botão Novo Roteiro da lista lateral
document.addEventListener('DOMContentLoaded', () => {
  const btnNovoR = document.getElementById('btnNovoRoteiroList');
  if (btnNovoR) {
    btnNovoR.onclick = () => {
      if (typeof navToPage === 'function') navToPage('roteiros');
      window.novoRoteiro();
    };
  }
});

// ── UNDO HISTORY (CTRL+Z) FOR ROTEIRO ─────────────────────────────────────────
window.roteiroUndoStack = [];
window.registrarEstadoRoteiro = function(rotState) {
  if (!rotState) return;
  const strState = JSON.stringify(rotState);
  if (window.roteiroUndoStack.length > 0 && window.roteiroUndoStack[window.roteiroUndoStack.length - 1] === strState) {
    return;
  }
  window.roteiroUndoStack.push(strState);
  if (window.roteiroUndoStack.length > 30) {
    window.roteiroUndoStack.shift();
  }
};

window.desfazerAcaoRoteiro = function() {
  if (!window.roteiroUndoStack || window.roteiroUndoStack.length <= 1) {
    showToast('Nada para desfazer!');
    return;
  }
  window.roteiroUndoStack.pop();
  const estadoAnteriorStr = window.roteiroUndoStack[window.roteiroUndoStack.length - 1];
  const estadoAnterior = JSON.parse(estadoAnteriorStr);
  
  roteiroEmEdicao = estadoAnterior;
  
  const nomeAtual = document.getElementById('editRoteiroNome')?.value.trim();
  const nameToSave = window.roteiroOriginalNome || nomeAtual;
  if (nameToSave) {
    dbRotas[nameToSave] = estadoAnterior;
  }
  
  if (typeof renderEditDias === 'function') {
    renderEditDias();
  }
  
  window.triggerRoteiroAutoSave();
  
  showToast('Desfeito! ↩');
};

window.abrirModalGeradorIA = async function() {
  const modal = document.getElementById('modalPromptIA');
  if (!modal) return;

  // Resetar campos
  document.getElementById('iaInstrucoesPrompt').value = '';
  document.getElementById('iaDataInicio').value = '';
  document.getElementById('iaLoadingSpinner').style.display = 'none';
  document.getElementById('btnConfirmarGerarIA').disabled = false;
  document.getElementById('iaBriefingCliente').value = 'Nenhum briefing carregado do Notion para este cliente.';

  modal.style.display = 'flex';
  modal.classList.remove('hidden');
  modal.classList.add('active');

  // Buscar briefing se houver cliente vinculado
  if (roteiroEmEdicao && roteiroEmEdicao.notionClienteId) {
    document.getElementById('iaBriefingCliente').value = 'Buscando briefing no Notion...';
    try {
      const res = await fetch('/api/public/client-data/' + roteiroEmEdicao.notionClienteId);
      if (res.ok) {
        const data = await res.json();
        if (data.clientLocalInfo && data.clientLocalInfo.briefing) {
          document.getElementById('iaBriefingCliente').value = data.clientLocalInfo.briefing;
        } else {
          document.getElementById('iaBriefingCliente').value = 'Nenhum briefing cadastrado na ficha do Notion deste cliente.';
        }
      } else {
        document.getElementById('iaBriefingCliente').value = 'Não foi possível ler o briefing do Notion.';
      }
    } catch (err) {
      console.error(err);
      document.getElementById('iaBriefingCliente').value = 'Erro ao buscar o briefing no Notion.';
    }
  } else {
    document.getElementById('iaBriefingCliente').value = 'Roteiro sem cliente vinculado. Vincule um cliente no botão "Importar do Notion" se quiser carregar as preferências dele automaticamente.';
  }
};

window.fecharModalPromptIA = function() {
  const modal = document.getElementById('modalPromptIA');
  if (modal) {
    modal.classList.remove('active');
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
};

window.gerarRoteiroComIA = async function() {
  const spinner = document.getElementById('iaLoadingSpinner');
  const btn = document.getElementById('btnConfirmarGerarIA');
  const prompt = document.getElementById('iaInstrucoesPrompt').value.trim();
  const datas = document.getElementById('iaDataInicio').value;

  if (!prompt && (!roteiroEmEdicao || !roteiroEmEdicao.notionClienteId)) {
    alert('Por favor, digite alguma instrução para a IA saber qual roteiro criar!');
    return;
  }

  if (spinner) {
    spinner.style.display = 'flex';
    spinner.style.alignItems = 'center';
  }
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/roteiros/gerar-ia', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        clienteId: roteiroEmEdicao?.notionClienteId || '',
        promptAdicional: prompt,
        datas: datas
      })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || errData.details || 'Erro desconhecido na geração.');
    }

    const data = await res.json();
    if (data.success && data.data && Array.isArray(data.data.dias)) {
      // Registrar estado atual no undo stack
      if (typeof window.registrarEstadoRoteiro === 'function') {
        window.registrarEstadoRoteiro(roteiroEmEdicao);
      }

      // Substituir os dias do roteiro em edição pelos dias gerados pela IA
      roteiroEmEdicao.dias = data.data.dias;

      // Forçar re-renderização do editor
      if (typeof renderEditDias === 'function') {
        renderEditDias();
      }

      // Disparar o salvamento automático
      window.triggerRoteiroAutoSave();

      showToast('Roteiro gerado com IA com sucesso! 🪄');
      window.fecharModalPromptIA();
    } else {
      throw new Error('Formato de resposta da IA inválido.');
    }

  } catch (err) {
    console.error(err);
    alert('Erro ao gerar roteiro com IA: ' + err.message);
  } finally {
    if (spinner) spinner.style.display = 'none';
    if (btn) btn.disabled = false;
  }
};

