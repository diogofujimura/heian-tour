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
  
  // Buscar orcamento
  const orc = state.orcamentosDB.find(o => o.notionClienteId === currentEditingClienteId);
  { // Keep scope block
    if (orc) {
      btnCotacao.innerText = 'Abrir Cotação';
      btnCotacao.onclick = () => { closeClienteModal(); abrirOrcamento(orc.id); navToPage('orcamento'); };
      
      if (orc.orcRoteiroVinculado) {
         btnRoteiro.style.display = 'block';
         btnRoteiro.innerText = 'Abrir Roteiro';
         btnRoteiro.onclick = () => { 
           closeClienteModal(); 
           abrirOrcamento(orc.id); 
           document.getElementById('orcRoteiroVinculado').value = orc.orcRoteiroVinculado; 
           navToPage('roteiros'); 
           
           setTimeout(() => {
             if (typeof preencherSelectRoteiros === 'function') preencherSelectRoteiros(orc.orcRoteiroVinculado);
             const selRoteiro = document.getElementById('selectRoteiroBase');
             if (selRoteiro) {
               selRoteiro.value = orc.orcRoteiroVinculado;
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
         btnRoteiro.innerText = 'Gerar Roteiro';
         btnRoteiro.onclick = async () => {
           closeClienteModal();
           abrirOrcamento(orc.id);
           
           const nomeRoteiro = 'Roteiro - ' + (orc.cliente?.nome || 'Novo');
           
        let diasList = []; // Dias vazios por padrao, usuario gera manualmente no Visualizador
           
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
             const res = await fetch(`/api/roteiros/${encodeURIComponent(nomeRoteiro)}`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(novoRoteiroObj)
             });
             if (res.ok) {
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
                   document.getElementById('btnEditarRoteiro').style.display = 'inline-block';
                   document.getElementById('btnExcluirRoteiro').style.display = 'inline-block';
                   document.getElementById('btnEditarRoteiro').click();
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
        
        let diasList = []; // Dias vazios por padrao, usuario gera manualmente no Visualizador
        
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
          const res = await fetch(`/api/roteiros/${encodeURIComponent(nomeRoteiro)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novoRoteiroObj)
          });
          if (res.ok) {
            if (typeof dbRotas !== 'undefined') dbRotas[nomeRoteiro] = novoRoteiroObj;
            document.getElementById('orcRoteiroVinculado').value = nomeRoteiro;
            state.orcamento.orcRoteiroVinculado = nomeRoteiro;
            if (typeof salvarOrcamentoAtual === 'function') salvarOrcamentoAtual();
            
            navToPage('roteiros');
            
            // Wait slightly for DOM to settle, then load the roteiro
            setTimeout(() => {
              if (typeof preencherSelectRoteiros === 'function') preencherSelectRoteiros(nomeRoteiro);
              const selRoteiro = document.getElementById('selectRoteiroBase');
              if (selRoteiro) {
                 selRoteiro.value = nomeRoteiro;
                 document.getElementById('btnEditarRoteiro').style.display = 'inline-block';
                 document.getElementById('btnExcluirRoteiro').style.display = 'inline-block';
                 document.getElementById('btnEditarRoteiro').click();
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
}
