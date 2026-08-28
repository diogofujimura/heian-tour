
window.calcularRotaAutomaticaDia = function(dia) {
  if (!dia) return '';
  const chainCidades = [];
  (dia.elementos || []).forEach(el => {
    if (el.tipo === 'transporte') {
      if (el.cidadeOrigem) chainCidades.push(String(el.cidadeOrigem).trim());
      if (el.cidadeDestino) chainCidades.push(String(el.cidadeDestino).trim());
    } else if (el.tipo === 'sequencia' && el.cidade) {
      chainCidades.push(String(el.cidade).trim());
    }
  });
  const limpa = [];
  chainCidades.forEach(c => {
    if (c && (!limpa.length || limpa[limpa.length - 1].toLowerCase() !== c.toLowerCase())) {
      limpa.push(c);
    }
  });
  return limpa.join(' \u2192 ');
};

window.obterPrecoTransporte = function(el) {
  if (!el) return 0;
  
  const tipo = String(el.tipoTransporte || '').trim().toLowerCase();
  const linha = String(el.linha || '').trim().toLowerCase();
  const ctg = String(el.categoria || '').trim().toLowerCase();

  // Táxi, Aplicativo GO, Carro, Van ou Transporte a Pé / Variável nunca devem herdar preço de trem ou estimativas genéricas
  if (tipo.includes('taxi') || tipo.includes('táxi') || tipo.includes('carro') || tipo.includes('app go') || 
      linha.includes('app go') || linha.includes('táxi') || linha.includes('taxi') || 
      ctg.includes('variável') || ctg.includes('variavel') || ctg.includes('por conta')) {
    return 0;
  }

  // Se o elemento tiver valor explícito próprio
  if (el.preco_jpy != null && Number(el.preco_jpy) > 0) return Number(el.preco_jpy);
  if (el.valorAdulto != null && Number(el.valorAdulto) > 0) return Number(el.valorAdulto);
  if (el.valor != null && Number(el.valor) > 0) return Number(el.valor);
  
  if (typeof state !== 'undefined' && state && state.transportesDB && Array.isArray(state.transportesDB)) {
    // 1. Busca estrita por ID (se houver trechoId e o tipo coincidir)
    if (el.trechoId && el.trechoId !== 'custom') {
      const matchId = state.transportesDB.find(t => String(t.id) === String(el.trechoId));
      if (matchId) {
        const mTipo = String(matchId.tipo || '').toLowerCase();
        const mLinha = String(matchId.linha || '').toLowerCase();
        // Se o tipo mudou no card (ex: era trem e virou táxi), ignora o ID antigo
        if (!tipo || mTipo.includes(tipo) || tipo.includes(mTipo) || (!linha || mLinha.includes(linha) || linha.includes(mLinha))) {
          return Number(matchId.preco_jpy) || 0;
        }
      }
    }
    
    const orig = String(el.cidadeOrigem || '').trim().toLowerCase();
    const dest = String(el.cidadeDestino || '').trim().toLowerCase();

    // 2. Busca estrita: precisa bater Trecho E (Tipo E/OU Linha com exatidão)
    const match = state.transportesDB.find(t => {
      const tTrecho = String(t.trecho || '').toLowerCase();
      const tTipo = String(t.tipo || '').toLowerCase();
      const tLinha = String(t.linha || '').toLowerCase();
      const bateTrecho = (orig && dest && tTrecho.includes(orig) && tTrecho.includes(dest));
      if (!bateTrecho) return false;

      // Precisa bater o tipo de transporte (ex: Trem só bate com Trem, Shinkansen com Shinkansen)
      const bateTipo = tipo && tTipo && (tTipo.includes(tipo) || tipo.includes(tTipo));
      const bateLinha = linha && tLinha && (tLinha.includes(linha) || linha.includes(tLinha));
      
      return (bateTipo && (!linha || bateLinha)) || (bateLinha);
    });

    if (match && match.preco_jpy) return Number(match.preco_jpy);
  }
  return 0;
};

window.obterPrecoExperiencia = function(el) {
  if (!el) return 0;
  if (el.preco_jpy != null && Number(el.preco_jpy) > 0) return Number(el.preco_jpy);
  if (el.valorAdulto != null && Number(el.valorAdulto) > 0) return Number(el.valorAdulto);
  if (el.valor != null && Number(el.valor) > 0) return Number(el.valor);

  if (typeof state !== 'undefined' && state && state.experienciasDB && Array.isArray(state.experienciasDB)) {
    if (el.experienciaId && el.experienciaId !== 'custom') {
      const matchId = state.experienciasDB.find(e => String(e.id) === String(el.experienciaId));
      if (matchId) return Number(matchId.preco_jpy) || 0;
    }
    const nome = (el.nomeExp || el.nome || '').trim().toLowerCase();
    if (nome && nome.length > 3) {
      const match = state.experienciasDB.find(e => {
        const en = (e.nome || '').toLowerCase().trim();
        return en === nome || (en.length > 4 && (en.includes(nome) || nome.includes(en)));
      });
      if (match && match.preco_jpy) return Number(match.preco_jpy);
    }
  }
  return 0;
};

window.obterPrecoAtracao = function(atrNome) {
  if (!atrNome) return '';
  const atr = window.buscarAtracaoNoMapa ? window.buscarAtracaoNoMapa(atrNome) : null;
  if (!atr) return '';
  const p = atr['Preço (Ingresso)'] || atr['Preço'] || atr['preco'] || '';
  if (!p || p === '—' || p.toLowerCase().includes('gratuito') || p.toLowerCase().includes('grátis') || p === '0' || p === '¥0') {
    return '';
  }
  const limpo = String(p).trim();
  if (/^\d+$/.test(limpo)) {
    return `~¥${Number(limpo).toLocaleString('pt-BR')}`;
  }
  if (!limpo.startsWith('~') && !limpo.startsWith('¥') && !limpo.toLowerCase().includes('yen')) {
    return `~${limpo}`;
  }
  return limpo;
};

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

// Snapshot da última versão salva do roteiro: abrir um roteiro não deve gravá-lo;
// o autosave só envia ao servidor quando algo mudou de verdade.
window._lastSavedRoteiroSig = null;
window.roteiroSignature = function() {
  try {
    const nomeAtual = document.getElementById('editRoteiroNome')?.value.trim() || '';
    return (window.roteiroOriginalNome || nomeAtual) + '|' + JSON.stringify(roteiroEmEdicao);
  } catch (e) { return null; }
};
window.marcarBaselineRoteiro = function() {
  window._lastSavedRoteiroSig = window.roteiroSignature();
};

