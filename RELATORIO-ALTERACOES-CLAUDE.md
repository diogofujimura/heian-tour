# Relatório Técnico — Alterações no Heian Tour (para Antigravity)

Data: 02/07/2026 · Autor: Claude (sessão Cowork) · Escopo: `server.js` + frontend `public/` + deploy

Este documento descreve TODAS as alterações feitas no código, o desenho das novas
mecânicas (IDs imutáveis, guarda de versão, histórico, token do portal), o plano de
testes e o que fazer em caso de problema. Nada além do listado aqui foi alterado.

---

## 1. Visão geral das mudanças

| # | Tema | Arquivos |
|---|------|----------|
| 1 | Remoção de endpoints de debug e rota duplicada | `server.js` |
| 2 | Exclusão de arquivos de dev do deploy FTP | `.github/workflows/deploy.yml` |
| 3 | Token de acesso na Área do Cliente (HMAC) + cache de slugs | `server.js`, `public/cliente.html`, `public/js/dashboard.js`, `public/js/roteiros.js` |
| 4 | Autosave com dirty-check (abrir ≠ salvar) | `public/js/app.js`, `public/js/roteiros.js` |
| 5 | Vínculo cliente↔roteiro tolerante + por ID | `public/js/app.js` |
| 6 | Navegação (sidebar Roteiros/Cotações, hash, popstate) | `public/app.html`, `public/js/app.js` |
| 7 | Corrida de abas do perfil do cliente, busca, header | `public/js/app.js`, `public/css/style.css` |
| 8 | Service worker kill-switch | `public/service-worker.js` |
| 9 | **IDs imutáveis de roteiro + migração automática** | `server.js`, `public/js/roteiros.js`, `public/js/app.js`, `public/js/sync_roteiro_cotacao.js` |
| 10 | **Guarda de versão (HTTP 409) em roteiros e orçamentos** | `server.js` + autosaves do frontend |
| 11 | **Histórico embutido (últimas 5 versões)** | `server.js` |
| 12 | Script de backup do Supabase | `backup_dados.js` (novo), `.gitignore` |

Arquivos tocados: `server.js`, `public/js/app.js`, `public/js/roteiros.js`,
`public/js/dashboard.js`, `public/js/sync_roteiro_cotacao.js`, `public/cliente.html`,
`public/app.html`, `public/css/style.css`, `public/service-worker.js`,
`.github/workflows/deploy.yml`, `.gitignore`, `backup_dados.js` (novo).
Todos passaram em `node --check`.

---

## 2. Mudanças no servidor (`server.js`)

### 2.1 Removido
- `GET /api/debug` e `GET /api/debug-logs` (vazavam config completa e logs).
- `POST /api/public/cadastro` duplicado (no-op `(req,res,next)=>next()` que nunca executava;
  o handler real, registrado antes do middleware de auth, permanece intacto).

### 2.2 Whitelist de autenticação
No middleware global de Basic Auth, o teste de rota pública mudou de
`req.path.startsWith(r)` para `req.path === r || req.path.startsWith(r + '/')`,
e `'/cliente.html'` foi adicionado à lista (links legados `cliente.html?id=` seguem públicos).

### 2.3 Área do Cliente — token HMAC
Novas funções (próximas de `gerarSlug`, ~linha 5030):
- `portalSecret()` → `process.env.PORTAL_LINK_SECRET || process.env.APP_PASS || ''`.
- `gerarTokenPortal(clientId)` → HMAC-SHA256(clientId sem hífens, minúsculo) com o secret,
  primeiros **12 hex**.
- `tokenPortalValido(clientId, t)` → compara com `crypto.timingSafeEqual`.
  **Se não houver secret configurado, retorna `true`** (dev local sem APP_PASS não exige token).
- `requestAutenticadaAdmin(req)` → decodifica o header Basic e compara com APP_USER/APP_PASS.
  Admin logado dispensa token nas rotas públicas.
- `reconstruirCacheSlugs()` → extraída do endpoint; popula `slugToIdCache` varrendo a base
  de Clientes do Notion (paginação incluída). `CACHE_TTL` subiu de 5 min para **6 horas**;
  o cache é aquecido no boot (setTimeout 3 s após `app.listen`).

