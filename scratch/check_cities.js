const fs = require('fs');
const path = require('path');

const csvPath = path.join(__dirname, 'novidades_atracoes.csv');
const data = fs.readFileSync(csvPath, 'utf8');
const lines = data.split('\n').slice(1);

const cityCount = {};
lines.forEach(line => {
  if (!line.trim()) return;
  const parts = line.match(/(".*?"|[^;]+)/g) || [];
  if (parts.length > 0) {
    const city = parts[0].replace(/"/g, '').trim();
    cityCount[city] = (cityCount[city] || 0) + 1;
  }
});

console.log("=== RESUMO DE ATRAÇÕES POR CIDADE NO CSV CONSOLIDADO ===");
console.log(cityCount);
