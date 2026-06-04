const fs = require('fs');

let app = fs.readFileSync('public/js/app.js', 'utf8');

const wrongPart = `const hoteisStr = currentEditingEstadias.map(e => {
      let txt = e.cidade;
      if (e.hotel) txt += \` - \${e.hotel}\`;
      return txt;
    }).join('\\n');
    if (hoteisStr) payload.hotel = hoteisStr;

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const cliId = currentEditingClienteId || (await res.clone().json()).id;
    await fetch('/api/clientes/local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cliId, estadias: currentEditingEstadias })
    });`;

const rightPart = `const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });`;

app = app.replace(wrongPart, rightPart);

// Now apply it to salvarClienteNotion
const searchSalvarCliente = `
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if(!res.ok) throw new Error('Falha ao comunicar com Notion API');`;

const replaceSalvarCliente = `
    const hoteisStr = currentEditingEstadias.map(e => {
      let txt = e.cidade;
      if (e.hotel) txt += \` - \${e.hotel}\`;
      return txt;
    }).join('\\n');
    if (hoteisStr) payload.hotel = hoteisStr;

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const cliId = currentEditingClienteId || (await res.clone().json()).id;
    await fetch('/api/clientes/local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cliId, estadias: currentEditingEstadias })
    });

    if(!res.ok) throw new Error('Falha ao comunicar com Notion API');`;

if (app.includes('if(!res.ok) throw new Error(\'Falha ao comunicar com Notion API\');')) {
    app = app.replace(searchSalvarCliente, replaceSalvarCliente);
}

fs.writeFileSync('public/js/app.js', app);
console.log('Fixed salvarClienteNotion');