Endpoints alterados:
- `GET /api/public/client-data/:clientId` e `GET /api/public/client-data/slug/:slug`
  agora exigem `?t=<token>` válido, exceto se a request vier autenticada como admin.
  Resposta em falha: **403** `{ success:false, error:'Link inválido ou expirado...' }`.

Endpoints novos (protegidos pelo Basic Auth global):
- `GET /api/clientes/:id/dados` → mesmo payload do client-data público (usado pelo
  montador de roteiros, que antes chamava a rota pública — 3 call sites em `roteiros.js`).
- `GET /api/clientes/:id/portal-link` → `{ success, url, token, slug }`. Monta
  `https://host/cliente/<slug>?t=<token>`; se não achar slug, usa o próprio ID no caminho.

### 2.4 IDs imutáveis de roteiro
Conceito: a coluna `nome` da tabela `roteiros` (chave física) passa a guardar um **ID
imutável** no formato `rot_<timestamp36>_<rand>`; o nome de exibição vive em `data.nome`.

Funções novas (antes do `GET /api/roteiros`, ~linha 1930):
- `gerarIdRoteiro()`.
- `buscarTodosRoteiros()`.
- `acharRoteiroPorChaveOuNome(param)` → resolve por chave física (ID ou nome legado);
  se não achar e `param` não começar com `rot_`, procura por `data.nome === param`.
- `aplicarHistorico(dadosNovos, dadosAntigos)` → ver §2.6.
- `conflitoDeVersao(baseVersao, armazenado)` → ver §2.5.
- `migrarRoteirosParaId()` → ver §2.7.

Endpoints alterados:
- `GET /api/roteiros` → mapa **chaveado pelo nome de exibição** (`data.nome || chave`),
  mantendo compatibilidade com o frontend. Cada valor ganha `id` (chave física) e `nome`.
  Nomes duplicados recebem sufixo visual `" (2)"`, `" (3)"` só na chave do mapa.
- `POST /api/roteiros/:name` → resolve o registro via `acharRoteiroPorChaveOuNome`.
  Se não existir: cria com chave nova (`rot_...`) — ou usa `:name` se já vier `rot_`.
  Proteções, nesta ordem: (a) **colisão de cliente** — salvar por NOME em cima de roteiro
  de OUTRO cliente sem `corpo.id` → 409 `conflict_client`; (b) **guarda de versão** → 409
  `conflict_version` (§2.5). Grava com `id`, `nome`, `atualizadoEm` (carimbado pelo
  servidor), `criadoEm` preservado e `_historico`. Resposta:
  `{ ok, name, id, nome, atualizadoEm, roteiro }`. O caso especial
  `[PLANILHA] Base de Rotas` continua indo para a tabela `rotas_base`, inalterado.
- `POST /api/roteiros/:name/renomear` → agora **não muda a chave física**: resolve a linha,
  atualiza `data.nome = novoNome` e faz cascade nas cotações vinculadas (por `roteiroId`
  OU por nome antigo), atualizando o rótulo `orcRoteiroVinculado`/`roteiroVinculado` e
  consolidando `d.roteiroId = chave`. 404 se o roteiro não existir.
- `DELETE /api/roteiros/:name` (soft), `POST /:name/restaurar`, `DELETE /:name/definitivo`
  → todos resolvem por ID/nome antes de agir.
- `POST /api/calendario/sincronizar-roteiro` e o helper `buscarHotelPorData`
  → resolvem o roteiro via `acharRoteiroPorChaveOuNome` (aceitam ID ou nome).
- No `getClientDataHelper` (portal do cliente), o casamento heurístico por nome do roteiro
  passou a usar `r.data.nome` (o físico `r.nome` agora é ID; se começar com `rot_` é ignorado
  na heurística de nome).

### 2.5 Guarda de versão (anti-sobrescrita)
Protocolo: o cliente envia `_baseVersao` no corpo do POST = o `atualizadoEm` que ele
carregou. O servidor compara com o `atualizadoEm` armazenado:
- `_baseVersao === undefined/null` → **não valida** (compatibilidade com clientes antigos
  e criações novas).
