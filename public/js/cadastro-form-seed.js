/* ============================================================================
   HEIAN TOUR — SEMENTE DO FORMULÁRIO DE CADASTRO (Fase A)
   Definição estruturada do formulário ATUAL (cadastro.html), fiel campo a campo.
   É a "fonte da verdade" que o motor vai consumir:
     - o /cadastro renderiza o wizard a partir daqui;
     - o servidor mapeia as respostas pro Notion a partir daqui.
   No dia 1, esta semente reproduz EXATAMENTE o formulário de hoje.

   destino de cada campo:
     - 'coluna'  -> vira uma propriedade (coluna) no Notion (notionProp/notionTipo)
     - 'perfil'  -> entra no relatório "Perfil de Viagem & Preferências" (corpo do card)
     - 'local'   -> guardado no Supabase (estruturas locais do cliente)
   sistema:true  -> "ligado ao sistema": o App/roteiro depende dele; avisar antes de mexer.
   ========================================================================== */
(function (root) {
  var SEED = {
    versao: 1,
    titulo: 'Formulário de Perfil — Heian Tour',
    // headings do relatório de perfil no corpo do card do Notion
    perfilSecoes: ['⛩️ Perfil de Viagem & Preferências', '🏃 Estilo e Ritmo', '🎯 Interesses & Prioridades', '🌸 Experiências Imperdíveis & Desejos'],
    secoes: [
      {
        passo: 1, titulo: '🗾 Dados Principais',
        campos: [
          { id: 'nome', label: 'Nome do Grupo / Família', tipo: 'texto', obrigatorio: true, sistema: true,
            placeholder: 'Ex: Família Sampaio, Grupo Sakuras...', destino: 'coluna', notionProp: 'Nome do Cliente', notionTipo: 'title' },
          { id: 'email', label: 'Email de Contato', tipo: 'email', obrigatorio: true, sistema: true,
            placeholder: 'Ex: contato@email.com', destino: 'coluna', notionProp: 'Email', notionTipo: 'email',
            obs: 'aceita vários emails (um por linha); o 1º vira a coluna Email' },
          { id: 'fotoPerfil', label: 'Foto de Perfil (Opcional)', tipo: 'foto', obrigatorio: false, sistema: true,
            destino: 'local', localCampo: 'fotoPerfil' },
          { id: 'profissoes', label: 'Profissão ou Ocupação dos Viajantes', tipo: 'texto', obrigatorio: false, sistema: true,
            placeholder: 'Ex: Empresário e Médica, Engenheiro...', destino: 'coluna', notionProp: 'Profissão dos Viajantes', notionTipo: 'rich_text' }
        ]
      },
      {
        passo: 2, titulo: '✈️ Viagem & Logística',
        campos: [
          { id: 'viajantes', label: 'Viajantes (nome, sobrenome e idade)', tipo: 'grupo_pessoas', obrigatorio: false, sistema: true,
            destino: 'multi',
            // gera: coluna "Nome dos Viajantes" (rich_text, junta por linha) + Qtd Adultos/Crianças (idade<12 = criança) + estrutura local "viajantes"
            regras: { notionPropNomes: 'Nome dos Viajantes', notionPropAdultos: 'Qtd Adultos', notionPropCriancas: 'Qtd Crianças', idadeCrianca: 12, localCampo: 'viajantes' } },
          { id: 'periodo', label: 'Período da Viagem (chegada e retorno)', tipo: 'data_intervalo', obrigatorio: false, sistema: true,
            subcampos: [{ id: 'dataInicio', label: 'Data de Chegada (Previsão)' }, { id: 'dataFim', label: 'Data de Retorno (Previsão)' }],
            destino: 'coluna', notionProp: 'Período da Viagem', notionTipo: 'date' },
          { id: 'cidadesPretendeVisitar', label: 'Cidades que pretendem visitar', tipo: 'texto', obrigatorio: false, sistema: false,
            placeholder: 'Ex: Tokyo, Kyoto, Osaka, Hakone, Hiroshima...', destino: 'perfil',
            perfilSecao: '⛩️ Perfil de Viagem & Preferências', perfilFormato: 'paragrafo', perfilRotulo: 'Cidades que pretende visitar: ' },
          { id: 'necessidadesEspeciais', label: 'Necessidades Especiais ou Restrições', tipo: 'textolongo', obrigatorio: false, sistema: true,
            placeholder: 'Alergias graves, restrições alimentares, mobilidade reduzida...', destino: 'coluna', notionProp: 'Necessidades Especiais', notionTipo: 'rich_text' },
          { id: 'hotel', label: 'Hotéis / Estadias', tipo: 'grupo_hoteis', obrigatorio: false, sistema: true,
            destino: 'multi', regras: { notionProp: 'Hotel', notionTipo: 'rich_text', localCampo: 'estadias' },
            subcampos: [{ id: 'cidade', label: 'Cidade' }, { id: 'pref', label: 'Hotel' }, { id: 'in', label: 'Check-in' }, { id: 'out', label: 'Check-out' }] },
          { id: 'voos', label: 'Voos (chegada e saída)', tipo: 'grupo_voos', obrigatorio: false, sistema: true,
            destino: 'multi', regras: { notionPropChegada: 'Voo de Chegada', notionPropPartida: 'Voo de Partida', notionTipo: 'rich_text' },
            subcampos: [{ id: 'tipo', label: 'Chegada/Saída' }, { id: 'dia', label: 'Dia' }, { id: 'codigo', label: 'Nº do Voo' }, { id: 'hora', label: 'Horário' }] }
        ]
      },
      {
        passo: 3, titulo: '🏃 Estilo e Ritmo',
        campos: [
          { id: 'ritmo', label: 'Como descreve o ritmo ideal dos dias da viagem?', tipo: 'escolha_unica', obrigatorio: false, sistema: false,
            padrao: 'Equilibrado', destino: 'perfil', perfilSecao: '🏃 Estilo e Ritmo', perfilRotulo: 'Ritmo de Viagem: ',
            opcoes: [ { valor: 'Calmo e Profundo', rotulo: 'Calmo e Profundo' }, { valor: 'Equilibrado', rotulo: 'Equilibrado' }, { valor: 'Acelerado', rotulo: 'Acelerado' } ] },
          { id: 'templos', label: 'Qual o ritmo ideal para visitas a templos e santuários?', tipo: 'escolha_unica', obrigatorio: false, sistema: false,
            padrao: 'Equilíbrio Principal', destino: 'perfil', perfilSecao: '🏃 Estilo e Ritmo', perfilRotulo: 'Visita a Templos: ',
            opcoes: [ { valor: 'Poucos com Calma', rotulo: 'Poucos com Calma' }, { valor: 'Equilíbrio Principal', rotulo: 'Equilíbrio (principais)' }, { valor: 'Quero Conhecer Vários', rotulo: 'Quero Conhecer Vários' } ] },
          { id: 'caminhada', label: 'Como é o seu perfil em relação a caminhadas diárias?', tipo: 'escolha_unica', obrigatorio: false, sistema: false,
            padrao: 'Moderado', destino: 'perfil', perfilSecao: '🏃 Estilo e Ritmo', perfilRotulo: 'Ritmo de Caminhada: ',
            opcoes: [ { valor: 'Pequenos Trajetos', rotulo: 'Pequenos Trajetos' }, { valor: 'Moderado', rotulo: 'Moderado (caminho normal ao longo do dia)' }, { valor: 'Longas Distâncias', rotulo: 'Intenso (consigo caminhar bastante)' } ] },
          { id: 'refeicoes', label: 'Qual o estilo de refeição preferido para o dia a dia?', tipo: 'escolha_unica', obrigatorio: false, sistema: false,
            padrao: 'Mesclado', destino: 'perfil', perfilSecao: '🏃 Estilo e Ritmo', perfilRotulo: 'Estilo de Refeições: ',
            opcoes: [ { valor: 'Restaurantes Tradicionais', rotulo: 'Restaurantes tradicionais planejados' }, { valor: 'Mesclado', rotulo: 'Mesclado (restaurantes e comida rápida/rua)' }, { valor: 'Rápido', rotulo: 'Comida rápida/conveniência (ganhar tempo)' } ] },
          { id: 'prioridades', label: 'Prioridades da Viagem (selecione de 2 a 4 principais)', tipo: 'escolha_multipla', obrigatorio: true, sistema: false,
            destino: 'perfil', perfilSecao: '🎯 Interesses & Prioridades', perfilRotulo: 'Prioridades de Viagem: ',
            opcoes: [ { valor: 'Natureza & Paisagens', rotulo: '🌸 Natureza & Paisagens' }, { valor: 'Cultura Pop & Anime', rotulo: '🎮 Cultura Pop & Anime' }, { valor: 'História & Tradição', rotulo: '⛩️ História & Tradição' }, { valor: 'Tecnologia & Modernidade', rotulo: '🤖 Tecnologia & Modernidade' }, { valor: 'Gastronomia', rotulo: '🍣 Gastronomia' }, { valor: 'Onsens & Relaxamento', rotulo: '♨️ Onsens & Relaxamento' }, { valor: 'Compras', rotulo: '🛍️ Compras' } ] }
        ]
      },
      {
        passo: 4, titulo: '🌸 Interesses & Detalhes Especiais',
        campos: [
          { id: 'primeiraVez', label: 'Primeira vez viajando ao Japão?', tipo: 'simnao', obrigatorio: false, sistema: false,
            padrao: 'Sim', destino: 'perfil', perfilSecao: '🎯 Interesses & Prioridades', perfilRotulo: 'Primeira vez no Japão? ',
            opcoes: [ { valor: 'Sim', rotulo: 'Sim, primeira vez' }, { valor: 'Não', rotulo: 'Não, já visitei o Japão antes' } ] },
          { id: 'experienciasSazonais', label: 'Interesse em experiências sazonais?', tipo: 'escolha_unica', obrigatorio: false, sistema: false,
            padrao: 'Sim', destino: 'perfil', perfilSecao: '🎯 Interesses & Prioridades', perfilRotulo: 'Interesse em experiências sazonais? ',
            opcoes: [ { valor: 'Sim', rotulo: 'Sim, tenho interesse (ex: sakura, festivais)' }, { valor: 'Indiferente', rotulo: 'Indiferente' } ] },
          { id: 'interessesTour', label: 'Qual o foco preferido dos Tours Guiados?', tipo: 'escolha_multipla', obrigatorio: false, sistema: false,
            destino: 'perfil', perfilSecao: '🎯 Interesses & Prioridades', perfilRotulo: 'Foco dos Tours Guiados: ',
            opcoes: [ { valor: 'História Imperial', rotulo: 'História Imperial' }, { valor: 'Religião & Espiritualidade', rotulo: 'Religião & Espiritualidade' }, { valor: 'Cultura Geral', rotulo: 'Cultura Geral & Sociedade' }, { valor: 'Curiosidades Locais', rotulo: 'Curiosidades & Dia a Dia' } ] },
          { id: 'ocasiaoEspecial', label: 'A viagem celebra alguma ocasião especial?', tipo: 'condicional_texto', obrigatorio: false, sistema: true,
            destino: 'coluna', notionProp: 'Ocasião Especial', notionTipo: 'rich_text',
            gatilhoLabel: 'Sim, comemoração especial', textoLabel: 'Qual a Ocasião Especial?', placeholder: 'Ex: Lua de Mel, Aniversário, Bodas...' },
          { id: 'experienciasImperdiveis', label: 'Experiências dos seus sonhos ou atrações imperdíveis', tipo: 'textolongo', obrigatorio: false, sistema: false,
            placeholder: 'Ex: jantar tradicional com gueixa, dormir em Ryokan, ver o Monte Fuji, teamLab...',
            destino: 'perfil', perfilSecao: '🌸 Experiências Imperdíveis & Desejos', perfilFormato: 'paragrafo', perfilRotulo: '' },
          { id: 'observacoes', label: 'Outras observações ou pedidos especiais', tipo: 'textolongo', obrigatorio: false, sistema: true,
            placeholder: 'Qualquer informação adicional relevante para o seu roteiro...', destino: 'coluna', notionProp: 'Observações', notionTipo: 'rich_text' }
        ]
      }
    ]
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SEED;
  root.CADASTRO_FORM_SEED = SEED;
})(typeof window !== 'undefined' ? window : globalThis);
