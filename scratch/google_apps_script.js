/**
 * Google Apps Script - Sincronização Dupla Heian Tour
 * Coloque este código no menu "Extensões > Apps Script" da sua Planilha do Google.
 * Depois, implante como "App da Web" (Web App) acessível para "Qualquer pessoa" (Anyone).
 */

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action; // 'insert', 'update', 'delete'
    var type = params.type;     // 'transportes', 'experiencias', 'atracoes'
    var sheetName = params.sheetName; // Nome da aba real (ex: 'Base', 'BaseEX', 'Atracoes')
    var data = params.data;     // Objeto com os dados do item
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Aba não encontrada: ' + sheetName }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Configuração dos mapeamentos de campos e chaves de busca para cada tipo
    var mapping = {
      'transportes': {
        keys: ['trecho', 'tipo', 'linha', 'categoria'],
        columns: ['trecho', 'tipo', 'linha', 'categoria', 'preco_jpy', 'tempo', 'observacao', 'link']
      },
      'experiencias': {
        keys: ['nome'],
        columns: ['nome', 'tipo', '', '', 'preco_jpy', '', '', 'link']
      },
      'atracoes': {
        keys: ['Nome da Atração'],
        columns: ['Cidade', 'Bairro', 'Nome da Atração', 'Descrição Detalhada', 'Preço (Ingresso)', 'Origem']
      }
    };
    
    var cfg = mapping[type];
    if (!cfg) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Tipo inválido: ' + type }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Pega todos os valores da planilha para pesquisar a linha correta
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var values = lastRow > 0 ? sheet.getRange(1, 1, lastRow, Math.max(lastCol, 10)).getValues() : [];
    
    // Tenta encontrar a linha correspondente baseado nas chaves de busca
    var foundRowIdx = -1;
    
    // Para transportes, precisamos ignorar linhas de cabeçalho
    var startRow = 0;
    if (type === 'transportes') {
      // Procura a linha que começa com "Trecho" para pular o cabeçalho
      for (var i = 0; i < values.length; i++) {
        if (String(values[i][0]).toLowerCase().trim() === 'trecho') {
          startRow = i + 1;
          break;
        }
      }
    } else if (type === 'experiencias' || type === 'atracoes') {
      // Pula a primeira linha se parecer um cabeçalho
      if (values.length > 0) {
        var firstCell = String(values[0][0]).toLowerCase().trim();
        if (firstCell === 'nome' || firstCell === 'cidade' || firstCell === '') {
          startRow = 1;
        }
      }
    }
    
    // Busca a linha correspondente pelos campos de chaves (case-insensitive)
    for (var r = startRow; r < values.length; r++) {
      var match = true;
      for (var k = 0; k < cfg.keys.length; k++) {
        var keyProp = cfg.keys[k];
        var colIdx = cfg.columns.indexOf(keyProp);
        
        // No caso das Experiências, se 'nome' for a chave, ela está no índice 0
        if (type === 'experiencias' && keyProp === 'nome') colIdx = 0;
        
        if (colIdx >= 0) {
          var sheetVal = String(values[r][colIdx]).toLowerCase().trim();
          var appVal = String(data[keyProp]).toLowerCase().trim();
          if (sheetVal !== appVal) {
            match = false;
            break;
          }
        }
      }
      if (match) {
        foundRowIdx = r + 1; // getRange usa 1-based index
        break;
      }
    }
    
    // Prepara a linha para ser adicionada/atualizada
    var rowData = [];
    for (var c = 0; c < cfg.columns.length; c++) {
      var prop = cfg.columns[c];
      if (prop === '') {
        rowData.push('');
      } else {
        var val = data[prop] !== undefined ? data[prop] : '';
        // Trata conversão numérica de preço se necessário
        if (prop === 'preco_jpy' && typeof val === 'string') {
          val = parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
        }
        rowData.push(val);
      }
    }
    
    if (action === 'insert') {
      sheet.appendRow(rowData);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Item adicionado com sucesso!', row: sheet.getLastRow() }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else if (action === 'update') {
      if (foundRowIdx > 0) {
        // Atualiza a linha existente
        sheet.getRange(foundRowIdx, 1, 1, rowData.length).setValues([rowData]);
        return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Item atualizado com sucesso!', row: foundRowIdx }))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        // Se não achou na atualização, faz fallback para append
        sheet.appendRow(rowData);
        return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Item não encontrado para atualizar, adicionado como novo.', row: sheet.getLastRow() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
    } else if (action === 'delete') {
      if (foundRowIdx > 0) {
        sheet.deleteRow(foundRowIdx);
        return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Item removido do Sheets com sucesso!' }))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Item não encontrado no Sheets para deletar, mas deletado localmente.' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Ação desconhecida: ' + action }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(e) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
