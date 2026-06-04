const fs = require('fs');
const path = require('path');
const files = fs.readdirSync('scratch').filter(f => f.endsWith('.csv'));
files.forEach(f => {
    const text = fs.readFileSync(path.join('scratch', f), 'utf8');
    if (text.includes('ESTADIAS') || text.includes('EUA')) {
        console.log('Encontrado no arquivo:', f);
        text.split('\n').forEach((l, i) => {
            if(l.includes('ESTADIAS') || l.includes('EUA')) {
                console.log(`${i}: ${l}`);
            }
        });
    }
});
