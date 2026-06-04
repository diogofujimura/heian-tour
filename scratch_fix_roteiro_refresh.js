const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const search = `    } else if (document.getElementById('page-roteiros').classList.contains('active')) {
       const selRoteiro = document.getElementById('selectRoteiroBase');
       if (selRoteiro && selRoteiro.value) {
           if (typeof abrirEditorRoteiro === 'function') abrirEditorRoteiro(selRoteiro.value);
       }
    }`;

const replace = `    } else if (document.getElementById('page-roteiros').classList.contains('active')) {
       // Atualiza apenos os inputs visuais para não resetar o roteiro inteiro
       const c = notionClients.find(x => x.id === currentEditingClienteId);
       if (c) {
           if(document.getElementById('rotClienteNome')) document.getElementById('rotClienteNome').value = c.nome || '';
           if(document.getElementById('rotClienteAdultos')) document.getElementById('rotClienteAdultos').value = c.adultos || 2;
           if(document.getElementById('rotClienteCriancas')) document.getElementById('rotClienteCriancas').value = c.criancas || 0;
           if(document.getElementById('rotClienteData')) document.getElementById('rotClienteData').value = c.dataInicio || '';
           if(document.getElementById('rotClienteDataFim')) document.getElementById('rotClienteDataFim').value = c.dataFim || '';
       }
    }`;

if(app.includes(search)) {
  app = app.replace(search, replace);
  fs.writeFileSync('public/js/app.js', app);
  console.log('salvarClienteNotion safe refresh for roteiros patched');
} else {
  console.log('salvarClienteNotion pattern not found');
}
