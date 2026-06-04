const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const oldLogic = `      if (orc.orcRoteiroVinculado) {
         btnRoteiro.innerText = 'Abrir Roteiro';
         btnRoteiro.onclick = () => { closeClienteModal(); loadOrcamento(orc); document.getElementById('orcRoteiroVinculado').value = orc.orcRoteiroVinculado; navToPage('timeline'); };
      } else {
         btnRoteiro.innerText = 'Gerar Roteiro';
         btnRoteiro.onclick = () => {
           closeClienteModal();
           loadOrcamento(orc);
           navToPage('orcamento');
           const btnGerar = document.getElementById('btnGerarRoteiroEstadias');
           if(btnGerar) { setTimeout(() => btnGerar.click(), 500); }
         };
      }`;

const newLogic = `      if (orc.orcRoteiroVinculado) {
         btnRoteiro.innerText = 'Abrir Roteiro';
         btnRoteiro.onclick = () => { closeClienteModal(); loadOrcamento(orc); document.getElementById('orcRoteiroVinculado').value = orc.orcRoteiroVinculado; navToPage('timeline'); };
      } else {
         btnRoteiro.innerText = 'Gerar Roteiro';
         btnRoteiro.onclick = async () => {
           closeClienteModal();
           loadOrcamento(orc);
           
           const nomeRoteiro = 'Roteiro - ' + (orc.cliente?.nome || 'Novo');
           
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
               nome: orc.cliente?.nome || '',
               adultos: orc.cliente?.adultos || '2',
               criancas: orc.cliente?.criancas || '0',
               dataOrcamento: orc.cliente?.dataOrcamento || new Date().toISOString().split('T')[0]
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
               
               navToPage('timeline');
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
         };
      }`;

if (app.includes(oldLogic)) {
  app = app.replace(oldLogic, newLogic);
  fs.writeFileSync('public/js/app.js', app);
  console.log('Fixed existing orc logic');
} else {
  console.log('oldLogic not found');
}
