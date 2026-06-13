// Fetch nativo global do Node é usado diretamente

function verificarSimilaridade(original, wikiTitle) {
  const normalize = str => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "");
  
  const originalNorm = normalize(original);
  const wikiNorm = normalize(wikiTitle);

  // Palavras para ignorar (conectivos e termos genéricos comuns)
  const ignorar = new Set(['de', 'do', 'da', 'no', 'na', 'em', 'para', 'com', 'e', 'o', 'a', 'os', 'as', 'of', 'the', 'and', 'in', 'at', 'on', 'to', 'for', 'with', 'vista', 'regiao', 'estatua', 'templo', 'santuario', 'ponte', 'castle', 'temple', 'shrine', 'bridge', 'museum', 'art', 'station', 'rua', 'street', 'road']);

  const palavrasOriginal = originalNorm.split(' ').filter(w => w.length > 2 && !ignorar.has(w));
  const palavrasWiki = wikiNorm.split(' ').filter(w => w.length > 2 && !ignorar.has(w));

  if (palavrasOriginal.length === 0) return true; // Se for muito curto, deixa passar para o match básico

  // Verifica se há pelo menos uma palavra chave relevante em comum
  const temComum = palavrasOriginal.some(w => {
    return palavrasWiki.some(ww => {
      return ww === w || ww.includes(w) || w.includes(ww);
    });
  });

  return temComum;
}

async function main() {
  const dryRun = process.argv.includes('--run') ? false : true;
  console.log(`=== MIGRATION DE FOTOS DAS ATRAÇÕES (Wikipedia/Wikimedia API) ===`);
  console.log(`Modo: ${dryRun ? 'DRY RUN (Apenas simulação - não altera o banco)' : 'EXECUÇÃO REAL (Vai salvar no banco!)'}`);
  console.log(`Se quiser salvar de verdade, execute com a flag --run\n`);

  try {
    const res = await fetch('http://localhost:3000/api/atracoes');
    if (!res.ok) throw new Error('Não foi possível conectar à API local de atrações. O servidor está rodando?');
    const atracoes = await res.json();
    
    console.log(`Total de atrações no banco: ${atracoes.length}`);
    const semFoto = atracoes.filter(a => !a['Foto (URL)'] || a['Foto (URL)'].includes('google.com/imgres'));
    console.log(`Atrações sem foto personalizada válida: ${semFoto.length}\n`);

    let sucesso = 0;
    let falha = 0;

    for (const atracao of semFoto) {
      const nome = atracao['Nome da Atração'];
      const id = atracao.id;
      
      // Limpar termos adicionais ou parênteses que possam atrapalhar a busca na Wikipedia
      const queryName = nome.replace(/\([^)]*\)/g, '').trim();

      try {
        // Buscar na Wikipedia adicionando 'Japan' para garantir relevância geográfica e evitar falsos positivos
        const queryTerm = `${queryName} Japan`;
        const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(queryTerm)}&gsrlimit=1&prop=pageimages&format=json&pithumbsize=600`;
        
        const wikiRes = await fetch(wikiUrl, {
          headers: {
            'User-Agent': 'HeianTourImagesSync/1.0 (suporte@heiantour.com.br)'
          }
        });
        const wikiData = await wikiRes.json();

        let fotoUrl = null;
        let wikiTitle = '';

        if (wikiData.query && wikiData.query.pages) {
          const pages = wikiData.query.pages;
          const pageKey = Object.keys(pages)[0];
          const page = pages[pageKey];
          wikiTitle = page.title;
          if (page.thumbnail && page.thumbnail.source) {
            fotoUrl = page.thumbnail.source;
          }
        }

        let similar = false;
        if (fotoUrl) {
          similar = verificarSimilaridade(nome, wikiTitle);
        }

        if (fotoUrl && similar) {
          console.log(`✅ MATCH: "${nome}" -> Wiki: "${wikiTitle}" -> ${fotoUrl}`);
          sucesso++;
          
          if (!dryRun) {
            // Fazer o update no banco de dados via PUT da API
            const updateRes = await fetch(`http://localhost:3000/api/atracoes/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...atracao,
                'Foto (URL)': fotoUrl
              })
            });
            if (updateRes.ok) {
              console.log(`   💾 Salvo no banco com sucesso!`);
            } else {
              console.log(`   ❌ Erro ao salvar: ${updateRes.statusText}`);
            }
          }
        } else if (fotoUrl && !similar) {
          console.log(`⚠️ REJEITADO (Falso Positivo suspeito): "${nome}" -> Wiki: "${wikiTitle}"`);
          falha++;
        } else {
          console.log(`⚠️ SEM FOTO: "${nome}" (Buscou por "${queryTerm}" na Wikipedia, mas não retornou imagem)`);
          falha++;
        }
      } catch (err) {
        console.log(`❌ ERRO ao pesquisar "${nome}":`, err.message);
        falha++;
      }

      // Pequena pausa sempre para evitar rate-limiting e respeitar a API da Wikipedia
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    console.log(`\n=== RESULTADO ===`);
    console.log(`Fotos encontradas na Wikipedia: ${sucesso}`);
    console.log(`Sem foto correspondente: ${falha}`);
    if (dryRun) {
      console.log(`\nNenhum dado foi alterado. Para executar de verdade e salvar, rode:`);
      console.log(`node scratch/populate_wikimedia_photos.js --run`);
    } else {
      console.log(`\nBanco de dados atualizado com sucesso!`);
    }

  } catch (err) {
    console.error('Erro geral na migração:', err);
  }
}

main();
