/* ============================================================================
   HEIAN TOUR — MOTOR DO CADASTRO (Fase A)
   A partir das RESPOSTAS (mesmo formato do payload de hoje), monta:
     - properties  (colunas do Notion)
     - children    (relatório "Perfil de Viagem & Preferências" no corpo do card)
   Reproduz EXATAMENTE o comportamento atual do servidor. Roda no navegador
   (preview) e no Node (servidor). Não escreve nada sozinho — só monta o payload.
   ========================================================================== */
(function (root) {
  function rt(content) { return { rich_text: [{ text: { content: String(content) } }] }; }
  function titleOf(content) { return { title: [{ text: { content: String(content) } }] }; }
  function span(content, bold) { var o = { type: 'text', text: { content: String(content) } }; if (bold) o.annotations = { bold: true }; return o; }
  function heading(level, content) { var t = 'heading_' + level; var b = { object: 'block', type: t }; b[t] = { rich_text: [span(content)] }; return b; }
  function bullet(spans) { return { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: spans } }; }
  function paragraph(spans) { return { object: 'block', type: 'paragraph', paragraph: { rich_text: spans } }; }
  function joinArr(v) { return Array.isArray(v) ? v.join(', ') : (v == null ? '' : String(v)); }

  function construirPayloadNotion(seed, r) {
    r = r || {};
    var properties = {
      'Nome do Cliente': titleOf(r.nome || ''),
      'Status do Cliente': { select: { name: 'Novo' } },
      'Qtd Adultos': { number: parseInt(r.adultos) || 0 },
      'Qtd Crianças': { number: parseInt(r.criancas) || 0 }
    };
    if (r.vooChegada) properties['Voo de Chegada'] = rt(r.vooChegada);
    if (r.vooPartida) properties['Voo de Partida'] = rt(r.vooPartida);
    if (r.hotel) properties['Hotel'] = rt(r.hotel);
    if (r.dataInicio && r.dataFim && r.dataInicio !== r.dataFim) properties['Período da Viagem'] = { date: { start: r.dataInicio, end: r.dataFim } };
    else if (r.dataInicio) properties['Período da Viagem'] = { date: { start: r.dataInicio } };
    if (r.email) { var fe = String(r.email).split('\n')[0].trim(); if (fe) properties['Email'] = { email: fe }; }
    if (r.viajantes) properties['Nome dos Viajantes'] = rt(r.viajantes);
    if (r.observacoes) properties['Observações'] = rt(r.observacoes);
    if (r.profissoes) properties['Profissão dos Viajantes'] = rt(r.profissoes);
    if (r.ocasiaoEspecial) properties['Ocasião Especial'] = rt(r.ocasiaoEspecial);
    if (r.necessidadesEspeciais) properties['Necessidades Especiais'] = rt(r.necessidadesEspeciais);

    var children = [];
    children.push(heading(2, '⛩️ Perfil de Viagem & Preferências'));
    if (r.cidadesPretendeVisitar) children.push(paragraph([span('Cidades que pretende visitar: ', true), span(r.cidadesPretendeVisitar)]));
    children.push(heading(3, '🏃 Estilo e Ritmo'));
    if (r.ritmo) children.push(bullet([span('Ritmo de Viagem: ', true), span(r.ritmo)]));
    if (r.templos) children.push(bullet([span('Visita a Templos: ', true), span(r.templos)]));
    if (r.caminhada) children.push(bullet([span('Ritmo de Caminhada: ', true), span(r.caminhada)]));
    if (r.refeicoes) children.push(bullet([span('Estilo de Refeições: ', true), span(r.refeicoes)]));
    children.push(heading(3, '🎯 Interesses & Prioridades'));
    if (r.prioridades) children.push(bullet([span('Prioridades de Viagem: ', true), span(joinArr(r.prioridades))]));
    if (r.interessesTour) children.push(bullet([span('Foco dos Tours Guiados: ', true), span(joinArr(r.interessesTour))]));
    if (r.primeiraVez) children.push(bullet([span('Primeira vez no Japão? ', true), span(r.primeiraVez)]));
    if (r.experienciasSazonais) children.push(bullet([span('Interesse em experiências sazonais? ', true), span(r.experienciasSazonais)]));
    if (r.experienciasImperdiveis) {
      children.push(heading(3, '🌸 Experiências Imperdíveis & Desejos'));
      children.push(paragraph([span(r.experienciasImperdiveis)]));
    }
    return { properties: properties, children: children };
  }

  var API = { construirPayloadNotion: construirPayloadNotion };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.CadastroEngine = API;
})(typeof window !== 'undefined' ? window : globalThis);
