/* ============================================================================
   HEIAN TOUR — AUTOSAVE + SYNC DOS DADOS DO CLIENTE NO ROTEIRO (camada nova)
   - Os campos do card "Dados do Cliente" salvam sozinhos no roteiro ao digitar.
   - Mudar nº de pessoas re-renderiza os dias (itens que SEGUEM o cliente atualizam).
   - Se o roteiro está VINCULADO a um cliente do Notion, sincroniza também
     os campos alterados no cadastro do Notion (debounce; só o que mudou).
   ========================================================================== */
(function () {
  'use strict';
  var _paxTimer = null;
  var _notionTimer = null;
  var _pendentes = {};   // acumula só os campos alterados p/ mandar ao Notion

  var MAPA = {
    rotClienteNome: 'nome',
    rotClienteAdultos: 'adultos',
    rotClienteCriancas: 'criancas',
    rotClienteData: 'dataInicio',
    rotClienteDataFim: 'dataFim',
    rotClienteVooChegada: 'vooChegada',
    rotClienteVooPartida: 'vooPartida'
  };

  function getNotionId() {
    var r = window.roteiroEmEdicao;
    if (!r) return null;
    return r.notionClienteId || (r.cliente && r.cliente.notionClienteId) || null;
  }

  // Monta o pedaço do payload referente ao campo alterado (datas vão em par, pra não zerar a outra ponta)
  function acumularPendente(chave, c) {
    if (chave === 'nome') _pendentes.nome = c.nome || '';
    else if (chave === 'adultos') _pendentes.adultos = c.adultos;
    else if (chave === 'criancas') _pendentes.criancas = c.criancas;
    else if (chave === 'vooChegada') _pendentes.vooChegada = c.vooChegada || '';
    else if (chave === 'vooPartida') _pendentes.vooPartida = c.vooPartida || '';
    else if (chave === 'dataInicio' || chave === 'dataFim') {
      _pendentes.dataInicio = c.dataInicio || '';
      _pendentes.dataFim = c.dataFim || '';
    }
  }

  function agendarSyncNotion(chave) {
    var id = getNotionId();
    if (!id) return; // roteiro sem cliente vinculado: não sincroniza nada
    acumularPendente(chave, (window.roteiroEmEdicao && window.roteiroEmEdicao.cliente) || {});
    clearTimeout(_notionTimer);
    _notionTimer = setTimeout(function () { enviarSyncNotion(id); }, 2000);
  }

  async function enviarSyncNotion(id) {
    var payload = _pendentes; _pendentes = {};
    if (!payload || Object.keys(payload).length === 0) return;
    try {
      var res = await fetch('/api/notion/clientes/' + id, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (res.ok) {
        // atualiza o cache local de clientes (pra outras telas verem na hora)
        if (Array.isArray(window.notionClients)) {
          var ci = window.notionClients.find(function (x) { return x.id === id; });
          if (ci) Object.keys(payload).forEach(function (k) { ci[k] = payload[k]; });
        }
        var ind = document.getElementById('roteiroAutoSaveIndicator');
        if (ind) {
          ind.textContent = 'Salvo + sincronizado no Notion';
          ind.style.opacity = '1';
          setTimeout(function () { if (ind && ind.textContent === 'Salvo + sincronizado no Notion') ind.style.opacity = '0.4'; }, 2500);
        }
      } else if (window.console) {
        console.error('Sync Notion (roteiro): resposta', res.status);
      }
    } catch (e) { if (window.console) console.error('Sync Notion (roteiro) falhou:', e); }
  }

  function onInput(campoId, chave) {
    var el = document.getElementById(campoId);
    if (!el || el.__autosaveWired) return;
    el.__autosaveWired = true;
    el.addEventListener('input', function () {
      var r = window.roteiroEmEdicao;
      if (!r) return;
      if (!r.cliente) r.cliente = {};
      r.cliente[chave] = el.value;

      // 1) salva no roteiro (local)
      if (typeof window.autoSaveRoteiro === 'function') window.autoSaveRoteiro();
      if (typeof window.updateRoteiroHeader === 'function') { try { window.updateRoteiroHeader(); } catch (e) {} }

      // 2) se mudou o nº de pessoas, re-renderiza os dias (itens que seguem o cliente)
      if (chave === 'adultos' || chave === 'criancas') {
        clearTimeout(_paxTimer);
        _paxTimer = setTimeout(function () {
          try { if (typeof window.renderEditDias === 'function') window.renderEditDias(); } catch (e) {}
        }, 500);
      }

      // 3) se há cliente vinculado, sincroniza o campo alterado no Notion (debounce)
      agendarSyncNotion(chave);
    });
  }

  function wire() { Object.keys(MAPA).forEach(function (id) { onInput(id, MAPA[id]); }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
  setTimeout(wire, 1500);

  window.__roteiroClienteAutosave = { wire: wire, getNotionId: getNotionId };
})();
