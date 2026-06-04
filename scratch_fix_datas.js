const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const oldStr = `const novoRoteiroObj = {
          cliente: {
            nome: document.getElementById('mcNome')?.value || orc?.cliente?.nome || nome || '',
            adultos: document.getElementById('mcAdultos')?.value || orc?.cliente?.adultos || '2',
            criancas: document.getElementById('mcCriancas')?.value || orc?.cliente?.criancas || '0',
            dataOrcamento: new Date().toISOString().split('T')[0],
            vooChegada: document.getElementById('mcVooChegada')?.value || '',
            vooPartida: document.getElementById('mcVooPartida')?.value || '',
            estadias: typeof currentEditingEstadias !== 'undefined' ? JSON.parse(JSON.stringify(currentEditingEstadias)) : []
          },
          dias: diasList
        };`;

const newStr = `const novoRoteiroObj = {
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

app = app.replaceAll(oldStr, newStr);

fs.writeFileSync('public/js/app.js', app);
console.log('Added dataInicio and dataFim');
