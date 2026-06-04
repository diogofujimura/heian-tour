const db = require('./database.json');
const sheets_id = db.config.sheets_id;

async function fetchAba(nomeAba) {
  const url = `https://docs.google.com/spreadsheets/d/${sheets_id}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(nomeAba)}`;
  const resp = await fetch(url);
  const text = await resp.text();
  const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const json = JSON.parse(jsonStr);
  return json.table;
}

fetchAba('Rotas').then(table => {
  console.log("Rows count:", table.rows ? table.rows.length : 0);
  console.log("First row data:", JSON.stringify(table.rows[1], null, 2));
}).catch(console.error);