- Registro inexistente → passa.
- Diferente → **409** `{ error:'conflict_version', message:'...alterado em outra sessão...',
  atualizadoEm }` e NADA é gravado.
`_baseVersao` é sempre removido do objeto antes de persistir.
Aplicado em: `POST /api/roteiros/:name` e `POST /api/orcamentos`.
Em roteiros o servidor carimba `atualizadoEm` novo e o devolve; em orçamentos o carimbo
continua vindo do cliente (comportamento original preservado) e a resposta devolve
`{ success:true, atualizadoEm }`.

### 2.6 Histórico embutido (`_historico`)
`aplicarHistorico(novos, antigos)`: se existir versão anterior, empurra um snapshot dela
(`{ em, dados }`, sem `_historico` aninhado) para `data._historico`, com regras:
máximo **5 entradas** e no máximo **1 snapshot a cada 10 minutos** (autosaves não inflam).
Aplicado em roteiros (save e renomear) e orçamentos. Não há UI de restauração ainda —
recuperação manual: ler `data._historico[n].dados` no Supabase e gravar de volta.

### 2.7 Migração automática (idempotente)
`migrarRoteirosParaId()` roda **1,5 s após o boot** (e sob demanda via
`GET /api/admin/migrar-roteiros`, autenticado). Para cada linha da tabela `roteiros`:
- Chave já `rot_...` → só garante `data.id`/`data.nome` coerentes (conta em `jaOk`).
- Chave legada (nome) → gera `novoId`; grava NOVA linha `{nome: novoId, data:{...,id,nome:
  <nome antigo>, _chaveLegada}}`; atualiza cotações com `orcRoteiroVinculado|roteiroVinculado
  === nome antigo` gravando `data.roteiroId = novoId`; **só então** apaga a linha antiga.
  Se o insert falhar, a linha antiga NÃO é apagada (não há perda).
Resultado logado como `[Migração Roteiros→ID] {migrados, jaOk, erros}`.

### 2.8 `POST /api/orcamentos`
Antes: upsert cego. Agora: lê a linha atual, aplica guarda de versão (§2.5) e histórico
(§2.6), então upserta. Campos novos no dado: `roteiroId` (gravado pelo frontend/migração),
`_historico`.

---

## 3. Mudanças no frontend

### 3.1 `public/js/app.js`
- **Dirty-check do autosave de cotação**: novos `_lastSavedOrcSig`, `orcSignature(orc)`
  (JSON sem `atualizadoEm`), `montarOrcParaSalvar()` (constrói o objeto a partir do DOM —
  código extraído do antigo `autoSave`) e `marcarBaselineAutoSave()`.
  `autoSave()` agora: monta o objeto → se assinatura igual à última salva, **retorna sem
  gravar**. `abrirOrcamento()` chama `marcarBaselineAutoSave()` ao final (abrir não salva).
  `novoOrcamento()` zera o baseline. `salvarOrcamentoAtual()` atualiza o baseline.
- **Versão base da cotação**: `window.__orcVersaoBase` é setado em `abrirOrcamento`
  (= `orc.atualizadoEm`), zerado em `novoOrcamento`. `saveOrcamentoToCloud()` envia
  `_baseVersao` e trata **409** com alerta único por sessão
  (flag `window.__conflitoCotacaoAvisado`) + indicador "Conflito de edição!"; em sucesso,
  `__orcVersaoBase = orc.atualizadoEm`.
- **Helper global** `window.chaveRoteiroPorId(rid)` → varre `dbRotas` e devolve a chave de
  exibição cujo valor tem `.id === rid`.
- **Gerar esqueleto de roteiro** (2 fluxos: botão da cotação ~linha 2596 e fluxo da ficha
  ~linha 4076): ao criar, lê o JSON de resposta e grava `novoRoteiroObj.id/nome` e
  `state.orcamento.roteiroId`.
- **`btnIrParaRoteiro`** (em `abrirOrcamento`): resolve primeiro por
  `chaveRoteiroPorId(orc.roteiroId)`, fallback no nome.
- **`renderAbaRoteiros(cliente)`**: matching ampliado — por `rot.id` ∈ `roteiroId` das
  cotações do cliente, por `notionClienteId` (topo ou em `cliente.`), por nome normalizado
  (sem acento/caixa) e por nome vindo das cotações.
