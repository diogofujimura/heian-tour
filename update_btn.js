const fs = require('fs');
let js = fs.readFileSync('public/js/roteiros.js', 'utf8');
const lines = js.split('\n');

const start = lines.findIndex(l => l.includes("document.getElementById('btnGerarRoteiro').addEventListener('click'"));
const end = lines.findIndex(l => l.includes("document.getElementById('btnCancelarEdicaoRoteiro').addEventListener('click'"));

if (start === -1 || end === -1) {
  console.log("Could not find start or end bounds.");
  process.exit(1);
}

const replacement = `  document.getElementById('btnGerarRoteiro').addEventListener('click', () => {
    try {
      let nome = document.getElementById('selectRoteiroBase').value;
      const roteiroEditContainer = document.getElementById('roteiroEditContainer');
      const isEditMode = roteiroEditContainer && roteiroEditContainer.style.display !== 'none';
      
      if (isEditMode) {
         const editorName = document.getElementById('editRoteiroNome').value.trim();
         if (editorName) nome = editorName;
      }

      if (!nome && !isEditMode) {
        alert("Selecione um roteiro primeiro.");
        return;
      }
      
      const previewCont = document.getElementById('previewContainer');
      if (!previewCont) {
        alert("Erro: Elemento de preview não encontrado.");
        return;
      }

      let cliente = {};
      let diasArray = [];
      let nomeParaExibir = nome || 'Pré-visualização';
      
      if (isEditMode && typeof roteiroEmEdicao !== 'undefined') {
          if (roteiroEmEdicao.cliente) cliente = roteiroEmEdicao.cliente;
          if (roteiroEmEdicao.dias) diasArray = roteiroEmEdicao.dias;
          nomeParaExibir = document.getElementById('editRoteiroNome').value || 'Pré-visualização';
      } else if (dbRotas[nome]) {
          if (dbRotas[nome].cliente) cliente = dbRotas[nome].cliente;
          diasArray = Array.isArray(dbRotas[nome]) ? dbRotas[nome] : (dbRotas[nome].dias || []);
          nomeParaExibir = nome;
      }

      const formatPeriodo = (d1, d2) => {
        if (!d1 && !d2) return '';
        const f1 = d1 ? d1.split('-').reverse().slice(0, 2).join('/') : '';
        const f2 = d2 ? d2.split('-').reverse().slice(0, 2).join('/') : '';
        if (f1 && f2) return \`\${f1} a \${f2}\`;
        return f1 || f2;
      };

      const txtPessoas = (cliente.adultos ? \`\${cliente.adultos} Adultos\` : '') + (cliente.criancas > 0 ? \`, \${cliente.criancas} Crianças\` : '');
      
      const diasHtml = diasArray.map((diaOrig, index) => {
        const dia = migrarDiaParaNovaEstrutura(diaOrig);
        
        const temDeslocamento = dia.elementos.some(el => el.tipo === 'transporte');
        const temExperiencia = dia.elementos.some(el => el.tipo === 'experiencia');
        
        const badgeGuiado = dia.tourGuiado ? \`<span class="badge" style="background:var(--gold); color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:8px; vertical-align:middle; display:inline-flex; align-items:center;">⭐ Tour Guiado</span>\` : '';
        const badgeDeslocamento = temDeslocamento ? \`<span class="badge" style="background:#2196F3; color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; vertical-align:middle; display:inline-flex; align-items:center;">🚆 Deslocamento</span>\` : '';
        const badgeExperiencia = temExperiencia ? \`<span class="badge" style="background:var(--crimson); color:white; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px; vertical-align:middle; display:inline-flex; align-items:center; border: 1px solid rgba(255,255,255,0.4);">🎫 Experiência</span>\` : '';
        
        let elementosHtml = dia.elementos.map((el, eIdx) => {
          if (el.tipo === 'info') {
            const parts = [];
            if (el.dataDoTour) {
              const d = new Date(el.dataDoTour);
              parts.push(\`📅 \${isNaN(d) ? el.dataDoTour : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}\`);
            }
            if (el.horarioEncontro) parts.push(\`🕒 \${el.horarioEncontro}\`);
            if (el.duracaoTour) parts.push(\`⏳ \${el.duracaoTour}\`);
            if (el.localEncontro) parts.push(\`📍 \${el.localEncontro}\`);
            if (parts.length > 0) return \`<div style="font-size:12px; color:var(--text-sec); margin-bottom:12px; font-weight:500; background:#f9f9f9; padding:6px 12px; border-radius:4px; display:inline-block">\${parts.join(' &nbsp;|&nbsp; ')}</div>\`;
            return '';
          } else if (el.tipo === 'texto') {
            return el.conteudo ? \`<div style="font-size:13px; color:var(--text-main); margin-bottom:16px; line-height:1.6; white-space:pre-wrap; border-left:3px solid var(--gold-lt); padding-left:12px; font-style:italic">\${el.conteudo}</div>\` : '';
          } else if (el.tipo === 'sequencia') {
            const tituloRota = el.nomeDaRota || 'Sequência';
            const cidadeText = el.cidade ? \`<span style="color:var(--gold-dk); font-weight:600; font-size:11px; text-transform:uppercase; margin-right:8px">\${el.cidade}</span>\` : '';
            const incluirDesc = document.getElementById('chkIncluirDescricoesPdf')?.checked;
            
            let atracoesHTML = '';
            if (incluirDesc && el.atracoesDoDia) {
              atracoesHTML = '<div style="display:flex; flex-direction:column; gap:8px; border-left:2px solid var(--gold-lt); padding-left:12px; margin-left:6px;">';
              el.atracoesDoDia.forEach((atrNome) => {
                const atr = window.atracaoMap ? window.atracaoMap.get(atrNome.toLowerCase()) : null;
                const desc = atr ? (atr['Descrição Detalhada'] || '') : '';
                if (desc) atracoesHTML += \`<div style="font-size:11px; color:var(--text-sec); margin-top:2px"><strong style="color:var(--gold-dk)">\${atrNome}</strong><br>\${desc}</div>\`;
                else atracoesHTML += \`<div style="font-size:11px; color:var(--text-sec); margin-top:2px; font-weight:bold">\${atrNome}</div>\`;
              });
              atracoesHTML += '</div>';
            } else if (el.atracoesDoDia) {
               atracoesHTML = \`<div style="font-size:12px; color:var(--text-sec); margin-top:4px; border-left:2px solid var(--gold-lt); padding-left:10px;">\${el.atracoesDoDia.join(' + ')}</div>\`;
            }
            
            return \`<div style="margin-bottom:16px">
              <div style="font-size:11px; font-weight:bold; color:var(--gold-dk); text-transform:uppercase; letter-spacing:0.1em; display:flex; align-items:center; margin-bottom:4px">
                \${cidadeText}\${tituloRota}
              </div>
              \${atracoesHTML}
            </div>\`;
          } else if (el.tipo === 'transporte') {
            const origem = el.cidadeOrigem || 'Origem';
            const destino = el.cidadeDestino || 'Destino';
            const transpNome = el.tipoTransporte ? \`\${el.tipoTransporte} (\${el.linha})\` : 'Deslocamento a definir';
            const ctg = el.categoria ? \` - \${el.categoria}\` : '';
            const duracao = el.tempo ? \` <span style="color:var(--gold-dk); font-weight:bold;">[⏱ \${el.tempo}]</span>\` : '';
            const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : ''); const pss = pText ? \` - \${pText}\` : '';
            const h = el.horario ? \`\${el.horario}\` : '';
            const horaText = h ? \`<span style="color:#000; font-weight:bold; font-size:14px; margin-left:8px;">\${h}</span>\` : '';
            
            return \`
              <div style="margin-bottom:16px; border-left:4px solid #2196F3; padding-left:12px; background:linear-gradient(to right, rgba(33,150,243,0.06), transparent); padding-top:8px; padding-bottom:8px; border-radius:8px">
                <div style="margin-bottom:4px; display:flex; align-items:center">
                  <strong style="color:#1565C0; font-size:12px; text-transform:uppercase; margin-right:8px">Deslocamento \${horaText}</strong>
                </div>
                <div style="font-size:13px; color:var(--text-main); font-weight:600">\${origem} ➔ \${destino}</div>
                <div style="font-size:11px; color:var(--text-sec); margin-top:2px">\${transpNome}\${ctg}\${duracao}\${pss} \${el.compradoHeian !== false ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em">✅ Emitido p/ Heian</span>' : ''}</div>
              </div>\`;
          } else if (el.tipo === 'experiencia') {
            const pText = window.formatarPessoas ? window.formatarPessoas(el) : (el.adultos ? el.adultos + ' Adultos' : ''); const p = pText ? (el.horaPartida ? \` &nbsp;|&nbsp; 👥 \${pText}\` : \`👥 \${pText}\`) : '';
            const h = el.horaPartida ? \`<span style="color:#000; font-weight:bold; font-size:14px; margin-right:8px;">\${el.horaPartida}</span>\` : '';
            return \`
              <div style="margin-bottom:16px; border-left:4px solid var(--crimson); padding-left:12px; background:linear-gradient(to right, rgba(220,53,69,0.06), transparent); padding-top:8px; padding-bottom:8px; border-radius:8px">
                <div style="margin-bottom:4px; display:flex; align-items:center">
                  <strong style="color:var(--crimson); font-size:12px; text-transform:uppercase; margin-right:8px">Tickets & Experiências</strong>
                </div>
                <div style="font-size:13px; color:var(--text-main); font-weight:600">\${el.nomeExp || 'Experiência a definir'}</div>
                <div style="font-size:11px; color:var(--text-sec); margin-top:2px">\${h}\${p} \${el.compradoHeian !== false ? '<span style="font-size:9px; background:var(--gold); color:white; padding:2px 6px; border-radius:4px; margin-left:4px; text-transform:uppercase; letter-spacing:0.05em">✅ Emitido p/ Heian</span>' : ''}</div>
              </div>\`;
          }
          return '';
        }).join('');
        
        let dataText = '';
        if (dia.data) {
          const [yy, mm, dd] = dia.data.split('-');
          const dateObj = new Date(yy, mm - 1, dd);
          const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
          dataText = \` - \${dd}/\${mm}/\${yy} (\${diasSemana[dateObj.getDay()]})\`;
        }
  
        return \`
          <div class="dia-card">
            <div class="dia-header" style="flex-direction:column; align-items:flex-start; background: linear-gradient(to right, rgba(220,53,69,0.08), transparent); padding: 8px 12px; border-radius: 6px; border-left: 4px solid var(--crimson); margin-bottom: 16px;">
              <div style="margin-bottom:0px; display:flex; align-items:center; flex-wrap:wrap;">
                <span class="dia-numero" style="font-size:20px; font-weight:800; margin-right:8px; color:var(--crimson)">Dia \${dia.numeroDia || (index + 1)}\${dataText}</span>
                \${badgeGuiado}
                \${badgeDeslocamento}
                \${badgeExperiencia}
              </div>
            </div>
            \${elementosHtml}
          </div>
        \`;
      }).join('');

      previewCont.innerHTML = \`
        <div class="pdf-doc">
          <div class="pdf-cover">
            <img src="/assets/logo.png" class="pdf-cover-logo" alt="Heian Tour" onerror="this.style.display='none'">
            <div class="pdf-cover-divider"></div>
            <div class="pdf-cover-label">Roteiro de Viagem</div>
            <div class="pdf-cover-title">\${nomeParaExibir}</div>
            \${Object.keys(cliente).length > 0 ? \`<div class="pdf-cover-meta">
              \${formatPeriodo(cliente.dataOrcamento, cliente.dataFim) ? \`<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Período</div><div class="pdf-cover-meta-value">\${formatPeriodo(cliente.dataOrcamento, cliente.dataFim)}</div></div>\` : ''}
              
              \${txtPessoas ? \`<div class="pdf-cover-meta-item"><div class="pdf-cover-meta-label">Passageiros</div><div class="pdf-cover-meta-value">\${txtPessoas}</div></div>\` : ''}
            </div>\` : ''}
          </div>
          <div class="pdf-body">
            <div style="background:white; border-radius:8px; padding:30px; box-shadow:0 10px 30px rgba(0,0,0,0.05)">
              
              \${(cliente.estadias && cliente.estadias.length > 0) ? \`<div class="pdf-section" style="margin-bottom:30px">
                <div class="pdf-section-header" style="margin-bottom:16px"><div class="pdf-section-dot"></div><div class="pdf-section-title">Estadias</div></div>
                <div class="pdf-estadias-grid">
                  \${cliente.estadias.map(e => {
                    const f1 = e.dataInicio ? e.dataInicio.split('-').reverse().slice(0, 2).join('/') : '';
                    const f2 = e.dataFim ? e.dataFim.split('-').reverse().slice(0, 2).join('/') : '';
                    const per = (f1 && f2) ? \`\${f1} - \${f2}\` : f1 || f2 || '';
                    return \`<div class="pdf-estadia-item"><div class="pdf-estadia-cidade">\${e.cidade||'-'}</div>\${per?\`<div class="pdf-estadia-datas">\${per}</div>\`:\`\`} \${e.hotel?\`<div class="pdf-estadia-hotel">\${e.hotel}</div>\`:\`\`}</div>\`;
                  }).join('')}
                </div>
              </div>\` : ''}
              \${(cliente.vooChegada || cliente.vooPartida) ? \`<div style="display:flex; justify-content:space-between; background:var(--bg); border:1px solid #eaeaea; border-radius:8px; padding:20px; margin-bottom:30px;">
                \${cliente.vooChegada ? \`<div style="flex:1"><div style="font-size:10px; color:var(--gold-dk); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px">Voo de Chegada</div><div style="font-size:14px; color:var(--ink); font-weight:500">\${cliente.vooChegada}</div></div>\` : ''}
                \${cliente.vooPartida ? \`<div style="flex:1; padding-left:20px; border-left:1px solid #eaeaea"><div style="font-size:10px; color:var(--gold-dk); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:4px">Voo de Partida</div><div style="font-size:14px; color:var(--ink); font-weight:500">\${cliente.vooPartida}</div></div>\` : ''}
              </div>\` : ''}
              
              <div class="roteiro-timeline" style="border-left: 2px solid rgba(201,160,90,0.3); padding-left: 20px;">
                \${diasHtml}
              </div>
            </div>
          </div>
        </div>
      \`;
      
      document.getElementById('previewOverlay').classList.remove('hidden');
      document.body.style.overflow = 'hidden';
      
      if (typeof attachChipEvents === 'function') attachChipEvents();
    } catch(e) { alert("ERRO AO GERAR ROTEIRO: " + e.message); console.error(e); }
  });
`;

const newLines = [...lines.slice(0, start), replacement, ...lines.slice(end)];
fs.writeFileSync('public/js/roteiros.js', newLines.join('\n'), 'utf8');
console.log('Script updated successfully!');