window.autoSaveRoteiro = function() {
  if (!roteiroEmEdicao || !roteiroEmEdicao.dias || roteiroEmEdicao.dias.length === 0) return;
  clearTimeout(_autoSaveRoteiroTimer);

  // Nada mudou desde a última gravação/abertura? Não grava.
  const sigAgora = window.roteiroSignature();
  if (sigAgora && sigAgora === window._lastSavedRoteiroSig) return;

  const indicator = document.getElementById('roteiroAutoSaveIndicator');
  if (indicator) {
    indicator.textContent = 'Salvando...';
    indicator.style.opacity = '1';
  }

  _autoSaveRoteiroTimer = setTimeout(async () => {
    const nomeAtual = document.getElementById('editRoteiroNome')?.value.trim();
    const nameToSave = window.roteiroOriginalNome || nomeAtual;
    if (!nameToSave) return;

    // Reconfere no momento do disparo (o estado pode ter voltado ao original)
    const sigDisparo = window.roteiroSignature();
    if (sigDisparo && sigDisparo === window._lastSavedRoteiroSig) {
      if (indicator) { indicator.textContent = 'Salvo automaticamente'; indicator.style.opacity = '0.4'; }
      return;
    }
    
    try {
      // Chave imutável (rot_...) quando disponível; nome legado como fallback
      const chaveSave = roteiroEmEdicao.id || nameToSave;
      if (nomeAtual) roteiroEmEdicao.nome = nomeAtual;
      const res = await fetch(`/api/roteiros/${encodeURIComponent(chaveSave)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...roteiroEmEdicao, _baseVersao: roteiroEmEdicao.atualizadoEm })
      });
      if (res.status === 409) {
        let _err = null; try { _err = await res.json(); } catch (e) {}
        if (_err && _err.error === 'reducao') { if (indicator) { indicator.textContent = '⚠ Alteração retida (segurança)'; indicator.style.opacity = '1'; } return; }
        if (indicator) { indicator.textContent = 'Conflito de edição!'; indicator.style.opacity = '1'; }
        if (!window.__conflitoRoteiroAvisado) {
          window.__conflitoRoteiroAvisado = true;
          alert('Este roteiro foi alterado em outra sessão (outra aba ou outro usuário).\nSuas últimas alterações NÃO foram salvas.\nRecarregue a página para pegar a versão mais recente antes de continuar.');
        }
        return;
      }
      if (res.ok) {
        try {
          const j = await res.json();
          if (j && j.id) roteiroEmEdicao.id = j.id;
          if (j && j.atualizadoEm) roteiroEmEdicao.atualizadoEm = j.atualizadoEm;
        } catch (e) { /* resposta sem json não impede o fluxo */ }
        dbRotas[nameToSave] = JSON.parse(JSON.stringify(roteiroEmEdicao));
        window._lastSavedRoteiroSig = window.roteiroSignature();
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
    
    const isRoteiroPage = (window.location.hash.replace('#', '') === 'roteiros' || localStorage.getItem('heian_last_page') === 'roteiros');
    const lastRoteiroNome = localStorage.getItem('heian_last_roteiro_nome') || localStorage.getItem('heian_last_roteiro');

    if (isRoteiroPage && lastRoteiroNome && dbRotas && dbRotas[lastRoteiroNome]) {
      if (typeof navToPage === 'function') navToPage('roteiros');
      if (typeof window.editarRoteiroCard === 'function') {
        window.editarRoteiroCard(lastRoteiroNome);
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
      <strong class="preco-brt">Gratuito</strong>
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
  // Agrupar atrações por bairro
  const atracoesPorBairro = {};
  dbAtracoes.forEach(a => {
    if (!a) return;
    if (cidade && a['Cidade'] && a['Cidade'].toLowerCase() !== cidade.toLowerCase()) return;
    if (!a['Nome da Atração']) return;
    
    const bairro = a['Bairro'] || 'Outros / Sem Bairro';
    if (!atracoesPorBairro[bairro]) atracoesPorBairro[bairro] = [];
    
    if (!atracoesPorBairro[bairro].some(x => x['Nome da Atração'] === a['Nome da Atração'])) {
      atracoesPorBairro[bairro].push(a);
    }
  });

  // Ordenar bairros
  const bairrosOrdenados = Object.keys(atracoesPorBairro).sort((x, y) => {
    if (x === 'Outros / Sem Bairro') return 1;
    if (y === 'Outros / Sem Bairro') return -1;
    return x.localeCompare(y);
  });

  // Preencher datalist formatado e agrupado
  bairrosOrdenados.forEach(bairro => {
    const itens = atracoesPorBairro[bairro].sort((x, y) => x['Nome da Atração'].localeCompare(y['Nome da Atração']));
    itens.forEach(item => {
      const nome = item['Nome da Atração'];
      const isBairroLabel = (item['Bairro'] && item['Bairro'].toLowerCase() === nome.toLowerCase()) || nome.toLowerCase().includes('bairro');
      
      const label = isBairroLabel ? '(Bairro)' : '(Atração)';
      const textoFormatado = `📍 ${bairro} | ${nome} ${label}`;
      dlAtr.appendChild(new Option(textoFormatado, textoFormatado));
    });
  });
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
    
    const badgeGuiado = rota.tourGuiado ? `<span class="badge" style="background:var(--gold); color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:8px; vertical-align:middle; display:inline-flex; align-items:center; gap:3px;"><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-compass"></use></svg> Tour Guiado</span>` : '';
    const badgeDeslocamento = temDeslocamento ? `<span class="badge" style="background:#C4A35A; color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; vertical-align:middle; display:inline-flex; align-items:center; gap:3px;"><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-shuffle"></use></svg> Deslocamento</span>` : '';
    const badgeExperiencia = temExperiencia ? `<span class="badge" style="background:var(--crimson); color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; vertical-align:middle; display:inline-flex; align-items:center; gap:3px; border: 1px solid rgba(255,255,255,0.4);"><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-ticket"></use></svg> Experiência</span>` : '';

    let elementosHtml = rota.elementos.map(el => {
      if (el.tipo === 'info') {
        const parts = [];
        if (el.dataDoTour) {
          const d = new Date(el.dataDoTour);
          parts.push(isNaN(d) ? el.dataDoTour : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' }));
        }
        if (el.horarioEncontro) parts.push(`Encontro: ${el.horarioEncontro}`);
        if (el.duracaoTour) parts.push(`Duração: ${el.duracaoTour}`);
        if (el.localEncontro) parts.push(`Local: ${el.localEncontro}`);
        if (parts.length > 0) return `<div style="font-size:12px; color:var(--text-sec); margin-bottom:12px; font-weight:500; background:#f9f9f9; padding:6px 12px; border-radius:4px; display:inline-block">${parts.join(' &nbsp;|&nbsp; ')}</div>`;
        return '';
      } else if (el.tipo === 'texto') {
        return el.conteudo ? `<div style="font-size:13px; color:var(--text-main); margin-bottom:16px; line-height:1.6; border-left:3px solid var(--gold-lt); padding-left:12px; font-style:italic">${el.conteudo}</div>` : '';
      } else if (el.tipo === 'transporte') {
        const origem = el.cidadeOrigem || 'Origem';
        const destino = el.cidadeDestino || 'Destino';
        const transpNome = el.tipoTransporte ? `${el.tipoTransporte} (${el.linha})` : 'Deslocamento a definir';
        const ctg = el.categoria ? ` - ${el.categoria}` : '';
        const duracao = el.tempo ? ` <span style="color:var(--gold-dk); font-weight:bold;">[${el.tempo}]</span>` : '';
        const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : ''); const pss = pText ? ` - ${pText}` : '';
        const h = el.horario ? `${el.horario}` : '';
        const horaText = h ? `<span style="color:#000; font-weight:bold; font-size:14px; margin-left:8px;">${h}</span>` : '';
        
        return `
          <div style="margin-bottom:16px; border-left:4px solid #C4A35A; padding-left:12px; background:linear-gradient(to right, rgba(196,163,90,0.06), transparent); padding-top:8px; padding-bottom:8px; border-radius:8px">
            <div style="margin-bottom:4px; display:flex; flex-wrap:wrap; align-items:center">
              <strong style="color:#9c8248; font-size:12px; text-transform:uppercase; margin-right:8px">Deslocamento ${horaText}</strong>
            </div>
            <div style="font-size:13px; color:var(--text-main); font-weight:600">${origem} ➔ ${destino}</div>
            <div style="font-size:11px; color:var(--text-sec); margin-top:2px">${transpNome}${ctg}${duracao}${pss} ${el.compradoHeian !== false ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em; display:inline-flex; align-items:center; gap:2px;"><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-check"></use></svg> Comprado pela Heian</span>' : '<span style="font-size:9px; background:#e2d9cf; color:#5c4a3d; padding:2px 6px; border-radius:4px; margin-left:4px; font-weight:600; display:inline-flex; align-items:center; gap:2px;"><svg class="v-icon" style="stroke:#5c4a3d; width:1em; height:1em; margin-right:0;"><use href="#icon-user"></use></svg> Comprado pelo cliente</span>'}</div>
          </div>`;
      } else if (el.tipo === 'experiencia') {
        const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : ''); const p = pText ? (el.horaPartida ? ` &nbsp;|&nbsp; Viajantes: ${pText}` : `Viajantes: ${pText}`) : '';
        const h = el.horaPartida ? `<span style="color:#000; font-weight:bold; font-size:14px; margin-right:8px;">${el.horaPartida}</span>` : '';
        return `
          <div style="margin-bottom:16px; border-left:4px solid var(--crimson); padding-left:12px; background:linear-gradient(to right, rgba(107,31,42,0.06), transparent); padding-top:8px; padding-bottom:8px; border-radius:8px">
            <div style="margin-bottom:4px; display:flex; flex-wrap:wrap; align-items:center">
              <strong style="color:var(--crimson); font-size:12px; text-transform:uppercase; margin-right:8px">Tickets & Experiências</strong>
            </div>
            <div style="font-size:13px; color:var(--text-main); font-weight:600">${el.nomeExp || 'Experiência a definir'}</div>
            <div style="font-size:11px; color:var(--text-sec); margin-top:2px">${h}${p} ${el.compradoHeian !== false ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em; display:inline-flex; align-items:center; gap:2px;"><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-check"></use></svg> Comprado pela Heian</span>' : '<span style="font-size:9px; background:#e2d9cf; color:#5c4a3d; padding:2px 6px; border-radius:4px; margin-left:4px; font-weight:600; display:inline-flex; align-items:center; gap:2px;"><svg class="v-icon" style="stroke:#5c4a3d; width:1em; height:1em; margin-right:0;"><use href="#icon-user"></use></svg> Comprado pelo cliente</span>'}</div>
          </div>`;
      } else if (el.tipo === 'sequencia') {
        const semNomeRota = !el.nomeDaRota;
        const tituloRota = el.nomeDaRota || (el.cidade ? 'Passeio em ' + el.cidade : 'Passeio do dia');
        const cidadeText = (el.cidade && !semNomeRota) ? `<span style="color:var(--gold-dk); font-weight:600; font-size:11px; text-transform:uppercase; margin-right:8px">${el.cidade}</span>` : '';
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
  
  const clienteId = rotasData.notionClienteId || window.clienteAtualVisualizado || '';

  timeline.innerHTML = '';
  rotas.forEach((rotaOrig, index) => {
    const rota = migrarDiaParaNovaEstrutura(rotaOrig);
    
    // Tenta obter a data correspondente ao dia com base na data de início do cliente
    let dataDoDiaStr = '';
    if (typeof notionClients !== 'undefined' && clienteId) {
      const cliente = notionClients.find(c => c.id === clienteId);
      if (cliente && cliente.dataInicio) {
        try {
          const dt = new Date(cliente.dataInicio + 'T00:00:00');
          if (!isNaN(dt.getTime())) {
            dt.setDate(dt.getDate() + index);
            const y = dt.getFullYear();
            const m = String(dt.getMonth() + 1).padStart(2, '0');
            const d = String(dt.getDate()).padStart(2, '0');
            dataDoDiaStr = `${y}-${m}-${d}`;
          }
        } catch(err) {
          console.error("Erro ao calcular data do dia:", err);
        }
      }
    }

    const card = document.createElement('div');
    card.className = 'dia-card';
    card.style.marginBottom = '24px';
    
    const temDeslocamento = rota.elementos.some(el => el.tipo === 'transporte');
    const temExperiencia = rota.elementos.some(el => el.tipo === 'experiencia');
    
    const badgeGuiado = rota.tourGuiado ? `<span class="badge" style="background:var(--gold); color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:8px; vertical-align:middle; display:inline-flex; align-items:center; gap:3px;"><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-compass"></use></svg> Tour Guiado</span>` : '';
    const badgeDeslocamento = temDeslocamento ? `<span class="badge" style="background:#C4A35A; color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; vertical-align:middle; display:inline-flex; align-items:center; gap:3px;"><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-shuffle"></use></svg> Deslocamento</span>` : '';
    const badgeExperiencia = temExperiencia ? `<span class="badge" style="background:var(--crimson); color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; vertical-align:middle; display:inline-flex; align-items:center; gap:3px; border: 1px solid rgba(255,255,255,0.4);"><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-ticket"></use></svg> Experiência</span>` : '';

    let elementosHtml = rota.elementos.map((el, elIdx) => {
      if (el.tipo === 'info') {
        const parts = [];
        if (el.dataDoTour) {
          const d = new Date(el.dataDoTour);
          parts.push(`${isNaN(d) ? el.dataDoTour : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`);
        }
        if (el.horarioEncontro) parts.push(`Encontro: ${el.horarioEncontro}`);
        if (el.duracaoTour) parts.push(`Duração: ${el.duracaoTour}`);
        if (el.localEncontro) parts.push(`Local: ${el.localEncontro}`);
        if (parts.length > 0) return `<div style="font-size:12px; color:var(--text-sec); margin-bottom:12px; font-weight:500; background:#f9f9f9; padding:6px 12px; border-radius:4px; display:inline-block">${parts.join(' &nbsp;|&nbsp; ')}</div>`;
        return '';
      } else if (el.tipo === 'texto') {
        return el.conteudo ? `<div style="font-size:13px; color:var(--text-main); margin-bottom:16px; line-height:1.6; border-left:3px solid var(--gold-lt); padding-left:12px; font-style:italic">${el.conteudo}</div>` : '';
      } else if (el.tipo === 'transporte') {
        const origem = el.cidadeOrigem || 'Origem';
        const destino = el.cidadeDestino || 'Destino';
        const transpNome = el.tipoTransporte ? `${el.tipoTransporte} (${el.linha})` : 'Deslocamento a definir';
        const ctg = el.categoria ? ` - ${el.categoria}` : '';
        const duracao = el.tempo ? ` <span style="color:var(--gold-dk); font-weight:bold;">[${el.tempo}]</span>` : '';
        const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : ''); const pss = pText ? ` - ${pText}` : '';
        const h = el.horario ? `${el.horario}` : '';
        const horaText = h ? `<span style="color:#000; font-weight:bold; font-size:14px; margin-left:8px;">${h}</span>` : '';
        
        let voucherBadge = '';
        if (el.compradoHeian !== false && el.tipoTransporte) {
          const v = window.currentEditingVouchers ? window.currentEditingVouchers.find(x => {
            if (!x.atracaoNome) return false;
            if (el.refId) return x.atracaoNome === 'ref:' + el.refId;
            const target = x.atracaoNome.toLowerCase();
            return target === `transporte:${el.tipoTransporte.toLowerCase()}` || target.includes(el.tipoTransporte.toLowerCase());
          }) : null;

          if (v) {
            const editAction = `window.uploadRapidoVoucherAdmin('${clienteId}', '${(v.atracaoNome || '').replace(/'/g, "\\'")}', '${v.nome.replace(/'/g, "\\'")}', '${v.dataUso || ''}', '${v.id}')`;
            voucherBadge = `<span onclick="event.stopPropagation(); ${editAction}" style="font-size:9px; background:#10b981; color:white; padding:2px 6px; border-radius:4px; margin-left:6px; text-transform:uppercase; letter-spacing:0.05em; cursor:pointer; display:inline-flex; align-items:center; gap:2px;" title="Ingresso anexado. Clique para editar."><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-ticket"></use></svg> Ingresso Ok</span>`;
          } else {
            const suggestionsName = `Bilhete - ${el.tipoTransporte}`;
            const suggestionsDate = el.data || dataDoDiaStr || '';
            const _vkeyT = el.refId ? ('ref:' + el.refId) : ('transporte:' + el.tipoTransporte);
            const actionClick = `window.uploadRapidoVoucherAdmin('${clienteId}', '${String(_vkeyT).replace(/'/g, "\\'")}', '${suggestionsName.replace(/'/g, "\\'")}', '${suggestionsDate}')`;
            voucherBadge = `<span onclick="event.stopPropagation(); ${actionClick}" style="font-size:9px; background:#ef4444; color:white; padding:2px 6px; border-radius:4px; margin-left:6px; text-transform:uppercase; letter-spacing:0.05em; cursor:pointer; display:inline-flex; align-items:center; gap:2px;" title="Falta o bilhete! Clique para upload rápido."><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-alert-triangle"></use></svg> Sem Ingresso</span>`;
          }
        } else if (el.compradoHeian !== false) {
          voucherBadge = `<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:6px; text-transform:uppercase; letter-spacing:0.05em; display:inline-flex; align-items:center; gap:2px;"><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-check"></use></svg> Emitido p/ Heian</span>`;
        }
        
        let instrucaoAdicional = '';
        if (v) {
          if (el.instrucoesPosCompra) {
            instrucaoAdicional = `<div style="font-size:11px; color:#15803d; margin-top:4px; font-style:italic">Pós-compra: ${el.instrucoesPosCompra}</div>`;
          }
        } else {
          if (el.instrucoesPreCompra) {
            instrucaoAdicional = `<div style="font-size:11px; color:#b45309; margin-top:4px; font-style:italic">Pré-compra: ${el.instrucoesPreCompra}</div>`;
          }
        }
        
        return `
          <div onclick="window.editarElementoRoteiroRapido('${roteiroNome.replace(/'/g, "\\'")}', ${index}, ${elIdx})" style="margin-bottom:16px; border-left:4px solid #C4A35A; padding-left:12px; background:linear-gradient(to right, rgba(196,163,90,0.06), transparent); padding-top:8px; padding-bottom:8px; border-radius:8px; cursor:pointer;" title="Clique para editar este deslocamento">
            <div style="margin-bottom:4px; display:flex; flex-wrap:wrap; align-items:center">
              <strong style="color:#9c8248; font-size:12px; text-transform:uppercase; margin-right:8px">Deslocamento ${horaText}</strong>
            </div>
            <div style="font-size:13px; color:var(--text-main); font-weight:600">${origem} ➔ ${destino}</div>
            <div style="font-size:11px; color:var(--text-sec); margin-top:2px">${transpNome}${ctg}${duracao}${pss} ${voucherBadge}</div>
            ${instrucaoAdicional}
          </div>`;
      } else if (el.tipo === 'experiencia') {
        const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : ''); const p = pText ? (el.horaPartida ? ` &nbsp;|&nbsp; ${pText}` : `${pText}`) : '';
        const h = el.horaPartida ? `<span style="color:#000; font-weight:bold; font-size:14px; margin-right:8px;">${el.horaPartida}</span>` : '';
        
        let voucherBadge = '';
        if (el.compradoHeian !== false && el.nomeExp) {
          const v = window.currentEditingVouchers ? window.currentEditingVouchers.find(x => {
            if (!x.atracaoNome) return false;
            if (el.refId) return x.atracaoNome === 'ref:' + el.refId;
            const target = x.atracaoNome.toLowerCase();
            return target === `experiencia:${el.nomeExp.toLowerCase()}` || target.includes(el.nomeExp.toLowerCase()) || target === `atracao:${el.nomeExp.toLowerCase()}`;
          }) : null;

          if (v) {
            const editAction = `window.uploadRapidoVoucherAdmin('${clienteId}', '${(v.atracaoNome || '').replace(/'/g, "\\'")}', '${v.nome.replace(/'/g, "\\'")}', '${v.dataUso || ''}', '${v.id}')`;
            voucherBadge = `<span onclick="event.stopPropagation(); ${editAction}" style="font-size:9px; background:#10b981; color:white; padding:2px 6px; border-radius:4px; margin-left:6px; text-transform:uppercase; letter-spacing:0.05em; cursor:pointer; display:inline-flex; align-items:center; gap:2px;" title="Ingresso anexado. Clique para editar."><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-ticket"></use></svg> Ingresso Ok</span>`;
          } else {
            const suggestionsName = `Ingresso - ${el.nomeExp}`;
            const suggestionsDate = el.dataDoTour || el.data || dataDoDiaStr || '';
            const _vkeyE = el.refId ? ('ref:' + el.refId) : ('experiencia:' + el.nomeExp);
            const actionClick = `window.uploadRapidoVoucherAdmin('${clienteId}', '${String(_vkeyE).replace(/'/g, "\\'")}', '${suggestionsName.replace(/'/g, "\\'")}', '${suggestionsDate}')`;
            voucherBadge = `<span onclick="event.stopPropagation(); ${actionClick}" style="font-size:9px; background:#ef4444; color:white; padding:2px 6px; border-radius:4px; margin-left:6px; text-transform:uppercase; letter-spacing:0.05em; cursor:pointer; display:inline-flex; align-items:center; gap:2px;" title="Falta o ingresso! Clique para upload rápido."><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-alert-triangle"></use></svg> Sem Ingresso</span>`;
          }
        } else if (el.compradoHeian !== false) {
          voucherBadge = `<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:6px; text-transform:uppercase; letter-spacing:0.05em; display:inline-flex; align-items:center; gap:2px;"><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-check"></use></svg> Emitido p/ Heian</span>`;
        }

        let instrucaoAdicional = '';
        if (v) {
          if (el.instrucoesPosCompra) {
            instrucaoAdicional = `<div style="font-size:11px; color:#15803d; margin-top:4px; font-style:italic">Pós-compra: ${el.instrucoesPosCompra}</div>`;
          }
        } else {
          if (el.instrucoesPreCompra) {
            instrucaoAdicional = `<div style="font-size:11px; color:#b45309; margin-top:4px; font-style:italic">Pré-compra: ${el.instrucoesPreCompra}</div>`;
          }
        }

        return `
          <div onclick="window.editarElementoRoteiroRapido('${roteiroNome.replace(/'/g, "\\'")}', ${index}, ${elIdx})" style="margin-bottom:16px; border-left:4px solid var(--crimson); padding-left:12px; background:linear-gradient(to right, rgba(107,31,42,0.06), transparent); padding-top:8px; padding-bottom:8px; border-radius:8px; cursor:pointer;" title="Clique para editar este ingresso/experiência">
            <div style="margin-bottom:4px; display:flex; flex-wrap:wrap; align-items:center">
              <strong style="color:var(--crimson); font-size:12px; text-transform:uppercase; margin-right:8px">Tickets & Experiências</strong>
            </div>
            <div style="font-size:13px; color:var(--text-main); font-weight:600">${el.nomeExp || 'Experiência a definir'}</div>
            <div style="font-size:11px; color:var(--text-sec); margin-top:2px">${h}${p} ${voucherBadge}</div>
            ${instrucaoAdicional}
          </div>`;
      } else if (el.tipo === 'sequencia') {
        const semNomeRota = !el.nomeDaRota;
        const tituloRota = el.nomeDaRota || (el.cidade ? 'Passeio em ' + el.cidade : 'Passeio do dia');
        const cidadeText = (el.cidade && !semNomeRota) ? `<span style="color:var(--gold-dk); font-weight:600; font-size:11px; text-transform:uppercase; margin-right:8px">${el.cidade}</span>` : '';
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
  
  let extraClass = '';
  let isBairro = false;
  if (match) {
    const bairro = match['Bairro'] || '';
    isBairro = (bairro && bairro.toLowerCase() === nomeAtracao.toLowerCase()) || nomeAtracao.toLowerCase().includes('bairro');
  } else {
    isBairro = nomeAtracao.toLowerCase().includes('bairro');
  }
  
  let prefixo = '';
  if (isBairro) {
    extraClass += ' bairro';
    prefixo = '• ';
  } else {
    extraClass += ' sub-atracao';
    prefixo = '› ';
  }
  
  return `<div class="chip-atracao ${isMissing}${extraClass}" data-id="${nomeAtracao.replace(/"/g, '&quot;')}" onclick="if(window.abrirModalEdicaoAtracao) window.abrirModalEdicaoAtracao('${nomeAtracao.replace(/'/g, "\\\\'")}')" style="cursor:pointer;">${prefixo}${nomeAtracao}</div>`;
}

function showPopover(e) {
  const chip = e.currentTarget || e.target;
  const nome = chip.getAttribute('data-id');
  const atracao = window.buscarAtracaoNoMapa(nome);
  
  let popover = document.getElementById('atracaoPopover');
  if (!popover) {
    popover = document.createElement('div');
    popover.className = 'atracao-popover';
    popover.id = 'atracaoPopover';
    popover.innerHTML = `
      <div class="popover-foto-container" style="position:relative; width:100%; height:140px; border-radius:8px; overflow:hidden; margin-bottom:12px;">
        <img id="popFoto" class="popover-foto" src="" alt="Atração" style="width:100%; height:100%; object-fit:cover;">
      </div>
      <div class="popover-bairro" id="popBairro" style="font-size: 10px; text-transform: uppercase; color: var(--gold-dk); letter-spacing: 0.05em; margin-bottom: 4px;">Bairro</div>
      <div class="popover-titulo" id="popTitulo" style="font-family: var(--ff-display); font-size: 19px; color: var(--crimson); margin-bottom: 8px; font-weight: 500;">Nome da Atração</div>
      <div class="popover-desc" id="popDesc" style="font-size: 12px; color: var(--ink-mid); line-height: 1.5; margin-bottom: 12px;">Descrição resumida...</div>
      <div class="popover-preco" id="popPreco" style="font-size: 13px; font-weight: 500; color: var(--ink); border-top: 1px solid rgba(196, 163, 90, 0.12); padding-top: 10px; display: flex; justify-content: space-between;">
        <span>Preço:</span>
        <strong>Gratuito</strong>
      </div>
      <div class="popover-funcionamento" id="popFuncionamento" style="display:none; margin-top:8px; font-size:11px; padding:6px 10px; border-radius:6px; background:rgba(107,31,42,0.06); border:1px solid rgba(107,31,42,0.12); color:var(--crimson);">
        <span id="popFuncionamentoTexto"></span>
      </div>
      <a id="popMapsAdminBtn" href="#" target="_blank" rel="noopener noreferrer" style="display:flex; align-items:center; justify-content:center; gap:6px; width:100%; margin-top:10px; padding:7px 12px; background:#2563eb; color:white; border-radius:8px; font-weight:600; font-size:11.5px; text-decoration:none; box-sizing:border-box;">
        <span>📍 Abrir no Google Maps ↗</span>
      </a>
      <button id="popEditarBtn" type="button" style="margin-top:8px; width:100%; padding:7px 12px; border:1px solid var(--crimson); background:var(--crimson); color:#fff; border-radius:8px; font-size:11.5px; font-weight:500; cursor:pointer;">Editar atração</button>
    `;
    document.body.appendChild(popover);
    var _pe = document.getElementById('popEditarBtn');
    if (_pe) _pe.addEventListener('click', function(ev){
      ev.stopPropagation();
      var n = popover.dataset.atr;
      if (window.__closeChipPopover) window.__closeChipPopover();
      if (window.abrirModalEdicaoAtracao) window.abrirModalEdicaoAtracao(n);
    });
  }
  // Garante o botão Editar e Maps mesmo quando o popover foi criado por criarPopover()
  if (popover && !document.getElementById('popMapsAdminBtn')) {
    var _pmB = document.createElement('a');
    _pmB.id = 'popMapsAdminBtn';
    _pmB.target = '_blank';
    _pmB.rel = 'noopener noreferrer';
    _pmB.setAttribute('style', 'display:flex; align-items:center; justify-content:center; gap:6px; width:100%; margin-top:10px; padding:7px 12px; background:#2563eb; color:white; border-radius:8px; font-weight:600; font-size:11.5px; text-decoration:none; box-sizing:border-box;');
    _pmB.innerHTML = '<span>📍 Abrir no Google Maps ↗</span>';
    popover.appendChild(_pmB);
  }
  if (popover && !document.getElementById('popEditarBtn')) {
    var _peB = document.createElement('button');
    _peB.id = 'popEditarBtn';
    _peB.type = 'button';
    _peB.textContent = 'Editar atração';
    _peB.setAttribute('style', 'margin-top:8px; width:100%; padding:7px 12px; border:1px solid var(--crimson); background:var(--crimson); color:#fff; border-radius:8px; font-size:11.5px; font-weight:500; cursor:pointer;');
    _peB.addEventListener('click', function(ev){
      ev.stopPropagation();
      var n = popover.dataset.atr;
      if (window.__closeChipPopover) window.__closeChipPopover();
      if (window.abrirModalEdicaoAtracao) window.abrirModalEdicaoAtracao(n);
    });
    popover.appendChild(_peB);
  }
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

    const mapsAdminBtn = document.getElementById('popMapsAdminBtn');
    if (mapsAdminBtn) {
      const mUrl = atracao['Link do Google Maps'] || atracao['Google Maps'] || atracao.linkMaps || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((atracao['Nome da Atração'] || nome) + ' ' + (atracao['Bairro'] || '') + ' ' + (atracao['Cidade'] || 'Tokyo') + ' Japan')}`;
      mapsAdminBtn.href = mUrl;
    }
  } else {
    // Fallback para atrações que estão na rota mas não têm cadastro detalhado
    document.getElementById('popBairro').textContent = 'Ponto de Interesse';
    document.getElementById('popTitulo').textContent = nome;
    document.getElementById('popDesc').textContent = 'Atração apenas citada no roteiro. Detalhamento e preços não cadastrados no banco.';
    const mapsAdminBtn = document.getElementById('popMapsAdminBtn');
    if (mapsAdminBtn) {
      mapsAdminBtn.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nome + ' Japan')}`;
    }
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
  popover.dataset.atr = nome;
  popover.style.pointerEvents = 'none';
  popover.classList.add('visible');
}

function hidePopover() {
  const popover = document.getElementById('atracaoPopover');
  if (popover) popover.classList.remove('visible');
}

window.__openChipPopover = function(chip){
  if (!chip) return;
  showPopover({ currentTarget: chip });
  var _p = document.getElementById('atracaoPopover');
  if (_p) { _p.style.pointerEvents = 'auto'; }  // card clicável (hover mantém none)
};
window.__closeChipPopover = function(){ hidePopover(); };
document.addEventListener('click', function(e){
  var pop = document.getElementById('atracaoPopover');
  if (!pop || !pop.classList.contains('visible')) return;
  if (e.target.closest && (e.target.closest('.atracao-popover') || e.target.closest('.chip-seq'))) return;
  hidePopover();
});

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

      const MESES_PDF = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
      const formatPeriodo = (d1, d2) => {
        if (!d1 && !d2) return '';
        const parse = s => { const p = String(s).split('-'); return { y: +p[0], m: +p[1], d: +p[2] }; };
        if (d1 && d2) {
          const a = parse(d1), b = parse(d2);
          if (a.m === b.m && a.y === b.y) return `${a.d} a ${b.d} de ${MESES_PDF[b.m - 1]} de ${b.y}`;
          if (a.y === b.y) return `${a.d} de ${MESES_PDF[a.m - 1]} a ${b.d} de ${MESES_PDF[b.m - 1]} de ${b.y}`;
          return `${a.d} de ${MESES_PDF[a.m - 1]} de ${a.y} a ${b.d} de ${MESES_PDF[b.m - 1]} de ${b.y}`;
        }
        const s = d1 || d2, p = parse(s);
        return `${p.d} de ${MESES_PDF[p.m - 1]} de ${p.y}`;
      };

      const txtPessoas = (cliente.adultos ? `${cliente.adultos} ${Number(cliente.adultos) > 1 ? 'adultos' : 'adulto'}` : '') + (cliente.criancas > 0 ? `, ${cliente.criancas} ${Number(cliente.criancas) > 1 ? 'crianças' : 'criança'}` : '');
      
      const diasHtml = diasArray.map((diaOrig, index) => {
        const dia = migrarDiaParaNovaEstrutura(diaOrig);
        
        const temDeslocamento = dia.elementos.some(el => el.tipo === 'transporte');
        const temExperiencia = dia.elementos.some(el => el.tipo === 'experiencia');
        
        const badgeGuiado = dia.tourGuiado ? `<span class="badge" style="background:var(--gold); color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:8px; vertical-align:middle; display:inline-flex; align-items:center; gap:3px;"><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-compass"></use></svg> Tour Guiado</span>` : '';
        const badgeDeslocamento = temDeslocamento ? `<span class="badge" style="background:#C4A35A; color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; vertical-align:middle; display:inline-flex; align-items:center;">Deslocamento</span>` : '';
        const badgeExperiencia = temExperiencia ? `<span class="badge" style="background:var(--crimson); color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; vertical-align:middle; display:inline-flex; align-items:center; border: 1px solid rgba(255,255,255,0.4); gap:3px;"><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-ticket"></use></svg> Experiência</span>` : '';
        
        let elementosHtml = dia.elementos.map((el, eIdx) => {
          if (el.tipo === 'info') {
            const parts = [];
            if (el.dataDoTour) {
              const d = new Date(el.dataDoTour);
              parts.push(`${isNaN(d) ? el.dataDoTour : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`);
            }
            if (el.horarioEncontro) parts.push(`Encontro: ${el.horarioEncontro}`);
            if (el.duracaoTour) parts.push(`Duração: ${el.duracaoTour}`);
            if (el.localEncontro) parts.push(`Local: ${el.localEncontro}`);
            if (parts.length > 0) return `<div style="font-size:12px; color:var(--text-sec); margin-bottom:12px; font-weight:500; background:#f9f9f9; padding:6px 12px; border-radius:4px; display:inline-block">${parts.join(' &nbsp;|&nbsp; ')}</div>`;
            return '';
          } else if (el.tipo === 'texto') {
            return el.conteudo ? `<div style="font-size:13px; color:var(--text-main); margin-bottom:16px; line-height:1.6; border-left:3px solid var(--gold-lt); padding-left:12px; font-style:italic">${el.conteudo}</div>` : '';
          } else if (el.tipo === 'sequencia') {
            const semNomeRota = !el.nomeDaRota;
            const tituloRota = el.nomeDaRota || (el.cidade ? 'Passeio em ' + el.cidade : 'Passeio do dia');
            const cidadeText = (el.cidade && !semNomeRota) ? `<span style="color:var(--gold-dk); font-weight:600; font-size:11px; text-transform:uppercase; margin-right:8px">${el.cidade}</span>` : '';
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
                const precoAtr = window.obterPrecoAtracao ? window.obterPrecoAtracao(atrNome) : '';
                const precoAtrHtml = precoAtr ? ` <span style="font-weight:600; color:#854d0e; font-size:11.5px;">· ${precoAtr} / pessoa</span>` : '';
                
                if (isBairro) {
                  const baseSpacing = idxAtr === 0 ? 'margin-top:4px;' : 'margin-top:12px;';
                  const bgStyle = 'background: linear-gradient(to right, rgba(212,175,55,0.12), transparent); padding: 6px 12px; border-radius: 6px;';
                  
                  atracoesHTML += `
                    <div style="${baseSpacing} ${bgStyle}">
                      <strong style="font-size:14px; color:var(--ink-dark); display:block;">
                        ${atrNome}${precoAtrHtml}
                      </strong>
                      ${desc !== 'Visitação livre.' ? `<div style="font-size:11px; color:var(--text-main); margin-top:2px; line-height:1.4;">${desc}</div>` : ''}
                    </div>`;
                } else {
                  atracoesHTML += `
                    <div style="font-size:12px; color:var(--text-main); margin-bottom:4px; line-height:1.4; padding-left:11px; text-indent:-11px;">
                      <span style="display:inline-block; width:5px; height:5px; background:var(--gold); border-radius:50%; margin-right:6px; vertical-align:middle; position:relative; top:-1px;"></span>
                      <strong>${atrNome}</strong>${precoAtrHtml}${desc !== 'Visitação livre.' ? ` <span style="color:var(--text-sec);">— ${desc}</span>` : ''}
                    </div>`;
                }
              });
              atracoesHTML += '</div>';
            } else if (el.atracoesDoDia) {
              const atrTags = el.atracoesDoDia.map(atrNome => {
                const pAtr = window.obterPrecoAtracao ? window.obterPrecoAtracao(atrNome) : '';
                return pAtr ? `${atrNome} (${pAtr}/pessoa)` : atrNome;
              });
              atracoesHTML = `<div style="font-size:12px; color:var(--text-sec); margin-top:4px; border-left:2px solid var(--gold-lt); padding-left:10px;">${atrTags.join(' + ')}</div>`;
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
            const duracao = el.tempo ? ` <span style="color:var(--gold-dk); font-weight:bold;">[${el.tempo}]</span>` : '';
            const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : ''); const pss = pText ? ` - ${pText}` : '';
            const h = el.horario ? `${el.horario}` : '';
            const horaText = h ? `<span style="color:#000; font-weight:bold; font-size:14px; margin-left:8px;">${h}</span>` : '';
            
            const precoVal = window.obterPrecoTransporte ? window.obterPrecoTransporte(el) : 0;
            const linhaEstimativa = precoVal > 0 ? `<div style="font-size:11.5px; color:#78350f; font-weight:600; margin-top:4px;">Estimativa: ~¥${precoVal.toLocaleString('pt-BR')} / pessoa</div>` : '';

            return `
              <div style="margin-bottom:16px; border-left:4px solid #C4A35A; padding-left:12px; background:linear-gradient(to right, rgba(196,163,90,0.06), transparent); padding-top:8px; padding-bottom:8px; border-radius:8px">
                <div style="margin-bottom:4px; display:flex; flex-wrap:wrap; align-items:center">
                  <strong style="color:#9c8248; font-size:12px; text-transform:uppercase; margin-right:8px">Deslocamento ${horaText}</strong>
                </div>
                <div style="font-size:13px; color:var(--text-main); font-weight:600">${origem} ➔ ${destino}</div>
                <div style="font-size:11px; color:var(--text-sec); margin-top:2px">${transpNome}${ctg}${duracao}${pss} ${el.compradoHeian !== false ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em; display:inline-flex; align-items:center; gap:2px;"><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-check"></use></svg> Comprado pela Heian</span>' : '<span style="font-size:9px; background:#e2d9cf; color:#5c4a3d; padding:2px 6px; border-radius:4px; margin-left:4px; font-weight:600; display:inline-flex; align-items:center; gap:2px;"><svg class="v-icon" style="stroke:#5c4a3d; width:1em; height:1em; margin-right:0;"><use href="#icon-user"></use></svg> Comprado pelo cliente</span>'}</div>
                ${linhaEstimativa}
              </div>`;
          } else if (el.tipo === 'experiencia') {
            const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : ''); const p = pText ? (el.horaPartida ? ` &nbsp;|&nbsp; ${pText}` : `${pText}`) : '';
            const h = el.horaPartida ? `<span style="color:#000; font-weight:bold; font-size:14px; margin-right:8px;">${el.horaPartida}</span>` : '';
            
            const precoVal = window.obterPrecoExperiencia ? window.obterPrecoExperiencia(el) : 0;
            const linhaEstimativa = precoVal > 0 ? `<div style="font-size:11.5px; color:#78350f; font-weight:600; margin-top:4px;">Estimativa: ~¥${precoVal.toLocaleString('pt-BR')} / pessoa</div>` : '';

            return `
              <div style="margin-bottom:16px; border-left:4px solid var(--crimson); padding-left:12px; background:linear-gradient(to right, rgba(107,31,42,0.06), transparent); padding-top:8px; padding-bottom:8px; border-radius:8px">
                <div style="margin-bottom:4px; display:flex; flex-wrap:wrap; align-items:center">
                  <strong style="color:var(--crimson); font-size:12px; text-transform:uppercase; margin-right:8px">Tickets & Experiências</strong>
                </div>
                <div style="font-size:13px; color:var(--text-main); font-weight:600">${el.nomeExp || 'Experiência a definir'}</div>
                <div style="font-size:11px; color:var(--text-sec); margin-top:2px">${h}${p} ${el.compradoHeian !== false ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em; display:inline-flex; align-items:center; gap:2px;"><svg class="v-icon" style="stroke:#fff; width:1em; height:1em; margin-right:0;"><use href="#icon-check"></use></svg> Comprado pela Heian</span>' : '<span style="font-size:9px; background:#e2d9cf; color:#5c4a3d; padding:2px 6px; border-radius:4px; margin-left:4px; font-weight:600; display:inline-flex; align-items:center; gap:2px;"><svg class="v-icon" style="stroke:#5c4a3d; width:1em; height:1em; margin-right:0;"><use href="#icon-user"></use></svg> Comprado pelo cliente</span>'}</div>
                ${linhaEstimativa}
              </div>`;
          }
          return '';
        }).join('');
        
        let dataText = '';
        if (dia.data) {
          const [yy, mm, dd] = dia.data.split('-');
          dataText = `${dd}/${mm}`;
        }
        // Rota de cidades do dia (com setas quando ha deslocamento)
        let rotaCidades = '';
        if (typeof window.calcularRotaAutomaticaDia === 'function') {
          rotaCidades = window.calcularRotaAutomaticaDia(dia);
        } else {
          const chainCidades = [];
          (dia.elementos || []).forEach(el => {
            if (el.tipo === 'transporte') {
              if (el.cidadeOrigem) chainCidades.push(String(el.cidadeOrigem).trim());
              if (el.cidadeDestino) chainCidades.push(String(el.cidadeDestino).trim());
            } else if (el.tipo === 'sequencia' && el.cidade) {
              chainCidades.push(String(el.cidade).trim());
            }
          });
          const limpa = [];
          chainCidades.forEach(c => { if (c && (!limpa.length || limpa[limpa.length - 1].toLowerCase() !== c.toLowerCase())) limpa.push(c); });
          rotaCidades = limpa.join(' \u2192 ');
        }

        const tituloFinal = (dia.titulo && String(dia.titulo).trim()) ? String(dia.titulo).trim() : rotaCidades;

        const rotuloDia = dataText 
          ? `${dataText} (Dia ${dia.numeroDia || (index + 1)})${tituloFinal ? ' — ' + tituloFinal : ''}` 
          : `Dia ${dia.numeroDia || (index + 1)}${tituloFinal ? ' — ' + tituloFinal : ''}`;

        return `
          <div class="dia-card">
            <div class="dia-header" style="flex-direction:column; align-items:flex-start; background: linear-gradient(to right, rgba(107,31,42,0.08), transparent); padding: 8px 12px; border-radius: 6px; border-left: 4px solid var(--crimson); margin-bottom: 16px;">
              <div style="margin-bottom:0px; display:flex; flex-wrap:wrap; align-items:center; flex-wrap:wrap;">
                <span class="dia-numero" style="font-size:20px; font-weight:800; margin-right:8px; color:var(--crimson)">${rotuloDia}</span>
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
            <div class="pdf-cover-label">Roteiro de Viagem</div>
            <div class="pdf-cover-title">${nomeParaExibir}</div>
            ${Object.keys(cliente).length > 0 ? `<div class="pdf-cover-meta">
              ${(() => {
                const pInicio = cliente.dataInicio || (diasArray && diasArray.length > 0 && diasArray.find(d => d.data)?.data) || cliente.dataOrcamento;
                const pFim = cliente.dataFim || (diasArray && diasArray.length > 0 && [...diasArray].reverse().find(d => d.data)?.data);
                const perStr = formatPeriodo(pInicio, pFim);
                return perStr ? `<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Período</div><div class="pdf-cover-meta-value">${perStr}</div></div>` : '';
              })()}
              
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
      
      try {
        window.__previewScrollY = window.scrollY || (document.scrollingElement && document.scrollingElement.scrollTop) || 0;
        window.__previewScrollEls = [];
        document.querySelectorAll('#page-roteiros .pane-content, #page-roteiros .pane-content-inner, #editRoteiroDiasList').forEach(function (elc) { window.__previewScrollEls.push([elc, elc.scrollTop]); });
      } catch (e) {}
      document.getElementById('previewOverlay').classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      
      if (typeof attachChipEvents === 'function') attachChipEvents();
    } catch(e) { alert("ERRO AO GERAR ROTEIRO: " + e.message); console.error(e); }
  });

  document.getElementById('btnCancelarEdicaoRoteiro').addEventListener('click', fecharEditorRoteiro);

  document.getElementById('btnAddDiaRoteiro').addEventListener('click', () => { if(typeof window.adicionarDiaFim==='function') window.adicionarDiaFim(); });
  var _btnDiaIni = document.getElementById('btnAddDiaInicioRoteiro');
  if(_btnDiaIni) _btnDiaIni.addEventListener('click', () => { if(typeof window.adicionarDiaInicio==='function') window.adicionarDiaInicio(); });

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
    window.__salvarSemFechar = true; // pré-visualizar não deve fechar o editor
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
    // Se veio do "Pré-visualizar (Salva)", persiste mas NÃO fecha o editor.
    const manterAberto = window.__salvarSemFechar; window.__salvarSemFechar = false;
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
    roteiroEmEdicao.nome = novoNome;
    if (roteiroOriginalNome && roteiroOriginalNome !== novoNome) {
      // Renomear = trocar o rótulo sob a mesma chave imutável.
      // O servidor também atualiza o rótulo nas cotações vinculadas.
      const chaveRen = roteiroEmEdicao.id || roteiroOriginalNome;
      res = await fetch(`/api/roteiros/${encodeURIComponent(chaveRen)}/renomear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ novoNome, roteiroObj: roteiroEmEdicao })
      });
      if (res.ok) {
        delete dbRotas[roteiroOriginalNome];
      }
    } else {
      // Salvamento comum (pela chave imutável quando existir)
      const chaveSave = roteiroEmEdicao.id || novoNome;
      res = await fetch(`/api/roteiros/${encodeURIComponent(chaveSave)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...roteiroEmEdicao, _baseVersao: roteiroEmEdicao.atualizadoEm })
      });
    }

    if (res.status === 409) {
      const errData = await res.json().catch(() => ({}));
      if (errData && errData.error === 'reducao') {
        const okReduzir = confirm('Atenção: este salvamento reduz bastante o roteiro (de ' + errData.nOld + ' para ' + errData.nNew + ' itens). Isso costuma ser acidente de uma aba desatualizada.\n\nConfirma que você REALMENTE quer salvar a versão menor?');
        if (!okReduzir) { btn.textContent = 'Salvar Roteiro'; btn.disabled = false; return; }
        const chaveForce = roteiroEmEdicao.id || novoNome;
        res = await fetch(`/api/roteiros/${encodeURIComponent(chaveForce)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...roteiroEmEdicao, _baseVersao: roteiroEmEdicao.atualizadoEm, _permitirReducao: true })
        });
      } else {
        alert(errData.message || 'Este roteiro foi alterado em outra sessão. Recarregue a página antes de salvar.');
        btn.textContent = 'Salvar Roteiro'; btn.disabled = false;
        return;
      }
    }

    if (res.ok) {
      try {
        const j = await res.json();
        if (j && j.id) roteiroEmEdicao.id = j.id;
        if (j && j.atualizadoEm) roteiroEmEdicao.atualizadoEm = j.atualizadoEm;
      } catch (e) { /* segue */ }
      dbRotas[novoNome] = JSON.parse(JSON.stringify(roteiroEmEdicao));
      roteiroOriginalNome = novoNome;
      if (typeof window.marcarBaselineRoteiro === 'function') window.marcarBaselineRoteiro();
      preencherSelectRoteiros(novoNome);
      if (manterAberto) {
        // fluxo do "Pré-visualizar (Salva)": mantém o editor aberto (e o scroll)
        // pra que ao fechar a pré-visualização o usuário volte exatamente onde estava.
        if (typeof window.marcarBaselineRoteiro === 'function') window.marcarBaselineRoteiro();
      } else {
        fecharEditorRoteiro();
        renderizarRoteiro(novoNome);
      }
      
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
  // Salva no localStorage para auto-restaurar após F5
  if (nome && nome !== 'Novo Roteiro') {
    try {
      localStorage.setItem('heian_last_roteiro_nome', nome);
      localStorage.setItem('heian_last_roteiro_em_edicao', 'true');
    } catch(e) {}
  }

  // Cada roteiro começa com todos os dias expandidos
  if (window.__diasColapsados) window.__diasColapsados.clear();
  // No celular (master-detail), abrir o editor precisa trocar da lista para o detalhe
  if (typeof window.mostrarDetailMobile === 'function') window.mostrarDetailMobile('page-roteiros');
  document.getElementById('editRoteiroNome').value = nome === 'Novo Roteiro' ? '' : nome;

  // Abrir o editor não deve gravar: estado atual vira o baseline do autosave
  if (typeof window.marcarBaselineRoteiro === 'function') window.marcarBaselineRoteiro();
  
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

  // Normaliza o vinculo: o id pode estar aninhado (cliente.notionClienteId), no topo, ou so na cotacao.
  // Garante que TOPO e ANINHADO fiquem iguais, pra o vinculo ser reconhecido em todo lugar (e cura o dado salvo).
  const _vinc = roteiroEmEdicao.notionClienteId || (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.notionClienteId) || notionId || null;
  if (_vinc) {
    roteiroEmEdicao.notionClienteId = _vinc;
    if (!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {};
    if (!roteiroEmEdicao.cliente.notionClienteId) roteiroEmEdicao.cliente.notionClienteId = _vinc;
  }

  // Preenche dados do cliente (prioriza Notion)
  document.getElementById('rotClienteNome').value = notionCli ? notionCli.nome : (roteiroEmEdicao.cliente?.nome || '');
  document.getElementById('rotClienteAdultos').value = notionCli ? notionCli.adultos : (roteiroEmEdicao.cliente?.adultos || '2');
  document.getElementById('rotClienteCriancas').value = notionCli ? notionCli.criancas : (roteiroEmEdicao.cliente?.criancas || '0');
  
  const rotTemCliente = !!_vinc;
  const rotLockedStyle = rotTemCliente ? 'background:#f1f5f9; cursor:not-allowed' : '';
  ['rotClienteNome', 'rotClienteAdultos', 'rotClienteCriancas'].forEach(id => {
    const el = document.getElementById(id);
    if(el) { el.readOnly = false; el.style.cssText = ''; }
  });
  const btnEditarRot = document.getElementById('btnEditarClienteRoteiro');
  if(btnEditarRot) btnEditarRot.innerHTML = rotTemCliente ? '<svg class="v-icon" style="margin-right:2px;"><use href="#icon-user"></use></svg> Editar Cliente' : '<svg class="v-icon"><use href="#icon-save"></use></svg> Salvar Cliente no Notion';
  const btnImportRot = document.getElementById('btnImportNotionRoteiro');
  if (btnImportRot) btnImportRot.style.display = rotTemCliente ? 'none' : 'inline-block';
  
  // Datas e voos (não estão mais na UI do Roteiro como editáveis globalmente, mas para garantir preenchemos)
  document.getElementById('rotClienteData').value = notionCli ? notionCli.dataInicio : (roteiroEmEdicao.cliente?.dataInicio || roteiroEmEdicao.cliente?.dataOrcamento || '');
  if(document.getElementById('rotClienteDataFim')) document.getElementById('rotClienteDataFim').value = notionCli ? notionCli.dataFim : (roteiroEmEdicao.cliente?.dataFim || '');
  if(document.getElementById('rotClienteVooChegada')) document.getElementById('rotClienteVooChegada').value = notionCli ? notionCli.vooChegada : (roteiroEmEdicao.cliente?.vooChegada || '');
  if(document.getElementById('rotClienteVooPartida')) document.getElementById('rotClienteVooPartida').value = notionCli ? notionCli.vooPartida : (roteiroEmEdicao.cliente?.vooPartida || '');
  window.renderRotEstadias(); updateRoteiroHeader();

  document.getElementById('roteiroTimeline').style.display = 'none';
  // Esconde o cabeçalho de preview (título do último roteiro VISUALIZADO). Sem isto ele fica
  // pendurado no topo do editor mostrando o roteiro ERRADO (bug do "Lucas e Sofia" em todos).
  const _phEdit = document.getElementById('roteiroPreviewHeader'); if (_phEdit) _phEdit.style.display = 'none';
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

  // Abrir/reabrir NUNCA deve gravar: remarca o baseline DEPOIS de todas as
  // normalizacoes e do render, pro autosave disparado na abertura ser pulado.
  if (typeof window.marcarBaselineRoteiro === 'function') window.marcarBaselineRoteiro();
}

function fecharEditorRoteiro() {
  try { localStorage.removeItem('heian_last_roteiro_em_edicao'); } catch(e) {}
  document.getElementById('roteiroEditContainer').style.display = 'none';
  document.getElementById('roteiroTimeline').style.display = 'block';
  
  const val = window.roteiroAtualVisualizado;
  // Mantém o cabeçalho de preview coerente com o roteiro realmente visualizado (nunca stale).
  const _phClose = document.getElementById('roteiroPreviewHeader');
  const _ptClose = document.getElementById('roteiroPreviewTitle');
  if (_phClose && _ptClose) {
    if (val) { _ptClose.textContent = val; _phClose.style.display = 'flex'; }
    else { _phClose.style.display = 'none'; }
  }
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

// Botão "Voltar para Clientes" no editor de roteiro (espelho do da cotação). Volta pra ficha do
// cliente vinculado, na aba Roteiros. Se não houver cliente, só vai pra lista de clientes.
window.voltarParaClientesDeRoteiro = function() {
  try { localStorage.removeItem('heian_last_roteiro_em_edicao'); } catch(e) {}
  var clienteId = (typeof roteiroEmEdicao !== 'undefined' && roteiroEmEdicao) ? roteiroEmEdicao.notionClienteId : null;
  if (clienteId) {
    if (typeof navToPage === 'function') navToPage('clientes');
    if (typeof window.abrirDetalhesCliente === 'function') {
      window.abrirDetalhesCliente(clienteId);
      setTimeout(function () {
        var btnTab = document.querySelector('.tab-client-btn[data-tab="roteiros"]');
        if (btnTab) btnTab.click();
      }, 150);
    }
  } else if (typeof navToPage === 'function') {
    navToPage('clientes');
  }
};

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
            <button class="btn-secondary" onclick="roteiroParaCotacao(roteiroEmEdicao, '${roteiroNome}', true)" style="display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="margin-right:2px;"><use href="#icon-file"></use></svg> Gerar Cotação</button>
        `;
        return;
    }
    
    // FASE 2 — detecta a cotação vinculada por NOME e também por roteiroId (cotações como a do
    // Haddad têm orcRoteiroVinculado vazio, só roteiroId) — sem isto o botão mostraria "Gerar"
    // e criaria uma cotação DUPLICADA ao lado da que já existe.
    const _rid = (typeof roteiroEmEdicao !== 'undefined' && roteiroEmEdicao) ? roteiroEmEdicao.id : null;
    const existingCotacao = state.orcamentosDB.find(o => o && !o.deletado && (
        o.orcRoteiroVinculado === roteiroNome ||
        (_rid && (o.roteiroId === _rid || o.orcRoteiroVinculado === _rid))
    ));
    
    if (existingCotacao) {
        actionsDiv.innerHTML = `
            <button class="btn-secondary" onclick="abrirOrcamento('${existingCotacao.id}'); navToPage('orcamento');" title="Visualizar a cotação existente sem alterar nada" style="display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="margin-right:2px;"><use href="#icon-file"></use></svg> Ver Cotação</button>
            <button class="btn-secondary" onclick="roteiroParaCotacao(roteiroEmEdicao, '${roteiroNome}', false)" title="Atualizar a cotação existente com os dados atuais deste roteiro" style="display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="margin-right:2px;"><use href="#icon-file"></use></svg> Atualizar Cotação</button>
        `;
    } else {
        actionsDiv.innerHTML = `
            <button class="btn-secondary" onclick="roteiroParaCotacao(roteiroEmEdicao, '${roteiroNome}', true)" style="display:inline-flex; align-items:center; gap:4px;"><svg class="v-icon" style="margin-right:2px;"><use href="#icon-file"></use></svg> Gerar Cotação</button>
        `;
    }
}
// ── Dias recolhíveis no editor ──────────────────────────────────────────────
// Estado por índice do dia; sobrevive às re-renderizações (o editor redesenha
// a cada edição). Zerado ao abrir outro roteiro.
window.__diasColapsados = window.__diasColapsados || new Set();

window.toggleDiaColapsado = function (idx) {
  if (window.__diasColapsados.has(idx)) window.__diasColapsados.delete(idx);
  else window.__diasColapsados.add(idx);
  renderEditDias();
};

window.toggleTodosDias = function () {
  const total = (roteiroEmEdicao && roteiroEmEdicao.dias) ? roteiroEmEdicao.dias.length : 0;
  const todosRecolhidos = total > 0 && window.__diasColapsados.size >= total;
  window.__diasColapsados.clear();
  if (!todosRecolhidos) {
    for (let i = 0; i < total; i++) window.__diasColapsados.add(i);
  }
  renderEditDias();
};

function resumoDoDia(dia) {
  const els = dia.elementos || [];
  const partes = [];
  
  // Extrai as cidades únicas
  const cidades = [...new Set(els.filter(e => e.tipo === 'sequencia' && e.cidade).map(e => e.cidade))];
  if (cidades.length) partes.push(`<span style="font-weight: 600; color: var(--ink-dark);">${cidades.join(' · ')}</span>`);
  
  if (els.length === 0) {
    partes.push('<span style="font-size: 11px; color: var(--ink-lt); letter-spacing: 0.02em;">dia vazio</span>');
  } else {
    // Mapeamento dos SVGs mini
    const svgMini = {
      sequencia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg>',
      transporte: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><rect x="4" y="3" width="16" height="14" rx="2"></rect><path d="M4 11h16"></path><path d="M12 3v8"></path><path d="m8 17-2 4"></path><path d="m16 17 2 4"></path></svg>',
      experiencia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path><path d="M13 5v14"></path></svg>',
      texto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
    };
    
    // Mapeamento de cores correspondentes
    const coresMini = {
      sequencia: { bg: 'rgba(142, 28, 28, 0.07)', color: 'var(--l-wine)' },
      transporte: { bg: '#e8f4fd', color: '#2b82c9' },
      experiencia: { bg: 'rgba(196, 163, 90, 0.08)', color: 'var(--l-gold)' },
      texto: { bg: '#f1f5f9', color: '#64748b' },
      info: { bg: '#f0f4f8', color: '#475569' }
    };
    
    const nomesTipo = {
      sequencia: 'Sequência',
      transporte: 'Transporte',
      experiencia: 'Experiência',
      texto: 'Texto Livre',
      info: 'Info Encontro'
    };

    const iconsHtml = els.map(e => {
      const core = coresMini[e.tipo] || { bg: '#f1f5f9', color: '#64748b' };
      const svg = svgMini[e.tipo] || '';
      const nome = nomesTipo[e.tipo] || e.tipo;
      
      let labelExtra = nome;
      if (e.tipo === 'sequencia' && e.atracoesDoDia && e.atracoesDoDia.length) {
        labelExtra = `Sequência: ${e.atracoesDoDia.slice(0, 3).join(', ')}${e.atracoesDoDia.length > 3 ? '...' : ''}`;
      } else if (e.tipo === 'texto' && e.conteudoHtml) {
        const txtLimpo = e.conteudoHtml.replace(/<[^>]*>/g, '').substring(0, 40).trim();
        labelExtra = `Texto Livre: ${txtLimpo || '(vazio)'}`;
      } else if (e.tipo === 'info' && e.local) {
        labelExtra = `Info Encontro: ${e.hora || '09:00'} - ${e.local}`;
      } else if (e.tipo === 'transporte' && e.veiculo) {
        labelExtra = `Transporte: ${e.veiculo} (${e.origem || ''} → ${e.destino || ''})`;
      } else if (e.tipo === 'experiencia' && e.nomeExp) {
        labelExtra = `Ticket/Exp: ${e.nomeExp}`;
      }
      
      return `<div title="${labelExtra.replace(/"/g, '&quot;')}" style="width:23px; height:23px; border-radius:6px; background:${core.bg}; color:${core.color}; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; vertical-align:middle; margin-right:3px;">${svg}</div>`;
    }).join('');
    
    const countHtml = `<span style="font-size:11px; color:var(--ink-lt); margin-left: 6px; font-weight:500; vertical-align:middle;">(${els.length} ${els.length === 1 ? 'item' : 'itens'})</span>`;
    
    partes.push(`<div style="display:inline-flex; align-items:center; vertical-align:middle;">${iconsHtml}${countHtml}</div>`);
  }
  
  return partes.join(' <span style="color: var(--border); margin: 0 4px; vertical-align:middle;">—</span> ');
}

function renderEditDias() { updateRoteiroHeader(); triggerRoteiroAutoSave(); 
  const container = document.getElementById('editRoteiroDiasList');
  if (!container) return;

  // Barra de controle: recolher/expandir todos os dias
  const totalDias = (roteiroEmEdicao.dias || []).length;
  if (totalDias > 0) {
    const barra = document.createElement('div');
    barra.style.cssText = 'display:flex; justify-content:flex-end; margin-bottom:10px;';
    const todosRecolhidos = window.__diasColapsados.size >= totalDias;
    barra.innerHTML = '<button type="button" class="btn-secondary" style="font-size:12px; padding:6px 14px;" onclick="toggleTodosDias()">' +
      (todosRecolhidos ? '▾ Expandir todos os dias' : '▸ Recolher todos os dias') + '</button>';
    container.innerHTML = '';
    container.appendChild(barra);
  } else {
    container.innerHTML = '';
  }
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
      const btnUp = isFirst ? '' : `<button class="btn-icon" style="padding:2px 4px;font-size:12px" title="Mover para Cima" onclick="moverElemento(${idx}, ${eIdx}, -1)">▲</button>`;
      const btnDown = isLast ? '' : `<button class="btn-icon" style="padding:2px 4px;font-size:12px" title="Mover para Baixo" onclick="moverElemento(${idx}, ${eIdx}, 1)">▼</button>`;
      const controles = `<div style="display:flex; flex-wrap:wrap;gap:4px">${btnUp}${btnDown}<button class="btn-secondary" style="padding:2px 6px; font-size:10px" onclick="delElemento(${idx}, ${eIdx})">✕ Remover</button></div>`;

      if (el.tipo === 'info') {
        elementosHtml += `
          <div style="border-left: 2px solid var(--gold-lt); padding-left: 12px; margin-bottom: 16px; background:#fcfcfc; padding-top:8px; padding-bottom:8px; border-radius:8px">
            <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <strong style="color:var(--text-sec); font-size:11px; text-transform:uppercase">Info de Encontro</strong>
              ${controles}
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:8px">
              <div class="field" style="margin:0"><label style="font-size:10px;color:var(--gold-dk)">Data</label>${window.hdField(el.dataDoTour, 'data-hd="tour" data-hd-idx="' + idx + '" data-hd-eidx="' + eIdx + '"', false, (dia.data || window.hdHintDia(idx)))}</div>
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
              <strong style="color:var(--text-sec); font-size:11px; text-transform:uppercase">Texto Livre / Comunicação</strong>
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
              <div class="field" style="margin:0; display:flex; align-items:flex-end;">
                <button type="button" title="Fazer este item seguir o numero de pessoas do cliente" onclick="itemSeguirCliente(${idx}, ${eIdx})" style="height:34px;border:1px solid var(--border,#ddd);background:#fff;border-radius:4px;font-size:11px;cursor:pointer;padding:0 8px;color:var(--ink-mid,#666);white-space:nowrap;">&#8635; seguir cliente</button>
              </div>
              <div class="field" style="margin:0; display:flex; flex-direction:column; justify-content:flex-end; min-width:220px;">
                <label style="font-size:10px;color:var(--ink-mid);font-weight:600;margin-bottom:2px;">Responsabilidade / Status</label>
                ${(() => {
                  const _modo = (el.isSemReserva === true || (el.categoria === 'Sem Reserva' && el.compradoHeian === false)) 
                    ? 'ic_card' 
                    : (el.compradoHeian === false ? 'cliente' : 'heian');
                  const _bd = _modo === 'ic_card' ? '#0284c7' : (_modo === 'heian' ? '#16a34a' : '#ea580c');
                  const _bg = _modo === 'ic_card' ? '#f0f9ff' : (_modo === 'heian' ? '#f0fdf4' : '#fff7ed');
                  const _txt = _modo === 'ic_card' ? '#0369a1' : (_modo === 'heian' ? '#15803d' : '#c2410c');
                  return `
                    <select onchange="updResponsabilidadeTransporte(${idx}, ${eIdx}, this.value)" style="min-height:36px; height:36px; font-size:12px; font-weight:700; border-radius:6px; padding:4px 10px; border:1.5px solid ${_bd}; background:${_bg}; color:${_txt}; cursor:pointer; line-height:normal; box-sizing:border-box;">
                      <option value="heian" ${_modo === 'heian' ? 'selected' : ''}>🛡️ Incluso Heian (Emissão Heian)</option>
                      <option value="cliente" ${_modo === 'cliente' ? 'selected' : ''}>👤 Compra pelo Viajante (Reserva)</option>
                      <option value="ic_card" ${_modo === 'ic_card' ? 'selected' : ''}>💳 Cartão IC (Sem Reserva / Catraca)</option>
                    </select>
                  `;
                })()}
              </div>
            </div>
            ${el.tipoTransporte ? `<div style="font-size:11.5px; margin-top:8px; color:var(--text-sec); display:flex; align-items:center; gap:8px;"><span>Selecionado: <strong>${el.tipoTransporte}</strong> (${el.linha}) — ${el.categoria}</span> ${el.tempo ? `<strong style="color:var(--gold-dk);">⏱️ ${el.tempo}</strong>` : ''}</div>` : ''}
          </div>`;
      } else if (el.tipo === 'experiencia') {
        const controles = `<span style="cursor:pointer; font-size:12px; margin-right:8px; color:var(--ink-mid)" onclick="moverElemento(${idx}, ${eIdx}, -1)">▲</span>` +
                          `<span style="cursor:pointer; font-size:12px; margin-right:12px; color:var(--ink-mid)" onclick="moverElemento(${idx}, ${eIdx}, 1)">▼</span>` +
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
              <div class="field" style="margin:0; display:flex; align-items:flex-end;">
                <button type="button" title="Fazer este item seguir o numero de pessoas do cliente" onclick="itemSeguirCliente(${idx}, ${eIdx})" style="height:34px;border:1px solid var(--border,#ddd);background:#fff;border-radius:4px;font-size:11px;cursor:pointer;padding:0 8px;color:var(--ink-mid,#666);white-space:nowrap;">&#8635; seguir cliente</button>
              </div>
              <div class="field" style="margin:0; display:flex; flex-wrap:wrap; align-items:flex-end">
                <label style="font-size:11px; display:flex; flex-wrap:wrap; align-items:center; cursor:pointer; height:34px; padding:0 8px; border-radius:4px; font-weight:600; border:1px solid ${el.compradoHeian !== false ? 'var(--gold)' : '#ccc'}; background:${el.compradoHeian !== false ? 'var(--gold)' : '#fff'}; color:${el.compradoHeian !== false ? 'white' : 'var(--text-sec)'}">
                  <input type="checkbox" ${el.compradoHeian !== false ? 'checked' : ''} onchange="updElementoEdit(${idx}, ${eIdx}, 'compradoHeian', this.checked)" style="margin-right:6px"> EMITIDO P/ HEIAN
                </label>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px">
              <div class="field" style="margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Aviso Pré-Compra (Ex: cotação abre dia X)</label>
                <input type="text" placeholder="Instrução pré-compra..." value="${el.instrucoesPreCompra || ''}" oninput="updElementoEdit(${idx}, ${eIdx}, 'instrucoesPreCompra', this.value)" style="width:100%; font-size:12px; padding:6px; border:1px solid var(--border); border-radius:4px;">
              </div>
              <div class="field" style="margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Instruções Pós-Compra (Ex: ponto de encontro detalhado)</label>
                <input type="text" placeholder="Instrução pós-compra..." value="${el.instrucoesPosCompra || ''}" oninput="updElementoEdit(${idx}, ${eIdx}, 'instrucoesPosCompra', this.value)" style="width:100%; font-size:12px; padding:6px; border:1px solid var(--border); border-radius:4px;">
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
            extraClass += ' fechada';
            if (chk.tipoBloqueio === 'semanal') {
              warnIcon = '';
              warnTitle = ` (fecha às ${chk.diaSemanaNome.toLowerCase()}s)`;
            } else if (chk.tipoBloqueio === 'manutencao') {
              warnIcon = '';
              warnTitle = ` (manutenção: ${chk.motivo})`;
            }
          }
          
          const match = window.buscarAtracaoNoMapa(atr);
          let isBairro = false;
          if (match) {
            const bairro = match['Bairro'] || '';
            isBairro = (bairro && bairro.toLowerCase() === atr.toLowerCase()) || atr.toLowerCase().includes('bairro');
          } else {
            isBairro = atr.toLowerCase().includes('bairro');
          }
          
          let prefixo = '';
          if (isBairro) {
            extraClass += ' bairro';
            prefixo = '• ';
          } else {
            extraClass += ' sub-atracao';
            prefixo = '› ';
          }
          
          const missingClass = !match ? 'missing' : '';
          
          return `<div class="chip-atracao chip-seq ${missingClass}${extraClass}"
                data-id="${atr.replace(/"/g, '&quot;')}"
                data-aidx="${aIdx}"
                title="${atr}${warnTitle}">
            <span class="chip-grip" style="cursor:grab; margin-right:4px; opacity:0.5; user-select:none">⋮⋮</span><span class="chip-label" style="cursor:pointer;">${warnIcon}${prefixo}${atr}${warnTitle}</span><span class="chip-x" style="margin-left:8px; cursor:pointer; color:#ff4444" onclick="delAtracaoBloco(${idx}, ${eIdx}, ${aIdx})">✕</span>
          </div>`;
        }).join('');
        elementosHtml += `
          <div style="border-left: 2px solid var(--gold); padding-left: 12px; margin-bottom: 16px; padding-top:8px; padding-bottom:8px">
            <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; margin-bottom: 8px;">
              <strong style="color:var(--crimson); font-size:12px">Sequência de Atrações</strong>
              ${controles}
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px">
              <datalist id="dlRotas_${idx}_${eIdx}"></datalist>
              <datalist id="dlAtracoes_${idx}_${eIdx}"></datalist>
              <div class="field" style="margin:0"><input type="text" list="datalistCidades" autocomplete="off" placeholder="Cidade" value="${el.cidade || ''}" onchange="updElementoEdit(${idx}, ${eIdx}, 'cidade', this.value); atualizarDatalists(${idx}, ${eIdx})"></div>
              <div class="field" style="margin:0"><input type="text" list="dlRotas_${idx}_${eIdx}" autocomplete="off" placeholder="Título (ex: Asakusa + Ueno)" value="${el.nomeDaRota || ''}" onchange="selecionarBlocoRoteiro(${idx}, ${eIdx}, this.value)"></div>
            </div>
            <div class="dia-atracoes" data-didx="${idx}" data-eidx="${eIdx}" style="margin-bottom:8px; min-height:30px">${atracoesHtml}</div>
            <div class="field" style="margin:0">
              <input type="text" placeholder="+ Adicionar atração" onfocus="window.abrirDropdownAtracoesGlobal(this, ${idx}, ${eIdx})" oninput="window.filtrarDropdownAtracoesGlobal(this, ${idx}, ${eIdx})" onblur="window.fecharDropdownAtracoesGlobal(this)" autocomplete="off" style="width:100%;">
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

    const colapsado = window.__diasColapsados.has(idx);
    if (colapsado) card.classList.add('dia-colapsado');

    const rotaSugerida = (typeof window.calcularRotaAutomaticaDia === 'function') ? window.calcularRotaAutomaticaDia(dia) : '';
    const tituloVal = (dia.titulo !== undefined && dia.titulo !== null) ? String(dia.titulo) : '';

    card.innerHTML = `
      <div style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; margin:-20px -20px 16px -20px; border-radius:8px 8px 0 0; padding:10px 16px; background:var(--crimson); color:white; gap:8px;">
        <div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px; flex:1; min-width:280px;">
          <button type="button" class="dia-toggle-btn" onclick="toggleDiaColapsado(${idx})" title="${colapsado ? 'Expandir dia' : 'Recolher dia'}" style="background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.35); color:#fff; border-radius:6px; width:28px; height:28px; cursor:pointer; font-size:12px; flex:none;">${colapsado ? '▸' : '▾'}</button>
          <span style="margin:0; font-family:var(--ff-display); color:white; font-size:16px;">Dia</span>
          <input type="number" min="1" max="99" value="${dia.numeroDia || (idx + 1)}" onchange="updDiaEdit(${idx}, 'numeroDia', this.value)" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; border-radius: 4px; padding: 2px 4px; font-size: 15px; font-family:var(--ff-display); font-weight: bold; width: 40px; text-align:center;" />
          ${window.hdField(dataValue, 'data-hd="dia" data-hd-idx="' + idx + '"', true, window.hdHintDia(idx))}
          <span style="font-size: 13px; font-weight: 600;">${dataText}</span>
          <input type="text" 
            value="${tituloVal.replace(/"/g, '&quot;')}" 
            placeholder="${(rotaSugerida || 'Título / Rota do dia (automático)').replace(/"/g, '&quot;')}" 
            oninput="updDiaEdit(${idx}, 'titulo', this.value)" 
            style="flex:1; min-width:180px; max-width:440px; background:rgba(255,255,255,0.22); border:1px solid rgba(255,255,255,0.45); color:#fff; border-radius:4px; padding:4px 8px; font-size:13px; font-weight:600;" 
            title="Personalize o título ou cidades deste dia. Deixe vazio para usar a rota automática." />
        </div>
        <div style="display:flex; flex-wrap:wrap; align-items:center;">
          <label style="font-size:12px; margin-right:8px; cursor:pointer; display:flex; flex-wrap:wrap; align-items:center; padding:3px 10px; border-radius:16px; font-weight:600; background:${dia.tourGuiado ? '#fff' : 'rgba(255,255,255,0.2)'}; color:${dia.tourGuiado ? 'var(--crimson)' : '#fff'}; border: 1px solid ${dia.tourGuiado ? '#fff' : 'rgba(255,255,255,0.4)'}">
            <input type="checkbox" ${dia.tourGuiado ? 'checked' : ''} onchange="updDiaEdit(${idx}, 'tourGuiado', this.checked)" style="margin-right:6px; accent-color:var(--crimson)">
             ${dia.tourGuiado ? 'TOUR GUIADO' : 'Tour Guiado'}
          </label>
          <div style="display:flex; flex-wrap:wrap; gap: 4px; margin-right: 8px;">
            <button class="btn-secondary" onclick="moverDia(${idx}, 'up')" style="padding:3px 7px; font-size:12px; border-color:white; color:white; background:transparent" title="Mover para cima">↑</button>
            <button class="btn-secondary" onclick="moverDia(${idx}, 'down')" style="padding:3px 7px; font-size:12px; border-color:white; color:white; background:transparent" title="Mover para baixo">↓</button>
          </div>
          <button class="btn-secondary" onclick="delDia(${idx})" style="padding:3px 7px; font-size:12px; border-color:white; color:white; background:transparent" title="Excluir Dia">✕</button>
        </div>
      </div>
      
      <div class="dia-resumo" onclick="toggleDiaColapsado(${idx})" title="Expandir dia" style="cursor:pointer;">${resumoDoDia(dia)}</div>
      <div class="dia-card-body">
      ${elementosHtml}
      
      <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:16px;">
        <button class="btn-secondary" style="flex:1; border-style:dashed; min-width:120px; display:inline-flex; align-items:center; justify-content:center;" onclick="adicionarElemento(${idx}, 'sequencia')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"><circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon></svg> Sequência</button>
        <button class="btn-secondary" style="flex:1; border-style:dashed; min-width:120px; display:inline-flex; align-items:center; justify-content:center;" onclick="adicionarElemento(${idx}, 'texto')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg> Texto Livre</button>
        <button class="btn-secondary" style="flex:1; border-style:dashed; min-width:120px; display:inline-flex; align-items:center; justify-content:center;" onclick="adicionarElemento(${idx}, 'info')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Info Encontro</button>
        <button class="btn-secondary" style="flex:1; border-style:dashed; min-width:120px; display:inline-flex; align-items:center; justify-content:center;" onclick="adicionarElemento(${idx}, 'transporte')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"><rect x="4" y="3" width="16" height="14" rx="2"></rect><path d="M4 11h16"></path><path d="M12 3v8"></path><path d="m8 17-2 4"></path><path d="m16 17 2 4"></path></svg> Transporte</button>
        <button class="btn-secondary" style="flex:1; border-style:dashed; min-width:120px; color:var(--purple); border-color:var(--purple); display:inline-flex; align-items:center; justify-content:center;" onclick="adicionarElemento(${idx}, 'experiencia')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; margin-right: 6px; display: inline-block; vertical-align: middle;"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path><path d="M13 5v14"></path></svg> Tickets & Experiências</button>
      </div>
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
  if (typeof attachChipEvents === 'function') attachChipEvents();
}

