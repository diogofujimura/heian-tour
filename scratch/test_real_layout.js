require('dotenv').config({ path: 'c:/Users/User/Documents/heian-quote/.env' });
const nodemailer = require('nodemailer');

console.log('--- Enviando E-mail de Teste de Layout ---');
console.log('Remetente (GMAIL_USER):', process.env.GMAIL_USER);
console.log('Destinatário:', 'diogofujimura@gmail.com');

// Configuração do transporter do Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS
  }
});

// Mock de evento de teste
const eventoTeste = {
  titulo: 'Tour Kyoto Clássico & Fushimi Inari',
  tipoServico: 'Roteiro',
  dataServico: '2026-06-14',
  horaEncontro: '09:00',
  localEncontro: 'Lobby do Hotel Ritz-Carlton Kyoto',
  clienteNome: 'Família Silva (4 adultos)',
  duracaoTour: '8 Horas (Dia inteiro)',
  textos: []
};

// Helper para formatar data YYYY-MM-DD para formato extenso PT-BR
function formatarDataExtenso(dataStr) {
  if (!dataStr || !dataStr.includes('-')) return dataStr || '';
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const parts = dataStr.split('-');
  if (parts.length < 3) return dataStr;
  const dia = parseInt(parts[2], 10);
  const mesIndex = parseInt(parts[1], 10) - 1;
  const ano = parts[0];
  const nomeMes = meses[mesIndex] || '';
  const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const dateObj = new Date(parseInt(ano), mesIndex, dia);
  const nomeDia = diasSemana[dateObj.getDay()] || '';
  return `${nomeDia}, ${dia} de ${nomeMes} de ${ano}`;
}

