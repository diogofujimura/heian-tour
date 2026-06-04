const fs = require('fs');
let js = fs.readFileSync('public/js/roteiros.js', 'utf8');

const updatedLogic = `
window.abrirModalVincularClienteRoteiro = async function() {
    const btn = document.getElementById('btnVincularClienteRoteiro');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Carregando...';
    btn.disabled = true;

    try {
        if (typeof window.notionClients === 'undefined' || !window.notionClients || window.notionClients.length === 0) {
            const res = await fetch('/api/notion/clientes');
            if (res.ok) {
                window.notionClients = await res.json();
            }
        }
        
        if (typeof window.notionClients === 'undefined' || !window.notionClients || window.notionClients.length === 0) {
            alert('Não foi possível carregar os clientes do Notion. Verifique se existem clientes cadastrados.');
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }

        const sel = document.getElementById('selClienteParaVincular');
        if (!sel) return;
        
        sel.innerHTML = '<option value="">Selecione um cliente...</option>';
        window.notionClients.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nome + ' (' + (c.adultos||0) + ' Ad / ' + (c.criancas||0) + ' Cr) - ' + (c.dataInicio || 'Sem Data');
            sel.appendChild(opt);
        });
        
        document.getElementById('modalVincularClienteRoteiro').classList.remove('hidden');
    } catch(e) {
        console.error(e);
        alert('Erro ao carregar clientes do Notion.');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
`;

js = js.replace(/window\.abrirModalVincularClienteRoteiro = function\(\) \{[\s\S]*?document\.getElementById\('modalVincularClienteRoteiro'\)\.classList\.remove\('hidden'\);\n\}/, updatedLogic.trim());

fs.writeFileSync('public/js/roteiros.js', js, 'utf8');
console.log('Fixed loading of notionClients in Roteiros.');
