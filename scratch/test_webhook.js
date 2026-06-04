const db = require('../database.json');
const url = db.config.sheets_script_url;

const oldItem = {
  "id": 1,
  "cidade": "Osaka",
  "nomeDaRota": "Castelo de Osaka + Bairro Shinsekai + Namba Yasaka Jinja",
  "atracoesDoDia": [
    "Experiência Kintsugi",
    "Katsuo-ji",
    "Castelo de Osaka",
    "Bairro Shinsekai"
  ]
};

const newItem = {
  ...oldItem,
  "id": 1
};

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'update',
    type: 'rotas',
    sheetName: 'Rotas',
    data: newItem,
    oldData: oldItem
  })
}).then(r => r.text())
  .then(console.log)
  .catch(console.error);
