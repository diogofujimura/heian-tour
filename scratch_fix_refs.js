const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const bad1 = `const novoRoteiroObj = {
          cliente: {
            nome: document.getElementById('mcNome')?.value || orc?.cliente?.nome || nome || '',
            adultos: document.getElementById('mcAdultos')?.value || orc?.cliente?.adultos || '2',
            criancas: document.getElementById('mcCriancas')?.value || orc?.cliente?.criancas || '0',
            dataOrcamento: new Date().toISOString().split('T')[0],
            dataInicio: document.getElementById('mcDataInicio')?.value || orc?.cliente?.dataInicio || '',
            dataFim: document.getElementById('mcDataFim')?.value || orc?.cliente?.dataFim || '',
            vooChegada: document.getElementById('mcVooChegada')?.value || orc?.cliente?.vooChegada || '',
            vooPartida: document.getElementById('mcVooPartida')?.value || orc?.cliente?.vooPartida || '',
            estadias: typeof currentEditingEstadias !== 'undefined' ? JSON.parse(JSON.stringify(currentEditingEstadias)) : []
          },
          dias: diasList
        };`;

// Safe object without throwing ReferenceError for variables that might not exist in the block
const good1 = `const safeNome = document.getElementById('mcNome') ? document.getElementById('mcNome').value : '';
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
        };`;

app = app.replaceAll(bad1, good1);

fs.writeFileSync('public/js/app.js', app);
console.log('Fixed ReferenceErrors');