window.updRotCliente = function(field, val) {
  if (!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {};
  roteiroEmEdicao.cliente[field] = val;
  updateRoteiroHeader();
  triggerRoteiroAutoSave();
};

// Mes sugerido ao abrir o calendario de um DIA vazio: inicio da viagem + o offset do dia.
window.hdHintDia = function(idx){
  try{
    var c = roteiroEmEdicao && roteiroEmEdicao.cliente;
    var base = (c && c.dataInicio) ? c.dataInicio : ((roteiroEmEdicao && roteiroEmEdicao.dias && roteiroEmEdicao.dias[0] && roteiroEmEdicao.dias[0].data) || '');
    if(!base || base.length!==10 || base.charAt(4)!=='-') return '';
    var d=new Date(base+'T00:00:00'); d.setDate(d.getDate()+(idx||0));
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }catch(e){ return ''; }
};

window.updDiaEdit = function(diaIdx, field, val) {
    if (!roteiroEmEdicao || !roteiroEmEdicao.dias[diaIdx]) return;
    const diaAtual = roteiroEmEdicao.dias[diaIdx];
    const antigaPropria = (field === 'data') ? diaAtual.data : null;
    diaAtual[field] = val;
    
    // Ao marcar Tour Guiado, adiciona Info de Encontro automaticamente se não houver
    if (field === 'tourGuiado' && val === true) {
      const elementos = diaAtual.elementos || [];
      const jaTemInfo = elementos.some(el => el.tipo === 'info');
      if (!jaTemInfo) {
        diaAtual.elementos.unshift({
          tipo: 'info',
          dataDoTour: diaAtual.data || '',
          horarioEncontro: '',
          duracaoTour: '6h',
          localEncontro: ''
        });
      }
      renderEditDias();
      return;
    }
    
    if (field === 'data') {
      // CASCATA: editar a data de um dia empurra os dias seguintes em sequencia (+1 cada).
      // Voce ainda ajusta qualquer dia manualmente (e a cascata segue a partir dele).
      if (val && val.length===10 && val.charAt(4)==='-') {
        (diaAtual.elementos || []).forEach(el => { if (el.tipo === 'info' && (!el.dataDoTour || el.dataDoTour === antigaPropria)) el.dataDoTour = val; });
        const base = new Date(val + 'T00:00:00');
        for (let j = diaIdx + 1; j < roteiroEmEdicao.dias.length; j++) {
          const dj = roteiroEmEdicao.dias[j], antiga = dj.data;
          const nd = new Date(base); nd.setDate(nd.getDate() + (j - diaIdx));
          const iso = nd.getFullYear() + '-' + String(nd.getMonth() + 1).padStart(2, '0') + '-' + String(nd.getDate()).padStart(2, '0');
          dj.data = iso;
          (dj.elementos || []).forEach(el => { if (el.tipo === 'info' && (!el.dataDoTour || el.dataDoTour === antiga)) el.dataDoTour = iso; });
        }
      }
      renderEditDias();
    }
};

// Re-sequencia as datas dos dias pela POSICAO (consecutivas), ancorando na data
// mais antiga existente (ou no inicio da viagem). Usado ao reordenar/excluir dias:
// o conjunto de datas fica fixo as posicoes e o CONTEUDO e que se move.
window.resequenciarDatasDias = function(){
  try{
    var dias = roteiroEmEdicao && roteiroEmEdicao.dias;
    if(!dias || !dias.length) return;
    var c = roteiroEmEdicao.cliente;
    var validas = dias.map(function(d){return d.data;}).filter(function(x){return x && x.length===10 && x.charAt(4)==='-';}).sort();
    var base = validas.length ? validas[0] : ((c && c.dataInicio && c.dataInicio.length===10) ? c.dataInicio : '');
    if(!base) return;
    var b = new Date(base + 'T00:00:00');
    for(var j=0;j<dias.length;j++){
      var dj = dias[j], antiga = dj.data;
      var nd = new Date(b); nd.setDate(nd.getDate()+j);
      var iso = nd.getFullYear()+'-'+String(nd.getMonth()+1).padStart(2,'0')+'-'+String(nd.getDate()).padStart(2,'0');
      dj.data = iso;
      (dj.elementos||[]).forEach(function(el){ if(el.tipo==='info' && (!el.dataDoTour || el.dataDoTour===antiga)) el.dataDoTour = iso; });
    }
  }catch(e){ console.error('resequenciar', e); }
};

function _isoAddDias(iso, n){
  var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate()+n);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function _isoBR(iso){ if(!iso||iso.length!==10) return iso||''; var p=iso.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }

// HIBRIDO: se o novo dia estende ALEM do periodo ja definido do cliente, pergunta uma vez
// se deve atualizar a chegada/partida. So pergunta quando o limite existe e foi ultrapassado.
function _sincronizarPeriodoHibrido(qual, novaData){
  if(!novaData || novaData.length!==10) return;
  var c = roteiroEmEdicao.cliente; if(!c){ c = roteiroEmEdicao.cliente = {}; }
  if(qual==='inicio'){
    if(c.dataInicio && c.dataInicio.length===10 && novaData < c.dataInicio){
      if(confirm('A viagem agora começa em ' + _isoBR(novaData) + ' (antes era ' + _isoBR(c.dataInicio) + ').\nAtualizar a data de CHEGADA do cliente?')){
        c.dataInicio = novaData;
        var el=document.getElementById('rotClienteData'); if(el) el.value=novaData;
        if(typeof window.autoSaveRoteiro==='function') window.autoSaveRoteiro();
      }
    }
  } else {
    if(c.dataFim && c.dataFim.length===10 && novaData > c.dataFim){
      if(confirm('A viagem agora termina em ' + _isoBR(novaData) + ' (antes era ' + _isoBR(c.dataFim) + ').\nAtualizar a data de PARTIDA do cliente?')){
        c.dataFim = novaData;
        var el=document.getElementById('rotClienteDataFim'); if(el) el.value=novaData;
        if(typeof window.autoSaveRoteiro==='function') window.autoSaveRoteiro();
      }
    }
  }
}

// Adiciona um dia NO FIM, ja com a data do ultimo dia +1 (ou a chegada, se for o 1o).
window.adicionarDiaFim = function(){
  if(!roteiroEmEdicao.dias) roteiroEmEdicao.dias=[];
  var dias = roteiroEmEdicao.dias, ult=null;
  for(var i=dias.length-1;i>=0;i--){ if(dias[i].data && dias[i].data.length===10){ ult=dias[i].data; break; } }
  var c=roteiroEmEdicao.cliente;
  var novaData = ult ? _isoAddDias(ult,1) : ((c && c.dataInicio && c.dataInicio.length===10) ? c.dataInicio : '');
  dias.push({ cidade:'', data: novaData, elementos: [] });
  renderEditDias();
  if(typeof window.autoSaveRoteiro==='function') window.autoSaveRoteiro();
  _sincronizarPeriodoHibrido('fim', novaData);
};

// Adiciona um dia NO INICIO, com a data do 1o dia -1. NAO cascateia: os dias existentes
// mantem suas datas; so ganha um dia mais cedo na frente.
window.adicionarDiaInicio = function(){
  if(!roteiroEmEdicao.dias) roteiroEmEdicao.dias=[];
  var dias = roteiroEmEdicao.dias, prim=null;
  for(var i=0;i<dias.length;i++){ if(dias[i].data && dias[i].data.length===10){ prim=dias[i].data; break; } }
  var c=roteiroEmEdicao.cliente;
  var novaData = prim ? _isoAddDias(prim,-1) : ((c && c.dataInicio && c.dataInicio.length===10) ? _isoAddDias(c.dataInicio,-1) : '');
  dias.unshift({ cidade:'', data: novaData, elementos: [] });
  if(window.__diasColapsados){ var novo=new Set(); window.__diasColapsados.forEach(function(i){ novo.add(i+1); }); window.__diasColapsados=novo; }
  renderEditDias();
  if(typeof window.autoSaveRoteiro==='function') window.autoSaveRoteiro();
  _sincronizarPeriodoHibrido('inicio', novaData);
};

window.moverDia = function(idx, direcao) {
  if (!roteiroEmEdicao || !roteiroEmEdicao.dias) return;
  const dias = roteiroEmEdicao.dias;
  
  const trocaColapso = (a, b) => {
    const cs = window.__diasColapsados; if (!cs) return;
    const ta = cs.has(a), tb = cs.has(b);
    cs.delete(a); cs.delete(b);
    if (ta) cs.add(b);
    if (tb) cs.add(a);
  };
  if (direcao === 'up' && idx > 0) {
    const temp = dias[idx];
    dias[idx] = dias[idx-1];
    dias[idx-1] = temp;
    trocaColapso(idx, idx-1);
  } else if (direcao === 'down' && idx < dias.length - 1) {
    const temp = dias[idx];
    dias[idx] = dias[idx+1];
    dias[idx+1] = temp;
    trocaColapso(idx, idx+1);
  }
  
  if (typeof window.resequenciarDatasDias === 'function') window.resequenciarDatasDias();
  renderEditDias();
};

window.delDia = function(idx) {
  if (window.__diasColapsados) {
    const novo = new Set();
    window.__diasColapsados.forEach(i => {
      if (i < idx) novo.add(i);
      else if (i > idx) novo.add(i - 1);
    });
    window.__diasColapsados = novo;
  }
  if (confirm("Tem certeza que deseja remover este dia inteiro?")) {
    roteiroEmEdicao.dias.splice(idx, 1);
    if (typeof window.resequenciarDatasDias === 'function') window.resequenciarDatasDias();
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
    optCustom.textContent = '+ Adicionar Transporte Personalizado...';
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
      opt.textContent = t.trecho + ' - ' + t.tipo + ' (' + t.linha + ') | ' + t.categoria + (t.tempo ? ' (' + t.tempo + ')' : '');
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
  // pax efetivo: usa o do item se foi customizado; senao SEGUE o cliente
  var _cli = (window.roteiroEmEdicao && window.roteiroEmEdicao.cliente) || {};
  var _ad = (el.adultos !== undefined && el.adultos !== null && el.adultos !== '') ? parseInt(el.adultos) : (parseInt(_cli.adultos) || 0);
  var _cr = (el.criancas !== undefined && el.criancas !== null && el.criancas !== '') ? parseInt(el.criancas) : (parseInt(_cli.criancas) || 0);
  if (_ad) text.push(_ad + (_ad > 1 ? ' Adultos' : ' Adulto'));
  if (_cr) text.push(_cr + (_cr > 1 ? ' Crianças' : ' Criança'));
  if (text.length === 0 && el.passageiros) return el.passageiros + (el.passageiros > 1 ? ' Passageiros' : ' Passageiro');
  return text.join(', ');
};

window.updResponsabilidadeTransporte = function(idx, eIdx, modo) {
  const el = roteiroEmEdicao.dias[idx].elementos[eIdx];
  if (!el) return;
  if (modo === 'heian') {
    el.compradoHeian = true;
    el.isSemReserva = false;
    if (el.categoria === 'Sem Reserva') el.categoria = 'Reservado';
  } else if (modo === 'cliente') {
    el.compradoHeian = false;
    el.isSemReserva = false;
    if (el.categoria === 'Sem Reserva') el.categoria = 'Reservado';
  } else if (modo === 'ic_card') {
    el.compradoHeian = false;
    el.isSemReserva = true;
    el.categoria = 'Sem Reserva';
  }
  renderEditDias();
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
        /* pax herda do cliente por padrao */
        /* pax herda do cliente por padrao */
        renderEditDias();
     } else {
        renderEditDias(); // Reseta o select caso ele cancele
     }
     return;
  }

  const processar = (transportes) => {
    const t = transportes.find(x => String(x.id) === String(idTransp));
    if (t) {
      el.trechoId = t.id;
      el.tipoTransporte = t.tipo;
      el.linha = t.linha;
      el.categoria = t.categoria;
      el.tempo = t.tempo;
      // Se for Cartão IC / Sem Reserva, sugere compra do cliente por padrão
      if (t.categoria === 'Sem Reserva' || (t.tipo && t.tipo.toLowerCase().includes('ic card'))) {
        el.compradoHeian = false;
      }
      // Mantém os campos de override limpos para a Base Mestre ser dinâmica
      el.instrucoesPreCompra = '';
      el.instrucoesPosCompra = '';
      /* pax herda do cliente por padrao */
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

  // Cidade do dia: da sequência do dia (ou do próprio dia) — para priorizar
  // as experiências daquela cidade no select
  const normCid = (x) => (x || '').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  let cidadeDia = normCid(dia.cidade);
  let cidadeDiaNome = dia.cidade || '';
  (dia.elementos || []).forEach(e2 => {
    if (!cidadeDia && e2.tipo === 'sequencia' && e2.cidade) {
      cidadeDia = normCid(e2.cidade);
      cidadeDiaNome = e2.cidade;
    }
  });

  const processarExperiencias = (experiencias) => {
    sel.innerHTML = '<option value="">Selecione...</option>';
    let count = 0;
    const daCidade = [];
    const outras = [];
    experiencias.forEach(ex => {
      const nome = (ex.nome || '').toLowerCase();
      const cidade = (ex.cidade || '').toLowerCase();
      const tipo = (ex.tipo || '').toLowerCase();
      
      // Permitir busca pelo nome da experiencia, cidade ou tipo
      if (filtro && !nome.includes(filtro) && !cidade.includes(filtro) && !tipo.includes(filtro)) return;
      
      const cidEx = normCid(ex.cidade);
      const casaCidade = !cidadeDia || !cidEx || cidEx === 'multi' ||
        cidEx.includes(cidadeDia) || cidadeDia.includes(cidEx);
      (casaCidade ? daCidade : outras).push(ex);
    });
    const addOpts = (lista, grupoLabel) => {
      if (!lista.length) return;
      let alvo = sel;
      if (grupoLabel) {
        alvo = document.createElement('optgroup');
        alvo.label = grupoLabel;
        sel.appendChild(alvo);
      }
      lista.forEach(ex => {
        const opt = document.createElement('option');
        opt.value = ex.id;
        opt.textContent = ex.nome + ' | ' + ex.tipo + (ex.cidade ? ' | ' + ex.cidade : '');
        if (ex.id == el.expId) opt.selected = true;
        alvo.appendChild(opt);
        count++;
      });
    };
    
    // Sempre agrupa por cidade (Destaques da cidade do dia no topo) mesmo se houver filtro
    if (cidadeDia) {
      const labelGrupo = cidadeDiaNome ? `Destaques em ${cidadeDiaNome}` : 'Destaques na Cidade';
      addOpts(daCidade, labelGrupo);
      addOpts(outras, 'Outras cidades / regiões');
    } else {
      addOpts(daCidade.concat(outras), null);
    }
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
      /* pax herda do cliente por padrao */
      /* pax herda do cliente por padrao */
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
    roteiroEmEdicao.dias[idx].elementos.push({ refId: Date.now() + Math.random().toString(36).substr(2, 5), tipo: 'info', dataDoTour: (roteiroEmEdicao.dias[idx].data || ''), horarioEncontro: '', duracaoTour: '6h', localEncontro: '' });
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

window.itemSeguirCliente = function(idx, eIdx) {
  var el = roteiroEmEdicao.dias[idx].elementos[eIdx];
  delete el.adultos; delete el.criancas;
  if (typeof renderEditDias === 'function') renderEditDias();
  if (typeof window.autoSaveRoteiro === 'function') window.autoSaveRoteiro();
};

window.addAtracaoBloco = function(idx, eIdx, nomeRaw) {
  if(!nomeRaw || !nomeRaw.trim()) return;
  
  let nome = nomeRaw.trim();
  if (nome.includes('|')) {
    nome = nome.split('|')[1].trim();
  }
  nome = nome.replace(/\(Atração\)/g, '').replace(/\(Bairro\)/g, '').trim();
  
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
    if (!chip.classList.contains('chip-seq')) {
      chip.addEventListener('mouseenter', showPopover);
      chip.addEventListener('mouseleave', hidePopover);
    }
  });
  if (typeof window.initDragAtracoes === 'function') window.initDragAtracoes();
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
    const isFirst = i === 0;
    const isLast = i === roteiroEmEdicao.cliente.estadias.length - 1;
    div.innerHTML = `
      <div class="item-row-header" style="display: flex; align-items: center; justify-content: space-between;">
        <span class="item-row-num">Estadia ${i+1}</span>
        <div style="display: flex; gap: 4px; align-items: center;">
          <button type="button" class="btn-move-up" onclick="moverRotEstadia(${i}, -1)" ${isFirst ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''} style="background:none; border:none; color:var(--ink-mid); cursor:pointer; padding:2px 6px; font-size:12px;">▲</button>
          <button type="button" class="btn-move-down" onclick="moverRotEstadia(${i}, 1)" ${isLast ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''} style="background:none; border:none; color:var(--ink-mid); cursor:pointer; padding:2px 6px; font-size:12px;">▼</button>
          <button type="button" class="btn-remove" onclick="rmRotEstadia(${est.id})">✕</button>
        </div>
      </div>
      <div class="form-grid-4">
        <div class="field"><label>Cidade</label><input type="text" value="${est.cidade}" placeholder="Ex: Tokyo" oninput="updRotEstadia(${est.id},'cidade',this.value)"></div>
        <div class="field"><label>Data Início</label>${window.hdField(est.dataInicio, 'data-hd="estadia" data-hd-id="' + est.id + '" data-hd-f="dataInicio"')}</div>
        <div class="field"><label>Data Fim</label>${window.hdField(est.dataFim, 'data-hd="estadia" data-hd-id="' + est.id + '" data-hd-f="dataFim"')}</div>
        <div class="field"><label>Hotel</label><input type="text" value="${est.hotel}" placeholder="Ex: The Celestine Tokyo" oninput="updRotEstadia(${est.id},'hotel',this.value)"></div>
      </div>`;
    cont.appendChild(div);
  });
};

