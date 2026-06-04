const fs = require('fs');

let app = fs.readFileSync('public/js/app.js', 'utf8');

// The faulty string to replace
const wrongPart = `btnRoteiro.onclick = () => {
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
        switchPage('orcamento');
        const btnGerar = document.getElementById('btnGerarRoteiroEstadias');
        if(btnGerar) { 
          setTimeout(() => {
            btnGerar.click();
            setTimeout(() => switchPage('timeline'), 600); // go to timeline right after
          }, 500); 
        }
      };`;

const rightPart = `btnRoteiro.onclick = async () => {
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
        state.orcamento.estadias.forEach(est => {
          let noites = 1;
          if (est.dataInicio && est.dataFim) {
            const d1 = new Date(est.dataInicio);
            const d2 = new Date(est.dataFim);
            noites = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
            if (noites < 1 || isNaN(noites)) noites = 1;
          }
          for (let i = 0; i < noites; i++) {
            diasList.push({ cidade: est.cidade || '', nomeDaRota: '', atracoesDoDia: [] });
          }
        });
        
        const novoRoteiroObj = {
          cliente: {
            nome: nome,
            adultos: document.getElementById('mcAdultos').value || '2',
            criancas: '0',
            dataOrcamento: new Date().toISOString().split('T')[0]
          },
          dias: diasList
        };
        
        try {
          const res = await fetch(\`/api/roteiros/\${encodeURIComponent(nomeRoteiro)}\`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(novoRoteiroObj)
          });
          if (res.ok) {
            if (typeof dbRotas !== 'undefined') dbRotas[nomeRoteiro] = novoRoteiroObj;
            document.getElementById('orcRoteiroVinculado').value = nomeRoteiro;
            state.orcamento.orcRoteiroVinculado = nomeRoteiro;
            if (typeof salvarOrcamentoAtual === 'function') salvarOrcamentoAtual();
            
            switchPage('timeline');
            
            // Wait slightly for DOM to settle, then load the roteiro
            setTimeout(() => {
              if (typeof preencherSelectRoteiros === 'function') preencherSelectRoteiros(nomeRoteiro);
              const selRoteiro = document.getElementById('selectRoteiroExibir');
              if (selRoteiro) selRoteiro.value = nomeRoteiro;
              if (typeof carregarRoteiroSelecionado === 'function') carregarRoteiroSelecionado();
            }, 300);
            
          } else {
            alert('Erro ao criar roteiro autônomo.');
          }
        } catch(e) {
          console.error(e);
        }
      };`;

// Also fix btnGerarRoteiroEstadias inside the actual function (line ~1373)
const oldCalc = `    let diasList = [];
    state.orcamento.estadias.forEach(est => {
      const noites = parseInt(est.noites) || 1;
      for (let i = 0; i < noites; i++) {
        diasList.push({
          cidade: est.cidade || '',
          nomeDaRota: '',
          atracoesDoDia: []
        });
      }
    });`;

const newCalc = `    let diasList = [];
    state.orcamento.estadias.forEach(est => {
      let noites = 1;
      if (est.dataInicio && est.dataFim) {
        const d1 = new Date(est.dataInicio);
        const d2 = new Date(est.dataFim);
        noites = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        if (noites < 1 || isNaN(noites)) noites = 1;
      }
      for (let i = 0; i < noites; i++) {
        diasList.push({
          cidade: est.cidade || '',
          nomeDaRota: '',
          atracoesDoDia: []
        });
      }
    });`;

if (app.includes(wrongPart)) {
  app = app.replace(wrongPart, rightPart);
  if(app.includes(oldCalc)) {
    app = app.replace(oldCalc, newCalc);
  }
  fs.writeFileSync('public/js/app.js', app);
  console.log('Fixed autonomous roteiro generation');
} else {
  console.log('wrongPart not found');
}
