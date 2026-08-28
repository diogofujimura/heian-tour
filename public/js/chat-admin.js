/* ============================================================================
   HEIAN TOUR — CENTRAL DE MENSAGENS (admin)
   Conversa com clientes via /api/chat/*. Autenticação: sessão/Basic do admin.
   ========================================================================== */
(function () {
  'use strict';
  var clienteAtivo = null, timer = null, anexoPendente = null;
  var miniClienteAtivo = null, miniTimer = null, miniAnexoPendente = null, miniAberto = false;
  var notificadas = {};
  var inicializado = false;

  function e(id) { return document.getElementById(id); }
  function nomeCliente(id) {
    var c = (window.notionClients || []).find(function (x) { return x.id === id; });
    if (c) return c.nome || 'Cliente';
    var idn = String(id).replace(/-/g, '');
    c = (window.notionClients || []).find(function (x) { return String(x.id).replace(/-/g, '') === idn; });
    return c ? (c.nome || 'Cliente') : ('Cliente ' + String(id).slice(0, 8));
  }
  function fmtHora(iso) {
    try { var d = new Date(iso); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch (err) { return ''; }
  }

  // --- LÓGICA DE ÁUDIO E NOTIFICAÇÃO ---
  function tocarSomNotificacao() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } catch (err) { /* Bloqueio de autoplay do navegador */ }
  }

  function injetarEstilos() {
    if (e('heian-chat-toast-style')) return;
    var style = document.createElement('style');
    style.id = 'heian-chat-toast-style';
    style.innerHTML = 
      '#heian-chat-toast {' +
      '  position: fixed;' +
      '  bottom: 24px;' +
      '  right: 24px;' +
      '  z-index: 9999;' +
      '  background: #FFFDFA;' +
      '  border: 1px solid rgba(196, 163, 90, 0.4);' +
      '  border-radius: 14px;' +
      '  box-shadow: 0 10px 30px rgba(107, 31, 42, 0.15);' +
      '  width: 320px;' +
      '  padding: 16px;' +
      '  display: flex;' +
      '  flex-direction: column;' +
      '  gap: 10px;' +
      '  font-family: inherit;' +
      '  transform: translateY(100px);' +
      '  opacity: 0;' +
      '  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;' +
      '}' +
      '#heian-chat-toast.show {' +
      '  transform: translateY(0);' +
      '  opacity: 1;' +
      '}' +
      '#heian-chat-toast-fechar:hover {' +
      '  color: var(--crimson) !important;' +
      '}' +
      '#heian-mini-chat {' +
      '  position: fixed;' +
      '  bottom: 0;' +
      '  right: 80px;' +
      '  z-index: 9998;' +
      '  width: 360px;' +
      '  height: 480px;' +
      '  background: #FFFDFA;' +
      '  border: 1px solid rgba(196, 163, 90, 0.4);' +
      '  border-radius: 16px 16px 0 0;' +
      '  box-shadow: 0 12px 40px rgba(107, 31, 42, 0.2);' +
      '  display: flex;' +
      '  flex-direction: column;' +
      '  font-family: inherit;' +
      '  overflow: hidden;' +
      '  transform: translateY(100%);' +
      '  opacity: 0;' +
      '  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;' +
      '}' +
      '#heian-mini-chat.show {' +
      '  transform: translateY(0);' +
      '  opacity: 1;' +
      '}' +
      '#heian-mini-chat.minimized {' +
      '  height: 44px;' +
      '  transform: translateY(0);' +
      '}' +
      '#heian-mini-chat-msgs::-webkit-scrollbar {' +
      '  width: 6px;' +
      '}' +
      '#heian-mini-chat-msgs::-webkit-scrollbar-track {' +
      '  background: transparent;' +
      '}' +
      '#heian-mini-chat-msgs::-webkit-scrollbar-thumb {' +
      '  background: rgba(107, 31, 42, 0.15);' +
      '  border-radius: 10px;' +
      '}' +
      '#heian-mini-chat-msgs::-webkit-scrollbar-thumb:hover {' +
      '  background: rgba(107, 31, 42, 0.3);' +
      '}';
    document.head.appendChild(style);
  }

  function exibirPopUpNotificacao(clienteId, nome, texto) {
    tocarSomNotificacao();
    injetarEstilos();

    var antigo = e('heian-chat-toast');
    if (antigo) antigo.remove();

    var div = document.createElement('div');
    div.id = 'heian-chat-toast';
    
    var textoExibido = texto || '';
    if (textoExibido.length > 80) {
      textoExibido = textoExibido.slice(0, 80) + '...';
    }

    div.innerHTML = 
      '<div style="display:flex; justify-content:space-between; align-items:center;">' +
      '  <span style="font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.8px; color:var(--crimson);">Nova Mensagem</span>' +
      '  <button id="heian-chat-toast-fechar" style="background:none; border:none; color:var(--ink-lt); font-size:16px; cursor:pointer; padding:0; line-height:1; transition:color 0.2s;">✕</button>' +
      '</div>' +
      '<div style="margin-top:2px;">' +
      '  <div style="font-weight:600; font-size:13.5px; color:var(--ink-dk); margin-bottom:4px;">' + nome + '</div>' +
      '  <div style="font-size:12.5px; color:var(--ink-mid); font-style:italic; line-height:1.4; word-break:break-word;">"' + String(textoExibido).replace(/</g, '&lt;') + '"</div>' +
      '</div>' +
      '<div style="display:flex; justify-content:flex-end; margin-top:4px;">' +
      '  <button id="heian-chat-toast-ver" style="background:var(--crimson); color:#fff; border:none; border-radius:8px; padding:6px 14px; font-size:12px; font-weight:600; cursor:pointer; transition:background 0.2s;">Responder</button>' +
      '</div>';

    document.body.appendChild(div);

    setTimeout(function () { div.classList.add('show'); }, 50);

    var autoFechar = setTimeout(function () {
      div.classList.remove('show');
      setTimeout(function () { div.remove(); }, 300);
    }, 10000);

    div.querySelector('#heian-chat-toast-fechar').addEventListener('click', function () {
      clearTimeout(autoFechar);
      div.classList.remove('show');
      setTimeout(function () { div.remove(); }, 300);
    });

    div.querySelector('#heian-chat-toast-ver').addEventListener('click', function () {
      clearTimeout(autoFechar);
      exibirMiniChat(clienteId);
    });
  }

  // --- LÓGICA DO MINI-CHAT FLUTUANTE ---
  async function carregarMensagensMiniChat(marcarLidas) {
    if (!miniClienteAtivo) return;
    try {
      var r = await fetch('/api/chat/' + encodeURIComponent(miniClienteAtivo));
      if (!r.ok) return;
      var j = await r.json();
      var msgs = j.mensagens || [];
      var box = e('heian-mini-chat-msgs');
      if (!box) return;
      box.innerHTML = msgs.length ? msgs.map(function (m) {
        var minha = m.remetente === 'empresa';
        var anexos = (m.anexos || []).map(function (a) {
          var url = '/api/chat/' + encodeURIComponent(miniClienteAtivo) + '/anexo/' + encodeURIComponent(a.id);
          return '<a href="' + url + '" style="display:flex; align-items:center; gap:6px; margin-top:4px; padding:5px 8px; border-radius:6px; background:' + (minha ? 'rgba(255,255,255,.25)' : 'rgba(107,31,42,.06)') + '; text-decoration:none; color:inherit; font-size:11px;">📄 <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + a.nome + '</span><b style="font-size:10px;">⬇</b></a>';
        }).join('');
        var lidoInfo = minha ? '<span style="margin-left:4px;">' + (m.lido ? '✓✓' : '✓') + '</span>' : '';
        return '<div style="max-width:80%; align-self:' + (minha ? 'flex-end' : 'flex-start') + '; background:' + (minha ? 'var(--crimson)' : '#fff') + '; color:' + (minha ? '#fff' : 'var(--ink-dk)') + '; border-radius:' + (minha ? '11px 11px 4px 11px' : '11px 11px 11px 4px') + '; padding:7px 10px; box-shadow:0 1.5px 5px rgba(44,26,29,.05); font-size:12.5px; line-height:1.4;">'
          + (m.mensagem ? '<div>' + String(m.mensagem).replace(/</g, '&lt;').replace(/\n/g, '<br>') + '</div>' : '')
          + anexos
          + '<div style="font-size:9px; opacity:.6; margin-top:3px; text-align:right;">' + fmtHora(m.criado_em) + lidoInfo + '</div></div>';
      }).join('') : '<div style="margin:auto; color:var(--ink-lt); font-size:12px;">Sem mensagens ainda.</div>';
      box.scrollTop = box.scrollHeight;
      if (marcarLidas) {
        fetch('/api/chat/' + encodeURIComponent(miniClienteAtivo) + '/ler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
          .then(function () { carregarConversas(); });
      }
    } catch (err) { /* silencioso */ }
  }

  async function enviarMiniChat() {
    if (!miniClienteAtivo) return;
    var textoEl = e('heian-mini-chat-texto');
    var enviarBtn = e('heian-mini-chat-enviar');
    var texto = textoEl.value.trim();
    if (!texto && !miniAnexoPendente) return;
    
    textoEl.value = '';
    textoEl.style.height = 'auto';
    enviarBtn.disabled = true;
    try {
      var anexos = [];
      if (miniAnexoPendente) {
        var up = await fetch('/api/chat/' + encodeURIComponent(miniClienteAtivo) + '/anexo', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: miniAnexoPendente.nome, conteudoBase64: miniAnexoPendente.b64 })
        });
        var uj = await up.json();
        if (uj.success) anexos.push({ id: uj.id, nome: uj.nome, tamanho: uj.tamanho });
        else { alert('Falha no anexo: ' + (uj.error || '')); enviarBtn.disabled = false; return; }
      }
      var r = await fetch('/api/chat/' + encodeURIComponent(miniClienteAtivo) + '/mensagem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: texto, anexos: anexos })
      });
      if (r.ok) {
        miniAnexoPendente = null;
        var prev = e('heian-mini-chat-anexo-prev');
        if (prev) prev.style.display = 'none';
        carregarMensagensMiniChat(false);
        carregarConversas();
      } else {
        var ej = await r.json().catch(function () { return {}; });
        alert('Erro ao enviar: ' + (ej.error || r.status));
      }
    } catch (err) { alert('Erro de conexão ao enviar.'); }
    enviarBtn.disabled = false;
  }

  function exibirMiniChat(clienteId) {
    miniClienteAtivo = clienteId;
    miniAberto = true;
    injetarEstilos();

    var toast = e('heian-chat-toast');
    if (toast) {
      toast.classList.remove('show');
      setTimeout(function () { toast.remove(); }, 300);
    }

    var widget = e('heian-mini-chat');
    if (widget) {
      widget.classList.remove('minimized');
      widget.classList.add('show');
      e('heian-mini-chat-titulo').textContent = nomeCliente(clienteId);
      carregarMensagensMiniChat(true);
      
      clearInterval(miniTimer);
      miniTimer = setInterval(function () { carregarMensagensMiniChat(true); }, 15000);
      return;
    }

    widget = document.createElement('div');
    widget.id = 'heian-mini-chat';
    widget.innerHTML = 
      '<div style="background:var(--crimson); color:#fff; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; cursor:pointer;" id="heian-mini-chat-header">' +
      '  <span style="font-weight:600; font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;" id="heian-mini-chat-titulo">' + nomeCliente(clienteId) + '</span>' +
      '  <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">' +
      '    <button id="heian-mini-chat-minimizar" style="background:none; border:none; color:#fff; font-size:12px; cursor:pointer; padding:2px;" title="Minimizar">▬</button>' +
      '    <button id="heian-mini-chat-central" style="background:none; border:none; color:#fff; font-size:14px; cursor:pointer; padding:2px;" title="Ir para a Central Completa">↗</button>' +
      '    <button id="heian-mini-chat-fechar" style="background:none; border:none; color:#fff; font-size:15px; cursor:pointer; padding:2px;" title="Fechar">✕</button>' +
      '  </div>' +
      '</div>' +
      '<div id="heian-mini-chat-msgs" style="flex:1; overflow-y:auto; padding:12px 10px; display:flex; flex-direction:column; gap:8px; background:#F8F3EB;"></div>' +
      '<div id="heian-mini-chat-anexo-prev" style="display:none; padding:5px 10px; font-size:11px; color:var(--crimson); background:#fff; border-top:1px solid rgba(196,163,90,.2);"></div>' +
      '<div style="display:flex; gap:6px; padding:8px; border-top:1px solid rgba(196,163,90,.2); align-items:flex-end; background:#fff;">' +
      '  <button id="heian-mini-chat-anexar" style="width:34px; height:34px; padding:0; display:flex; align-items:center; justify-content:center; border:1px solid var(--border); border-radius:8px; background:#FFFDFA; cursor:pointer; font-size:14px;" title="Anexar arquivo">📎</button>' +
      '  <input type="file" id="heian-mini-chat-arquivo" style="display:none" accept=".pdf,.png,.jpg,.jpeg,.heic,.doc,.docx">' +
      '  <textarea id="heian-mini-chat-texto" rows="1" placeholder="Responder..." style="flex:1; resize:none; border:1px solid var(--border); border-radius:8px; padding:8px 10px; font-size:13px; font-family:inherit; max-height:80px;"></textarea>' +
      '  <button id="heian-mini-chat-enviar" style="height:34px; padding:0 12px; border-radius:8px; border:none; background:var(--crimson); color:#fff; font-weight:600; font-size:13px; cursor:pointer;">Enviar</button>' +
      '</div>';

    document.body.appendChild(widget);

    widget.querySelector('#heian-mini-chat-header').addEventListener('click', function (ev) {
      if (ev.target.closest('button')) return;
      var _min = widget.classList.toggle('minimized');
      miniAberto = !_min;
    });

    widget.querySelector('#heian-mini-chat-minimizar').addEventListener('click', function () {
      var _min = widget.classList.toggle('minimized');
      miniAberto = !_min;
    });

    widget.querySelector('#heian-mini-chat-fechar').addEventListener('click', function () {
      miniAberto = false;
      miniClienteAtivo = null;
      clearInterval(miniTimer);
      widget.classList.remove('show');
      setTimeout(function () { widget.remove(); }, 300);
    });

    widget.querySelector('#heian-mini-chat-central').addEventListener('click', function () {
      miniAberto = false;
      miniClienteAtivo = null;
      clearInterval(miniTimer);
      widget.classList.remove('show');
      setTimeout(function () { widget.remove(); }, 300);
      
      if (typeof window.navToPage === 'function') {
        window.navToPage('mensagens');
      } else if (typeof navToPage === 'function') {
        navToPage('mensagens');
      }
      if (typeof window.abrirConversaChat === 'function') {
        window.abrirConversaChat(clienteId);
      }
    });

    widget.querySelector('#heian-mini-chat-enviar').addEventListener('click', enviarMiniChat);
    
    widget.querySelector('#heian-mini-chat-anexar').addEventListener('click', function () {
      widget.querySelector('#heian-mini-chat-arquivo').click();
    });

    widget.querySelector('#heian-mini-chat-arquivo').addEventListener('change', function () {
      var f = this.files[0]; if (!f) return;
      if (f.size > 15 * 1024 * 1024) { alert('Arquivo acima de 15 MB.'); return; }
      var fr = new FileReader();
      fr.onload = function () {
        miniAnexoPendente = { nome: f.name, b64: fr.result };
        var pv = e('heian-mini-chat-anexo-prev');
        pv.style.display = 'block';
        pv.textContent = '📎 ' + f.name + ' pronto';
      };
      fr.readAsDataURL(f);
      this.value = '';
    });

    var txt = widget.querySelector('#heian-mini-chat-texto');
    txt.addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 80) + 'px';
    });

    txt.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        enviarMiniChat();
      }
    });

    setTimeout(function () { widget.classList.add('show'); }, 50);

    carregarMensagensMiniChat(true);
    
    clearInterval(miniTimer);
    miniTimer = setInterval(function () { carregarMensagensMiniChat(true); }, 15000);
  }

  // --- LÓGICA DA CENTRAL PRINCIPAL E POLLING ---
  async function carregarConversas() {
    var box = e('msgListaConversas');
    try {
      var r = await fetch('/api/chat-resumo');
      var j = await r.json();
      var conversas = j.conversas || {};
      var ids = Object.keys(conversas);

      (window.notionClients || []).forEach(function (c) {
        if (!conversas[c.id]) { conversas[c.id] = { ultima: '', em: '', naoLidas: 0, semHistorico: true }; ids.push(c.id); }
      });
      ids.sort(function (a, b) { return (conversas[b].em || '').localeCompare(conversas[a].em || ''); });

      var totalNaoLidas = 0;
      if (box) {
        box.innerHTML = ids.map(function (id) {
          var cv = conversas[id]; totalNaoLidas += cv.naoLidas || 0;
          return '<div onclick="window.abrirConversaChat(\'' + id + '\')" style="padding:13px 16px; border-bottom:1px solid var(--border); cursor:pointer; ' + (clienteAtivo === id ? 'background:rgba(107,31,42,0.05);' : '') + '">'
            + '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">'
            + '<b style="font-size:13.5px; color:var(--ink-dk); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + nomeCliente(id) + '</b>'
            + (cv.naoLidas ? '<span style="background:var(--crimson); color:#fff; border-radius:99px; font-size:10.5px; padding:2px 8px; flex:none;">' + cv.naoLidas + '</span>' : '')
            + '</div>'
            + '<div style="font-size:12px; color:var(--ink-lt); margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + (cv.semHistorico ? 'Iniciar conversa' : (cv.ultima || '(anexo)')) + '</div>'
            + '</div>';
        }).join('') || '<p style="padding:20px; color:var(--ink-lt); font-size:13px;">Nenhuma conversa ainda.</p>';
      } else {
        ids.forEach(function (id) {
          totalNaoLidas += conversas[id].naoLidas || 0;
        });
      }

      var badge = e('navMsgBadge');
      if (badge) { badge.style.display = totalNaoLidas > 0 ? 'inline-block' : 'none'; badge.textContent = totalNaoLidas; }

      // Polling para Notificações Pop-up
      ids.forEach(function (id) {
        var cv = conversas[id];
        if (cv && cv.naoLidas > 0 && cv.em) {
          if (!inicializado) {
            notificadas[id] = cv.em;
          } else {
            if (notificadas[id] !== cv.em) {
              notificadas[id] = cv.em;
              var pageMsgs = document.getElementById('page-mensagens');
              var msgAtiva = pageMsgs ? pageMsgs.classList.contains('active') : false;
              var focado = (document && typeof document.hasFocus === 'function') ? document.hasFocus() : true;
              var naTelaGrandeAtiva = focado && (clienteAtivo === id && msgAtiva);
              var noMiniChatAtivo = focado && (miniClienteAtivo === id && miniAberto);
              if (!naTelaGrandeAtiva && !noMiniChatAtivo) {
                exibirPopUpNotificacao(id, nomeCliente(id), cv.ultima);
              }
            }
          }
        } else if (cv && cv.naoLidas === 0) {
          notificadas[id] = cv.em;
        }
      });
      inicializado = true;
    } catch (err) {
      if (box) {
        box.innerHTML = '<p style="padding:20px; color:#c00; font-size:13px;">Erro ao carregar (a tabela chat_mensagens existe no Supabase?)</p>';
      }
    }
  }

  async function carregarConversa(marcarLidas) {
    if (!clienteAtivo) return;
    try {
      var r = await fetch('/api/chat/' + encodeURIComponent(clienteAtivo));
      if (!r.ok) return;
      var j = await r.json();
      var msgs = j.mensagens || [];
      var box = e('msgCorpo');
      if (!box) return;
      box.innerHTML = msgs.length ? msgs.map(function (m) {
        var minha = m.remetente === 'empresa';
        var anexos = (m.anexos || []).map(function (a) {
          var url = '/api/chat/' + encodeURIComponent(clienteAtivo) + '/anexo/' + encodeURIComponent(a.id);
          return '<a href="' + url + '" style="display:flex; align-items:center; gap:8px; margin-top:6px; padding:7px 10px; border-radius:8px; background:' + (minha ? 'rgba(255,255,255,.25)' : 'rgba(107,31,42,.06)') + '; text-decoration:none; color:inherit; font-size:12px;">📄 <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + a.nome + '</span><b style="font-size:11px;">⬇</b></a>';
        }).join('');
        var lidoInfo = minha ? '<span style="margin-left:6px;">' + (m.lido ? '✓✓ lida' : '✓ enviada') + '</span>' : '';
        var txtEsc = String(m.mensagem || '').replace(/"/g, '&quot;');
        var btnCor = minha ? 'rgba(255,255,255,.85)' : 'var(--ink-lt)';
        var acoes = '<span class="msg-acoes" style="display:none; gap:8px;">'
          + (minha && m.mensagem ? '<button title="Editar" onclick="window.chatEditarMsg(\'' + m.id + '\')" style="background:none;border:none;cursor:pointer;font-size:12px;color:' + btnCor + ';padding:0;">✏️</button>' : '')
          + '<button title="Apagar" onclick="window.chatApagarMsg(\'' + m.id + '\')" style="background:none;border:none;cursor:pointer;font-size:12px;color:' + btnCor + ';padding:0;">🗑️</button>'
          + '</span>';
        return '<div class="msg-bolha" data-mid="' + m.id + '" data-texto="' + txtEsc + '" onmouseover="var _a=this.querySelector(\'.msg-acoes\'); if(_a)_a.style.display=\'inline-flex\';" onmouseout="var _a=this.querySelector(\'.msg-acoes\'); if(_a)_a.style.display=\'none\';" style="max-width:75%; align-self:' + (minha ? 'flex-end' : 'flex-start') + '; background:' + (minha ? 'var(--crimson)' : '#fff') + '; color:' + (minha ? '#fff' : 'var(--ink-dk)') + '; border-radius:' + (minha ? '13px 13px 4px 13px' : '13px 13px 13px 4px') + '; padding:9px 13px; box-shadow:0 2px 8px rgba(44,26,29,.07); font-size:13.5px; line-height:1.5;">'
          + (m.mensagem ? '<div>' + String(m.mensagem).replace(/</g, '&lt;').replace(/\n/g, '<br>') + '</div>' : '')
          + anexos
          + '<div style="font-size:10px; opacity:.65; margin-top:4px; text-align:right; display:flex; align-items:center; justify-content:flex-end; gap:8px;">' + acoes + '<span>' + fmtHora(m.criado_em) + lidoInfo + '</span></div></div>';
      }).join('') : '<div style="margin:auto; color:var(--ink-lt); font-size:13px;">Sem mensagens ainda — comece a conversa.</div>';
      box.scrollTop = box.scrollHeight;
      if (marcarLidas) {
        fetch('/api/chat/' + encodeURIComponent(clienteAtivo) + '/ler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
          .then(function () { carregarConversas(); });
      }
    } catch (err) { /* silencioso */ }
  }

  window.abrirConversaChat = function (id) {
    clienteAtivo = id;
    var cab = e('msgCabecalho');
    if (cab) cab.textContent = nomeCliente(id);
    carregarConversa(true);
    carregarConversas();
    clearInterval(timer);
    timer = setInterval(function () { carregarConversa(true); }, 15000);
  };

  async function enviar() {
    if (!clienteAtivo) { alert('Escolha uma conversa na lista.'); return; }
    var texto = e('msgTexto').value.trim();
    if (!texto && !anexoPendente) return;
    var btnEnv = e('msgEnviar');
    if (btnEnv) btnEnv.disabled = true;
    try {
      var anexos = [];
      if (anexoPendente) {
        var up = await fetch('/api/chat/' + encodeURIComponent(clienteAtivo) + '/anexo', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: anexoPendente.nome, conteudoBase64: anexoPendente.b64 })
        });
        var uj = await up.json();
        if (uj.success) anexos.push({ id: uj.id, nome: uj.nome, tamanho: uj.tamanho });
        else { alert('Falha no anexo: ' + (uj.error || '')); if (btnEnv) btnEnv.disabled = false; return; }
      }
      var r = await fetch('/api/chat/' + encodeURIComponent(clienteAtivo) + '/mensagem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: texto, anexos: anexos })
      });
      if (r.ok) {
        var txtArea = e('msgTexto');
        if (txtArea) txtArea.value = ''; 
        anexoPendente = null; 
        var prev = e('msgAnexoPrev');
        if (prev) prev.style.display = 'none';
        carregarConversa(false); carregarConversas();
      } else {
        var ej = await r.json().catch(function () { return {}; });
        alert('Erro ao enviar: ' + (ej.error || r.status));
      }
    } catch (err) { alert('Erro de conexão ao enviar.'); }
    if (btnEnv) btnEnv.disabled = false;
  }

  // --- Apagar / Editar mensagem (admin) ---
  window.chatApagarMsg = function (id) {
    if (!clienteAtivo) return;
    if (!confirm('Apagar esta mensagem? Não dá pra desfazer.')) return;
    fetch('/api/chat/' + encodeURIComponent(clienteAtivo) + '/mensagem/' + encodeURIComponent(id), { method: 'DELETE' })
      .then(function (r) { return r.json(); })
      .then(function () { carregarConversa(false); carregarConversas(); })
      .catch(function () { alert('Falha ao apagar.'); });
  };
  window.chatEditarMsg = function (id) {
    if (!clienteAtivo) return;
    var el = document.querySelector('.msg-bolha[data-mid="' + id + '"]');
    var atual = el ? (el.getAttribute('data-texto') || '') : '';
    atual = atual.replace(/&quot;/g, '"');
    var novo = prompt('Editar mensagem:', atual);
    if (novo === null) return;
    novo = novo.trim();
    if (!novo) { alert('A mensagem não pode ficar vazia. Para remover, use o apagar.'); return; }
    fetch('/api/chat/' + encodeURIComponent(clienteAtivo) + '/mensagem/' + encodeURIComponent(id), {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensagem: novo })
    }).then(function (r) { return r.json(); })
      .then(function () { carregarConversa(false); })
      .catch(function () { alert('Falha ao editar.'); });
  };

  // --- Soneca dos avisos por e-mail (config/chat_config) ---
  var chatCfg = {};
  function salvarChatCfg() {
    try { fetch('/api/config/chat_config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(chatCfg) }); } catch (err) {}
  }
  function atualizarSnoozeUI() {
    var st = e('chatSnoozeStatus'), reBtn = e('chatReativarBtn'), emailInp = e('chatEmailAlerta');
    var pausado = chatCfg.pausadoAte && new Date(chatCfg.pausadoAte).getTime() > Date.now();
    if (st) {
      if (pausado) {
        var d = new Date(chatCfg.pausadoAte);
        st.textContent = '🔕 Avisos por e-mail pausados até ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        st.style.color = '#b45309';
      } else { st.textContent = '🔔 Avisos por e-mail: ativos'; st.style.color = 'var(--ink-mid)'; }
    }
    if (reBtn) reBtn.style.display = pausado ? 'inline-block' : 'none';
    if (emailInp && document.activeElement !== emailInp) emailInp.value = chatCfg.email || '';
  }
  function carregarChatConfig() {
    fetch('/api/config/chat_config').then(function (r) { return r.json(); }).then(function (j) {
      chatCfg = (j && typeof j === 'object' && !Array.isArray(j)) ? j : {};
      atualizarSnoozeUI();
    }).catch(function () { chatCfg = {}; atualizarSnoozeUI(); });
  }
  window.chatPausarAvisos = function (horas) {
    chatCfg.pausadoAte = new Date(Date.now() + horas * 3600000).toISOString();
    salvarChatCfg(); atualizarSnoozeUI();
  };
  window.chatReativarAvisos = function () {
    chatCfg.pausadoAte = null; salvarChatCfg(); atualizarSnoozeUI();
  };
  window.chatSalvarEmailAlerta = function () {
    var inp = e('chatEmailAlerta'); if (!inp) return;
    chatCfg.email = (inp.value || '').trim();
    salvarChatCfg();
    inp.style.borderColor = '#16a34a'; setTimeout(function () { inp.style.borderColor = ''; }, 1200);
  };
  function injetarSnooze() {
    var page = document.getElementById('page-mensagens');
    if (!page || document.getElementById('chatSnoozeBar')) return;
    var bar = document.createElement('div');
    bar.id = 'chatSnoozeBar';
    bar.style.cssText = 'display:flex; flex-wrap:wrap; align-items:center; gap:10px; padding:11px 15px; background:#FFFDFA; border:1px solid rgba(196,163,90,.35); border-radius:12px; margin:0 0 14px 0; font-size:12.5px; color:var(--ink-mid);';
    var bs = 'cursor:pointer; border:1px solid rgba(196,163,90,.45); background:#fff; color:var(--ink-mid); border-radius:7px; font-size:12px; padding:5px 11px;';
    bar.innerHTML =
      '<span id="chatSnoozeStatus" style="font-weight:600;">🔔 Avisos por e-mail: ativos</span>'
      + '<span style="flex:1;"></span>'
      + '<span style="color:var(--ink-lt);">Pausar:</span>'
      + '<button onclick="window.chatPausarAvisos(1)" style="' + bs + '">1h</button>'
      + '<button onclick="window.chatPausarAvisos(3)" style="' + bs + '">3h</button>'
      + '<button onclick="window.chatPausarAvisos(8)" style="' + bs + '">8h</button>'
      + '<button id="chatReativarBtn" onclick="window.chatReativarAvisos()" style="' + bs + ' display:none; border-color:#16a34a; color:#16a34a;">🔔 Reativar agora</button>'
      + '<span style="width:100%; display:flex; gap:8px; align-items:center; margin-top:8px;">'
      +   '<label style="white-space:nowrap; color:var(--ink-lt);">E-mail que recebe o alerta:</label>'
      +   '<input id="chatEmailAlerta" type="email" placeholder="seu@gmail.com" style="flex:1; min-width:160px; padding:6px 9px; border:1px solid var(--border); border-radius:6px; font-size:12.5px;">'
      +   '<button onclick="window.chatSalvarEmailAlerta()" style="' + bs + '">Salvar</button>'
      + '</span>';
    page.insertBefore(bar, page.firstChild);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btnEnviar = e('msgEnviar');
    if (btnEnviar) btnEnviar.addEventListener('click', enviar);
    
    var btnAnexar = e('msgAnexar');
    if (btnAnexar) btnAnexar.addEventListener('click', function () { var fi = e('msgArquivo'); if (fi) fi.click(); });
    
    var inputArquivo = e('msgArquivo');
    if (inputArquivo) {
      inputArquivo.addEventListener('change', function () {
        var f = this.files[0]; if (!f) return;
        if (f.size > 15 * 1024 * 1024) { alert('Arquivo acima de 15 MB.'); return; }
        var fr = new FileReader();
        fr.onload = function () { anexoPendente = { nome: f.name, b64: fr.result }; var pv = e('msgAnexoPrev'); if (pv) { pv.style.display = 'block'; pv.textContent = '📎 ' + f.name + ' pronto para enviar'; } };
        fr.readAsDataURL(f);
        this.value = '';
      });
    }
    
    var msgTextoTxt = e('msgTexto');
    if (msgTextoTxt) {
      msgTextoTxt.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) {
          ev.preventDefault();
          enviar();
        }
      });
    }

    setTimeout(carregarConversas, 2500);
    setInterval(carregarConversas, 20000);
    injetarSnooze();
    carregarChatConfig();
    setInterval(atualizarSnoozeUI, 30000);
    
    document.addEventListener('click', function (ev) {
      var nav = ev.target.closest && ev.target.closest('[data-page="mensagens"]');
      if (nav) setTimeout(carregarConversas, 200);
    });
  });
})();
