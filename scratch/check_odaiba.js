const fs = require('fs');
const db = JSON.parse(fs.readFileSync('database.json'));
async function go() {
  const url = `https://docs.google.com/spreadsheets/d/${db.config.sheets_id}/gviz/tq?tqx=out:json&sheet=Atracoes`;
  const resp = await fetch(url);
  const text = await resp.text();
  const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const json = JSON.parse(jsonStr);
  const rows = json.table.rows;
  for(let i=0; i<rows.length; i++) {
    if(rows[i] && rows[i].c && rows[i].c[2] && String(rows[i].c[2].v).includes('Odaiba')) {
      console.log('Row ' + i + ' Name: ' + rows[i].c[2].v + ' ID: ' + (rows[i].c[6] ? rows[i].c[6].v : 'none'));
    }
  }
}
go();
