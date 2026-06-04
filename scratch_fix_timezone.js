const fs = require('fs');
let roteiros = fs.readFileSync('public/js/roteiros.js', 'utf8');

const search = `    const dInicio = new Date(dataInicioStr + "T00:00:00");
    const dFim = new Date(dataFimStr + "T00:00:00");`;

const replace = `    const pInicio = dataInicioStr.split('-');
    const pFim = dataFimStr.split('-');
    const dInicio = new Date(Date.UTC(parseInt(pInicio[0]), parseInt(pInicio[1])-1, parseInt(pInicio[2])));
    const dFim = new Date(Date.UTC(parseInt(pFim[0]), parseInt(pFim[1])-1, parseInt(pFim[2])));`;

if(roteiros.includes(search)) {
  roteiros = roteiros.replace(search, replace);
  fs.writeFileSync('public/js/roteiros.js', roteiros);
  console.log('gerarDiasAuto timezone fixed');
} else {
  console.log('gerarDiasAuto timezone pattern not found');
}