- **Navegação**: `popstate` sem state agora usa o hash da URL (antes caía numa "Nova
  Cotação" em branco); `navToPage` renderiza a lista ao entrar em `meus` e `roteiros`
  e limpa o campo `pesquisaClientesList` ao entrar em `clientes`.
- **Corrida de abas do perfil do cliente**: `switchClientTab` seta
  `window.__activeClientTab`; `renderAbaResumoCliente` e `renderAbaVouchersCliente`
  (assíncronas) conferem a flag antes de escrever em `#clientTabContent`.

### 3.2 `public/js/roteiros.js`
- **Dirty-check do roteiro**: `window._lastSavedRoteiroSig`, `window.roteiroSignature()`
  (= `nomeChave + '|' + JSON(roteiroEmEdicao)`), `window.marcarBaselineRoteiro()` chamado
  em `abrirEditorRoteiro` (abrir não salva) e após cada save OK.
- **`autoSaveRoteiro` e `triggerRoteiroAutoSave`**: URL usa `roteiroEmEdicao.id ||
  <nome>`; corpo leva `_baseVersao: roteiroEmEdicao.atualizadoEm`; **409** → indicador
  "Conflito de edição!" + alerta único (`window.__conflitoRoteiroAvisado`); sucesso →
  atualiza `roteiroEmEdicao.id/atualizadoEm` com a resposta e refaz o baseline.
- **`btnSalvarEdicaoRoteiro`**: seta `roteiroEmEdicao.nome = novoNome`; se o nome mudou →
  chama `/renomear` com a chave imutável (`id || roteiroOriginalNome`); senão save comum
  por `id || novoNome` com `_baseVersao`. Após sucesso: atualiza `id/atualizadoEm`,
  `dbRotas[novoNome]`, `roteiroOriginalNome = novoNome`, baseline.
- **Modal de edição rápida de elemento** (~linha 3028): save por `roteiro.id || nome`,
  `_baseVersao`, tratamento de 409.
- **3 fetches** `'/api/public/client-data/' + id` → `'/api/clientes/' + id + '/dados'`.

### 3.3 `public/js/sync_roteiro_cotacao.js`
- `roteiroParaCotacao`: acha cotação existente por `roteiro.id === o.roteiroId` OU nome;
  grava `state.orcamento.roteiroId = roteiro.id`.
- `cotacaoParaRoteiro`: resolve o nome do roteiro por `chaveRoteiroPorId(orcamento.roteiroId)`
  primeiro (declaração mudou de `const nome` para `let nome`).

### 3.4 `public/js/dashboard.js`
- `copiarLinkClienteFromId` virou **async**: busca `GET /api/clientes/:id/portal-link` e
  copia a URL com token; fallback para o slug local (sem token) se o servidor falhar.

### 3.5 `public/cliente.html`
- Lê `?t=` da URL e monta `window.__portalTokenQS` (`'?t=...'` ou `''`) em DOIS pontos:
  o init principal (~linha 3186) e `loadClientArea()` legado. Todas as chamadas a
  `/api/public/client-data...` anexam `window.__portalTokenQS`.

### 3.6 `public/app.html`, CSS, service worker, deploy
- Sidebar: novos itens `data-page="roteiros"` (Roteiros) e `data-page="meus"` (Cotações)
  na seção Gestão & Vendas.
- Conversor de câmbio da sidebar: placeholders `digite ¥` / `auto` (era `0`, parecia bug).
- `style.css`: `.page-header` ganhou `gap:12px; flex-wrap:wrap` e `h1` `white-space:nowrap`;
  `.header-actions` ganhou `flex-wrap:wrap; align-items:center; row-gap:8px`.
- `service-worker.js`: substituído por **kill-switch** (apaga todos os caches, se
  desregistra e recarrega as janelas controladas). Os registros nos HTMLs foram mantidos
  de propósito — é assim que o kill-switch alcança quem tinha o SW antigo.
- `deploy.yml`: exclui `patch*.js, temp*.js, scratch_*.js, fix*.js, test_*.js, update_*.js,
  print_*.js, inject_*.js, extract_*.js, *.md, *.zip, *.bat, *log*.txt, old_index.html,
  page-base-*.html, _BACKUP_*/, Roteiros/, backup_dados.js, backups/` etc. **Atenção**: o
  que já está na `public_html` do servidor precisa ser removido manualmente uma vez.

### 3.7 `backup_dados.js` (novo, raiz)
`node backup_dados.js` → baixa `roteiros, orcamentos, clientes_locais, config, rotas_base`
para `backups/AAAA-MM-DD_HHMM/*.json`. Pasta ignorada no git e no deploy.

---

## 4. Variáveis de ambiente
- `PORTAL_LINK_SECRET` — secret do token do portal (JÁ CONFIGURADA em produção pelo Diogo).
  Fallback: `APP_PASS`. Sem nenhuma das duas, o token não é exigido (dev local).
  **Trocar o secret invalida todos os links já enviados.**
- Demais variáveis inalteradas.

---

## 5. Plano de testes (ordem recomendada)

Pré-requisito: `node backup_dados.js` ANTES de tudo (o `.env` local aponta para o banco
de PRODUÇÃO — a migração do §2.7 vai rodar nos dados reais no primeiro boot local).
Combinar com a Deborah uma janela sem uso.

1. **Boot**: `node server.js` → conferir logs `[Migração Roteiros→ID] {..., erros:[]}` e
   `[Portal] Cache de slugs...`.
2. **Listas**: `/admin` → sidebar Roteiros e Cotações. Nomes de exibição corretos
   (nunca `rot_...` visível).
3. **Abrir ≠ salvar**: abrir roteiro e cotação sem editar → indicador não mostra
   "Salvando"; `atualizadoEm` na lista não muda após F5.
4. **Renomear**: renomear roteiro vinculado a cotação → cotação acompanha (select de
   vínculo e botão "Ir para Roteiro" funcionam); `roteiroId` da cotação inalterado.
5. **Conflito cotação**: mesma cotação em 2 abas; editar na aba 1 (aguardar "Salvo
   automaticamente"), editar na aba 2 → alerta "alterada em outra sessão", sem gravação.
   Repetir para roteiro.
6. **Vínculo cliente**: Clientes → Família Pechman → aba Roteiros → roteiro aparece.
7. **Portal**: "Link do Cliente" → URL com `?t=`; janela anônima abre; sem `?t=` → 403.
   Fluxos internos do montador (briefing IA, importação) continuam funcionando (usam a
   nova rota autenticada).
8. **Calendário**: sincronizar roteiro → eventos criados; "Pagar Guia" intacto.
9. **Migração**: `GET /api/admin/migrar-roteiros` → `{migrados:[], jaOk:N, erros:[]}`
   na segunda execução.
10. **Deploy**: push → aguardar Actions → **reiniciar o app Node na Hostinger**
    (o FTP não reinicia) → repetir testes 2, 3, 5 e 7 em produção → reenviar links novos
    aos clientes ativos → apagar arquivos de dev antigos da `public_html`.

---

## 6. Diagnóstico e correção de problemas

| Sintoma | Causa provável | Correção |
|---|---|---|
| Lista de roteiros mostra `rot_...` como nome | `data.nome` ausente naquele registro | Rodar `GET /api/admin/migrar-roteiros`; se persistir, setar `data.nome` manualmente no Supabase |
| 409 `conflict_version` em toda gravação | Cliente não atualizou `atualizadoEm` após um save (handler de resposta não rodou) | Recarregar a página resolve na hora; investigar o handler `res.json()` do fluxo que disparou (autoSaveRoteiro / triggerRoteiroAutoSave / saveOrcamentoToCloud) |
| 409 `conflict_client` ao criar roteiro | Nome já usado por roteiro de outro cliente | Comportamento correto; escolher outro nome |
| Roteiro "sumido" da lista | Soft-delete (`data.deletado`) ou nome duplicado ganhou sufixo `" (2)"` | Ver Lixeira; buscar no Supabase por `data.nome`; `data._chaveLegada` guarda o nome pré-migração |
| Link do cliente dá 403 | Link antigo sem `?t=`, ou `PORTAL_LINK_SECRET`/`APP_PASS` mudou | Regerar o link pelo botão "Link do Cliente" e reenviar |
| Montador não carrega briefing/dados do cliente | Rota nova `/api/clientes/:id/dados` exige sessão admin | Confirmar que o navegador está autenticado no Basic Auth; ver console |
| Portal do cliente sem roteiro | Heurística de matching em `getClientDataHelper` | Garantir `data.notionClienteId` ou `data.cliente.notionClienteId` no roteiro; o nome de exibição em `data.nome` também é usado |
| Migração com `erros:[...]` | Falha de insert/update no Supabase | A linha original NÃO foi apagada (sem perda). Corrigir a causa e re-rodar o endpoint |
| Cotação não salva e não mostra erro | Dirty-check: nada mudou de verdade | Comportamento esperado; editar algo dispara o save |

### Rollback completo (último recurso)
Os JSONs de `backups/<data>/` restauram qualquer tabela. Exemplo de restore:
```js
// restore.js — restaura uma tabela a partir do backup
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const linhas = require('./backups/2026-07-02_XXXX/roteiros.json');
(async () => {
  for (const l of linhas) {
    const { error } = await sb.from('roteiros').upsert(l);
    console.log(l.nome, error ? 'ERRO ' + error.message : 'ok');
  }
})();
```
Para reverter a migração de IDs: apagar as linhas `rot_...` criadas e re-upsertar o backup
(as antigas foram deletadas pela migração, o backup as devolve). Reverter também exige
voltar o código (git revert), senão o boot migra de novo.

---

## 7. Fora de escopo / pendências conhecidas
- Dados de teste em produção ("Cliente Teste Antigravity", "Cliente Teste Unificado",
  cotação "Sem nome", "Cotação - Família Fujimura" duplicada) — apagar manualmente.
- Sem UI para o `_historico` (restauração é manual via Supabase).
- Lixeira de roteiros resolve por nome de exibição; com nomes duplicados pode restaurar o
  primeiro que casar (caso raro).
- `Valor Total` do cliente no Notion não é gravado automaticamente ao fechar cotação
  (só leitura hoje) — melhoria sugerida.
- Senha do admin (`adminHeian`) fraca e exposta em conversas — trocar na Hostinger.
- Arquivos de dev antigos ainda presentes na `public_html` do servidor — remover uma vez.


---
---

# PARTE 2 — Sessão de 02/07/2026 (tarde): Mobile, editores e login por sessão

Tudo abaixo foi feito APÓS o commit a263ae0. Nenhuma alteração de banco de dados
nesta parte — só frontend e o sistema de sessão no servidor.

## 8. Pacote mobile do admin (≤768px; desktop intocado)

### 8.1 Navegação inferior
- `public/app.html`: novo `<nav class="bottom-nav">` com 5 itens (Hoje=dashboard,
  Clientes, Agenda=calendario, Caixa=contabilidade, Mais) + sheets `#mobSheetMais`
  (Roteiros, Cotações, Colaboradores, Base, Lixeira, Configurações) e
  `#mobSheetEtapa` (mover cliente de etapa). Novo symbol `#icon-menu`.
- `public/js/mobile-nav.js` (NOVO): liga a barra/sheets à navegação existente
  (clica no item correspondente da sidebar para reusar toda a lógica), sincroniza
  o item ativo via hashchange, e implementa `window.abrirSheetMoverEtapa`.
- CSS em bloco "PACOTE MOBILE" no fim de `public/css/style.css`.

### 8.2 Kanban touch
- `public/js/dashboard.js` → `renderKanban`: cards ganham `dataset.id` e
  `dataset.status` na criação (antes só no touchstart).
- `mobile-nav.js`: MutationObserver no `#kanbanBoard` injeta botão
  "Mover etapa ›" (classe `.kanban-move-btn`, visível só no mobile) em cada card,
  abre o sheet de etapas e chama `atualizarStatusClienteKanban(id, status)`.
  Colunas viram accordion (toque no header alterna `.mob-collapsed`; vazias já
  começam recolhidas). Drag & drop do desktop intacto.

### 8.3 Correções de vazamento do tema (redesign-light.css)
O tema é desktop-first com `!important` e carrega POR ÚLTIMO — regras dele
vazavam pro mobile. Bloco "Correções mobile" no FIM de
`public/css/redesign-light.css` (precisa ficar por último!):
- `.main{margin-left:0}` (era 258px fixo → conteúdo deslocado);
- `.rb-shell{grid-template-columns:1fr}` (editor de roteiro: o grid de 3 colunas
  reservava 230px+210px de colunas invisíveis → tudo espremido);
- `#page-orcamento .cot-shell{grid-template-columns:1fr}`.

### 8.4 Editores em tela cheia no celular
- Todos os sub-formulários com grades inline (`style="grid-template-columns:1fr 1fr"`)
  colapsam via seletor de atributo `[style*="grid-template-columns"]` escopado aos
  editores → coluna única. Cobre sequência, transporte, experiência, info, texto.
- Chips de atração e campos em tamanho de dedo; modais `.modal-box` E
  `.event-modal-card` viram bottom-sheets; inputs 16px (anti-zoom iOS).
- Barra de ações do editor de roteiro (`#roteiroEditorAcoes`/`#roteiroEditorBotoes`,
  ids novos em app.html) vira BARRA FIXA acima da navegação inferior, com rolagem
  horizontal e Salvar primeiro (order:-3).
- Margens laterais: `.main` 2px, pane-content 2px, cards 8px lateral,
  `.item-row .form-grid{padding:0}` (tinha 16px extras do desktop).

### 8.5 Bugs de fluxo corrigidos
- **Cotações "sumidas"**: o tema adiciona `cot-list-hidden` por padrão
  (cotacao-enhance.js linha ~130). Entrar pela navegação agora remove a classe
  (`navToPage` targetPg==='meus'). O toggle "☰ Cotações" continua funcionando.
- **Editor de roteiro invisível no celular**: nenhum funil de edição chamava
  `mostrarDetailMobile('page-roteiros')`. Agora `abrirEditorRoteiro` chama sempre;
  `abrirOrcamento` chama `mostrarDetailMobile('page-meus')` nos dois modos
  (preview e edição).
- **Cotação presa a 1000px no desktop**: `#page-meus .pane-content-inner{max-width:none}`.
  O documento de preview (`.pdf-doc`) permanece centrado com largura de leitura.

## 9. Dias recolhíveis no editor de roteiro (desktop E mobile)

`public/js/roteiros.js`:
- Estado em `window.__diasColapsados` (Set de índices) — NÃO grava nada no dado
  do roteiro (autosave não dispara por recolher/expandir).
- `toggleDiaColapsado(idx)`, `toggleTodosDias()` (botão "Recolher/Expandir todos"
  renderizado no topo da lista em `renderEditDias`), `resumoDoDia(dia)` (cidades
  das sequências + contagem de itens).
- Template do card: botão ▾/▸ no cabeçalho vinho; corpo embrulhado em
  `<div class="dia-card-body">`; linha `.dia-resumo` clicável quando recolhido.
- `moverDia` troca o estado junto com o dia; `delDia` reindexa o Set;
  `abrirEditorRoteiro` limpa o Set (novo roteiro = tudo expandido).
- **ATENÇÃO**: `public/js/builder-enhance.js` linha ~213 — o seletor de blocos
  foi atualizado para `:scope > div[...], :scope > .dia-card-body > div[...]`.
  Se mexer na estrutura do card, manter os dois níveis.
- CSS `.dia-colapsado`/`.dia-resumo` no fim do style.css.

## 10. Login por sessão + PWA (app instalável sem pedir senha)

### 10.1 Servidor (server.js, antes do middleware de auth)
- `assinarSessao(exp)` = HMAC-SHA256(`sess|`+exp, **APP_PASS**) — trocar a senha
  invalida todas as sessões (comportamento desejado).
- `sessaoValida(req)`: lê cookie `heian_sess` (formato `exp.assinatura`), valida
  expiração + `timingSafeEqual`.
- `GET /login` → serve `public/login.html` (NOVO; tela com marca Heian).
- `POST /api/login {usuario, senha}` → confere com APP_USER/APP_PASS → Set-Cookie
  `heian_sess` HttpOnly, SameSite=Lax, Max-Age **180 dias**, Secure quando https
  (detecta `req.secure` ou `x-forwarded-proto`).
- `GET /logout` → limpa o cookie.
- Middleware global (ordem): rotas públicas (agora incluem `/login` e
  `/api/login`) → cookie válido → **GET de página HTML sem sessão redireciona
  para /login** (em vez do prompt básico) → Basic Auth (compatibilidade mantida
  para APIs/integrações).
- `requestAutenticadaAdmin(req)` também aceita a sessão por cookie (admin logado
  navegando na área do cliente não precisa de token).

### 10.2 PWA
- `public/manifest-admin.json` (NOVO): name "Heian Tour — Admin",
  `start_url:/admin#dashboard`, standalone, theme #6B1F2A, ícones logo-192/512.
- `app.html` agora aponta para `/manifest-admin.json` (o `manifest.json` original
  continua existindo para o portal/cadastro).
- Instalação: login no navegador do celular → Adicionar à tela inicial.

## 11. Incidente de arquivos truncados (IMPORTANTE)

Padrão recorrente no ambiente local: arquivos perdendo os últimos bytes.
- `public/app.html` estava truncado NO GIT (commits 93d1a55 e a263ae0): faltava o
  fechamento do script do service worker + `</body></html>`. Efeito: SW nunca
  registrava no /admin. **Reparado nesta sessão** (fim do arquivo reconstruído).
- Cópias locais de `app.js` e `roteiros.js` estavam truncadas vs HEAD →
  restauradas de `git show HEAD:` (nenhum trabalho perdido).
- Se voltar a acontecer: comparar `wc -c` local vs `git show HEAD:arquivo | wc -c`
  e conferir se o arquivo termina como esperado. Suspeita: sync/antivírus na
  pasta do projeto.

## 12. Plano de testes da Parte 2

1. `node server.js` local → `localhost:3000/admin` sem sessão → deve redirecionar
   para `/login`; entrar → cookie criado → F5 não pede mais senha. `/logout` volta
   ao login. Basic Auth direto na API (curl -u) continua funcionando.
2. DevTools modo celular (≤768px): barra inferior navega; "Mais" abre sheet;
   kanban empilhado com "Mover etapa ›" funcionando; modais sobem como sheets.
3. Editor de roteiro mobile: abrir pela aba Roteiros do cliente E pela lista →
   painel de detalhe aparece; largura total; barra Salvar fixa embaixo; grades
   internas em 1 coluna; recolher/expandir dias (e "Recolher todos").
4. Desktop: recolher dias funciona igual; cotação ocupa a largura toda; lista de
   cotações aparece ao entrar pelo menu; NADA de regressão visual nas outras telas
   (o tema carrega por último — conferir Painel, Clientes, Contabilidade).
5. Celular físico após deploy: instalar PWA (Android e iOS), abrir pelo ícone,
   conferir que não pede senha e abre no painel.

## 13. Diagnóstico rápido (Parte 2)

| Sintoma | Causa | Onde mexer |
|---|---|---|
| Conteúdo deslocado p/ direita no mobile | Regra !important do tema vazando | Bloco "Correções mobile" no FIM do redesign-light.css |
| Editor espremido no mobile | Grid fantasma (rb-shell/cot-shell) ou grade inline nova | Mesmo bloco; ou o catch-all `[style*="grid-template-columns"]` no style.css |
| Barra Salvar não aparece no editor mobile | ids `roteiroEditorAcoes`/`roteiroEditorBotoes` removidos do app.html | Restaurar ids |
| Cartõezinhos "editar" dos elementos sumiram | Seletor do builder-enhance (linha ~213) não cobre `.dia-card-body` | Ver §9 |
| Login em loop | Cookie não sendo aceito: APP_PASS ausente no ambiente, ou https atrás de proxy sem `x-forwarded-proto` | Ver §10.1; conferir header no proxy da Hostinger |
| PWA pede senha ao abrir | Sessão expirou (180d) ou APP_PASS trocada | Logar de novo — esperado |
| "Mover etapa" não aparece nos cards | dataset.id ausente (renderKanban alterado) ou mobile-nav.js não carregou | §8.2; conferir script tag no app.html |
