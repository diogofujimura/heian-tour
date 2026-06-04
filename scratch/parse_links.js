const fs = require('fs');

const filePath = "C:\\Users\\User\\.gemini\\antigravity\\brain\\f78dd171-abe1-4a86-ac38-22ce2edd7278\\.system_generated\\steps\\537\\content.md";

if (fs.existsSync(filePath)) {
  const data = fs.readFileSync(filePath, 'utf8');
  
  // Vamos buscar por padrões de IDs de arquivos do Drive vinculados aos nomes
  // Geralmente, na resposta JSON do Drive, há blocos contendo [id, name, mimeType, ...]
  // Vamos tentar achar IDs (strings de ~33 a 44 caracteres alfanuméricos com traço/sublinhado) perto dos nomes de arquivos
  const fileRegex = /"([a-zA-Z0-9_-]{28,45})",\[[^\]]*"([^"]*\.(?:pdf|docx|doc|xls|xlsx))"/g;
  
  console.log("=== LINKS E IDS VINCULADOS ===");
  let match;
  let count = 0;
  while ((match = fileRegex.exec(data)) !== null) {
    const id = match[1];
    const name = match[2];
    console.log(`- Nome: ${name}`);
    console.log(`  ID: ${id}`);
    console.log(`  Link: https://drive.google.com/file/d/${id}/view?usp=sharing`);
    count++;
  }
  
  if (count === 0) {
    console.log("Tentando padrão de busca alternativo para links...");
    // Outra regex para achar links comuns do Drive ou docs
    const urlRegex = /https:\/\/(?:docs\.google\.com|drive\.google\.com)\/[^\s"']+/g;
    const urls = new Set();
    let urlMatch;
    while ((urlMatch = urlRegex.exec(data)) !== null) {
      urls.add(urlMatch[0]);
    }
    console.log(`Encontradas ${urls.size} URLs gerais.`);
    Array.from(urls).slice(0, 10).forEach(url => console.log(`- ${url}`));
  }
} else {
  console.log("Arquivo content.md não encontrado.");
}
