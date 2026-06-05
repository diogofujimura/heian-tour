const fs = require('fs');

// --- 1. INDEX.HTML ---
let html = fs.readFileSync('public/index.html', 'utf8');

const targetSelect = `<select id="selectRoteiroBase" class="select-roteiro">
          <option value="">Selecione um Roteiro Base...</option>
        </select>`;
const replaceSelect = `<input type="text" list="roteirosList" id="selectRoteiroBase" class="select-roteiro" placeholder="Pesquisar Roteiro..." style="padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; outline: none; transition: border-color 0.2s;">
        <datalist id="roteirosList"></datalist>`;

html = html.replace(targetSelect, replaceSelect);
fs.writeFileSync('public/index.html', html);


// --- 2. APP.JS ---
let appJs = fs.readFileSync('public/js/app.js', 'utf8');

const targetNav = `if (pg === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();`;
const replaceNav = `if (pg === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
  if (pg === 'roteiros' && typeof fecharEditorRoteiro === 'function') fecharEditorRoteiro();`;

appJs = appJs.replace(targetNav, replaceNav);
fs.writeFileSync('public/js/app.js', appJs);


// --- 3. ROTEIROS.JS ---
let roteirosJs = fs.readFileSync('public/js/roteiros.js', 'utf8');

const targetPreencher = `function preencherSelectRoteiros(selectValue = '') {
  const select = document.getElementById('selectRoteiroBase');
  if (!select) return;
  
  select.innerHTML = '<option value="">Selecione um Roteiro Base...</option>';
  Object.keys(dbRotas).forEach(roteiroName => {
    const opt = document.createElement('option');
    opt.value = roteiroName;
    opt.textContent = roteiroName;
    select.appendChild(opt);
  });
  if (selectValue) {
    select.value = selectValue;
  }
}`;

const replacePreencher = `function preencherSelectRoteiros(selectValue = '') {
  const input = document.getElementById('selectRoteiroBase');
  const dataList = document.getElementById('roteirosList');
  if (!input || !dataList) return;
  
  dataList.innerHTML = '';
  Object.keys(dbRotas).forEach(roteiroName => {
    const opt = document.createElement('option');
    opt.value = roteiroName;
    dataList.appendChild(opt);
  });
  if (selectValue) {
    input.value = selectValue;
  }
}`;

roteirosJs = roteirosJs.replace(targetPreencher, replacePreencher);
fs.writeFileSync('public/js/roteiros.js', roteirosJs);

console.log("Feito!");
