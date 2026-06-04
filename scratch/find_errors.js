const fs = require('fs');
const lines = fs.readFileSync('scratch/novidades_atracoes.csv', 'utf8').split('\n');
lines.forEach((l, i) => {
    if (l.includes('ESTADIAS') || l.includes('Okinawa') || l.includes('Japão:') || l.includes('Shibuya Sky')) {
        console.log(`${i}: ${l}`);
    }
});
