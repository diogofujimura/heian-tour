const fs = require('fs');
let app = fs.readFileSync('public/js/app.js', 'utf8');

const oldCode = `      if (orc.orcRoteiroVinculado) {
         btnRoteiro.innerText = 'Abrir Roteiro';
         btnRoteiro.onclick = () => { 
           closeClienteModal(); 
           abrirOrcamento(orc.id); 
           document.getElementById('orcRoteiroVinculado').value = orc.orcRoteiroVinculado; 
           navToPage('roteiros'); 
           
           setTimeout(() => {
             if (typeof preencherSelectRoteiros === 'function') preencherSelectRoteiros(orc.orcRoteiroVinculado);
             const selRoteiro = document.getElementById('selectRoteiroBase');
             if (selRoteiro) {
               selRoteiro.value = orc.orcRoteiroVinculado;
               const btnEd = document.getElementById('btnEditarRoteiro');
               const btnEx = document.getElementById('btnExcluirRoteiro');
               if (btnEd) {
                 btnEd.style.display = 'inline-block';
                 btnEd.click();
               }
               if (btnEx) btnEx.style.display = 'inline-block';
             }
           }, 300);
         };
      } else {
         btnRoteiro.innerText = 'Gerar Roteiro';
         btnRoteiro.onclick = async () => {`;

const newCode = `      if (orc.orcRoteiroVinculado) {
         btnRoteiro.style.display = 'block';
         btnRoteiro.innerText = 'Abrir Roteiro';
         btnRoteiro.onclick = () => { 
           closeClienteModal(); 
           abrirOrcamento(orc.id); 
           document.getElementById('orcRoteiroVinculado').value = orc.orcRoteiroVinculado; 
           navToPage('roteiros'); 
           
           setTimeout(() => {
             if (typeof preencherSelectRoteiros === 'function') preencherSelectRoteiros(orc.orcRoteiroVinculado);
             const selRoteiro = document.getElementById('selectRoteiroBase');
             if (selRoteiro) {
               selRoteiro.value = orc.orcRoteiroVinculado;
               const btnEd = document.getElementById('btnEditarRoteiro');
               const btnEx = document.getElementById('btnExcluirRoteiro');
               if (btnEd) {
                 btnEd.style.display = 'inline-block';
                 btnEd.click();
               }
               if (btnEx) btnEx.style.display = 'inline-block';
             }
           }, 300);
         };
      } else {
         btnRoteiro.style.display = 'none';
         btnRoteiro.innerText = 'Gerar Roteiro';
         btnRoteiro.onclick = async () => {`;

app = app.replace(oldCode, newCode);
fs.writeFileSync('public/js/app.js', app);
console.log('Fixed btnRoteiro display logic when already saved');
