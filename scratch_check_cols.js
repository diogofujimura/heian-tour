const fs = require('fs');
const db = JSON.parse(fs.readFileSync('database.json', 'utf8'));
const id = db.config.sheets_id;
fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&sheet=Atracoes`)
.then(r=>r.text()).then(t=>{
  const jsonStr = t.substring(t.indexOf('{'), t.lastIndexOf('}') + 1);
  const json = JSON.parse(jsonStr);
  console.log('Atracoes cols:', json.table.cols.map(c => c.label));
})
.catch(console.error);
