const fs = require('fs');
let roteiros = fs.readFileSync('public/js/roteiros.js', 'utf8');

const search = `  // Preenche dados do cliente
  document.getElementById('rotClienteNome').value = roteiroEmEdicao.cliente?.nome || '';
  document.getElementById('rotClienteAdultos').value = roteiroEmEdicao.cliente?.adultos || '2';
  document.getElementById('rotClienteCriancas').value = roteiroEmEdicao.cliente?.criancas || '0';
  document.getElementById('rotClienteData').value = roteiroEmEdicao.cliente?.dataOrcamento || '';
  document.getElementById('rotClienteDataFim').value = roteiroEmEdicao.cliente?.dataFim || '';
  document.getElementById('rotClienteVooChegada').value = roteiroEmEdicao.cliente?.vooChegada || '';
  document.getElementById('rotClienteVooPartida').value = roteiroEmEdicao.cliente?.vooPartida || '';`;

const replace = `  // Encontrar o notionClienteId baseado nas cotações vinculadas
  let notionId = null;
  if (state && state.orcamentosDB) {
    const vinculado = state.orcamentosDB.find(o => o.orcRoteiroVinculado === nome);
    if (vinculado) notionId = vinculado.notionClienteId;
  }
  if (!notionId && state && state.orcamento && state.orcamento.orcRoteiroVinculado === nome) {
    notionId = state.orcamento.notionClienteId;
  }
  
  const notionCli = notionId && typeof notionClients !== 'undefined' ? notionClients.find(c => c.id === notionId) : null;

  // Preenche dados do cliente (prioriza Notion)
  document.getElementById('rotClienteNome').value = notionCli ? notionCli.nome : (roteiroEmEdicao.cliente?.nome || '');
  document.getElementById('rotClienteAdultos').value = notionCli ? notionCli.adultos : (roteiroEmEdicao.cliente?.adultos || '2');
  document.getElementById('rotClienteCriancas').value = notionCli ? notionCli.criancas : (roteiroEmEdicao.cliente?.criancas || '0');
  
  // Datas e voos (não estão mais na UI do Roteiro como editáveis globalmente, mas para garantir preenchemos)
  document.getElementById('rotClienteData').value = notionCli ? notionCli.dataInicio : (roteiroEmEdicao.cliente?.dataInicio || roteiroEmEdicao.cliente?.dataOrcamento || '');
  if(document.getElementById('rotClienteDataFim')) document.getElementById('rotClienteDataFim').value = notionCli ? notionCli.dataFim : (roteiroEmEdicao.cliente?.dataFim || '');
  if(document.getElementById('rotClienteVooChegada')) document.getElementById('rotClienteVooChegada').value = notionCli ? notionCli.vooChegada : (roteiroEmEdicao.cliente?.vooChegada || '');
  if(document.getElementById('rotClienteVooPartida')) document.getElementById('rotClienteVooPartida').value = notionCli ? notionCli.vooPartida : (roteiroEmEdicao.cliente?.vooPartida || '');`;

if(roteiros.includes(search)) {
  roteiros = roteiros.replace(search, replace);
  fs.writeFileSync('public/js/roteiros.js', roteiros);
  console.log('abrirEditorRoteiro patched');
} else {
  console.log('abrirEditorRoteiro pattern not found');
}
