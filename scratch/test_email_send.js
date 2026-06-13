require('dotenv').config({ path: 'c:/Users/User/Documents/heian-quote/.env' });
const nodemailer = require('nodemailer');

console.log('--- Teste de Envio de E-mail ---');
console.log('Remetente (GMAIL_USER):', process.env.GMAIL_USER);
console.log('Senha de App configurada?', process.env.GMAIL_APP_PASS ? 'Sim' : 'Não');

if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASS || process.env.GMAIL_USER === 'seu-email@gmail.com') {
  console.error('ERRO: Você precisa configurar as variáveis GMAIL_USER e GMAIL_APP_PASS no arquivo .env!');
  process.exit(1);
}

// Configuração do transporter do Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS
  }
});

const mailOptions = {
  from: `"Heian Tour" <${process.env.GMAIL_USER}>`,
  to: process.env.GMAIL_USER, // Envia para o próprio usuário para testar
  subject: 'Teste de Notificação - Heian Tour',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #8b0000; text-align: center;">Heian Tour - Teste de Envio</h2>
      <p>Olá,</p>
      <p>Este é um e-mail de teste automático para validar as credenciais do Gmail configuradas no sistema da <strong>Heian Tour</strong>.</p>
      <p style="font-size: 16px; color: #333;">Se você recebeu esta mensagem, significa que o envio de e-mails via SMTP do Gmail está funcionando perfeitamente! 🎉</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #777; text-align: center;">Este é um e-mail automático do sistema Heian Tour. Por favor, não responda.</p>
    </div>
  `
};

console.log('Enviando e-mail de teste para:', process.env.GMAIL_USER);

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('Erro ao enviar e-mail:', error);
  } else {
    console.log('E-mail enviado com sucesso!');
    console.log('ID da mensagem:', info.messageId);
    console.log('Resposta do servidor:', info.response);
  }
});
