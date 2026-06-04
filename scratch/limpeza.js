function limparAtracao(nomeRaw) {
  let nome = nomeRaw;
  
  // 1. Remove marcador inicial
  nome = nome.replace(/^[v\*\s\-\>•§🡪à➔—●▪▪◦●#]+/, '').trim();

  // 2. Remove descrição após separador especial (-, –, —, ➔, →, à)
  nome = nome.replace(/\s*[–—➔→]\s*.*/s, '');
  nome = nome.replace(/\s+-\s+.*/s, '');
  nome = nome.replace(/\s*à\s*.*/s, '');

  // 3. Remove preços em ienes ou reais
  nome = nome.replace(/\s*\([^)]*ienes[^)]*\)/gi, '');
  nome = nome.replace(/\s*\([^)]*reais[^)]*\)/gi, '');
  nome = nome.trim();

  // 4. Normaliza espaços e tabulações
  nome = nome.replace(/[\s\t\u00A0\u2000-\u200B\u202F\u205F\u3000\ufeff]+/g, ' ');

  // 5. Remove parênteses de descrição no final (fechados ou incompletos no fim da linha)
  nome = nome.replace(/\s*\([^)]*(?:\)|$)/g, '').trim();

  // 6. Limpa pontuações e espaços residuais no final
  nome = nome.replace(/[\.\*\,;\s]+$/, '').trim();

  return nome;
}

module.exports = { limparAtracao };