// Helper para gerar o link do Google Agenda convertendo horário JST para UTC
function gerarLinkGoogleAgenda(evento, horaStr) {
  try {
    const dataStr = evento.dataServico;
    if (!dataStr) return '';
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    let hora = 9;
    let min = 0;
    if (horaStr && typeof horaStr === 'string' && horaStr.includes(':')) {
      const parts = horaStr.split(':');
      hora = parseInt(parts[0], 10) || 9;
      min = parseInt(parts[1], 10) || 0;
    }
    const dataInicioUTC = new Date(Date.UTC(ano, mes - 1, dia, hora - 9, min, 0));
    let duracaoMs = 8 * 60 * 60 * 1000;
    const dataFimUTC = new Date(dataInicioUTC.getTime() + duracaoMs);
    const formatarDataGoogle = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const datesParam = `${formatarDataGoogle(dataInicioUTC)}/${formatarDataGoogle(dataFimUTC)}`;
    const textParam = encodeURIComponent(`[Heian Tour] ${evento.titulo}`);
    let desc = `Tipo de Serviço: ${evento.tipoServico}\n`;
    desc += `Horário de Encontro JST: ${horaStr}\n`;
    desc += `Ponto de Encontro: ${evento.localEncontro || 'Não informado'}\n`;
    if (evento.clienteNome) desc += `Cliente: ${evento.clienteNome}\n`;
    desc += `\nDuração: ${evento.duracaoTour || 'Dia inteiro'}\n`;
    desc += `\nGerado automaticamente por Heian Tour. Tenha um excelente trabalho!`;
    const detailsParam = encodeURIComponent(desc);
    const locationParam = encodeURIComponent(evento.localEncontro || '');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${textParam}&dates=${datesParam}&details=${detailsParam}&location=${locationParam}`;
  } catch (error) {
    console.error('[Google Calendar] Erro ao gerar link:', error);
    return '';
  }
}

// Helper para formatar data YYYY-MM-DD para DD/MM
function formatarDataAssunto(dataStr) {
  if (!dataStr || !dataStr.includes('-')) return '';
  const parts = dataStr.split('-');
  if (parts.length < 3) return '';
  return `${parts[2]}/${parts[1]}`;
}

const corDestaque = '#89232D';
const tituloEmail = 'Nova Atividade Designada';
const subtituloEmail = 'Olá <strong>Diogo Fujimura</strong>, você foi designado para uma nova atividade no calendário da Heian Tour.';

// Gerar dados
const linkGoogleAgenda = gerarLinkGoogleAgenda(eventoTeste, eventoTeste.horaEncontro);
const dataFormatada = formatarDataAssunto(eventoTeste.dataServico);
const dataPrefixo = dataFormatada ? `${dataFormatada} - ` : '';
const dataExtenso = formatarDataExtenso(eventoTeste.dataServico);

// Mock de hotel
const hotelInfo = { hotel: 'The Ritz-Carlton Kyoto', cidade: 'Kyoto' };
const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotelInfo.hotel + ', ' + hotelInfo.cidade + ', Japan')}`;
const hotelHtml = `
            <tr>
              <td style="padding: 6px 0; padding-right: 12px; font-weight: 600; color: #666; font-size: 14px; vertical-align: top;">Hotel:</td>
              <td style="padding: 6px 0; font-size: 14px;">
                <a href="${googleMapsUrl}" target="_blank" style="color: #89232D; text-decoration: underline; font-weight: 500;">${hotelInfo.hotel}</a>
                <span style="color: #888; font-size: 12px;"> (${hotelInfo.cidade})</span>
              </td>
            </tr>
`;

const html = `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); background-color: #ffffff;">
    <!-- Cabeçalho com Barra Premium (anti-dark-mode) -->
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="width: 100%; border-collapse: collapse; border: 0;">
      <tr>
        <td bgcolor="#89232D" style="background-color: #89232D !important; background: #89232D !important; padding: 0;">
          <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 20px 0 20px 25px; text-align: left; vertical-align: middle; width: 50%; background-color: #89232D !important;">
                <img src="cid:logo_heian" alt="Heian Tour" style="max-height: 80px; width: auto; max-width: 100%; display: block; object-fit: contain;">
              </td>
              <td style="padding: 20px 25px 20px 0; text-align: right; vertical-align: middle; width: 50%; background-color: #89232D !important;">
                <p style="margin: 0; font-size: 13px; color: #f0f0f0; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">${tituloEmail}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <!-- Conteúdo Principal -->
    <div style="padding: 30px 35px; color: #333333; line-height: 1.6;">
      <p style="font-size: 15px; margin-top: 0; color: #444444;">${subtituloEmail}</p>
      
      <div style="background-color: #fafafa; border-left: 4px solid ${corDestaque}; padding: 18px; border-radius: 4px; margin: 20px 0; border-top: 1px solid #f0f0f0; border-right: 1px solid #f0f0f0; border-bottom: 1px solid #f0f0f0;">
        <h3 style="margin-top: 0; color: #1a1a1a; font-size: 16px; border-bottom: 1px solid #eef0f2; padding-bottom: 8px;">Detalhes do Serviço</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 6px 0; padding-right: 12px; width: 130px; font-weight: 600; color: #666; font-size: 14px; white-space: nowrap;">Atividade:</td>
            <td style="padding: 6px 0; font-weight: 500; font-size: 14px; color: #1a1a1a;">${eventoTeste.titulo}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; padding-right: 12px; font-weight: 600; color: #666; font-size: 14px; white-space: nowrap;">Tipo:</td>
            <td style="padding: 6px 0; font-size: 14px;">${eventoTeste.tipoServico}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; padding-right: 12px; font-weight: 600; color: #666; font-size: 14px; white-space: nowrap;">📅 Data:</td>
            <td style="padding: 6px 0; font-weight: bold; color: #1a1a1a; font-size: 15px;">${dataExtenso}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; padding-right: 12px; font-weight: 600; color: #666; font-size: 14px; white-space: nowrap;">⏰ Hora:</td>
            <td style="padding: 6px 0; font-weight: bold; color: ${corDestaque}; font-size: 15px;">${eventoTeste.horaEncontro}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; padding-right: 12px; font-weight: 600; color: #666; font-size: 14px; white-space: nowrap;">Encontro:</td>
            <td style="padding: 6px 0; font-size: 14px;">${eventoTeste.localEncontro}</td>
          </tr>
          ${hotelHtml}
          ${eventoTeste.clienteNome ? `
          <tr>
            <td style="padding: 6px 0; padding-right: 12px; font-weight: 600; color: #666; font-size: 14px; white-space: nowrap;">Cliente:</td>
            <td style="padding: 6px 0; font-size: 14px;">${eventoTeste.clienteNome}</td>
          </tr>
          ` : ''}
        </table>
      </div>
      
      <div style="margin: 20px 0; border-top: 1px solid #eee; padding-top: 15px;">
        <h4 style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 15px;">Informações Complementares</h4>
        <div style="font-size: 14px; color: #444;">
          <p style="margin: 5px 0;"><strong>Duração Estimada:</strong> ${eventoTeste.duracaoTour}</p>
        </div>
      </div>
      
      ${linkGoogleAgenda ? `
      <!-- Botão Adicionar ao Google Agenda -->
      <div style="margin: 30px 0 25px 0; text-align: center;">
        <a href="${linkGoogleAgenda}" target="_blank" style="background-color: #89232D; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.1); border: 1px solid rgba(0,0,0,0.05);">
          📅 Adicionar ao Google Agenda
        </a>
      </div>
      ` : ''}
      
      <p style="margin-top: 25px; font-size: 14px;">Por favor, confirme a visualização desta atividade acessando o calendário no painel administrativo.</p>
      <p style="margin-bottom: 0; font-size: 14px;">Desejamos um excelente serviço!</p>
    </div>
    
    <!-- Rodapé -->
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 11px; color: #777777; border-top: 1px solid #eef0f2;">
      <p style="margin: 0 0 5px 0;"><strong>Heian Tour Operadora de Turismo Japão</strong></p>
      <p style="margin: 0;">Este é um e-mail de notificação automática. Por favor, não responda diretamente a esta mensagem.</p>
    </div>
  </div>
`;

const mailOptions = {
  from: `"Heian Tour" <${process.env.GMAIL_USER}>`,
  to: 'diogofujimura@gmail.com',
  subject: `[Heian Tour] Nova atividade designada: ${dataPrefixo}${eventoTeste.titulo}`,
  html: html,
  attachments: [
    {
      filename: 'logo.png',
      path: 'c:/Users/User/Documents/heian-quote/public/assets/logo.png',
      cid: 'logo_heian'
    }
  ]
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('Erro ao enviar e-mail de teste de layout:', error);
  } else {
    console.log('E-mail de teste de layout enviado com sucesso!');
    console.log('MsgID:', info.messageId);
  }
});
