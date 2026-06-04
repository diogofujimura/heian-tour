const fs = require('fs');
const db = JSON.parse(fs.readFileSync('database.json', 'utf8'));
const id = db.config.sheets_id;
const sheets = ['Base', 'BaseEX', 'Atracoes', 'Rotas'];

async function run() {
  for (const s of sheets) {
    try {
      const r = await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&sheet=${s}`);
      const t = await r.text();
      const jsonStr = t.substring(t.indexOf('{'), t.lastIndexOf('}') + 1);
      const json = JSON.parse(jsonStr);
      console.log(`${s} cols:`, json.table.cols.map(c => c.label));
    } catch(e) {
      console.log(`Erro em ${s}`);
    }
  }
}
run();
