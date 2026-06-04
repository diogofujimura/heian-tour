const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const regex = /function formatHubButtons\(\) \{[\s\S]*?(?=\n\}\n\nwindow\.abrirClienteModal)/;

const newCode = `function formatHubButtons() {
  const btnCotacao = document.getElementById('btnAcessoCotacao');
  const btnRoteiro = document.getElementById('btnAcessoRoteiro');
  if (!btnCotacao || !btnRoteiro) return;
  
  if (!currentEditingClienteId) {
    btnCotacao.style.display = 'none';
    btnRoteiro.style.display = 'none';
    return;
  }
  
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

  if (orc || roteiroNome) {
    // J TEM UM DOS DOIS SALVO
    if (orc) {
      btnCotacao.style.display = 'block';
      btnCotacao.innerText = 'Abrir Cotação';
      btnCotacao.onclick = () => { closeClienteModal(); abrirOrcamento(orc.id); navToPage('orcamento'); };
    } else {
      btnCotacao.style.display = 'none';
    }

    const rotNomeLinkado = (orc && orc.orcRoteiroVinculado) ? orc.orcRoteiroVinculado : roteiroNome;
    if (rotNomeLinkado) {
      btnRoteiro.style.display = 'block';
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
      btnRoteiro.style.display = 'none';
    }
  } else {
    // NO TEM NADA - MOSTRA "GERAR" PARA OS DOIS
    btnCotacao.style.display = 'block';
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
    
    btnRoteiro.style.display = 'block';
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
      
      const novoRoteiroObj = {
        cliente: {
          nome: safeNome,
          adultos: safeAdultos,
          criancas: safeCriancas
        },
        dias: diasList
      };
      
      try {
        const resp = await fetch('/api/roteiros', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ nomeRota: nomeRoteiro, rotaObj: novoRoteiroObj })
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
  console.log('Fixed formatHubButtons completely');
} else {
  console.log('Regex did not match formatHubButtons');
}
