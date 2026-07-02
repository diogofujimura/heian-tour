# Handoff para o Antigravity — estado atual do projeto Heian Tour

Este documento resume **tudo que foi alterado fora do Antigravity** (numa pasta cópia),
para que o desenvolvimento continue daqui sem se perder. Leia antes de editar.

## Como esta pasta foi atualizada
As mudanças foram feitas numa **pasta cópia** e trazidas para cá por sobreposição de
arquivos (mantendo `.env`, `.git` e `node_modules`). Ou seja: o código abaixo já está
nesta pasta. Este arquivo é só o "mapa" do que mudou e por quê.

> Regra de ouro que seguimos o tempo todo: **não quebrar o que conecta ao Notion,
> Google Sheets, Hostinger e GitHub.** Mudanças de tela são aditivas (camadas novas),
> e as poucas mudanças de backend são cirúrgicas e aditivas.

---

## Padrão de arquitetura adotado
A maior parte das melhorias de tela foi feita como **"camadas" (enhance layers)**:
arquivos JS novos, carregados no admin, que **envolvem/estendem** as funções existentes
dentro de `try/catch`, sem reescrever o core. Isso reduz risco e mantém o original
funcionando mesmo se a camada falhar.

O **admin de produção é servido pelo `app.html`** (rota `/admin` no `server.js`).
O `index.html` é a página pública "Em Breve". (Durante o desenvolvimento usamos um
`app-novo.html` como preview; o conteúdo dele virou o `app.html` de produção.)

Gotcha técnico: editar arquivos JS **muito grandes** (`app.js` ~8400 linhas,
`server.js` ~5600, `roteiros.js` ~3400) com algumas ferramentas causou truncamento.
A forma confiável foi **editar via script (python) e validar com `node --check`**.

---

## Arquivos NOVOS (camadas e motores)
- `public/js/builder-enhance.js` — reformula o construtor de roteiro (trilha de dias,
  cartões recolhíveis, resumo/total ao vivo, validação, duplicar dia).
- `public/js/cotacao-enhance.js` — reformula o editor de cotação (itens recolhíveis,
  resumo flutuante, subtotais, duplicar/excluir item, margem/lucro, alertas).
- `public/js/pdf-export.js` — barra de exportação do PDF do roteiro (versão Resumida/
  Detalhada, enviar por e-mail).
- `public/js/provisoes.js` — **Painel de Provisões/Compras** no Dashboard: lê roteiro +
  cotação dos clientes na etapa "Compras" e lista o que comprar/reservar por urgência
  (janela que abre + prazo limite), com regras editáveis (config `provisoes_regras`) e
  estado "feito" salvo (config `provisoes_status`).
- `public/js/cadastro-form-seed.js` — definição estruturada do formulário de cadastro
  (21 campos, 4 passos), usada como fonte da verdade dos campos de perfil.
- `public/js/cadastro-engine.js` — **mapeia respostas do cliente -> propriedades +
  relatório de blocos do Notion.** É réplica fiel da lógica do `/api/public/cadastro`.
  IMPORTANTE: o `server.js` faz `require('./public/js/cadastro-engine.js')` — este
  arquivo é dependência do backend agora.
- `public/js/cliente-perfil.js` — injeta no editor de cliente a seção **"Perfil &
  Preferências"** (renderizada da seed), com carregar/coletar e botão minimizar.
- `public/js/roteiro-cliente-autosave.js` — autosave dos campos do cliente no roteiro
  e **sincronia com o Notion** (só o campo alterado, debounce, quando há vínculo).
- `public/css/redesign-light.css` — tema claro/papel + componentes do builder/cotação.
- `public/css/pdf-redesign.css` — visual do PDF (cover, fontes maiores, caixa de
  pagamento).
- Experimentais (NÃO usados em produção, podem ser ignorados/removidos):
  `public/js/cadastro-render.js`, `public/cadastro-novo.html` (protótipo de formulário
  dirigido por config — a edição de perfil acabou usando seed+engine, não estes).

## Arquivos EDITADOS
- `public/app.html` (admin) — agora é a versão nova; carrega todas as camadas + CSS.
- `public/js/dashboard.js` — **Kanban**: etapa "Compras"; reordenar colunas (config
  `kanban_colunas_ordem`); ordenar cards por data; mostrar/ocultar etapas; auto-scroll
  no arraste; **revalidação de clientes em segundo plano** (some o "precisa F5").
- `public/js/app.js` — **F5 mantém a página** (persiste em hash + localStorage e
  restaura no load); abertura **em paralelo**; "Editar Cliente" navega pra ficha
  completa; inclui `preferencias` + colunas no salvar do cliente.
- `public/js/roteiros.js` — **conserto do vínculo roteiro-cliente** (lê o id do lugar
  certo + normaliza topo/aninhado — fim do "Salvar Cliente no Notion" enganoso que
  duplicava cliente); campos do cliente destravados; **pax dos itens "segue o cliente"**
  (removido o congelamento na criação; `formatarPessoas` cai no pax do cliente; botão
  "↻ seguir cliente" por item).
- `public/cliente.html` — Área do Viajante: aba "Guia do Japão", contagem regressiva,
  correções de valores (desconto/grupo, formatação ¥/R$), colunas ajustadas.
- `public/css/style.css` — estilos do drag de coluna do Kanban.
- `server.js` — **sincronia do Perfil com o Notion**: ao salvar o cliente, atualiza as
  colunas (Profissão/Ocasião/Necessidades) e **reescreve** o relatório "Perfil de Viagem
  & Preferências" no corpo do card (helpers `sincronizarPerfilNotion`/`planejarSyncPerfil`
  + `require` do engine). Verificado: é o `server.js` de produção + SÓ estas adições.
- `public/assets/logo.png` — logo usada no PDF.

---

## O que está TESTADO (headless / jsdom)
Kanban (etapas/sort/ocultar/auto-scroll), Provisões (urgência/extração/regras/feito),
edição de perfil (carregar/coletar/minimizar), motor do cadastro (idêntico ao servidor),
sincronia do perfil (planejamento dos blocos), vínculo roteiro-cliente (5 cenários),
autosave + sync Notion (só campos alterados), pax segue cliente. Todos passando.

## PENDENTE (próximos passos combinados)
1. **Provisões Fase 0** — abrir campos de prazo por item na base (transportes/
   experiências/atrações: `acao`, `janelaAbreDias`, `prazoDias`, `precisaReserva`).
   Hoje o painel roda com regras-padrão por tipo; a Fase 0 dá controle por item
   (ex.: Shibuya Sky com prazo próprio) e liga reservas de atração.
2. **Provisões Fase 2** — botão "↗ Notion" (empurrar tarefa pro Tasks Tracker, com
   dedup) e Status=Done de volta.
3. **Duplicar roteiro para outro cliente** — botão que copia os dias e religa no
   cliente certo (gerando nome novo pra não colidir).
4. **Construtor de formulário** (opcional) — tornar o `/cadastro` 100% editável pelo
   App (a seed e o engine já são a fundação).

## Integrações sensíveis (não quebrar)
- Notion: bancos de Clientes, Tasks Tracker. Campo "Status do Cliente" é **select**
  (a etapa "Compras" se cria sozinha ao arrastar). Perfil agora é escrito pelo servidor.
- Supabase: `roteiros`, `orcamentos`, `clientes_locais`, `config` (chaves novas:
  `kanban_colunas_ordem`, `provisoes_status`, `provisoes_regras`).
- Deploy: zip manual na Hostinger. `.env` fica na Hostinger (não vai no zip).
