const fs = require('fs');

async function run() {
  const db = JSON.parse(fs.readFileSync('database.json', 'utf8'));
  const url = db.config.sheets_script_url;
  
  if (!url) {
    console.log('Sem URL do Apps Script.');
    return;
  }
  
  // Agrupar itens com seus tipos
  const itemsToSync = [];
  
  const mapData = (type, list, sheetName) => {
    if (Array.isArray(list)) {
      list.forEach(item => {
        itemsToSync.push({ type, sheetName, data: item, oldData: item });
      });
    } else if (typeof list === 'object') {
      Object.values(list).forEach(item => {
        itemsToSync.push({ type, sheetName, data: item, oldData: item });
      });
    }
  };
  
  mapData('transportes', db.transportes, db.config.sheets_aba_transportes || 'Base');
  mapData('experiencias', db.experiencias, db.config.sheets_aba_experiencias || 'BaseEX');
  mapData('atracoes', db.atracoes, db.config.sheets_aba_atracoes || 'Atracoes');
  mapData('rotas', db.rotas, db.config.sheets_aba_rotas || 'Rotas');
  
  console.log(`Iniciando sincronização de ${itemsToSync.length} itens... Isso deve levar cerca de ${(itemsToSync.length * 0.5 / 60).toFixed(1)} minutos.`);
  
  let count = 0;
  for (const item of itemsToSync) {
    try {
      const payload = {
        action: 'update',
        type: item.type,
        sheetName: item.sheetName,
        data: item.data,
        oldData: item.oldData
      };
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const resJson = await res.json();
      count++;
      console.log(`[${count}/${itemsToSync.length}] ${item.type} sincronizado: ${resJson.message}`);
      
    } catch(err) {
      console.log(`Erro ao sincronizar item: ${err.message}`);
    }
    
    // Espera 500ms entre as requisições para não estourar o limite do Google
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('Sincronização em massa concluída!');
}

run();
