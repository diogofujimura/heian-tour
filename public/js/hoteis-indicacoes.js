// ── GESTÃO: Indicações de Hotéis (aba na Base de Dados) ─────────────────────
// Base client-facing separada. CRUD via /api/hoteis-indicacoes. Carregado após app.js.
(function () {
  'use strict';
  var CATS = ['Ultra-luxo', 'Luxo', 'Boutique', 'Ryokan', 'Custo-benefício', 'Lifestyle/Moderno'];
  window.indicacoesDB = window.indicacoesDB || [];

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function estrelasTxt(n) { n = parseInt(n) || 0; return n > 0 ? '★'.repeat(n) : '—'; }

  async function carregar() {
    try { window.indicacoesDB = await fetch('/api/hoteis-indicacoes').then(function (r) { return r.json(); }); }
    catch (e) { window.indicacoesDB = []; }
    if (!Array.isArray(window.indicacoesDB)) window.indicacoesDB = [];
    render();
  }

  function render(filtro) {
    var tbody = document.querySelector('#tabelaIndicacoes tbody');
    if (!tbody) return;
    if (filtro === undefined) { var el = document.getElementById('searchIndicacao'); filtro = el ? el.value : ''; }
    var f = (filtro || '').toLowerCase();
    var lista = window.indicacoesDB || [];
    if (f) lista = lista.filter(function (h) { return [h.nome, h.cidade, h.bairro, h.categoria, h.descricao].join(' ').toLowerCase().indexOf(f) > -1; });

    var rowFn = function (h) {
      var links = '';
      if (h.maps) links += '<a href="' + esc(h.maps) + '" target="_blank" style="color:var(--crimson);text-decoration:underline;">Maps</a>';
      if (h.maps && h.site) links += ' · ';
      if (h.site) links += '<a href="' + esc(h.site) + '" target="_blank" style="color:var(--crimson);text-decoration:underline;">Site</a>';
      if (!links) links = '—';
      var descFull = h.descricao || '';
      var desc = esc(descFull.slice(0, 90)) + (descFull.length > 90 ? '…' : '');
      return '<tr>' +
        '<td>' + esc(h.cidade || '') + '</td>' +
        '<td><a href="#" class="ind-nome-link" onclick="window.previewIndicacaoCliente(\'' + h.id + '\');return false;" title="Ver como o cliente vê">' + esc(h.nome || '') + '</a>' + (h.ativo === false ? ' <span style="color:#999;font-size:10px;">(oculto)</span>' : '') + '</td>' +
        '<td style="color:var(--gold-dk);white-space:nowrap;">' + estrelasTxt(h.estrelas) + '</td>' +
        '<td>' + esc(h.categoria || '—') + '</td>' +
        '<td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + esc(descFull) + '">' + desc + '</td>' +
        '<td style="white-space:nowrap;">' + links + '</td>' +
        '<td><button class="btn-icon" onclick="editarIndicacao(\'' + h.id + '\')" title="Editar"><svg class="v-icon no-margin"><use href="#icon-edit"></use></svg></button> ' +
        '<button class="btn-icon" onclick="deletarIndicacao(\'' + h.id + '\')" title="Excluir"><svg class="v-icon no-margin" style="stroke:#c00;"><use href="#icon-trash"></use></svg></button></td>' +
        '</tr>';
    };

    var vazio = '<tr><td colspan="7" style="text-align:center;color:#999;padding:24px;">Nenhuma indicação ainda. Clique em "+ Nova Indicação".</td></tr>';
    if (typeof _agrupaBaseCidade === 'function' && lista.length) {
      tbody.innerHTML = _agrupaBaseCidade(lista, function (x) { return x.cidade; }, 7, rowFn) || vazio;
    } else {
      tbody.innerHTML = lista.length ? lista.map(rowFn).join('') : vazio;
    }
  }
  window.renderTabelaIndicacoes = render;

  // ── Prévia: como o hotel aparece pro CLIENTE (aditivo, não altera editar/excluir) ──
  (function(){ try{ if(document.getElementById && !document.getElementById('indNomeLinkStyle')){ var st=document.createElement('style'); st.id='indNomeLinkStyle'; st.textContent='.ind-nome-link{color:var(--crimson);font-weight:700;text-decoration:none;cursor:pointer;} .ind-nome-link:hover{text-decoration:underline;}'; (document.head||document.documentElement).appendChild(st);} }catch(e){} })();

  function buildPreviewCard(h){
    var fs = Array.isArray(h.fotos)?h.fotos.filter(Boolean):(h.fotos?[h.fotos]:[]);
    var ini = (h.nome||'?').trim().charAt(0).toUpperCase();
    var st = parseInt(h.estrelas)||0; var starsStr = st>0 ? '★★★★★'.slice(0,st) : '';
    var hero = fs.length
      ? '<img id="mpHero" src="'+esc(fs[0])+'" alt="'+esc(h.nome)+'" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentNode.style.background=\'linear-gradient(135deg,#6B1F2A,#3D0F16)\';this.outerHTML=\'<div style=&quot;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.9);font-family:Plus Jakarta Sans;font-weight:600;font-size:56px;&quot;>'+esc(ini)+'</div>\';">'
      : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.9);font-family:Plus Jakarta Sans;font-weight:600;font-size:56px;">'+esc(ini)+'</div>';
    var heroBg = fs.length ? '#eee' : 'linear-gradient(135deg,#6B1F2A,#3D0F16)';
    var thumbs = fs.length>1 ? '<div style="display:flex;gap:8px;padding:12px 22px 0;overflow-x:auto;">'+
      fs.map(function(u,i){return '<img src="'+esc(u)+'" referrerpolicy="no-referrer" onclick="var hero=document.getElementById(\'mpHero\'); if(hero) hero.src=this.src;" style="width:74px;height:56px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid '+(i===0?'#C4A35A':'transparent')+';flex-shrink:0;opacity:'+(i===0?1:0.65)+';">';}).join('')+'</div>' : '';
    var loc = [h.bairro,h.cidade].filter(Boolean).map(esc).join(' · ');
    var tags = (Array.isArray(h.tags)?h.tags:[]).filter(Boolean);
    var acts = '';
    if(h.maps) acts += '<a href="'+esc(h.maps)+'" target="_blank" rel="noopener" style="flex:1;min-width:140px;text-align:center;padding:12px 16px;border-radius:10px;font-family:Plus Jakarta Sans;font-weight:600;font-size:13.5px;text-decoration:none;background:linear-gradient(135deg,#8a2836,#6B1F2A);color:#fff;">Ver no Google Maps</a>';
    if(h.site) acts += '<a href="'+esc(h.site)+'" target="_blank" rel="noopener" style="flex:1;min-width:140px;text-align:center;padding:12px 16px;border-radius:10px;font-family:Plus Jakarta Sans;font-weight:600;font-size:13.5px;text-decoration:none;background:#fff;color:#6B1F2A;border:1px solid rgba(107,31,42,.2);">Site oficial</a>';
    return '<div style="position:relative;aspect-ratio:16/9;overflow:hidden;background:'+heroBg+';">'+hero+
      (h.categoria?'<span style="position:absolute;top:12px;left:12px;background:rgba(252,250,247,.94);color:#6B1F2A;font-family:Plus Jakarta Sans;font-size:11px;font-weight:600;letter-spacing:.03em;padding:5px 11px;border-radius:99px;box-shadow:0 2px 8px rgba(0,0,0,.12);">'+esc(h.categoria)+'</span>':'')+
      '<span style="position:absolute;top:12px;right:12px;background:rgba(196,163,90,.95);color:#3D0F16;font-family:Inter;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 10px;border-radius:99px;">Prévia · visão do cliente</span>'+
    '</div>'+thumbs+
    '<div style="padding:20px 24px 4px;">'+
      '<h2 style="font-family:Plus Jakarta Sans;font-weight:600;font-size:24px;color:#6B1F2A;margin:0;line-height:1.15;">'+esc(h.nome||'')+'</h2>'+
      (starsStr?'<div style="color:#C4A35A;font-size:15px;letter-spacing:2px;margin:8px 0 3px;">'+starsStr+'</div>':'')+
      (loc?'<div style="color:#7A6568;font-size:13.5px;font-weight:500;margin-bottom:14px;">'+loc+'</div>':'')+
      (h.descricao?'<div style="color:#1A1012;font-size:14.5px;line-height:1.65;white-space:pre-wrap;">'+esc(h.descricao)+'</div>':'')+
      (tags.length?'<div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:16px;">'+tags.map(function(t){return '<span style="font-size:12px;color:#3A282B;background:rgba(196,163,90,.14);padding:5px 12px;border-radius:99px;font-weight:500;">'+esc(t)+'</span>';}).join('')+'</div>':'')+
      (acts?'<div style="display:flex;gap:12px;margin-top:22px;flex-wrap:wrap;">'+acts+'</div>':'')+
    '</div>';
  }

  function previewCliente(id){
    var h = (window.indicacoesDB||[]).find(function(x){return String(x.id)===String(id);});
    if(!h) return;
    var mc = document.getElementById('modalContent'); if(!mc) return;
    mc.innerHTML = '<h3 class="modal-title">Prévia — como o cliente vê</h3>'+
      '<div style="border-radius:16px;overflow:hidden;border:1px solid rgba(107,31,42,.12);box-shadow:0 10px 30px rgba(61,15,22,.08);">'+buildPreviewCard(h)+'</div>'+
      '<div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Fechar</button>'+
      '<button class="btn-primary" onclick="closeModal(); if(window.editarIndicacao) window.editarIndicacao(\''+String(id).replace(/\x27/g,'')+'\')">Editar este hotel</button></div>';
    if(typeof openModal==='function') openModal();
  }
  window.previewIndicacaoCliente = previewCliente;

  function abrirModal(id) {
    var h = id ? ((window.indicacoesDB || []).find(function (x) { return String(x.id) === String(id); }) || {}) : {};
    var catOpts = CATS.map(function (c) { return '<option value="' + c + '"' + (h.categoria === c ? ' selected' : '') + '>' + c + '</option>'; }).join('');
    var fArr = Array.isArray(h.fotos) ? h.fotos.filter(Boolean) : (h.fotos ? [h.fotos] : []);
    var tags = Array.isArray(h.tags) ? h.tags.join(', ') : (h.tags || '');
    document.getElementById('modalContent').innerHTML =
      '<h3 class="modal-title">' + (id ? 'Editar' : 'Nova') + ' Indicação de Hotel</h3>' +
      '<div class="form-grid">' +
        '<div class="field"><label>Nome do Hotel</label><input id="mi_nome" value="' + esc(h.nome || '') + '"></div>' +
        '<div class="field"><label>Cidade</label><input id="mi_cidade" value="' + esc(h.cidade || '') + '"></div>' +
        '<div class="field"><label>Bairro</label><input id="mi_bairro" value="' + esc(h.bairro || '') + '"></div>' +
        '<div class="field"><label>Estrelas (1–5, opcional)</label><input type="number" min="1" max="5" id="mi_estrelas" value="' + esc(h.estrelas || '') + '"></div>' +
        '<div class="field"><label>Categoria</label><select id="mi_categoria"><option value="">—</option>' + catOpts + '</select></div>' +
        '<div class="field"><label>Tags (vírgula)</label><input id="mi_tags" value="' + esc(tags) + '"></div>' +
        '<div class="field full-width"><label>Descrição (o que tem de bom + ponto de atenção)</label><textarea id="mi_descricao" rows="4">' + esc(h.descricao || '') + '</textarea></div>' +
        '<div class="field full-width"><label>Fotos (na ordem em que aparecem — a 1ª é a capa)</label>' +
          '<input id="mi_foto1" placeholder="URL da foto 1 (capa)" value="' + esc(fArr[0] || '') + '" style="display:block;width:100%;margin-bottom:8px;">' +
          '<input id="mi_foto2" placeholder="URL da foto 2" value="' + esc(fArr[1] || '') + '" style="display:block;width:100%;margin-bottom:8px;">' +
          '<input id="mi_foto3" placeholder="URL da foto 3" value="' + esc(fArr[2] || '') + '" style="display:block;width:100%;">' +
        '</div>' +
        '<div class="field"><label>Link do Google Maps</label><input id="mi_maps" value="' + esc(h.maps || '') + '"></div>' +
        '<div class="field"><label>Site oficial</label><input id="mi_site" value="' + esc(h.site || '') + '"></div>' +
        '<div class="field full-width"><label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;font-weight:normal;"><input type="checkbox" id="mi_ativo"' + (h.ativo !== false ? ' checked' : '') + '> Mostrar na página de indicações (ativo)</label></div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn-secondary" onclick="closeModal()">Cancelar</button>' +
      '<button class="btn-primary" onclick="salvarIndicacao(' + (id ? "'" + id + "'" : 'null') + ')">Salvar</button></div>';
    if (typeof openModal === 'function') openModal();
  }
  window.editarIndicacao = abrirModal;

  async function salvar(id) {
    var g = function (i) { return document.getElementById(i); };
    var dados = {
      nome: g('mi_nome').value.trim(), cidade: g('mi_cidade').value.trim(), bairro: g('mi_bairro').value.trim(),
      estrelas: g('mi_estrelas').value ? parseInt(g('mi_estrelas').value) : '',
      categoria: g('mi_categoria').value, descricao: g('mi_descricao').value.trim(),
      fotos: [g('mi_foto1').value, g('mi_foto2').value, g('mi_foto3').value].map(function (s) { return (s || '').trim(); }).filter(Boolean),
      maps: g('mi_maps').value.trim(), site: g('mi_site').value.trim(),
      tags: (g('mi_tags').value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
      ativo: g('mi_ativo').checked
    };
    if (!dados.nome) { alert('Informe o nome do hotel.'); return; }
    try {
      var url = id ? '/api/hoteis-indicacoes/' + encodeURIComponent(id) : '/api/hoteis-indicacoes';
      await fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
      if (typeof closeModal === 'function') closeModal();
      await carregar();
    } catch (e) { alert('Erro ao salvar: ' + e.message); }
  }
  window.salvarIndicacao = salvar;

  async function deletar(id) {
    if (!confirm('Remover esta indicação?')) return;
    try { await fetch('/api/hoteis-indicacoes/' + encodeURIComponent(id), { method: 'DELETE' }); await carregar(); }
    catch (e) { alert('Erro ao remover: ' + e.message); }
  }
  window.deletarIndicacao = deletar;

  function init() {
    var s = document.getElementById('searchIndicacao');
    if (s && !s.__wiredInd) { s.__wiredInd = 1; s.addEventListener('input', function (e) { render(e.target.value); }); }
    var b = document.getElementById('btnNovaIndicacao');
    if (b && !b.__wiredInd) { b.__wiredInd = 1; b.addEventListener('click', function () { abrirModal(null); }); }
    if (document.getElementById('tabelaIndicacoes')) carregar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  setTimeout(init, 1500);
})();
