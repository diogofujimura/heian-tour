const fs = require('fs');
let content = fs.readFileSync('public/js/roteiros.js', 'utf-8');

const regexTransp = /if \(origem \|\| destino\) \{\s*if \(matchOrigem && matchDestino\) \{([\s\S]*?count\+\+;\s*)\}\s*\}/;
const replaceTransp = `if (matchOrigem && matchDestino) {$1}`;

if (content.match(regexTransp)) {
  content = content.replace(regexTransp, replaceTransp);
}

const regexEmpty = /if \(count === 0 && \(origem \|\| destino\)\) \{([\s\S]*?)\}\s*else if \(count === 0\) \{[\s\S]*?\}/;
const replaceEmpty = `if (count === 0) {$1}`;

if (content.match(regexEmpty)) {
  content = content.replace(regexEmpty, replaceEmpty);
}

fs.writeFileSync('public/js/roteiros.js', content, 'utf-8');
console.log('Patched roteiros.js: transportes filter removed restriction');
