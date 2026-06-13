// Usando fetch nativo
const sheets_id = "1E1zOsZ3-dKIkXepx61a0ejWNempftS12-3i7LwwsWWo";

async function run() {
  const url = `https://docs.google.com/spreadsheets/d/${sheets_id}/htmlview`;
  const res = await fetch(url);
  const html = await res.text();

  // Vamos procurar por todas as tags <a> ou <script> ou <li> que possam conter as abas
  // No htmlview do Google Sheets, a barra inferior de abas é composta de elementos da classe "goog-inline-block goog-tab"
  // ou simplesmente links
  const regexTab = /<div class="goog-tab-label">([^<]+)<\/div>/g;
  let match;
  const abas = [];
  while ((match = regexTab.exec(html)) !== null) {
    abas.push(match[1]);
  }

  // Tentar outro padrão
  const regexTab2 = /<li[^>]*class="[^"]*goog-tab[^"]*"[^>]*>([^<]+)<\/li>/g;
  while ((match = regexTab2.exec(html)) !== null) {
    abas.push(match[1]);
  }

  // Se não encontrar nada, vamos dar um regex genérico nas tags com "goog-tab"
  const genericRegex = /class="[^"]*goog-tab[^"]*"[^>]*>([^<]+)/g;
  while ((match = genericRegex.exec(html)) !== null) {
    const txt = match[1].trim();
    if (!abas.includes(txt)) abas.push(txt);
  }

  console.log('Abas encontradas:', abas);

  // Vamos pesquisar se existem termos como "Transporte" ou "Trem" no HTML
  const termos = ["Transporte", "Transportes", "Trem", "Trem ", "Hospedagem", "Passagem", "Tours", "Ingressos", "Experiencias", "Experiências", "Base", "BaseEX"];
  termos.forEach(t => {
    console.log(`Contém "${t}"?`, html.toLowerCase().includes(t.toLowerCase()));
  });
}

run().catch(console.error);
