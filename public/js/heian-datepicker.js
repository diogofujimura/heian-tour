/* Heian Tour - campo de data proprio: mostra/aceita dd/mm/aaaa em QUALQUER
   maquina (ignora o idioma do sistema) e abre calendario ao clicar.
   Por dentro guarda ISO (aaaa-mm-dd), o mesmo formato que o resto do app usa. */
(function(){
  if (window.__hdInit) return; window.__hdInit = true;

  var MESES=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  var DOW=['Dom','Seg','Ter','Qua','Qui','Sex','Sab'];

  function pad(n){return String(n).padStart(2,'0');}
  function isoToBR(iso){ if(!iso||!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''; var p=iso.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
  function brToIso(br){ var m=String(br||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if(!m) return ''; var d=+m[1],mo=+m[2],a=+m[3]; if(mo<1||mo>12||d<1||d>31||a<1900) return ''; return a+'-'+pad(mo)+'-'+pad(d); }
  function hojeIso(){ var t=new Date(); return t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate()); }
  window.hdIsoToBR = isoToBR;

  var IC='<svg class="hdate-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>';

  var css=
  '.hdate{position:relative;display:inline-block;vertical-align:middle;}'
  +'.hdate-field{display:inline-flex;align-items:center;gap:7px;background:#fff;border:1px solid rgba(107,31,42,.16);border-radius:8px;padding:6px 9px;cursor:pointer;user-select:none;transition:border-color .15s, box-shadow .15s;}'
  +'.hdate-field:hover{border-color:#C4A35A;}'
  +'.hdate-inp{border:none;outline:none;background:transparent;font-family:inherit;font-size:13px;font-weight:600;color:#1A1012;letter-spacing:.01em;padding:0;}'
  +'.hdate-inp::placeholder{color:#7A6568;font-weight:500;}'
  +'.hdate-ic{width:15px;height:15px;flex-shrink:0;color:#6B1F2A;pointer-events:none;}'
  +'.hdate.on-dark .hdate-field{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.4);}'
  +'.hdate.on-dark .hdate-inp{color:#fff;}'
  +'.hdate.on-dark .hdate-inp::placeholder{color:rgba(255,255,255,.7);}'
  +'.hdate.on-dark .hdate-ic{color:#fff;}'
  +'.hdate-cal{position:fixed;z-index:9999;background:#fff;border:1px solid rgba(107,31,42,.14);border-radius:14px;box-shadow:0 18px 44px rgba(61,15,22,.22);width:288px;padding:14px;font-family:Inter,system-ui,sans-serif;}'
  +'.hdate-caltop{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}'
  +'.hdate-nav{width:30px;height:30px;border:none;background:none;border-radius:8px;cursor:pointer;color:#6B1F2A;font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center;}'
  +'.hdate-nav:hover{background:rgba(196,163,90,.16);}'
  +'.hdate-mes{font-family:"Plus Jakarta Sans",Inter,sans-serif;font-weight:600;font-size:14px;color:#6B1F2A;text-transform:capitalize;}'
  +'.hdate-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}'
  +'.hdate-dow{font-size:10px;font-weight:700;color:#7A6568;text-align:center;padding:3px 0;text-transform:uppercase;}'
  +'.hdate-d{height:33px;border:none;background:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:13px;color:#1A1012;display:flex;align-items:center;justify-content:center;}'
  +'.hdate-d:hover{background:rgba(196,163,90,.18);}'
  +'.hdate-d.vazio{cursor:default;}'
  +'.hdate-d.hoje{box-shadow:inset 0 0 0 1.5px #C4A35A;font-weight:600;}'
  +'.hdate-d.sel{background:#6B1F2A;color:#fff;font-weight:600;}'
  +'.hdate-d.sel:hover{background:#3D0F16;}'
  +'.hdate-calfoot{margin-top:8px;padding-top:8px;border-top:1px solid rgba(107,31,42,.12);display:flex;justify-content:flex-end;}'
  +'.hdate-hoje{border:none;background:none;color:#6B1F2A;font-family:inherit;font-weight:600;font-size:12.5px;cursor:pointer;padding:4px 8px;border-radius:6px;}'
  +'.hdate-hoje:hover{background:rgba(107,31,42,.07);}';
  var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);

  // markup de um campo (usado nos templates do roteiro)
  window.hdField = function(iso, dataAttrs, onDark, hint){
    var br=isoToBR(iso||'');
    var _h=(hint && hint.length===10 && hint.charAt(4)==='-') ? ' data-hd-hint="'+hint+'"' : '';
    return '<span class="hdate'+(onDark?' on-dark':'')+'">'
      +'<span class="hdate-field" onclick="if(event.target.tagName!==\'INPUT\'){var i=this.querySelector(\'.hdate-inp\'); i.focus(); hdOpen(i);}">'
      +'<input type="text" class="hdate-inp" inputmode="numeric" maxlength="10" size="11" placeholder="dd/mm/aaaa" value="'+br+'" data-hd-cur="'+(iso||'')+'"'+_h+' '+(dataAttrs||'')
      +' oninput="hdMask(this)" onchange="hdCommit(this)" onfocus="hdOpen(this)" onclick="hdOpen(this)">'
      +IC+'</span></span>';
  };

  var cal=null, ativo=null, vy=0, vm=0;
  function ensureCal(){
    if(cal) return;
    cal=document.createElement('div'); cal.className='hdate-cal'; cal.style.display='none';
    document.body.appendChild(cal);
    cal.addEventListener('mousedown', function(e){ e.preventDefault(); });
    cal.addEventListener('click', onCalClick);
  }
  function renderCal(){
    var iso = ativo ? (brToIso(ativo.value)|| ativo.getAttribute('data-hd-cur')||'') : '';
    var inicio=new Date(vy,vm,1).getDay(), ndias=new Date(vy,vm+1,0).getDate();
    var cels='';
    for(var i=0;i<7;i++) cels+='<div class="hdate-dow">'+DOW[i]+'</div>';
    for(var b=0;b<inicio;b++) cels+='<div class="hdate-d vazio"></div>';
    for(var d=1;d<=ndias;d++){
      var ii=vy+'-'+pad(vm+1)+'-'+pad(d), c='hdate-d';
      if(ii===hojeIso()) c+=' hoje';
      if(ii===iso) c+=' sel';
      cels+='<button type="button" class="'+c+'" data-d="'+ii+'">'+d+'</button>';
    }
    cal.innerHTML='<div class="hdate-caltop"><button type="button" class="hdate-nav" data-nav="-1">‹</button>'
      +'<div class="hdate-mes">'+MESES[vm]+' '+vy+'</div>'
      +'<button type="button" class="hdate-nav" data-nav="1">›</button></div>'
      +'<div class="hdate-grid">'+cels+'</div>'
      +'<div class="hdate-calfoot"><button type="button" class="hdate-hoje">Hoje</button></div>';
  }
  window.hdOpen=function(inp){
    if(!inp) return;
    ensureCal(); ativo=inp;
    var iso=brToIso(inp.value)||inp.getAttribute('data-hd-cur')||inp.getAttribute('data-hd-hint')||hojeIso();
    vy=+iso.slice(0,4); vm=+iso.slice(5,7)-1;
    renderCal();
    var r=inp.getBoundingClientRect();
    cal.style.top=(r.bottom+6)+'px';
    var left=r.left; if(left+300>window.innerWidth) left=window.innerWidth-300;
    cal.style.left=Math.max(8,left)+'px';
    cal.style.display='block';
  };
  function fechar(){ if(cal) cal.style.display='none'; ativo=null; }
  function onCalClick(e){
    var nav=e.target.closest('[data-nav]');
    if(nav){ vm+=+nav.getAttribute('data-nav'); if(vm<0){vm=11;vy--;} if(vm>11){vm=0;vy++;} renderCal(); return; }
    if(e.target.classList.contains('hdate-hoje')){ pick(hojeIso()); return; }
    var dd=e.target.closest('.hdate-d[data-d]'); if(dd) pick(dd.getAttribute('data-d'));
  }
  function pick(iso){
    if(!ativo) return;
    ativo.value=isoToBR(iso); ativo.setAttribute('data-hd-cur',iso);
    dispatch(ativo, iso); fechar();
  }
  window.hdMask=function(inp){
    var v=inp.value.replace(/\D/g,'').slice(0,8);
    if(v.length>=5) v=v.slice(0,2)+'/'+v.slice(2,4)+'/'+v.slice(4);
    else if(v.length>=3) v=v.slice(0,2)+'/'+v.slice(2);
    inp.value=v;
    var iso=brToIso(v);
    if(iso && cal && cal.style.display==='block' && ativo===inp){ vy=+iso.slice(0,4); vm=+iso.slice(5,7)-1; renderCal(); }
  };
  window.hdCommit=function(inp){
    if(inp.value.trim()===''){ inp.setAttribute('data-hd-cur',''); dispatch(inp,''); return; }
    var iso=brToIso(inp.value);
    if(iso){ inp.setAttribute('data-hd-cur',iso); inp.value=isoToBR(iso); dispatch(inp,iso); }
    else { inp.value=isoToBR(inp.getAttribute('data-hd-cur')||''); }
  };
  function dispatch(inp, iso){
    var t=inp.getAttribute('data-hd');
    var idr=inp.getAttribute('data-hd-id');
    try{
      if(t==='dia' && typeof updDiaEdit==='function'){ updDiaEdit(+inp.getAttribute('data-hd-idx'),'data',iso); rtSave(); }
      else if(t==='tour' && typeof updElementoEdit==='function'){ updElementoEdit(+inp.getAttribute('data-hd-idx'),+inp.getAttribute('data-hd-eidx'),'dataDoTour',iso); rtSave(); }
      else if(t==='estadia' && typeof updRotEstadia==='function'){ var id=(idr!==''&&!isNaN(idr))?Number(idr):idr; updRotEstadia(id,inp.getAttribute('data-hd-f'),iso); rtSave(); }
      else if(t==='cot-estadia' && typeof updEstadia==='function') updEstadia(idr,inp.getAttribute('data-hd-f'),iso);
      else if(t==='cot-tour' && typeof updTourField==='function') updTourField(Number(idr),'data',iso);
      else if(t==='cot-transp' && typeof updTranspField==='function') updTranspField(Number(idr),'data',iso);
      else if(t==='cot-exp' && typeof updExpField==='function') updExpField(Number(idr),'data',iso);
    }catch(e){ console.error('hdate dispatch', e); }
  }
  function rtSave(){ if(typeof window.autoSaveRoteiro==='function') window.autoSaveRoteiro(); }
  document.addEventListener('click', function(e){
    if(!cal || cal.style.display==='none') return;
    if(e.target.closest('.hdate-cal')) return;
    if(e.target.closest('.hdate')) return;
    fechar();
  });
  window.addEventListener('scroll', function(){ if(cal&&cal.style.display==='block') fechar(); }, true);
  window.addEventListener('resize', function(){ if(cal&&cal.style.display==='block') fechar(); });
})();
