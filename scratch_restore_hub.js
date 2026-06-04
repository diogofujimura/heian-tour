const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const regex = /function formatHubButtons\(\) \{[\s\S]*?(?=\n\}\n\nwindow\.abrirVisaoGeralCliente)/;

const newCode = `function formatHubButtons() {
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
        if (resp.ok) {
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
  }`;

if (regex.test(app)) {
  app = app.replace(regex, newCode);
  fs.writeFileSync('public/js/app.js', app);
  console.log('Restored formatHubButtons showing missing Gerar buttons');
} else {
  console.log('Regex did not match formatHubButtons');
}
