const fs = require('fs');
let js = fs.readFileSync('public/js/roteiros.js', 'utf8');

const globalFunc = `
window.formatPeriodo = function(d1, d2) {
    if (!d1 && !d2) return '';
    const f1 = d1 ? d1.split('-').reverse().slice(0, 2).join('/') : '';
    const f2 = d2 ? d2.split('-').reverse().slice(0, 2).join('/') : '';
    if (f1 && f2) return f1 + ' a ' + f2;
    return f1 || f2;
};
`;

if (!js.includes('window.formatPeriodo = function')) {
    js = globalFunc + '\n' + js;
}

// Replace formatPeriodo with window.formatPeriodo
js = js.replace(/formatPeriodo\(/g, 'window.formatPeriodo(');

// Clean up any remaining const window.formatPeriodo = ... which would cause syntax errors
js = js.replace(/const window\.formatPeriodo[\s\S]*?};/g, '');

fs.writeFileSync('public/js/roteiros.js', js, 'utf8');
console.log('Fixed formatPeriodo reference error.');