window.moverRotEstadia = function(index, direcao) {
  if (!roteiroEmEdicao.cliente || !roteiroEmEdicao.cliente.estadias) return;
  const targetIndex = index + direcao;
  if (targetIndex < 0 || targetIndex >= roteiroEmEdicao.cliente.estadias.length) return;
  const temp = roteiroEmEdicao.cliente.estadias[index];
  roteiroEmEdicao.cliente.estadias[index] = roteiroEmEdicao.cliente.estadias[targetIndex];
  roteiroEmEdicao.cliente.estadias[targetIndex] = temp;
  window.renderRotEstadias();
};

window.ordenarRotEstadiasPorData = function() {
  if (!roteiroEmEdicao.cliente || !roteiroEmEdicao.cliente.estadias) return;
  roteiroEmEdicao.cliente.estadias.sort((a, b) => {
    if (!a.dataInicio) return 1;
    if (!b.dataInicio) return -1;
    return a.dataInicio.localeCompare(b.dataInicio);
  });
  window.renderRotEstadias();
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
  const btnOrdenar = document.getElementById('btnRotOrdenarEstadias');
  if (btnOrdenar) btnOrdenar.addEventListener('click', window.ordenarRotEstadiasPorData);
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
      dbRotas[roteiroOriginalNome] = JSON.parse(JSON.stringify(roteiroEmEdicao));
      const chaveSave = roteiroEmEdicao.id || roteiroOriginalNome;
      const res = await fetch('/api/roteiros/' + encodeURIComponent(chaveSave), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...roteiroEmEdicao, _baseVersao: roteiroEmEdicao.atualizadoEm })
      });
      if (res.status === 409) {
        let _err = null; try { _err = await res.json(); } catch (e) {}
        if (_err && _err.error === 'reducao') { if (indicator) { indicator.textContent = '⚠ Alteração retida (segurança)'; indicator.style.opacity = '1'; } return; }
        if (indicator) { indicator.textContent = 'Conflito de edição!'; indicator.style.opacity = '1'; }
        if (!window.__conflitoRoteiroAvisado) {
          window.__conflitoRoteiroAvisado = true;
          alert('Este roteiro foi alterado em outra sessão (outra aba ou outro usuário).\nSuas últimas alterações NÃO foram salvas.\nRecarregue a página para pegar a versão mais recente antes de continuar.');
        }
        return;
      }
      if (res.ok) {
        try {
          const j = await res.json();
          if (j && j.id) roteiroEmEdicao.id = j.id;
          if (j && j.atualizadoEm) roteiroEmEdicao.atualizadoEm = j.atualizadoEm;
        } catch (e) { /* segue */ }
        if (typeof window.marcarBaselineRoteiro === 'function') window.marcarBaselineRoteiro();
      }
      if (indicator) {
        indicator.textContent = res.ok ? 'Salvo automaticamente' : 'Erro ao salvar';
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
  const dataInicioVal = cliente.dataInicio || (roteiroEmEdicao.dias && roteiroEmEdicao.dias.find(d => d.data)?.data) || cliente.dataOrcamento;
  const dataFimVal = cliente.dataFim || (roteiroEmEdicao.dias && [...roteiroEmEdicao.dias].reverse().find(d => d.data)?.data);
  const data = dataInicioVal ? (dataInicioVal + (dataFimVal ? ' a ' + dataFimVal : '')) : 'Sem data definida';
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
      if(el) { el.readOnly = false; el.style = ''; }
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
        if(el) { el.readOnly = false; el.style = ''; }
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
    if (!isHover && typeof window.mostrarDetailMobile === 'function') {
      window.mostrarDetailMobile('page-roteiros');
    }
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
    
    card.innerHTML = `
      <div class="list-card-title-row" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
        <div class="list-card-title" style="color:var(--crimson); font-weight: 600; margin-bottom: 0;">${nome}</div>
        <button class="btn-card-edit-minimalist" onclick="event.stopPropagation(); window.editarRoteiroCard('${nome}')" title="Editar">
          <svg class="v-icon no-margin"><use href="#icon-edit"></use></svg>
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
  
  showToast('Desfeito!');
};

window.abrirModalGeradorIA = async function() {
  const modal = document.getElementById('modalPromptIA');
  if (!modal) return;

  // Resetar campos
  document.getElementById('iaInstrucoesPrompt').value = '';
  const dateVal = roteiroEmEdicao?.cliente?.dataInicio || roteiroEmEdicao?.cliente?.dataOrcamento || document.getElementById('rotClienteData')?.value || '';
  document.getElementById('iaDataInicio').value = dateVal;
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
      const res = await fetch('/api/clientes/' + roteiroEmEdicao.notionClienteId + '/dados');
      if (res.ok) {
        const data = await res.json();
        const briefing = data.clientLocalInfo?.briefing || data.clientInfo?.briefing || '';
        if (briefing) {
          document.getElementById('iaBriefingCliente').value = briefing;
        } else {
          document.getElementById('iaBriefingCliente').value = 'Nenhum briefing cadastrado na ficha do Notion ou local deste cliente.';
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
        datas: datas,
        clienteData: roteiroEmEdicao?.cliente || null
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

      showToast('Roteiro gerado com IA com sucesso!');
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

window.editarElementoRoteiroRapido = function(roteiroNome, diaIdx, elIdx) {
  const roteiro = dbRotas[roteiroNome];
  if (!roteiro || !roteiro.dias || !roteiro.dias[diaIdx]) return;
  
  const el = roteiro.dias[diaIdx].elementos[elIdx];
  if (!el) return;

  let modal = document.getElementById('modalEditarElementoRoteiroRapido');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modalEditarElementoRoteiroRapido';
    modal.style.position = 'fixed';
    modal.style.zIndex = '10000';
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

  let formHTML = '';

  if (el.tipo === 'transporte') {
    const t = el.transportInfo || {};
    formHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Meio de Transporte</label>
          <input type="text" id="editElTipoTransp" value="${el.tipoTransporte || t.tipoTransporte || ''}" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:11.5px; font-weight:600; color:#555;">Origem</label>
            <input type="text" id="editElOrigem" value="${el.cidadeOrigem || t.origem || ''}" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:11.5px; font-weight:600; color:#555;">Destino</label>
            <input type="text" id="editElDestino" value="${el.cidadeDestino || t.destino || ''}" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:11.5px; font-weight:600; color:#555;">Horário</label>
            <input type="text" id="editElHorario" value="${el.horario || t.horario || ''}" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px;" placeholder="Ex: 14:30">
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-size:11.5px; font-weight:600; color:#555;">Linha / Voo</label>
            <input type="text" id="editElLinha" value="${el.linha || t.linha || ''}" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Instruções Pré-compra (Mensagem de Compra)</label>
          <textarea id="editElInstrucoesPre" rows="2" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:12px; font-family:var(--ff-body);">${el.instrucoesPreCompra || ''}</textarea>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Instruções Pós-compra (Mensagem de Uso)</label>
          <textarea id="editElInstrucoesPos" rows="2" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:12px; font-family:var(--ff-body);">${el.instrucoesPosCompra || ''}</textarea>
        </div>
      </div>
    `;
  } else if (el.tipo === 'experiencia') {
    const e = el.expInfo || {};
    formHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Nome da Experiência</label>
          <input type="text" id="editElNomeExp" value="${el.nomeExp || e.nomeExp || ''}" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px;">
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Horário</label>
          <input type="text" id="editElHoraPartida" value="${el.horaPartida || e.horaPartida || ''}" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px;" placeholder="Ex: 10:00">
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Instruções Pré-compra (Mensagem de Compra)</label>
          <textarea id="editElInstrucoesPre" rows="2" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:12px; font-family:var(--ff-body);">${el.instrucoesPreCompra || ''}</textarea>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px;">
          <label style="font-size:11.5px; font-weight:600; color:#555;">Instruções Pós-compra (Mensagem de Uso)</label>
          <textarea id="editElInstrucoesPos" rows="2" style="padding:8px; border:1px solid var(--border); border-radius:6px; font-size:12px; font-family:var(--ff-body);">${el.instrucoesPosCompra || ''}</textarea>
        </div>
      </div>
    `;
  } else {
    alert("Este tipo de elemento não suporta edição rápida por aqui. Por favor, use o Editor de Roteiros completo clicando em 'Abrir Editor'.");
    return;
  }

  modal.innerHTML = `
    <div style="background:#fff; padding:24px; border-radius:12px; width:90%; max-width:500px; box-shadow:0 10px 30px rgba(0,0,0,0.25); display:flex; flex-direction:column; gap:16px; position:relative;" onclick="event.stopPropagation()">
      <span onclick="window.fecharModalEditarElementoRoteiroRapido()" style="position:absolute; top:12px; right:16px; font-size:20px; font-weight:bold; cursor:pointer; color:#7f7f7f;">✕</span>
      <h3 style="margin:0; font-family:var(--ff-display); color:var(--crimson); font-size:16px; font-weight:600;">
        Editar Item do Roteiro (Dia ${diaIdx + 1})
      </h3>
      
      <form id="formEditarElementoRoteiroRapido" onsubmit="window.salvarEditarElementoRoteiroRapido(event, '${roteiroNome.replace(/'/g, "\\'")}', ${diaIdx}, ${elIdx})" style="display:flex; flex-direction:column; gap:16px;">
        ${formHTML}
        
        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
          <button type="button" onclick="window.fecharModalEditarElementoRoteiroRapido()" class="btn-secondary" style="padding:8px 16px; font-size:12.5px;">Cancelar</button>
          <button type="submit" class="btn-primary" style="padding:8px 20px; font-size:12.5px; font-weight:600;">
            Salvar Alterações
          </button>
        </div>
      </form>
    </div>
  `;
  
  modal.style.display = 'flex';
};

window.fecharModalEditarElementoRoteiroRapido = function() {
  const modal = document.getElementById('modalEditarElementoRoteiroRapido');
  if (modal) modal.style.display = 'none';
};

window.salvarEditarElementoRoteiroRapido = async function(e, roteiroNome, diaIdx, elIdx) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.innerText = 'Processando...';

  try {
    const roteiro = dbRotas[roteiroNome];
    if (!roteiro || !roteiro.dias || !roteiro.dias[diaIdx]) throw new Error("Roteiro inválido");
    
    const el = roteiro.dias[diaIdx].elementos[elIdx];
    if (!el) throw new Error("Elemento inválido");

    if (el.tipo === 'transporte') {
      const tipoTransp = document.getElementById('editElTipoTransp').value.trim();
      const orig = document.getElementById('editElOrigem').value.trim();
      const dest = document.getElementById('editElDestino').value.trim();
      const horario = document.getElementById('editElHorario').value.trim();
      const linha = document.getElementById('editElLinha').value.trim();
      const pre = document.getElementById('editElInstrucoesPre').value.trim();
      const pos = document.getElementById('editElInstrucoesPos').value.trim();

      el.tipoTransporte = tipoTransp;
      el.cidadeOrigem = orig;
      el.cidadeDestino = dest;
      el.horario = horario;
      el.linha = linha;
      el.instrucoesPreCompra = pre;
      el.instrucoesPosCompra = pos;

      if (!el.transportInfo) el.transportInfo = {};
      el.transportInfo.tipoTransporte = tipoTransp;
      el.transportInfo.origem = orig;
      el.transportInfo.destino = dest;
      el.transportInfo.horario = horario;
      el.transportInfo.linha = linha;
    } else if (el.tipo === 'experiencia') {
      const nomeExp = document.getElementById('editElNomeExp').value.trim();
      const horaPartida = document.getElementById('editElHoraPartida').value.trim();
      const pre = document.getElementById('editElInstrucoesPre').value.trim();
      const pos = document.getElementById('editElInstrucoesPos').value.trim();

      el.nomeExp = nomeExp;
      el.horaPartida = horaPartida;
      el.instrucoesPreCompra = pre;
      el.instrucoesPosCompra = pos;

      if (!el.expInfo) el.expInfo = {};
      el.expInfo.nomeExp = nomeExp;
      el.expInfo.horaPartida = horaPartida;
    }

    const chaveSaveRapido = (roteiro && roteiro.id) || roteiroNome;
    const saveRes = await fetch(`/api/roteiros/${encodeURIComponent(chaveSaveRapido)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...roteiro, _baseVersao: roteiro.atualizadoEm })
    });

    if (saveRes.status === 409) {
      const eData = await saveRes.json().catch(() => ({}));
      alert(eData.message || 'Este roteiro foi alterado em outra sessão. Recarregue a página antes de salvar.');
      return;
    }
    if (!saveRes.ok) throw new Error('Erro ao salvar no banco');
    try {
      const j = await saveRes.json();
      if (j && roteiro) {
        if (j.id) roteiro.id = j.id;
        if (j.atualizadoEm) roteiro.atualizadoEm = j.atualizadoEm;
      }
    } catch (e) { /* segue */ }

    alert('Roteiro atualizado com sucesso!');
    window.fecharModalEditarElementoRoteiroRapido();

    // Recarregar a prévia do roteiro na tela
    const previewDiv = document.getElementById('roteiroActivePreview');
    if (previewDiv && window.renderizarRoteiroNoElemento) {
      window.renderizarRoteiroNoElemento(roteiroNome, previewDiv);
    }

    // Recarregar também a aba de pendências se ela for a ativa para recalcular e sumir alertas
    const activeTabBtn = document.querySelector('.tab-client-btn.active');
    if (activeTabBtn && activeTabBtn.dataset.tab === 'resumo') {
      activeTabBtn.click();
    }

  } catch(err) {
    console.error(err);
    alert('Erro ao salvar alterações no roteiro: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerText = 'Salvar Alterações';
  }
};

