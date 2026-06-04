const fs = require('fs');
let content = fs.readFileSync('public/js/roteiros.js', 'utf-8');

const regex = /window\.construirBlocosRoteiro\s*=\s*function\(\)\s*\{[\s\S]*?\};\s*;/;

const replacement = `window.construirBlocosRoteiro = function() {
    window.blocosRoteiro = {};
    if (typeof state !== 'undefined' && state.rotasDB) {
        state.rotasDB.forEach(b => {
            if (b.nomeDaRota && b.atracoesDoDia && b.atracoesDoDia.length > 0) {
                const c = b.cidade || 'Diversos';
                if (!window.blocosRoteiro[c]) window.blocosRoteiro[c] = {};
                window.blocosRoteiro[c][b.nomeDaRota] = b.atracoesDoDia;
            }
        });
    }
};;`;

content = content.replace(regex, replacement);
fs.writeFileSync('public/js/roteiros.js', content, 'utf-8');
console.log('Patched roteiros.js to use state.rotasDB');
