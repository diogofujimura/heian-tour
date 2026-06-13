const targetClientId = '2f1b6e48-f954-80a0-948d-f8a4b3b0feae';

async function test() {
  try {
    const res = await fetch(`http://localhost:3000/api/dashboard/notion-data/${targetClientId}`);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Erro na requisição:', err);
  }
}

test();