window.abrirDrawerPerfilCliente = async function() {
  const drawer = document.getElementById('drawerPerfilCliente');
  const content = document.getElementById('drawerPerfilClienteContent');
  if (!drawer || !content) return;

  // Obter o ID do cliente em edição
  let clienteId = '';
  if (typeof roteiroEmEdicao !== 'undefined' && roteiroEmEdicao) {
    clienteId = roteiroEmEdicao.notionClienteId || (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.notionClienteId);
  }

  if (!clienteId) {
    alert("Nenhum cliente vinculado a este roteiro no momento. Vincule um cliente primeiro!");
    return;
  }

  // Mostrar drawer
  drawer.style.left = '0';
  content.innerHTML = `<div style="text-align:center; padding:40px 20px; color:var(--crimson); font-weight:600;">⏳ Carregando perfil do viajante...</div>`;

  try {
    // 1. Carregar dados completos (Notion + Supabase)
    const resNotion = await fetch('/api/clientes/' + clienteId + '/dados');
    if (!resNotion.ok) throw new Error("Erro ao carregar dados");
    const resData = await resNotion.json();

    const clientNotion = resData.clientInfo || {};
    const clientLocal = resData.clientLocalInfo || {};
    const preferencias = clientLocal.preferencias || {};

    // 2. Montar o HTML completo
    let datasViagem = 'Sem data definida';
    if (clientNotion.dataInicio && clientNotion.dataFim) {
      datasViagem = `${fmtDate(clientNotion.dataInicio)} a ${fmtDate(clientNotion.dataFim)}`;
    } else if (clientNotion.dataInicio) {
      datasViagem = fmtDate(clientNotion.dataInicio);
    }

    // E-mail do cadastro
    const emailStr = clientLocal.email || (clientLocal.emails && clientLocal.emails[0]?.email) || 'Sem e-mail';

    // Lista de Passageiros/Viajantes
    let viajantesHTML = '';
    if (Array.isArray(clientLocal.viajantes) && clientLocal.viajantes.length > 0) {
      viajantesHTML = clientLocal.viajantes.map(v => {
        const nomeCompleto = [v.nome, v.sobrenome].filter(Boolean).join(' ') || 'Sem nome';
        const tipo = (parseInt(v.idade) < 12 && !isNaN(parseInt(v.idade))) ? '👶 Criança' : '🧑 Adulto';
        const ageStr = v.idade ? `(${v.idade} anos)` : '';
        return `<div style="padding: 6px 12px; background: rgba(0,0,0,0.02); border: 1px solid var(--border); border-radius: 6px; font-size:12.5px; margin-bottom: 4px; display:flex; justify-content:space-between;">
          <span>${tipo}: <strong>${nomeCompleto}</strong></span>
          <span style="color:var(--ink-lt);">${ageStr}</span>
        </div>`;
      }).join('');
    } else if (clientNotion.viajantes) {
      viajantesHTML = `<div style="padding: 10px 12px; background: rgba(0,0,0,0.02); border: 1px solid var(--border); border-radius: 6px; font-size: 13px; color: var(--ink-dk); white-space: pre-wrap;">${clientNotion.viajantes}</div>`;
    } else {
      viajantesHTML = '<p style="font-size:12px; color:var(--ink-lt); font-style:italic; margin:0;">Nenhum viajante informado.</p>';
    }

    // Lista de Estadias/Hotéis
    let estadiasHTML = '';
    if (Array.isArray(clientLocal.estadias) && clientLocal.estadias.length > 0) {
      estadiasHTML = clientLocal.estadias.map(est => `
        <div style="padding: 10px 12px; background: rgba(196,163,90,0.03); border: 1px solid var(--border); border-radius: 8px; font-size: 12.5px; margin-bottom: 6px;">
          <div style="display:flex; justify-content:space-between; font-weight:600; color:var(--crimson); margin-bottom: 2px;">
            <span>📍 ${est.cidade || 'Cidade'}</span>
            <span style="font-weight:normal; font-size:11px; color:var(--ink-lt);">${est.dataInicio && est.dataFim ? `${fmtDate(est.dataInicio)} a ${fmtDate(est.dataFim)}` : ''}</span>
          </div>
          <div style="color:var(--ink-dk);">${est.hotel || 'Hotel'}</div>
        </div>
      `).join('');
    } else if (clientNotion.hotel) {
      estadiasHTML = `<div style="padding: 10px 12px; background: rgba(196,163,90,0.03); border: 1px solid var(--border); border-radius: 8px; font-size: 13px; color: var(--ink-dk); white-space: pre-wrap;">${clientNotion.hotel}</div>`;
    } else {
      estadiasHTML = '<p style="font-size:12px; color:var(--ink-lt); font-style:italic; margin:0;">Nenhuma estadia informada.</p>';
    }

    // Preferências de Ritmo e Estilo
    let prefHTML = '';
    if (preferencias && Object.keys(preferencias).length > 0) {
      // Badges
      let prioridadesHTML = '';
      if (preferencias.prioridades && preferencias.prioridades.length > 0) {
        const prioArr = Array.isArray(preferencias.prioridades) ? preferencias.prioridades : [preferencias.prioridades];
        prioridadesHTML = prioArr.map(p => `
          <span style="display:inline-block; font-size:11.5px; background:rgba(196,163,90,0.06); border:1px solid rgba(196,163,90,0.2); color:var(--gold-dk); padding:3px 8px; border-radius:10px; margin-right:4px; margin-bottom:4px; font-weight:500;">${p}</span>
        `).join('');
      }

      let toursHTML = '';
      if (preferencias.interessesTour && preferencias.interessesTour.length > 0) {
        const tourArr = Array.isArray(preferencias.interessesTour) ? preferencias.interessesTour : [preferencias.interessesTour];
        toursHTML = tourArr.map(t => `
          <span style="display:inline-block; font-size:11.5px; background:rgba(107,31,42,0.03); border:1px solid rgba(107,31,42,0.1); color:var(--crimson); padding:3px 8px; border-radius:10px; margin-right:4px; margin-bottom:4px; font-weight:500;">${t}</span>
        `).join('');
      }

      prefHTML = `
        <div style="border-top: 1px solid var(--border); padding-top: 16px;">
          ${preferencias.cidadesPretendeVisitar ? `
          <div style="background:rgba(196,163,90,0.06); border:1px solid rgba(196,163,90,0.2); border-radius:10px; padding:10px 12px; margin-bottom:16px;">
            <div style="font-size:11px; color:var(--ink-lt); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:3px; font-weight:600;">🗺️ Cidades que pretende visitar</div>
            <div style="font-size:13px; color:var(--ink-dk); font-weight:600;">${preferencias.cidadesPretendeVisitar}</div>
          </div>
          ` : ''}
          <h4 style="margin: 0 0 12px 0; color: var(--gold-dk); font-size: 13.5px; text-transform: uppercase; letter-spacing:0.04em;">🏃 Ritmo & Estilo de Viagem</h4>
          <div style="font-size: 12.5px; display: flex; flex-direction: column; gap: 6px; color: var(--ink-dk); margin-bottom: 16px;">
            <div><strong>Ritmo dos dias:</strong> ${preferencias.ritmo || 'Não informado'}</div>
            <div><strong>Visitas a Templos:</strong> ${preferencias.templos || 'Não informado'}</div>
            <div><strong>Caminhadas Diárias:</strong> ${preferencias.caminhada || 'Não informado'}</div>
            <div><strong>Alimentação:</strong> ${preferencias.refeicoes || 'Não informado'}</div>
          </div>

          <h4 style="margin: 0 0 10px 0; color: var(--gold-dk); font-size: 13.5px; text-transform: uppercase; letter-spacing:0.04em;">🎯 Focos & Prioridades</h4>
          <div style="margin-bottom: 12px;">
            <div style="font-size:11px; color:var(--ink-lt); margin-bottom:4px;">Prioridades:</div>
            <div>${prioridadesHTML}</div>
          </div>
          ${toursHTML ? `
          <div style="margin-bottom: 16px;">
            <div style="font-size:11px; color:var(--ink-lt); margin-bottom:4px;">Foco nos Tours:</div>
            <div>${toursHTML}</div>
          </div>
          ` : ''}

          <h4 style="margin: 0 0 12px 0; color: var(--gold-dk); font-size: 13.5px; text-transform: uppercase; letter-spacing:0.04em;">✨ Informações Adicionais</h4>
          <div style="font-size: 12.5px; display: flex; flex-direction: column; gap: 6px; color: var(--ink-dk); margin-bottom: 16px;">
            <div><strong>Primeira vez no Japão?</strong> ${preferencias.primeiraVez || 'Não informado'}</div>
            <div><strong>Interesse Sazonal:</strong> ${preferencias.experienciasSazonais || 'Não informado'}</div>
            ${preferencias.profissoes ? `<div><strong>Profissão:</strong> ${preferencias.profissoes}</div>` : ''}
            ${preferencias.ocasiaoEspecial ? `<div style="background: rgba(196,163,90,0.06); padding: 8px 10px; border-radius: 6px; border-left: 3px solid var(--gold); margin-top: 4px;">🎉 <strong>Celebração:</strong> ${preferencias.ocasiaoEspecial}</div>` : ''}
            ${preferencias.necessidadesEspeciais ? `<div style="background: rgba(220,53,69,0.03); padding: 8px 10px; border-radius: 6px; border-left: 3px solid var(--crimson); margin-top: 4px;">⚠️ <strong>Necessidades Especiais:</strong> ${preferencias.necessidadesEspeciais}</div>` : ''}
          </div>

          ${preferencias.experienciasImperdiveis ? `
          <div style="background: rgba(107,31,42,0.02); border: 1px dashed rgba(107,31,42,0.2); border-radius: 8px; padding: 12px; margin-top: 12px;">
            <div style="font-size: 11px; color: var(--crimson); text-transform: uppercase; font-weight:600; margin-bottom:4px;">🌸 Atração dos Sonhos / Imperdível</div>
            <p style="font-size: 12.5px; color: var(--ink-dk); font-style: italic; margin:0; line-height:1.4;">"${preferencias.experienciasImperdiveis}"</p>
          </div>
          ` : ''}
        </div>
      `;
    } else {
      prefHTML = `
        <div style="border-top: 1px solid var(--border); padding-top: 16px; text-align:center;">
          <p style="font-size: 12.5px; color: var(--ink-lt); font-style: italic;">Nenhuma ficha de preferências preenchida para este cliente.</p>
        </div>
      `;
    }

    // Helper simples para formatar datas AAAA-MM-DD para DD/MM
    function fmtDate(isoDate) {
      if(!isoDate) return '';
      const parts = isoDate.split('-');
      if(parts.length < 3) return isoDate;
      return `${parts[2]}/${parts[1]}`;
    }

    content.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <!-- Cabeçalho Rápido -->
        <div style="background: #fff; padding: 14px; border:1px solid var(--border); border-radius:10px;">
          <div style="font-size: 11px; text-transform: uppercase; color: var(--ink-lt); margin-bottom: 2px;">Nome do Grupo</div>
          <div style="font-size: 16px; color: var(--gold-dk); font-weight: 600;">${clientNotion.nome || 'Sem nome'}</div>
          <div style="font-size: 12px; color: var(--ink-dk); margin-top: 4px;">✉️ ${emailStr}</div>
          <div style="font-size: 12px; color: var(--ink-dk); margin-top: 2px;">📅 Período: ${datasViagem}</div>
        </div>

        <!-- Passageiros -->
        <div>
          <h4 style="margin: 0 0 8px 0; color: var(--gold-dk); font-size: 13.5px; text-transform: uppercase; letter-spacing:0.04em;">🧑 Viajantes</h4>
          ${viajantesHTML}
        </div>

        <!-- Voos -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
          <div style="background:rgba(0,0,0,0.01); border:1px solid var(--border); border-radius:8px; padding:10px;">
            <div style="font-size:10px; text-transform:uppercase; color:var(--ink-lt); margin-bottom:2px;">🛫 Chegada</div>
            <div style="font-size:12px; color:var(--ink-dk); font-weight:500; line-height:1.3;">${clientNotion.vooChegada || 'Não informado'}</div>
          </div>
          <div style="background:rgba(0,0,0,0.01); border:1px solid var(--border); border-radius:8px; padding:10px;">
            <div style="font-size:10px; text-transform:uppercase; color:var(--ink-lt); margin-bottom:2px;">🛬 Saída</div>
            <div style="font-size:12px; color:var(--ink-dk); font-weight:500; line-height:1.3;">${clientNotion.vooPartida || 'Não informado'}</div>
          </div>
        </div>

        <!-- Hotéis -->
        <div>
          <h4 style="margin: 0 0 8px 0; color: var(--gold-dk); font-size: 13.5px; text-transform: uppercase; letter-spacing:0.04em;">🏨 Hotéis & Estadias</h4>
          ${estadiasHTML}
        </div>

        <!-- Preferências do Questionário -->
        ${prefHTML}
      </div>
    `;

  } catch (err) {
    console.error(err);
    content.innerHTML = `<div style="text-align:center; padding:40px 20px; color:var(--crimson);">❌ Erro ao carregar informações do cliente: ${err.message}</div>`;
  }
};

window.fecharDrawerPerfilCliente = function() {
  const drawer = document.getElementById('drawerPerfilCliente');
  if (drawer) {
    drawer.style.left = '-450px';
  }
};

window.abrirModalEnviarEmail = async function() {
  const modal = document.getElementById('modalEnviarEmailRoteiro');
  if (!modal) return;

  // Garantir que temos o roteiro em edição e o ID do cliente
  let clienteId = '';
  let roteiroId = '';
  let clientName = 'Cliente';

  if (typeof roteiroEmEdicao !== 'undefined' && roteiroEmEdicao) {
    clienteId = roteiroEmEdicao.notionClienteId || (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.notionClienteId);
    roteiroId = roteiroEmEdicao.id;
    if (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.nome) {
      clientName = roteiroEmEdicao.cliente.nome;
    }
  }

  if (!clienteId) {
    alert("Nenhum cliente vinculado a este roteiro. Vincule um cliente antes de enviar!");
    return;
  }

  // Limpar e preencher destinatário (e-mail) e anexo
  const emailInput = document.getElementById('emailDestinatarioInput');
  const assuntoInput = document.getElementById('emailAssuntoInput');
  const mensagemInput = document.getElementById('emailMensagemInput');
  const fileInput = document.getElementById('emailAnexoPdfInput');
  const senderSelect = document.getElementById('emailRemetenteSelect');
  
  if (fileInput) fileInput.value = '';
  if (emailInput) emailInput.value = 'Carregando...';
  if (assuntoInput) assuntoInput.value = `Roteiro de Viagem — ${clientName}`;
  
  modal.style.display = 'flex';

  // Buscar e-mail real e slug do banco local
  let emailReal = '';
  let slug = '';
  try {
    const res = await fetch('/api/clientes/' + clienteId + '/dados');
    if (res.ok) {
      const data = await res.json();
      const clientLocal = data.clientLocalInfo || {};
      emailReal = clientLocal.email || (clientLocal.emails && clientLocal.emails[0]?.email) || '';
      slug = clientLocal.slug || '';
      
      // Se não houver slug local, gera dinamicamente a partir do nome do cliente
      if (!slug && data.clientInfo && data.clientInfo.nome) {
        slug = data.clientInfo.nome.toString().toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/--+/g, '-')
          .trim();
      }
    }
  } catch (err) {
    console.error("Erro ao buscar e-mail/slug do cliente:", err);
  }

  if (emailInput) {
    emailInput.value = emailReal || '';
  }

  // Montar template
  // O link do roteiro será gerado com base no host atual (funciona no localhost para testes ou na produção automaticamente)
  // O link do portal PRECISA do token de segurança (?t=...). Buscamos do endpoint que ASSINA o link
  // (mesma lógica de todo lugar) em vez de montar na mão — sem token o portal dá 403 pro cliente.
  let linkRoteiro = slug
    ? `${window.location.protocol}//${window.location.host}/cliente/${slug}`
    : `${window.location.protocol}//${window.location.host}/cliente/${clienteId}`; // fallback (sem token) se o endpoint falhar
  try {
    if (clienteId) {
      const rLink = await fetch('/api/clientes/' + encodeURIComponent(clienteId) + '/portal-link');
      if (rLink.ok) {
        const dLink = await rLink.json();
        if (dLink && dLink.success && dLink.url) linkRoteiro = dLink.url;
      }
    }
  } catch (e) { console.error('Erro ao gerar link do portal com token:', e); }
  window.__emailClienteId = clienteId; // p/ marcar 'material enviado' na timeline ao enviar
  
  const getSenderName = () => senderSelect && senderSelect.value === 'diogo' ? 'Diogo' : 'Deborah';
  
  const preencherMensagem = () => {
    if (mensagemInput) {
      mensagemInput.value = `Oi ${clientName},\n\nEspero que esteja bem!\n\nSegue o link do seu roteiro de viagem personalizado para darmos uma olhada:\n${linkRoteiro}\n\nTambém adicionei o arquivo PDF em anexo caso prefira visualizar offline.\n\nSe tiver qualquer dúvida ou quiser ajustar algo, é só me responder por aqui!\n\nAbraços,\n${getSenderName()}`;
    }
  };

  preencherMensagem();

  // Atualizar a assinatura caso o remetente seja alterado no select
  if (senderSelect) {
    // Remover listener anterior se existir para não acumular
    senderSelect.onchange = null;
    senderSelect.onchange = () => {
      const currentSender = getSenderName();
      const oppositeSender = currentSender === 'Diogo' ? 'Deborah' : 'Diogo';
      if (mensagemInput) {
        mensagemInput.value = mensagemInput.value.replace(`Abraços,\n${oppositeSender}`, `Abraços,\n${currentSender}`);
      }
    };
  }
};

window.fecharModalEnviarEmail = function() {
  const modal = document.getElementById('modalEnviarEmailRoteiro');
  if (modal) {
    modal.style.display = 'none';
  }
  const fileInput = document.getElementById('emailAnexoPdfInput');
  if (fileInput) {
    fileInput.value = '';
  }
  const statusDiv = document.getElementById('emailSendingStatus');
  if (statusDiv) statusDiv.style.display = 'none';
};

window.enviarEmailRoteiroExec = async function() {
  console.log('--- ENVIAR E-MAIL INICIADO ---');
  const senderSelect = document.getElementById('emailRemetenteSelect');
  const emailInput = document.getElementById('emailDestinatarioInput');
  const assuntoInput = document.getElementById('emailAssuntoInput');
  const mensagemInput = document.getElementById('emailMensagemInput');
  const fileInput = document.getElementById('emailAnexoPdfInput');
  const btnConfirmar = document.getElementById('btnConfirmarEnviarEmail');
  const statusDiv = document.getElementById('emailSendingStatus');
  const statusText = document.getElementById('emailSendingStatusText');

  console.log('Elementos capturados:', {
    senderSelect: !!senderSelect,
    emailInput: !!emailInput,
    assuntoInput: !!assuntoInput,
    mensagemInput: !!mensagemInput,
    fileInput: !!fileInput
  });

  if (!emailInput || !assuntoInput || !mensagemInput) {
    console.error('Um ou mais elementos de entrada não foram encontrados no DOM.');
    return;
  }

  const to = emailInput.value.trim();
  const subject = assuntoInput.value.trim();
  const body = mensagemInput.value.trim();
  const sender = senderSelect ? senderSelect.value : 'deborah';

  console.log('Valores do formulário:', { to, subject, sender, bodyLength: body.length });

  if (!to) {
    alert("Por favor, preencha o e-mail do destinatário.");
    return;
  }
  if (!subject) {
    alert("Por favor, preencha o assunto do e-mail.");
    return;
  }
  if (!body) {
    alert("Por favor, preencha a mensagem do e-mail.");
    return;
  }

  // Mostrar loading
  if (statusDiv && statusText) {
    statusDiv.style.display = 'flex';
    statusText.textContent = "Processando e-mail... (Convertendo anexos se houver)";
    statusText.style.color = "var(--gold-dk)";
  }
  if (btnConfirmar) btnConfirmar.disabled = true;

  let attachment = null;
  if (fileInput && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    console.log('Arquivo selecionado para anexo:', { name: file.name, size: file.size, type: file.type });
    
    // Converter arquivo para Base64 usando FileReader
    const toBase64 = f => new Promise((resolve, reject) => {
      const r = new FileReader();
      r.readAsDataURL(f);
      r.onload = () => resolve(r.result);
      r.onerror = err => reject(err);
    });

    try {
      if (statusText) statusText.textContent = "📎 Carregando arquivo PDF...";
      console.log('Iniciando conversão para Base64...');
      const base64Content = await toBase64(file);
      console.log('Conversão Base64 concluída. Comprimento da string:', base64Content.length);
      attachment = {
        filename: file.name,
        content: base64Content
      };
    } catch (err) {
      console.error("Erro ao ler anexo PDF:", err);
      alert("Falha ao ler o arquivo PDF anexo.");
      if (btnConfirmar) btnConfirmar.disabled = false;
      if (statusDiv) statusDiv.style.display = 'none';
      return;
    }
  } else {
    // Sem arquivo manual → gera o PDF do roteiro automaticamente a partir do preview aberto (.pdf-doc).
    // Se falhar (lib ausente, imagem externa sem CORS, etc.), segue SEM anexo (o link do portal fica no corpo).
    try {
      const docEl = document.querySelector('#previewContainer .pdf-doc');
      if (typeof html2pdf === 'function' && docEl) {
        if (statusText) statusText.textContent = '🖨️ Gerando o PDF do roteiro...';
        const nomeArq = 'Roteiro Heian Tour.pdf';
        const opt = {
          margin: 0,
          filename: nomeArq,
          image: { type: 'jpeg', quality: 0.95 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', scrollX: 0, scrollY: 0 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };
        const dataUri = await html2pdf().set(opt).from(docEl).outputPdf('datauristring');
        if (dataUri && dataUri.length > 100) {
          attachment = { filename: nomeArq, content: dataUri };
          console.log('PDF automático gerado. Tamanho base64:', dataUri.length);
        }
      } else {
        console.log('html2pdf indisponível ou preview não aberto — enviando sem anexo automático.');
      }
    } catch (errPdf) {
      console.error('Falha ao gerar PDF automático do roteiro (segue sem anexo):', errPdf);
    }
  }

  try {
    if (statusText) statusText.textContent = "✈️ Enviando e-mail para o cliente...";
    console.log('Disparando requisição fetch POST para /api/admin/enviar-roteiro-email...');
    const res = await fetch('/api/admin/enviar-roteiro-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sender, to, subject, body, attachment })
    });

    console.log('Resposta do servidor recebida com status:', res.status);

    if (res.ok) {
      console.log('Envio de e-mail bem sucedido!');
      // Timeline: marca 'material enviado' pro cliente (não bloqueia nada se falhar)
      if (window.__emailClienteId) {
        fetch('/api/clientes/' + encodeURIComponent(window.__emailClienteId) + '/marco', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marco: 'materialEnviado', valor: new Date().toISOString() })
        }).catch(() => {});
      }
      if (statusText) {
        statusText.textContent = "✉️ E-mail enviado com sucesso!";
        statusText.style.color = "#2ecc71";
      }
      setTimeout(() => {
        window.fecharModalEnviarEmail();
      }, 1500);
    } else {
      const errData = await res.json().catch(() => ({}));
      console.error('Resposta de erro do servidor:', errData);
      throw new Error(errData.error || "Erro desconhecido ao enviar");
    }
  } catch (err) {
    console.error("Erro no envio:", err);
    if (statusText) {
      statusText.textContent = `❌ Falha: ${err.message}`;
      statusText.style.color = "var(--crimson)";
    }
  } finally {
    if (btnConfirmar) btnConfirmar.disabled = false;
    console.log('--- ENVIAR E-MAIL FINALIZADO ---');
  }
};


