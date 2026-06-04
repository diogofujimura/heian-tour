const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

code = code.replace(/window\._tempAtracoesSelecionadas = atracoes; \/\/ guardar para marcar/g, 'window._tempAtracoesSelecionadas = [...atracoes];');
code = code.replace(/onclick="salvarRotaModal\\(\\$\\{id \\? id : 'null'\\}\\)"/g, 'onclick="salvarRotaModal(\\'${id || \\'\\'}\\')"');

fs.writeFileSync('public/js/app.js', code);
console.log('Fixed variables');
