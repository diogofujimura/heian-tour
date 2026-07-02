/**
 * Google Apps Script - Sincronização Dupla Heian Tour
 * Com Proteção de Colunas Pessoais e Fórmulas!
 */

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    var action = params.action; // 'insert', 'update', 'delete'
    var type = params.type;     // 'transportes', 'experiencias', 'atracoes', 'rotas'
    var sheetName = params.sheetName; // Nome da aba real
    var data = params.data;     // Objeto com os dados do item
    var oldData = params.oldData; // Objeto com os dados antigos (para update)
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Aba não encontrada: ' + sheetName }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Mapeamento exato garantindo a posição do ID que o usuário solicitou!
    // '' significa "Coluna do Usuário (Não Tocar)"
    var mapping = {
      'transportes': {
        keys: ['trecho', 'tipo', 'linha', 'categoria'],
        // Coluna M é a 13ª coluna (índice 12). Colunas A até M.
        columns: ['trecho', 'tipo', 'linha', 'categoria', 'preco_jpy', 'tempo', 'observacao', 'link', '', '', '', '', 'id']
      },
      'experiencias': {
        keys: ['nome'],
        // Coluna K é a 11ª coluna (índice 10). Colunas A até K.
        columns: ['nome', 'tipo', '', '', 'preco_jpy', '', '', 'link', '', '', 'id']
      },
      'atracoes': {
        keys: ['Nome da Atração'],
        // Colunas de A até L correspondentes a Cidade, Bairro, Nome da Atração, Descrição Detalhada, Preço (Ingresso), diasFechados, id, manutencaoInicio, manutencaoFim, manutencaoMotivo, Origem, Foto (URL)
        columns: ['Cidade', 'Bairro', 'Nome da Atração', 'Descrição Detalhada', 'Preço (Ingresso)', 'diasFechados', 'id', 'manutencaoInicio', 'manutencaoFim', 'manutencaoMotivo', 'Origem', 'Foto (URL)']
      },
      'rotas': {
        keys: ['nomeDaRota'],
        // Colunas A até D correspondentes a cidade, nomeDaRota, atracoesDoDia, id
        columns: ['cidade', 'nomeDaRota', 'atracoesDoDia', 'id']
      }
    };
    
    var cfg = mapping[type];
    if (!cfg) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Tipo inválido: ' + type }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    var values = lastRow > 0 ? sheet.getRange(1, 1, lastRow, Math.max(lastCol, 15)).getValues() : [];
    
    var foundRowIdx = -1;
    var startRow = 0;
    
    if (type === 'transportes') {
      for (var i = 0; i < values.length; i++) {
        if (String(values[i][0]).toLowerCase().trim() === 'trecho') {
          startRow = i + 1;
          break;
        }
      }
    } else if (type === 'experiencias' || type === 'atracoes' || type === 'rotas') {
      if (values.length > 0) {
        var firstCell = String(values[0][0]).toLowerCase().trim();
        if (firstCell === 'nome' || firstCell === 'cidade' || firstCell === 'nomedarota' || firstCell === '') {
          startRow = 1;
        }
      }
    }
    
    var idColIdx = cfg.columns.indexOf('id');
    var referenceData = (action === 'update' && oldData) ? oldData : data;
    var targetId = String(referenceData.id || '').trim();
    
    // Tenta achar pelo ID primeiro
    if ((action === 'update' || action === 'delete') && targetId !== '') {
      for (var r = startRow; r < values.length; r++) {
        var sheetId = String(values[r][idColIdx] || '').trim();
        if (sheetId !== '' && sheetId === targetId) {
          foundRowIdx = r + 1;
          break;
        }
      }
    }
    
    // Fallback se não achar pelo ID
    if (foundRowIdx === -1 && (action === 'update' || action === 'delete')) {
      for (var r = startRow; r < values.length; r++) {
        var match = true;
        // MUDANÇA AQUI: Usa apenas cfg.keys (ex: Nome) para update, mas usa tudo para delete
        var keysToMatch = (action === 'delete') ? cfg.columns.filter(function(c) { return c !== '' && c !== 'id'; }) : cfg.keys;
        
        for (var k = 0; k < keysToMatch.length; k++) {
          var keyProp = keysToMatch[k];
          var colIdx = cfg.columns.indexOf(keyProp);
          
          if (type === 'experiencias' && keyProp === 'nome') colIdx = 0;
          
          if (colIdx >= 0) {
            var sheetVal = String(values[r][colIdx]).toLowerCase().trim();
            var appVal = String(referenceData[keyProp] || '').toLowerCase().trim();
            if (sheetVal !== appVal) {
              match = false;
              break;
            }
          }
        }
        if (match) {
          foundRowIdx = r + 1;
          break;
        }
      }
    }
    
    // Preparar dados e lidar com regras de proteção
    var rowData = [];
    var existingRow = (foundRowIdx > 0 && foundRowIdx <= values.length) ? values[foundRowIdx - 1] : [];
    
    for (var c = 0; c < cfg.columns.length; c++) {
      var prop = cfg.columns[c];
      if (prop === '') {
        // Copiar o dado (ou fórmula avaliada) caso precise fazer um appendRow (insert)
        rowData.push(existingRow[c] !== undefined ? existingRow[c] : '');
      } else if (prop === 'id') {
        rowData.push(data.id || '');
      } else {
        var val = data[prop] !== undefined ? data[prop] : '';
        if (prop === 'preco_jpy' && typeof val === 'string') {
          val = parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
        }
        if (prop === 'dias' && typeof val === 'object') {
            val = JSON.stringify(val);
        }
        if (prop === 'atracoesDoDia' && typeof val === 'object') {
            if (Array.isArray(val)) {
                val = val.join(', ');
            } else {
                val = JSON.stringify(val);
            }
        }
        if (prop === 'diasFechados' && typeof val === 'object') {
            if (Array.isArray(val)) {
                val = val.join(', ');
            } else {
                val = JSON.stringify(val);
            }
        }
        rowData.push(val);
      }
    }
    
    if (action === 'insert') {
      sheet.appendRow(rowData);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Item adicionado', row: sheet.getLastRow() }))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else if (action === 'update') {
      if (foundRowIdx > 0) {
        // PROTEÇÃO ATIVA: Em vez de sobrescrever a linha toda e apagar fórmulas das colunas em branco,
        // o script vai célula por célula apenas nas colunas que o aplicativo "é dono".
        for (var c = 0; c < cfg.columns.length; c++) {
          var prop = cfg.columns[c];
          if (prop !== '') { // Se a coluna não for vazia, nós temos permissão para atualizá-la
            sheet.getRange(foundRowIdx, c + 1).setValue(rowData[c]);
          }
        }
        return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Item atualizado (ID sincronizado na coluna certa!)', row: foundRowIdx }))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        sheet.appendRow(rowData);
        return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Item nulo, adicionado novo.', row: sheet.getLastRow() }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      
    } else if (action === 'delete') {
      if (foundRowIdx > 0) {
        sheet.deleteRow(foundRowIdx);
        return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Item removido' }))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ ok: true, message: 'Item nulo para deletar' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Ação não reconhecida: ' + action }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(e) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
