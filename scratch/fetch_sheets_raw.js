// Usando fetch nativo

const sheets_id = "1E1zOsZ3-dKIkXepx61a0ejWNempftS12-3i7LwwsWWo";

async function fetchAba(nomeAba) {
  const url = `https://docs.google.com/spreadsheets/d/${sheets_id}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(nomeAba)}`;
  const resp = await fetch(url);
  const text = await resp.text();
  const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
  const json = JSON.parse(jsonStr);
  return json.table;
}

function cellVal(cell) {
  if (!cell) return '';
  if (cell.f != null) return String(cell.f).trim();
  if (cell.v != null) return String(cell.v).trim();
  return '';
}

async function debug() {
  console.log('=== LENDO TRANSPORTES BRUTO ===');
  try {
    const tableT = await fetchAba('Transportes');
    console.log('Total de linhas em Transportes:', tableT.rows.length);
    console.log('Primeiras 5 linhas:');
    tableT.rows.slice(0, 5).forEach((row, i) => {
      console.log(`Linha ${i}:`, (row.c || []).map(cellVal));
    });
  } catch (e) {
    console.error('Erro em Transportes:', e.message);
  }

  console.log('\n=== LENDO EXPERIÊNCIAS BRUTO (com acento) ===');
  try {
    const tableE = await fetchAba('Experiências');
    console.log('Total de linhas em Experiências (com acento):', tableE.rows.length);
    console.log('Primeira linha:', tableE.rows[0] ? (tableE.rows[0].c || []).map(cellVal) : 'Vazia');
  } catch (e) {
    console.error('Erro em Experiências:', e.message);
  }

  console.log('\n=== LENDO BASEEX BRUTO (Experiências reais) ===');
  try {
    const tableESem = await fetchAba('BaseEX');
    console.log('Total de linhas em BaseEX:', tableESem.rows.length);
    console.log('Primeiras 3 linhas:');
    tableESem.rows.slice(0, 3).forEach((row, i) => {
      console.log(`Linha ${i}:`, (row.c || []).map(cellVal));
    });
  } catch (e) {
    console.error('Erro em BaseEX:', e.message);
  }
}

debug();