/* ── CADASTROS RÁPIDOS DIRETAMENTE DO ROTEIRO ────────────────────────────── */
window.abrirModalCadastroRapido = function(tipo, idx, eIdx) {
  const container = document.getElementById('modalContent');
  if (!container) return;
  
  let html = '';
  let title = '';
  
  if (tipo === 'atracao') {
    title = 'Cadastrar Nova Atração';
    
    const diasS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
    const diasVal = [1, 2, 3, 4, 5, 6, 0];
    const checkboxesHTML = diasS.map((diaNome, dIdx) => {
      const val = diasVal[dIdx];
      return `<label style="display:inline-flex; align-items:center; margin-right:12px; font-weight:normal; cursor:pointer; font-size:12px;">
                <input type="checkbox" name="m_a_dias_fechados" value="${val}" style="margin-right:4px;"> ${diaNome}
              </label>`;
    }).join('');

    html = `
      <div style="font-family:Jost, sans-serif; max-height: 70vh; overflow-y: auto; padding-right: 8px;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Cidade</label>
            <input type="text" id="cad_atr_cidade" placeholder="Ex: Kyoto" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Bairro</label>
            <input type="text" id="cad_atr_bairro" placeholder="Ex: Higashiyama" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Nome da Atração *</label>
          <input type="text" id="cad_atr_nome" placeholder="Ex: Templo Kinkaku-ji" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Preço do Ingresso (Ex: Gratuito ou ¥400)</label>
          <input type="text" id="cad_atr_preco" placeholder="Ex: ¥500" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Foto (URL)</label>
          <input type="text" id="cad_atr_foto" placeholder="https://..." style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Descrição Detalhada</label>
          <textarea id="cad_atr_desc" rows="3" placeholder="Descrição da atração..." style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px; font-family:inherit;"></textarea>
        </div>
        
        <div style="margin-bottom:12px;">
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Dias Fechados (Recorrente)</label>
          <div style="display:flex; flex-wrap:wrap; margin-top:4px; gap:4px;">
            ${checkboxesHTML}
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Manutenção/Reforma (Início)</label>
            <input type="date" id="m_a_manut_inicio" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Manutenção/Reforma (Fim)</label>
            <input type="date" id="m_a_manut_fim" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
        </div>
        <div style="margin-bottom:16px;">
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Motivo da Manutenção/Reforma</label>
          <input type="text" id="m_a_manut_motivo" placeholder="Ex: Reforma de verão, pintura, etc." style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; position: sticky; bottom: 0; background: var(--bg); padding-top: 10px; border-top: 1px solid var(--border);">
          <button type="button" class="btn-secondary" onclick="closeModal()" style="padding:8px 16px; font-size:12px;">Cancelar</button>
          <button type="button" class="btn-primary" id="btnSalvarAtrRapido" onclick="window.salvarNovaAtracaoRapida(${idx}, ${eIdx})" style="padding:8px 16px; font-size:12px; background:var(--crimson); color:white; border-color:var(--crimson);">Salvar Atração</button>
        </div>
      </div>
    `;
  } else if (tipo === 'rota') {
    title = 'Cadastrar Nova Rota Modelo';
    
    const cidadesSet = new Set();
    if (typeof dbAtracoes !== 'undefined') {
      dbAtracoes.forEach(a => {
        if (a.Cidade) cidadesSet.add(a.Cidade.trim());
      });
    }
    
    let cidadePadrao = '';
    if (idx !== undefined && eIdx !== undefined && roteiroEmEdicao && roteiroEmEdicao.dias[idx] && roteiroEmEdicao.dias[idx].elementos[eIdx]) {
      cidadePadrao = roteiroEmEdicao.dias[idx].elementos[eIdx].cidade || '';
    }
    if (cidadePadrao) cidadesSet.add(cidadePadrao);
    
    const cidadesOpts = Array.from(cidadesSet).sort();
    const optionsHTML = '<option value="">-- Selecione uma Cidade --</option>' + 
      cidadesOpts.map(c => `<option value="${c}" ${c === cidadePadrao ? 'selected' : ''}>${c}</option>`).join('');
      
    window._tempAtracoesSelecionadasRapidas = [];
    window._dragModalRapidoIdx = undefined;
    
    html = `
      <div style="font-family:Jost, sans-serif;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Cidade *</label>
            <select id="cad_rota_cidade" onchange="window.atualizarBairrosDisponiveisRotaRapida(); window.renderModalRotasRapidasUI()" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
              ${optionsHTML}
            </select>
          </div>
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Nome da Rota *</label>
            <input type="text" id="cad_rota_nome" placeholder="Ex: Kyoto Tradicional - Templos do Leste" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
        </div>
        
        <div class="field" style="margin-top:16px;">
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Atrações Selecionadas na Rota (Arraste para reordenar, clique no 'x' para remover)</label>
          <div id="cad_rota_selected" style="min-height: 48px; padding: 12px; border: 1px dashed var(--gold); border-radius: 6px; background: rgba(196,163,90,0.05); display: flex; flex-wrap: wrap; gap: 8px; margin-top:4px;">
          </div>
        </div>
        
        <div class="field" style="margin-top:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid); margin:0;">Atrações Disponíveis (Clique para adicionar)</label>
            <div style="display:flex; gap:8px;">
              <select id="cad_rota_bairro_filter" onchange="window.renderModalRotasRapidasUI()" style="padding:4px 8px; font-size:12px; border:1px solid #ccc; border-radius:4px; max-width:130px;">
                <option value="">Todos os Bairros</option>
              </select>
              <input type="text" id="cad_rota_search" placeholder="Buscar..." oninput="window.renderModalRotasRapidasUI()" style="width:130px; padding:4px 8px; font-size:12px; border:1px solid #ccc; border-radius:4px;">
            </div>
          </div>
          <div id="cad_rota_available" style="max-height: 180px; overflow-y: auto; padding: 12px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-alt); display: flex; flex-wrap: wrap; gap: 8px;">
          </div>
        </div>
        
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:24px;">
          <button type="button" class="btn-secondary" onclick="closeModal()" style="padding:8px 16px; font-size:12px;">Cancelar</button>
          <button type="button" class="btn-primary" id="btnSalvarRotaRapido" onclick="window.salvarNovaRotaRapida(${idx}, ${eIdx})" style="padding:8px 16px; font-size:12px; background:var(--crimson); color:white; border-color:var(--crimson);">Salvar Rota</button>
        </div>
      </div>
    `;
    
    setTimeout(() => { 
      window.atualizarBairrosDisponiveisRotaRapida();
      window.renderModalRotasRapidasUI(); 
    }, 50);
  } else if (tipo === 'transporte') {
    title = 'Cadastrar Novo Transporte';
    html = `
      <div style="font-family:Jost, sans-serif; max-height: 80vh; overflow-y: auto; padding-right: 8px;">
        <div style="margin-bottom:12px;">
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Trecho / Rota *</label>
          <input type="text" id="cad_tr_trecho" placeholder="Ex: Kyoto para Tokyo" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Meio de Transporte</label>
            <select id="cad_tr_tipo" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
              <option value="Trem Bala">Trem Bala</option>
              <option value="Trem Local">Trem Local</option>
              <option value="Metrô">Metrô</option>
              <option value="Ônibus">Ônibus</option>
              <option value="Voo">Voo</option>
              <option value="Táxi">Táxi</option>
              <option value="Carro Privado">Carro Privado</option>
              <option value="Ferry">Ferry</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Linha / Operadora</label>
            <input type="text" id="cad_tr_linha" placeholder="Ex: Shinkansen Nozomi" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Categoria</label>
            <input type="text" id="cad_tr_categoria" placeholder="Ex: Reservado (Green Car)" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Tempo de Viagem</label>
            <input type="text" id="cad_tr_tempo" placeholder="Ex: 2h15" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Preço por Adulto (Ienes - ¥)</label>
            <input type="number" id="cad_tr_preco" placeholder="Ex: 14000" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Preço por Criança (Ienes - ¥)</label>
            <input type="number" id="cad_tr_preco_crianca" placeholder="Ex: 7000" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Observações</label>
          <input type="text" id="cad_tr_obs" placeholder="Observações rápidas..." style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Link de Compra / Info</label>
          <input type="text" id="cad_tr_link" placeholder="https://..." style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Instrução de Compra (Pré-compra)</label>
          <textarea id="cad_tr_compra" rows="2" placeholder="Passo a passo para comprar..." style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px; font-family:inherit;"></textarea>
        </div>
        <div style="margin-bottom:16px;">
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Instrução de Uso (Embarque)</label>
          <textarea id="cad_tr_uso" rows="2" placeholder="Como embarcar, validação de bilhete..." style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px; font-family:inherit;"></textarea>
        </div>
        
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; position: sticky; bottom: 0; background: var(--bg); padding-top: 10px; border-top: 1px solid var(--border);">
          <button type="button" class="btn-secondary" onclick="closeModal()" style="padding:8px 16px; font-size:12px;">Cancelar</button>
          <button type="button" class="btn-primary" id="btnSalvarTrRapido" onclick="window.salvarNovoTransporteRapido(${idx}, ${eIdx})" style="padding:8px 16px; font-size:12px; background:var(--crimson); color:white; border-color:var(--crimson);">Salvar Transporte</button>
        </div>
      </div>
    `;
  } else if (tipo === 'experiencia') {
    title = 'Cadastrar Nova Experiência';
    html = `
      <div style="font-family:Jost, sans-serif; max-height: 80vh; overflow-y: auto; padding-right: 8px;">
        <div style="margin-bottom:12px;">
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Nome da Experiência *</label>
          <input type="text" id="cad_exp_nome" placeholder="Ex: Cerimônia do Chá Tradicional" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Cidade</label>
            <input type="text" id="cad_exp_cidade" placeholder="Ex: Kyoto" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Tipo / Categoria</label>
            <input type="text" id="cad_exp_tipo" placeholder="Ex: Tour Privado ou Ingresso" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Preço por Adulto (Ienes - ¥)</label>
            <input type="number" id="cad_exp_preco" placeholder="Ex: 5000" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Preço por Criança (Ienes - ¥)</label>
            <input type="number" id="cad_exp_preco_crianca" placeholder="Ex: 2500" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Duração</label>
            <input type="text" id="cad_exp_duracao" placeholder="Ex: 2h30" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Horários Típicos</label>
            <input type="text" id="cad_exp_horarios" placeholder="Ex: 10:00–17:00" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Janela de Abertura (dias)</label>
            <input type="number" id="cad_exp_janela" placeholder="Ex: 60" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Prazo Limite p/ Reservar (dias)</label>
            <input type="number" id="cad_exp_prazo" placeholder="Ex: 14" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Público-alvo</label>
            <input type="text" id="cad_exp_publico" placeholder="Ex: Todos / Famílias" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
          <div>
            <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Sazonalidade</label>
            <input type="text" id="cad_exp_sazonal" placeholder="Ex: Ano todo / Primavera" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Link de Reserva / Info</label>
          <input type="text" id="cad_exp_link" placeholder="https://..." style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
        </div>
        <div style="margin-bottom:12px;">
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Descrição Curta (aparece no roteiro)</label>
          <textarea id="cad_exp_desc" rows="2" placeholder="Informações resumidas..." style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px; font-family:inherit;"></textarea>
        </div>
        <div style="margin-bottom:16px;">
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Observações / Instruções de Reserva</label>
          <textarea id="cad_exp_obs" rows="2" placeholder="Detalhes de operadora, fornecedor, etc..." style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px; font-family:inherit;"></textarea>
        </div>
        
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px; position: sticky; bottom: 0; background: var(--bg); padding-top: 10px; border-top: 1px solid var(--border);">
          <button type="button" class="btn-secondary" onclick="closeModal()" style="padding:8px 16px; font-size:12px;">Cancelar</button>
          <button type="button" class="btn-primary" id="btnSalvarExpRapido" onclick="window.salvarNovaExperienciaRapida(${idx}, ${eIdx})" style="padding:8px 16px; font-size:12px; background:var(--crimson); color:white; border-color:var(--crimson);">Salvar Experiência</button>
        </div>
      </div>
    `;
  }
  
  container.innerHTML = `
    <h2 style="margin: 0 0 20px 0; color: var(--gold-dk); font-size: 22px; font-family: var(--ff-display); font-weight: 500;">${title}</h2>
    ${html}
  `;
  
  openModal();
};

