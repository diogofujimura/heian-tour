toure a tela na direita ou embaixo
  let topPos = rect.bottom + 8;
  let leftPos = rect.left;
  
  if (topPos + 150 > window.innerHeight) {
    topPos = rect.top - 160; // Abre pra cima se não couber embaixo
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

function migrarDiaParaNovaEstrutura(dia) {
  if (dia.blocos) return dia;
  return {
    dataDoTour: dia.dataDoTour || '',
    horarioEncontro: dia.horarioEncontro || '',
    localEncontro: dia.localEncontro || '',
    tourGuiado: dia.tourGuiado || false,
    blocos: [{
      cidade: dia.cidade || '',
      nomeDaRota: dia.nomeDaRota || '',
      atracoesDoDia: dia.atracoesDoDia ? [...dia.atracoesDoDia] : []
    }]
  };
}

function setupEditorEvents() {
  document.getElementById('btnNovoRoteiro').addEventListener('click', () => {
    roteiroOriginalNome = '';
    roteiroEmEdicao = { cliente: {nome:'', adultos:2, criancas:0, dataOrcamento:''}, dias: [] };
    abrirEditorRoteiro('Novo Roteiro');
  });

  document.getElementById('btnEditarRoteiro').addEventListener('click', () => {
    const nome = document.getElementById('selectRoteiroBase').value;
    if (!nome) return;
    roteiroOriginalNome = nome;
    
    const data = dbRotas[nome];
    if (Array.isArray(data)) {
      roteiroEmEdicao = { cliente: {nome:'', adultos:2, criancas:0, dataOrcamento:''}, dias: JSON.parse(JSON.stringify(data)).map(migrarDiaParaNovaEstrutura) };
    } else {
      roteiroEmEdicao = JSON.parse(JSON.stringify(data));
      if (!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {nome:'', adultos:2, criancas:0, dataOrcamento:''};
      if (roteiroEmEdicao.dias) roteiroEmEdicao.dias = roteiroEmEdicao.dias.map(migrarDiaParaNovaEstrutura);
      else roteiroEmEdicao.dias = [];
    }
    abrirEditorRoteiro(nome);
  });

  document.getElementById('btnExcluirRoteiro').addEventListener('click', async () => {
    const nome = document.getElementById('selectRoteiroBase').value;
    if (!nome) return;
    if (!confirm(`Tem certeza que deseja excluir o roteiro "${nome}"?`)) return;
    
    await fetch(`/api/roteiros/${encodeURIComponent(nome)}`, { method: 'DELETE' });
    delete dbRotas[nome];
    preencherSelectRoteiros();
    renderizarRoteiro('');
  });

  document.getElementById('btnGerarRoteiro').addEventListener('click', () => {
    const nome = document.getElementById('selectRoteiroBase').value;
    if (!nome) return;
    
    // Clonar o visual do roteiro para o previewOverlay (o mesmo usado pelo Orçamento)
    const previewCont = document.getElementById('previewContainer');
    const timelineOrig = document.getElementById('roteiroTimeline');
    if (!previewCont || !timelineOrig) return;
    
    // Configura o visual da exportação
    previewCo