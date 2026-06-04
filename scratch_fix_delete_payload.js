const fs = require('fs');
let server = fs.readFileSync('server.js', 'utf8');

const tSearch = `if (oldItem) syncToGoogleSheets('transportes', 'delete', { _oldKey: oldItem.trecho });`;
const tReplace = `if (oldItem) syncToGoogleSheets('transportes', 'delete', oldItem);`;

const eSearch = `if (oldItem) syncToGoogleSheets('experiencias', 'delete', { _oldKey: oldItem.nome });`;
const eReplace = `if (oldItem) syncToGoogleSheets('experiencias', 'delete', oldItem);`;

const aSearch = `if (oldItem) syncToGoogleSheets('atracoes', 'delete', { _oldKey: oldItem['Nome da Atração'] });`;
const aReplace = `if (oldItem) syncToGoogleSheets('atracoes', 'delete', oldItem);`;

const rSearch = `if (oldItem) syncToGoogleSheets('rotas', 'delete', { _oldKey: oldItem.nomeDaRota });`;
const rReplace = `if (oldItem) syncToGoogleSheets('rotas', 'delete', oldItem);`;

function cleanStr(s) { return s.replace(/[^\x20-\x7E]/g, '.'); }
function patch(str, searchStr, replaceStr) {
    const regexStr = cleanStr(searchStr).replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s+').replace(/\./g, '.');
    const regex = new RegExp(regexStr);
    return str.replace(regex, replaceStr);
}

server = patch(server, tSearch, tReplace);
server = patch(server, eSearch, eReplace);
server = patch(server, aSearch, aReplace);
server = patch(server, rSearch, rReplace);

fs.writeFileSync('server.js', server);
console.log('Delete payloads fixed in server.js');