window.salvarNovaAtracaoRapida = async function(idx, eIdx) {
  const nome = document.getElementById('cad_atr_nome').value.trim();
  const cidade = document.getElementById('cad_atr_cidade').value.trim();
  const bairro = document.getElementById('cad_atr_bairro').value.trim();
  const preco = document.getElementById('cad_atr_preco').value.trim();
  const desc = document.getElementById('cad_atr_desc').value.trim();
  const foto = document.getElementById('cad_atr_foto').value.trim();
  
  if (!nome) { alert('O nome da atração é obrigatório!'); return; }
  
  const payload = {
    "Nome da Atração": nome,
    "Cidade": cidade,
    "Bairro": bairro,
    "Preço (Ingresso)": preco,
    "Descrição Detalhada": desc,
    "Foto (URL)": foto
  };
  
  try {
    const btn = document.getElementById('btnSalvarAtrRapido');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    
    const res = await fetch('/api/atracoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error(await res.text());
    const novaAtr = await res.json();
    
    dbAtracoes.push(novaAtr);
    atracaoMap.set(novaAtr['Nome da Atração'].toLowerCase(), novaAtr);
    if (typeof state !== 'undefined' && state.atracoesDB) {
      state.atracoesDB.push(novaAtr);
    }
    
    if (idx !== undefined && eIdx !== undefined) {
      roteiroEmEdicao.dias[idx].elementos[eIdx].atracoesDoDia.push(nome);
      renderEditDias();
    }
    
    closeModal();
  } catch(e) {
    alert('Erro ao salvar atração: ' + e.message);
    console.error(e);
    const btn = document.getElementById('btnSalvarAtrRapido');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Salvar Atração';
    }
  }
};

window.salvarNovaRotaRapida = async function(idx, eIdx) {
  const nomeDaRota = document.getElementById('cad_rota_nome').value.trim();
  const cidade = document.getElementById('cad_rota_cidade').value;
  const atracoesDoDia = window._tempAtracoesSelecionadasRapidas;
  
  if (!cidade) { alert('A cidade é obrigatória!'); return; }
  if (!nomeDaRota) { alert('O nome da rota é obrigatório!'); return; }
  
  const payload = {
    nomeDaRota,
    cidade,
    atracoesDoDia
  };
  
  try {
    const btn = document.getElementById('btnSalvarRotaRapido');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    
    const res = await fetch('/api/rotas-base', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error(await res.text());
    const novaRota = await res.json();
    
    if (typeof state !== 'undefined' && state.rotasDB) {
      state.rotasDB.push(novaRota);
    }
    
    if (idx !== undefined && eIdx !== undefined) {
      roteiroEmEdicao.dias[idx].elementos[eIdx].cidade = cidade;
      roteiroEmEdicao.dias[idx].elementos[eIdx].nomeDaRota = nomeDaRota;
      roteiroEmEdicao.dias[idx].elementos[eIdx].atracoesDoDia = atracoesDoDia;
      renderEditDias();
    }
    
    closeModal();
  } catch(e) {
    alert('Erro ao salvar rota: ' + e.message);
    console.error(e);
    const btn = document.getElementById('btnSalvarRotaRapido');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Salvar Rota';
    }
  }
};

window._tempAtracoesSelecionadasRapidas = [];
window._dragModalRapidoIdx = undefined;

