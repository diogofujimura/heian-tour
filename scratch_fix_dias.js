const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const badLogic1 = `           let diasList = [];
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
           });`;

const badLogic2 = `        let diasList = [];
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
        });`;

const goodLogic = `        let diasList = []; // Dias vazios por padrao, usuario gera manualmente no Visualizador`;

app = app.replace(badLogic1, goodLogic);
app = app.replace(badLogic2, goodLogic);

fs.writeFileSync('public/js/app.js', app);
console.log('Removed auto generation of days');
