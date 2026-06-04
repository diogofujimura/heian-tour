const fs = require('fs');

let app = fs.readFileSync('public/js/app.js', 'utf8');

// The faulty string is:
const faultyLogic = `      btnCotacao.onclick = () => { 
        closeClienteModal(); 
        novoOrcamento();
        state.orcamento.notionClienteId = currentEditingClienteId;
        const nome = document.getElementById('mcNome').value;
        document.getElementById('orcNome').value = nome;
        state.orcamento.estadias = JSON.parse(JSON.stringify(currentEditingEstadias));
        renderEstadiasReadOnlyForm();
        switchPage('orcamento'); 
      };
      
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

const fixedLogic = `      btnCotacao.onclick = () => { 
        closeClienteModal(); 
        novoOrcamento();
        state.orcamento.notionClienteId = currentEditingClienteId;
        
        const nome = document.getElementById('mcNome').value;
        document.getElementById('orcNome').value = nome;
        document.getElementById('clienteNome').value = nome;
        document.getElementById('clienteAdultos').value = document.getElementById('mcAdultos').value;
        document.getElementById('clienteCriancas').value = document.getElementById('mcCriancas').value;
        
        state.orcamento.estadias = JSON.parse(JSON.stringify(currentEditingEstadias));
        renderEstadiasReadOnlyForm();
        switchPage('orcamento'); 
      };
      
      btnRoteiro.onclick = () => {
        closeClienteModal(); 
        novoOrcamento();
        state.orcamento.notionClienteId = currentEditingClienteId;
        
        const nome = document.getElementById('mcNome').value;
        document.getElementById('orcNome').value = nome;
        document.getElementById('clienteNome').value = nome;
        document.getElementById('clienteAdultos').value = document.getElementById('mcAdultos').value;
        document.getElementById('clienteCriancas').value = document.getElementById('mcCriancas').value;

        state.orcamento.estadias = JSON.parse(JSON.stringify(currentEditingEstadias));
        renderEstadiasReadOnlyForm();
        switchPage('orcamento');
        const btnGerar = document.getElementById('btnGerarRoteiroEstadias');
        if(btnGerar) { setTimeout(() => btnGerar.click(), 500); }
      };`;

if (app.includes(faultyLogic)) {
  app = app.replace(faultyLogic, fixedLogic);
  fs.writeFileSync('public/js/app.js', app);
  console.log('Fixed hub generation logic');
} else {
  console.log('Faulty logic not found. Maybe indentation is off.');
}