window.renderModalRotasRapidasUI = function() {
  const cidadeSelect = document.getElementById('cad_rota_cidade');
  const selContainer = document.getElementById('cad_rota_selected');
  const availContainer = document.getElementById('cad_rota_available');
  if (!cidadeSelect || !selContainer || !availContainer) return;
  
  const cidade = cidadeSelect.value;
  if (!cidade) {
    selContainer.innerHTML = '';
    availContainer.innerHTML = '<span style="color:var(--ink-lt); font-size:12px;">Selecione uma cidade primeiro.</span>';
    return;
  }
  
  const atracoesDaCidade = dbAtracoes.filter(a => (a.Cidade || '').trim().toLowerCase() === cidade.toLowerCase()).map(a => a['Nome da Atração']).filter(Boolean);
  
  selContainer.innerHTML = '';
  if (window._tempAtracoesSelecionadasRapidas.length === 0) {
    selContainer.innerHTML = '<span style="color:var(--ink-lt); font-size:12px; margin:auto">Nenhuma atração selecionada.</span>';
  } else {
    window._tempAtracoesSelecionadasRapidas.forEach((nome, i) => {
      const match = window.buscarAtracaoNoMapa(nome);
      let isBairro = false;
      if (match) {
        const bairro = match['Bairro'] || '';
        isBairro = (bairro && bairro.toLowerCase() === nome.toLowerCase()) || nome.toLowerCase().includes('bairro');
      } else {
        isBairro = nome.toLowerCase().includes('bairro');
      }
      
      const extraClass = isBairro ? ' bairro' : ' sub-atracao';
      const prefixo = isBairro ? '• ' : '› ';
      
      const chip = document.createElement('div');
      chip.className = 'chip-atracao' + extraClass;
      chip.style.display = 'inline-flex';
      chip.style.alignItems = 'center';
      chip.style.gap = '8px';
      chip.draggable = true;
      chip.innerHTML = `<span>${prefixo}${nome}</span><span onclick="window.removerAtracaoModalRapida(${i})" style="color:var(--crimson); cursor:pointer; font-weight:bold; padding-left:4px">&times;</span>`;
      
      chip.addEventListener('dragstart', (e) => { window._dragModalRapidoIdx = i; e.dataTransfer.effectAllowed = 'move'; chip.style.opacity = '0.5'; });
      chip.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      chip.addEventListener('drop', (e) => {
        e.preventDefault();
        chip.style.opacity = '1';
        if (window._dragModalRapidoIdx === undefined || window._dragModalRapidoIdx === i) return;
        const arr = window._tempAtracoesSelecionadasRapidas;
        const item = arr.splice(window._dragModalRapidoIdx, 1)[0];
        arr.splice(i, 0, item);
        window._dragModalRapidoIdx = undefined;
        window.renderModalRotasRapidasUI();
      });
      chip.addEventListener('dragend', () => { chip.style.opacity = '1'; });
      selContainer.appendChild(chip);
    });
  }
  
  availContainer.innerHTML = '';
  const busca = (document.getElementById('cad_rota_search')?.value || '').trim().toLowerCase();
  const bairroSelecionado = document.getElementById('cad_rota_bairro_filter')?.value || '';
  
  let disponiveis = atracoesDaCidade;
  if (bairroSelecionado) {
    disponiveis = disponiveis.filter(nome => {
      const match = window.buscarAtracaoNoMapa(nome);
      if (!match) return false;
      return (match.Bairro || '').trim().toLowerCase() === bairroSelecionado.trim().toLowerCase();
    });
  }
  
  disponiveis = disponiveis.filter(a => !window._tempAtracoesSelecionadasRapidas.includes(a) && a.toLowerCase().includes(busca));
  if (disponiveis.length === 0) {
    availContainer.innerHTML = '<span style="color:var(--ink-lt); font-size:12px;">Nenhuma atração disponível.</span>';
  } else {
    disponiveis.forEach(nome => {
      const match = window.buscarAtracaoNoMapa(nome);
      let isBairro = false;
      if (match) {
        const bairro = match['Bairro'] || '';
        isBairro = (bairro && bairro.toLowerCase() === nome.toLowerCase()) || nome.toLowerCase().includes('bairro');
      } else {
        isBairro = nome.toLowerCase().includes('bairro');
      }
      
      const extraClass = isBairro ? ' bairro' : ' sub-atracao';
      const prefixo = isBairro ? '• ' : '› ';
      
      const chip = document.createElement('div');
      chip.className = 'chip-atracao' + extraClass;
      chip.style.cursor = 'pointer';
      
      if (isBairro) {
        chip.style.background = 'rgba(154, 51, 64, 0.05)';
        chip.style.color = 'var(--l-wine)';
        chip.style.borderColor = 'rgba(154, 51, 64, 0.3)';
        chip.style.borderStyle = 'dashed';
        chip.style.borderWidth = '1px';
      } else {
        chip.style.background = 'rgba(196,163,90,0.08)';
        chip.style.color = 'var(--gold-dk)';
        chip.style.borderColor = 'rgba(196,163,90,0.3)';
        chip.style.borderStyle = 'dashed';
        chip.style.borderWidth = '1px';
      }
      
      chip.textContent = '+ ' + prefixo + nome;
      chip.onclick = () => {
        window._tempAtracoesSelecionadasRapidas.push(nome);
        window.renderModalRotasRapidasUI();
      };
      availContainer.appendChild(chip);
    });
  }
};

window.removerAtracaoModalRapida = function(idx) {
  window._tempAtracoesSelecionadasRapidas.splice(idx, 1);
  window.renderModalRotasRapidasUI();
};

window.atualizarBairrosDisponiveisRotaRapida = function() {
  const cidadeSelect = document.getElementById('cad_rota_cidade');
  const bairroFilter = document.getElementById('cad_rota_bairro_filter');
  if (!cidadeSelect || !bairroFilter) return;
  
  const cidade = cidadeSelect.value;
  if (!cidade) {
    bairroFilter.innerHTML = '<option value="">Todos os Bairros</option>';
    return;
  }
  
  const bairrosSet = new Set();
  dbAtracoes.forEach(a => {
    if ((a.Cidade || '').trim().toLowerCase() === cidade.toLowerCase() && a.Bairro) {
      bairrosSet.add(a.Bairro.trim());
    }
  });
  
  const bairrosList = Array.from(bairrosSet).sort();
  bairroFilter.innerHTML = '<option value="">Todos os Bairros</option>' +
    bairrosList.map(b => `<option value="${b}">${b}</option>`).join('');
};

window.salvarNovoTransporteRapido = async function(idx, eIdx) {
  const trecho = document.getElementById('cad_tr_trecho').value.trim();
  const tipo = document.getElementById('cad_tr_tipo').value;
  const linha = document.getElementById('cad_tr_linha').value.trim();
  const categoria = document.getElementById('cad_tr_categoria').value.trim();
  const preco = parseFloat(document.getElementById('cad_tr_preco').value) || 0;
  const precoCrianca = parseFloat(document.getElementById('cad_tr_preco_crianca').value) || 0;
  const tempo = document.getElementById('cad_tr_tempo').value.trim();
  
  if (!trecho) { alert('O trecho é obrigatório!'); return; }
  
  const payload = {
    trecho,
    tipo,
    linha,
    categoria,
    idade: 'Adulto',
    preco_jpy: preco,
    tempo
  };
  
  try {
    const btn = document.getElementById('btnSalvarTrRapido');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    
    const res = await fetch('/api/transportes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error(await res.text());
    const novoTr = await res.json();

    // Preço-criança vira uma linha "Infantil" própria (modelo é 1 linha por idade)
    if (precoCrianca > 0) {
      try {
        await fetch('/api/transportes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trecho, tipo, linha, categoria, idade: 'Infantil', preco_jpy: precoCrianca, tempo })
        });
      } catch (e2) { console.warn('Falha ao criar linha infantil do transporte', e2); }
    }
    
    window.dbTransportesCache = null;
    if (typeof state !== 'undefined' && state.transportesDB) {
      state.transportesDB.push(novoTr);
    }
    
    if (idx !== undefined && eIdx !== undefined) {
      roteiroEmEdicao.dias[idx].elementos[eIdx].trechoId = String(novoTr.id);
      renderEditDias();
    }
    
    closeModal();
  } catch(e) {
    alert('Erro ao salvar transporte: ' + e.message);
    console.error(e);
    const btn = document.getElementById('btnSalvarTrRapido');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Salvar Transporte';
    }
  }
};

window.salvarNovaExperienciaRapida = async function(idx, eIdx) {
  const nome = document.getElementById('cad_exp_nome').value.trim();
  const cidade = document.getElementById('cad_exp_cidade').value.trim();
  const tipo = document.getElementById('cad_exp_tipo').value.trim();
  const preco = parseFloat(document.getElementById('cad_exp_preco').value) || 0;
  const precoCrianca = parseFloat(document.getElementById('cad_exp_preco_crianca').value) || 0;
  const duracao = document.getElementById('cad_exp_duracao').value.trim();
  const horarios = document.getElementById('cad_exp_horarios').value.trim();
  const janelaAbreDias = parseInt(document.getElementById('cad_exp_janela').value) || 0;
  const prazoDias = parseInt(document.getElementById('cad_exp_prazo').value) || 0;
  const publico = document.getElementById('cad_exp_publico').value.trim();
  const sazonalidade = document.getElementById('cad_exp_sazonal').value.trim();
  const link = document.getElementById('cad_exp_link').value.trim();
  const descricao = document.getElementById('cad_exp_desc').value.trim();
  const observacao = document.getElementById('cad_exp_obs').value.trim();
  
  if (!nome) { alert('O nome da experiência é obrigatório!'); return; }
  
  const payload = {
    nome,
    cidade,
    tipo,
    preco_jpy: preco,
    preco_crianca_jpy: precoCrianca,
    duracao,
    horarios,
    janelaAbreDias,
    prazoDias,
    publico,
    sazonalidade,
    link,
    descricao,
    observacao
  };
  
  try {
    const btn = document.getElementById('btnSalvarExpRapido');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    
    const res = await fetch('/api/experiencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error(await res.text());
    const novaExp = await res.json();
    
    window.dbExperienciasCache = null;
    if (typeof state !== 'undefined' && state.experienciasDB) {
      state.experienciasDB.push(novaExp);
    }
    
    if (idx !== undefined && eIdx !== undefined) {
      roteiroEmEdicao.dias[idx].elementos[eIdx].expId = String(novaExp.id);
      roteiroEmEdicao.dias[idx].elementos[eIdx].nomeExp = nome;
      renderEditDias();
    }
    
    closeModal();
  } catch(e) {
    alert('Erro ao salvar experiência: ' + e.message);
    console.error(e);
    const btn = document.getElementById('btnSalvarExpRapido');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Salvar Experiência';
    }
  }
};


/* ── EDIÇÃO RÁPIDA DE ITEM DIRETAMENTE DO ROTEIRO ─────────────────────────── */
window.abrirModalEdicaoAtracao = function(nomeAtracao) {
  const match = window.buscarAtracaoNoMapa(nomeAtracao);
  if (!match) {
    alert(`A atração "${nomeAtracao}" não foi encontrada na base de dados.`);
    return;
  }
  
  const container = document.getElementById('modalContent');
  if (!container) return;
  
  const id = match.id || match['Nome da Atração'];
  const nome = match['Nome da Atração'] || '';
  const cidade = match['Cidade'] || '';
  const bairro = match['Bairro'] || '';
  const preco = match['Preço (Ingresso)'] || '';
  const desc = match['Descrição Detalhada'] || '';
  const foto = match['Foto (URL)'] || '';
  const maps = match['Google Maps'] || match['Link do Google Maps'] || match.mapsUrl || match.linkMaps || match.link || '';
  
  const html = `
    <div style="font-family:Jost, sans-serif;">
      <div style="margin-bottom:12px;">
        <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Nome da Atração *</label>
        <input type="text" id="edit_atr_nome" value="${nome.replace(/"/g, '&quot;')}" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">
        <div>
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Cidade</label>
          <input type="text" id="edit_atr_cidade" value="${cidade.replace(/"/g, '&quot;')}" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
        </div>
        <div>
          <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Bairro</label>
          <input type="text" id="edit_atr_bairro" value="${bairro.replace(/"/g, '&quot;')}" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Preço do Ingresso</label>
        <input type="text" id="edit_atr_preco" value="${preco.replace(/"/g, '&quot;')}" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Foto (URL)</label>
        <input type="text" id="edit_atr_foto" value="${foto.replace(/"/g, '&quot;')}" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Google Maps (Link / Como Chegar - Opcional)</label>
        <input type="text" id="edit_atr_maps" placeholder="https://maps.app.goo.gl/... ou https://google.com/maps/..." value="${maps.replace(/"/g, '&quot;')}" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px;">
      </div>
      <div style="margin-bottom:16px;">
        <label style="font-size:11px; font-weight:600; color:var(--ink-mid);">Descrição Detalhada</label>
        <textarea id="edit_atr_desc" rows="3" style="width:100%; padding:8px; border:1px solid var(--border); border-radius:6px; font-size:13px; margin-top:4px; font-family:inherit;">${desc}</textarea>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:20px;">
        <button type="button" class="btn-secondary" onclick="closeModal()" style="padding:8px 16px; font-size:12px;">Cancelar</button>
        <button type="button" class="btn-primary" id="btnSalvarEditAtr" onclick="window.salvarEdicaoAtracao('${id.toString().replace(/'/g, "\\'")}', '${nome.replace(/'/g, "\\'")}')" style="padding:8px 16px; font-size:12px; background:var(--crimson); color:white; border-color:var(--crimson);">Salvar Alterações</button>
      </div>
    </div>
  `;
  
  container.innerHTML = `
    <h2 style="margin: 0 0 20px 0; color: var(--gold-dk); font-size: 22px; font-family: var(--ff-display); font-weight: 500;">Editar Atração</h2>
    ${html}
  `;
  
  openModal();
};

window.salvarEdicaoAtracao = async function(idOriginal, nomeOriginal) {
  const nome = document.getElementById('edit_atr_nome').value.trim();
  const cidade = document.getElementById('edit_atr_cidade').value.trim();
  const bairro = document.getElementById('edit_atr_bairro').value.trim();
  const preco = document.getElementById('edit_atr_preco').value.trim();
  const desc = document.getElementById('edit_atr_desc').value.trim();
  const foto = document.getElementById('edit_atr_foto').value.trim();
  const maps = document.getElementById('edit_atr_maps') ? document.getElementById('edit_atr_maps').value.trim() : '';
  
  if (!nome) { alert('O nome da atração é obrigatório!'); return; }
  
  const payload = {
    "Nome da Atração": nome,
    "Cidade": cidade,
    "Bairro": bairro,
    "Preço (Ingresso)": preco,
    "Google Maps": maps,
    "Link do Google Maps": maps,
    "mapsUrl": maps,
    "Descrição Detalhada": desc,
    "Foto (URL)": foto
  };
  
  try {
    const btn = document.getElementById('btnSalvarEditAtr');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    
    const res = await fetch(`/api/atracoes/${encodeURIComponent(idOriginal)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error(await res.text());
    const atracaoAtualizada = await res.json();
    
    const idx = dbAtracoes.findIndex(a => a.id == idOriginal || a['Nome da Atração'] === nomeOriginal);
    if (idx !== -1) {
      dbAtracoes[idx] = atracaoAtualizada;
    }
    
    atracaoMap.delete(nomeOriginal.toLowerCase());
    atracaoMap.set(nome.toLowerCase(), atracaoAtualizada);
    
    if (typeof state !== 'undefined' && state.atracoesDB) {
      const idxState = state.atracoesDB.findIndex(a => a.id == idOriginal || a['Nome da Atração'] === nomeOriginal);
      if (idxState !== -1) {
        state.atracoesDB[idxState] = atracaoAtualizada;
      }
    }
    
    if (nomeOriginal !== nome && typeof roteiroEmEdicao !== 'undefined' && roteiroEmEdicao.dias) {
      roteiroEmEdicao.dias.forEach(d => {
        if (d.elementos) {
          d.elementos.forEach(el => {
            if (el.tipo === 'sequencia' && el.atracoesDoDia) {
              const idxRef = el.atracoesDoDia.indexOf(nomeOriginal);
              if (idxRef !== -1) {
                el.atracoesDoDia[idxRef] = nome;
              }
            }
          });
        }
      });
    }
    
    renderEditDias();
    closeModal();
  } catch(e) {
    alert('Erro ao editar atração: ' + e.message);
    console.error(e);
    const btn = document.getElementById('btnSalvarEditAtr');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Salvar Alterações';
    }
  }
};

function obterDropdownGlobal() {
  let el = document.getElementById('dropdownAtracoesGlobal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'dropdownAtracoesGlobal';
    el.className = 'dropdown-atracoes-list';
    el.style.cssText = 'display:none; position:fixed; background:white; border:1px solid var(--border); border-radius:8px; box-shadow:var(--shadow-md); overflow-y:auto; z-index:999999; padding:4px 0;';
    document.body.appendChild(el);
  }
  return el;
}

window.abrirDropdownAtracoesGlobal = function(input, idx, eIdx) {
  const el = obterDropdownGlobal();
  el.dataset.idx = idx;
  el.dataset.eIdx = eIdx;
  window.activeDropdownInput = input;

  const bloco = roteiroEmEdicao.dias[idx].elementos[eIdx];
  const cidade = bloco ? (bloco.cidade || '') : '';

  const html = window.gerarDropdownAtracoesHTML(cidade, input.value, idx, eIdx);
  el.innerHTML = html;

  const rect = input.getBoundingClientRect();
  
  let maxHeight = 450;
  const windowHeight = window.innerHeight;
  const spaceBelow = windowHeight - rect.bottom - 16;
  const spaceAbove = rect.top - 16;

  let topPos;
  if (spaceBelow >= 300 || spaceBelow >= spaceAbove) {
    topPos = rect.bottom + 4;
    maxHeight = Math.min(maxHeight, spaceBelow);
  } else {
    maxHeight = Math.min(maxHeight, spaceAbove);
    topPos = rect.top - maxHeight - 4;
  }

  el.style.top = `${topPos}px`;
  el.style.left = `${rect.left}px`;
  el.style.width = `${rect.width}px`;
  el.style.maxHeight = `${maxHeight}px`;
  el.style.display = 'block';
};

window.filtrarDropdownAtracoesGlobal = function(input, idx, eIdx) {
  const el = obterDropdownGlobal();
  
  const bloco = roteiroEmEdicao.dias[idx].elementos[eIdx];
  const cidade = bloco ? (bloco.cidade || '') : '';

  const html = window.gerarDropdownAtracoesHTML(cidade, input.value, idx, eIdx);
  el.innerHTML = html;

  const rect = input.getBoundingClientRect();
  
  let maxHeight = 450;
  const windowHeight = window.innerHeight;
  const spaceBelow = windowHeight - rect.bottom - 16;
  const spaceAbove = rect.top - 16;

  let topPos;
  if (spaceBelow >= 300 || spaceBelow >= spaceAbove) {
    topPos = rect.bottom + 4;
    maxHeight = Math.min(maxHeight, spaceBelow);
  } else {
    maxHeight = Math.min(maxHeight, spaceAbove);
    topPos = rect.top - maxHeight - 4;
  }

  el.style.top = `${topPos}px`;
  el.style.left = `${rect.left}px`;
  el.style.width = `${rect.width}px`;
  el.style.maxHeight = `${maxHeight}px`;
};

window.fecharDropdownAtracoesGlobal = function(input) {
  const el = obterDropdownGlobal();
  setTimeout(() => {
    el.style.display = 'none';
  }, 250);
};

window.selecionarAtracaoDropdown = function(nomeAtracao, idx, eIdx) {
  if (window.activeDropdownInput) {
    window.activeDropdownInput.value = '';
  }
  if (typeof window.addAtracaoBloco === 'function') {
    window.addAtracaoBloco(idx, eIdx, nomeAtracao);
  }
};

window.gerarDropdownAtracoesHTML = function(cidade, filtro = '', idx, eIdx) {
  if (typeof dbAtracoes === 'undefined' || !Array.isArray(dbAtracoes)) {
    return `<div style="padding:12px; font-size:12.5px; color:var(--ink-lt); text-align:center;">Base de dados não inicializada.</div>`;
  }

  const atracoesFiltradas = dbAtracoes.filter(a => {
    if (!a) return false;
    if (cidade && a['Cidade'] && a['Cidade'].toLowerCase() !== cidade.toLowerCase()) return false;
    if (!a['Nome da Atração']) return false;
    if (filtro) {
      const matchText = [a['Nome da Atração'], a['Bairro'] || ''].join(' ').toLowerCase();
      return matchText.includes(filtro.toLowerCase());
    }
    return true;
  });

  const grupos = {};
  atracoesFiltradas.forEach(a => {
    const bairro = a['Bairro'] || 'Outros / Sem Bairro';
    if (!grupos[bairro]) grupos[bairro] = [];
    grupos[bairro].push(a);
  });

  let html = '';
  const bairrosOrdenados = Object.keys(grupos).sort((x, y) => {
    if (x === 'Outros / Sem Bairro') return 1;
    if (y === 'Outros / Sem Bairro') return -1;
    return x.localeCompare(y);
  });

  bairrosOrdenados.forEach(bairro => {
    const isRealBairro = bairro !== 'Outros / Sem Bairro';
    
    // Filtrar para remover o item redundante que tem o mesmo nome do bairro
    const itens = grupos[bairro]
      .filter(item => {
        if (!isRealBairro) return true;
        return item['Nome da Atração'].trim().toLowerCase() !== bairro.trim().toLowerCase();
      })
      .sort((x, y) => x['Nome da Atração'].localeCompare(y['Nome da Atração']));

    if (itens.length > 0 || isRealBairro) {
      if (isRealBairro) {
        // Cabeçalho de bairro clicável premium que adiciona o Bairro
        html += `
          <div class="dropdown-group-header clickable-bairro" onmousedown="window.selecionarAtracaoDropdown('${bairro.replace(/'/g, "\\'")}', ${idx}, ${eIdx})" style="display:flex; justify-content:space-between; align-items:center; font-size:10.5px; text-transform:uppercase; letter-spacing:0.06em; color:var(--gold-dk); font-weight:700; padding:8px 12px; background:#faf7f2; border-bottom:1px solid #f2ece0; border-top:1px solid #f2ece0; margin-top:4px; cursor:pointer; transition: background 0.1s;" onmouseover="this.style.background='#f3ebd9'" onmouseout="this.style.background='#faf7f2'">
            <span>📍 ${bairro}</span>
            <span style="font-size:8px; font-weight:700; background:rgba(196,163,90,0.15); color:var(--gold-dk); padding:2px 6.5px; border-radius:12px; letter-spacing:0.03em; user-select:none;">Região (Bairro)</span>
          </div>
        `;
      } else {
        // Cabeçalho genérico não clicável
        html += `
          <div class="dropdown-group-header" style="font-size:10px; text-transform:uppercase; letter-spacing:0.06em; color:var(--ink-lt); font-weight:700; padding:6px 12px; background:#f5f5f5; border-bottom:1px solid var(--border); border-top:1px solid var(--border); margin-top:4px; user-select:none;">
            📍 ${bairro}
          </div>
        `;
      }

      itens.forEach(item => {
        const nome = item['Nome da Atração'];
        const isBairroLabel = (item['Bairro'] && item['Bairro'].toLowerCase() === nome.toLowerCase()) || nome.toLowerCase().includes('bairro');
        
        let chipBg = 'rgba(142,28,28,0.06)';
        let chipColor = 'var(--crimson)';
        let chipLabel = 'Atração';
        if (isBairroLabel) {
          chipBg = 'rgba(196,163,90,0.08)';
          chipColor = 'var(--gold-dk)';
          chipLabel = 'Bairro';
        }

        html += `
          <div class="dropdown-item" onmousedown="window.selecionarAtracaoDropdown('${nome.replace(/'/g, "\\'")}', ${idx}, ${eIdx})" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; cursor:pointer; font-size:12.5px; color:var(--ink); border-bottom:1px solid #f9f9f9; transition: background 0.1s;" onmouseover="this.style.background='#fbf9f6'" onmouseout="this.style.background='none'">
            <span style="font-weight:500;">${nome}</span>
            <span style="font-size:9px; font-weight:700; background:${chipBg}; color:${chipColor}; padding:2.5px 6.5px; border-radius:12px; text-transform:uppercase; letter-spacing:0.03em; user-select:none;">${chipLabel}</span>
          </div>
        `;
      });
    }
  });

  if (!html) {
    html = `<div style="padding:12px; font-size:12.5px; color:var(--ink-lt); text-align:center;">Nenhuma atração encontrada.</div>`;
  }
  return html;
};

