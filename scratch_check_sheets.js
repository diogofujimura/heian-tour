const fs = require('fs');
const db = JSON.parse(fs.readFileSync('database.json', 'utf8'));
const id = db.config.sheets_id;
fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&sheet=Atracoes`)
  .then(r => r.text())
  .then(t => {
    const jsonStr = t.substring(t.indexOf('{'), t.lastIndexOf('}') + 1);
    const json = JSON.parse(jsonStr);
    console.log('Atracoes count in Sheets:', json.table.rows.length);
    const ashi = json.table.rows.find(r => r.c && r.c[2] && r.c[2].v && r.c[2].v.includes('Lago Ashi'));
    console.log('Is Lago Ashi there?', !!ashi);
  })
  .catch(console.error);
