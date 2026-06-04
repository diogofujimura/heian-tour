const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const wrongPart = `btnCotacao.innerText = 'Gerar Cotação';
      btnCotacao.onclick = () => { 
        closeClienteModal(); 
        novoOrcamento();
        state.orcamento.notionClienteId = currentEditingClienteId;
        const nome = document.getElementById('mcNome').value;
        document.getElementById('orcNome').value = nome;
        state.orcamento.estadias = JSON.parse(JSON.stringify(currentEditingEstadias));
        renderEstadiasReadOnlyForm();
        switchPage('orcamento'); 
      };
      
      btnRoteiro.innerText = 'Gerar Roteiro';
      btnRoteiro.onclick = () => {
        closeClienteModal(); 
        novoOrcamento();
        state.orcamento.notionClienteId = currentEditingClienteId;
        state.orcamento.estadias = JSON.parse(JSON.stringify(currentEditingEstadias));
        renderEstadiasReadOnlyForm();
        switchPage('orcamento');
        const btnGerar = document.getElementById('btnGerarRoteiroEstadias');
        if(btnGerar) { setTimeout(() => btnGerar.click(), 500); }
      };`;

const rightPart = `btnCotacao.innerText = 'Gerar Cotação';
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
        switchPage('orcamento'); 
      };
      
      btnRoteiro.innerText = 'Gerar Roteiro';
      btnRoteiro.onclick = () => {
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

if (app.includes(wrongPart)) {
  app = app.replace(wrongPart, rightPart);
  fs.writeFileSync('public/js/app.js', app);
  console.log('Fixed generation missing data');
} else {
  console.log('wrongPart not found');
}
