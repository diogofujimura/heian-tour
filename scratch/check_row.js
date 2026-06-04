const fs = require('fs');
const db = JSON.parse(fs.readFileSync('database.json'));
async function go() {
  const url = `https://docs.google.com/spreadsheets/d/${db.config.sheets_id}/gviz/tq?tqx=out:json&sheet=Atracoes`;
  const resp = await fetch(url);
  const text = await resp.text();
  const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const json = JSON.parse(jsonStr);
  const rows = json.table.rows;
  console.log(JSON.stringify(rows[115], null, 2));
}
go();
