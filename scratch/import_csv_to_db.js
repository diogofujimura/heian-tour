const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');
const ATRACOES_CSV = path.join(__dirname, 'novidades_atracoes.csv');
const ROTAS_CSV = path.join(__dirname, 'dias_todos_roteiros.csv');

function parseCSV(filePath, delimiter = ';') {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(delimiter).map(h => h.replace(/(^"|"$)/g, '').trim());
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // Regex para split de CSV respeitando aspas
    const regex = new RegExp(`(?:^|${delimiter})(?:"([^"]*)"|([^${delimiter}*]))`, 'g');
    let match;
    const values = [];
    while ((match = regex.exec(rawLine)) !== null) {
      if (match.index === regex.lastIndex) regex.lastIndex++; // Prevenir loop infinito em matchs vazios
      values.push(match[1] !== undefined ? match[1] : (match[2] || ''));
    }
    
    // Assegura que o tamanho de values bate com headers (ou o mais proximo)
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] ? values[index].trim() : '';
    });
    data.push(obj);
  }
  return data;
}

function run() {
  console.log('Iniciando importação para database.json...');
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));

  const atracoesRows = parseCSV(ATRACOES_CSV, ';');
  const rotasRows = parseCSV(ROTAS_CSV, ';');

  db.atracoes = atracoesRows;
  
  // Organizar rotas por "Roteiro"
  const rotasOrganizadas = {};
  rotasRows.forEach(row => {
    const roteiroNome = row['Roteiro'];
    if (!roteiroNome) return;
    if (!rotasOrganizadas[roteiroNome]) {
      rotasOrganizadas[roteiroNome] = [];
    }
    rotasOrganizadas[roteiroNome].push({
      cidade: row['Cidade'],
      nomeDaRota: row['Nome da Rota'],
      atracoesDoDia: row['Atrações do Dia'] ? row['Atrações do Dia'].split(',').map(s => s.trim()).filter(Boolean) : []
    });
  });

  db.rotas = rotasOrganizadas;

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
  console.log(`Importação concluída com sucesso!`);
  console.log(` - ${atracoesRows.length} atrações importadas.`);
  console.log(` - ${Object.keys(rotasOrganizadas).length} roteiros base mapeados.`);
}

run();
