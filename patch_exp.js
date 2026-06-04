const fs = require('fs');
let code = fs.readFileSync('public/js/roteiros.js', 'utf8');

// The block to replace
const search = `            <div style="display:grid; grid-template-columns:1fr; gap:8px; margin-bottom:8px">
              <input type="text" placeholder="Buscar..." value="\${el.filtro || ''}" oninput="updElementoEdit(\${idx}, \${eIdx}, 'filtro', this.value); atualizarOpcoesExperiencia(\${idx}, \${eIdx})">
              <select id="selExp_\${idx}_\${eIdx}" onchange="selecionarExperiencia(\${idx}, \${eIdx}, this.value)" style="width:100%; font-size:12px; padding:6px">
                <option value="">Digite para buscar...</option>
              </select>
            </div>
            <div style="display:flex; gap:8px; margin-bottom:8px">
              <div style="flex:1">
                  <label style="font-size:10px;color:var(--ink-mid)">Adultos</label>
                  <input type="number" value="\${el.adultos !== undefined ? el.adultos : (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.adultos) || 2}" onchange="updElementoEdit(\${idx}, \${eIdx}, 'adultos', parseInt(this.value)||0)">
                </div>
                <div style="flex:1">
                  <label style="font-size:10px;color:var(--ink-mid)">Crianças</label>
                  <input type="number" value="\${el.criancas !== undefined ? el.criancas : (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.criancas) || 0}" onchange="updElementoEdit(\${idx}, \${eIdx}, 'criancas', parseInt(this.value)||0)">
                </div>
            </div>`;

const replace = `            <div style="display:flex; gap:8px; margin-bottom:8px">
              <div class="field" style="flex:1; margin:0">
                <input type="text" placeholder="Buscar Experiência..." value="\${el.filtro || ''}" oninput="updElementoEdit(\${idx}, \${eIdx}, 'filtro', this.value); atualizarOpcoesExperiencia(\${idx}, \${eIdx})">
              </div>
            </div>
            <div style="display:flex; gap:8px; margin-bottom:8px">
              <div class="field" style="flex:2; margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Item Encontrado</label>
                <select id="selExp_\${idx}_\${eIdx}" onchange="selecionarExperiencia(\${idx}, \${eIdx}, this.value)" style="width:100%; font-size:12px; padding:6px; border: 1px solid var(--border); border-radius: 4px;">
                  <option value="">Digite para buscar...</option>
                </select>
              </div>
              <div class="field" style="margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Horário</label>
                <input type="time" value="\${el.horaPartida || ''}" onchange="updElementoEdit(\${idx}, \${eIdx}, 'horaPartida', this.value)">
              </div>
              <div class="field" style="margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Adultos</label>
                <input type="number" value="\${el.adultos !== undefined ? el.adultos : (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.adultos) || 2}" onchange="updElementoEdit(\${idx}, \${eIdx}, 'adultos', parseInt(this.value)||0)" style="width:50px">
              </div>
              <div class="field" style="margin:0">
                <label style="font-size:10px;color:var(--ink-mid)">Crianças</label>
                <input type="number" value="\${el.criancas !== undefined ? el.criancas : (roteiroEmEdicao.cliente && roteiroEmEdicao.cliente.criancas) || 0}" onchange="updElementoEdit(\${idx}, \${eIdx}, 'criancas', parseInt(this.value)||0)" style="width:50px">
              </div>
            </div>`;

code = code.replace(search, replace);

fs.writeFileSync('public/js/roteiros.js', code);
console.log('Patched UX Experiencia');
