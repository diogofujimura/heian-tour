const fs = require('fs');
let s = fs.readFileSync('public/js/app.js', 'utf8');

function patchRenderFunc(funcName, inputId) {
    const search = `function ${funcName}(filtro='') {`;
    const replace = `function ${funcName}(filtro) {
  if (filtro === undefined) {
    const el = document.getElementById('${inputId}');
    filtro = el ? el.value : '';
  }`;
    if (s.includes(search)) {
        s = s.replace(search, replace);
        console.log(`Patched ${funcName}`);
    } else {
        console.log(`Failed to patch ${funcName} - pattern not found`);
    }
}

patchRenderFunc('renderTabelaTransportes', 'searchTransporte');
patchRenderFunc('renderTabelaExperiencias', 'searchExperiencia');
patchRenderFunc('renderTabelaAtracoes', 'searchAtracao');
patchRenderFunc('renderTabelaRotas', 'searchRota');

fs.writeFileSync('public/js/app.js', s);
console.log('Done patching app.js for search filters');
