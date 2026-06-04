const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

// 1. Fix Transporte Layout
// Replace the grid container with flex container
const transGridStr = `<div style="display:grid; grid-template-columns:3fr 1fr 1fr; gap:8px">
              <div class="field" style="margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Opção de Transporte</label>`;
                
const transFlexStr = `<div style="display:flex; gap:8px; margin-bottom:8px">
              <div class="field" style="flex:2; margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Opção de Transporte</label>`;

code = code.replace(transGridStr, transFlexStr);

// 2. Enhance "Emitido p/ Heian" Checkbox
const heianOldTrans = `<label style="font-size:11px; color:var(--ink-mid); display:flex; align-items:center; cursor:pointer; height:34px">
                  <input type="checkbox" \${el.compradoHeian ? 'checked' : ''} onchange="updElementoEdit(\${idx}, \${eIdx}, 'compradoHeian', this.checked)" style="margin-right:4px"> Emitido p/ Heian
                </label>`;

const heianNewTrans = `<label style="font-size:11px; display:flex; align-items:center; cursor:pointer; height:34px; padding:0 8px; border-radius:4px; font-weight:600; border:1px solid \${el.compradoHeian ? 'var(--gold)' : '#ccc'}; background:\${el.compradoHeian ? 'var(--gold)' : '#fff'}; color:\${el.compradoHeian ? 'white' : 'var(--text-sec)'}">
                  <input type="checkbox" \${el.compradoHeian ? 'checked' : ''} onchange="updElementoEdit(\${idx}, \${eIdx}, 'compradoHeian', this.checked)" style="margin-right:6px"> EMITIDO P/ HEIAN
                </label>`;

code = code.replace(heianOldTrans, heianNewTrans);
code = code.replace(heianOldTrans, heianNewTrans); // Replace in both Transporte and Experiencia (since they are identical strings)

// 3. Enhance "Tour Guiado" Checkbox
const tourGuiadoOld = `<label style="font-size:12px; margin-right:12px; cursor:pointer; color:white; display:flex; align-items:center;">
            <input type="checkbox" \${dia.tourGuiado ? 'checked' : ''} onchange="updDiaEdit(\${idx}, 'tourGuiado', this.checked)" style="margin-right:4px">
            Tour Guiado
          </label>`;

const tourGuiadoNew = `<label style="font-size:12px; margin-right:12px; cursor:pointer; display:flex; align-items:center; padding:4px 12px; border-radius:16px; font-weight:600; background:\${dia.tourGuiado ? '#fff' : 'rgba(255,255,255,0.2)'}; color:\${dia.tourGuiado ? 'var(--crimson)' : '#fff'}; border: 1px solid \${dia.tourGuiado ? '#fff' : 'rgba(255,255,255,0.4)'}">
            <input type="checkbox" \${dia.tourGuiado ? 'checked' : ''} onchange="updDiaEdit(\${idx}, 'tourGuiado', this.checked)" style="margin-right:6px; accent-color:var(--crimson)">
            \${dia.tourGuiado ? '⭐ TOUR GUIADO' : 'Tour Guiado'}
          </label>`;

code = code.replace(tourGuiadoOld, tourGuiadoNew);

fs.writeFileSync('public/js/roteiros.js', code);
console.log('Patched layout and checkboxes');
