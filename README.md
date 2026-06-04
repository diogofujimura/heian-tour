# Heian Tour — Gerador de Orçamentos

## Instalação (primeira vez)

### 1. Instale o Node.js
- Baixe em: https://nodejs.org (versão LTS)
- Instale normalmente (Windows ou Mac)

### 2. Abra o terminal na pasta do app
- **Windows**: Clique com botão direito na pasta `heian-quote` → "Abrir no Terminal"
- **Mac**: Clique com botão direito na pasta → "Novo Terminal na Pasta"

### 3. Instale as dependências (só na primeira vez)
```
npm install
```

### 4. Inicie o app
```
npm start
```

O browser abre automaticamente em http://localhost:3000

---

## Uso diário
Basta abrir o terminal na pasta e rodar:
```
npm start
```

---

## Transferir para outro computador
1. Copie a pasta `heian-quote` inteira para um pendrive ou Google Drive
2. No outro computador, instale o Node.js (passo 1 acima)
3. Rode `npm install` uma vez
4. Depois é só `npm start`

---

## Sincronização com Google Sheets

Para sincronizar a base de dados com sua planilha:

1. Vá em **Configurações** no app
2. Cole o ID da planilha no campo "ID do Google Sheets"
   - O ID fica na URL: `docs.google.com/spreadsheets/d/**SEU_ID**/edit`
3. Certifique-se que a planilha está acessível com o link (Compartilhar → "Qualquer pessoa com o link")
4. Clique em "Salvar ID"
5. Use o botão "↻ Sincronizar Sheets" na sidebar quando quiser atualizar

**Estrutura esperada no Sheets:**
- Aba `TRANSPORTE`: Trecho | Tipo | Linha | Categoria | Preço ¥ | Tempo | Observações | Link
- Aba `EXPERIÊNCIAS`: Nome | Tipo | Preço ¥ | Tempo | Observações | Link

---

## Gerar PDF
1. Monte o orçamento
2. Clique em "Visualizar PDF" para conferir
3. Clique em "Imprimir / Salvar PDF"
4. No diálogo de impressão, selecione "Salvar como PDF"
