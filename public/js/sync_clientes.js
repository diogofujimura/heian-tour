async function syncClienteAtivo(notionClienteId) {
  if (!notionClienteId) return;

  try {
    // 1. Fetch latest client from Notion array (should be refreshed if called after save)
    let c = typeof notionClients !== 'undefined' ? notionClients.find(x => x.id === notionClienteId) : null;
    if (!c) {
      // Refresh notionClients if not found
      const resNotion = await fetch('/api/notion/clientes');
      if (resNotion.ok) {
        notionClients = await resNotion.json(); window.notionClients = notionClients;
        c = notionClients.find(x => x.id === notionClienteId);
      }
    }
    if (!c) return; // Client doesn't exist

    // 2. Fetch local estadias
    const resLocal = await fetch(`/api/clientes/local/${notionClienteId}`);
    let localData = { estadias: [] };
    if (resLocal.ok) {
        localData = await resLocal.json();
    }

    // 3. Prepare fresh client data
    const updatedCliente = {
        notionClienteId: c.id,
        nome: c.nome || '',
        adultos: c.adultos || 2,
        criancas: c.criancas || 0,
        dataInicio: c.dataInicio || '',
        dataFim: c.dataFim || '',
        vooChegada: c.vooChegada || '',
        vooPartida: c.vooPartida || '',
        dataOrcamento: c.dataOrcamento || window.today ? window.today() : ''
    };
    let updatedEstadias = localData.estadias || [];
    if (updatedEstadias.length === 0 && c.hotel) {
      c.hotel.split('\n').filter(l => l.trim()).forEach(line => {
        let cidade = ''; let hotel = line.trim(); let dataInicio = ''; let dataFim = '';
        const dateMatch = line.match(/\b\d{2}\/\d{2}\b/);
        if (dateMatch) {
          const strDates = line.substring(dateMatch.index);
          const dParts = strDates.split(' a ').map(s => s.trim());
          const year = new Date().getFullYear();
          if (dParts[0]) { const p = dParts[0].split('/'); dataInicio = year + '-' + p[1] + '-' + p[0]; }
          if (dParts[1]) { const p = dParts[1].split('/'); dataFim = year + '-' + p[1] + '-' + p[0]; }
          hotel = line.substring(0, dateMatch.index).trim();
        }
        const dashIndex = hotel.indexOf(' - ');
        if (dashIndex > -1) { cidade = hotel.substring(0, dashIndex).trim(); hotel = hotel.substring(dashIndex + 3).trim(); }
        updatedEstadias.push({ id: Date.now() + Math.random(), cidade, dataInicio, dataFim, hotel });
      });
    }

    // 4. Injetar no ROTEIRO ATIVO
    if (document.getElementById('page-roteiros') && document.getElementById('page-roteiros').classList.contains('active')) {
        if (typeof roteiroEmEdicao !== 'undefined' && roteiroEmEdicao) {
            if (!roteiroEmEdicao.cliente) roteiroEmEdicao.cliente = {};
            Object.assign(roteiroEmEdicao.cliente, updatedCliente);
            roteiroEmEdicao.cliente.estadias = JSON.parse(JSON.stringify(updatedEstadias));
            
            // Update UI
            if(document.getElementById('rotClienteNome')) document.getElementById('rotClienteNome').value = updatedCliente.nome;
            if(document.getElementById('rotClienteAdultos')) document.getElementById('rotClienteAdultos').value = updatedCliente.adultos;
            if(document.getElementById('rotClienteCriancas')) document.getElementById('rotClienteCriancas').value = updatedCliente.criancas;
            if(document.getElementById('rotClienteData')) document.getElementById('rotClienteData').value = updatedCliente.dataInicio;
            if(document.getElementById('rotClienteDataFim')) document.getElementById('rotClienteDataFim').value = updatedCliente.dataFim;
            if(document.getElementById('rotClienteVooChegada')) document.getElementById('rotClienteVooChegada').value = updatedCliente.vooChegada;
            if(document.getElementById('rotClienteVooPartida')) document.getElementById('rotClienteVooPartida').value = updatedCliente.vooPartida;
            
            if (typeof renderRotEstadias === 'function') renderRotEstadias();
            if (typeof updateRoteiroHeader === 'function') updateRoteiroHeader();
        }
    }

    // 5. Injetar na COTAÇÃO ATIVA
    if (document.getElementById('page-orcamento') && document.getElementById('page-orcamento').classList.contains('active')) {
        if (typeof state !== 'undefined' && state.orcamento) {
            if (!state.orcamento.cliente) state.orcamento.cliente = {};
            Object.assign(state.orcamento.cliente, updatedCliente);
            state.orcamento.estadias = JSON.parse(JSON.stringify(updatedEstadias));

            // Update UI
            if(document.getElementById('clienteNome')) document.getElementById('clienteNome').value = updatedCliente.nome;
            if(document.getElementById('clienteAdultos')) document.getElementById('clienteAdultos').value = updatedCliente.adultos;
            if(document.getElementById('clienteCriancas')) document.getElementById('clienteCriancas').value = updatedCliente.criancas;
            if(document.getElementById('clienteDataOrcamento') && updatedCliente.dataOrcamento) {
                document.getElementById('clienteDataOrcamento').value = updatedCliente.dataOrcamento;
            }
            if(document.getElementById('orcNome') && document.getElementById('orcNome').value.trim() === '') {
                document.getElementById('orcNome').value = 'Cotação - ' + updatedCliente.nome;
            }

            if (typeof renderEstadiasReadOnlyForm === 'function') renderEstadiasReadOnlyForm();
            if (typeof updateResumo === 'function') updateResumo();
        }
    }

    // Always log or notify silently
    console.log('Cliente sincronizado via syncClienteAtivo:', updatedCliente.nome);
    
  } catch (err) {
    console.error('Erro ao sincronizar cliente ativamente', err);
  }
}
