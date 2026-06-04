const fs = require('fs');

// Read the previously created scripts which contain the pure function strings
const jsRotCot = fs.readFileSync('rewrite_rot_cot.js', 'utf8');
const start1 = jsRotCot.indexOf('const newCode = `');
const end1 = jsRotCot.indexOf('};\n\n`;');
const roteiroParaCotacaoCode = jsRotCot.substring(start1 + 17, end1 + 2);

const jsCotRot = fs.readFileSync('rewrite.js', 'utf8');
const start2 = jsCotRot.indexOf('const newCode = `');
const end2 = jsCotRot.indexOf('};\n\n`;');
let cotacaoParaRoteiroCode = jsCotRot.substring(start2 + 17, end2 + 2);

// Fix unicode encoding corruption that occurred when writing rewrite.js originally
cotacaoParaRoteiroCode = cotacaoParaRoteiroCode.replace(/z"/g, '➔');
cotacaoParaRoteiroCode = cotacaoParaRoteiroCode.replace(/ExperiǦncia/g, 'Experiência');
cotacaoParaRoteiroCode = cotacaoParaRoteiroCode.replace(/Cotaǜo/g, 'Cotação');

const newFileContent = roteiroParaCotacaoCode + '\n\n' + cotacaoParaRoteiroCode;
fs.writeFileSync('public/js/sync_roteiro_cotacao.js', newFileContent, 'utf8');
console.log('Successfully regenerated sync_roteiro_cotacao.js!');
