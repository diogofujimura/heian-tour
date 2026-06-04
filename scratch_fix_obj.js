const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

// The replacement payload
const fixedObj = `const novoRoteiroObj = {
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

// Let's replace the first autonomous one (for existing orc)
const bad1 = `           const novoRoteiroObj = {
             cliente: {
               nome: orc.cliente?.nome || '',
               adultos: orc.cliente?.adultos || '2',
               criancas: orc.cliente?.criancas || '0',
               dataOrcamento: orc.cliente?.dataOrcamento || new Date().toISOString().split('T')[0]
             },
             dias: diasList
           };`;

app = app.replace(bad1, fixedObj);

// Let's replace the second autonomous one (for empty client)
const bad2 = `        const novoRoteiroObj = {
          cliente: {
            nome: nome,
            adultos: document.getElementById('mcAdultos').value || '2',
            criancas: '0',
            dataOrcamento: new Date().toISOString().split('T')[0]
          },
          dias: diasList
        };`;

app = app.replace(bad2, fixedObj);

fs.writeFileSync('public/js/app.js', app);
console.log('Fixed novoRoteiroObj');
