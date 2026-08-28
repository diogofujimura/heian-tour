// GitHub Actions FTP Auto-Deploy Configured - Build 2026-06-19-02
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const NOTION_TOKEN = process.env.NOTION_API_KEY;
const NOTION_CLIENTS_DB_ID = process.env.NOTION_CLIENTS_DB_ID;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const { createNotionMirror } = require('./lib/notion-mirror');
const NOTION_DATABASES = {
  clientes: NOTION_CLIENTS_DB_ID,
  colaboradores: process.env.NOTION_COLABORADORES_DB_ID || '2a0b6e48f954816082afde2815056602',
  agenda: process.env.NOTION_AGENDA_DB_ID,
  contas: process.env.NOTION_CONTAS_DB_ID || '2bab6e48f954803bae65d962d2b529f5',
  entradas: process.env.NOTION_ENTRADAS_DB_ID,
  saidas: process.env.NOTION_SAIDAS_DB_ID,
  tasks: process.env.NOTION_TASKS_DB_ID
};
const notionMirror = createNotionMirror({
  supabase,
  token: NOTION_TOKEN,
  databases: NOTION_DATABASES,
  fetchImpl: fetch,
  logger: console
});

const nodemailer = require('nodemailer');

// Configuração do transporter do Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS
  }
});

// Helper para converter string de data/hora do serviço em objeto Date
function obterDataHoraServico(dataStr, horaStr) {
  if (!dataStr) return new Date();
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  let hora = 9;
  let min = 0;
  if (horaStr && typeof horaStr === 'string' && horaStr.includes(':')) {
    const parts = horaStr.split(':');
    hora = parseInt(parts[0], 10) || 9;
    min = parseInt(parts[1], 10) || 0;
  }
  return new Date(ano, mes - 1, dia, hora, min, 0, 0);
}

// Função para obter emails de colaboradores no Notion
async function obterColaboradoresEmails() {
  const colaboradoresMap = {};
  if (!NOTION_TOKEN) return colaboradoresMap;
  try {
    const pages = await notionMirror.getPages('colaboradores');
    pages.forEach(item => {
      const nameProp = item.properties.Name || item.properties.Nome;
      const name = nameProp?.title?.[0]?.plain_text || 'Sem Nome';
      const email = item.properties.Email?.email || '';
      if (email) {
        colaboradoresMap[item.id] = { name, email: email.trim() };
      }
    });
  } catch (e) {
    console.error('[Email Init] Erro ao carregar colaboradores do Notion:', e);
  }
  return colaboradoresMap;
}

// Helper para gerar o link do Google Agenda convertendo horário JST para UTC
function gerarLinkGoogleAgenda(evento, horaStr) {
  try {
    const dataStr = evento.dataServico; // YYYY-MM-DD
    if (!dataStr) return '';
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    let hora = 9;
    let min = 0;
    if (horaStr && typeof horaStr === 'string' && horaStr.includes(':')) {
      const parts = horaStr.split(':');
      hora = parseInt(parts[0], 10) || 9;
      min = parseInt(parts[1], 10) || 0;
    }

    // Converter para UTC sabendo que a hora do evento é JST (UTC+9)
    const dataInicioUTC = new Date(Date.UTC(ano, mes - 1, dia, hora - 9, min, 0));
    
    // Determinar a duração padrão (em milissegundos)
    let duracaoMs = 8 * 60 * 60 * 1000; // 8 horas padrão para Roteiro
    if (evento.tipoServico === 'Experiência' || evento.expInfo) {
      duracaoMs = 2 * 60 * 60 * 1000; // 2 horas
    } else if (evento.tipoServico === 'Transporte' || evento.transportInfo) {
      if (evento.transportInfo && evento.transportInfo.tempo) {
        const tempoStr = evento.transportInfo.tempo.toLowerCase();
        const matchHoras = tempoStr.match(/(\d+)\s*(?:hora|h)/);
        if (matchHoras) {
          const h = parseInt(matchHoras[1], 10);
          duracaoMs = h * 60 * 60 * 1000;
        } else {
          duracaoMs = 2 * 60 * 60 * 1000; // 2h fallback
        }
      } else {
        duracaoMs = 2 * 60 * 60 * 1000; // 2h fallback
      }
    } else if (evento.tipoServico === 'Roteiro') {
      if (evento.duracaoTour) {
        const duracaoStr = evento.duracaoTour.toLowerCase();
        const matchHoras = duracaoStr.match(/(\d+)\s*(?:hora|h)/);
        if (matchHoras) {
          const h = parseInt(matchHoras[1], 10);
          duracaoMs = h * 60 * 60 * 1000;
        }
      }
    }

    const dataFimUTC = new Date(dataInicioUTC.getTime() + duracaoMs);

    const formatarDataGoogle = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const datesParam = `${formatarDataGoogle(dataInicioUTC)}/${formatarDataGoogle(dataFimUTC)}`;
    const textParam = encodeURIComponent(`[Heian Tour] ${evento.titulo}`);
    
    // Montar descrição detalhada
    let desc = `Tipo de Serviço: ${evento.tipoServico}\n`;
    desc += `Horário de Encontro JST: ${horaStr}\n`;
    desc += `Ponto de Encontro: ${evento.localEncontro || 'Não informado'}\n`;
    if (evento.clienteNome) {
      desc += `Cliente: ${evento.clienteNome}\n`;
    }
    
    if (evento.transportInfo) {
      const t = evento.transportInfo;
      desc += `\nRota: ${t.origem || '-'} ➔ ${t.destino || '-'}\n`;
      desc += `Tipo de Transporte: ${t.tipoTransporte || '-'}\n`;
      if (t.linha) desc += `Linha: ${t.linha}\n`;
      if (t.categoria) desc += `Assento/Categoria: ${t.categoria}\n`;
      if (t.tempo) desc += `Duração: ${t.tempo}\n`;
    } else if (evento.expInfo) {
      const e = evento.expInfo;
      desc += `\nExperiência: ${e.nomeExp || evento.titulo}\n`;
      if (e.horaPartida) desc += `Horário de Entrada: ${e.horaPartida}\n`;
    } else if (evento.tipoServico === 'Roteiro') {
      desc += `\nDuração: ${evento.duracaoTour || 'Dia inteiro'}\n`;
    }

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

// Helper para formatar data YYYY-MM-DD para formato extenso PT-BR (ex: 14 de Junho de 2026)
function formatarDataExtenso(dataStr) {
  if (!dataStr || !dataStr.includes('-')) return dataStr || '';
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const parts = dataStr.split('-');
  if (parts.length < 3) return dataStr;
  const dia = parseInt(parts[2], 10);
  const mesIndex = parseInt(parts[1], 10) - 1;
  const ano = parts[0];
  const nomeMes = meses[mesIndex] || '';
  // Adicionar dia da semana
  const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const dateObj = new Date(parseInt(ano), mesIndex, dia);
  const nomeDia = diasSemana[dateObj.getDay()] || '';
  return `${nomeDia}, ${dia} de ${nomeMes} de ${ano}`;
}

// Helper para buscar o hotel do cliente com base na data do serviço
async function buscarHotelPorData(evento) {
  try {
    // Normaliza data para ISO (YYYY-MM-DD) — cobre estadias antigas salvas em BR (DD/MM/YYYY)
    const normISO = (d) => {
      if (!d) return '';
      if (d.includes('/')) { const p = d.split('/'); if (p.length === 3) return `${p[2]}-${p[1]}-${p[0]}`; }
      return d;
    };
    // 1. Tentar buscar via roteiroNome (aceita ID imutável ou nome de exibição)
    if (evento.roteiroNome) {
      const linhaRot = await acharRoteiroPorChaveOuNome(evento.roteiroNome);
      if (linhaRot && linhaRot.data) {
        const roteiro = linhaRot.data;
        const estadias = roteiro.estadias || [];
        if (estadias.length > 0 && evento.dataServico) {
          // Encontrar a estadia que cobre a data do serviço
          for (const est of estadias) {
            if (est.dataInicio && est.dataFim && est.hotel) {
              if (evento.dataServico >= normISO(est.dataInicio) && evento.dataServico <= normISO(est.dataFim)) {
                return { hotel: est.hotel, cidade: est.cidade || '' };
              }
            }
          }
          // Fallback: retornar a primeira estadia que tenha hotel
          const comHotel = estadias.find(e => e.hotel);
          if (comHotel) return { hotel: comHotel.hotel, cidade: comHotel.cidade || '' };
        }
      }
    }

    // 2. Tentar buscar via clienteId nos dados locais do cliente
    if (evento.clienteId && evento.clienteId !== 'cliente_desconhecido') {
      const { data: localData } = await supabase.from('clientes_locais').select('data').eq('id', evento.clienteId).single();
      if (localData && localData.data) {
        const estadias = localData.data.estadias || [];
        if (estadias.length > 0 && evento.dataServico) {
          for (const est of estadias) {
            if (est.dataInicio && est.dataFim && est.hotel) {
              if (evento.dataServico >= normISO(est.dataInicio) && evento.dataServico <= normISO(est.dataFim)) {
                return { hotel: est.hotel, cidade: est.cidade || '' };
              }
            }
          }
          const comHotel = estadias.find(e => e.hotel);
          if (comHotel) return { hotel: comHotel.hotel, cidade: comHotel.cidade || '' };
        }
      }
    }

    return null;
  } catch (err) {
    console.error('[Hotel Lookup] Erro ao buscar hotel:', err.message);
    return null;
  }
}

// Função para disparar os e-mails
async function enviarEmailColaborador({ email, nomeColaborador, evento, tipo }) {
  if (process.env.ENABLE_EMAIL_NOTIFICATIONS !== 'true') {
    console.log(`[Email] Envio de notificação [${tipo}] para ${email} ignorado (Desativado no .env)`);
    return false;
  }
  let assunto = '';
  let tituloEmail = '';
  let subtituloEmail = '';
  let corDestaque = '#89232D'; // Vermelho Heian Oficial (Exato da Logo)

  const dataFormatada = formatarDataAssunto(evento.dataServico);
  const dataPrefixo = dataFormatada ? `${dataFormatada} - ` : '';

  if (tipo === 'cadastro') {
    assunto = `[Heian Tour] Nova atividade designada: ${dataPrefixo}${evento.titulo}`;
    tituloEmail = 'Nova Atividade Designada';
    subtituloEmail = `Olá <strong>${nomeColaborador}</strong>, você foi designado para uma nova atividade no calendário da Heian Tour.`;
  } else if (tipo === '24h') {
    assunto = `[Heian Tour] Lembrete 24h: ${dataPrefixo}${evento.titulo}`;
    tituloEmail = 'Lembrete de Atividade (24 horas)';
    subtituloEmail = `Olá <strong>${nomeColaborador}</strong>, este é um lembrete automático de que você tem uma atividade amanhã.`;
  } else if (tipo === '1h') {
    assunto = `[Heian Tour] Lembrete 1h: ${dataPrefixo}${evento.titulo}`;
    tituloEmail = 'Lembrete de Atividade (1 hora)';
    subtituloEmail = `Olá <strong>${nomeColaborador}</strong>, sua atividade inicia em aproximadamente 1 hora!`;
    corDestaque = '#d35400'; // Laranja para urgência
  }

  let hora = evento.horaEncontro || '09:00';
  if (evento.tipoServico === 'Roteiro') {
    hora = evento.horaEncontro || '09:00';
  } else if (evento.tipoServico === 'Experiência' || evento.expInfo) {
    hora = evento.expInfo?.horaPartida || evento.horaEncontro || 'Padrão';
  } else if (evento.tipoServico === 'Transporte' || evento.transportInfo) {
    hora = evento.transportInfo?.horario || evento.horaEncontro || 'Padrão';
  }

  let pontoEncontro = evento.localEncontro || 'Não informado';

  let detalhesExtras = '';
  if (evento.transportInfo) {
    const t = evento.transportInfo;
    detalhesExtras = `
      <p style="margin: 5px 0;"><strong>Rota:</strong> ${t.origem || '-'} ➔ ${t.destino || '-'}</p>
      <p style="margin: 5px 0;"><strong>Tipo de Transporte:</strong> ${t.tipoTransporte || '-'}</p>
      ${t.linha ? `<p style="margin: 5px 0;"><strong>Linha:</strong> ${t.linha}</p>` : ''}
      ${t.categoria ? `<p style="margin: 5px 0;"><strong>Assento/Categoria:</strong> ${t.categoria}</p>` : ''}
      ${t.tempo ? `<p style="margin: 5px 0;"><strong>Duração da viagem:</strong> ${t.tempo}</p>` : ''}
    `;
  } else if (evento.expInfo) {
    const e = evento.expInfo;
    detalhesExtras = `
      <p style="margin: 5px 0;"><strong>Experiência:</strong> ${e.nomeExp || evento.titulo}</p>
      <p style="margin: 5px 0;"><strong>Horário de Entrada:</strong> ${e.horaPartida || '-'}</p>
    `;
  } else if (evento.tipoServico === 'Roteiro') {
    detalhesExtras = `
      <p style="margin: 5px 0;"><strong>Duração Estimada:</strong> ${evento.duracaoTour || 'Dia inteiro'}</p>
    `;
  }

  // Gerar o link do Google Agenda
  const linkGoogleAgenda = gerarLinkGoogleAgenda(evento, hora);

  // Formatar data por extenso
  const dataExtenso = formatarDataExtenso(evento.dataServico);

  // Buscar hotel do cliente para a data do serviço
  let hotelInfo = null;
  let googleMapsUrl = '';
  try {
    hotelInfo = await buscarHotelPorData(evento);
    if (hotelInfo && hotelInfo.hotel) {
      // Buscar se existe esse hotel cadastrado no Supabase na tabela config com id: hoteis
      const { data: cfgHoteis } = await supabase.from('config').select('data').eq('id', 'hoteis').single();
      const hoteis = cfgHoteis && cfgHoteis.data ? cfgHoteis.data : [];
      const hotelNomePlanilha = hotelInfo.hotel.trim().toLowerCase();
      const hotelRico = hoteis.find(h => {
        const hNome = (h['Nome do Hotel'] || '').trim().toLowerCase();
        return hNome === hotelNomePlanilha || hotelNomePlanilha.includes(hNome) || hNome.includes(hotelNomePlanilha);
      });
      if (hotelRico && hotelRico['Link do Google Maps']) {
        googleMapsUrl = hotelRico['Link do Google Maps'];
      }
    }
  } catch (e) {
    console.error('[Email] Erro ao buscar hotel na base:', e.message);
  }

  // Fallback se não encontrou link específico cadastrado na base de dados
  if (hotelInfo && hotelInfo.hotel && !googleMapsUrl) {
    googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotelInfo.hotel + (hotelInfo.cidade ? ', ' + hotelInfo.cidade + ', Japan' : ', Japan'))}`;
  }

  // Montar linha do hotel com link do Google Maps
  let hotelHtml = '';
  if (hotelInfo && hotelInfo.hotel) {
    hotelHtml = `
            <tr>
              <td class="label-text" style="padding: 6px 0; padding-right: 12px; font-weight: 600; color: #666; font-size: 14px; vertical-align: top;">Hotel:</td>
              <td class="value-text" style="padding: 6px 0; font-size: 14px;">
                <a class="hotel-link" href="${googleMapsUrl}" target="_blank" style="color: #89232D; text-decoration: underline; font-weight: 500;">${hotelInfo.hotel}</a>
                ${hotelInfo.cidade ? `<span style="color: #888; font-size: 12px;"> (${hotelInfo.cidade})</span>` : ''}
              </td>
            </tr>
    `;
  }

  const html = `
<!DOCTYPE html>
<html lang="pt-BR" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${assunto}</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    /* Estilos nativos para clientes de e-mail que suportam media queries de tema */
    @media (prefers-color-scheme: dark) {
      .email-body {
        background-color: #121212 !important;
        color: #ffffff !important;
      }
      .email-card {
        background-color: #1e1e1e !important;
        color: #e0e0e0 !important;
        border-color: #333333 !important;
      }
      .card-details {
        background-color: #2a2a2a !important;
        border-color: #444444 !important;
      }
      .anti-dark-bg {
        background-color: #89232D !important;
        background-image: linear-gradient(#89232D, #89232D) !important;
      }
      .anti-dark-text {
        color: #ffffff !important;
      }
      .hotel-link {
        color: #ff6b7a !important;
      }
      .label-text {
        color: #aaaaaa !important;
      }
      .value-text {
        color: #ffffff !important;
      }
      /* Forçar cores de parágrafo e cabeçalhos no modo escuro */
      p, td, h3, h4, span {
        color: #e0e0e0 !important;
      }
      a {
        color: #ff6b7a !important;
      }
    }
  </style>
</head>
<body class="email-body" style="margin: 0; padding: 0; background-color: #f9f9f9; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <div class="email-card" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 30px auto; border: 1px solid #e0e0e0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); background-color: #ffffff; color: #333333;">
    <!-- Cabeçalho com Barra Premium (anti-dark-mode) -->
    <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="width: 100%; border-collapse: collapse; border: 0;">
      <tr>
        <td class="anti-dark-bg" bgcolor="#89232D" style="background-color: #89232D !important; background-image: linear-gradient(#89232D, #89232D) !important; padding: 0;">
          <table cellpadding="0" cellspacing="0" role="presentation" width="100%" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td class="anti-dark-bg" style="padding: 10px 0 10px 25px; text-align: left; vertical-align: middle; width: 55%; background-color: #89232D !important; background-image: linear-gradient(#89232D, #89232D) !important;">
                <img src="cid:logo_heian" alt="Heian Tour" style="height: 72px; width: auto; max-width: 100%; display: block; object-fit: contain;">
              </td>
              <td class="anti-dark-bg" style="padding: 10px 25px 10px 0; text-align: right; vertical-align: middle; width: 45%; background-color: #89232D !important; background-image: linear-gradient(#89232D, #89232D) !important;">
                <p class="anti-dark-text" style="margin: 0; font-size: 13px; color: #f0f0f0; opacity: 0.9; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">${tituloEmail}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    
    <!-- Conteúdo Principal -->
    <div style="padding: 30px 35px; color: #333333; line-height: 1.6;">
      <p style="font-size: 15px; margin-top: 0; color: #444444;">${subtituloEmail}</p>
      
      <div class="card-details" style="background-color: #fafafa; border-left: 4px solid ${corDestaque}; padding: 18px; border-radius: 4px; margin: 20px 0; border-top: 1px solid #f0f0f0; border-right: 1px solid #f0f0f0; border-bottom: 1px solid #f0f0f0;">
        <h3 style="margin-top: 0; color: #1a1a1a; font-size: 16px; border-bottom: 1px solid #eef0f2; padding-bottom: 8px;">Detalhes do Serviço</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td class="label-text" style="padding: 6px 0; padding-right: 12px; width: 130px; font-weight: 600; color: #666; font-size: 14px; white-space: nowrap;">Atividade:</td>
            <td class="value-text" style="padding: 6px 0; font-weight: 500; font-size: 14px; color: #1a1a1a;">${evento.titulo}</td>
          </tr>
          <tr>
            <td class="label-text" style="padding: 6px 0; padding-right: 12px; font-weight: 600; color: #666; font-size: 14px; white-space: nowrap;">Tipo:</td>
            <td class="value-text" style="padding: 6px 0; font-size: 14px;">${evento.tipoServico}</td>
          </tr>
          <tr>
            <td class="label-text" style="padding: 6px 0; padding-right: 12px; font-weight: 600; color: #666; font-size: 14px; white-space: nowrap;">📅 Data:</td>
            <td class="value-text" style="padding: 6px 0; font-weight: bold; color: #1a1a1a; font-size: 15px;">${dataExtenso}</td>
          </tr>
          <tr>
            <td class="label-text" style="padding: 6px 0; padding-right: 12px; font-weight: 600; color: #666; font-size: 14px; white-space: nowrap;">⏰ Hora:</td>
            <td class="value-text" style="padding: 6px 0; font-weight: bold; color: ${corDestaque}; font-size: 15px;">${hora}</td>
          </tr>
          <tr>
            <td class="label-text" style="padding: 6px 0; padding-right: 12px; font-weight: 600; color: #666; font-size: 14px; white-space: nowrap;">Encontro:</td>
            <td class="value-text" style="padding: 6px 0; font-size: 14px;">${pontoEncontro}</td>
          </tr>
          ${hotelHtml}
          ${evento.clienteNome ? `
          <tr>
            <td class="label-text" style="padding: 6px 0; padding-right: 12px; font-weight: 600; color: #666; font-size: 14px; white-space: nowrap;">Cliente:</td>
            <td class="value-text" style="padding: 6px 0; font-size: 14px;">${evento.clienteNome}</td>
          </tr>
          ` : ''}
        </table>
      </div>
      
      ${detalhesExtras ? `
      <div style="margin: 20px 0; border-top: 1px solid #eee; padding-top: 15px;">
        <h4 class="value-text" style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 15px;">Informações Complementares</h4>
        <div style="font-size: 14px; color: #444;">
          ${detalhesExtras}
        </div>
      </div>
      ` : ''}
      
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
</body>
</html>
  `;

  const mailOptions = {
    from: `"Heian Tour" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: assunto,
    html: html,
    attachments: [
      {
        filename: 'logo.png',
        path: 'c:/Users/User/Documents/heian-quote/public/assets/logo.png',
        cid: 'logo_heian'
      }
    ]
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[Email] Notificação [${tipo}] enviada com sucesso para ${email}. MsgID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email] Falha ao enviar notificação [${tipo}] para ${email}:`, error);
    return false;
  }
}

// Função unificada para processar todas as notificações pendentes
async function processarNotificacoesEmail() {
  console.log('[Email Job] Iniciando verificação de notificações de eventos...');
  try {
    const colabs = await obterColaboradoresEmails();
    if (Object.keys(colabs).length === 0) {
      console.log('[Email Job] Nenhum colaborador com e-mail cadastrado ou Notion indisponível.');
      return;
    }

    const { data: calCfg, error: calErr } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
    if (calErr) {
      console.error('[Email Job] Erro ao buscar eventos do Supabase:', calErr);
      return;
    }

    let eventos = [];
    if (calCfg && calCfg.data) {
      eventos = Array.isArray(calCfg.data) ? calCfg.data : [];
    }

    if (eventos.length === 0) {
      console.log('[Email Job] Nenhum evento encontrado.');
      return;
    }

    let houveAlteracao = false;
    const agora = Date.now();
    const hojeStr = new Date().toISOString().substring(0, 10);

    for (let evento of eventos) {
      if (!evento.assignee || !Array.isArray(evento.assignee) || evento.assignee.length === 0) {
        continue;
      }

      // 1. Evitar e-mails retroativos para datas que já passaram
      if (!evento.dataServico || evento.dataServico < hojeStr) {
        continue;
      }

      // 2. Evitar e-mails retroativos de cadastro para eventos futuros que já existiam no calendário.
      // Se a chave emails_cadastro_enviados não existe, inicializamos como array vazia
      // para permitir o envio para novos eventos.
      if (!evento.emails_cadastro_enviados) {
        evento.emails_cadastro_enviados = [];
        evento.emails_24h_enviados = [];
        evento.emails_1h_enviados = [];
        houveAlteracao = true;
      }

      // Garantir existência das arrays de controle
      if (!evento.emails_24h_enviados) evento.emails_24h_enviados = [];
      if (!evento.emails_1h_enviados) evento.emails_1h_enviados = [];

      // Calcular horário do serviço
      let horaEncontroStr = evento.horaEncontro || '09:00';
      if (evento.tipoServico === 'Roteiro') {
        horaEncontroStr = evento.horaEncontro || '09:00';
      } else if (evento.tipoServico === 'Experiência' || evento.expInfo) {
        horaEncontroStr = evento.expInfo?.horaPartida || evento.horaEncontro || '09:00';
      } else if (evento.tipoServico === 'Transporte' || evento.transportInfo) {
        horaEncontroStr = evento.transportInfo?.horario || evento.horaEncontro || '09:00';
      }

      const dataHoraServico = obterDataHoraServico(evento.dataServico, horaEncontroStr);
      const tempoAteServicoMs = dataHoraServico.getTime() - agora;

      for (let colab of evento.assignee) {
        const colabInfo = colabs[colab.id];
        if (!colabInfo || !colabInfo.email) {
          continue;
        }

        // 1. Enviar e-mail de nova designação (Cadastro)
        if (!evento.emails_cadastro_enviados.includes(colab.id)) {
          const enviado = await enviarEmailColaborador({
            email: colabInfo.email,
            nomeColaborador: colabInfo.name,
            evento: evento,
            tipo: 'cadastro'
          });
          if (enviado) {
            evento.emails_cadastro_enviados.push(colab.id);
            houveAlteracao = true;
          }
        }

        // 2. Enviar e-mail lembrete de 24h
        if (tempoAteServicoMs > 0 && tempoAteServicoMs <= 24 * 60 * 60 * 1000) {
          if (!evento.emails_24h_enviados.includes(colab.id)) {
            const enviado = await enviarEmailColaborador({
              email: colabInfo.email,
              nomeColaborador: colabInfo.name,
              evento: evento,
              tipo: '24h'
            });
            if (enviado) {
              evento.emails_24h_enviados.push(colab.id);
              houveAlteracao = true;
            }
          }
        }

        // 3. Enviar e-mail lembrete de 1h
        if (tempoAteServicoMs > 0 && tempoAteServicoMs <= 1 * 60 * 60 * 1000) {
          if (!evento.emails_1h_enviados.includes(colab.id)) {
            const enviado = await enviarEmailColaborador({
              email: colabInfo.email,
              nomeColaborador: colabInfo.name,
              evento: evento,
              tipo: '1h'
            });
            if (enviado) {
              evento.emails_1h_enviados.push(colab.id);
              houveAlteracao = true;
            }
          }
        }
      }
    }

    if (houveAlteracao) {
      console.log('[Email Job] Salvando novo histórico de envios no Supabase...');
      const { error: upsertErr } = await supabase.from('config').upsert({ id: 'calendario_eventos', data: eventos });
      if (upsertErr) {
        console.error('[Email Job] Erro ao salvar alterações no Supabase:', upsertErr);
      } else {
        console.log('[Email Job] Histórico atualizado com sucesso.');
      }
    } else {
      console.log('[Email Job] Nenhuma notificação enviada.');
    }

  } catch (error) {
    console.error('[Email Job] Erro no processamento de e-mails:', error);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'database.json');
const defaultData = { config: {}, transportes: [], experiencias: [], atracoes: [], rotas: {}, orcamentosDB: [], clientesDB: [] };

// --- PUBLIC ROUTES (No Auth Required) ---
app.use(express.json({
  limit: '50mb',
  verify: (req, res, buffer) => {
    if (req.originalUrl === '/api/integracoes/notion/webhook') {
      req.rawBody = Buffer.from(buffer);
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), { maxAge: '1d' }));
app.use('/css', express.static(path.join(__dirname, 'public', 'css'), { maxAge: '5m' }));

// Notion -> Supabase. Esta rota precisa ser pública para o Notion entregar os eventos.
// A assinatura é validada quando NOTION_WEBHOOK_VERIFICATION_TOKEN está configurado.
app.post('/api/integracoes/notion/webhook', (req, res) => {
  const verificationToken = req.body?.verification_token;
  if (verificationToken) {
    console.log('[Notion Mirror] verification_token recebido:', verificationToken);
    return res.status(200).json({ verification_token: verificationToken });
  }

  const secret = process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN;
  if (!secret) {
    return res.status(503).json({ error: 'Webhook do Notion ainda não foi ativado no servidor.' });
  }
  const signature = req.headers['x-notion-signature'];
  if (!notionMirror.verifyWebhookSignature(req.rawBody, signature, secret)) {
    return res.status(401).json({ error: 'Assinatura do webhook inválida.' });
  }

  res.status(200).json({ received: true });
  setImmediate(() => {
    notionMirror.processWebhookEvent(req.body)
      .catch(error => console.error('[Notion Mirror] Falha no webhook:', error.message));
  });
});

app.post('/api/public/cadastro', async (req, res) => {
  try {
    const {
      nome,
      email,
      viajantes,
      adultos,
      criancas,
      dataInicio,
      dataFim,
      vooChegada,
      vooPartida,
      hotel,
      observacoes,
      // novos campos de preferências
      profissoes,
      necessidadesEspeciais,
      cidadesPretendeVisitar,
      prioridades,
      ritmo,
      templos,
      caminhada,
      refeicoes,
      interessesTour,
      experienciasSazonais,
      primeiraVez,
      ocasiaoEspecial,
      experienciasImperdiveis
    } = req.body;
    
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    // Prepare proper date object
    let dateObj = undefined;
    if (dataInicio && dataFim && dataInicio !== dataFim) {
      dateObj = { date: { start: dataInicio, end: dataFim } };
    } else if (dataInicio) {
      dateObj = { date: { start: dataInicio } };
    }

    const properties = {
      "Nome do Cliente": { title: [{ text: { content: nome } }] },
      "Status do Cliente": { select: { name: "Novo" } },
      "Qtd Adultos": { number: parseInt(adultos) || 0 },
      "Qtd Crianças": { number: parseInt(criancas) || 0 }
    };
    
    if (vooChegada) properties["Voo de Chegada"] = { rich_text: [{ text: { content: vooChegada } }] };
    if (vooPartida) properties["Voo de Partida"] = { rich_text: [{ text: { content: vooPartida } }] };
    if (hotel) properties["Hotel"] = { rich_text: [{ text: { content: hotel } }] };
    if (dateObj) properties["Período da Viagem"] = dateObj;
    
    if (email) {
      const firstEmail = email.split('\n')[0].trim();
      if (firstEmail) properties['Email'] = { email: firstEmail };
    }
    if (viajantes) properties['Nome dos Viajantes'] = { rich_text: [{ text: { content: viajantes } }] };
    if (observacoes) properties['Observações'] = { rich_text: [{ text: { content: observacoes } }] };

    // Adiciona as 3 colunas estruturadas novas no Notion se fornecidas
    if (profissoes) properties["Profissão dos Viajantes"] = { rich_text: [{ text: { content: profissoes } }] };
    if (ocasiaoEspecial) properties["Ocasião Especial"] = { rich_text: [{ text: { content: ocasiaoEspecial } }] };
    if (necessidadesEspeciais) properties["Necessidades Especiais"] = { rich_text: [{ text: { content: necessidadesEspeciais } }] };

    // Construção dos blocos do Notion (children) para o relatório estruturado no corpo do card
    const childrenBlocks = [];
    
    childrenBlocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "⛩️ Perfil de Viagem & Preferências" } }]
      }
    });

    if (cidadesPretendeVisitar) {
      childrenBlocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [
            { type: "text", text: { content: "Cidades que pretende visitar: " }, annotations: { bold: true } },
            { type: "text", text: { content: cidadesPretendeVisitar } }
          ]
        }
      });
    }

    childrenBlocks.push({
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [{ type: "text", text: { content: "🏃 Estilo e Ritmo" } }]
      }
    });

    if (ritmo) {
      childrenBlocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            { type: "text", text: { content: "Ritmo de Viagem: " }, annotations: { bold: true } },
            { type: "text", text: { content: ritmo } }
          ]
        }
      });
    }

    if (templos) {
      childrenBlocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            { type: "text", text: { content: "Visita a Templos: " }, annotations: { bold: true } },
            { type: "text", text: { content: templos } }
          ]
        }
      });
    }

    if (caminhada) {
      childrenBlocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            { type: "text", text: { content: "Ritmo de Caminhada: " }, annotations: { bold: true } },
            { type: "text", text: { content: caminhada } }
          ]
        }
      });
    }

    if (refeicoes) {
      childrenBlocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            { type: "text", text: { content: "Estilo de Refeições: " }, annotations: { bold: true } },
            { type: "text", text: { content: refeicoes } }
          ]
        }
      });
    }

    childrenBlocks.push({
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [{ type: "text", text: { content: "🎯 Interesses & Prioridades" } }]
      }
    });

    if (prioridades) {
      const prioText = Array.isArray(prioridades) ? prioridades.join(', ') : prioridades;
      childrenBlocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            { type: "text", text: { content: "Prioridades de Viagem: " }, annotations: { bold: true } },
            { type: "text", text: { content: prioText } }
          ]
        }
      });
    }

    if (interessesTour) {
      const intText = Array.isArray(interessesTour) ? interessesTour.join(', ') : interessesTour;
      childrenBlocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            { type: "text", text: { content: "Foco dos Tours Guiados: " }, annotations: { bold: true } },
            { type: "text", text: { content: intText } }
          ]
        }
      });
    }

    if (primeiraVez) {
      childrenBlocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            { type: "text", text: { content: "Primeira vez no Japão? " }, annotations: { bold: true } },
            { type: "text", text: { content: primeiraVez } }
          ]
        }
      });
    }

    if (experienciasSazonais) {
      childrenBlocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            { type: "text", text: { content: "Interesse em experiências sazonais? " }, annotations: { bold: true } },
            { type: "text", text: { content: experienciasSazonais } }
          ]
        }
      });
    }

    if (experienciasImperdiveis) {
      childrenBlocks.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [{ type: "text", text: { content: "🌸 Experiências Imperdíveis & Desejos" } }]
        }
      });

      childrenBlocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: experienciasImperdiveis } }]
        }
      });
    }

    const payloadNotion = {
      parent: { database_id: NOTION_CLIENTS_DB_ID },
      properties: properties
    };

    if (childrenBlocks.length > 0) {
      payloadNotion.children = childrenBlocks;
    }

    const response = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payloadNotion)
    });

    const result = await response.json();
    if (!response.ok) {
      console.error('Notion API Error:', result);
      return res.status(500).json({ error: 'Erro ao criar cliente no Notion', details: result });
    }

    // Gravar no Supabase a estrutura local correspondente (incluindo fotoPerfil)
    const cliId = result.id;
    await notionMirror.upsertPage('clientes', result);
    const currentEditingViajantes = [];
    if (viajantes) {
      viajantes.split('\n').filter(l => l.trim()).forEach(line => {
        const text = line.trim();
        const ageMatch = text.match(/\((\d+)\)$/);
        let idade = '';
        let namePart = text;
        if (ageMatch) {
          idade = ageMatch[1];
          namePart = text.substring(0, ageMatch.index).trim();
        }
        const parts = namePart.split(/\s+/);
        const sobrenome = parts.length > 1 ? parts.pop() : '';
        currentEditingViajantes.push({ id: Date.now() + Math.random(), nome: parts.join(' '), sobrenome, idade });
      });
    }

    const currentEditingEstadias = [];
    if (hotel) {
      hotel.split('\n').filter(l => l.trim()).forEach(line => {
        let cidade = ''; let hotelName = line.trim(); let dataInicioEst = ''; let dataFimEst = '';
        const dateMatch = line.match(/\((\d{2}\/\d{2}\/\d{4})\s*(?:a|-|até)\s*(\d{2}\/\d{2}\/\d{4})\)/);
        if (dateMatch) {
          const parseDate = d => { const p = d.split('/'); return p[2]+'-'+p[1]+'-'+p[0]; };
          dataInicioEst = parseDate(dateMatch[1]); dataFimEst = parseDate(dateMatch[2]);
          hotelName = line.substring(0, dateMatch.index).trim();
        }
        const dashIndex = hotelName.indexOf(' - ');
        if (dashIndex > -1) {
          cidade = hotelName.substring(0, dashIndex).trim();
          hotelName = hotelName.substring(dashIndex + 3).trim();
        }
        currentEditingEstadias.push({ id: Date.now() + Math.random(), cidade, dataInicio: dataInicioEst, dataFim: dataFimEst, hotel: hotelName });
      });
    }

    const currentEditingEmails = [];
    if (email) {
      email.split('\n').filter(l => l.trim()).forEach(line => {
        currentEditingEmails.push({ id: Date.now() + Math.random(), email: line.trim() });
      });
    }

    await salvarClienteLocalCanonico(cliId, {
      id: cliId,
      nome,
      estadias: currentEditingEstadias,
      viajantes: currentEditingViajantes,
      emails: currentEditingEmails,
      fotoPerfil: req.body.fotoPerfil || "",
      preferencias: {
        profissoes,
        necessidadesEspeciais,
        cidadesPretendeVisitar,
        prioridades,
        ritmo,
        templos,
        caminhada,
        refeicoes,
        interessesTour,
        experienciasSazonais,
        primeiraVez,
        ocasiaoEspecial,
        experienciasImperdiveis
      }
    });

    res.json({ success: true, client: result });
  } catch (error) {
    console.error('Erro na rota /api/public/cadastro:', error);
    res.status(500).json({ error: error.message });
  }
});
// ----------------------------------------

const basicAuth = require('express-basic-auth');

// -------- ROTAS PÚBLICAS (sem senha) --------
// Deve ser registrado ANTES do middleware de autenticação global

// Página de cadastro do cliente — sempre pública
app.get('/cadastro', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cadastro.html'));
});

// (A API POST /api/public/cadastro já está registrada acima, antes deste bloco.)

// -------- SESSÃO POR COOKIE (login uma vez, fica logado ~180 dias) --------
// Resolve o problema do app instalado no celular (PWA) pedindo senha toda hora:
// o Basic Auth continua aceito, mas o caminho principal vira o cookie assinado.
const SESSAO_DIAS = 180;

function assinarSessao(exp) {
  return require('crypto').createHmac('sha256', process.env.APP_PASS || 'dev')
    .update('sess|' + exp).digest('hex');
}

function sessaoValida(req) {
  if (!process.env.APP_PASS) return false;
  const raw = req.headers.cookie || '';
  const m = raw.match(/(?:^|;\s*)heian_sess=([^;]+)/);
  if (!m) return false;
  const partes = decodeURIComponent(m[1]).split('.');
  if (partes.length !== 2) return false;
  const [exp, sig] = partes;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const esperado = assinarSessao(exp);
  try {
    return require('crypto').timingSafeEqual(Buffer.from(sig), Buffer.from(esperado));
  } catch (e) { return false; }
}

// Página de login (pública)
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', (req, res) => {
  const { usuario, senha } = req.body || {};
  const userOk = (usuario || 'admin') === (process.env.APP_USER || 'admin');
  const passOk = !!process.env.APP_PASS && senha === process.env.APP_PASS;
  if (!userOk || !passOk) {
    return res.status(401).json({ success: false, error: 'Usuário ou senha incorretos.' });
  }
  const exp = Date.now() + SESSAO_DIAS * 24 * 60 * 60 * 1000;
  const token = exp + '.' + assinarSessao(String(exp));
  const seguro = req.secure || (req.headers['x-forwarded-proto'] === 'https');
  res.setHeader('Set-Cookie',
    `heian_sess=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSAO_DIAS * 24 * 60 * 60}${seguro ? '; Secure' : ''}`);
  res.json({ success: true });
});

app.get('/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'heian_sess=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.redirect('/login');
});

// -------- CARA PÚBLICA (home aberta) --------
// A raiz "/" é pública: visitante DESLOGADO vê a "Em Breve" (public/index.html).
// Todo o resto do site continua protegido pela trava de senha abaixo.
// Logado: cai no next() e recebe o portal normal (rota app.get('/') original, mais abaixo).
// FASE 2: quando a landing nova for aprovada, trocar 'index.html' pelo arquivo dela.
app.get('/', (req, res, next) => {
  if (typeof sessaoValida === 'function' && sessaoValida(req)) return next();
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -------- AUTENTICAÇÃO GLOBAL --------
// Protege tudo com senha, exceto as rotas públicas (cadastro e área do cliente)
if (process.env.APP_PASS) {
  const users = {};
  users[process.env.APP_USER || 'admin'] = process.env.APP_PASS;

  app.use((req, res, next) => {
    // Libera: página de cadastro, área do cliente, APIs de cadastro e dados públicos do cliente
    // Usa prefixos com "/" no fim (ou igualdade exata) para não liberar caminhos parecidos por engano
    const rotasPublicas = [
      '/cadastro',
      '/api/public/cadastro',
      '/cliente',
      '/cliente.html',
      '/api/public/client-data',
      // Página escondida de indicações de hotéis (enviada ao cliente por link, sem senha)
      '/indicacoes-hoteis',
      '/indicacoes-hoteis.html',
      '/api/public/indicacoes',
      '/login',
      '/api/login',
      // Estáticos inofensivos referenciados pelas páginas públicas — sem isso,
      // o 401 deles faz o navegador do CLIENTE exibir o prompt de senha
      '/manifest.json',
      '/manifest-admin.json',
      '/service-worker.js',
      '/favicon.ico',
      // Chat cliente↔Heian: cada handler valida token do portal ou sessão admin
      '/api/chat'
    ];
    if (rotasPublicas.some(r => req.path === r || req.path.startsWith(r + '/'))) {
      return next();
    }
    // Libera a consulta pública de atrações, transportes e experiências para a Área do Cliente (somente GET)
    if (['/api/atracoes', '/api/transportes', '/api/experiencias'].includes(req.path) && req.method === 'GET') {
      return next();
    }
    // 1º: cookie de sessão válido
    if (sessaoValida(req)) return next();
    // 2º: navegação em página HTML sem sessão → tela de login amigável
    const aceitaHtml = (req.headers.accept || '').includes('text/html');
    const temBasic = (req.headers.authorization || '').startsWith('Basic ');
    if (aceitaHtml && req.method === 'GET' && !temBasic) {
      return res.redirect('/login');
    }
    // 3º: Basic Auth continua valendo (APIs, integrações, compatibilidade)
    return basicAuth({ users, challenge: true, realm: 'HeianTour' })(req, res, next);
  });
}

// Página principal (portal): protegida globalmente caso APP_PASS esteja configurado
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'portal.html'));
});

// Área admin: serve app.html (painel completo)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// Página escondida: curadoria de indicações de hotéis (link enviado ao cliente sob demanda)
app.get('/indicacoes-hoteis', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'indicacoes-hoteis.html'));
});

app.post('/api/admin/enviar-roteiro-email', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { sender, to, subject, body, attachment } = req.body;
    
    console.log('Requisicao de Envio de Email recebida:', {
      to,
      subject,
      sender,
      hasAttachment: !!attachment,
      attachmentName: attachment ? attachment.filename : null,
      attachmentLength: attachment && attachment.content ? attachment.content.length : 0
    });

    if (!to || !subject || !body) {
      return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes' });
    }

    // A conta que faz o login (SMTP Auth) é heiantour@gmail.com
    const smtpAuthUser = process.env.GMAIL_USER || 'heiantour@gmail.com';
    const smtpAuthPass = process.env.GMAIL_APP_PASS;

    if (!smtpAuthPass) {
      return res.status(500).json({ success: false, error: 'Senha de aplicativo do Gmail não configurada no servidor (.env)' });
    }

    // Definir o alias de e-mail e o nome com base no remetente selecionado
    const isDiogo = sender === 'diogo';
    const fromEmail = isDiogo ? 'diogo@heiantour.com' : 'deborah@heiantour.com';
    const senderName = isDiogo ? 'Diogo' : 'Deborah';

    // Converter quebras de linha em parágrafos do e-mail pessoal
    let htmlContent = body
      .split('\n\n')
      .map(p => `<p style="margin: 0 0 16px 0; line-height: 1.6; color: #333333; font-size: 15px;">${p.replace(/\n/g, '<br>')}</p>`)
      .join('');

    // Detectar link do roteiro e substituir por link limpo
    const linkRegex = /(https?:\/\/heiantour[^\s]+|https?:\/\/localhost[^\s]+)/gi;
    const match = body.match(linkRegex);
    if (match && match[0]) {
      const linkUrl = match[0];
      // Criar um botão discreto de link (estilo transacional pessoal, evita caixa de promoções)
      const btnHtml = `
        <div style="margin: 24px 0;">
          <a href="${linkUrl}" target="_blank" style="display: inline-block; background-color: #8e1c1c; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px;">
            Acessar Roteiro Interativo
          </a>
        </div>
      `;
      // Remover a URL em texto do HTML e adicionar o botão
      htmlContent = htmlContent.replace(linkUrl, '').replace('<br>' + linkUrl, '').replace(linkUrl + '<br>', '');
      htmlContent += btnHtml;
    }

    // Layout de e-mail pessoal e limpo (evita a aba "Promoções" e vai para a Principal)
    const mailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #333333; line-height: 1.6; max-width: 600px; padding: 10px 0;">
        ${htmlContent}
        <br>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 24px 0;">
        <p style="font-size: 12px; color: #888888; line-height: 1.4; margin: 0;">
          Atenciosamente,<br>
          <strong>${senderName}</strong><br>
          Heian Tour &mdash; Curadoria de Viagens ao Japão<br>
          <a href="mailto:${fromEmail}" style="color: #8e1c1c; text-decoration: none;">${fromEmail}</a>
        </p>
      </div>
    `;

    // Processar o anexo se existir
    const attachments = [];
    if (attachment && attachment.content) {
      // Extração robusta do conteúdo Base64 (remove cabeçalho Data URI se houver)
      let base64Data = attachment.content;
      if (base64Data.includes(';base64,')) {
        base64Data = base64Data.substring(base64Data.indexOf(';base64,') + 8);
      } else if (base64Data.includes(',')) {
        base64Data = base64Data.substring(base64Data.indexOf(',') + 1);
      }

      const buffer = Buffer.from(base64Data, 'base64');
      attachments.push({
        filename: attachment.filename || 'roteiro.pdf',
        content: buffer,
        contentType: 'application/pdf'
      });

      console.log('Anexo PDF processado e adicionado:', {
        filename: attachment.filename,
        originalLength: attachment.content.length,
        base64Length: base64Data.length,
        bufferLength: buffer.length
      });
    } else {
      console.log('Nenhum anexo encontrado ou recebido no body.');
    }

    // Enviar e-mail usando o transporter global (autenticado com heiantour@gmail.com)
    // O Google aceita desde que fromEmail esteja configurado como alias em heiantour@gmail.com
    await transporter.sendMail({
      from: `"${senderName} | Heian Tour" <${fromEmail}>`,
      replyTo: fromEmail,
      to,
      subject,
      html: mailHtml,
      attachments
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao enviar e-mail do roteiro:', error);
    res.status(500).json({ success: false, error: 'Falha ao enviar e-mail', details: error.message });
  }
});

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();
    if (ext === '.html' || fileName === 'service-worker.js') {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      return;
    }
    if (ext === '.js' || ext === '.css') {
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

// Helpers
async function readDB() {
  try {
    const defaultData = { config: {}, transportes: [], experiencias: [], atracoes: [], rotas: {}, orcamentosDB: [], clientesDB: [] };
    
    const [cfgRes, transpRes, expRes, atrRes, orcsRes, clisRes, rotsRes, baseRes] = await Promise.all([
      supabase.from('config').select('data').eq('id', 'app_config').single(),
      supabase.from('config').select('data').eq('id', 'transportes').single(),
      supabase.from('config').select('data').eq('id', 'experiencias').single(),
      supabase.from('config').select('data').eq('id', 'atracoes').single(),
      supabase.from('orcamentos').select('data'),
      supabase.from('clientes_locais').select('data'),
      supabase.from('roteiros').select('*'),
      supabase.from('rotas_base').select('data').eq('id', 'base').single()
    ]);
    const falhas = [
      ['app_config', cfgRes], ['transportes', transpRes], ['experiencias', expRes],
      ['atracoes', atrRes], ['orcamentos', orcsRes], ['clientes_locais', clisRes],
      ['roteiros', rotsRes], ['rotas_base', baseRes]
    ].filter(([, result]) => result.error && result.error.code !== 'PGRST116');
    if (falhas.length) {
      throw new Error('Falha ao ler Supabase: ' + falhas.map(([nome, result]) => `${nome}: ${result.error.message}`).join(' | '));
    }

    if (cfgRes.data && cfgRes.data.data) defaultData.config = cfgRes.data.data;
    if (transpRes.data && transpRes.data.data) defaultData.transportes = transpRes.data.data;
    if (expRes.data && expRes.data.data) defaultData.experiencias = expRes.data.data;
    if (atrRes.data && atrRes.data.data) defaultData.atracoes = atrRes.data.data;
    
    if (orcsRes.data) defaultData.orcamentosDB = orcsRes.data.map(r => r.data);
    if (clisRes.data) defaultData.clientesDB = clisRes.data.map(r => r.data);
    
    if (rotsRes.data) {
      rotsRes.data.forEach(r => {
        defaultData.rotas[r.nome] = r.data;
      });
    }
    
    if (baseRes.data && baseRes.data.data) {
      defaultData.rotas['[PLANILHA] Base de Rotas'] = { dias: baseRes.data.data };
    }

    return defaultData;
  } catch(e) {
    console.error('Erro no readDB do Supabase:', e);
    throw e;
  }
}

async function writeDB(db) {
  try {
    // Para simplificar essa transição imediata 1:1, gravamos as tabelas chaves
    const resCfg = await supabase.from('config').upsert({ id: 'app_config', data: db.config || {} });
    if (resCfg.error) throw new Error('Error upsert app_config: ' + resCfg.error.message);
    const resTransp = await supabase.from('config').upsert({ id: 'transportes', data: db.transportes || [] });
    if (resTransp.error) throw new Error('Error upsert transportes: ' + resTransp.error.message);
    const resExp = await supabase.from('config').upsert({ id: 'experiencias', data: db.experiencias || [] });
    if (resExp.error) throw new Error('Error upsert experiencias: ' + resExp.error.message);
    const resAtr = await supabase.from('config').upsert({ id: 'atracoes', data: db.atracoes || [] });
    if (resAtr.error) throw new Error('Error upsert atracoes: ' + resAtr.error.message);

    for (let o of db.orcamentosDB || []) {
      const resOrc = await supabase.from('orcamentos').upsert({ id: String(o.id), data: o });
      if (resOrc.error) throw new Error('Error upsert orcamento ' + o.id + ': ' + resOrc.error.message);
    }
    for (let c of db.clientesDB || []) {
      const resCli = await supabase.from('clientes_locais').upsert({ id: String(c.id), data: c });
      if (resCli.error) throw new Error('Error upsert cliente_local ' + c.id + ': ' + resCli.error.message);
    }

    // Deleta rotas velhas e insere novas
    for (let [nome, dados] of Object.entries(db.rotas || {})) {
      if (nome === '[PLANILHA] Base de Rotas') {
        const resBase = await supabase.from('rotas_base').upsert({ id: 'base', data: dados.dias });
        if (resBase.error) throw new Error('Error upsert rotas_base: ' + resBase.error.message);
      } else {
        const resRoteiro = await supabase.from('roteiros').upsert({ nome, data: dados });
        if (resRoteiro.error) throw new Error('Error upsert roteiro ' + nome + ': ' + resRoteiro.error.message);
      }
    }
  } catch(e) {
    console.error('Erro no writeDB:', e);
    throw e;
  }
}

const globalErrorLogs = [];
const originalConsoleError = console.error;
console.error = function(...args) {
  globalErrorLogs.unshift({ time: new Date().toISOString(), args: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)) });
  if (globalErrorLogs.length > 50) globalErrorLogs.pop();
  originalConsoleError.apply(console, args);
};

// Auxiliar para sincronização em duas vias com o Google Sheets via Apps Script Web App
async function syncToGoogleSheets(type, action, data, oldData = null) {
  const { data: cfgRow, error: cfgError } = await supabase.from('config').select('data').eq('id', 'app_config').maybeSingle();
  if (cfgError) {
    return { ok: false, queued: false, error: `Configuração do Sheets indisponível: ${cfgError.message}` };
  }
  const config = cfgRow?.data || {};
  const { sheets_script_url, sheets_aba_transportes, sheets_aba_experiencias, sheets_aba_atracoes, sheets_aba_rotas, sheets_aba_hoteis } = config;
  if (!sheets_script_url) return { ok: false, queued: false, error: 'Apps Script não configurado' };

  let sheetName = '';
  if (type === 'transportes') sheetName = sheets_aba_transportes || 'Base';
  else if (type === 'experiencias') sheetName = sheets_aba_experiencias || 'BaseEX';
  else if (type === 'atracoes') sheetName = sheets_aba_atracoes || 'Atracoes';
  else if (type === 'rotas') sheetName = sheets_aba_rotas || 'Rotas';
  else if (type === 'hoteis') sheetName = sheets_aba_hoteis || 'Hotéis';

  const payload = { action, type, sheetName, data, oldData };
  try {
    const response = await fetch(sheets_script_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Apps Script HTTP ${response.status}`);
    const resVal = await response.json();
    if (!resVal.ok) throw new Error(resVal.error || 'Apps Script recusou a operação');
    console.log(`[Google Sheets Sync] ${action.toUpperCase()} ${type}:`, resVal);
    return { ok: true, queued: false, result: resVal };
  } catch (err) {
    console.error(`[Google Sheets Sync Error] ${action} ${type}:`, err.message);
    try {
      const { data: row } = await supabase.from('config').select('data').eq('id', 'sheets_sync_outbox').maybeSingle();
      const fila = Array.isArray(row?.data) ? row.data : [];
      fila.push({
        id: require('crypto').randomUUID(),
        criadoEm: new Date().toISOString(),
        tentativas: 0,
        ultimoErro: err.message,
        payload
      });
      const { error } = await supabase.from('config').upsert({ id: 'sheets_sync_outbox', data: fila.slice(-1000) });
      if (error) throw error;
      return { ok: false, queued: true, error: err.message };
    } catch (queueError) {
      console.error('[Google Sheets Sync Error] Falha também ao guardar na fila:', queueError.message);
      return { ok: false, queued: false, error: `${err.message}; fila: ${queueError.message}` };
    }
  }
}

async function processarFilaSheets() {
  const { data: cfgRow, error: cfgError } = await supabase.from('config').select('data').eq('id', 'app_config').maybeSingle();
  if (cfgError) throw cfgError;
  const url = cfgRow?.data?.sheets_script_url;
  if (!url) return;
  const { data: row } = await supabase.from('config').select('data').eq('id', 'sheets_sync_outbox').maybeSingle();
  const fila = Array.isArray(row?.data) ? row.data : [];
  if (!fila.length) return;
  const restantes = [];
  for (const item of fila) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload)
      });
      if (!r.ok) throw new Error(`Apps Script HTTP ${r.status}`);
      const out = await r.json();
      if (!out.ok) throw new Error(out.error || 'Apps Script recusou a operação');
    } catch (e) {
      restantes.push({ ...item, tentativas: Number(item.tentativas || 0) + 1, ultimoErro: e.message, ultimaTentativaEm: new Date().toISOString() });
    }
  }
  await supabase.from('config').upsert({ id: 'sheets_sync_outbox', data: restantes });
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNC BASE ⇄ GOOGLE SHEETS À PROVA DE ERROS (v8: replaceAll/readAll em lote)
// Backup app→Sheets (upsert em lote, preserva fotos/fórmulas) + Import Sheets→app
// (prévia/diff + snapshot reversível). Substitui o sync frágil item-a-item.
// ═══════════════════════════════════════════════════════════════════════════
const BASE_TYPES = ['transportes', 'experiencias', 'atracoes', 'rotas', 'hoteis'];
const BASE_SCHEMAS = {
  transportes: {
    required: ['trecho', 'idade', 'tipo'],
    fields: ['id','trecho','idade','tipo','linha','categoria','preco_jpy','tempo','observacao','link','link_klook','compra','uso'],
    options: {
      idade: ['Adulto', 'Infantil'],
      tipo: ['Transfer','Shinkansen','Romancecar','Limited Express','Skyliner','Trem','Ônibus','Balsa','Multiplos transportes','Ingresso','Carro'],
      categoria: ['Reservado','Green Car','Ordinary','GranClass']
    }
  },
  experiencias: {
    required: ['nome'],
    fields: ['id','nome','tipo','cidade','descricao','preco_jpy','preco_crianca_jpy','duracao','link','janelaAbreDias','prazoDias','horarios','publico','sazonalidade','observacao']
  },
  atracoes: {
    required: ['Nome da Atração', 'Cidade'],
    fields: ['id','Nome da Atração','Cidade','Bairro','Descrição Detalhada','Preço (Ingresso)','Google Maps','Link do Google Maps','mapsUrl','diasFechados','manutencaoInicio','manutencaoFim','manutencaoMotivo','Origem','Foto (URL)']
  },
  rotas: {
    required: ['nomeDaRota', 'cidade'],
    fields: ['id','nomeDaRota','cidade','atracoesDoDia']
  },
  hoteis: {
    required: ['Nome do Hotel', 'Cidade'],
    fields: ['id','Nome do Hotel','Cidade','Descrição','Foto (URL)','Link do Google Maps','Comodidades']
  }
};
const BASE_FIELD_KEYS = {
  transportes: BASE_SCHEMAS.transportes.fields,
  experiencias: BASE_SCHEMAS.experiencias.fields,
  atracoes: BASE_SCHEMAS.atracoes.fields,
  rotas: BASE_SCHEMAS.rotas.fields,
  hoteis: BASE_SCHEMAS.hoteis.fields
};
let baseOpcoesCarregadasEm = 0;
async function carregarOpcoesBase(force = false) {
  if (!force && Date.now() - baseOpcoesCarregadasEm < 60000) return;
  const { data, error } = await supabase.from('config').select('data').eq('id', 'base_opcoes').maybeSingle();
  if (error) throw error;
  const salvas = data?.data && typeof data.data === 'object' ? data.data : {};
  for (const [type, campos] of Object.entries(salvas)) {
    if (!BASE_SCHEMAS[type]?.options || !campos || typeof campos !== 'object') continue;
    for (const [campo, valores] of Object.entries(campos)) {
      if (!Array.isArray(valores) || !Array.isArray(BASE_SCHEMAS[type].options[campo])) continue;
      for (const valor of valores) {
        const limpo = String(valor || '').trim();
        if (limpo && !BASE_SCHEMAS[type].options[campo].some(x => x.toLowerCase() === limpo.toLowerCase())) {
          BASE_SCHEMAS[type].options[campo].push(limpo);
        }
      }
    }
  }
  baseOpcoesCarregadasEm = Date.now();
}
function novoIdBase(type) {
  return `${type.slice(0, 3)}_${require('crypto').randomUUID()}`;
}
function validarItemBase(type, item, { parcial = false } = {}) {
  const schema = BASE_SCHEMAS[type];
  if (!schema || !item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error('Dados inválidos para a Base.');
  }
  if (!parcial) {
    for (const campo of schema.required || []) {
      if (item[campo] === undefined || item[campo] === null || String(item[campo]).trim() === '') {
        throw new Error(`Campo obrigatório ausente: ${campo}`);
      }
    }
  }
  for (const [campo, opcoes] of Object.entries(schema.options || {})) {
    if (item[campo] !== undefined && item[campo] !== '' && !opcoes.includes(String(item[campo]).trim())) {
      throw new Error(`Valor inválido em ${campo}: ${item[campo]}`);
    }
  }
}
const baseWriteLocks = new Map();
async function comLockBase(type, tarefa) {
  const anterior = baseWriteLocks.get(type) || Promise.resolve();
  let liberar;
  const atual = new Promise(resolve => { liberar = resolve; });
  const fila = anterior.then(() => atual);
  baseWriteLocks.set(type, fila);
  await anterior;
  try { return await tarefa(); }
  finally {
    liberar();
    if (baseWriteLocks.get(type) === fila) baseWriteLocks.delete(type);
  }
}
async function criarItemConfigBase(type, body) {
  await carregarOpcoesBase();
  validarItemBase(type, body);
  return comLockBase(type, async () => {
    const { data, error } = await supabase.from('config').select('data').eq('id', type).maybeSingle();
    if (error) throw error;
    const list = Array.isArray(data?.data) ? data.data : [];
    const item = { ...body, id: novoIdBase(type) };
    list.push(item);
    const { error: saveError } = await supabase.from('config').upsert({ id: type, data: list });
    if (saveError) throw saveError;
    return item;
  });
}
async function atualizarItemConfigBase(type, id, body) {
  await carregarOpcoesBase();
  validarItemBase(type, body, { parcial: true });
  return comLockBase(type, async () => {
    const { data, error } = await supabase.from('config').select('data').eq('id', type).maybeSingle();
    if (error) throw error;
    const list = Array.isArray(data?.data) ? data.data : [];
    const wanted = String(id).trim().toLowerCase();
    const indices = list.map((x, i) => x?.id && String(x.id).trim().toLowerCase() === wanted ? i : -1).filter(i => i >= 0);
    if (!indices.length) return null;
    if (indices.length > 1) throw new Error(`ID duplicado na Base: ${id}. Operação bloqueada por segurança.`);
    const idx = indices[0];
    const oldItem = { ...list[idx] };
    const item = { ...list[idx], ...body, id: list[idx].id };
    validarItemBase(type, item);
    list[idx] = item;
    const { error: saveError } = await supabase.from('config').upsert({ id: type, data: list });
    if (saveError) throw saveError;
    return { item, oldItem };
  });
}
async function excluirItemConfigBase(type, id) {
  return comLockBase(type, async () => {
    const { data, error } = await supabase.from('config').select('data').eq('id', type).maybeSingle();
    if (error) throw error;
    const list = Array.isArray(data?.data) ? data.data : [];
    const wanted = String(id).trim().toLowerCase();
    const matches = list.filter(x => x?.id && String(x.id).trim().toLowerCase() === wanted);
    if (!matches.length) return null;
    if (matches.length > 1) throw new Error(`ID duplicado na Base: ${id}. Exclusão bloqueada por segurança.`);
    const next = list.filter(x => !x?.id || String(x.id).trim().toLowerCase() !== wanted);
    const { error: saveError } = await supabase.from('config').upsert({ id: type, data: next });
    if (saveError) throw saveError;
    return matches[0];
  });
}
function _abaDoTipo(config, type) {
  return ({
    transportes: config.sheets_aba_transportes || 'Base',
    experiencias: config.sheets_aba_experiencias || 'BaseEX',
    atracoes: config.sheets_aba_atracoes || 'Atracoes',
    rotas: config.sheets_aba_rotas || 'Rotas',
    hoteis: config.sheets_aba_hoteis || 'Hotéis'
  })[type];
}
async function lerBaseApp(type) {
  if (type === 'rotas') {
    const { data, error } = await supabase.from('rotas_base').select('data').eq('id', 'base').maybeSingle();
    if (error) throw error;
    return Array.isArray(data && data.data) ? data.data : [];
  }
  const { data, error } = await supabase.from('config').select('data').eq('id', type).maybeSingle();
  if (error) throw error;
  return Array.isArray(data && data.data) ? data.data : [];
}
async function gravarBaseApp(type, arr) {
  if (type === 'rotas') {
    const { error } = await supabase.from('rotas_base').upsert({ id: 'base', data: arr });
    if (error) throw error;
  } else {
    const { error } = await supabase.from('config').upsert({ id: type, data: arr });
    if (error) throw error;
  }
}
async function _chamarAppsScript(url, payload) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error('Apps Script HTTP ' + r.status);
  return await r.json();
}
function _normStr(v) {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.map(x => _normStr(x)).join(', ');
  return String(v).trim();
}
function _normCampoBase(type, campo, valor) {
  const normal = _normStr(valor);
  if (type === 'atracoes' && campo === 'Preço (Ingresso)' && /\d/.test(normal)) {
    return normal.replace(/[^\d-]/g, '');
  }
  if (type === 'atracoes' && (campo === 'manutencaoInicio' || campo === 'manutencaoFim') && normal) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(normal)) return normal;
    const data = new Date(normal);
    if (!Number.isNaN(data.getTime())) {
      const partes = new Intl.DateTimeFormat('en', {
        timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(data).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
      return `${partes.year}-${partes.month}-${partes.day}`;
    }
  }
  return normal;
}
function _difItem(type, a, b) {
  for (const k of (BASE_FIELD_KEYS[type] || [])) {
    if (k === 'id') continue;
    if (_normCampoBase(type, k, a[k]) !== _normCampoBase(type, k, b[k])) return true;
  }
  return false;
}
function _mergeImport(type, appItem, sheetItem) {
  const merged = Object.assign({}, appItem || {});
  for (const k of (BASE_FIELD_KEYS[type] || [])) {
    if (sheetItem[k] !== undefined) merged[k] = sheetItem[k];
  }
  return merged;
}
// Snapshot da base atual do app ANTES de sobrescrever (rede de segurança reversível).
async function _snapshotBaseApp(motivo) {
  const base = {};
  for (const t of BASE_TYPES) base[t] = await lerBaseApp(t);
  const { data } = await supabase.from('config').select('data').eq('id', 'base_snapshots').maybeSingle();
  let snaps = Array.isArray(data && data.data) ? data.data : [];
  snaps.push({ em: new Date().toISOString(), motivo: motivo || 'manual', base });
  snaps = snaps.slice(-3); // guarda só as 3 últimas
  const { error } = await supabase.from('config').upsert({ id: 'base_snapshots', data: snaps });
  if (error) throw error;
  return snaps.length;
}

// BACKUP app → Sheets (upsert em lote por aba, com conferência de contagem).
// Núcleo do backup app→Sheets (usado pela rota E pelo agendador diário).
async function _executarBackupSheets(tipos) {
  const db = await readDB();
  const url = db.config.sheets_script_url;
  if (!url) return { ok: false, semUrl: true, resultado: {} };
  const lista = (Array.isArray(tipos) && tipos.length) ? tipos : BASE_TYPES;
  const resultado = {};
  await Promise.all(lista.map(async (type) => {
    const arr = await lerBaseApp(type);
    const sheetName = _abaDoTipo(db.config, type);
    let r;
    try {
      await carregarOpcoesBase();
      r = await _chamarAppsScript(url, {
        action: 'replaceAll', type, sheetName, items: arr,
        validacoes: BASE_SCHEMAS[type]?.options || {}
      });
    }
    catch (e) { r = { ok: false, error: e.message }; }
    resultado[type] = {
      ok: !!r.ok, appCount: arr.length,
      atualizados: r.atualizados, inseridos: r.inseridos, totalSheet: r.totalSheet,
      aviso: (r.ok && r.totalSheet != null && r.totalSheet > arr.length) ? ('Sheets tem ' + (r.totalSheet - arr.length) + ' linha(s) a mais que o app — revisar') : null,
      erro: r.ok ? null : (r.error || 'falha')
    };
  }));
  return { ok: Object.values(resultado).every(x => x.ok), resultado };
}

// Backup diário AUTOMÁTICO da Base no Sheets (roda no server 24/7; ~4h, hora de baixa). Reagenda a cada 24h.
function agendarBackupDiarioSheets() {
  const HORA = 4;
  function msAteProxima() {
    const agora = new Date();
    const alvo = new Date(agora);
    alvo.setHours(HORA, 0, 0, 0);
    if (alvo <= agora) alvo.setDate(alvo.getDate() + 1);
    return alvo - agora;
  }
  async function rodar() {
    try {
      const r = await _executarBackupSheets();
      if (r.semUrl) console.log('[Backup diário Sheets] pulado (sem sheets_script_url).');
      else console.log('[Backup diário Sheets] ' + (r.ok ? 'OK' : 'com falhas') + ' — ' + JSON.stringify(r.resultado || {}));
    } catch (e) { console.error('[Backup diário Sheets] erro:', e.message); }
    setTimeout(rodar, 24 * 60 * 60 * 1000);
  }
  setTimeout(rodar, msAteProxima());
  console.log('[Backup diário Sheets] agendado para ~' + HORA + 'h (local do servidor).');
}

app.post('/api/base/backup-sheets', async (req, res) => {
  try {
    const tipos = (req.body && Array.isArray(req.body.tipos) && req.body.tipos.length) ? req.body.tipos : null;
    const out = await _executarBackupSheets(tipos);
    if (out.semUrl) return res.status(400).json({ error: 'URL do Apps Script (sheets_script_url) não configurada.' });
    res.json(out);
  } catch (e) { console.error('backup-sheets:', e); res.status(500).json({ error: e.message }); }
});

// IMPORT Sheets → app — PRÉVIA (dry-run): lê via readAll, valida, calcula diff. NÃO grava.
app.post('/api/base/importar-sheets/preview', async (req, res) => {
  try {
    const db = await readDB();
    const url = db.config.sheets_script_url;
    if (!url) return res.status(400).json({ error: 'URL do Apps Script não configurada.' });
    const tipos = (req.body && Array.isArray(req.body.tipos) && req.body.tipos.length) ? req.body.tipos : BASE_TYPES;
    const preview = {};
    await Promise.all(tipos.map(async (type) => {
      const sheetName = _abaDoTipo(db.config, type);
      let r;
      try { r = await _chamarAppsScript(url, { action: 'readAll', type, sheetName }); }
      catch (e) { preview[type] = { ok: false, erro: e.message }; return; }
      if (!r.ok) { preview[type] = { ok: false, erro: r.error || 'falha' }; return; }
      const sheetItems = r.items || [];
      const appItems = await lerBaseApp(type);
      const semId = sheetItems.filter(x => !x.id || String(x.id).trim() === '').length;
      const idsSheet = sheetItems.filter(x => x.id && String(x.id).trim()).map(x => String(x.id).trim());
      const idsDuplicados = idsSheet.length - new Set(idsSheet).size;
      const appById = new Map(appItems.filter(x => x.id).map(x => [String(x.id), x]));
      const sheetById = new Map(sheetItems.filter(x => x.id).map(x => [String(x.id), x]));
      let novos = 0, alterados = 0, iguais = 0;
      for (const [id, sIt] of sheetById) {
        const aIt = appById.get(id);
        if (!aIt) novos++;
        else if (_difItem(type, aIt, sIt)) alterados++;
        else iguais++;
      }
      const removidos = appItems.filter(a => a.id && !sheetById.has(String(a.id))).length;
      preview[type] = { ok: true, sheetCount: sheetItems.length, appCount: appItems.length, semId, idsDuplicados, novos, alterados, iguais, removidos };
    }));
    res.json({ ok: true, preview });
  } catch (e) { console.error('importar preview:', e); res.status(500).json({ error: e.message }); }
});

// IMPORT Sheets → app — APLICAR: snapshot + sobrescreve o app com os dados do Sheets (merge preserva campos do app fora do mapa).
app.post('/api/base/importar-sheets/aplicar', async (req, res) => {
  try {
    const db = await readDB();
    const url = db.config.sheets_script_url;
    if (!url) return res.status(400).json({ error: 'URL do Apps Script não configurada.' });
    const tipos = (req.body && Array.isArray(req.body.tipos) && req.body.tipos.length) ? req.body.tipos : BASE_TYPES;
    await _snapshotBaseApp('antes-do-import');
    const aplicado = {};
    await Promise.all(tipos.map(async (type) => {
      const sheetName = _abaDoTipo(db.config, type);
      let r;
      try { r = await _chamarAppsScript(url, { action: 'readAll', type, sheetName }); }
      catch (e) { aplicado[type] = { ok: false, erro: e.message }; return; }
      if (!r.ok) { aplicado[type] = { ok: false, erro: r.error || 'falha' }; return; }
      const sheetItems = (r.items || []).filter(x => x.id && String(x.id).trim() !== '');
      const idsImport = sheetItems.map(x => String(x.id).trim());
      const semIdCount = (r.items || []).length - sheetItems.length;
      const duplicadosCount = idsImport.length - new Set(idsImport).size;
      // GUARDA: o Sheets só pode substituir a Base quando todos os IDs são válidos e únicos.
      if (semIdCount > 0 || duplicadosCount > 0 || (sheetItems.length === 0 && (r.count || 0) > 0)) {
        aplicado[type] = { ok: false, erro: `Import bloqueado: ${semIdCount} linha(s) sem ID e ${duplicadosCount} ID(s) duplicado(s).` };
        return;
      }
      const appItems = await lerBaseApp(type);
      const appById = new Map(appItems.filter(x => x.id).map(x => [String(x.id), x]));
      const novos = sheetItems.map(sIt => _mergeImport(type, appById.get(String(sIt.id)), sIt));
      await gravarBaseApp(type, novos);
      aplicado[type] = { ok: true, importados: novos.length };
    }));
    res.json({ ok: true, aplicado, snapshot: 'guardado (últimas 3)' });
  } catch (e) { console.error('importar aplicar:', e); res.status(500).json({ error: e.message }); }
});

// Lista os snapshots da base (para o botão de restaurar).
app.get('/api/base/snapshots', async (req, res) => {
  try {
    const { data } = await supabase.from('config').select('data').eq('id', 'base_snapshots').maybeSingle();
    const snaps = Array.isArray(data && data.data) ? data.data : [];
    res.json(snaps.map((s, i) => ({ i, em: s.em, motivo: s.motivo, tamanhos: Object.fromEntries(BASE_TYPES.map(t => [t, (s.base && Array.isArray(s.base[t])) ? s.base[t].length : 0])) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Restaura a base do app a partir de um snapshot (undo do import). NÃO mexe no Sheets.
app.post('/api/base/snapshots/restaurar', async (req, res) => {
  try {
    const { data } = await supabase.from('config').select('data').eq('id', 'base_snapshots').maybeSingle();
    const snaps = Array.isArray(data && data.data) ? data.data : [];
    if (!snaps.length) return res.status(404).json({ error: 'Nenhum snapshot disponível.' });
    const idx = (req.body && req.body.i != null) ? Number(req.body.i) : (snaps.length - 1);
    const snap = snaps[idx];
    if (!snap || !snap.base) return res.status(404).json({ error: 'Snapshot inválido.' });
    // snapshot da base ATUAL antes de restaurar (pra poder desfazer a restauração também)
    await _snapshotBaseApp('antes-de-restaurar');
    for (const t of BASE_TYPES) {
      if (Array.isArray(snap.base[t])) await gravarBaseApp(t, snap.base[t]);
    }
    res.json({ ok: true, restaurado: snap.em });
  } catch (e) { console.error('restaurar snapshot:', e); res.status(500).json({ error: e.message }); }
});

app.get('/api/base/schema', async (req, res) => {
  try {
    await carregarOpcoesBase();
    res.json(BASE_SCHEMAS);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/base/opcoes', async (req, res) => {
  try {
    const type = String(req.body?.type || '').trim();
    const campo = String(req.body?.campo || '').trim();
    const valor = String(req.body?.valor || '').replace(/\s+/g, ' ').trim();
    const opcoesPadrao = BASE_SCHEMAS[type]?.options?.[campo];
    if (!Array.isArray(opcoesPadrao)) return res.status(400).json({ error: 'Campo de opções inválido.' });
    if (!valor || valor.length > 80) return res.status(400).json({ error: 'Informe um nome entre 1 e 80 caracteres.' });
    if (valor === '__nova__') return res.status(400).json({ error: 'Nome inválido.' });

    await carregarOpcoesBase(true);
    let final = BASE_SCHEMAS[type].options[campo].find(x => x.toLowerCase() === valor.toLowerCase());
    if (!final) {
      final = valor;
      BASE_SCHEMAS[type].options[campo].push(final);
      const { data, error } = await supabase.from('config').select('data').eq('id', 'base_opcoes').maybeSingle();
      if (error) throw error;
      const salvas = data?.data && typeof data.data === 'object' ? data.data : {};
      salvas[type] = salvas[type] && typeof salvas[type] === 'object' ? salvas[type] : {};
      salvas[type][campo] = Array.isArray(salvas[type][campo]) ? salvas[type][campo] : [];
      if (!salvas[type][campo].some(x => String(x).toLowerCase() === final.toLowerCase())) salvas[type][campo].push(final);
      const { error: saveError } = await supabase.from('config').upsert({ id: 'base_opcoes', data: salvas });
      if (saveError) throw saveError;
    }

    let sheets = { ok: false, error: 'Sheets não configurado' };
    try {
      const db = await readDB();
      if (db.config.sheets_script_url) {
        sheets = await _chamarAppsScript(db.config.sheets_script_url, {
          action: 'ensureSchema',
          type,
          sheetName: _abaDoTipo(db.config, type),
          validacoes: BASE_SCHEMAS[type].options
        });
      }
    } catch (e) {
      sheets = { ok: false, error: e.message };
    }
    res.json({ ok: true, valor: final, options: BASE_SCHEMAS[type].options[campo], _syncSheets: sheets });
  } catch (e) {
    console.error('base opcoes:', e);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/base/integridade', async (req, res) => {
  try {
    const resultado = {};
    for (const type of BASE_TYPES) {
      const items = await lerBaseApp(type);
      const ids = new Map();
      let semId = 0;
      const invalidos = [];
      items.forEach((item, index) => {
        const id = String(item?.id || '').trim();
        if (!id) semId++;
        else ids.set(id, (ids.get(id) || 0) + 1);
        try { validarItemBase(type, item); }
        catch (e) { invalidos.push({ index, id: id || null, erro: e.message }); }
      });
      resultado[type] = {
        total: items.length,
        semId,
        idsDuplicados: Array.from(ids.entries()).filter(([, count]) => count > 1).map(([id, count]) => ({ id, count })),
        invalidos
      };
    }
    const { data: filaRow } = await supabase.from('config').select('data').eq('id', 'sheets_sync_outbox').maybeSingle();
    res.json({ ok: true, bases: resultado, filaSheets: Array.isArray(filaRow?.data) ? filaRow.data.length : 0 });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/base/reparar-ids/preview', async (req, res) => {
  try {
    const preview = {};
    for (const type of BASE_TYPES) {
      const items = await lerBaseApp(type);
      const vistos = new Set();
      const trocas = [];
      items.forEach((item, index) => {
        const antigo = String(item?.id || '').trim();
        if (!antigo || vistos.has(antigo)) {
          trocas.push({ index, antigo: antigo || null, novo: novoIdBase(type) });
        } else {
          vistos.add(antigo);
        }
      });
      preview[type] = { total: items.length, trocas };
    }
    res.json({ ok: true, preview, aplica: false });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/base/reparar-ids/aplicar', async (req, res) => {
  try {
    if (req.body?.confirmacao !== 'REPARAR_IDS') {
      return res.status(400).json({ error: 'Confirmação inválida.' });
    }
    await _snapshotBaseApp('antes-de-reparar-ids');
    const aplicado = {};
    for (const type of BASE_TYPES) {
      const items = await lerBaseApp(type);
      const vistos = new Set();
      let trocas = 0;
      const next = items.map(item => {
        const antigo = String(item?.id || '').trim();
        if (!antigo || vistos.has(antigo)) {
          trocas++;
          return { ...item, id: novoIdBase(type) };
        }
        vistos.add(antigo);
        return item;
      });
      await gravarBaseApp(type, next);
      aplicado[type] = { total: next.length, trocas };
    }
    res.json({ ok: true, aplicado, snapshot: 'antes-de-reparar-ids' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ═══ INDICAÇÕES DE HOTÉIS (base dedicada, client-facing) ══════════════════════
async function _lerIndicacoes() {
  const { data } = await supabase.from('config').select('data').eq('id', 'hoteis_indicacoes').maybeSingle();
  return Array.isArray(data && data.data) ? data.data : [];
}
async function _gravarIndicacoes(arr) {
  const { error } = await supabase.from('config').upsert({ id: 'hoteis_indicacoes', data: arr });
  if (error) throw error;
}
app.get('/api/hoteis-indicacoes', async (req, res) => {
  try { res.json(await _lerIndicacoes()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/hoteis-indicacoes', async (req, res) => {
  try {
    const lista = await _lerIndicacoes();
    const novo = Object.assign({}, req.body, { id: 'hi_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });
    lista.push(novo);
    await _gravarIndicacoes(lista);
    res.json(novo);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/hoteis-indicacoes/:id', async (req, res) => {
  try {
    const lista = await _lerIndicacoes();
    const i = lista.findIndex(h => String(h.id) === String(req.params.id));
    if (i < 0) return res.status(404).json({ error: 'Indicação não encontrada' });
    lista[i] = Object.assign({}, lista[i], req.body, { id: lista[i].id });
    await _gravarIndicacoes(lista);
    res.json(lista[i]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/hoteis-indicacoes/:id', async (req, res) => {
  try {
    let lista = await _lerIndicacoes();
    lista = lista.filter(h => String(h.id) !== String(req.params.id));
    await _gravarIndicacoes(lista);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// ── SOLICITAÇÕES INTERNAS (task tracker Diogo↔Deborah) — array no config do Supabase ──
async function _lerSolicitacoes() {
  const { data } = await supabase.from('config').select('data').eq('id', 'solicitacoes').maybeSingle();
  return Array.isArray(data && data.data) ? data.data : [];
}
async function _gravarSolicitacoes(arr) {
  const { error } = await supabase.from('config').upsert({ id: 'solicitacoes', data: arr });
  if (error) throw error;
}
app.get('/api/solicitacoes', async (req, res) => {
  try { res.json(await _lerSolicitacoes()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/solicitacoes', async (req, res) => {
  try {
    const lista = await _lerSolicitacoes();
    const agora = new Date().toISOString();
    const nova = Object.assign({}, req.body, { id: 'sol_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), criadoEm: agora, atualizadoEm: agora });
    lista.push(nova);
    await _gravarSolicitacoes(lista);
    res.json(nova);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.put('/api/solicitacoes/:id', async (req, res) => {
  try {
    const lista = await _lerSolicitacoes();
    const i = lista.findIndex(x => String(x.id) === String(req.params.id));
    if (i < 0) return res.status(404).json({ error: 'Solicitação não encontrada' });
    lista[i] = Object.assign({}, lista[i], req.body, { id: lista[i].id, criadoEm: lista[i].criadoEm, atualizadoEm: new Date().toISOString() });
    await _gravarSolicitacoes(lista);
    res.json(lista[i]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/solicitacoes/:id', async (req, res) => {
  try {
    let lista = await _lerSolicitacoes();
    lista = lista.filter(x => String(x.id) !== String(req.params.id));
    await _gravarSolicitacoes(lista);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── OPÇÕES das Solicitações (pessoas / tipos / status / prioridades editáveis) ──
async function _lerSolicConfig() {
  const { data } = await supabase.from('config').select('data').eq('id', 'solic_config').maybeSingle();
  return (data && data.data && typeof data.data === 'object') ? data.data : {};
}
app.get('/api/solic-config', async (req, res) => {
  try { res.json(await _lerSolicConfig()); } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/solic-config', async (req, res) => {
  try {
    const atual = await _lerSolicConfig();
    const novo = Object.assign({}, atual, req.body || {});
    const { error } = await supabase.from('config').upsert({ id: 'solic_config', data: novo });
    if (error) throw error;
    res.json(novo);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Leitura PÚBLICA (para a página escondida de indicações) — só os ativos.
app.get('/api/public/indicacoes', async (req, res) => {
  try {
    const lista = (await _lerIndicacoes()).filter(h => h && h.ativo !== false);
    res.json(lista);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function syncNotionClienteValorTotal(notionClienteId, total) {
  if (!NOTION_TOKEN || !notionClienteId || !total || total <= 0) return;
  try {
    const res = await fetch(`https://api.notion.com/v1/pages/${notionClienteId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          'Valor Total': { number: Math.round(total) }
        }
      })
    });
    if (res.ok) {
      console.log(`[Notion Sync] Valor Total atualizado no Notion para cliente ${notionClienteId}: ¥${Math.round(total)}`);
    }
  } catch (err) {
    console.error('[Notion Sync Error]', err.message);
  }
}

// ── API: Config / Câmbio ────────────────────────────────────────────────────
app.get('/api/config', async (req, res) => {
  try {
    const { data, error } = await supabase.from('config').select('data').eq('id', 'app_config').single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data && data.data ? data.data : {});
  } catch(e) {
    console.error('Error getting config:', e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const { data, error: fetchErr } = await supabase.from('config').select('data').eq('id', 'app_config').single();
    if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
    const existing = data && data.data ? data.data : {};
    const updated = { ...existing, ...req.body };
    const { error: upsertErr } = await supabase.from('config').upsert({ id: 'app_config', data: updated });
    if (upsertErr) throw upsertErr;
    res.json({ ok: true });
  } catch(e) {
    console.error('Error saving config:', e);
    res.status(500).json({error: e.message});
  }
});

// Endpoints /api/debug e /api/debug-logs removidos por segurança:
// expunham a configuração completa (inclusive URLs internas) e logs de erro.

// ── API: Transportes ────────────────────────────────────────────────────────
app.get('/api/orcamentos', async (req, res) => {
  try {
    // egress: view orcamentos_light devolve os dados SEM _historico. Fallback p/ tabela base se a view não existir.
    let { data, error } = await supabase.from('orcamentos_light').select('data');
    if (error) ({ data, error } = await supabase.from('orcamentos').select('data'));
    if (error) throw error;
    // Filtra para retornar apenas os orçamentos ativos (não deletados)
    const ativos = data ? data.map(r => r.data).filter(item => item && !item.deletado) : [];
    res.json(ativos);
  } catch(e) {
    console.error('Error getting orcamentos:', e);
    res.status(500).json({error: e.message});
  }
});
// Sincroniza o status compradoHeian dos itens da COTAÇÃO de volta pro ROTEIRO no Supabase,
// em lote, ao salvar a cotação. Reaproveita o match da rota /sync-roteiro-item (refId, _dbId,
// descrição/nome). Só grava se algo mudou de fato (evita reescrever o roteiro e churn de versão).
// Tolerante a falhas: nunca deixa o salvamento da cotação quebrar por causa disso.
async function sincronizarStatusItensComRoteiro(dados) {
  try {
    if (!dados) return;
    const num = (v) => parseFloat(v) || 0;
    // FASE 2 — comercial do item vive no roteiro (el.comercial / dia.comercialTour).
    const comercialTransp = (t) => ({ preco: num(t.preco), precoInfantil: num(t.precoInfantil), taxaAtiva: !!t.taxaAtiva, taxaTipo: t.taxaTipo || 'grupo', taxaValor: num(t.taxaValor != null ? t.taxaValor : 3000) });
    const comercialExp = (e) => ({ preco: num(e.preco), pessoas: num(e.pessoas != null ? e.pessoas : 2), precoTipo: e.precoTipo || 'pessoa', taxaAtiva: !!e.taxaAtiva, taxaTipo: e.taxaTipo || 'grupo', taxaValor: num(e.taxaValor != null ? e.taxaValor : 3000) });
    const roteiroId = dados.roteiroId || dados.cliente?.roteiroId;
    const notionClienteId = dados.notionClienteId || dados.cliente?.notionClienteId;

    let rows = null;
    if (roteiroId) {
      const r = await supabase.from('roteiros').select('nome, data').eq('nome', roteiroId);
      rows = r.data;
    }
    if ((!rows || !rows.length) && notionClienteId) {
      const { data: all } = await supabase.from('roteiros').select('nome, data');
      rows = (all || []).filter(r => r.data && (r.data.notionClienteId === notionClienteId || r.data.cliente?.notionClienteId === notionClienteId));
    }
    if (!rows || !rows.length) return;

    const targetRow = rows[0];
    const rotData = targetRow.data || {};
    const dias = rotData.dias || [];
    let alterado = false;

    const setComercial = (el, novo) => {
      if (JSON.stringify(el.comercial || null) !== JSON.stringify(novo)) { el.comercial = novo; alterado = true; }
    };
    const aplicar = (tipo, item) => {
      const isHeian = item.compradoHeian !== false;
      dias.forEach(d => {
        (d.elementos || []).forEach(el => {
          if (tipo === 'transporte' && el.tipo === 'transporte') {
            // Casa por refId (único). Só cai em _dbId/descrição se o item não tiver refId (legado).
            // A descrição é fuzzy e casava transportes do MESMO tipo (ex.: 2x Limited Express),
            // fazendo um item revertê o compradoHeian do outro — foi o bug do "desmarca no F5".
            const casa = item._roteiroRefId ? (el.refId === item._roteiroRefId)
                       : item._dbId ? (el.trechoId == item._dbId)
                       : !!(item.descricao && el.tipoTransporte && item.descricao.toLowerCase().includes(el.tipoTransporte.toLowerCase()));
            if (casa) {
              if (el.compradoHeian !== isHeian) { el.compradoHeian = isHeian; alterado = true; }
              setComercial(el, comercialTransp(item));
            }
          } else if (tipo === 'experiencia' && el.tipo === 'experiencia') {
            const casa = item._roteiroRefId ? (el.refId === item._roteiroRefId)
                       : item._dbId ? (el.expId == item._dbId)
                       : !!(item.nome && el.nomeExp && (item.nome.toLowerCase().includes(el.nomeExp.toLowerCase()) || el.nomeExp.toLowerCase().includes(item.nome.toLowerCase())));
            if (casa) {
              if (el.compradoHeian !== isHeian) { el.compradoHeian = isHeian; alterado = true; }
              setComercial(el, comercialExp(item));
            }
          }
        });
      });
    };

    (dados.transportes || []).forEach(t => aplicar('transporte', t));
    (dados.experiencias || []).forEach(e => aplicar('experiencia', e));

    // Tours: comercial mora no dia (dia.comercialTour), casado por refId do dia.
    (dados.tours || []).forEach(t => {
      if (!t._roteiroRefId) return;
      const novo = { valor: num(t.valor), desconto: num(t.desconto != null ? t.desconto : 0), descontoAtivo: !!t.descontoAtivo };
      dias.forEach(d => {
        if (d.tourGuiado && d.refId && d.refId === t._roteiroRefId) {
          if (JSON.stringify(d.comercialTour || null) !== JSON.stringify(novo)) { d.comercialTour = novo; alterado = true; }
        }
      });
    });

    if (alterado) {
      await supabase.from('roteiros').update({ data: rotData }).eq('nome', targetRow.nome);
    }
  } catch (err) {
    console.error('sincronizarStatusItensComRoteiro:', err.message);
  }
}

// FASE 2 — todo roteiro COM CLIENTE já nasce com uma cotação vinculada (por roteiroId).
// Assim some o passo manual de "Gerar Cotação" e nenhuma cotação nasce sem vínculo (era a
// origem da divergência do Haddad). Idempotente: só cria se ainda não houver cotação ligada.
// Cotação avulsa (ballpark, sem roteiro) continua sendo criada normalmente pela aba Cotações.
async function garantirCotacaoDoRoteiro(roteiro) {
  try {
    if (!roteiro || !roteiro.id) return;
    const notionClienteId = roteiro.notionClienteId || (roteiro.cliente && roteiro.cliente.notionClienteId);
    if (!notionClienteId) return; // sem cliente = rascunho: não cria ainda
    const { data: orcRows } = await supabase.from('orcamentos').select('id, data');
    const jaTem = (orcRows || []).some(r => r.data && !r.data.deletado &&
      (r.data.roteiroId === roteiro.id || r.data.orcRoteiroVinculado === roteiro.id || (roteiro.nome && r.data.orcRoteiroVinculado === roteiro.nome)));
    if (jaTem) return;
    const agora = new Date().toISOString();
    const id = 'cot_' + roteiro.id; // determinístico → dedup mesmo em corrida de autosave
    const novo = {
      id,
      orcStatus: 'Pendente', statusVenda: 'Pendente',
      notionClienteId,
      nome: 'Cotação - ' + (roteiro.nome || 'Roteiro'),
      roteiroId: roteiro.id,
      orcRoteiroVinculado: roteiro.nome || '',
      cliente: roteiro.cliente || { nome: '', pessoas: '', dataOrcamento: '' },
      valoresTour: { '4h': 45000, '6h': 65000, '8h': 85000, '10h': 105000, '12h': 125000 },
      estadias: [], consultoria: { ativa: false, valor: 0, descricao: '' },
      tours: [], transportes: [], experiencias: [], itensAdicionais: [], textos: {},
      criadoEm: agora, atualizadoEm: agora
    };
    await supabase.from('orcamentos').upsert({ id, data: novo });
  } catch (e) {
    console.error('garantirCotacaoDoRoteiro:', e.message);
  }
}

app.post('/api/orcamentos', async (req, res) => {
  try {
    const corpo = { ...req.body };
    const baseVersao = corpo._baseVersao;
    delete corpo._baseVersao;

    // Guarda de versão: não deixa uma sessão gravar por cima de outra sem saber
    const { data: linha } = await supabase.from('orcamentos').select('data').eq('id', String(corpo.id)).maybeSingle();
    const armazenado = linha ? linha.data : null;
    if (conflitoDeVersao(baseVersao, armazenado)) {
      return res.status(409).json({
        success: false,
        error: 'conflict_version',
        message: 'Esta cotação foi alterada em outra sessão (outra aba ou outro usuário). Recarregue-a antes de continuar editando.',
        atualizadoEm: armazenado.atualizadoEm
      });
    }

    const dados = aplicarHistorico(corpo, armazenado);
    const { error } = await supabase.from('orcamentos').upsert({ id: String(dados.id), data: dados });
    if (error) throw error;

    // Sincronizar status dos itens (compradoHeian) no roteiro no Supabase
    // Guard: a Antigravity referenciou esta função mas ainda não a definiu — sem o guard,
    // TODO salvamento de cotação estourava 500 ("sincronizarStatusItensComRoteiro is not defined").
    // O sync por item (toggle) já roda em tempo real via /api/orcamentos/sync-roteiro-item.
    if (typeof sincronizarStatusItensComRoteiro === 'function') {
      Promise.resolve(sincronizarStatusItensComRoteiro(dados)).catch(err => console.error(err));
    }

    // Sincronizar Valor Total no Notion se houver cliente vinculado
    const notionClienteId = dados.notionClienteId || dados.cliente?.notionClienteId;
    if (notionClienteId) {
      const totalOrc = calcularTotalOrcamento(dados);
      if (totalOrc > 0) {
        syncNotionClienteValorTotal(notionClienteId, totalOrc);
      }
    }

    res.json({ success: true, atualizadoEm: dados.atualizadoEm });
  } catch(e) {
    res.status(500).json({error: e.message});
  }
});

app.post('/api/orcamentos/sync-roteiro-item', async (req, res) => {
  try {
    const { notionClienteId, roteiroId, tipo, item, campos } = req.body;
    if (!item) return res.status(400).json({ success: false, error: 'Item não fornecido' });

    // Resolve o roteiro alvo. IMPORTANTE: NUNCA cair num roteiro arbitrário (rows[0] de uma
    // query sem filtro) — isso pode gravar no roteiro de OUTRO cliente. Só usa o .eq('nome')
    // quando há roteiroId; se não houver (ou não achar), filtra pelo cliente do Notion.
    let rows = null;
    if (roteiroId) {
      const r = await supabase.from('roteiros').select('nome, data').eq('nome', roteiroId);
      rows = r.data;
    }
    if ((!rows || !rows.length) && notionClienteId) {
      const { data: rowsByClient } = await supabase.from('roteiros').select('nome, data');
      rows = (rowsByClient || []).filter(r => r.data && (r.data.notionClienteId === notionClienteId || r.data.cliente?.notionClienteId === notionClienteId));
    }

    if (!rows || !rows.length) {
      return res.json({ success: false, message: 'Nenhum roteiro vinculado encontrado.' });
    }

    let alterado = false;

    // Monta o pacote de campos a gravar no elemento do roteiro.
    // Fonte 1: `campos` explícito (Fase 1 — classe/data/etc). Fonte 2: compradoHeian do item (compat. retro toggle).
    const patch = {};
    if (campos && typeof campos === 'object') {
      Object.keys(campos).forEach(k => { if (campos[k] !== undefined && campos[k] !== null) patch[k] = campos[k]; });
    }
    if (item.compradoHeian !== undefined && patch.compradoHeian === undefined) {
      patch.compradoHeian = item.compradoHeian !== false;
    }
    const aplicarPatch = (el) => {
      let mud = false;
      Object.keys(patch).forEach(k => {
        // eslint-disable-next-line eqeqeq
        if (el[k] != patch[k]) { el[k] = patch[k]; mud = true; }
      });
      return mud;
    };
    const elCasa = (el) => {
      // Casa por refId (único) primeiro; _dbId/descrição só como fallback p/ item sem refId.
      if (tipo === 'transporte' && el.tipo === 'transporte') {
        if (item._roteiroRefId) return el.refId === item._roteiroRefId;
        if (item._dbId) return el.trechoId == item._dbId;
        return !!(item.descricao && el.tipoTransporte && item.descricao.toLowerCase().includes(el.tipoTransporte.toLowerCase()));
      }
      if (tipo === 'experiencia' && el.tipo === 'experiencia') {
        if (item._roteiroRefId) return el.refId === item._roteiroRefId;
        if (item._dbId) return el.expId == item._dbId;
        return !!(item.nome && el.nomeExp && (item.nome.toLowerCase().includes(el.nomeExp.toLowerCase()) || el.nomeExp.toLowerCase().includes(item.nome.toLowerCase())));
      }
      return false;
    };

    // Cliente pode ter mais de um roteiro (proposta alternativa, versões). Aplica no PRIMEIRO
    // roteiro candidato que realmente contém o elemento casado — evita gravar no roteiro errado.
    let rowSalvar = null, mudouNaRow = false;
    for (const row of rows) {
      const rd = row.data || {};
      const ds = rd.dias || [];
      let matchou = false, mudou = false;
      ds.forEach(d => (d.elementos || []).forEach(el => {
        if (elCasa(el)) { matchou = true; if (aplicarPatch(el)) mudou = true; }
      }));
      if (matchou) { rowSalvar = { nome: row.nome, data: rd }; mudouNaRow = mudou; break; }
    }

    if (rowSalvar && mudouNaRow) {
      await supabase.from('roteiros').update({ data: rowSalvar.data }).eq('nome', rowSalvar.nome);
      alterado = true;
    }

    // Sincronizar valor total no Notion se houver cliente
    if (notionClienteId) {
      const novoTotal = await valorPacoteDaCotacao(notionClienteId);
      if (novoTotal > 0) {
        syncNotionClienteValorTotal(notionClienteId, novoTotal);
      }
    }

    res.json({ success: true, alterado });
  } catch (error) {
    console.error('Erro em sync-roteiro-item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
app.delete('/api/orcamentos/:id', async (req, res) => {
  try {
    const id = req.params.id;
    // Soft Delete: carrega o orçamento atual, marca como deletado no JSON e atualiza
    const { data, error: fetchErr } = await supabase.from('orcamentos').select('data').eq('id', String(id)).single();
    if (fetchErr) throw fetchErr;
    
    const orc = data.data || {};
    orc.deletado = true;
    orc.deletadoEm = new Date().toISOString();
    
    const { error } = await supabase.from('orcamentos').upsert({ id: String(id), data: orc });
    if (error) throw error;
    res.json({success:true});
  } catch(e) {
    console.error('Error deleting orcamento:', e);
    res.status(500).json({error: e.message});
  }
});

// Clientes Local (Dados estruturados atrelados ao Notion)
// Grava um MARCO da timeline do cliente (ex.: materialEnviado) no clientes_locais, preservando o resto.
app.post('/api/clientes/:id/marco', async (req, res) => {
  try {
    const id = String(req.params.id);
    const { marco, valor } = req.body || {};
    if (!marco) return res.status(400).json({ error: 'marco ausente' });
    const { data: row } = await supabase.from('clientes_locais').select('data').eq('id', id).maybeSingle();
    const dados = (row && row.data) ? row.data : { id };
    dados.marcos = dados.marcos || {};
    dados.marcos[marco] = (valor === undefined ? true : valor);
    const { error } = await supabase.from('clientes_locais').upsert({ id, data: dados });
    if (error) throw error;
    res.json({ success: true, marcos: dados.marcos });
  } catch (e) {
    console.error('Erro em /api/clientes/:id/marco:', e);
    res.status(500).json({ error: e.message });
  }
});
app.post('/api/clientes/:id/portal-status', express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const { ativo } = req.body;
    const { data: row } = await supabase.from('clientes_locais').select('data').eq('id', id).maybeSingle();
    const dados = (row && row.data) ? row.data : { id };
    dados.portalAtivo = (ativo !== false);
    const { error } = await supabase.from('clientes_locais').upsert({ id, data: dados });
    if (error) throw error;
    res.json({ success: true, portalAtivo: dados.portalAtivo });
  } catch (e) {
    console.error('Erro ao atualizar portal-status:', e);
    res.status(500).json({ error: e.message });
  }
});
function normalizarDataEstadiaISO(valor) {
  const texto = String(valor || '').trim();
  if (!texto) return '';
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return texto;
}

function normalizarEstadias(estadias) {
  if (!Array.isArray(estadias)) return [];
  return estadias
    .filter(e => e && typeof e === 'object')
    .map((e, index) => ({
      ...e,
      id: e.id || `estadia_${Date.now()}_${index}`,
      cidade: String(e.cidade || '').trim(),
      hotel: String(e.hotel || '').trim(),
      dataInicio: normalizarDataEstadiaISO(e.dataInicio),
      dataFim: normalizarDataEstadiaISO(e.dataFim)
    }));
}

function formatarEstadiasParaNotion(estadias) {
  const fmtBR = valor => {
    const iso = normalizarDataEstadiaISO(valor);
    const partes = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : iso;
  };

  return normalizarEstadias(estadias).map(estadia => {
    const local = [estadia.cidade, estadia.hotel].filter(Boolean).join(' - ');
    const inicio = fmtBR(estadia.dataInicio);
    const fim = fmtBR(estadia.dataFim);
    const periodo = inicio && fim
      ? ` (${inicio} a ${fim})`
      : (inicio || fim ? ` (${inicio || fim})` : '');
    return `${local}${periodo}`.trim();
  }).filter(Boolean).join('\n');
}

async function salvarClienteLocalCanonico(idRecebido, alteracoes, { sincronizarNotion = true } = {}) {
  const realId = await resolverNotionIdReal(idRecebido);
  if (!realId) throw new Error('ID do cliente é obrigatório.');

  const { data: existenteRow, error: erroLeitura } = await supabase
    .from('clientes_locais')
    .select('data')
    .eq('id', realId)
    .maybeSingle();
  if (erroLeitura) throw erroLeitura;

  const patch = { ...(alteracoes || {}) };
  delete patch._temRegistroLocal;
  if (Object.prototype.hasOwnProperty.call(patch, 'estadias')) {
    if (Array.isArray(patch.estadias)) patch.estadias = normalizarEstadias(patch.estadias);
    else delete patch.estadias;
  }
  for (const campoEstruturado of ['viajantes', 'emails', 'vouchers']) {
    if (Object.prototype.hasOwnProperty.call(patch, campoEstruturado) && !Array.isArray(patch[campoEstruturado])) {
      delete patch[campoEstruturado];
    }
  }

  const dados = {
    ...((existenteRow && existenteRow.data) || {}),
    ...patch,
    id: realId
  };

  const { error: erroGravacao } = await supabase
    .from('clientes_locais')
    .upsert({ id: realId, data: dados });
  if (erroGravacao) throw erroGravacao;

  if (sincronizarNotion && Object.prototype.hasOwnProperty.call(patch, 'estadias')) {
    await sincronizarHoteisNoNotion(realId, dados.estadias);
  }

  return { realId, dados };
}

function arquivosVoucherLocal(voucher) {
  if (Array.isArray(voucher?.arquivos) && voucher.arquivos.length > 0) {
    return voucher.arquivos;
  }
  if (voucher?.url) {
    return [{
      id: 'legacy',
      url: voucher.url,
      fileName: voucher.fileName || voucher.nome || 'voucher'
    }];
  }
  return [];
}

function urlArquivoVoucherAdmin(clientId, voucherIndex, fileIndex, dataUrl) {
  const versao = require('crypto')
    .createHash('sha256')
    .update(String(dataUrl))
    .digest('hex')
    .slice(0, 16);
  return `/api/clientes/local/${encodeURIComponent(clientId)}/voucher-file/${voucherIndex}/${fileIndex}?v=${versao}`;
}

function prepararClienteLocalLeve(localObj, clientId) {
  const vouchers = Array.isArray(localObj?.vouchers) ? localObj.vouchers : [];
  const vouchersLeves = vouchers.map((voucher, voucherIndex) => {
    const arquivos = arquivosVoucherLocal(voucher).map((arquivo, fileIndex) => {
      const urlOriginal = String(arquivo?.url || '');
      return {
        ...arquivo,
        url: urlOriginal.startsWith('data:')
          ? urlArquivoVoucherAdmin(clientId, voucherIndex, fileIndex, urlOriginal)
          : urlOriginal
      };
    });
    const urlRaiz = String(voucher?.url || '');
    return {
      ...voucher,
      arquivos,
      url: voucher?.tipo === 'link'
        ? urlRaiz
        : (arquivos[0]?.url || (urlRaiz.startsWith('data:') ? '' : urlRaiz))
    };
  });

  return {
    ...localObj,
    vouchers: vouchersLeves
  };
}

app.get('/api/clientes/local/:id', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const idParam = String(req.params.id);
    const realId = await resolverNotionIdReal(idParam);
    const { data, error } = await supabase.from('clientes_locais').select('data').eq('id', realId).maybeSingle();
    if (error) throw error;
    const localObj = data && data.data ? { ...data.data } : null;

    if (localObj) {
      localObj.id = realId;
      localObj.estadias = normalizarEstadias(localObj.estadias);
      localObj._temRegistroLocal = true;
      res.json(req.query.light === '1' ? prepararClienteLocalLeve(localObj, realId) : localObj);
    } else {
      res.json({ id: realId, estadias: null, _temRegistroLocal: false });
    }
  } catch(e) {
    console.error('Error getting local client:', e);
    res.status(500).json({error: e.message});
  }
});

app.get('/api/clientes/local/:id/voucher-file/:voucherIndex/:fileIndex', async (req, res) => {
  try {
    const realId = await resolverNotionIdReal(String(req.params.id));
    const { data: row, error } = await supabase
      .from('clientes_locais')
      .select('data')
      .eq('id', realId)
      .maybeSingle();
    if (error) throw error;

    const localObj = row?.data || {};
    const voucherIndex = Number.parseInt(req.params.voucherIndex, 10);
    const fileIndex = Number.parseInt(req.params.fileIndex, 10);
    const voucher = Array.isArray(localObj.vouchers) ? localObj.vouchers[voucherIndex] : null;
    const arquivo = voucher ? arquivosVoucherLocal(voucher)[fileIndex] : null;
    const dataUrl = String(arquivo?.url || '');
    const match = dataUrl.match(/^data:([^;,]+)?(?:;[^,]*)?;base64,([\s\S]+)$/);
    if (!match) return res.status(404).send('Arquivo não encontrado.');

    const tiposPermitidos = new Set([
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'application/pdf', 'application/octet-stream'
    ]);
    const tipoOriginal = String(match[1] || 'application/octet-stream').toLowerCase();
    const contentType = tiposPermitidos.has(tipoOriginal) ? tipoOriginal : 'application/octet-stream';
    const conteudo = Buffer.from(match[2], 'base64');
    if (!conteudo.length) return res.status(404).send('Arquivo vazio.');

    const etag = `"${require('crypto').createHash('sha256').update(conteudo).digest('hex')}"`;
    if (req.headers['if-none-match'] === etag) return res.status(304).end();

    const nome = String(arquivo.fileName || voucher.fileName || voucher.nome || 'voucher')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${nome || 'voucher'}"`);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(conteudo);
  } catch (error) {
    console.error('Erro ao entregar arquivo de voucher no Admin:', error);
    return res.status(500).send('Erro ao carregar arquivo.');
  }
});

app.post('/api/clientes/local', async (req, res) => {
  try {
    if (!req.body || !req.body.id) return res.status(400).json({ error: 'ID do cliente é obrigatório.' });
    const salvo = await salvarClienteLocalCanonico(req.body.id, req.body);
    res.json({ success: true, id: salvo.realId, data: salvo.dados });
  } catch(e) {
    console.error('Error saving local client:', e);
    res.status(500).json({error: e.message});
  }
});
app.delete('/api/clientes/local/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('clientes_locais').delete().eq('id', String(req.params.id));
    if (error) throw error;
    res.json({success:true});
  } catch(e) {
    console.error('Error deleting local client:', e);
    res.status(500).json({error: e.message});
  }
});

app.get('/api/transportes', async (req, res) => {
  try {
    const { data, error } = await supabase.from('config').select('data').eq('id', 'transportes').single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data && data.data ? data.data : []);
  } catch(e) {
    console.error('Error getting transportes:', e);
    res.status(500).json({error: e.message});
  }
});

// Rotas genéricas de Config
app.get('/api/config/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase.from('config').select('data').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data && data.data ? data.data : {});
  } catch(e) {
    console.error(`Error getting config ${req.params.id}:`, e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/config/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('config').upsert({ id, data: req.body });
    if (error) throw error;
    res.json({success:true});
  } catch(e) {
    console.error(`Error saving config ${req.params.id}:`, e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/transportes', async (req, res) => {
  try {
    await carregarOpcoesBase();
    validarItemBase('transportes', req.body);
    const novo = await comLockBase('transportes', async () => {
      const { data, error: fetchErr } = await supabase.from('config').select('data').eq('id', 'transportes').single();
      if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
      const list = Array.isArray(data?.data) ? data.data : [];
      const item = { ...req.body, id: novoIdBase('transportes') };
      list.push(item);
      const { error: upsertErr } = await supabase.from('config').upsert({ id: 'transportes', data: list });
      if (upsertErr) throw upsertErr;
      return item;
    });
    const sheets = await syncToGoogleSheets('transportes', 'insert', novo);
    res.json({ ...novo, _syncSheets: sheets });
  } catch(e) {
    console.error('Error saving transporte:', e);
    res.status(500).json({error: e.message});
  }
});

app.put('/api/transportes/:id', async (req, res) => {
  try {
    await carregarOpcoesBase();
    validarItemBase('transportes', req.body, { parcial: true });
    const searchId = decodeURIComponent(req.params.id).trim().toLowerCase();
    const resultado = await comLockBase('transportes', async () => {
      const { data, error: fetchErr } = await supabase.from('config').select('data').eq('id', 'transportes').single();
      if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
      const list = Array.isArray(data?.data) ? data.data : [];
      const matches = list.map((t, i) => t?.id && String(t.id).trim().toLowerCase() === searchId ? i : -1).filter(i => i >= 0);
      if (matches.length === 0) return null;
      if (matches.length > 1) throw new Error(`ID duplicado na Base: ${req.params.id}. Operação bloqueada por segurança.`);
      const idx = matches[0];
      const oldItem = { ...list[idx] };
      list[idx] = { ...list[idx], ...req.body, id: list[idx].id };
      validarItemBase('transportes', list[idx]);
      const { error: upsertErr } = await supabase.from('config').upsert({ id: 'transportes', data: list });
      if (upsertErr) throw upsertErr;
      return { item: list[idx], oldItem };
    });
    if (!resultado) return res.status(404).json({ error: 'Não encontrado' });
    const sheets = await syncToGoogleSheets('transportes', 'update', resultado.item, resultado.oldItem);
    res.json({ ...resultado.item, _syncSheets: sheets });
  } catch(e) {
    console.error('Error updating transporte:', e);
    res.status(500).json({error: e.message});
  }
});

app.delete('/api/transportes/:id', async (req, res) => {
  try {
    const searchId = decodeURIComponent(req.params.id).trim().toLowerCase();
    const oldItem = await comLockBase('transportes', async () => {
      const { data, error: fetchErr } = await supabase.from('config').select('data').eq('id', 'transportes').single();
      if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
      const list = Array.isArray(data?.data) ? data.data : [];
      const matches = list.filter(t => t?.id && String(t.id).trim().toLowerCase() === searchId);
      if (matches.length > 1) throw new Error(`ID duplicado na Base: ${req.params.id}. Exclusão bloqueada por segurança.`);
      if (!matches.length) return null;
      const filteredList = list.filter(t => !t?.id || String(t.id).trim().toLowerCase() !== searchId);
      const { error: upsertErr } = await supabase.from('config').upsert({ id: 'transportes', data: filteredList });
      if (upsertErr) throw upsertErr;
      return matches[0];
    });
    if (!oldItem) return res.status(404).json({ error: 'Não encontrado' });
    const sheets = await syncToGoogleSheets('transportes', 'delete', oldItem);
    res.json({ ok: true, _syncSheets: sheets });
  } catch(e) {
    console.error('Error deleting transporte:', e);
    res.status(500).json({error: e.message});
  }
});

// ── API: Experiências ───────────────────────────────────────────────────────
app.get('/api/experiencias', async (req, res) => {
  try {
    const { data, error } = await supabase.from('config').select('data').eq('id', 'experiencias').single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data && data.data ? data.data : []);
  } catch(e) {
    console.error('Error getting experiencias:', e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/experiencias', async (req, res) => {
  try {
    const novo = await criarItemConfigBase('experiencias', req.body);
    const sheets = await syncToGoogleSheets('experiencias', 'insert', novo);
    res.json({ ...novo, _syncSheets: sheets });
  } catch(e) {
    console.error('Error saving experiencia:', e);
    res.status(500).json({error: e.message});
  }
});

app.put('/api/experiencias/:id', async (req, res) => {
  try {
    const resultado = await atualizarItemConfigBase('experiencias', decodeURIComponent(req.params.id), req.body);
    if (!resultado) return res.status(404).json({ error: 'Não encontrado' });
    const sheets = await syncToGoogleSheets('experiencias', 'update', resultado.item, resultado.oldItem);
    res.json({ ...resultado.item, _syncSheets: sheets });
  } catch(e) {
    console.error('Error updating experiencia:', e);
    res.status(500).json({error: e.message});
  }
});

app.delete('/api/experiencias/:id', async (req, res) => {
  try {
    const oldItem = await excluirItemConfigBase('experiencias', decodeURIComponent(req.params.id));
    if (!oldItem) return res.status(404).json({ error: 'Não encontrado' });
    const sheets = await syncToGoogleSheets('experiencias', 'delete', oldItem);
    res.json({ ok: true, _syncSheets: sheets });
  } catch(e) {
    console.error('Error deleting experiencia:', e);
    res.status(500).json({error: e.message});
  }
});

// ── API: Roteiros & Atrações ────────────────────────────────────────────────
app.post('/api/roteiros/gerar-ia', async (req, res) => {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(400).json({ error: 'Configuração da API do Gemini incompleta no arquivo .env (chave GEMINI_API_KEY ausente).' });
    }

    const { clienteId, promptAdicional, datas, clienteData } = req.body;
    let briefingCliente = '';
    let clienteNome = 'Cliente';

    // 1. Opcional: Buscar dados do cliente no Notion se houver clienteId
    if (clienteId && clienteId !== 'cliente_desconhecido' && process.env.NOTION_API_KEY) {
      try {
        const page = await notionMirror.getPage('clientes', clienteId);
        if (page) {
          const p = page.properties;
          clienteNome = p['Nome do Cliente']?.title?.map(t => t.plain_text).join('') || 
                        p['Name']?.title?.map(t => t.plain_text).join('') || 
                        p['Nome']?.title?.map(t => t.plain_text).join('') || 'Cliente';
          
          // Tentar ler alguma propriedade de briefing/observações
          const briefingProp = p['Briefing'] || p['Preferências'] || p['Observações'] || p['Descrição'];
          if (briefingProp) {
            briefingCliente = briefingProp.rich_text?.map(t => t.plain_text).join('') || '';
          }
        }
      } catch (err) {
        console.error('Erro ao ler briefing do cliente no Notion:', err.message);
      }
    }

    // 2. Buscar atrações da base de dados local (Supabase)
    const { data: cfgAtr } = await supabase.from('config').select('data').eq('id', 'atracoes').single();
    const listaAtracoes = cfgAtr && cfgAtr.data ? cfgAtr.data : [];
    
    // Condensar as atrações para enviar no prompt para não estourar limite e economizar tempo
    const atracoesFormatadas = {};
    listaAtracoes.forEach(a => {
      const cidade = (a.Cidade || 'Geral').trim();
      const nome = a['Nome da Atração'];
      if (nome) {
        if (!atracoesFormatadas[cidade]) atracoesFormatadas[cidade] = [];
        atracoesFormatadas[cidade].push(nome);
      }
    });

    const contextAtracoes = Object.entries(atracoesFormatadas)
      .map(([cidade, nomes]) => `- ${cidade}: ${nomes.slice(0, 50).join(', ')}`)
      .join('\n');

    // 3. Montar o prompt do Gemini
    const systemPrompt = `Você é um agente de viagens especialista em turismo de luxo no Japão para a operadora premium "Heian Tour".
Seu objetivo é planejar e estruturar um itinerário dia-a-dia de excelência, otimizado geograficamente e adequado aos interesses do viajante.

Você receberá um Briefing do Cliente, Instruções Adicionais e uma lista de Atrações Disponíveis por cidade que pertencem à nossa base de dados.
Dê preferência absoluta em utilizar as Atrações Disponíveis da lista que combinam com o perfil do cliente, organizando-as por dia e em ordem lógica de visitação.

Instruções importantes:
1. Organize o roteiro em ordem de dias (Dia 1, Dia 2, etc.).
2. Para cada dia, adicione um elemento do tipo "sequencia" (contendo a lista de atrações daquele dia) e opcionalmente um elemento do tipo "texto" contendo dicas do dia, sugestões de restaurantes ou observações importantes de logística.
3. Responda estritamente no formato JSON fornecido abaixo. Não retorne nenhum texto extra antes ou depois do JSON.

Modelo do JSON esperado de saída:
{
  "dias": [
    {
      "data": "YYYY-MM-DD",
      "cidade": "Nome da cidade principal do dia",
      "elementos": [
        {
          "tipo": "sequencia",
          "cidade": "Nome da cidade do passeio",
          "nomeDaRota": "Título descritivo da rota do dia (ex: Kyoto Histórico ou Asakusa e Ueno Tradicional)",
          "atracoesDoDia": []
        },
        {
          "tipo": "texto",
          "conteudo": "Recomendações especiais de restaurantes, logística ou dicas para este dia..."
        }
      ]
    }
  ]
}

Atrações Disponíveis no nosso banco de dados por cidade:\n${contextAtracoes}`;

    let infoClientePrompt = '';
    if (clienteData) {
      const adultos = clienteData.adultos || 2;
      const criancas = clienteData.criancas || 0;
      infoClientePrompt += `- Viajantes: ${adultos} adulto(s)${criancas > 0 ? ` e ${criancas} criança(s)` : ''}\n`;
      if (clienteData.vooChegada) infoClientePrompt += `- Voo de Chegada: ${clienteData.vooChegada}\n`;
      if (clienteData.vooPartida) infoClientePrompt += `- Voo de Partida: ${clienteData.vooPartida}\n`;
      
      if (Array.isArray(clienteData.estadias) && clienteData.estadias.length > 0) {
        infoClientePrompt += `- Cidades e Hotéis de Hospedagem (Estadias) agendadas:\n`;
        clienteData.estadias.forEach((est, idx) => {
          if (est.cidade) {
            let dataStr = '';
            if (est.dataInicio && est.dataFim) {
              const d1 = est.dataInicio.split('-').reverse().join('/');
              const d2 = est.dataFim.split('-').reverse().join('/');
              dataStr = ` de ${d1} a ${d2}`;
            }
            infoClientePrompt += `  * Estadia ${idx + 1}: ${est.cidade}${est.hotel ? ` no hotel ${est.hotel}` : ''}${dataStr}\n`;
          }
        });
      }
    }

    const userPrompt = `Briefing do Cliente (${clienteNome}):
${briefingCliente || 'Nenhum briefing específico fornecido.'}

Dados Cadastrados do Cliente no Roteiro:
${infoClientePrompt || 'Nenhum dado cadastrado.'}

Instruções Adicionais e Informações da Viagem (Datas, dias, estilo):
${promptAdicional || 'Nenhuma instrução adicional.'}
${datas ? `Data de início da viagem: ${datas}` : ''}

Por favor, gere o JSON do roteiro estruturado com base nas instruções e atrações fornecidas. Certifique-se de que os nomes de atrações colocados no array "atracoesDoDia" correspondam EXATAMENTE aos nomes presentes na lista de atrações por cidade fornecida.`;

    // 4. Chamar o Gemini via SDK oficial (@google/genai). O SDK trata internamente o
    //    formato de chave "AQ..." (auth key vinculada a conta de servico), que falha
    //    quando chamado por REST cru. Chaves "AIza..." tambem funcionam por aqui.
    const { GoogleGenAI } = require('@google/genai');
    const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    let responseText;
    try {
      const result = await genAI.models.generateContent({
        model: 'gemini-flash-latest',
        contents: systemPrompt + '\n\n' + userPrompt,
        config: { responseMimeType: 'application/json' }
      });
      responseText = result.text;
    } catch (apiErr) {
      throw new Error(`Erro na API do Gemini: ${apiErr.message}`);
    }
    if (!responseText) {
      throw new Error('A API do Gemini retornou uma resposta vazia ou em formato inesperado.');
    }

    // Fazer parse da resposta JSON da IA
    const roteiroGerado = JSON.parse(responseText.trim());
    res.json({ success: true, data: roteiroGerado });

  } catch (error) {
    console.error('Erro na geração do roteiro com IA:', error);
    res.status(500).json({ error: 'Erro ao gerar roteiro com IA', details: error.message });
  }
});

app.get('/api/atracoes', async (req, res) => {
  try {
    const { data, error } = await supabase.from('config').select('data').eq('id', 'atracoes').single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data && data.data ? data.data : []);
  } catch(e) {
    console.error('Error getting atracoes:', e);
    res.status(500).json({error: e.message});
  }
});

app.get('/api/hoteis', async (req, res) => {
  try {
    const { data, error } = await supabase.from('config').select('data').eq('id', 'hoteis').single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data && data.data ? data.data : []);
  } catch(e) {
    console.error('Error getting hoteis:', e);
    res.status(500).json({error: e.message});
  }
});

app.get('/api/templates-vouchers', async (req, res) => {
  try {
    const { data, error } = await supabase.from('config').select('data').eq('id', 'templates_vouchers').single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json(data && data.data ? data.data : []);
  } catch(e) {
    console.error('Error getting templates-vouchers:', e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/hoteis', async (req, res) => {
  try {
    const novo = await criarItemConfigBase('hoteis', req.body);
    const sheets = await syncToGoogleSheets('hoteis', 'insert', novo);
    res.json({ ...novo, _syncSheets: sheets });
  } catch(e) {
    console.error('Error saving hotel:', e);
    res.status(500).json({error: e.message});
  }
});

app.put('/api/hoteis/:id', async (req, res) => {
  try {
    const resultado = await atualizarItemConfigBase('hoteis', decodeURIComponent(req.params.id), req.body);
    if (!resultado) return res.status(404).json({ error: 'Hotel não encontrado' });
    const sheets = await syncToGoogleSheets('hoteis', 'update', resultado.item, resultado.oldItem);
    res.json({ ...resultado.item, _syncSheets: sheets });
  } catch(e) {
    console.error('Error updating hotel:', e);
    res.status(500).json({error: e.message});
  }
});

app.delete('/api/hoteis/:id', async (req, res) => {
  try {
    const oldItem = await excluirItemConfigBase('hoteis', decodeURIComponent(req.params.id));
    if (!oldItem) return res.status(404).json({ error: 'Hotel não encontrado' });
    const sheets = await syncToGoogleSheets('hoteis', 'delete', oldItem);
    res.json({ ok: true, _syncSheets: sheets });
  } catch(e) {
    console.error('Error deleting hotel:', e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/atracoes', async (req, res) => {
  try {
    if (req.body && req.body['Descrição Detalhada']) {
      req.body['Descrição Detalhada'] = req.body['Descrição Detalhada'].replace(/<[^>]*>?/gm, '').trim();
    }
    const novo = await criarItemConfigBase('atracoes', req.body);
    const sheets = await syncToGoogleSheets('atracoes', 'insert', novo);
    res.json({ ...novo, _syncSheets: sheets });
  } catch(e) {
    console.error('Error saving atracao:', e);
    res.status(500).json({error: e.message});
  }
});

app.put('/api/atracoes/:id', async (req, res) => {
  try {
    if (req.body && req.body['Descrição Detalhada']) {
      req.body['Descrição Detalhada'] = req.body['Descrição Detalhada'].replace(/<[^>]*>?/gm, '').trim();
    }
    const resultado = await atualizarItemConfigBase('atracoes', decodeURIComponent(req.params.id), req.body);
    if (!resultado) return res.status(404).json({ error: 'Não encontrado' });
    const sheets = await syncToGoogleSheets('atracoes', 'update', resultado.item, resultado.oldItem);
    res.json({ ...resultado.item, _syncSheets: sheets });
  } catch(e) {
    console.error('Error updating atracao:', e);
    res.status(500).json({error: e.message});
  }
});

app.delete('/api/atracoes/:id', async (req, res) => {
  try {
    const oldItem = await excluirItemConfigBase('atracoes', decodeURIComponent(req.params.id));
    if (!oldItem) return res.status(404).json({ error: 'Não encontrado' });
    const sheets = await syncToGoogleSheets('atracoes', 'delete', oldItem);
    res.json({ ok: true, _syncSheets: sheets });
  } catch(e) {
    console.error('Error deleting atracao:', e);
    res.status(500).json({error: e.message});
  }
});

// ── Identidade imutável dos roteiros ────────────────────────────────────────
// A coluna "nome" da tabela roteiros passa a guardar um ID imutável (rot_...).
// O nome de exibição vive em data.nome. Renomear nunca mais quebra vínculos.
function gerarIdRoteiro() {
  return 'rot_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

async function buscarTodosRoteiros() {
  const { data, error } = await supabase.from('roteiros').select('*');
  if (error) throw error;
  return data || [];
}

// Aceita: ID (rot_...), chave legada (nome antigo como chave física) ou nome de exibição
async function acharRoteiroPorChaveOuNome(param) {
  if (!param) return null;
  const { data: porChave } = await supabase.from('roteiros').select('*').eq('nome', param).maybeSingle();
  if (porChave) return porChave;
  if (String(param).startsWith('rot_')) return null;
  const todos = await buscarTodosRoteiros();
  return todos.find(r => r.data && r.data.nome === param) || null;
}

// Histórico embutido: guarda as últimas 5 versões dentro do próprio registro
// (no máximo 1 snapshot a cada 10 minutos, para não inflar com autosaves).
function aplicarHistorico(dadosNovos, dadosAntigos) {
  if (!dadosAntigos) return dadosNovos;
  const historicoAnterior = Array.isArray(dadosAntigos._historico) ? dadosAntigos._historico : [];
  const ultimo = historicoAnterior[historicoAnterior.length - 1];
  const agora = Date.now();
  const ultimoTs = ultimo ? Date.parse(ultimo.em) || 0 : 0;
  let novoHistorico = historicoAnterior;
  if (!ultimo || (agora - ultimoTs) > 10 * 60 * 1000) {
    const snapshot = { ...dadosAntigos };
    delete snapshot._historico;
    novoHistorico = [...historicoAnterior, { em: dadosAntigos.atualizadoEm || new Date().toISOString(), dados: snapshot }].slice(-2); // egress: 5→2 versões de histórico (front não lê _historico) — 2026-07-28
  }
  return { ...dadosNovos, _historico: novoHistorico };
}

// Conta o total de elementos do roteiro (soma dos elementos de cada dia).
// Base da trava anti-esvaziamento: um autosave que derruba isso bruscamente e recusado.
function contarElementosRoteiro(r) {
  try { return (r && Array.isArray(r.dias) ? r.dias : []).reduce((acc, d) => acc + ((d && Array.isArray(d.elementos)) ? d.elementos.length : 0), 0); }
  catch (e) { return 0; }
}

// Guarda de versão: se o registro no banco mudou desde que o cliente o carregou,
// recusa a gravação (evita que duas pessoas se sobrescrevam sem perceber).
function conflitoDeVersao(baseVersao, dadosArmazenados) {
  // Edição colaborativa (Diogo <-> Deborah em máquinas/abas diferentes): trava de versão DESLIGADA a pedido.
  // Último a salvar prevalece; o autosave grava cada alteração e o histórico guarda as últimas versões.
  return false;
}

// Migração única e idempotente: converte chaves legadas (nome de exibição)
// para IDs imutáveis (rot_...), preservando o nome em data.nome e gravando
// data.roteiroId nas cotações vinculadas. Segura de rodar quantas vezes for.
async function migrarRoteirosParaId() {
  const resultado = { migrados: [], jaOk: 0, erros: [] };
  const todos = await buscarTodosRoteiros();

  for (const linha of todos) {
    try {
      if (String(linha.nome).startsWith('rot_')) {
        // Já migrado: só garante id/nome dentro do data
        const d = linha.data || {};
        if (d.id !== linha.nome || !d.nome) {
          d.id = linha.nome;
          if (!d.nome) d.nome = linha.nome;
          await supabase.from('roteiros').update({ data: d }).eq('nome', linha.nome);
        }
        resultado.jaOk++;
        continue;
      }

      const nomeExibicao = linha.nome;
      const novoId = gerarIdRoteiro();
      const dados = { ...(linha.data || {}), id: novoId, nome: nomeExibicao, _chaveLegada: nomeExibicao };

      // 1. Insere a nova linha com a chave imutável (só apaga a antiga se der certo)
      const { error: insErr } = await supabase.from('roteiros').insert({ nome: novoId, data: dados });
      if (insErr) throw insErr;

      // 2. Atualiza cotações vinculadas pelo nome → grava roteiroId
      const { data: orcs } = await supabase.from('orcamentos').select('*');
      for (const orc of (orcs || [])) {
        const d = orc.data || {};
        if (d.orcRoteiroVinculado === nomeExibicao || d.roteiroVinculado === nomeExibicao) {
          d.roteiroId = novoId;
          await supabase.from('orcamentos').update({ data: d }).eq('id', orc.id);
        }
      }

      // 3. Remove a linha antiga
      const { error: delErr } = await supabase.from('roteiros').delete().eq('nome', nomeExibicao);
      if (delErr) throw delErr;

      resultado.migrados.push({ de: nomeExibicao, para: novoId });
    } catch (e) {
      resultado.erros.push({ roteiro: linha.nome, erro: e.message });
    }
  }

  if (resultado.migrados.length || resultado.erros.length) {
    console.log('[Migração Roteiros→ID]', JSON.stringify(resultado));
  }
  return resultado;
}

// Endpoint manual (admin) para conferir/reexecutar a migração
app.get('/api/admin/migrar-roteiros', async (req, res) => {
  try {
    const resultado = await migrarRoteirosParaId();
    res.json({ success: true, ...resultado });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/roteiros', async (req, res) => {
  try {
    // egress: view roteiros_light devolve os dados SEM _historico (~80% menor). Fallback p/ tabela base se a view não existir.
    let [rotsRes, baseRes] = await Promise.all([
      supabase.from('roteiros_light').select('*'),
      supabase.from('rotas_base').select('data').eq('id', 'base').single()
    ]);
    if (rotsRes.error) rotsRes = await supabase.from('roteiros').select('*');
    if (rotsRes.error) throw rotsRes.error;
    
    const rotasMap = {};
    for (const r of rotsRes.data || []) {
      // Filtra os roteiros ativos (não deletados)
      if (r.data && !r.data.deletado) {
        const dados = { ...r.data, id: r.nome, nome: r.data.nome || r.nome };
        // Chave do mapa = nome de exibição (compatível com o frontend);
        // em caso de nomes duplicados, acrescenta sufixo apenas na exibição.
        let chave = dados.nome;
        let n = 2;
        while (rotasMap[chave]) { chave = `${dados.nome} (${n++})`; }
        rotasMap[chave] = dados;
      }
    }
    if (baseRes.data && baseRes.data.data) {
      rotasMap['[PLANILHA] Base de Rotas'] = { dias: baseRes.data.data };
    }
    res.json(rotasMap);
  } catch(e) {
    console.error('Error getting roteiros:', e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/roteiros/:name', async (req, res) => {
  try {
    const name = req.params.name;
    const corpo = req.body; // objeto completo do roteiro
    
    if (name === '[PLANILHA] Base de Rotas') {
      const { error } = await supabase.from('rotas_base').upsert({
        id: 'base',
        data: corpo.dias || corpo
      });
      if (error) throw error;
      return res.json({ ok: true, name, roteiro: corpo });
    }

    // Resolve o registro existente por ID ou nome (legado)
    const linha = await acharRoteiroPorChaveOuNome(name);

    // Proteção: salvar por NOME em cima de roteiro de OUTRO cliente é colisão,
    // não atualização (ex.: criar "Roteiro Tokyo" quando já existe um de outro cliente).
    if (linha && !String(name).startsWith('rot_')) {
      const clienteExistente = linha.data?.notionClienteId || linha.data?.cliente?.notionClienteId;
      const clienteNovo = corpo?.notionClienteId || corpo?.cliente?.notionClienteId;
      const corpoSemId = !corpo.id;
      if (corpoSemId && clienteExistente && clienteNovo && clienteExistente !== clienteNovo) {
        return res.status(409).json({
          error: 'conflict_client',
          message: `O nome "${name}" já está sendo usado por outro cliente. Por favor, escolha um nome diferente.`
        });
      }
    }

    const chave = linha ? linha.nome : (String(name).startsWith('rot_') ? name : gerarIdRoteiro());
    const armazenado = linha ? linha.data : null;

    // Guarda de versão: recusa gravar por cima de uma versão mais nova
    const baseVersao = corpo._baseVersao;
    delete corpo._baseVersao;
    if (conflitoDeVersao(baseVersao, armazenado)) {
      return res.status(409).json({
        error: 'conflict_version',
        message: 'Este roteiro foi alterado em outra sessão (outra aba ou outro usuário). Recarregue-o antes de continuar editando.',
        atualizadoEm: armazenado.atualizadoEm
      });
    }

    // TRAVA ANTI-ESVAZIAMENTO: recusa um save automatico que derruba o conteudo
    // bruscamente (ex.: aba/sessao desatualizada sobrescrevendo com menos itens).
    // Nao perde nada: o recusado fica parkeado num backup. Salvamento explicito
    // pode forcar com _permitirReducao:true.
    const _permitirReducao = corpo._permitirReducao === true;
    delete corpo._permitirReducao;
    if (armazenado && !_permitirReducao) {
      const nOld = contarElementosRoteiro(armazenado);
      const nNew = contarElementosRoteiro(corpo);
      if (nOld >= 8 && nNew < nOld * 0.5) {
        try {
          await supabase.from('config').upsert({ id: '_bak_reducao_' + chave, data: { em: new Date().toISOString(), nOld, nNew, recusado: corpo } });
        } catch (e) { console.error('park reducao:', e.message); }
        console.warn('Anti-esvaziamento: recusado save de ' + chave + ' (' + nOld + ' -> ' + nNew + ' elementos)');
        return res.status(409).json({ error: 'reducao', nOld, nNew, atualizadoEm: armazenado.atualizadoEm });
      }
    }

    let dados = {
      ...corpo,
      id: chave,
      nome: corpo.nome || (armazenado && armazenado.nome) || (String(name).startsWith('rot_') ? (armazenado?.nome || 'Roteiro') : name),
      atualizadoEm: new Date().toISOString(),
      criadoEm: (armazenado && armazenado.criadoEm) || corpo.criadoEm || new Date().toISOString()
    };
    dados = aplicarHistorico(dados, armazenado);

    const { error } = await supabase.from('roteiros').upsert({
      nome: chave,
      data: dados
    }, { onConflict: 'nome' });
    if (error) throw error;

    // FASE 2 — garante cotação vinculada (nasce junto com o roteiro). Não bloqueia a resposta.
    if (typeof garantirCotacaoDoRoteiro === 'function') {
      Promise.resolve(garantirCotacaoDoRoteiro(dados)).catch(e => console.error('garantirCotacaoDoRoteiro:', e.message));
    }

    res.json({ ok: true, name, id: chave, nome: dados.nome, atualizadoEm: dados.atualizadoEm, roteiro: dados });
  } catch(e) {
    console.error('Error saving roteiro:', e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/roteiros/:name/renomear', async (req, res) => {
  try {
    const nomeAntigo = req.params.name;
    const { novoNome, roteiroObj } = req.body;
    
    if (!novoNome) {
      return res.status(400).json({ error: 'invalid_name', message: 'O novo nome do roteiro é obrigatório.' });
    }

    // Com IDs imutáveis, renomear é só trocar o rótulo (data.nome) sob a mesma chave.
    const linha = await acharRoteiroPorChaveOuNome(nomeAntigo);
    if (!linha) {
      return res.status(404).json({ error: 'not_found', message: `Roteiro "${nomeAntigo}" não encontrado.` });
    }
    const chave = linha.nome;

    let dados = {
      ...(roteiroObj || linha.data || {}),
      id: chave,
      nome: novoNome,
      atualizadoEm: new Date().toISOString(),
      criadoEm: (linha.data && linha.data.criadoEm) || new Date().toISOString()
    };
    delete dados._baseVersao;
    dados = aplicarHistorico(dados, linha.data);

    const { error: updateErr } = await supabase
      .from('roteiros')
      .update({ data: dados })
      .eq('nome', chave);
    if (updateErr) throw updateErr;
    
    // Atualiza o rótulo nas cotações vinculadas (por ID ou por nome legado)
    const nomeExibicaoAntigo = (linha.data && linha.data.nome) || nomeAntigo;
    const { data: orcamentos, error: fetchOrcErr } = await supabase.from('orcamentos').select('*');
    if (!fetchOrcErr && orcamentos) {
      for (const orc of orcamentos) {
        const d = orc.data || {};
        const vinculadoPorId = d.roteiroId === chave;
        const vinculadoPorNome = d.orcRoteiroVinculado === nomeExibicaoAntigo || d.roteiroVinculado === nomeExibicaoAntigo
          || d.orcRoteiroVinculado === nomeAntigo || d.roteiroVinculado === nomeAntigo;
        if (vinculadoPorId || vinculadoPorNome) {
          if (d.orcRoteiroVinculado) d.orcRoteiroVinculado = novoNome;
          if (d.roteiroVinculado) d.roteiroVinculado = novoNome;
          d.roteiroId = chave; // aproveita para consolidar o vínculo por ID
          await supabase.from('orcamentos').update({ data: d }).eq('id', orc.id);
        }
      }
    }
    
    res.json({ ok: true, novoNome, id: chave, atualizadoEm: dados.atualizadoEm });
  } catch(e) {
    console.error('Error renaming roteiro:', e);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/roteiros/:name', async (req, res) => {
  try {
    const name = req.params.name;
    if (name === '[PLANILHA] Base de Rotas') {
      const { error } = await supabase.from('rotas_base').delete().eq('id', 'base');
      if (error) throw error;
    } else {
      // Soft Delete: resolve por ID ou nome, marca como deletado no JSON e atualiza
      const linha = await acharRoteiroPorChaveOuNome(name);
      if (!linha) throw new Error(`Roteiro "${name}" não encontrado.`);
      
      const rot = linha.data || {};
      rot.deletado = true;
      rot.deletadoEm = new Date().toISOString();
      
      const { error } = await supabase.from('roteiros').upsert({
        nome: linha.nome,
        data: rot
      }, { onConflict: 'nome' });
      if (error) throw error;
    }
    res.json({ ok: true });
  } catch(e) {
    console.error('Error deleting roteiro:', e);
    res.status(500).json({error: e.message});
  }
});

// ── API: Lixeira do Sistema (Soft Delete Rescues) ──────────────────────────
app.get('/api/lixeira', async (req, res) => {
  try {
    const [orcsRes, rotsRes] = await Promise.all([
      supabase.from('orcamentos').select('*'),
      supabase.from('roteiros').select('*')
    ]);
    if (orcsRes.error) throw orcsRes.error;
    if (rotsRes.error) throw rotsRes.error;
    
    const orcDeletados = (orcsRes.data || [])
      .map(r => r.data)
      .filter(item => item && item.deletado);
      
    const rotDeletados = (rotsRes.data || [])
      .map(r => ({ nome: r.nome, ...r.data }))
      .filter(item => item && item.deletado);
      
    res.json({
      orcamentos: orcDeletados,
      roteiros: rotDeletados
    });
  } catch(e) {
    console.error('Error getting trash:', e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/orcamentos/:id/restaurar', async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error: fetchErr } = await supabase.from('orcamentos').select('data').eq('id', String(id)).single();
    if (fetchErr) throw fetchErr;
    
    const orc = data.data || {};
    delete orc.deletado;
    delete orc.deletadoEm;
    
    const { error } = await supabase.from('orcamentos').upsert({ id: String(id), data: orc });
    if (error) throw error;
    res.json({ success: true });
  } catch(e) {
    console.error('Error restoring orcamento:', e);
    res.status(500).json({error: e.message});
  }
});

app.delete('/api/orcamentos/:id/definitivo', async (req, res) => {
  try {
    const id = req.params.id;
    const { error } = await supabase.from('orcamentos').delete().eq('id', String(id));
    if (error) throw error;
    res.json({ success: true });
  } catch(e) {
    console.error('Error hard deleting orcamento:', e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/roteiros/:name/restaurar', async (req, res) => {
  try {
    const name = req.params.name;
    const linha = await acharRoteiroPorChaveOuNome(name);
    if (!linha) throw new Error(`Roteiro "${name}" não encontrado.`);
    
    const rot = linha.data || {};
    delete rot.deletado;
    delete rot.deletadoEm;
    
    const { error } = await supabase.from('roteiros').upsert({ nome: linha.nome, data: rot }, { onConflict: 'nome' });
    if (error) throw error;
    res.json({ success: true });
  } catch(e) {
    console.error('Error restoring roteiro:', e);
    res.status(500).json({error: e.message});
  }
});

app.delete('/api/roteiros/:name/definitivo', async (req, res) => {
  try {
    const name = req.params.name;
    const linha = await acharRoteiroPorChaveOuNome(name);
    const chave = linha ? linha.nome : name;
    const { error } = await supabase.from('roteiros').delete().eq('nome', chave);
    if (error) throw error;
    res.json({ success: true });
  } catch(e) {
    console.error('Error hard deleting roteiro:', e);
    res.status(500).json({error: e.message});
  }
});

// ── API: Gestão de Sequências (Aba Rotas) ───────────────────────────────────
app.get('/api/rotas-base', async (req, res) => {
  try {
    const { data, error } = await supabase.from('rotas_base').select('data').eq('id', 'base').single();
    if (error && error.code !== 'PGRST116') throw error;
    const base = data && data.data ? data.data : [];
    res.json(base);
  } catch(e) {
    console.error('Error getting rotas-base:', e);
    res.status(500).json({error: e.message});
  }
});

app.post('/api/rotas-base', async (req, res) => {
  try {
    await carregarOpcoesBase();
    validarItemBase('rotas', req.body);
    const novo = await comLockBase('rotas', async () => {
      const { data, error: fetchErr } = await supabase.from('rotas_base').select('data').eq('id', 'base').single();
      if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
      const list = Array.isArray(data?.data) ? data.data : [];
      const item = { ...req.body, id: novoIdBase('rotas') };
      list.push(item);
      const { error: upsertErr } = await supabase.from('rotas_base').upsert({ id: 'base', data: list });
      if (upsertErr) throw upsertErr;
      return item;
    });
    const sheets = await syncToGoogleSheets('rotas', 'insert', novo);
    res.json({ ...novo, _syncSheets: sheets });
  } catch(e) {
    console.error('Error saving rotas-base:', e);
    res.status(500).json({error: e.message});
  }
});

app.put('/api/rotas-base/:id', async (req, res) => {
  try {
    await carregarOpcoesBase();
    validarItemBase('rotas', req.body, { parcial: true });
    const searchId = decodeURIComponent(req.params.id).trim().toLowerCase();
    const resultado = await comLockBase('rotas', async () => {
      const { data, error: fetchErr } = await supabase.from('rotas_base').select('data').eq('id', 'base').single();
      if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
      const list = Array.isArray(data?.data) ? data.data : [];
      const indices = list.map((x, i) => x?.id && String(x.id).trim().toLowerCase() === searchId ? i : -1).filter(i => i >= 0);
      if (!indices.length) return null;
      if (indices.length > 1) throw new Error(`ID duplicado na Base: ${req.params.id}. Operação bloqueada por segurança.`);
      const idx = indices[0];
      const oldItem = { ...list[idx] };
      list[idx] = { ...list[idx], ...req.body, id: list[idx].id };
      validarItemBase('rotas', list[idx]);
      const { error: upsertErr } = await supabase.from('rotas_base').upsert({ id: 'base', data: list });
      if (upsertErr) throw upsertErr;
      return { item: list[idx], oldItem };
    });
    if (!resultado) return res.status(404).json({ error: 'Não encontrado' });
    const sheets = await syncToGoogleSheets('rotas', 'update', resultado.item, resultado.oldItem);
    res.json({ ...resultado.item, _syncSheets: sheets });
  } catch(e) {
    console.error('Error updating rotas-base:', e);
    res.status(500).json({error: e.message});
  }
});

app.delete('/api/rotas-base/:id', async (req, res) => {
  try {
    const searchId = decodeURIComponent(req.params.id).trim().toLowerCase();
    const oldItem = await comLockBase('rotas', async () => {
      const { data, error: fetchErr } = await supabase.from('rotas_base').select('data').eq('id', 'base').single();
      if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;
      const list = Array.isArray(data?.data) ? data.data : [];
      const matches = list.filter(x => x?.id && String(x.id).trim().toLowerCase() === searchId);
      if (!matches.length) return null;
      if (matches.length > 1) throw new Error(`ID duplicado na Base: ${req.params.id}. Exclusão bloqueada por segurança.`);
      const filteredList = list.filter(x => !x?.id || String(x.id).trim().toLowerCase() !== searchId);
      const { error: upsertErr } = await supabase.from('rotas_base').upsert({ id: 'base', data: filteredList });
      if (upsertErr) throw upsertErr;
      return matches[0];
    });
    if (!oldItem) return res.status(404).json({ error: 'Não encontrado' });
    const sheets = await syncToGoogleSheets('rotas', 'delete', oldItem);
    res.json({ ok: true, _syncSheets: sheets });
  } catch(e) {
    console.error('Error deleting rotas-base:', e);
    res.status(500).json({error: e.message});
  }
});


// ── API: Sync Google Sheets ─────────────────────────────────────────────────
app.post('/api/sync', async (req, res) => {
  try {
    const { data: cfgData, error: cfgErr } = await supabase.from('config').select('data').eq('id', 'app_config').single();
    if (cfgErr) throw cfgErr;
    const config = cfgData?.data || {};
    const { sheets_id, sheets_aba_transportes, sheets_aba_experiencias, sheets_aba_atracoes, sheets_aba_rotas, sheets_aba_hoteis } = config;

    if (!sheets_id) {
      return res.status(400).json({ error: 'ID do Google Sheets não configurado nas Configurações.' });
    }

    const abaT = sheets_aba_transportes || 'Base';
    const abaE = sheets_aba_experiencias || 'BaseEX';
    const abaA = sheets_aba_atracoes || 'Atracoes';
    const abaRotas = sheets_aba_rotas || 'Rotas';
    let abaHoteis = sheets_aba_hoteis || 'Hotéis';

    const db = {
      config,
      transportes: null,
      experiencias: null,
      atracoes: null,
      hoteis: null,
      rotas: null,
      templates_vouchers: null
    };

  // Busca uma aba via gviz usando o range completo (inclui linhas em branco e preserva a 1ª linha como único cabeçalho)
  async function fetchAba(nomeAba) {
    const url = `https://docs.google.com/spreadsheets/d/${sheets_id}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(nomeAba)}`;
    const resp = await fetch(url);
    const text = await resp.text();
    const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
    const json = JSON.parse(jsonStr);
    return json.table;
  }

  function cellVal(cell) {
    if (!cell) return '';
    if (cell.f != null) return String(cell.f).trim();
    if (cell.v != null) return String(cell.v).trim();
    return '';
  }

  // Para colunas de preço: usa sempre o valor numérico bruto (cell.v)
  // evitando que o formato da célula (ex: "14.17" de ¥14.170) distorça o número
  function cellNum(cell) {
    if (!cell) return 0;
    if (cell.v != null && typeof cell.v === 'number') return cell.v;
    // fallback: tenta extrair número do valor formatado
    return parsePreco(cellVal(cell));
  }

  let nTransp = 0, nExp = 0, nAtracoes = 0;

    // ── TRANSPORTES (aba "Base") ─────────────────────────────────────
    // Estrutura: cabeçalho aparece numa linha que começa com "Trecho".
    // Colunas: Trecho | Tipo | Linha | Categoria | Preço | Tempo | Observações | Comprar | TrechoCompleto
    try {
      const table = await fetchAba(abaT);
      const rows = table.rows || [];

      // Procura a linha de cabeçalho
      let headerIdx = -1;
      let headers = [];
      
      // Tenta ler dos 'cols' do gviz primeiro
      if (table.cols && table.cols.length > 0 && table.cols[0].label) {
        headers = table.cols.map(c => (c.label || '').toLowerCase().trim());
      } else {
        for (let i = 0; i < rows.length; i++) {
          const firstCell = cellVal(rows[i].c?.[0]);
          if (firstCell && firstCell.toLowerCase() === 'trecho') { 
            headerIdx = i; 
            headers = (rows[i].c || []).map(cell => (cellVal(cell) || '').toLowerCase().trim());
            break; 
          }
        }
      }
      
      const idxTrecho = headers.findIndex(h => h.includes('trecho')) > -1 ? headers.findIndex(h => h.includes('trecho')) : 0;
      const idxIdade = headers.findIndex(h => h.includes('idade') || h.includes('adulto') || h.includes('infantil'));
      const idxTipo = headers.findIndex(h => h.includes('tipo') && !h.includes('idade') && !h.includes('adulto'));
      const idxLinha = headers.findIndex(h => h.includes('linha'));
      const idxCategoria = headers.findIndex(h => h.includes('categoria'));
      const idxPreco = headers.findIndex(h => h.includes('preço') || h.includes('preco') || h.includes('unitário'));
      const idxTempo = headers.findIndex(h => h.includes('tempo'));
      const idxObs = headers.findIndex(h => h.includes('observação') || h.includes('observacao'));
      const idxLink = headers.findIndex(h => {
        const val = h.toLowerCase().trim();
        return val.includes('link') || val === 'comprar';
      });
      const idxId = headers.findIndex(h => h === 'id');
      const idxCompra = headers.findIndex(h => {
        const val = h.toLowerCase().trim();
        return val === 'compra' || val === 'instrução de compra' || val === 'instrucao de compra' || (val.includes('compra') && val !== 'comprar' && val !== 'comprado');
      });
      const idxUso = headers.findIndex(h => {
        const val = h.toLowerCase().trim();
        return val === 'uso' || val.includes('uso') || val.includes('instrução de uso') || val.includes('instrucao de uso');
      });


      const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;

      console.log('HEADERS:', headers); console.log('IDXs:', idxTrecho, idxIdade, idxTipo, idxLinha, idxCategoria, idxPreco, idxTempo); const transportes = dataRows
        .map((r, i) => {
          const c = r.c || [];
          const trecho = cellVal(c[idxTrecho]);
          if (!trecho) return null;
          
          // Se encontrou Idade, sabemos que todas as colunas originais andaram 1 casa
          const offset = idxIdade > -1 ? 1 : 0;
          
          return {
            id: (idxId > -1 ? cellVal(c[idxId]) : null) || cellVal(c[12]) || (i + 1),
            trecho,
            idade:      (idxIdade > -1 ? cellVal(c[idxIdade]) : ''),
            tipo:       (idxTipo > -1 ? cellVal(c[idxTipo]) : cellVal(c[1 + offset])),
            linha:      (idxLinha > -1 ? cellVal(c[idxLinha]) : cellVal(c[2 + offset])),
            categoria:  (idxCategoria > -1 ? cellVal(c[idxCategoria]) : cellVal(c[3 + offset])),
            preco_jpy:  cellNum(c[idxPreco > -1 ? idxPreco : 4 + offset]),
            tempo:      (idxTempo > -1 ? cellVal(c[idxTempo]) : cellVal(c[5 + offset])),
            observacao: (idxObs > -1 ? cellVal(c[idxObs]) : cellVal(c[6 + offset])),
            link:       (idxLink > -1 ? cellVal(c[idxLink]) : cellVal(c[7 + offset])),
            compra:     (idxCompra > -1 ? cellVal(c[idxCompra]) : ''),
            uso:        (idxUso > -1 ? cellVal(c[idxUso]) : '')
          };
        })
        .filter(Boolean);

      db.transportes = transportes;
      nTransp = transportes.length;
    } catch (e) { console.error('Erro aba transportes:', e.message); }

    // ── EXPERIÊNCIAS (aba "BaseEX") ──────────────────────────────────
    // Estrutura SEM cabeçalho. Colunas: Nome | Tipo | (vazio) | Categoria | Preço | ...
    try {
      const table = await fetchAba(abaE);
      const rows = table.rows || [];

      // Se a primeira linha for cabeçalho (primeira célula vazia ou "nome"/"experiência"), pula
      let dataRows = rows;
      const first = cellVal(rows[0]?.c?.[0]).toLowerCase();
      if (first === 'nome' || first === 'experiência' || first === 'experiencia' || first === '') {
        dataRows = rows.slice(1);
      }

      // v2: leitura por CABEÇALHO (layout novo da BaseEX), com fallback pro layout legado
      let headE = [];
      if (table.cols && table.cols.some(cc => (cc.label || '').trim() !== '')) {
        headE = table.cols.map(cc => (cc.label || '').toLowerCase().trim());
      } else if (rows.length > 0) {
        headE = (rows[0].c || []).map(cell => (cellVal(cell) || '').toLowerCase().trim());
      }
      const hIdxE = (tests, fb) => {
        const i = headE.findIndex(h => tests.some(t => h.includes(t)));
        return i > -1 ? i : fb;
      };
      const iNome = hIdxE(['nome'], 0);
      const iTipo = hIdxE(['tipo'], 1);
      const iCid  = hIdxE(['cidade'], -1);
      const iDesc = hIdxE(['descri'], -1);
      const iPre  = hIdxE(['preço adulto', 'preco adulto', 'preço'], 4);
      const iPreC = hIdxE(['criança', 'crianca'], -1);
      const iDur  = hIdxE(['duração', 'duracao'], -1);
      const iLink = hIdxE(['link'], 7);
      const iJan  = hIdxE(['janela'], -1);
      const iPraz = hIdxE(['prazo'], -1);
      const iIdE  = headE.indexOf('id') > -1 ? headE.indexOf('id') : 10;
      const iHor  = hIdxE(['horário', 'horario'], -1);
      const iPub  = hIdxE(['público', 'publico'], -1);
      const iSaz  = hIdxE(['sazonal'], -1);
      const iObs  = hIdxE(['observa'], -1);
      const gvE = (c, i) => (i > -1 ? (cellVal(c[i]) || '') : '');

      const experiencias = dataRows
        .map((r, i) => {
          const c = r.c || [];
          const nome = cellVal(c[iNome]);
          if (!nome) return null;
          return {
            id: cellVal(c[iIdE]) || (i + 1),
            nome,
            tipo:       gvE(c, iTipo) || 'Ingresso',
            cidade:     gvE(c, iCid),
            descricao:  gvE(c, iDesc),
            preco_jpy:  iPre > -1 ? cellNum(c[iPre]) : 0,
            preco_crianca_jpy: iPreC > -1 ? cellNum(c[iPreC]) : 0,
            duracao:    gvE(c, iDur),
            link:       gvE(c, iLink),
            janelaAbreDias: iJan > -1 ? cellNum(c[iJan]) : 0,
            prazoDias:  iPraz > -1 ? cellNum(c[iPraz]) : 0,
            horarios:   gvE(c, iHor),
            publico:    gvE(c, iPub),
            sazonalidade: gvE(c, iSaz),
            observacao: gvE(c, iObs)
          };
        })
        .filter(Boolean);

      db.experiencias = experiencias;
      nExp = experiencias.length;
    } catch (e) { console.error('Erro aba experiências:', e.message); }

    // ── ATRAÇÕES (aba "Atracoes") ────────────────────────────────────
    try {
      const table = await fetchAba(abaA);
      const rows = table.rows || [];

      if (rows.length > 0) {
        // Encontra a linha de cabeçalho
        let headerIdx = -1;
        let foundHeader = false;
        let headers = [];

        // Tenta ler dos 'cols' do gviz primeiro
        if (table.cols && table.cols.length > 0 && table.cols[0].label) {
          headers = table.cols.map(c => (c.label || '').toLowerCase().trim());
          foundHeader = true;
        } else {
          for (let i = 0; i < Math.min(5, rows.length); i++) {
            const cells = rows[i].c || [];
            const rowVals = cells.map(cellVal).map(v => v.toLowerCase());
            if (rowVals.some(v => v.includes('atração') || v.includes('atracao') || v.includes('atrações') || v.includes('atracoes') || v.includes('nome'))) {
              headerIdx = i;
              foundHeader = true;
              headers = rowVals;
              break;
            }
          }
        }

        const headerVals = headers;

        const getIdx = (keywords, defaultVal, forceExact = false) => {
          let idx = headerVals.findIndex(h => keywords.some(k => h === k));
          if (idx >= 0) return idx;
          if (forceExact) return defaultVal;
          idx = headerVals.findIndex(h => keywords.some(k => h.includes(k)));
          return idx >= 0 ? idx : defaultVal;
        };

        const idxCidade = getIdx(['cidade', 'city', 'local'], 0);
        const idxBairro = getIdx(['bairro', 'neighborhood', 'região', 'regiao', 'zona'], 1);
        const idxNome = getIdx(['nome da atração', 'nome da atracao', 'nome', 'atração', 'atracao', 'name', 'título', 'titulo'], 2);
        const idxDescricao = getIdx(['descrição detalhada', 'descricao detalhada', 'descrição', 'descricao', 'detalhes', 'description', 'sobre'], 3);
        const idxPreco = getIdx(['preço (ingresso)', 'preco (ingresso)', 'preço', 'preco', 'ingresso', 'valor', 'price', 'custo'], 4);
        const idxOrigem = getIdx(['origem', 'source', 'casal'], 5);
        const idxDiasFechados = getIdx(['diasfechados', 'dias fechados', 'fechados', 'fechado'], 5);
        const idxId = getIdx(['id', 'id_atracao', 'idatracao'], 6, true);
        const idxManutencaoInicio = getIdx(['manutencaoinicio', 'manutencao_inicio', 'manutenção início', 'manutencao inicio'], 7);
        const idxManutencaoFim = getIdx(['manutencaofim', 'manutencao_fim', 'manutenção fim', 'manutencao fim'], 8);
        const idxManutencaoMotivo = getIdx(['manutencaomotivo', 'manutencao_motivo', 'motivo', 'manutencao motivo'], 9);
        const idxFoto = getIdx(['foto (url)', 'foto', 'foto_url', 'imagem', 'image'], 10);

        const dataRows = (foundHeader && headerIdx >= 0) ? rows.slice(headerIdx + 1) : rows;

        const atracoes = dataRows
          .map((r, i) => {
            const c = r.c || [];
            const nome = cellVal(c[idxNome]);
            if (!nome) return null;
            
            let diasFechados = [];
            const rawDias = cellVal(c[idxDiasFechados]);
            if (rawDias) {
              try {
                const parsed = JSON.parse(rawDias);
                if (Array.isArray(parsed)) {
                  diasFechados = parsed.map(Number).filter(n => !isNaN(n));
                } else {
                  const parsedNum = Number(parsed);
                  if (!isNaN(parsedNum) && rawDias.trim() !== '') {
                    diasFechados = [parsedNum];
                  }
                }
              } catch (e) {
                if (rawDias.includes(',')) {
                  diasFechados = rawDias.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
                } else {
                  const valNum = parseInt(rawDias.trim(), 10);
                  if (!isNaN(valNum)) {
                    diasFechados = [valNum];
                  }
                }
              }
            }

            return {
              id: cellVal(c[idxId]) || cellVal(c[6]) || String(i + 1),
              Cidade: cellVal(c[idxCidade]) || 'Geral',
              Bairro: cellVal(c[idxBairro]) || '',
              'Nome da Atração': nome,
              'Descrição Detalhada': (cellVal(c[idxDescricao]) || '').replace(/<[^>]*>?/gm, '').trim(),
              'Preço (Ingresso)': cellVal(c[idxPreco]) || 'Gratuito',
              diasFechados: diasFechados,
              manutencaoInicio: cellVal(c[idxManutencaoInicio]) || '',
              manutencaoFim: cellVal(c[idxManutencaoFim]) || '',
              manutencaoMotivo: cellVal(c[idxManutencaoMotivo]) || '',
              'Foto (URL)': cellVal(c[idxFoto]) || '',
              Origem: cellVal(c[idxOrigem]) || 'Google Sheets'
            };
          })
          .filter(Boolean);

        db.atracoes = atracoes;
        nAtracoes = atracoes.length;
      }
    } catch (e) { console.error('Erro aba atrações:', e.message); }

    // ── ROTAS (aba "Rotas") ──────────────────────────────────────────
    try {
      const table = await fetchAba(abaRotas);
      const rows = table.rows || [];
      let diasImportados = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row.c) continue;
        
        const cidade = cellVal(row.c[0]);
        const nomeDaRota = cellVal(row.c[1]);
        const atracoesRaw = cellVal(row.c[2]);
        const idStr = cellVal(row.c[3]); // Lę ID da coluna D
        const id = idStr ? idStr : i; // Fallback para i se estiver vazio
        
        if (cidade && nomeDaRota) {
          diasImportados.push({ 
            id: id,
            cidade, 
            nomeDaRota, 
            atracoesDoDia: atracoesRaw ? atracoesRaw.split(',').map(s => s.trim()).filter(Boolean) : [] 
          });
        }
      }
      if (diasImportados.length > 0) {
        db.rotas = { '[PLANILHA] Base de Rotas': { dias: diasImportados } };
      } else {
        db.rotas = { '[PLANILHA] Base de Rotas': { dias: [] } };
      }
    } catch (e) { console.error('Erro aba Rotas:', e.message); }

    // ── HOTÉIS (aba "Hotéis") ────────────────────────────────────────
    let nHoteis = 0;
    try {
      let table;
      try {
        table = await fetchAba(abaHoteis);
      } catch (err) {
        if (!sheets_aba_hoteis && abaHoteis === 'Hotéis') {
          abaHoteis = 'hoteis';
          table = await fetchAba(abaHoteis);
        } else {
          throw err;
        }
      }
      const rows = table.rows || [];

      if (rows.length > 0) {
        // Encontra a linha de cabeçalho
        let headerIdx = -1;
        let foundHeader = false;
        let headers = [];

        let dataRows = [];
        if (table.cols && table.cols.length > 0 && table.cols.some(c => c && c.label)) {
          headers = table.cols.map(c => (c.label || '').toLowerCase().trim());
          foundHeader = true;
          dataRows = rows;
        } else {
          for (let i = 0; i < Math.min(5, rows.length); i++) {
            const cells = rows[i].c || [];
            const rowVals = cells.map(cellVal).map(v => v.toLowerCase());
            if (rowVals.some(v => v === 'nome de hotel' || v === 'nome do hotel' || v === 'cidade')) {
              headerIdx = i;
              foundHeader = true;
              headers = rowVals;
              break;
            }
          }
          dataRows = (foundHeader && headerIdx >= 0) ? rows.slice(headerIdx + 1) : rows;
        }

        const headerVals = headers;

        const getIdx = (keywords, defaultVal, forceExact = false) => {
          let idx = headerVals.findIndex(h => keywords.some(k => h === k));
          if (idx >= 0) return idx;
          if (forceExact) return defaultVal;
          idx = headerVals.findIndex(h => keywords.some(k => h.includes(k)));
          return idx >= 0 ? idx : defaultVal;
        };

        const idxNome = getIdx(['nome do hotel', 'nome de hotel', 'hotel', 'nome', 'name'], 0);
        const idxCidade = getIdx(['cidade', 'city', 'local'], 1);
        const idxDescricao = getIdx(['descrição', 'descricao', 'description', 'sobre'], 2);
        const idxFoto = getIdx(['foto (url)', 'foto', 'imagem', 'image', 'foto_url'], 3);
        const idxLinkMaps = getIdx(['link do google maps', 'link maps', 'maps', 'google maps', 'link'], 4);
        const idxComodidades = getIdx(['comodidades', 'tags', 'facilidades', 'comodidade'], 5);
        const idxId = getIdx(['id'], 6, true);

        const hoteis = dataRows
          .map((r, i) => {
            const c = r.c || [];
            const nome = cellVal(c[idxNome]);
            if (!nome) return null;

            return {
              id: cellVal(c[idxId]) || String(i + 1),
              'Nome do Hotel': nome,
              Cidade: cellVal(c[idxCidade]) || '',
              'Descrição': cellVal(c[idxDescricao]) || '',
              'Foto (URL)': cellVal(c[idxFoto]) || '',
              'Link do Google Maps': cellVal(c[idxLinkMaps]) || '',
              Comodidades: cellVal(c[idxComodidades]) || ''
            };
          })
          .filter(Boolean);

        db.hoteis = hoteis;
        nHoteis = hoteis.length;
      }
    } catch (e) { console.error('Erro aba hotéis:', e.message); }

    // ── MODELOS DE INSTRUÇÕES DE VOUCHERS (aba "ModelosVouchers") ─────────
    let nTemplatesVouchers = 0;
    try {
      const abaV = config.sheets_aba_instrucoes_vouchers || 'ModelosVouchers';
      const table = await fetchAba(abaV);
      const rows = table.rows || [];

      if (rows.length > 0) {
        // Encontra a linha de cabeçalho
        let headerIdx = -1;
        let foundHeader = false;
        let headers = [];

        // Tenta ler dos 'cols' do gviz primeiro
        if (table.cols && table.cols.length > 0 && table.cols[0].label) {
          headers = table.cols.map(c => (c.label || '').toLowerCase().trim());
          foundHeader = true;
        } else {
          for (let i = 0; i < Math.min(5, rows.length); i++) {
            const cells = rows[i].c || [];
            const rowVals = cells.map(cellVal).map(v => v.toLowerCase());
            if (rowVals.some(v => v.includes('modelo') || v.includes('titulo') || v.includes('título') || v.includes('chave') || v.includes('item'))) {
              headerIdx = i;
              foundHeader = true;
              headers = rowVals;
              break;
            }
          }
        }

        const headerVals = headers;

        const getIdx = (keywords, defaultVal) => {
          let idx = headerVals.findIndex(h => keywords.some(k => h === k));
          if (idx >= 0) return idx;
          idx = headerVals.findIndex(h => keywords.some(k => h.includes(k)));
          return idx >= 0 ? idx : defaultVal;
        };

        const idxTitulo = getIdx(['título do modelo', 'titulo do modelo', 'modelo', 'titulo', 'título', 'chave', 'item'], 0);
        const idxInstrucoes = getIdx(['instruções padrão', 'instrucoes padrao', 'instruções', 'instrucoes', 'texto', 'descritivo', 'descrição', 'descricao'], 1);

        const dataRows = (foundHeader && headerIdx >= 0) ? rows.slice(headerIdx + 1) : rows;

        const templatesVouchers = dataRows
          .map((r, i) => {
            const c = r.c || [];
            const titulo = cellVal(c[idxTitulo]);
            if (!titulo) return null;

            return {
              id: String(i + 1),
              titulo,
              instrucoes: cellVal(c[idxInstrucoes]) || ''
            };
          })
          .filter(Boolean);

        db.templates_vouchers = templatesVouchers;
        nTemplatesVouchers = templatesVouchers.length;
      }
    } catch (e) {
      console.warn('Aba de Modelos de Vouchers não encontrada ou vazia:', e.message);
    }


    db.config.ultima_sincronizacao = new Date().toISOString();
    
    // Grava apenas as tabelas alteradas em paralelo (apenas as que foram lidas sem erros)
    const syncPromises = [
      supabase.from('config').upsert({ id: 'app_config', data: db.config || {} }).then(r => { if (r.error) throw r.error; })
    ];

    if (db.transportes !== null) {
      syncPromises.push(supabase.from('config').upsert({ id: 'transportes', data: db.transportes }).then(r => { if (r.error) throw r.error; }));
    }
    if (db.experiencias !== null) {
      syncPromises.push(supabase.from('config').upsert({ id: 'experiencias', data: db.experiencias }).then(r => { if (r.error) throw r.error; }));
    }
    if (db.atracoes !== null) {
      syncPromises.push(supabase.from('config').upsert({ id: 'atracoes', data: db.atracoes }).then(r => { if (r.error) throw r.error; }));
    }
    if (db.hoteis !== null) {
      syncPromises.push(supabase.from('config').upsert({ id: 'hoteis', data: db.hoteis }).then(r => { if (r.error) throw r.error; }));
    }
    if (db.templates_vouchers !== null) {
      syncPromises.push(supabase.from('config').upsert({ id: 'templates_vouchers', data: db.templates_vouchers }).then(r => { if (r.error) throw r.error; }));
    }
    if (db.rotas !== null && db.rotas['[PLANILHA] Base de Rotas']?.dias) {
      syncPromises.push(supabase.from('rotas_base').upsert({ id: 'base', data: db.rotas['[PLANILHA] Base de Rotas'].dias }).then(r => { if (r.error) throw r.error; }));
    }
    
    await Promise.all(syncPromises);

    res.json({ ok: true, ultima_sincronizacao: db.config.ultima_sincronizacao, nTransp, nExp, nAtracoes, nHoteis, nTemplatesVouchers });

  } catch (err) {
    console.error('Erro no sync:', err);
    res.status(500).json({ error: 'Erro ao sincronizar. Verifique se a planilha está pública e se os nomes das abas estão corretos.' });
  }
});

app.get('/api/cambio', async (req, res) => {
  try {
    // API gratuita de câmbio, sem necessidade de chave
    const resp = await fetch('https://open.er-api.com/v6/latest/JPY');
    const data = await resp.json();
    if (data && data.rates) {
      const usd = data.rates.USD;
      const brl = data.rates.BRL;
      res.json({ ok: true, cambio_jpy_usd: usd, cambio_jpy_brl: brl, data: data.time_last_update_utc });
    } else {
      res.status(500).json({ error: 'Resposta inesperada da API de câmbio.' });
    }
  } catch (err) {
    console.error('Erro câmbio:', err);
    res.status(500).json({ error: 'Erro ao buscar câmbio. Verifique sua conexão.' });
  }
});

function parsePreco(v) {
  if (!v) return 0;
  // Remove símbolo ¥ e espaços
  let s = String(v).replace(/[¥\s]/g, '');
  // Se tiver ponto E vírgula: formato europeu/BR (ex: 14.170,00) → remove ponto, troca vírgula por ponto
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',') && !s.includes('.')) {
    // Só vírgula: pode ser decimal (1.200,50) ou milhar (1,200)
    // Se tiver mais de 3 dígitos após a vírgula, é separador de milhar
    const partes = s.split(',');
    if (partes[partes.length - 1].length !== 2 && partes[partes.length - 1].length !== 1) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(/,/g, '.');
    }
  } else {
    // Remove vírgulas (separador de milhar estilo inglês: 14,170)
    s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ── Integração Notion ───────────────────────────────────────────────────────
// Opções de status do QUADRO lidas direto do Notion (options de 'Status do Cliente').
// Assim o quadro reflete o Notion: adicionar/remover uma opção lá aparece/some aqui.
app.get('/api/integracoes/notion/status', async (req, res) => {
  try {
    const status = {};
    for (const type of Object.keys(NOTION_DATABASES)) {
      if (!NOTION_DATABASES[type]) continue;
      const snapshot = await notionMirror.getSnapshot(type, { fallbackToNotion: false });
      status[type] = snapshot
        ? { pronto: true, quantidade: snapshot.count, sincronizadoEm: snapshot.syncedAt }
        : { pronto: false, quantidade: 0, sincronizadoEm: null };
    }
    res.json({ success: true, fontePrimaria: 'supabase', status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/integracoes/notion/sincronizar', async (req, res) => {
  try {
    const types = Array.isArray(req.body?.types) ? req.body.types : undefined;
    const resultado = await notionMirror.refreshAll(types);
    reconstruirCacheSlugs().catch(error =>
      console.error('[Notion Mirror] Falha ao reconstruir slugs:', error.message)
    );
    res.json({ success: true, fontePrimaria: 'supabase', resultado });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/notion/status-opcoes', async (req, res) => {
  try {
    const schema = await notionMirror.getSchema('clientes');
    const prop = (schema.properties && (schema.properties['Status do Cliente'] || schema.properties['Status'])) || null;
    const opcoes = (prop && prop.select && Array.isArray(prop.select.options)) ? prop.select.options : [];
    const NOTION_CORES = {
      default: '#787878', gray: '#787878', brown: '#b45309', orange: '#ea580c',
      yellow: '#ca8a04', green: '#16a34a', blue: '#2563eb', purple: '#7c3aed',
      pink: '#db2777', red: '#dc2626'
    };
    res.json(opcoes.map(o => ({ name: o.name, color: NOTION_CORES[o.color] || '#64748b' })));
  } catch (e) {
    console.error('Erro em /api/notion/status-opcoes:', e);
    res.status(500).json({ error: e.message });
  }
});
app.get('/api/notion/clientes', async (req, res) => {
  let clientesMapeados = [];
  
  try {
    const pages = (await notionMirror.getPages('clientes'))
      .slice()
      .sort((a, b) => String(b.created_time || '').localeCompare(String(a.created_time || '')));
    clientesMapeados = pages.map(page => {
        const p = page.properties;
        
        const getTitle = (prop) => prop?.title?.map(t => t.plain_text).join('') || '';
        const getRichText = (prop) => prop?.rich_text?.map(t => t.plain_text).join('') || '';
        const getNumber = (prop) => prop?.number || 0;
        const getSelect = (prop) => prop?.select?.name || '';
        const getDateStart = (prop) => prop?.date?.start || '';
        const getDateEnd = (prop) => prop?.date?.end || '';
        const getFormulaNumber = (prop) => prop?.formula?.number || 0;
        const getFormulaString = (prop) => prop?.formula?.string || '';
        const getRollupNumber = (prop) => prop?.rollup?.number || 0;

        return {
          id: page.id,
          nome: getTitle(p['Nome do Cliente'] || p['Name'] || p['Nome']),
          status: getSelect(p['Status do Cliente'] || p['Status']),
          adultos: getNumber(p['Qtd Adultos']),
          criancas: getNumber(p['Qtd Crianças']),
          vooChegada: getRichText(p['Voo de Chegada']),
          vooPartida: getRichText(p['Voo de Partida']),
          vooChegadaNum: '',
          vooChegadaHora: '',
          vooPartidaNum: '',
          vooPartidaHora: '',
          dataInicio: getDateStart(p['Período da Viagem']),
          dataFim: getDateEnd(p['Período da Viagem']),
          hotel: getRichText(p['Hotel']),
          email: p['Email']?.email || '',
          viajantes: getRichText(p['Nome dos Viajantes'] || p['Viajantes']),
          valorTotal: getNumber(p['Valor Total']),
          totalPago: getRollupNumber(p['Total Pago']),
          saldoPagar: getFormulaNumber(p['Saldo a Pagar']),
          statusPagamento: getFormulaString(p['Status de pagamento'])
        };
      });

      // Parse voo fields into components
      clientesMapeados.forEach(c => {
        if (c.vooChegada && c.vooChegada.includes('|')) {
          const parts = c.vooChegada.split('|').map(s => s.trim());
          c.vooChegadaNum = parts[0] || '';
          c.vooChegadaHora = parts[1] || '';
        } else {
          c.vooChegadaNum = c.vooChegada || '';
          c.vooChegadaHora = '';
        }
        if (c.vooPartida && c.vooPartida.includes('|')) {
          const parts = c.vooPartida.split('|').map(s => s.trim());
          c.vooPartidaNum = parts[0] || '';
          c.vooPartidaHora = parts[1] || '';
        } else {
          c.vooPartidaNum = c.vooPartida || '';
          c.vooPartidaHora = '';
        }
      });
  } catch (error) {
    console.error('Erro na conexão do Notion API (Mantendo clientes locais):', error.message);
  }

  // Filtrar apenas registros válidos
  const clientesValidos = clientesMapeados.filter(c => c.nome && c.nome.trim() !== '');

  // Sempre injetar o cliente de teste Lucas e Sofia localmente
  clientesValidos.push({
    id: 'mock-uuid-lucas-sofia',
    nome: 'Lucas e Sofia (Lua de Mel - 15 Dias)',
    status: 'Roteiro em Edição',
    adultos: 2,
    criancas: 0,
    vooChegada: 'JL048 | 15:30',
    vooPartida: 'JL047 | 19:00',
    vooChegadaNum: 'JL048',
    vooChegadaHora: '15:30',
    vooPartidaNum: 'JL047',
    vooPartidaHora: '19:00',
    dataInicio: '2026-10-10',
    dataFim: '2026-10-25',
    hotel: 'Hotel Gracery Shinjuku',
    email: 'lucas_sofia_test@gmail.com',
    viajantes: 'Lucas, Sofia',
    valorTotal: 450000,
    totalPago: 0,
    saldoPagar: 450000,
    statusPagamento: 'Pendente'
  });

  // Derivar Valor do Pacote para clientes sem "Valor Total" no Notion.
  // PERF: lê a tabela de cotações UMA vez só e deriva em memória (antes: 1 leitura da tabela
  // INTEIRA por cliente = N+1, que fazia a lista demorar "uma vida" a cada F5 em produção).
  let _orcDataList = [];
  const _totalPagoPorCliente = new Map();
  try {
    const [{ data: _orcRows }, _entradasPages] = await Promise.all([
      supabase.from('orcamentos').select('data'),
      notionMirror.getPages('entradas')
    ]);
    _orcDataList = (_orcRows || []).map(r => r.data);
    for (const entrada of (_entradasPages || [])) {
      const p = entrada.properties || {};
      const clienteProp = Object.entries(p).find(([nome, prop]) =>
        nome.toLowerCase().includes('cliente') && Array.isArray(prop?.relation)
      );
      const clienteId = clienteProp?.[1]?.relation?.[0]?.id;
      if (!clienteId) continue;
      const valor = Number(p['Valor (JPY)']?.number) || 0;
      _totalPagoPorCliente.set(clienteId, (_totalPagoPorCliente.get(clienteId) || 0) + valor);
    }
  } catch (e) { console.error('Erro ao ler cotações p/ derivar Valor do Pacote:', e.message); }
  for (const c of clientesValidos) {
    if (_totalPagoPorCliente.has(c.id)) c.totalPago = _totalPagoPorCliente.get(c.id);
    if (!c.valorTotal || Number(c.valorTotal) <= 0) {
      const derivado = derivarValorPacoteDeLista(c.id, c.nome, _orcDataList);
      if (derivado > 0) {
        c.valorTotal = derivado;
        c.saldoPagar = Math.max(0, Math.round(c.valorTotal - (c.totalPago || 0)));
        syncNotionClienteValorTotal(c.id, derivado); // background, não aguardado
      }
    }
    c.sinalDevido = derivarSinalDeLista(c.id, c.nome, _orcDataList); // 1º pagamento (entrada)
  }

  clientesValidos.forEach(c => {
    c.saldoPagar = Math.max(0, Math.round((Number(c.valorTotal) || 0) - (Number(c.totalPago) || 0)));
    c.statusPagamento = c.saldoPagar <= 0 ? 'Pago' : (c.totalPago > 0 ? 'Parcial' : 'Pendente');
  });
  res.json(clientesValidos);
});

// ── ENDPOINTS UNIFICADOS DE CLIENTES (NOTION + SUPABASE LOCAL) ────────────────
// --- Sincronia do Perfil & Preferencias com o Notion (camada nova) ---
const cadastroEngine = require('./public/js/cadastro-engine.js');
async function _notionApi(method, pathUrl, body) {
  return fetch('https://api.notion.com/v1' + pathUrl, {
    method,
    headers: { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
}
function _blocoTexto(b) {
  const t = b && b[b.type];
  if (t && Array.isArray(t.rich_text)) return t.rich_text.map(x => (x.plain_text || (x.text && x.text.content) || '')).join('');
  return '';
}
function planejarSyncPerfil(blocks, preferencias) {
  const built = cadastroEngine.construirPayloadNotion(null, preferencias || {});
  const TITULO = '⛩️ Perfil de Viagem & Preferências';
  const idx = (blocks || []).findIndex(b => b.type === 'heading_2' && _blocoTexto(b) === TITULO);
  const aDeletar = idx >= 0 ? blocks.slice(idx) : [];
  return { aDeletar, children: built.children };
}
async function sincronizarPerfilNotion(pageId, preferencias) {
  try {
    if (!pageId || !preferencias) return;
    const r = await _notionApi('GET', `/blocks/${pageId}/children?page_size=100`);
    if (!r.ok) return;
    const data = await r.json();
    const plano = planejarSyncPerfil(data.results || [], preferencias);
    for (const b of plano.aDeletar) { try { await _notionApi('DELETE', `/blocks/${b.id}`); } catch (e) {} }
    if (plano.children && plano.children.length) await _notionApi('PATCH', `/blocks/${pageId}/children`, { children: plano.children });
  } catch (e) { console.error('Falha ao sincronizar perfil no Notion:', e.message); }
}

app.post('/api/clientes', async (req, res) => {
  try {
    const notionPayload = req.body.notionPayload || {};
    const localPayload = req.body.localPayload ? { ...req.body.localPayload } : null;
    if (localPayload && Object.prototype.hasOwnProperty.call(localPayload, 'estadias')) {
      localPayload.estadias = normalizarEstadias(localPayload.estadias);
      notionPayload.hotel = formatarEstadiasParaNotion(localPayload.estadias);
    }
    
    // 1. Criar no Notion
    const properties = {
      'Nome do Cliente': { title: [{ text: { content: notionPayload.nome || 'Novo Cliente' } }] }
    };
    if (notionPayload.status) properties['Status do Cliente'] = { select: { name: notionPayload.status } };
    if (notionPayload.adultos !== undefined) properties['Qtd Adultos'] = { number: parseInt(notionPayload.adultos) || 0 };
    if (notionPayload.criancas !== undefined) properties['Qtd Crianças'] = { number: parseInt(notionPayload.criancas) || 0 };
    const vooChegadaCombined = [notionPayload.vooChegadaNum, notionPayload.vooChegadaHora].filter(Boolean).join(' | ');
    const vooPartidaCombined = [notionPayload.vooPartidaNum, notionPayload.vooPartidaHora].filter(Boolean).join(' | ');
    if (vooChegadaCombined || notionPayload.vooChegada) properties['Voo de Chegada'] = { rich_text: [{ text: { content: vooChegadaCombined || notionPayload.vooChegada } }] };
    if (vooPartidaCombined || notionPayload.vooPartida) properties['Voo de Partida'] = { rich_text: [{ text: { content: vooPartidaCombined || notionPayload.vooPartida } }] };
    if (notionPayload.hotel) properties['Hotel'] = { rich_text: [{ text: { content: notionPayload.hotel } }] };
    if (notionPayload.email) {
      const firstEmail = notionPayload.email.split('\n')[0].trim();
      if (firstEmail) properties['Email'] = { email: firstEmail };
    }
    if (notionPayload.viajantes) properties['Nome dos Viajantes'] = { rich_text: [{ text: { content: notionPayload.viajantes } }] };
    if (notionPayload.dataInicio) {
      properties['Período da Viagem'] = { date: { start: notionPayload.dataInicio, end: notionPayload.dataFim || null } };
    }
    if (notionPayload.profissoes) properties['Profissão dos Viajantes'] = { rich_text: [{ text: { content: notionPayload.profissoes } }] };
    if (notionPayload.ocasiaoEspecial) properties['Ocasião Especial'] = { rich_text: [{ text: { content: notionPayload.ocasiaoEspecial } }] };
    if (notionPayload.necessidadesEspeciais) properties['Necessidades Especiais'] = { rich_text: [{ text: { content: notionPayload.necessidadesEspeciais } }] };
    if (notionPayload.observacoes) properties['Observações'] = { rich_text: [{ text: { content: notionPayload.observacoes } }] };

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_CLIENTS_DB_ID },
        properties
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json(err);
    }
    const data = await response.json();
    const cliId = data.id;
    await notionMirror.upsertPage('clientes', data);

    // 2. Criar localmente no Supabase
    if (localPayload) {
      localPayload.nome = notionPayload.nome || localPayload.nome;
      await salvarClienteLocalCanonico(cliId, localPayload, { sincronizarNotion: false });
    }

    if (localPayload && localPayload.preferencias) { await sincronizarPerfilNotion(cliId, localPayload.preferencias); }

    res.json({ success: true, id: cliId });
  } catch (error) {
    console.error('Erro unificado ao criar cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const realId = await resolverNotionIdReal(id);
    const notionPayload = req.body.notionPayload || {};
    const localPayload = req.body.localPayload ? { ...req.body.localPayload } : null;
    if (localPayload && Object.prototype.hasOwnProperty.call(localPayload, 'estadias')) {
      localPayload.estadias = normalizarEstadias(localPayload.estadias);
      notionPayload.hotel = formatarEstadiasParaNotion(localPayload.estadias);
    }
    
    // 1. Atualizar no Notion
    const properties = {};
    if (notionPayload.nome) properties['Nome do Cliente'] = { title: [{ text: { content: notionPayload.nome } }] };
    if (notionPayload.status) properties['Status do Cliente'] = { select: { name: notionPayload.status } };
    if (notionPayload.adultos !== undefined) properties['Qtd Adultos'] = { number: parseInt(notionPayload.adultos) || 0 };
    if (notionPayload.criancas !== undefined) properties['Qtd Crianças'] = { number: parseInt(notionPayload.criancas) || 0 };
    if (notionPayload.email !== undefined) {
      if (notionPayload.email) {
        const firstEmail = notionPayload.email.split('\n')[0].trim();
        properties['Email'] = { email: firstEmail || null };
      } else {
        properties['Email'] = { email: null };
      }
    }
    if (notionPayload.viajantes !== undefined) properties['Nome dos Viajantes'] = { rich_text: notionPayload.viajantes ? [{ text: { content: notionPayload.viajantes } }] : [] };
    const vooChegadaCombined = [notionPayload.vooChegadaNum, notionPayload.vooChegadaHora].filter(Boolean).join(' | ');
    const vooPartidaCombined = [notionPayload.vooPartidaNum, notionPayload.vooPartidaHora].filter(Boolean).join(' | ');
    
    const finalVooChegada = vooChegadaCombined || notionPayload.vooChegada || '';
    if (notionPayload.vooChegada !== undefined || vooChegadaCombined) properties['Voo de Chegada'] = { rich_text: finalVooChegada ? [{ text: { content: finalVooChegada } }] : [] };
    
    const finalVooPartida = vooPartidaCombined || notionPayload.vooPartida || '';
    if (notionPayload.vooPartida !== undefined || vooPartidaCombined) properties['Voo de Partida'] = { rich_text: finalVooPartida ? [{ text: { content: finalVooPartida } }] : [] };
    
    if (notionPayload.hotel !== undefined) properties['Hotel'] = { rich_text: notionPayload.hotel ? [{ text: { content: notionPayload.hotel } }] : [] };
    if (notionPayload.profissoes !== undefined) properties['Profissão dos Viajantes'] = { rich_text: notionPayload.profissoes ? [{ text: { content: notionPayload.profissoes } }] : [] };
    if (notionPayload.ocasiaoEspecial !== undefined) properties['Ocasião Especial'] = { rich_text: notionPayload.ocasiaoEspecial ? [{ text: { content: notionPayload.ocasiaoEspecial } }] : [] };
    if (notionPayload.necessidadesEspeciais !== undefined) properties['Necessidades Especiais'] = { rich_text: notionPayload.necessidadesEspeciais ? [{ text: { content: notionPayload.necessidadesEspeciais } }] : [] };
    if (notionPayload.observacoes !== undefined) properties['Observações'] = { rich_text: notionPayload.observacoes ? [{ text: { content: notionPayload.observacoes } }] : [] };
    
    if (notionPayload.dataInicio !== undefined) {
      if (notionPayload.dataInicio) {
        properties['Período da Viagem'] = { date: { start: notionPayload.dataInicio, end: notionPayload.dataFim || null } };
      } else {
        properties['Período da Viagem'] = { date: null };
      }
    }

    const response = await fetch(`https://api.notion.com/v1/pages/${realId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Notion recusou a atualização do cliente: ${err.message || response.status}`);
    }

    const paginaAtualizada = await response.json();
    await notionMirror.upsertPage('clientes', paginaAtualizada);

    // 2. Atualizar localmente no Supabase
    let clienteLocalSalvo = null;
    if (localPayload) {
      localPayload.nome = notionPayload.nome || localPayload.nome;
      const resultadoLocal = await salvarClienteLocalCanonico(realId, localPayload, { sincronizarNotion: false });
      clienteLocalSalvo = resultadoLocal.dados;
    }

    if (localPayload && localPayload.preferencias) { await sincronizarPerfilNotion(realId, localPayload.preferencias); }

    res.json({
      success: true,
      id: realId,
      estadias: clienteLocalSalvo && Array.isArray(clienteLocalSalvo.estadias)
        ? clienteLocalSalvo.estadias
        : undefined,
      hotelNotion: notionPayload.hotel
    });
  } catch (error) {
    console.error('Erro unificado ao atualizar cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

// Criar cliente no Notion
app.post('/api/notion/clientes', async (req, res) => {
  try {
    const { nome, status, adultos, criancas, vooChegada, vooPartida, vooChegadaNum, vooChegadaHora, vooPartidaNum, vooPartidaHora, dataInicio, dataFim, hotel, email, viajantes } = req.body;
    
    const properties = {
      'Nome do Cliente': { title: [{ text: { content: nome || 'Novo Cliente' } }] }
    };
    if (status) properties['Status do Cliente'] = { select: { name: status } };
    if (adultos !== undefined) properties['Qtd Adultos'] = { number: parseInt(adultos) || 0 };
    if (criancas !== undefined) properties['Qtd Crianças'] = { number: parseInt(criancas) || 0 };
    const vooChegadaCombined = [vooChegadaNum, vooChegadaHora].filter(Boolean).join(' | ');
    const vooPartidaCombined = [vooPartidaNum, vooPartidaHora].filter(Boolean).join(' | ');
    if (vooChegadaCombined || vooChegada) properties['Voo de Chegada'] = { rich_text: [{ text: { content: vooChegadaCombined || vooChegada } }] };
    if (vooPartidaCombined || vooPartida) properties['Voo de Partida'] = { rich_text: [{ text: { content: vooPartidaCombined || vooPartida } }] };
    if (hotel) properties['Hotel'] = { rich_text: [{ text: { content: hotel } }] };
    if (email) {
      const firstEmail = email.split('\n')[0].trim();
      if (firstEmail) properties['Email'] = { email: firstEmail };
    }
    if (viajantes) properties['Nome dos Viajantes'] = { rich_text: [{ text: { content: viajantes } }] };
    
    if (dataInicio) {
      properties['Período da Viagem'] = { date: { start: dataInicio, end: dataFim || null } };
    }

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_CLIENTS_DB_ID },
        properties
      })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json(err);
    }
    const data = await response.json();
    await notionMirror.upsertPage('clientes', data);
    res.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Erro ao criar no Notion:', error);
    res.status(500).json({ error: error.message });
  }
});

// Atualizar cliente no Notion
app.patch('/api/notion/clientes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, status, adultos, criancas, vooChegada, vooPartida, vooChegadaNum, vooChegadaHora, vooPartidaNum, vooPartidaHora, dataInicio, dataFim, hotel, email, viajantes } = req.body;
    
    const properties = {};
    if (nome) properties['Nome do Cliente'] = { title: [{ text: { content: nome } }] };
    if (status) properties['Status do Cliente'] = { select: { name: status } };
    if (adultos !== undefined) properties['Qtd Adultos'] = { number: parseInt(adultos) || 0 };
    if (criancas !== undefined) properties['Qtd Crianças'] = { number: parseInt(criancas) || 0 };
    if (email !== undefined) {
      if (email) {
        const firstEmail = email.split('\n')[0].trim();
        properties['Email'] = { email: firstEmail || null };
      } else {
        properties['Email'] = { email: null };
      }
    }
    if (viajantes !== undefined) properties['Nome dos Viajantes'] = { rich_text: viajantes ? [{ text: { content: viajantes } }] : [] };
    const vooChegadaCombined = [vooChegadaNum, vooChegadaHora].filter(Boolean).join(' | ');
    const vooPartidaCombined = [vooPartidaNum, vooPartidaHora].filter(Boolean).join(' | ');
    
    const finalVooChegada = vooChegadaCombined || vooChegada || '';
    if (vooChegada !== undefined || vooChegadaCombined) properties['Voo de Chegada'] = { rich_text: finalVooChegada ? [{ text: { content: finalVooChegada } }] : [] };
    
    const finalVooPartida = vooPartidaCombined || vooPartida || '';
    if (vooPartida !== undefined || vooPartidaCombined) properties['Voo de Partida'] = { rich_text: finalVooPartida ? [{ text: { content: finalVooPartida } }] : [] };
    
    if (hotel !== undefined) properties['Hotel'] = { rich_text: hotel ? [{ text: { content: hotel } }] : [] };
    
    if (dataInicio !== undefined) {
      if (dataInicio) {
        properties['Período da Viagem'] = { date: { start: dataInicio, end: dataFim || null } };
      } else {
        properties['Período da Viagem'] = { date: null };
      }
    }

    const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    });

    if (!response.ok) {
      const err = await response.json();
      return res.status(response.status).json(err);
    }
    const data = await response.json();
    await notionMirror.upsertPage('clientes', data);
    res.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Erro ao atualizar no Notion:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── APIs DO CALENDÁRIO & COLABORADORES NOTION ────────────────────────────────
app.get('/api/notion/colaboradores', async (req, res) => {
  try {
    const pages = await notionMirror.getPages('colaboradores');
    const colaboradores = pages.map(item => {
      const nameProp = item.properties.Name || item.properties.Nome;
      const name = nameProp?.title?.[0]?.plain_text || 'Sem Nome';
      const email = item.properties.Email?.email || '';
      const whatsapp = item.properties.Whatsapp?.phone_number || '';
      const rate = item.properties.Rate?.number || 35000;
      const locais = (item.properties.Locais?.multi_select || []).map(x => x.name);
      const residencia = (item.properties.Residência?.multi_select || []).map(x => x.name);
      return {
        id: item.id,
        name: name,
        email: email,
        whatsapp: whatsapp,
        rate: rate,
        locais: locais,
        residencia: residencia,
        avatar: null
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
    res.json(colaboradores);
  } catch (error) {
    console.error('Erro ao buscar colaboradores no Notion:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/calendario/eventos', async (req, res) => {
  try {
    const { data_inicio, data_fim, cliente_id } = req.query;
    
    const { data: calCfg, error: calErr } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
    let eventos = [];
    if (calCfg && calCfg.data) {
      eventos = Array.isArray(calCfg.data) ? calCfg.data : [];
    }

    // Aplicar filtros se fornecidos
    if (data_inicio) {
      eventos = eventos.filter(ev => ev.dataServico >= data_inicio);
    }
    if (data_fim) {
      eventos = eventos.filter(ev => ev.dataServico <= data_fim);
    }
    if (cliente_id) {
      eventos = eventos.filter(ev => ev.clienteId === cliente_id || (ev.clientes && ev.clientes.includes(cliente_id)));
    }

    res.json(eventos);
  } catch (error) {
    console.error('Erro ao buscar eventos do calendário local:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/calendario/eventos', async (req, res) => {
  try {
    const {
      titulo, tipoServico, dataServico, clienteId, cidade, valorDiaria, assigneeIds, observacoes, richData,
      lancarFinanceiro, contaFinanceiraId, valorCusto
    } = req.body;

    if (!titulo || !tipoServico || !dataServico) {
      return res.status(400).json({ error: 'Campos obrigatórios: titulo, tipoServico e dataServico.' });
    }

    const NOTION_AGENDA_DB_ID = process.env.NOTION_AGENDA_DB_ID;

    // 1. Obter nome do cliente no Notion
    let clienteNome = '';
    if (NOTION_TOKEN && clienteId && clienteId !== 'cliente_desconhecido') {
      try {
        const pageData = await notionMirror.getPage('clientes', clienteId);
        if (pageData) {
          const p = pageData.properties;
          const nameProp = p?.['Nome do Cliente'] || p?.['Name'] || p?.['Nome'];
          clienteNome = nameProp?.title?.[0]?.plain_text || '';
        }
      } catch (e) {
        console.error('Erro ao buscar nome do cliente no Notion para inserção:', e);
      }
    }

    // 2. Mapear colaboradores designados
    let assignee = [];
    let colaboradoresMap = {};
    if (NOTION_TOKEN && assigneeIds && assigneeIds.length > 0) {
      try {
        const pages = await notionMirror.getPages('colaboradores');
          pages.forEach(item => {
            const p = item.properties;
            const nameProp = p.Name || p.Nome;
            colaboradoresMap[item.id] = nameProp?.title?.[0]?.plain_text || 'Sem Nome';
          });
          assignee = assigneeIds.map(uid => ({
            id: uid,
            name: colaboradoresMap[uid] || uid
          }));
      } catch (e) {
        console.error('Erro ao mapear colaboradores no Notion:', e);
      }
    }

    // 3. Montar descrição rica/observações para o Notion
    let richTextObs = '';
    if (observacoes) richTextObs += `${observacoes}\n\n`;

    if (tipoServico === 'Transporte' && richData) {
      richTextObs += `--- DETALHES DO TRANSPORTE ---\n`;
      richTextObs += `Tipo: ${richData.tipoTransporte || '-'}\n`;
      richTextObs += `Rota: ${richData.origem || '-'} ➔ ${richData.destino || '-'}\n`;
      richTextObs += `Horário: ${richData.horario || '-'}\n`;
      if (richData.linha) richTextObs += `Linha: ${richData.linha}\n`;
      if (richData.categoria) richTextObs += `Assento/Categoria: ${richData.categoria}\n`;
      if (richData.tempo) richTextObs += `Tempo/Duração: ${richData.tempo}\n`;
      if (richData.adultos) richTextObs += `Passageiros: ${richData.adultos} Adultos\n`;
      richTextObs += `Comprado por Heian: ${richData.compradoHeian ? 'Sim' : 'Não'}\n`;
    } else if (tipoServico === 'Experiência' && richData) {
      richTextObs += `--- DETALHES DA EXPERIÊNCIA ---\n`;
      richTextObs += `Atração: ${richData.nomeExp || titulo}\n`;
      richTextObs += `Horário Entrada: ${richData.horaPartida || '-'}\n`;
      if (richData.adultos) richTextObs += `Passageiros: ${richData.adultos} Adultos\n`;
      if (richData.localEncontro) richTextObs += `Ponto de Encontro: ${richData.localEncontro}\n`;
      richTextObs += `Comprado por Heian: ${richData.compradoHeian ? 'Sim' : 'Não'}\n`;
      if (richData.observacoes) richTextObs += `Notas: ${richData.observacoes}\n`;
    } else if (tipoServico === 'Roteiro' && richData) {
      richTextObs += `--- DETALHES DO ROTEIRO ---\n`;
      if (richData.horaEncontro) richTextObs += `Hora de Encontro: ${richData.horaEncontro}\n`;
      if (richData.localEncontro) richTextObs += `Local de Encontro: ${richData.localEncontro}\n`;
      if (richData.duracaoTour) richTextObs += `Duração: ${richData.duracaoTour}\n`;
    }

    // 4. Cadastrar no Notion se configurado
    let notionPageId = null;
    if (NOTION_TOKEN && NOTION_AGENDA_DB_ID) {
      try {
        const properties = {
          'Nome': {
            title: [{ text: { content: titulo } }]
          },
          'Data do Tour': {
            date: { start: dataServico }
          }
        };

        if (clienteId && clienteId !== 'cliente_desconhecido') {
          properties['🎀 Clientes'] = {
            relation: [{ id: clienteId }]
          };
        }

        if (cidade) {
          properties['Cidade'] = {
            select: { name: cidade }
          };
        }

        if (tipoServico === 'Roteiro' && typeof valorDiaria === 'number') {
          properties['Valor diária do Guia'] = {
            number: valorDiaria
          };
        }

        if (assigneeIds && assigneeIds.length > 0) {
          properties['Responsável'] = {
            relation: assigneeIds.map(uid => ({ id: uid }))
          };
        }

        if (richTextObs) {
          const cleanText = richTextObs.substring(0, 2000);
          properties['Observações'] = {
            rich_text: [{ text: { content: cleanText } }]
          };
        }

        const response = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            parent: { database_id: NOTION_AGENDA_DB_ID },
            properties
          })
        });

        if (response.ok) {
          const pageData = await response.json();
          notionPageId = pageData.id;
          console.log(`[Nova OS] Criada com sucesso no Notion: ${notionPageId}`);
        } else {
          const errText = await response.text();
          console.error('Erro na API do Notion ao cadastrar evento:', errText);
        }
      } catch (e) {
        console.error('Erro na chamada da API do Notion ao cadastrar evento:', e);
      }
    }

    // 4.1 Lançar despesa na contabilidade (Notion Saídas) se solicitado
    let notionSaidaPageId = null;
    if (lancarFinanceiro && valorCusto && Number(valorCusto) > 0 && NOTION_TOKEN) {
      const NOTION_SAIDAS_DB_ID = process.env.NOTION_SAIDAS_DB_ID;
      if (NOTION_SAIDAS_DB_ID) {
        try {
          const descricaoSaida = `Custo Emissão: ${titulo}`;
          const propertiesSaida = {
            'Descrição': { title: [{ text: { content: descricaoSaida } }] },
            'Valor (JPY)': { number: Number(valorCusto) },
            'Data de pagamento': { date: { start: dataServico || new Date().toISOString().substring(0, 10) } }
          };

          if (contaFinanceiraId) {
            propertiesSaida['💳 Contas'] = { relation: [{ id: contaFinanceiraId }] };
          }

          if (clienteId && clienteId !== 'cliente_desconhecido' && clienteId !== 'Sem Nome' && clienteId !== 'Geral') {
            propertiesSaida['🎀 Clientes'] = { relation: [{ id: clienteId }] };
          }

          if (tipoServico === 'Transporte') {
            propertiesSaida['Categoria'] = { select: { name: 'Transporte' } };
            propertiesSaida['Tipo de serviço'] = { select: { name: 'transporte' } };
          } else if (tipoServico === 'Experiência') {
            propertiesSaida['Categoria'] = { select: { name: 'Experiência' } };
            propertiesSaida['Tipo de serviço'] = { select: { name: 'experiência' } };
          }

          console.log(`[Nova Saída] Criando página de custo no Notion para ${tipoServico}...`);
          const responseSaida = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${NOTION_TOKEN}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              parent: { database_id: NOTION_SAIDAS_DB_ID },
              properties: propertiesSaida
            })
          });

          if (responseSaida.ok) {
            const pageDataSaida = await responseSaida.json();
            notionSaidaPageId = pageDataSaida.id;
            console.log(`[Nova Saída] Criada com sucesso no Notion: ${notionSaidaPageId}`);
          } else {
            const errText = await responseSaida.text();
            console.error('Erro na API do Notion ao cadastrar saída:', errText);
          }
        } catch (e) {
          console.error('Erro na chamada da API do Notion ao cadastrar saída:', e);
        }
      }
    }

    // 5. Salvar na base local do Supabase
    const newEventId = notionPageId || `cal_manual_${Date.now()}`;
    const valorDiariaColab = {};
    const pagoColab = {};
    
    if (assigneeIds && assigneeIds.length > 0) {
      assigneeIds.forEach(uid => {
        valorDiariaColab[uid] = tipoServico === 'Roteiro' ? (valorDiaria || 35000) : 0;
        pagoColab[uid] = false;
      });
    }

    const novoEvento = {
      id: newEventId,
      titulo,
      tipoServico,
      dataServico,
      clienteId,
      clientes: [clienteId],
      clienteNome,
      cidade,
      assignee,
      valorDiaria: tipoServico === 'Roteiro' ? (valorDiaria || null) : null,
      pago: false,
      valorDiariaColab,
      pagoColab,
      horaEncontro: tipoServico === 'Roteiro' ? (richData?.horaEncontro || null) : null,
      localEncontro: tipoServico === 'Roteiro' ? (richData?.localEncontro || null) : (tipoServico === 'Experiência' ? (richData?.localEncontro || null) : null),
      duracaoTour: tipoServico === 'Roteiro' ? (richData?.duracaoTour || null) : null,
      rotas: [],
      atracoes: [],
      textos: observacoes ? [observacoes] : [],
      transportInfo: tipoServico === 'Transporte' ? {
        origem: richData?.origem || '',
        destino: richData?.destino || '',
        horario: richData?.horario || '',
        tipoTransporte: richData?.tipoTransporte || '',
        linha: richData?.linha || '',
        categoria: richData?.categoria || '',
        tempo: richData?.tempo || '',
        adultos: richData?.adultos ? Number(richData.adultos) : null,
        compradoHeian: richData?.compradoHeian !== false,
        observacoes: observacoes || '',
        custoValor: valorCusto ? Number(valorCusto) : null,
        lancarFinanceiro: !!lancarFinanceiro,
        contaFinanceiraId: contaFinanceiraId || null,
        notionSaidaPageId: notionSaidaPageId || null
      } : null,
      expInfo: tipoServico === 'Experiência' ? {
        nomeExp: richData?.nomeExp || titulo,
        horaPartida: richData?.horaPartida || '',
        adultos: richData?.adultos ? Number(richData.adultos) : null,
        compradoHeian: richData?.compradoHeian !== false,
        observacoes: observacoes || '',
        custoValor: valorCusto ? Number(valorCusto) : null,
        lancarFinanceiro: !!lancarFinanceiro,
        contaFinanceiraId: contaFinanceiraId || null,
        notionSaidaPageId: notionSaidaPageId || null
      } : null
    };

    // Obter dados locais do Supabase
    const { data: calCfg, error: calErr } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
    let eventos = [];
    if (calCfg && calCfg.data) {
      eventos = Array.isArray(calCfg.data) ? calCfg.data : [];
    }

    eventos.push(novoEvento);

    const { error: updateErr } = await supabase.from('config').update({ data: eventos }).eq('id', 'calendario_eventos');
    if (updateErr) {
      throw new Error(`Erro ao atualizar Supabase: ${updateErr.message}`);
    }

    console.log(`[Nova OS] Evento adicionado localmente: ${newEventId}`);
    res.json({ success: true, event: novoEvento });

    // Disparar envio de e-mails em background
    processarNotificacoesEmail().catch(err => console.error('[Email Trigger] Erro ao processar e-mails pós-cadastro:', err));

  } catch (error) {
    console.error('Erro ao cadastrar evento manualmente:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/calendario/eventos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { assigneeIds, dataServico, valorDiaria, pago, colaboradorId, valorDiariaColab, pagoColab,
            titulo, tipoServico, clienteId, cidade, observacoes, richData } = req.body;

    // Se veio clienteId, obter o nome atualizado do cliente no Notion
    let clienteNomeAtualizado = null;
    if (NOTION_TOKEN && clienteId !== undefined && clienteId && clienteId !== 'cliente_desconhecido') {
      try {
        const pageData = await notionMirror.getPage('clientes', clienteId);
        if (pageData) {
          const p = pageData.properties;
          const nameProp = p?.['Nome do Cliente'] || p?.['Name'] || p?.['Nome'];
          clienteNomeAtualizado = nameProp?.title?.[0]?.plain_text || '';
        }
      } catch (e) {
        console.error('Erro ao buscar nome do cliente no PATCH:', e);
      }
    } else if (clienteId === 'cliente_desconhecido') {
      clienteNomeAtualizado = '';
    }

    // Buscar colaboradores do Notion (somente leitura) para preencher nome/avatar
    let collaborators = [];
    if (NOTION_TOKEN) {
      try {
        const pages = await notionMirror.getPages('colaboradores');
          collaborators = pages.map(item => {
            const nameProp = item.properties.Name || item.properties.Nome;
            const rateProp = item.properties.Rate;
            return {
              id: item.id,
              name: nameProp?.title?.[0]?.plain_text || 'Sem Nome',
              avatar: null,
              rate: rateProp && typeof rateProp.number === 'number' ? rateProp.number : 35000
            };
          });
      } catch (e) {
        console.error('Erro ao buscar colaboradores no Notion para o PATCH:', e);
      }
    }

    const { data: calCfg, error: calErr } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
    let eventos = [];
    if (calCfg && calCfg.data) {
      eventos = Array.isArray(calCfg.data) ? calCfg.data : [];
    }

    let updated = false;
    eventos = eventos.map(ev => {
      if (ev.id === id) {
        updated = true;
        const newEv = { ...ev };

        // Inicializar objetos individuais caso não existam
        if (!newEv.valorDiariaColab) newEv.valorDiariaColab = {};
        if (!newEv.pagoColab) newEv.pagoColab = {};

        // Caso 1: Atualização individualizada de faturamento vinda do dashboard
        if (colaboradorId) {
          if (valorDiariaColab !== undefined) {
            newEv.valorDiariaColab[colaboradorId] = valorDiariaColab === null ? null : Number(valorDiariaColab);
          }
          if (pagoColab !== undefined) {
            newEv.pagoColab[colaboradorId] = !!pagoColab;
          }

          // Compatibilidade global: Se for o colaborador principal (primeiro da lista), atualiza o campo global
          const primaryId = newEv.assignee && newEv.assignee.length > 0 ? newEv.assignee[0].id : null;
          if (colaboradorId === primaryId || !primaryId) {
            if (valorDiariaColab !== undefined) {
              newEv.valorDiaria = valorDiariaColab === null ? null : Number(valorDiariaColab);
            }
            if (pagoColab !== undefined) {
              newEv.pago = !!pagoColab;
            }
          }
        }

        // Caso 2: Atualização de atribuição (designação de guias) vinda do modal ou do card
        if (assigneeIds !== undefined) {
          newEv.assignee = assigneeIds.map(userId => {
            const found = collaborators.find(c => c.id === userId);
            return found ? { id: found.id, name: found.name, avatar: found.avatar } : { id: userId, name: userId };
          });

          // Limpar diárias de colaboradores desmarcados
          Object.keys(newEv.valorDiariaColab).forEach(uid => {
            if (!assigneeIds.includes(uid)) {
              delete newEv.valorDiariaColab[uid];
              delete newEv.pagoColab[uid];
            }
          });

          // Inicializar diárias de novos colaboradores marcados
          assigneeIds.forEach(uid => {
            if (newEv.valorDiariaColab[uid] === undefined || newEv.valorDiariaColab[uid] === null) {
              const isRoteiro = newEv.tipoServico && newEv.tipoServico.toLowerCase() === 'roteiro';
              const colFound = collaborators.find(c => c.id === uid);
              const defaultRate = colFound ? colFound.rate : 35000;
              
              // Se já houver um valorDiaria global definido no evento e for maior que zero, usa ele; senão, usa a taxa do guia
              if (typeof valorDiaria === 'number' && valorDiaria > 0) {
                newEv.valorDiariaColab[uid] = valorDiaria;
              } else if (typeof newEv.valorDiaria === 'number' && newEv.valorDiaria > 0) {
                newEv.valorDiariaColab[uid] = newEv.valorDiaria;
              } else {
                newEv.valorDiariaColab[uid] = isRoteiro ? defaultRate : 0;
              }
            }
            if (newEv.pagoColab[uid] === undefined) {
              newEv.pagoColab[uid] = pago !== undefined ? !!pago : (newEv.pago || false);
            }
          });

          // Compatibilidade global: Sincroniza campos globais com o primeiro colaborador
          if (assigneeIds.length > 0) {
            const primaryId = assigneeIds[0];
            newEv.valorDiaria = newEv.valorDiariaColab[primaryId];
            newEv.pago = newEv.pagoColab[primaryId];
          } else {
            newEv.valorDiaria = null;
            newEv.pago = false;
          }
        }

        // Limpar histórico de envios de e-mails para colaboradores removidos
        if (assigneeIds !== undefined) {
          if (newEv.emails_cadastro_enviados) {
            newEv.emails_cadastro_enviados = newEv.emails_cadastro_enviados.filter(uid => assigneeIds.includes(uid));
          }
          if (newEv.emails_24h_enviados) {
            newEv.emails_24h_enviados = newEv.emails_24h_enviados.filter(uid => assigneeIds.includes(uid));
          }
          if (newEv.emails_1h_enviados) {
            newEv.emails_1h_enviados = newEv.emails_1h_enviados.filter(uid => assigneeIds.includes(uid));
          }
        }

        // Outros campos globais
        if (dataServico !== undefined) {
          if (dataServico !== newEv.dataServico) {
            newEv.dataServico = dataServico;
            // Se a data mudou, resetar envio dos lembretes de 24h e 1h para disparar novamente de acordo com a nova data
            newEv.emails_24h_enviados = [];
            newEv.emails_1h_enviados = [];
          }
        }
        if (valorDiaria !== undefined && assigneeIds === undefined && !colaboradorId) {
          newEv.valorDiaria = valorDiaria === null ? null : Number(valorDiaria);
          // Atualiza também para o primeiro colaborador se houver
          if (newEv.assignee && newEv.assignee.length > 0) {
            newEv.valorDiariaColab[newEv.assignee[0].id] = newEv.valorDiaria;
          }
        }
        if (pago !== undefined && assigneeIds === undefined && !colaboradorId) {
          newEv.pago = !!pago;
          // Atualiza também para o primeiro colaborador se houver
          if (newEv.assignee && newEv.assignee.length > 0) {
            newEv.pagoColab[newEv.assignee[0].id] = newEv.pago;
          }
        }

        // === Edição completa de campos (modal de edição) ===
        if (titulo !== undefined) newEv.titulo = titulo;
        if (tipoServico !== undefined) newEv.tipoServico = tipoServico;
        if (clienteId !== undefined) {
          newEv.clienteId = clienteId;
          newEv.clientes = [clienteId];
          if (clienteNomeAtualizado !== null) newEv.clienteNome = clienteNomeAtualizado;
        }
        if (cidade !== undefined) newEv.cidade = cidade;
        if (observacoes !== undefined) {
          newEv.textos = observacoes ? [observacoes] : [];
        }

        // richData: reescreve os campos específicos por tipo
        if (richData !== undefined && richData) {
          const tipoAtual = (tipoServico !== undefined ? tipoServico : newEv.tipoServico) || '';
          if (tipoAtual === 'Roteiro') {
            newEv.horaEncontro = richData.horaEncontro || null;
            newEv.localEncontro = richData.localEncontro || null;
            newEv.duracaoTour = richData.duracaoTour || null;
            newEv.transportInfo = null;
            newEv.expInfo = null;
          } else if (tipoAtual === 'Transporte') {
            newEv.transportInfo = {
              ...(newEv.transportInfo || {}),
              origem: richData.origem || '',
              destino: richData.destino || '',
              horario: richData.horario || '',
              tipoTransporte: richData.tipoTransporte || '',
              linha: richData.linha || '',
              categoria: richData.categoria || '',
              tempo: richData.tempo || '',
              adultos: richData.adultos ? Number(richData.adultos) : null,
              compradoHeian: richData.compradoHeian !== false,
              observacoes: observacoes !== undefined ? (observacoes || '') : (newEv.transportInfo?.observacoes || '')
            };
            newEv.expInfo = null;
            newEv.horaEncontro = null; newEv.localEncontro = null; newEv.duracaoTour = null;
          } else if (tipoAtual === 'Experiência') {
            newEv.expInfo = {
              ...(newEv.expInfo || {}),
              nomeExp: richData.nomeExp || newEv.titulo,
              horaPartida: richData.horaPartida || '',
              adultos: richData.adultos ? Number(richData.adultos) : null,
              compradoHeian: richData.compradoHeian !== false,
              observacoes: observacoes !== undefined ? (observacoes || '') : (newEv.expInfo?.observacoes || '')
            };
            newEv.localEncontro = richData.localEncontro || null;
            newEv.transportInfo = null;
            newEv.horaEncontro = null; newEv.duracaoTour = null;
          }
        }

        return newEv;
      }
      return ev;
    });

    if (updated) {
      const { error: upsertErr } = await supabase.from('config').upsert({ id: 'calendario_eventos', data: eventos });
      if (upsertErr) throw upsertErr;

      // Espelhar alteração na Agenda do Notion (se for um ID válido e o Token/DB existirem)
      const NOTION_AGENDA_DB_ID = process.env.NOTION_AGENDA_DB_ID;
      if (NOTION_TOKEN && NOTION_AGENDA_DB_ID && id && !id.startsWith('cal_')) {
        try {
          const properties = {};
          const evUpdated = eventos.find(e => e.id === id);
          if (evUpdated) {
            if (assigneeIds !== undefined) {
              properties['Responsável'] = {
                relation: assigneeIds.map(uid => ({ id: uid }))
              };
            }
            if (dataServico !== undefined) {
              properties['Data do Tour'] = dataServico ? { date: { start: dataServico } } : null;
            }
            
            // Gravar diária global no Notion (que representa o guia principal do card)
            if (evUpdated.valorDiaria !== undefined) {
              properties['Valor diária do Guia'] = evUpdated.valorDiaria === null ? null : { number: Number(evUpdated.valorDiaria) };
            }
            if (evUpdated.pago !== undefined) {
              properties['Pagamento concluído '] = {
                status: { name: evUpdated.pago ? "Concluído" : "Não iniciado" }
              };
            }

            // Espelhar campos editados no modal de edição
            if (titulo !== undefined) {
              properties['Nome'] = { title: [{ text: { content: titulo || '' } }] };
            }
            if (cidade !== undefined) {
              properties['Cidade'] = cidade ? { select: { name: cidade } } : { select: null };
            }
            if (clienteId !== undefined) {
              properties['🎀 Clientes'] = {
                relation: (clienteId && clienteId !== 'cliente_desconhecido') ? [{ id: clienteId }] : []
              };
            }
            if (observacoes !== undefined || richData !== undefined) {
              // Reconstrói o bloco de observações rico a partir do estado atualizado
              const tAtual = evUpdated.tipoServico || '';
              let obsTxt = '';
              if (observacoes) obsTxt += `${observacoes}\n\n`;
              if (tAtual === 'Transporte' && evUpdated.transportInfo) {
                const ti = evUpdated.transportInfo;
                obsTxt += `--- DETALHES DO TRANSPORTE ---\n`;
                obsTxt += `Tipo: ${ti.tipoTransporte || '-'}\n`;
                obsTxt += `Rota: ${ti.origem || '-'} ➔ ${ti.destino || '-'}\n`;
                obsTxt += `Horário: ${ti.horario || '-'}\n`;
                if (ti.linha) obsTxt += `Linha: ${ti.linha}\n`;
                if (ti.categoria) obsTxt += `Assento/Categoria: ${ti.categoria}\n`;
                if (ti.tempo) obsTxt += `Tempo/Duração: ${ti.tempo}\n`;
                if (ti.adultos) obsTxt += `Passageiros: ${ti.adultos} Adultos\n`;
                obsTxt += `Comprado por Heian: ${ti.compradoHeian ? 'Sim' : 'Não'}\n`;
              } else if (tAtual === 'Experiência' && evUpdated.expInfo) {
                const ei = evUpdated.expInfo;
                obsTxt += `--- DETALHES DA EXPERIÊNCIA ---\n`;
                obsTxt += `Atração: ${ei.nomeExp || evUpdated.titulo}\n`;
                obsTxt += `Horário Entrada: ${ei.horaPartida || '-'}\n`;
                if (ei.adultos) obsTxt += `Passageiros: ${ei.adultos} Adultos\n`;
                if (evUpdated.localEncontro) obsTxt += `Ponto de Encontro: ${evUpdated.localEncontro}\n`;
                obsTxt += `Comprado por Heian: ${ei.compradoHeian ? 'Sim' : 'Não'}\n`;
              } else if (tAtual === 'Roteiro') {
                obsTxt += `--- DETALHES DO ROTEIRO ---\n`;
                if (evUpdated.horaEncontro) obsTxt += `Hora de Encontro: ${evUpdated.horaEncontro}\n`;
                if (evUpdated.localEncontro) obsTxt += `Local de Encontro: ${evUpdated.localEncontro}\n`;
                if (evUpdated.duracaoTour) obsTxt += `Duração: ${evUpdated.duracaoTour}\n`;
              }
              properties['Observações'] = { rich_text: [{ text: { content: obsTxt.substring(0, 2000) } }] };
            }

            console.log(`Espelhando alteração do evento ${id} na Agenda do Notion...`);
            const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${NOTION_TOKEN}`,
                'Notion-Version': '2022-06-28',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ properties })
            });
            if (!response.ok) {
              const errText = await response.text();
              console.error('Erro na resposta do PATCH no Notion:', errText);
            }
          }
        } catch (notionErr) {
          console.error('Erro ao espelhar alteração na Agenda do Notion:', notionErr);
        }
      }

      res.json({ success: true, id });

      // Disparar envio de e-mails em background para novas atribuições ou alterações
      processarNotificacoesEmail().catch(err => console.error('[Email Trigger] Erro ao processar e-mails pós-PATCH:', err));
    } else {
      res.status(404).json({ error: 'Evento não encontrado' });
    }
  } catch (error) {
    console.error('Erro ao atualizar evento do calendário local:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/calendario/eventos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: calCfg, error: calErr } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
    let eventos = [];
    if (calCfg && calCfg.data) {
      eventos = Array.isArray(calCfg.data) ? calCfg.data : [];
    }

    const eventIndex = eventos.findIndex(ev => ev.id === id);
    if (eventIndex !== -1) {
      // 1. Arquivar card correspondente na Agenda do Notion (se for um ID real do Notion e as chaves existirem)
      const NOTION_AGENDA_DB_ID = process.env.NOTION_AGENDA_DB_ID;
      if (NOTION_TOKEN && NOTION_AGENDA_DB_ID && id && !id.startsWith('cal_')) {
        try {
          console.log(`Arquivando evento ${id} na Agenda do Notion via DELETE...`);
          const response = await fetch(`https://api.notion.com/v1/pages/${id}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${NOTION_TOKEN}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ archived: true })
          });
          if (!response.ok) {
            const errText = await response.text();
            console.error('Erro ao arquivar card no Notion:', errText);
          }
        } catch (notionErr) {
          console.error('Erro ao arquivar card na Agenda do Notion no DELETE:', notionErr);
        }
      }

      // 2. Remover do array local
      eventos.splice(eventIndex, 1);

      // 3. Gravar a lista atualizada de volta no Supabase
      const { error: upsertErr } = await supabase.from('config').upsert({ id: 'calendario_eventos', data: eventos });
      if (upsertErr) throw upsertErr;

      res.json({ success: true, id });
    } else {
      res.status(404).json({ error: 'Evento não encontrado no banco local.' });
    }
  } catch (error) {
    console.error('Erro ao excluir evento do calendário local:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/calendario/sincronizar-do-notion', async (req, res) => {
  try {
    const NOTION_AGENDA_DB_ID = process.env.NOTION_AGENDA_DB_ID;
    const NOTION_COLABORADORES_DB_ID = process.env.NOTION_COLABORADORES_DB_ID || '2a0b6e48f954816082afde2815056602';

    if (!NOTION_TOKEN || !NOTION_AGENDA_DB_ID) {
      return res.status(400).json({ error: 'Configuração do Notion incompleta no .env.' });
    }

    // Função genérica para buscar todas as páginas de uma base do Notion (paginação)
    await notionMirror.refreshAll(['colaboradores', 'clientes', 'agenda']);
    const queryAllNotion = async (dbId) => {
      const wanted = String(dbId || '').replace(/-/g, '').toLowerCase();
      const type = Object.keys(NOTION_DATABASES).find(key =>
        String(NOTION_DATABASES[key] || '').replace(/-/g, '').toLowerCase() === wanted
      );
      if (!type) return { results: [] };
      return { results: await notionMirror.getPages(type) };
    };

    // 1. Buscar todos os colaboradores do Notion para mapear os IDs para nomes
    const colaboradoresData = await queryAllNotion(NOTION_COLABORADORES_DB_ID);
    const colaboradoresMap = {};
    (colaboradoresData.results || []).forEach(item => {
      const p = item.properties;
      const nameProp = p.Name || p.Nome;
      const nome = nameProp?.title?.[0]?.plain_text || 'Sem Nome';
      colaboradoresMap[item.id] = nome;
    });

    // 1b. Buscar todos os clientes do Notion para mapear os IDs para nomes
    const clientesMap = {};
    if (NOTION_CLIENTS_DB_ID) {
      const clientesData = await queryAllNotion(NOTION_CLIENTS_DB_ID);
      (clientesData.results || []).forEach(item => {
        const p = item.properties;
        const nameProp = p['Nome do Cliente'] || p['Name'] || p['Nome'];
        const nome = nameProp?.title?.[0]?.plain_text || '';
        if (nome) clientesMap[item.id] = nome;
      });
      console.log(`[Sync Agenda] Mapeados ${Object.keys(clientesMap).length} clientes do Notion.`);
    }

    // 2. Buscar todos os eventos da Agenda do Notion (ativos/não arquivados)
    const agendaData = await queryAllNotion(NOTION_AGENDA_DB_ID);
    const notionEvents = agendaData.results || [];

    // 3. Buscar os eventos locais do calendário no Supabase
    const { data: calCfg, error: calErr } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
    let eventosLocais = [];
    if (calCfg && calCfg.data) {
      eventosLocais = Array.isArray(calCfg.data) ? calCfg.data : [];
    }

    // Criar um conjunto de IDs ativos no Notion para saber quais deletar localmente
    const notionActiveIds = new Set(notionEvents.map(e => e.id));

    // Filtrar eventos locais: manter os locais temporários (cal_...) e os que continuam ativos no Notion
    let novosEventosLocais = eventosLocais.filter(ev => {
      if (!ev.id) return false;
      if (ev.id.startsWith('cal_')) return true; // Mantém eventos criados apenas localmente
      return notionActiveIds.has(ev.id); // Mantém se ainda estiver no Notion
    });

    // 4. Mapear e atualizar/inserir eventos vindos do Notion
    notionEvents.forEach(item => {
      const p = item.properties;
      const id = item.id;
      
      const titulo = p['Nome']?.title?.map(t => t.plain_text).join('') || 'Serviço sem nome';
      const dataServico = p['Data do Tour']?.date?.start || '';
      
      const clientesRel = p['🎀 Clientes']?.relation || [];
      const clienteId = clientesRel[0]?.id || 'cliente_desconhecido';
      const clienteNome = clientesMap[clienteId] || '';

      const cidade = p['Cidade']?.select?.name || '';
      const valorDiariaNotion = p['Valor diária do Guia']?.number || 0;

      // Mapear responsáveis (colaboradores)
      const responsaveisRel = p['Responsável']?.relation || [];
      const assignee = responsaveisRel.map(r => ({
        id: r.id,
        name: colaboradoresMap[r.id] || 'Desconhecido'
      }));

      // Determinar o tipo de serviço baseado no título ou observações
      let tipoServico = 'Roteiro';
      const tLower = titulo.toLowerCase();
      if (tLower.includes('transporte') || tLower.includes('transfer') || tLower.includes('carro')) {
        tipoServico = 'Transporte';
      } else if (tLower.includes('experiencia') || tLower.includes('experiência')) {
        tipoServico = 'Experiência';
      }

      // Procurar se já existe o evento localmente
      let evLocal = novosEventosLocais.find(ev => ev.id === id);

      if (evLocal) {
        // Se a data do serviço mudou no Notion, resetar os históricos de lembretes
        if (evLocal.dataServico !== dataServico) {
          evLocal.emails_24h_enviados = [];
          evLocal.emails_1h_enviados = [];
        }

        // Limpar do histórico de envios os colaboradores que foram removidos
        const activeIds = assignee.map(a => a.id);
        if (evLocal.emails_cadastro_enviados) {
          evLocal.emails_cadastro_enviados = evLocal.emails_cadastro_enviados.filter(uid => activeIds.includes(uid));
        }
        if (evLocal.emails_24h_enviados) {
          evLocal.emails_24h_enviados = evLocal.emails_24h_enviados.filter(uid => activeIds.includes(uid));
        }
        if (evLocal.emails_1h_enviados) {
          evLocal.emails_1h_enviados = evLocal.emails_1h_enviados.filter(uid => activeIds.includes(uid));
        }

        // Atualiza campos
        evLocal.titulo = titulo;
        evLocal.dataServico = dataServico;
        evLocal.clienteId = clienteId;
        evLocal.clientes = [clienteId];
        evLocal.clienteNome = clienteNome;
        evLocal.cidade = cidade;
        evLocal.assignee = assignee;
        
        // Atualizar diária local se houver guias
        if (!evLocal.valorDiariaColab) evLocal.valorDiariaColab = {};
        if (!evLocal.pagoColab) evLocal.pagoColab = {};

        assignee.forEach(a => {
          if (evLocal.valorDiariaColab[a.id] === undefined) {
            evLocal.valorDiariaColab[a.id] = valorDiariaNotion;
          }
        });
      } else {
        // Criar novo evento vindo do Notion
        const valorDiariaColab = {};
        const pagoColab = {};
        assignee.forEach(a => {
          valorDiariaColab[a.id] = valorDiariaNotion;
          pagoColab[a.id] = false;
        });

        novosEventosLocais.push({
          id,
          titulo,
          dataServico,
          clienteId,
          clientes: [clienteId],
          clienteNome,
          tipoServico,
          cidade,
          assignee,
          valorDiariaColab,
          pagoColab,
          compradoHeian: true,
          observacoes: p['Observações']?.rich_text?.map(t => t.plain_text).join('') || ''
        });
      }
    });

    // 5. Salvar de volta no Supabase
    const { error: upsertErr } = await supabase.from('config').upsert({ id: 'calendario_eventos', data: novosEventosLocais });
    if (upsertErr) throw upsertErr;

    res.json({ success: true, count: notionEvents.length });

    // Disparar envio de e-mails em background para novas designações sincronizadas do Notion
    processarNotificacoesEmail().catch(err => console.error('[Email Trigger] Erro ao processar e-mails pós-sincronismo Notion:', err));
  } catch (error) {
    console.error('Erro ao sincronizar do Notion para o calendário local:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/calendario/sincronizar-roteiro', async (req, res) => {
  try {
    const { roteiroNome } = req.body;
    if (!roteiroNome) return res.status(400).json({ error: 'Parâmetro roteiroNome é obrigatório' });

    // Buscar roteiro no Supabase (aceita ID imutável ou nome)
    const linhaRot = await acharRoteiroPorChaveOuNome(roteiroNome);
    if (!linhaRot || !linhaRot.data) {
      return res.status(404).json({ error: `Roteiro "${roteiroNome}" não encontrado no banco local.` });
    }

    const roteiro = linhaRot.data;
    
    // Obter clienteId (relaxado: sem obrigação de estar no Notion)
    const clienteId = roteiro.notionClienteId || roteiro.cliente?.notionClienteId || roteiro.cliente?.nome || roteiro.nome || 'cliente_desconhecido';
    const clienteNome = roteiro.cliente?.nome || roteiro.nome || 'Cliente';

    const dataInicio = roteiro.cliente?.dataInicio;
    if (!dataInicio) {
      return res.status(400).json({ error: 'Defina uma data de início no roteiro antes de sincronizar com o calendário.' });
    }

    // Função auxiliar para somar dias a data string YYYY-MM-DD
    const somarDias = (dataStr, diasParaSomar) => {
      const [year, month, day] = dataStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      date.setDate(date.getDate() + diasParaSomar);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const novasTarefas = [];

    (roteiro.dias || []).forEach((dia, index) => {
      const dataServico = somarDias(dataInicio, index);

      // A) Roteiro (Passeios/Atrações do Dia) - Apenas se dia.tourGuiado === true
      const sequencias = (dia.elementos || []).filter(el => el.tipo === 'sequencia');
      const infos = (dia.elementos || []).filter(el => el.tipo === 'info');
      const textos = (dia.elementos || []).filter(el => el.tipo === 'texto');

      let cidade = '';
      const nomesAtracoes = [];
      const rotasNomes = [];
      sequencias.forEach(seq => {
        if (seq.cidade) cidade = seq.cidade;
        if (seq.nomeDaRota) rotasNomes.push(seq.nomeDaRota);
        if (seq.atracoesDoDia) {
          seq.atracoesDoDia.forEach(atr => {
            if (atr.nome) nomesAtracoes.push(atr.nome);
          });
        }
      });

      if (dia.tourGuiado === true) {
        let tituloRoteiro = `Dia ${index + 1} - Tour`;
        if (cidade) tituloRoteiro += ` em ${cidade}`;

        let horaEncontro = '';
        let localEncontro = '';
        let duracaoTour = '';
        if (infos.length > 0) {
          horaEncontro = infos[0].horarioEncontro || '';
          localEncontro = infos[0].localEncontro || '';
          duracaoTour = infos[0].duracaoTour || '';
        }

        novasTarefas.push({
          id: `cal_rot_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`,
          titulo: tituloRoteiro,
          dataServico,
          tipoServico: 'Roteiro',
          clienteId,
          clientes: [clienteId],
          clienteNome,
          cidade: cidade || 'Japão',
          horaEncontro,
          localEncontro,
          duracaoTour,
          atracoes: nomesAtracoes,
          rotas: rotasNomes,
          textos: textos.map(t => t.conteudo).filter(Boolean),
          assignee: []
        });
      }

      // B) Transportes - Adiciona sempre que existirem no dia
      const transportes = (dia.elementos || []).filter(el => el.tipo === 'transporte');
      transportes.forEach((t, tIdx) => {
        const orig = t.cidadeOrigem || 'Origem';
        const dest = t.cidadeDestino || 'Destino';
        const hora = t.horario || '';
        const nomeTr = t.tipoTransporte || 'Deslocamento';
        const tituloTr = `Transporte: ${orig} ➔ ${dest} (${nomeTr})`;

        novasTarefas.push({
          id: `cal_tr_${Date.now()}_${index}_${tIdx}_${Math.random().toString(36).substr(2, 9)}`,
          titulo: tituloTr,
          dataServico,
          tipoServico: nomeTr,
          clienteId,
          clientes: [clienteId],
          clienteNome,
          cidade: `${orig} ➔ ${dest}`,
          horaEncontro: hora,
          localEncontro: t.cidadeOrigem ? `Estação/Aeroporto de ${t.cidadeOrigem}` : '',
          transportInfo: {
            origem: orig,
            destino: dest,
            tipoTransporte: nomeTr,
            horario: hora,
            linha: t.linha || '',
            categoria: t.categoria || '',
            tempo: t.tempo || '',
            adultos: t.adultos || '',
            compradoHeian: t.compradoHeian !== false,
            observacoes: t.observacoes || ''
          },
          assignee: []
        });
      });

      // C) Experiências / Tickets - Adiciona sempre que existirem no dia
      const experiencias = (dia.elementos || []).filter(el => el.tipo === 'experiencia');
      experiencias.forEach((e, eIdx) => {
        const hora = e.horaPartida || '';
        const nome = e.nomeExp || 'Experiência';
        const tituloExp = `${nome}`;

        novasTarefas.push({
          id: `cal_exp_${Date.now()}_${index}_${eIdx}_${Math.random().toString(36).substr(2, 9)}`,
          titulo: tituloExp,
          dataServico,
          tipoServico: 'Experiência',
          clienteId,
          clientes: [clienteId],
          clienteNome,
          cidade: cidade || 'Japão',
          horaEncontro: hora,
          localEncontro: e.localEncontro || e.observacoes || '',
          expInfo: {
            nomeExp: nome,
            horaPartida: hora,
            adultos: e.adultos || '',
            compradoHeian: e.compradoHeian !== false,
            observacoes: e.observacoes || ''
          },
          assignee: []
        });
      });
    });

    // Buscar eventos existentes para outras cotações/clientes
    const { data: calCfg, error: calErr } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
    let eventosExistentes = [];
    if (calCfg && calCfg.data) {
      eventosExistentes = Array.isArray(calCfg.data) ? calCfg.data : [];
    }

    // Filtrar eventos antigos deste roteiro para removê-los
    const eventosFiltrados = eventosExistentes.filter(ev => {
      const matchCliente = ev.clienteId && ev.clienteId === clienteId;
      const matchRoteiro = ev.roteiroNome && ev.roteiroNome === roteiroNome;
      return !matchCliente && !matchRoteiro;
    });

    // Mapear guias que já estavam atribuídos para preservá-los
    const encontrarGuiaExistente = (tipo, data) => {
      const match = eventosExistentes.find(ev => 
        ev.dataServico === data && 
        (ev.clienteId === clienteId || ev.roteiroNome === roteiroNome) &&
        (ev.tipoServico === tipo || (tipo !== 'Roteiro' && tipo !== 'Experiência' && ev.tipoServico !== 'Roteiro' && ev.tipoServico !== 'Experiência'))
      );
      return match ? match.assignee : [];
    };

    // Aplicar a busca de guias e roteiroNome nos novos eventos
    novasTarefas.forEach(ev => {
      ev.assignee = encontrarGuiaExistente(ev.tipoServico, ev.dataServico);
      ev.roteiroNome = roteiroNome;
    });

    // ── CONFIGURAÇÃO DE SINCRONIZAÇÃO COM A AGENDA DO NOTION ──
    const NOTION_AGENDA_DB_ID = process.env.NOTION_AGENDA_DB_ID;
    
    if (NOTION_TOKEN && NOTION_AGENDA_DB_ID && clienteId && clienteId !== 'cliente_desconhecido') {
      try {
        console.log(`Buscando eventos antigos na Agenda do Notion para o cliente ${clienteId}...`);
        const queryResponse = await fetch(`https://api.notion.com/v1/databases/${NOTION_AGENDA_DB_ID}/query`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filter: {
              property: '🎀 Clientes',
              relation: { contains: clienteId }
            }
          })
        });

        if (queryResponse.ok) {
          const queryData = await queryResponse.json();
          const oldEvents = queryData.results || [];
          console.log(`Arquivando ${oldEvents.length} eventos antigos na Agenda do Notion...`);
          
          for (const evPage of oldEvents) {
            try {
              await fetch(`https://api.notion.com/v1/pages/${evPage.id}`, {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${NOTION_TOKEN}`,
                  'Notion-Version': '2022-06-28',
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ archived: true })
              });
            } catch (err) {
              console.error(`Erro ao arquivar card ${evPage.id} na Agenda do Notion:`, err);
            }
          }
        }
      } catch (notionQueryErr) {
        console.error('Erro ao limpar eventos na Agenda do Notion:', notionQueryErr);
      }
    }

    // Criar as novas tarefas na Agenda do Notion e associar os IDs retornados
    for (const tf of novasTarefas) {
      if (NOTION_TOKEN && NOTION_AGENDA_DB_ID && clienteId && clienteId !== 'cliente_desconhecido') {
        try {
          let valorDiariaPadrao = 0;
          const isRoteiro = tf.tipoServico && tf.tipoServico.toLowerCase() === 'roteiro';
          
          if (isRoteiro) {
            valorDiariaPadrao = 35000; // Valor de fallback padrão
          }

          // Montar o descritivo rico e estruturado para a coluna de Observações
          let obsTexto = '';
          const parts = [];
          
          if (isRoteiro) {
            if (tf.horaEncontro) parts.push(`🕒 Horário de Encontro: ${tf.horaEncontro}`);
            if (tf.localEncontro) parts.push(`📍 Local de Encontro: ${tf.localEncontro}`);
            if (tf.duracaoTour) parts.push(`⏳ Duração: Tour de ${tf.duracaoTour}`);
            if (tf.rotas && tf.rotas.length > 0) parts.push(`🗺️ Rota:\n${tf.rotas.join(' ➔ ')}`);
            if (tf.atracoes && tf.atracoes.length > 0) parts.push(`⭐ Atrações:\n${tf.atracoes.join(', ')}`);
            if (tf.textos && tf.textos.length > 0) parts.push(`📝 Detalhes:\n${tf.textos.join('\n')}`);
          } else if (tf.transportInfo) {
            if (tf.transportInfo.tipoTransporte) parts.push(`Transporte: ${tf.transportInfo.tipoTransporte}`);
            if (tf.transportInfo.origem && tf.transportInfo.destino) parts.push(`Trajeto: ${tf.transportInfo.origem} ➔ ${tf.transportInfo.destino}`);
            if (tf.transportInfo.horario) parts.push(`Horário Encontro: ${tf.transportInfo.horario}`);
            if (tf.transportInfo.observacoes) parts.push(`Detalhes: ${tf.transportInfo.observacoes}`);
          } else if (tf.expInfo) {
            if (tf.expInfo.nomeExp) parts.push(`Experiência: ${tf.expInfo.nomeExp}`);
            if (tf.expInfo.horaPartida) parts.push(`Horário Encontro: ${tf.expInfo.horaPartida}`);
            if (tf.expInfo.observacoes) parts.push(`Detalhes: ${tf.expInfo.observacoes}`);
          }
          
          obsTexto = parts.join('\n\n').trim();

          const properties = {
            'Nome': {
              title: [{ text: { content: tf.titulo } }]
            },
            'Data do Tour': {
              date: { start: tf.dataServico }
            },
            '🎀 Clientes': {
              relation: [{ id: clienteId }]
            }
          };

          if (tf.cidade) {
            const cidadeClean = tf.cidade.substring(0, 50).trim();
            properties['Cidade'] = {
              select: { name: cidadeClean }
            };
          }

          if (tf.assignee && tf.assignee.length > 0) {
            properties['Responsável'] = {
              relation: tf.assignee.map(a => ({ id: a.id }))
            };
          }

          properties['Valor diária do Guia'] = {
            number: isRoteiro ? valorDiariaPadrao : 0
          };

          if (obsTexto) {
            properties['Observações'] = {
              rich_text: [{ text: { content: obsTexto.substring(0, 2000) } }]
            };
          }

          const response = await fetch('https://api.notion.com/v1/pages', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${NOTION_TOKEN}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              parent: { database_id: NOTION_AGENDA_DB_ID },
              properties
            })
          });

          if (response.ok) {
            const pageData = await response.json();
            tf.id = pageData.id; // Substitui o ID pseudo-aleatório pelo ID real do Notion!
            tf.valorDiaria = isRoteiro ? valorDiariaPadrao : 0;
            tf.pago = false;
          } else {
            const errText = await response.text();
            console.error('Erro ao cadastrar evento na Agenda do Notion:', errText);
          }
        } catch (err) {
          console.error('Erro ao cadastrar card na Agenda do Notion:', err);
        }
      }
    }

    const todosEventos = [...eventosFiltrados, ...novasTarefas];

    // Gravar localmente no Supabase
    const { error: upsertErr } = await supabase.from('config').upsert({ id: 'calendario_eventos', data: todosEventos });
    if (upsertErr) throw upsertErr;

    res.json({ success: true, count: novasTarefas.length });

    // Disparar envio de e-mails em background para novas atividades criadas a partir do roteiro
    processarNotificacoesEmail().catch(err => console.error('[Email Trigger] Erro ao processar e-mails pós-sincronismo Roteiro:', err));
  } catch (error) {
    console.error('Erro ao sincronizar roteiro com calendário local:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── API: Dashboard Financeiro e Contas do Notion ─────────────────────────────

app.get('/api/notion/contas', async (req, res) => {
  try {
    const pages = await notionMirror.getPages('contas');
    const contas = pages
      .map(item => {
        const p = item.properties;
        return {
          id: item.id,
          nome: p['Nome']?.title?.map(t => t.plain_text).join('') || 'Sem Nome'
        };
      })
      .filter(c => !c.nome.toLowerCase().includes('wise da mocreia') && !c.nome.toLowerCase().includes('wise da mocréia'));

    res.json(contas);
  } catch (error) {
    console.error('Erro ao buscar contas no Notion:', error);
    res.status(500).json({ error: 'Erro ao buscar contas no Notion', details: error.message });
  }
});

app.post('/api/calendario/pagar-guia', async (req, res) => {
  try {
    const { eventoId, colaboradorId, clienteId, contaId, moeda, valorMoedaOriginal } = req.body;
    if (!eventoId || !colaboradorId || !clienteId || !contaId || !moeda || !valorMoedaOriginal) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes: eventoId, colaboradorId, clienteId, contaId, moeda, valorMoedaOriginal.' });
    }

    // 1. Obter evento local
    const { data: calCfg } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
    let eventos = [];
    if (calCfg && calCfg.data) {
      eventos = Array.isArray(calCfg.data.data) ? calCfg.data.data : (Array.isArray(calCfg.data) ? calCfg.data : []);
    }

    const evIndex = eventos.findIndex(e => e.id === eventoId);
    if (evIndex === -1) {
      return res.status(404).json({ error: 'Evento não encontrado no calendário.' });
    }

    const ev = eventos[evIndex];

    // Obter as taxas de câmbio da config do Supabase
    const { data: appConfig } = await supabase.from('config').select('data').eq('id', 'app_config').single();
    let rateBRL = 0.031670;
    let rateUSD = 0.006280;
    if (appConfig && appConfig.data) {
      rateBRL = parseFloat(appConfig.data.cambio_jpy_brl) || rateBRL;
      rateUSD = parseFloat(appConfig.data.cambio_jpy_usd) || rateUSD;
    }

    // 2. Calcular valor em JPY
    const valorOriginalNum = Number(valorMoedaOriginal) || 0;
    let valorJPY = valorOriginalNum;
    let descCambioText = '';

    if (moeda === 'BRL') {
      valorJPY = Math.round(valorOriginalNum / rateBRL);
      descCambioText = ` [Original: R$ ${valorOriginalNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Câmbio JPY/BRL: ${rateBRL.toFixed(6)}]`;
    } else if (moeda === 'USD') {
      valorJPY = Math.round(valorOriginalNum / rateUSD);
      descCambioText = ` [Original: $ ${valorOriginalNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Câmbio JPY/USD: ${rateUSD.toFixed(6)}]`;
    } else {
      descCambioText = ` [Original: ¥ ${valorOriginalNum.toLocaleString('en-US')} JPY]`;
    }

    // 3. Criar registro de Saída no Notion
    const NOTION_SAIDAS_DB_ID = process.env.NOTION_SAIDAS_DB_ID;
    
    const colabObj = ev.assignee ? ev.assignee.find(a => a.id === colaboradorId) : null;
    const colabName = colabObj ? colabObj.name : 'Colaborador';
    
    const descricaoSaida = `Pagamento Guia: ${colabName} - ${ev.titulo || 'Serviço'}${descCambioText}`;

    const properties = {
      'Descrição': { title: [{ text: { content: descricaoSaida } }] },
      'Valor (JPY)': { number: valorJPY },
      'Data de pagamento': { date: { start: ev.dataServico || new Date().toISOString().substring(0, 10) } },
      'Categoria': { select: { name: 'Pagamento Guia' } },
      'Tipo de serviço': { select: { name: 'guia' } },
      '🎀 Clientes': { relation: [{ id: clienteId }] },
      '🫂 Colaboradores': { relation: [{ id: colaboradorId }] },
      '💳 Contas': { relation: [{ id: contaId }] }
    };

    const notionRes = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_SAIDAS_DB_ID },
        properties
      })
    });

    if (!notionRes.ok) {
      const errTxt = await notionRes.text();
      throw new Error(`Erro ao criar Saída no Notion: ${errTxt}`);
    }

    const notionData = await notionRes.json();
    await notionMirror.upsertPage('saidas', notionData);

    // 4. Atualizar evento local no Supabase
    if (!ev.pagoColab) ev.pagoColab = {};
    if (!ev.valorDiariaColab) ev.valorDiariaColab = {};

    ev.pagoColab[colaboradorId] = true;
    
    // Sempre mantemos a diária local em JPY (convertida se necessário)
    ev.valorDiariaColab[colaboradorId] = valorJPY;
    
    const primaryId = ev.assignee && ev.assignee.length > 0 ? ev.assignee[0].id : null;
    if (colaboradorId === primaryId) {
      ev.pago = true;
      ev.valorDiaria = valorJPY;
    }

    const { error: upsertErr } = await supabase.from('config').upsert({ id: 'calendario_eventos', data: eventos });
    if (upsertErr) throw upsertErr;

    res.json({ success: true, notionPageId: notionData.id, valorJPY });
  } catch (error) {
    console.error('Erro ao processar pagamento do guia no backend:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notion/registrar-entrada', async (req, res) => {
  try {
    const { clienteId, descricao, valorOriginal, moeda, contaId, data, cambioManual, valorJPYManual } = req.body;

    if (!clienteId || !descricao || !valorOriginal || !moeda || !contaId) {
      return res.status(400).json({ error: 'Parâmetros incompletos.' });
    }

    // 1. Obter taxas de câmbio
    const appConfig = await supabase.from('config').select('data').eq('id', 'app_config').single();
    let rateBRL = 0.031670;
    let rateUSD = 0.006280;
    if (appConfig && appConfig.data) {
      rateBRL = parseFloat(appConfig.data.cambio_jpy_brl) || rateBRL;
      rateUSD = parseFloat(appConfig.data.cambio_jpy_usd) || rateUSD;
    }

    const valorOriginalNum = Number(valorOriginal) || 0;
    const valorJPYManualNum = Number(valorJPYManual) || 0;
    const cambioManualNum = Number(cambioManual) || 0;

    // Prioridade do câmbio: (1) o ¥ que a entrada quita → câmbio DERIVADO (R$/¥),
    // (2) câmbio manual informado, (3) câmbio corrente (spot).
    if (valorJPYManualNum > 0 && valorOriginalNum > 0) {
      if (moeda === 'BRL') rateBRL = valorOriginalNum / valorJPYManualNum;
      else if (moeda === 'USD') rateUSD = valorOriginalNum / valorJPYManualNum;
    } else if (cambioManualNum > 0) {
      if (moeda === 'BRL') rateBRL = cambioManualNum;
      else if (moeda === 'USD') rateUSD = cambioManualNum;
    }

    let valorJPY = valorOriginalNum;
    let descCambioText = '';

    if (moeda === 'BRL') {
      valorJPY = (valorJPYManualNum > 0) ? Math.round(valorJPYManualNum) : Math.round(valorOriginalNum / rateBRL);
      descCambioText = ` [Original: R$ ${valorOriginalNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Câmbio JPY/BRL: ${rateBRL.toFixed(6)}]`;
    } else if (moeda === 'USD') {
      valorJPY = (valorJPYManualNum > 0) ? Math.round(valorJPYManualNum) : Math.round(valorOriginalNum / rateUSD);
      descCambioText = ` [Original: $ ${valorOriginalNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Câmbio JPY/USD: ${rateUSD.toFixed(6)}]`;
    } else {
      descCambioText = ` [Original: ¥ ${valorOriginalNum.toLocaleString('en-US')} JPY]`;
    }

    const descricaoCompleta = `${descricao}${descCambioText}`;

    // 2. Criar página na base de Entradas do Notion
    const NOTION_ENTRADAS_DB_ID = process.env.NOTION_ENTRADAS_DB_ID;
    
    const properties = {
      'Descrição da Entrada': { title: [{ text: { content: descricaoCompleta } }] },
      'Valor (JPY)': { number: valorJPY },
      'Data do pagamento': { date: { start: data || new Date().toISOString().substring(0, 10) } },
      'Moeda Original': { select: { name: moeda } },
      'Cliente (Relação)': { relation: [{ id: clienteId }] },
      '💳 Contas': { relation: [{ id: contaId }] }
    };

    const notionRes = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_ENTRADAS_DB_ID },
        properties
      })
    });

    if (!notionRes.ok) {
      const errTxt = await notionRes.text();
      throw new Error(`Erro ao criar entrada no Notion: ${errTxt}`);
    }

    const notionData = await notionRes.json();
    await notionMirror.upsertPage('entradas', notionData);
    res.json({ success: true, notionPageId: notionData.id, valorJPY });
  } catch (error) {
    console.error('Erro ao registrar entrada de pagamento:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notion/registrar-saida', async (req, res) => {
  try {
    const { clienteId, colaboradorId, eventoId, descricao, valorOriginal, moeda, contaId, data, taskId } = req.body;

    if (!descricao || !valorOriginal || !moeda || !contaId) {
      return res.status(400).json({ error: 'Parâmetros incompletos.' });
    }

    // 1. Obter taxas de câmbio
    const appConfig = await supabase.from('config').select('data').eq('id', 'app_config').single();
    let rateBRL = 0.031670;
    let rateUSD = 0.006280;
    if (appConfig && appConfig.data) {
      rateBRL = parseFloat(appConfig.data.cambio_jpy_brl) || rateBRL;
      rateUSD = parseFloat(appConfig.data.cambio_jpy_usd) || rateUSD;
    }

    const valorOriginalNum = Number(valorOriginal) || 0;
    let valorJPY = valorOriginalNum;
    let descCambioText = '';

    if (moeda === 'BRL') {
      valorJPY = Math.round(valorOriginalNum / rateBRL);
      descCambioText = ` [Original: R$ ${valorOriginalNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Câmbio JPY/BRL: ${rateBRL.toFixed(6)}]`;
    } else if (moeda === 'USD') {
      valorJPY = Math.round(valorOriginalNum / rateUSD);
      descCambioText = ` [Original: $ ${valorOriginalNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Câmbio JPY/USD: ${rateUSD.toFixed(6)}]`;
    } else {
      descCambioText = ` [Original: ¥ ${valorOriginalNum.toLocaleString('en-US')} JPY]`;
    }

    const descricaoCompleta = `${descricao}${descCambioText}`;

    // 2. Criar página na base de Saídas do Notion
    const NOTION_SAIDAS_DB_ID = process.env.NOTION_SAIDAS_DB_ID;
    
    const properties = {
      'Descrição': { title: [{ text: { content: descricaoCompleta } }] },
      'Valor (JPY)': { number: valorJPY },
      'Data de pagamento': { date: { start: data || new Date().toISOString().substring(0, 10) } },
      '💳 Contas': { relation: [{ id: contaId }] }
    };

    if (clienteId && clienteId !== 'cliente_desconhecido' && clienteId !== 'Sem Nome' && clienteId !== 'Geral') {
      properties['🎀 Clientes'] = { relation: [{ id: clienteId }] };
    }

    if (colaboradorId) {
      properties['🫂 Colaboradores'] = { relation: [{ id: colaboradorId }] };
    }

    if (taskId) {
      properties['Saída financeira'] = { relation: [{ id: taskId }] };
    }

    const notionRes = await fetch(`https://api.notion.com/v1/pages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_SAIDAS_DB_ID },
        properties
      })
    });

    if (!notionRes.ok) {
      const errTxt = await notionRes.text();
      throw new Error(`Erro ao criar saída no Notion: ${errTxt}`);
    }

    const notionData = await notionRes.json();
    await notionMirror.upsertPage('saidas', notionData);

    // 3. Se houver eventoId e colaboradorId, marcar o colaborador como pago no Supabase
    let localUpdated = false;
    if (eventoId && colaboradorId) {
      const { data: calCfg, error: calErr } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
      if (calCfg && calCfg.data) {
        let eventos = Array.isArray(calCfg.data) ? calCfg.data : [];
        eventos = eventos.map(ev => {
          if (ev.id === eventoId) {
            localUpdated = true;
            const newEv = { ...ev };
            if (!newEv.pagoColab) newEv.pagoColab = {};
            newEv.pagoColab[colaboradorId] = true;

            // Se for o colaborador principal, atualizar o campo global "pago"
            const primaryId = newEv.assignee && newEv.assignee.length > 0 ? newEv.assignee[0].id : null;
            if (colaboradorId === primaryId || !primaryId) {
              newEv.pago = true;
            }
            return newEv;
          }
          return ev;
        });

        if (localUpdated) {
          const { error: upsertErr } = await supabase.from('config').upsert({ id: 'calendario_eventos', data: eventos });
          if (upsertErr) {
            console.error('Erro ao atualizar status de pagamento do evento no Supabase:', upsertErr);
          }
        }
      }
    }

    res.json({ success: true, notionPageId: notionData.id, valorJPY, localUpdated });
  } catch (error) {
    console.error('Erro ao registrar saída de pagamento:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── ROTAS DE EDIÇÃO E EXCLUSÃO DE ENTRADAS E SAÍDAS NO NOTION ────────────────
app.put('/api/notion/entradas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { descricao, valorOriginal, moeda, valorJPYManual, contaId, data, clienteId } = req.body;
    if (!NOTION_TOKEN) return res.status(400).json({ error: 'Notion token não configurado.' });

    const appConfig = await supabase.from('config').select('data').eq('id', 'app_config').single();
    let rateBRL = 0.031670;
    let rateUSD = 0.006280;
    if (appConfig && appConfig.data) {
      rateBRL = parseFloat(appConfig.data.cambio_jpy_brl) || rateBRL;
      rateUSD = parseFloat(appConfig.data.cambio_jpy_usd) || rateUSD;
    }

    const valorOriginalNum = Number(valorOriginal) || 0;
    const valorJPYManualNum = Number(valorJPYManual) || 0;
    let valorJPY = valorOriginalNum;
    let descCambioText = '';

    if (moeda === 'BRL') {
      valorJPY = (valorJPYManualNum > 0) ? Math.round(valorJPYManualNum) : Math.round(valorOriginalNum / rateBRL);
      const cambioAplicado = (valorJPYManualNum > 0 && valorOriginalNum > 0) ? (valorOriginalNum / valorJPYManualNum) : rateBRL;
      descCambioText = ` [Original: R$ ${valorOriginalNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Câmbio JPY/BRL: ${cambioAplicado.toFixed(6)}]`;
    } else if (moeda === 'USD') {
      valorJPY = (valorJPYManualNum > 0) ? Math.round(valorJPYManualNum) : Math.round(valorOriginalNum / rateUSD);
      const cambioAplicado = (valorJPYManualNum > 0 && valorOriginalNum > 0) ? (valorOriginalNum / valorJPYManualNum) : rateUSD;
      descCambioText = ` [Original: $ ${valorOriginalNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Câmbio JPY/USD: ${cambioAplicado.toFixed(6)}]`;
    } else {
      descCambioText = ` [Original: ¥ ${valorOriginalNum.toLocaleString('en-US')} JPY]`;
    }

    const descricaoCompleta = `${descricao}${descCambioText}`;
    const properties = {
      'Descrição da Entrada': { title: [{ text: { content: descricaoCompleta } }] },
      'Valor (JPY)': { number: valorJPY },
      'Data do pagamento': { date: { start: data || new Date().toISOString().substring(0, 10) } },
      'Moeda Original': { select: { name: moeda || 'JPY' } }
    };
    if (contaId) {
      properties['💳 Contas'] = { relation: [{ id: contaId }] };
    }
    if (clienteId) {
      properties['Cliente (Relação)'] = { relation: [{ id: clienteId }] };
    }

    const notionRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    });

    if (!notionRes.ok) {
      const errTxt = await notionRes.text();
      throw new Error(`Erro ao atualizar entrada no Notion: ${errTxt}`);
    }

    const paginaAtualizada = await notionRes.json();
    await notionMirror.upsertPage('entradas', paginaAtualizada);
    res.json({ success: true, valorJPY });
  } catch (error) {
    console.error('Erro ao atualizar entrada no Notion:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/notion/entradas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!NOTION_TOKEN) return res.status(400).json({ error: 'Notion token não configurado.' });

    const notionRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ archived: true })
    });

    if (!notionRes.ok) {
      const errTxt = await notionRes.text();
      throw new Error(`Erro ao excluir entrada no Notion: ${errTxt}`);
    }

    await notionMirror.removePage('entradas', id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir entrada no Notion:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/notion/saidas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { descricao, valorOriginal, moeda, contaId, data, clienteId, colaboradorId } = req.body;
    if (!NOTION_TOKEN) return res.status(400).json({ error: 'Notion token não configurado.' });

    const appConfig = await supabase.from('config').select('data').eq('id', 'app_config').single();
    let rateBRL = 0.031670;
    let rateUSD = 0.006280;
    if (appConfig && appConfig.data) {
      rateBRL = parseFloat(appConfig.data.cambio_jpy_brl) || rateBRL;
      rateUSD = parseFloat(appConfig.data.cambio_jpy_usd) || rateUSD;
    }

    const valorOriginalNum = Number(valorOriginal) || 0;
    let valorJPY = valorOriginalNum;
    let descCambioText = '';

    if (moeda === 'BRL') {
      valorJPY = Math.round(valorOriginalNum / rateBRL);
      descCambioText = ` [Original: R$ ${valorOriginalNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Câmbio JPY/BRL: ${rateBRL.toFixed(6)}]`;
    } else if (moeda === 'USD') {
      valorJPY = Math.round(valorOriginalNum / rateUSD);
      descCambioText = ` [Original: $ ${valorOriginalNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} | Câmbio JPY/USD: ${rateUSD.toFixed(6)}]`;
    } else {
      descCambioText = ` [Original: ¥ ${valorOriginalNum.toLocaleString('en-US')} JPY]`;
    }

    const descricaoCompleta = `${descricao}${descCambioText}`;
    const properties = {
      'Descrição': { title: [{ text: { content: descricaoCompleta } }] },
      'Valor (JPY)': { number: valorJPY },
      'Data de pagamento': { date: { start: data || new Date().toISOString().substring(0, 10) } }
    };
    if (contaId) {
      properties['💳 Contas'] = { relation: [{ id: contaId }] };
    }
    if (clienteId && clienteId !== 'cliente_desconhecido' && clienteId !== 'Sem Nome' && clienteId !== 'Geral') {
      properties['🎀 Clientes'] = { relation: [{ id: clienteId }] };
    }
    if (colaboradorId) {
      properties['🫂 Colaboradores'] = { relation: [{ id: colaboradorId }] };
    }

    const notionRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    });

    if (!notionRes.ok) {
      const errTxt = await notionRes.text();
      throw new Error(`Erro ao atualizar saída no Notion: ${errTxt}`);
    }

    const paginaAtualizada = await notionRes.json();
    await notionMirror.upsertPage('saidas', paginaAtualizada);
    res.json({ success: true, valorJPY });
  } catch (error) {
    console.error('Erro ao atualizar saída no Notion:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/notion/saidas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!NOTION_TOKEN) return res.status(400).json({ error: 'Notion token não configurado.' });

    const notionRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ archived: true })
    });

    if (!notionRes.ok) {
      const errTxt = await notionRes.text();
      throw new Error(`Erro ao excluir saída no Notion: ${errTxt}`);
    }

    await notionMirror.removePage('saidas', id);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir saída no Notion:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/notion/tasks-cliente/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const NOTION_TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;

    if (!NOTION_TOKEN || !NOTION_TASKS_DB_ID) {
      return res.status(400).json({ error: 'Configuração do Notion incompleta.' });
    }

    const clientIdNorm = String(clientId).replace(/-/g, '').toLowerCase();
    const pages = await notionMirror.getPages('tasks');
    const relacionadas = pages.filter(item =>
      Object.values(item.properties || {}).some(prop =>
        Array.isArray(prop?.relation) &&
        prop.relation.some(rel => String(rel.id).replace(/-/g, '').toLowerCase() === clientIdNorm)
      )
    );
    const tasks = relacionadas.map(item => {
      const p = item.properties;
      const nome = p['Task name']?.title?.map(t => t.plain_text).join('') || 'Sem nome';
      return {
        id: item.id,
        nome
      };
    });

    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Erro ao buscar tasks do cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/financeiro/diarias-pendentes', async (req, res) => {
  try {
    const { data: calCfg } = await supabase.from('config').select('data').eq('id', 'calendario_eventos').single();
    let eventos = [];
    if (calCfg && calCfg.data) {
      eventos = Array.isArray(calCfg.data) ? calCfg.data : [];
    }

    const diariasPendentes = [];

    eventos.forEach(ev => {
      if (ev.assignee && ev.assignee.length > 0) {
        ev.assignee.forEach(a => {
          const colabId = a.id;
          const colabName = a.name;
          const valor = ev.valorDiariaColab ? ev.valorDiariaColab[colabId] : 0;
          const pago = ev.pagoColab ? ev.pagoColab[colabId] : false;

          // Se tiver valor de diária configurado e não estiver pago
          if (valor > 0 && !pago) {
            diariasPendentes.push({
              eventoId: ev.id,
              eventoTitulo: ev.titulo,
              dataServico: ev.dataServico,
              clienteId: ev.clienteId,
              clienteNome: ev.clienteNome || 'Geral',
              colaboradorId: colabId,
              colaboradorNome: colabName,
              valorDiaria: valor
            });
          }
        });
      }
    });

    // Ordenar por data (mais antigas primeiro, para priorizar o pagamento)
    diariasPendentes.sort((a, b) => (a.dataServico || '').localeCompare(b.dataServico || ''));

    res.json(diariasPendentes);
  } catch (error) {
    console.error('Erro ao buscar diárias pendentes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/dashboard/saldos-contas', async (req, res) => {
  try {
    const NOTION_CONTAS_DB_ID = process.env.NOTION_CONTAS_DB_ID || '2bab6e48f954803bae65d962d2b529f5';
    const NOTION_ENTRADAS_DB_ID = process.env.NOTION_ENTRADAS_DB_ID;
    const NOTION_SAIDAS_DB_ID = process.env.NOTION_SAIDAS_DB_ID;

    // Função genérica para buscar todas as páginas de uma base do Notion (paginação)
    const queryAllNotion = async (dbId) => {
      const wanted = String(dbId || '').replace(/-/g, '').toLowerCase();
      const type = Object.keys(NOTION_DATABASES).find(key =>
        String(NOTION_DATABASES[key] || '').replace(/-/g, '').toLowerCase() === wanted
      );
      if (!type) return { results: [] };
      return { results: await notionMirror.getPages(type) };
    };

    // Buscar contas
    const contasData = await queryAllNotion(NOTION_CONTAS_DB_ID);
    const contas = (contasData.results || [])
      .map(item => {
        const p = item.properties;
        return {
          id: item.id,
          nome: p['Nome']?.title?.map(t => t.plain_text).join('') || 'Sem Nome',
          saldoBRL: 0,
          saldoJPY: 0,
          saldoUSD: 0,
          movimentacoes: []
        };
      })
      .filter(c => !c.nome.toLowerCase().includes('wise da mocreia') && !c.nome.toLowerCase().includes('wise da mocréia'));

    const NOTION_COLABORADORES_DB_ID = process.env.NOTION_COLABORADORES_DB_ID || '2a0b6e48f954816082afde2815056602';

    const [entradasData, saidasData, clientesPages, colaboradoresData, appConfig] = await Promise.all([
      queryAllNotion(NOTION_ENTRADAS_DB_ID),
      queryAllNotion(NOTION_SAIDAS_DB_ID),
      notionMirror.getPages('clientes'),
      queryAllNotion(NOTION_COLABORADORES_DB_ID),
      supabase.from('config').select('data').eq('id', 'app_config').single()
    ]);

    // Construir mapas de ID -> Nome usando somente o espelho leve do Supabase.
    const clientesMap = {};
    (clientesPages || []).forEach(item => {
      const p = item.properties || {};
      const nameProp = p['Nome do Cliente'] || p.Name || p.Nome;
      clientesMap[item.id] = nameProp?.title?.map(t => t.plain_text).join('') || 'Sem Nome';
    });

    const colaboradoresMap = {};
    (colaboradoresData.results || []).forEach(item => {
      const p = item.properties;
      const nameProp = p.Name || p.Nome;
      const nome = nameProp?.title?.[0]?.plain_text || 'Sem Nome';
      colaboradoresMap[item.id] = nome;
    });

    let rateBRL = 0.031670;
    let rateUSD = 0.006280;
    if (appConfig && appConfig.data) {
      rateBRL = parseFloat(appConfig.data.cambio_jpy_brl) || rateBRL;
      rateUSD = parseFloat(appConfig.data.cambio_jpy_usd) || rateUSD;
    }

    const rates = { brl: rateBRL, usd: rateUSD };

    const extrairInfoVal = (descricao, valorJPY, moedaOriginal) => {
      const match = descricao && descricao.match(/\[Original:\s*([BRL|USD|JPY$¥]+)\s*([\d.,\s]+)/i);
      if (match) {
        const coinText = match[1].toUpperCase();
        let parsedMoeda = 'JPY';
        if (coinText.includes('R$') || coinText.includes('BRL')) parsedMoeda = 'BRL';
        else if (coinText.includes('$') || coinText.includes('USD')) parsedMoeda = 'USD';

        let valStr = match[2].trim();
        if (parsedMoeda === 'BRL') {
          // BRL: milhar é ponto (remover), decimal é vírgula (virar ponto)
          valStr = valStr.replace(/[.\s]/g, '').replace(',', '.');
        } else {
          // JPY / USD: milhar é vírgula (remover), decimal é ponto (manter)
          valStr = valStr.replace(/[\,\s]/g, '');
        }

        const parsedVal = parseFloat(valStr);
        if (!isNaN(parsedVal)) {
          return { valor: parsedVal, moeda: parsedMoeda };
        }
      }

      if (moedaOriginal === 'BRL') return { valor: valorJPY * rates.brl, moeda: 'BRL' };
      if (moedaOriginal === 'USD') return { valor: valorJPY * rates.usd, moeda: 'USD' };
      return { valor: valorJPY, moeda: 'JPY' };
    };

    // Entradas
    (entradasData.results || []).forEach(item => {
      const p = item.properties;
      const valorJPY = p['Valor (JPY)']?.number || 0;
      const moedaOriginal = p['Moeda Original']?.select?.name || 'JPY';
      const descricao = p['Descrição da Entrada']?.title?.map(t => t.plain_text).join('') || 'Entrada sem nome';
      const data = p['Data do pagamento']?.date?.start || '';
      const contasRel = p['💳 Contas']?.relation || [];

      // Mapear Cliente
      const clienteRel = p['Cliente (Relação)']?.relation || [];
      const clienteId = clienteRel[0]?.id;
      const clienteNome = clienteId ? (clientesMap[clienteId] || 'Desconhecido') : '';

      const info = extrairInfoVal(descricao, valorJPY, moedaOriginal);

      contasRel.forEach(cRel => {
        const conta = contas.find(c => c.id === cRel.id);
        if (conta) {
          if (info.moeda === 'BRL') conta.saldoBRL += info.valor;
          else if (info.moeda === 'USD') conta.saldoUSD += info.valor;
          else conta.saldoJPY += info.valor;

          conta.movimentacoes.push({
            id: item.id,
            tipo: 'entrada',
            data,
            descricao,
            valorOriginal: info.valor,
            moedaOriginal: info.moeda,
            valorJPY,
            clienteNome,
            colaboradorNome: ''
          });
        }
      });
    });

    // Saídas
    (saidasData.results || []).forEach(item => {
      const p = item.properties;
      const valorJPY = p['Valor (JPY)']?.number || 0;
      const descricao = p['Descrição']?.title?.map(t => t.plain_text).join('') || 'Saída sem nome';
      const data = p['Data de pagamento']?.date?.start || '';
      const contasRel = p['💳 Contas']?.relation || [];

      // Mapear Cliente e Colaborador
      const clienteRel = p['🎀 Clientes']?.relation || [];
      const clienteId = clienteRel[0]?.id;
      const clienteNome = clienteId ? (clientesMap[clienteId] || 'Desconhecido') : '';

      const colabRel = p['🫂 Colaboradores']?.relation || [];
      const colabId = colabRel[0]?.id;
      const colaboradorNome = colabId ? (colaboradoresMap[colabId] || 'Desconhecido') : '';

      const info = extrairInfoVal(descricao, valorJPY, 'JPY');

      contasRel.forEach(cRel => {
        const conta = contas.find(c => c.id === cRel.id);
        if (conta) {
          if (info.moeda === 'BRL') conta.saldoBRL -= info.valor;
          else if (info.moeda === 'USD') conta.saldoUSD -= info.valor;
          else conta.saldoJPY -= info.valor;

          conta.movimentacoes.push({
            id: item.id,
            tipo: 'saida',
            data,
            descricao,
            valorOriginal: info.valor,
            moedaOriginal: info.moeda,
            valorJPY,
            clienteNome,
            colaboradorNome
          });
        }
      });
    });

    // Ordenar movimentações de cada conta por data descrescente
    contas.forEach(c => {
      c.movimentacoes.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    });

    res.json(contas);
  } catch (error) {
    console.error('Erro ao calcular saldos das contas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cache e funções auxiliares para URLs amigáveis de Clientes
let slugToIdCache = {};
let lastCacheUpdate = 0;
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 horas (o cache também é reconstruído sob demanda em caso de miss)

function gerarSlug(text) {
  if (!text) return '';
  return text.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .trim();
}

// ── Segurança da Área do Cliente ────────────────────────────────────────────
// O link público passa a exigir um token derivado do ID do cliente (HMAC),
// para que o nome do cliente sozinho não dê acesso a voos, hotel e valores.
const crypto = require('crypto');

function portalSecret() {
  return process.env.PORTAL_LINK_SECRET || process.env.APP_PASS || '';
}

function gerarTokenPortal(clientId) {
  const secret = portalSecret();
  if (!secret) return '';
  const norm = String(clientId || '').replace(/-/g, '').toLowerCase();
  return crypto.createHmac('sha256', secret).update(norm).digest('hex').slice(0, 12);
}

function tokenPortalValido(clientId, t) {
  const secret = portalSecret();
  if (!secret) return true; // sem secret configurado (ex.: dev local sem APP_PASS), não exige token
  if (!t) return false;
  const esperado = gerarTokenPortal(clientId);
  try {
    return crypto.timingSafeEqual(Buffer.from(String(t)), Buffer.from(esperado));
  } catch (e) {
    return false;
  }
}

// Permite que o painel admin (autenticado via Basic Auth) continue usando as APIs
// sem precisar do token do portal.
function requestAutenticadaAdmin(req) {
  if (!process.env.APP_PASS) return true;
  if (typeof sessaoValida === 'function' && sessaoValida(req)) return true;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(h.slice(6), 'base64').toString();
    const idx = decoded.indexOf(':');
    const u = decoded.slice(0, idx);
    const p = decoded.slice(idx + 1);
    return u === (process.env.APP_USER || 'admin') && p === process.env.APP_PASS;
  } catch (e) {
    return false;
  }
}

// Reconstrói o mapa slug → id consultando a base de Clientes do Notion
async function reconstruirCacheSlugs() {
  const NOTION_CLIENTS_DB_ID = process.env.NOTION_CLIENTS_DB_ID;
  if (!NOTION_CLIENTS_DB_ID) {
    throw new Error('Configuração do Notion incompleta no arquivo .env.');
  }
  let results = await notionMirror.getPages('clientes');
  const newCache = {};
  results.forEach(item => {
    const p = item.properties;
    const nomeProp = p['Nome do Cliente'] || p['Name'] || p['Nome'];
    const nome = nomeProp?.title?.map(t => t.plain_text).join('') || '';
    if (nome) {
      newCache[gerarSlug(nome)] = item.id;
    }
  });
  slugToIdCache = newCache;
  lastCacheUpdate = Date.now();
  return newCache;
}

// Resolver qualquer slug ou ID recebido para o Notion ID oficial e unico do cliente
async function resolverNotionIdReal(slugOuId) {
  if (!slugOuId) return slugOuId;
  const rawId = String(slugOuId).trim();
  
  if (slugToIdCache[rawId]) return slugToIdCache[rawId];

  const cleanHex = rawId.replace(/-/g, '');
  if (cleanHex.length === 32) return rawId;

  try {
    const cache = await reconstruirCacheSlugs();
    if (cache && cache[rawId]) return cache[rawId];
  } catch(e) {}

  return rawId;
}

// Rotina de auto-cura para preencher o nome de clientes locais que ficaram sem nome no Supabase
async function corrigirNomesClientesSemNome() {
  try {
    const { data: clients, error } = await supabase.from('clientes_locais').select('*');
    if (error) throw error;

    const semNome = (clients || []).filter(c => {
      const d = c.data || {};
      return !d.nome || d.nome.trim() === '';
    });

    if (semNome.length === 0) {
      console.log('[Self-Heal] Todos os clientes locais possuem nome.');
      return;
    }

    console.log(`[Self-Heal] Encontrados ${semNome.length} clientes sem nome cadastrado localmente no Supabase. Corrigindo...`);

    for (const c of semNome) {
      try {
        const clientPage = await notionMirror.getPage('clientes', c.id);
        if (!clientPage) {
          console.error(`[Self-Heal] Cliente ${c.id} não existe no espelho Supabase.`);
          continue;
        }
        const cp = clientPage.properties;
        const nomeProp = cp['Nome do Cliente'] || cp['Nome'];
        const nome = nomeProp?.title?.map(t => t.plain_text).join('') || '';
        
        if (nome) {
          const updatedData = { ...c.data, nome };
          const { error: updateErr } = await supabase.from('clientes_locais').update({ data: updatedData }).eq('id', c.id);
          if (updateErr) throw updateErr;
          console.log(`[Self-Heal] Nome do cliente ${c.id} corrigido para "${nome}"`);
        } else {
          console.warn(`[Self-Heal] Cliente ${c.id} não possui nome no Notion.`);
        }
      } catch (e) {
        console.error(`[Self-Heal] Erro ao corrigir cliente ${c.id}:`, e.message);
      }
    }
  } catch (err) {
    console.error('[Self-Heal] Erro na rotina de autocorreção de nomes:', err.message);
  }
}

// Calcula o total de uma cotacao com a MESMA formula do app (updateResumo):
// tours + transportes + experiencias + itens adicionais + consultoria.
function calcularTotalOrcamento(orc) {
  if (!orc) return 0;
  const num = (v) => parseFloat(v) || 0;
  const tourTot = (t) => { let b = num(t.valor); if (t.descontoAtivo && t.desconto > 0) b -= b * (num(t.desconto) / 100); return b; };
  const transpTot = (t) => {
    const a = num(t.adultos), c = num(t.criancas);
    const d = (t.descricao || '').toLowerCase();
    const isTransfer = d.includes('transfer') || d.includes('privado') || d.includes('privativo');
    let b = isTransfer ? num(t.preco) : num(t.preco) * a + num(t.precoInfantil) * c;
    const tp = a + c;
    if (t.taxaAtiva) b += t.taxaTipo === 'grupo' ? num(t.taxaValor || 3000) : num(t.taxaValor || 3000) * (tp > 0 ? tp : 1);
    return b;
  };
  const expTot = (e) => {
    let b = num(e.preco) * (e.precoTipo === 'grupo' ? 1 : (num(e.pessoas) || 1));
    if (e.taxaAtiva) b += e.taxaTipo === 'grupo' ? num(e.taxaValor || 3000) : num(e.taxaValor || 3000) * (num(e.pessoas) || 1);
    return b;
  };
  const tT = (orc.tours || []).reduce((s, t) => s + tourTot(t), 0);
  const tTr = (orc.transportes || []).filter(t => t.compradoHeian !== false).reduce((s, t) => s + transpTot(t), 0);
  const tEx = (orc.experiencias || []).filter(e => e.compradoHeian !== false).reduce((s, e) => s + expTot(e), 0);
  const tItens = (orc.itensAdicionais || []).reduce((s, i) => s + num(i.valor), 0);
  // consultoria pode vir como objeto {ativa, valor, descricao} (formato atual) ou número (legado)
  const cons = (orc.consultoria && typeof orc.consultoria === 'object')
    ? (orc.consultoria.ativa ? num(orc.consultoria.valor) : 0)
    : num(orc.consultoria);
  return Math.round(tT + tTr + tEx + tItens + cons);
}

function calcularToursOrcamento(orc) {
  if (!orc) return 0;
  const num = (v) => parseFloat(v) || 0;
  const tourTot = (t) => { let b = num(t.valor); if (t.descontoAtivo && t.desconto > 0) b -= b * (num(t.desconto) / 100); return b; };
  return Math.round((orc.tours || []).reduce((sum, t) => sum + tourTot(t), 0));
}
// ENTRADA (1º pagamento) = 30% dos tours + 100% de transportes + experiências + itens + consultoria = total - 70% dos tours.
function calcularSinalOrcamento(orc) {
  return Math.max(0, calcularTotalOrcamento(orc) - Math.round(0.70 * calcularToursOrcamento(orc)));
}

// Deriva o "Valor do Pacote" a partir de uma LISTA já carregada de cotações (array de r.data).
// Puro (sem I/O). Assim o endpoint de clientes lê a tabela UMA vez e deriva todos em memória,
// em vez de reler a tabela inteira por cliente (era o gargalo do "demora uma vida" no F5).
function derivarValorPacoteDeLista(clientId, clientNome, dataList) {
  try {
    const _norm = (v) => String(v || '').toLowerCase().trim().replace('família ', '').replace('familia ', '');
    const _cn = _norm(clientNome);
    let doCliente = (dataList || []).filter(o =>
      o && !o.deletado && (o.notionClienteId === clientId || (o.cliente && o.cliente.notionClienteId === clientId)));
    if (!doCliente.length && _cn) {
      doCliente = (dataList || []).filter(o => {
        if (!o || o.deletado) return false;
        const on = _norm(o.cliente?.nome);
        return on && (_cn === on || _cn.includes(on) || on.includes(_cn));
      });
    }
    if (!doCliente.length) return 0;
    // Prefere cotação COM conteúdo (itens ou consultoria) — evita que uma cotação VAZIA
    // (auto-criada ao salvar o roteiro) seja escolhida por ser a mais recente e zere o valor.
    const _temConteudo = (o) => ((o.tours||[]).length + (o.transportes||[]).length + (o.experiencias||[]).length + (o.itensAdicionais||[]).length) > 0 || (o.consultoria && o.consultoria.ativa);
    const _pool = doCliente.some(_temConteudo) ? doCliente.filter(_temConteudo) : doCliente;
    _pool.sort((a, b) => new Date(b.atualizadoEm || b.criadoEm || 0) - new Date(a.atualizadoEm || a.criadoEm || 0));
    return calcularTotalOrcamento(_pool[0]);
  } catch (e) {
    console.error('Erro ao derivar Valor do Pacote (lista):', e.message);
    return 0;
  }
}
// Deriva a ENTRADA (1º pagamento) do cliente da mesma lista de cotações (mesma seleção do valor).
function derivarSinalDeLista(clientId, clientNome, dataList) {
  try {
    const _norm = (v) => String(v || '').toLowerCase().trim().replace('família ', '').replace('familia ', '');
    const _cn = _norm(clientNome);
    let doCliente = (dataList || []).filter(o =>
      o && !o.deletado && (o.notionClienteId === clientId || (o.cliente && o.cliente.notionClienteId === clientId)));
    if (!doCliente.length && _cn) {
      doCliente = (dataList || []).filter(o => {
        if (!o || o.deletado) return false;
        const on = _norm(o.cliente?.nome);
        return on && (_cn === on || _cn.includes(on) || on.includes(_cn));
      });
    }
    if (!doCliente.length) return 0;
    const _temConteudo = (o) => ((o.tours||[]).length + (o.transportes||[]).length + (o.experiencias||[]).length + (o.itensAdicionais||[]).length) > 0 || (o.consultoria && o.consultoria.ativa);
    const _pool = doCliente.some(_temConteudo) ? doCliente.filter(_temConteudo) : doCliente;
    _pool.sort((a, b) => new Date(b.atualizadoEm || b.criadoEm || 0) - new Date(a.atualizadoEm || a.criadoEm || 0));
    return calcularSinalOrcamento(_pool[0]);
  } catch (e) { console.error('Erro ao derivar Sinal (lista):', e.message); return 0; }
}
// Versão que lê o banco (mantida p/ os demais callers). Lê a tabela e delega ao helper puro.
async function valorPacoteDaCotacao(clientId, clientNome) {
  try {
    const { data: orcRows } = await supabase.from('orcamentos').select('data');
    return derivarValorPacoteDeLista(clientId, clientNome, (orcRows || []).map(r => r.data));
  } catch (e) {
    console.error('Erro ao derivar Valor do Pacote da cotacao:', e.message);
    return 0;
  }
}

async function getClientDataHelper(clientId) {
  const NOTION_CLIENTS_DB_ID = process.env.NOTION_CLIENTS_DB_ID;
  const NOTION_ENTRADAS_DB_ID = process.env.NOTION_ENTRADAS_DB_ID;

  if (!NOTION_CLIENTS_DB_ID || !NOTION_ENTRADAS_DB_ID) {
    throw new Error('Configuração do Notion incompleta no arquivo .env.');
  }

  let clientInfo = null;

  // As fontes abaixo sao independentes entre si. Dispara todas de uma vez para
  // que o portal nao some a latencia do Notion com cada leitura do Supabase.
  const entradasPromise = notionMirror.getPages('entradas').then(pages => {
    const clientIdNorm = String(clientId).replace(/-/g, '').toLowerCase();
    const results = pages.filter(item =>
      Object.values(item.properties || {}).some(prop =>
        Array.isArray(prop?.relation) &&
        prop.relation.some(rel => String(rel.id).replace(/-/g, '').toLowerCase() === clientIdNorm)
      )
    );
    return { ok: true, json: async () => ({ results }) };
  }).catch(err => {
    console.error('Erro ao buscar entradas no espelho Supabase:', err.message);
    return null;
  });
  const orcamentosPromise = Promise.resolve(supabase.from('orcamentos').select('data')).catch(err => {
    console.error('Erro ao buscar orcamentos (getClientDataHelper):', err.message);
    return { data: [] };
  });
  const roteirosPromise = Promise.resolve(supabase.from('roteiros').select('nome,data')).catch(err => {
    console.error('Erro ao buscar roteiros (getClientDataHelper):', err.message);
    return { data: [] };
  });
  const realIdPromise = resolverNotionIdReal(clientId);
  const localDataPromise = realIdPromise.then(realId =>
    supabase.from('clientes_locais').select('data').eq('id', realId).maybeSingle()
  ).catch(err => {
    console.error('Erro ao buscar cliente local (getClientDataHelper):', err.message);
    return { data: null };
  });
  const hoteisPromise = Promise.resolve(
    supabase.from('config').select('data').eq('id', 'hoteis').single()
  ).catch(err => {
    console.error('Erro ao buscar hoteis no Supabase:', err.message);
    return { data: null };
  });
  const transportesPromise = Promise.resolve(
    supabase.from('config').select('data').eq('id', 'transportes').single()
  ).catch(err => {
    console.error('Erro ao buscar transportes no Supabase (getClientDataHelper):', err.message);
    return { data: null };
  });

  // 1. Tentar buscar dados do cliente no Notion
  try {
    const clientPage = await notionMirror.getPage('clientes', clientId);
    if (clientPage) {
      const p = clientPage.properties;

      const getTitle = (prop) => prop?.title?.map(t => t.plain_text).join('') || '';
      const getRichText = (prop) => prop?.rich_text?.map(t => t.plain_text).join('') || '';
      const getNumber = (prop) => prop?.number || 0;
      const getSelect = (prop) => prop?.select?.name || '';
      const getDateStart = (prop) => prop?.date?.start || '';
      const getDateEnd = (prop) => prop?.date?.end || '';
      const getFormulaNumber = (prop) => prop?.formula?.number || 0;
      const getFormulaString = (prop) => prop?.formula?.string || '';
      const getRollupNumber = (prop) => prop?.rollup?.number || 0;

      clientInfo = {
        id: clientPage.id,
        nome: getTitle(p['Nome do Cliente'] || p['Name'] || p['Nome']),
        status: getSelect(p['Status do Cliente'] || p['Status']),
        adultos: getNumber(p['Qtd Adultos']),
        criancas: getNumber(p['Qtd Crianças']),
        vooChegada: getRichText(p['Voo de Chegada']),
        vooPartida: getRichText(p['Voo de Partida']),
        dataInicio: getDateStart(p['Período da Viagem']),
        dataFim: getDateEnd(p['Período da Viagem']),
        hotel: getRichText(p['Hotel']),
        viajantes: getRichText(p['Nome dos Viajantes'] || p['Viajantes']),
        email: (p['Email']?.email || '').trim(),
        briefing: getRichText(p['Briefing'] || p['Preferências'] || p['Observações'] || p['Descrição']),
        valorTotal: getNumber(p['Valor Total']),
        totalPago: getRollupNumber(p['Total Pago']),
        saldoPagar: getFormulaNumber(p['Saldo a Pagar']),
        statusPagamento: getFormulaString(p['Status de pagamento'])
      };
    }
  } catch (err) {
    console.error('Erro ao buscar cliente no Notion (getClientDataHelper):', err.message);
  }

  // Fallback para o banco local se o Notion falhar ou não encontrar o cliente
  if (!clientInfo) {
    try {
      const { data: localClientRow } = await localDataPromise;
      if (localClientRow && localClientRow.data) {
        const lc = localClientRow.data;
        clientInfo = {
          id: lc.id,
          nome: lc.nome || lc.clienteNome || 'Cliente Local',
          status: lc.status || 'Roteiro em Edição',
          adultos: Number(lc.adultos) || 2,
          criancas: Number(lc.criancas) || 0,
          vooChegada: lc.vooChegada || '',
          vooPartida: lc.vooPartida || '',
          dataInicio: lc.dataInicio || '',
          dataFim: lc.dataFim || '',
          hotel: lc.hotel || '',
          viajantes: lc.viajantes || '',
          briefing: lc.briefing || '',
          valorTotal: Number(lc.valorTotal) || 0,
          totalPago: Number(lc.totalPago) || 0,
          saldoPagar: Number(lc.saldoPagar) || 0,
          statusPagamento: lc.statusPagamento || 'Pendente'
        };
      }
    } catch (localErr) {
      console.error('Erro ao buscar cliente local no Supabase (getClientDataHelper):', localErr.message);
    }
  }

  if (!clientInfo) {
    throw new Error('Cliente não encontrado no Notion ou no banco de dados local.');
  }

  const { data: orcamentos } = await orcamentosPromise;

  // "Valor do Pacote": o "Valor Total" manual (Notion) PREVALECE; se estiver vazio,
  // deriva automaticamente da cotacao vinculada mais recente do cliente.
  if (!clientInfo.valorTotal || Number(clientInfo.valorTotal) <= 0) {
    const derivado = derivarValorPacoteDeLista(
      clientId,
      clientInfo.nome,
      (orcamentos || []).map(row => row.data)
    );
    if (derivado > 0) clientInfo.valorTotal = derivado;
  }

  // 2. Buscar Entradas (pagamentos confirmados) do cliente no Notion
  const entradasRes = await entradasPromise;

  let payments = [];
  if (entradasRes && entradasRes.ok) {
    const entradasData = await entradasRes.json();
    payments = (entradasData.results || []).map(item => {
      const ep = item.properties;
      const descRaw = ep['Descrição da Entrada']?.title?.map(t => t.plain_text).join('') || 'Entrada';
      const valorJPY = ep['Valor (JPY)']?.number || 0;
      const moedaOrig = ep['Moeda Original']?.select?.name || 'JPY';
      // Extrai o valor ORIGINAL (na moeda paga) e o câmbio aplicado do texto
      // "[Original: R$ 5.965,20 | Câmbio JPY/BRL: 0.038000]" — assim o extrato mostra o R$ real
      let valorOriginal = valorJPY;
      let cambio = 0;
      let descricaoLimpa = descRaw;
      const mOrig = descRaw.match(/\s*\[Original:\s*(?:R\$|\$|¥)\s*([\d.,]+)(?:\s*JPY)?(?:\s*\|\s*Câmbio\s+JPY\/(?:BRL|USD):\s*([\d.]+))?\]/i);
      if (mOrig) {
        const rate = parseFloat(mOrig[2]) || 0;
        cambio = rate;
        const amtStr = mOrig[1];
        let amt = NaN;
        if (moedaOrig === 'BRL') amt = parseFloat(amtStr.replace(/\./g, '').replace(',', '.'));
        else amt = parseFloat(amtStr.replace(/,/g, ''));
        if (isFinite(amt) && amt > 0) valorOriginal = amt;
        else if (rate > 0) valorOriginal = valorJPY * rate;
        descricaoLimpa = descRaw.replace(mOrig[0], '').trim();
      }
      return {
        id: item.id,
        descricao: descricaoLimpa,
        valor: valorJPY,
        valorOriginal,
        cambio,
        data: ep['Data do pagamento']?.date?.start || '',
        moeda: moedaOrig
      };
    }).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  }

  // Saldo/Total Pago consistentes com o Valor do Pacote resolvido e as entradas reais.
  // (A fórmula "Saldo a Pagar" do Notion usa o campo MANUAL "Valor Total"; quando o total
  //  vem da cotação, esse campo fica vazio → Notion devolvia saldo NEGATIVO = − total pago.)
  {
    const totalPagoReal = payments.reduce((s, p) => s + (Number(p.valor) || 0), 0);
    clientInfo.totalPago = totalPagoReal;
    clientInfo.saldoPagar = Math.round((Number(clientInfo.valorTotal) || 0) - totalPagoReal);
  }

  // 3. Buscar cotação local (orcamento) no Supabase
  let quote = null;
  if (orcamentos && orcamentos.length > 0) {
    // Escolhe a MESMA cotação que alimenta o Valor do Pacote: vínculo por notionClienteId,
    // não-deletada e a MAIS RECENTE. (Antes usava .find() = primeira que casasse, podendo
    // pegar uma cotação antiga — ex.: sem a consultoria — divergindo do valor mostrado.)
    const _norm = (v) => String(v || '').toLowerCase().trim().replace('família ', '').replace('familia ', '');
    const _clientNome = _norm(clientInfo.nome);
    const _porRecencia = (a2, b2) => new Date(b2.data.atualizadoEm || b2.data.criadoEm || 0) - new Date(a2.data.atualizadoEm || a2.data.criadoEm || 0);
    let _cands = orcamentos.filter(o => o.data && !o.data.deletado && (o.data.notionClienteId === clientId || o.data.cliente?.notionClienteId === clientId));
    if (!_cands.length) {
      _cands = orcamentos.filter(o => {
        if (!o.data || o.data.deletado) return false;
        const on = _norm(o.data.cliente?.nome);
        return _clientNome && on && (_clientNome === on || _clientNome.includes(on) || on.includes(_clientNome));
      });
    }
    // Prefere a cotação COM conteúdo (evita a vazia auto-criada zerar a aba Serviços), depois a recente.
    const _temConteudo2 = (o2) => { const d = o2.data || {}; return ((d.tours||[]).length + (d.transportes||[]).length + (d.experiencias||[]).length + (d.itensAdicionais||[]).length) > 0 || (d.consultoria && d.consultoria.ativa); };
    const _pool2 = _cands.some(_temConteudo2) ? _cands.filter(_temConteudo2) : _cands;
    _pool2.sort(_porRecencia);
    const matched = _pool2[0];
    if (matched && matched.data) {
      const o = matched.data;
      const sanitizeTours = (tours) => (tours || []).map(t => ({
        id: t.id,
        data: t.data,
        valor: Number(t.valor) || 0,
        descontoAtivo: !!t.descontoAtivo,
        desconto: Number(t.desconto) || 0,
        duracao: t.duracao || '',
        descricao: t.descricao || '',
        pontos: t.pontos || '',
        observacao: t.observacao || ''
      }));
      const sanitizeTransportes = (trans) => (trans || []).map(t => ({
        id: t.id,
        data: t.data,
        descricao: t.descricao || '',
        preco: Number(t.preco) || 0,
        precoInfantil: Number(t.precoInfantil) || 0,
        adultos: Number(t.adultos) || 0,
        criancas: Number(t.criancas) || 0,
        taxaAtiva: !!t.taxaAtiva,
        taxaTipo: t.taxaTipo || 'pessoa',
        taxaValor: Number(t.taxaValor) || 0,
        compradoHeian: t.compradoHeian !== false,
        observacao: t.observacao || '',
        _roteiroRefId: t._roteiroRefId || ''
      }));
      const sanitizeExperiencias = (exps) => (exps || []).map(e => ({
        id: e.id,
        data: e.data,
        nome: e.nome || '',
        pessoas: Number(e.pessoas) || 1,
        preco: Number(e.preco) || 0,
        precoTipo: e.precoTipo || 'pessoa',
        taxaAtiva: !!e.taxaAtiva,
        taxaTipo: e.taxaTipo || 'pessoa',
        taxaValor: Number(e.taxaValor) || 0,
        compradoHeian: e.compradoHeian !== false,
        observacao: e.observacao || '',
        descricao: e.descricao || '',
        _roteiroRefId: e._roteiroRefId || ''
      }));
      const sanitizeItens = (items) => (items || []).map(i => ({
        data: i.data,
        nome: i.nome,
        valor: Number(i.valor) || 0
      }));

      quote = {
        tours: sanitizeTours(o.tours),
        transportes: sanitizeTransportes(o.transportes),
        experiencias: sanitizeExperiencias(o.experiencias),
        itensAdicionais: sanitizeItens(o.itensAdicionais),
        consultoria: {
          ativa: o.consultoria?.ativa || false,
          valor: Number(o.consultoria?.valor) || 0,
          descricao: o.consultoria?.descricao || ''
        }
      };
    }
  }

  // 4. Buscar roteiro local no Supabase
  const { data: roteiros } = await roteirosPromise;
  let itinerary = null;
  if (roteiros && roteiros.length > 0) {
    const _normRot = (v) => String(v || '').toLowerCase().trim().replace('família ', '').replace('familia ', '');
    const _clientNomeRot = _normRot(clientInfo.nome);
    const _porRecenciaRot = (a2, b2) => new Date(b2.data.atualizadoEm || b2.data.criadoEm || 0) - new Date(a2.data.atualizadoEm || a2.data.criadoEm || 0);

    let _candsRot = roteiros.filter(r => r.data && !r.data.deletado && (r.data.notionClienteId === clientId || r.data.cliente?.notionClienteId === clientId));
    if (!_candsRot.length && _clientNomeRot) {
      _candsRot = roteiros.filter(r => {
        if (!r.data || r.data.deletado) return false;
        const rotClientName = _normRot(r.data.cliente?.nome);
        if (rotClientName && (_clientNomeRot === rotClientName || _clientNomeRot.includes(rotClientName) || rotClientName.includes(_clientNomeRot))) {
          return true;
        }
        const nomeExibicao = r.data.nome || (String(r.nome).startsWith('rot_') ? '' : r.nome);
        if (nomeExibicao) {
          const rotNameClean = _normRot(nomeExibicao.replace('roteiro - ', '').replace('roteiro ', ''));
          if (_clientNomeRot === rotNameClean || _clientNomeRot.includes(rotNameClean) || rotNameClean.includes(_clientNomeRot)) {
            return true;
          }
        }
        return false;
      });
    }
    const _temDias = (r2) => Array.isArray(r2.data?.dias) && r2.data.dias.length > 0;
    const _poolRot = _candsRot.some(_temDias) ? _candsRot.filter(_temDias) : _candsRot;
    _poolRot.sort(_porRecenciaRot);
    const matched = _poolRot[0];
    if (matched && matched.data) {
      const r = matched.data;
      const sanitizedDays = (r.dias || []).map(d => {
        const sanitizedElements = (d.elementos || []).map(el => {
          const { valorCusto, comissao, ...cleanEl } = el;
          return cleanEl;
        });
        return {
          data: d.data,
          cidade: d.cidade,
          tourGuiado: d.tourGuiado,
          elementos: sanitizedElements
        };
      });
      itinerary = {
        nome: r.nome,
        dias: sanitizedDays
      };
    }
  }

  // 5. Buscar Ficha Local (Supabase clientes_locais)
  const realId = await realIdPromise;
  let { data: localData } = await localDataPromise;
  const clientLocalInfo = localData && localData.data ? localData.data : { estadias: [], viajantes: [] };

  // 6. Buscar lista de Hotéis ricos cadastrados no Supabase
  let hoteis = [];
  try {
    const { data: cfgHoteis } = await hoteisPromise;
    if (cfgHoteis && cfgHoteis.data) {
      hoteis = cfgHoteis.data;
    }
  } catch (e) {
    console.error('Erro ao buscar hotéis no Supabase:', e.message);
  }

  // 7. Buscar lista de Transportes ricos cadastrados no Supabase
  let transportes = [];
  try {
    const { data: cfgTransp } = await transportesPromise;
    if (cfgTransp && cfgTransp.data) {
      transportes = cfgTransp.data;
    }
  } catch (e) {
    console.error('Erro ao buscar transportes no Supabase:', e.message);
  }

  return {
    clientInfo,
    payments,
    quote,
    itinerary,
    clientLocalInfo,
    hoteis,
    transportes
  };
}

// ═════════════════════════════════════════════════════════════════════════
// CAIXA DE ENTRADA / CHAT (Heian ↔ Cliente)
// - Tabela Supabase: chat_mensagens (ver RELATORIO §23 para o SQL)
// - Anexos: salvos FORA do webroot (não são apagados pelo deploy nem servidos
//   publicamente); download só por rota autenticada (token do portal ou admin)
// - Sem multer: upload em JSON base64 (limite já configurado no express.json)
// ═════════════════════════════════════════════════════════════════════════
const PASTA_CHAT_PREFERIDA = path.join(__dirname, '..', 'heian_chat_uploads');
const PASTA_CHAT_RESERVA = path.join(__dirname, 'chat_uploads_privado');
let PASTA_CHAT = PASTA_CHAT_PREFERIDA;
try {
  fs.mkdirSync(PASTA_CHAT_PREFERIDA, { recursive: true });
} catch (e) {
  try {
    fs.mkdirSync(PASTA_CHAT_RESERVA, { recursive: true });
    PASTA_CHAT = PASTA_CHAT_RESERVA;
    console.warn('[Chat] Sem permissão fora do webroot; usando pasta reserva:', PASTA_CHAT);
  } catch (e2) {
    console.error('[Chat] Não foi possível criar pasta de anexos:', e2.message);
  }
}

// Anexos do chat: armazenamento DURAVEL no Supabase Storage (sobrevive a reinicio/deploy)
const CHAT_BUCKET = 'chat-anexos';
(async function ensureChatBucket() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const existe = (buckets || []).some(b => b.name === CHAT_BUCKET);
    if (!existe) {
      const { error } = await supabase.storage.createBucket(CHAT_BUCKET, { public: false });
      if (error) console.warn('[Chat] Nao criei o bucket de anexos:', error.message);
      else console.log('[Chat] Bucket de anexos criado:', CHAT_BUCKET);
    }
  } catch (e) { console.warn('[Chat] Storage indisponivel ao checar bucket:', e.message); }
})();

function chatIdNorm(clienteId) {
  return String(clienteId || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 40);
}

// Quem está falando? 'empresa' (sessão/Basic), 'cliente' (token do portal) ou null
function chatQuemE(req, clienteId) {
  const t = req.query.t || (req.body && req.body.t);
  if (t && tokenPortalValido(clienteId, t)) return 'cliente';
  if (requestAutenticadaAdmin(req)) return 'empresa';
  return null;
}

// Lista de mensagens
app.get('/api/chat/:clienteId', async (req, res) => {
  try {
    const { clienteId } = req.params;
    const quem = chatQuemE(req, clienteId);
    if (!quem) return res.status(403).json({ success: false, error: 'Acesso negado.' });
    const { data, error } = await supabase.from('chat_mensagens')
      .select('*').eq('cliente_id', String(clienteId))
      .order('criado_em', { ascending: true }).limit(300);
    if (error) throw error;
    res.json({ success: true, quem, mensagens: data || [] });
  } catch (e) {
    console.error('[Chat] Erro ao listar:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Nova mensagem (texto e/ou anexos já enviados via /anexo)
app.post('/api/chat/:clienteId/mensagem', async (req, res) => {
  try {
    const { clienteId } = req.params;
    const quem = chatQuemE(req, clienteId);
    if (!quem) return res.status(403).json({ success: false, error: 'Acesso negado.' });
    
    // Se o admin autenticado estiver enviando a mensagem e declarar remetente='cliente'
    // no body, nós permitimos (para simulação/teste da área do cliente pelo admin).
    let remetente = quem;
    if (quem === 'empresa' && req.body.remetente === 'cliente') {
      remetente = 'cliente';
    }

    const mensagem = (req.body.mensagem || '').toString().slice(0, 4000).trim();
    const anexos = Array.isArray(req.body.anexos) ? req.body.anexos.slice(0, 10).map(a => ({
      id: String(a.id || ''), nome: String(a.nome || 'arquivo').slice(0, 120),
      tipo: String(a.tipo || ''), tamanho: Number(a.tamanho) || 0
    })) : [];
    if (!mensagem && anexos.length === 0) {
      return res.status(400).json({ success: false, error: 'Mensagem vazia.' });
    }
    const { data, error } = await supabase.from('chat_mensagens').insert({
      cliente_id: String(clienteId), remetente,
      mensagem: mensagem || null, anexos, lido: false
    }).select().single();
    if (error) throw error;

    // E-mail: Heian->cliente quando a empresa envia; cliente->admin quando o cliente escreve (respeitando a soneca)
    if (process.env.GMAIL_USER) {
      if (quem === 'empresa') {
        notificarClienteChat(clienteId, mensagem, anexos).catch(err =>
          console.error('[Chat] Falha na notificação por e-mail (cliente):', err.message));
      } else if (quem === 'cliente') {
        getChatConfig().then(cfg => {
          const pausado = cfg.pausadoAte && new Date(cfg.pausadoAte).getTime() > Date.now();
          if (!pausado) {
            notificarAdminChat(clienteId, mensagem, cfg.email).catch(err =>
              console.error('[Chat] Falha na notificação por e-mail (admin):', err.message));
          }
        }).catch(() => {});
      }
    }
    res.json({ success: true, mensagem: data });
  } catch (e) {
    console.error('[Chat] Erro ao enviar:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Upload de anexo (JSON base64) → devolve o id do arquivo
app.post('/api/chat/:clienteId/anexo', async (req, res) => {
  try {
    const { clienteId } = req.params;
    const quem = chatQuemE(req, clienteId);
    if (!quem) return res.status(403).json({ success: false, error: 'Acesso negado.' });
    const { nome, conteudoBase64 } = req.body || {};
    if (!nome || !conteudoBase64) return res.status(400).json({ success: false, error: 'Arquivo ausente.' });
    const mimeMatch = String(conteudoBase64).match(/^data:([^;]+);base64,/);
    const contentType = (mimeMatch && mimeMatch[1]) || 'application/octet-stream';
    const buf = Buffer.from(String(conteudoBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (buf.length === 0) return res.status(400).json({ success: false, error: 'Arquivo vazio.' });
    if (buf.length > 15 * 1024 * 1024) return res.status(413).json({ success: false, error: 'Arquivo acima de 15 MB.' });

    const nomeSeguro = String(nome).replace(/[^a-zA-Z0-9À-ÿ._ -]/g, '').replace(/\s+/g, '_').slice(0, 80) || 'arquivo';
    const idArquivo = chatIdNorm(clienteId) + '_' + require('crypto').randomBytes(10).toString('hex') + '_' + nomeSeguro;
    // Grava no Supabase Storage (duravel). Se falhar, cai pro disco local (melhor que perder).
    const { error: upErr } = await supabase.storage.from(CHAT_BUCKET).upload(idArquivo, buf, { contentType: contentType, upsert: true });
    if (upErr) {
      console.error('[Chat] Falha no upload pro Storage, tentando disco local:', upErr.message);
      fs.writeFileSync(path.join(PASTA_CHAT, idArquivo), buf);
    }
    res.json({ success: true, id: idArquivo, nome: nomeSeguro, tamanho: buf.length });
  } catch (e) {
    console.error('[Chat] Erro no upload:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Download autenticado de anexo (o prefixo do arquivo amarra ao cliente)
app.get('/api/chat/:clienteId/anexo/:idArquivo', async (req, res) => {
  const { clienteId, idArquivo } = req.params;
  const quem = chatQuemE(req, clienteId);
  if (!quem) return res.status(403).send('Acesso negado.');
  const seguro = String(idArquivo).replace(/[^a-zA-Z0-9À-ÿ._-]/g, '');
  if (!seguro || !seguro.startsWith(chatIdNorm(clienteId) + '_')) {
    return res.status(403).send('Arquivo não pertence a este cliente.');
  }
  const nomeOriginal = seguro.split('_').slice(2).join('_') || 'arquivo';
  // 1) Supabase Storage (duravel)
  try {
    const { data, error } = await supabase.storage.from(CHAT_BUCKET).download(seguro);
    if (!error && data) {
      const ab = await data.arrayBuffer();
      res.setHeader('Content-Disposition', `attachment; filename="${nomeOriginal}"`);
      return res.send(Buffer.from(ab));
    }
  } catch (e) { /* cai no fallback local */ }
  // 2) Fallback: disco local (anexos antigos que ainda existam)
  const caminho = path.join(PASTA_CHAT, seguro);
  if (fs.existsSync(caminho)) {
    res.setHeader('Content-Disposition', `attachment; filename="${nomeOriginal}"`);
    return res.sendFile(caminho);
  }
  return res.status(404).send('Arquivo não encontrado.');
});

// Marca como lidas as mensagens ENVIADAS PELO OUTRO lado
app.post('/api/chat/:clienteId/ler', async (req, res) => {
  try {
    const { clienteId } = req.params;
    const quem = chatQuemE(req, clienteId);
    if (!quem) return res.status(403).json({ success: false, error: 'Acesso negado.' });
    const outro = quem === 'empresa' ? 'cliente' : 'empresa';
    const { error } = await supabase.from('chat_mensagens')
      .update({ lido: true })
      .eq('cliente_id', String(clienteId)).eq('remetente', outro).eq('lido', false);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Apagar mensagem (admin) — qualquer mensagem daquele cliente
app.delete('/api/chat/:clienteId/mensagem/:id', async (req, res) => {
  try {
    const { clienteId, id } = req.params;
    if (chatQuemE(req, clienteId) !== 'empresa') return res.status(403).json({ success: false, error: 'Apenas o admin.' });
    const { error } = await supabase.from('chat_mensagens').delete().eq('id', id).eq('cliente_id', String(clienteId));
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Editar mensagem (admin) — só mensagens enviadas pela Heian (remetente=empresa)
app.patch('/api/chat/:clienteId/mensagem/:id', async (req, res) => {
  try {
    const { clienteId, id } = req.params;
    if (chatQuemE(req, clienteId) !== 'empresa') return res.status(403).json({ success: false, error: 'Apenas o admin.' });
    const novo = (req.body.mensagem || '').toString().slice(0, 4000).trim();
    if (!novo) return res.status(400).json({ success: false, error: 'Mensagem vazia.' });
    const { error } = await supabase.from('chat_mensagens')
      .update({ mensagem: novo })
      .eq('id', id).eq('cliente_id', String(clienteId)).eq('remetente', 'empresa');
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Resumo para o admin: não lidas por cliente (badge da Central de Mensagens)
app.get('/api/chat-resumo', async (req, res) => {
  try {
    const { data, error } = await supabase.from('chat_mensagens')
      .select('cliente_id, remetente, lido, criado_em, mensagem')
      .order('criado_em', { ascending: false }).limit(500);
    if (error) throw error;
    const porCliente = {};
    (data || []).forEach(m => {
      if (!porCliente[m.cliente_id]) {
        porCliente[m.cliente_id] = { ultima: m.mensagem || '(anexo)', em: m.criado_em, naoLidas: 0 };
      }
      if (m.remetente === 'cliente' && !m.lido) porCliente[m.cliente_id].naoLidas++;
    });
    res.json({ success: true, conversas: porCliente });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// E-mail de aviso ao cliente (usa o transporter existente)
// Config do chat (soneca do alerta + destinatario) — guardado em config/chat_config
async function getChatConfig() {
  try {
    const { data } = await supabase.from('config').select('data').eq('id', 'chat_config').single();
    return (data && data.data) || {};
  } catch (e) { return {}; }
}

// E-mail de aviso ao ADMIN quando o cliente escreve
async function notificarAdminChat(clienteId, mensagem, emailDestino) {
  const to = (emailDestino || process.env.GMAIL_USER || '').trim();
  if (!to) return;
  let nome = 'um cliente';
  try { const dados = await getClientDataHelper(clienteId); if (dados && dados.clientInfo && dados.clientInfo.nome) nome = dados.clientInfo.nome; } catch (e) {}
  await transporter.sendMail({
    from: `Heian Tour <${process.env.GMAIL_USER}>`,
    to,
    subject: `Nova mensagem de ${nome} — Heian Tour`,
    html: `<div style="font-family:Georgia,serif;color:#2C1A1D;max-width:520px;margin:auto">
      <h2 style="color:#6B1F2A">Nova mensagem no chat</h2>
      <p><b>${nome}</b> enviou:</p>
      <p style="background:#F8F3EB;border-left:3px solid #C4A35A;padding:12px 16px">${(mensagem || '(anexo)').replace(/</g, '&lt;')}</p>
      <p><a href="https://www.heiantour.com/admin" style="background:#6B1F2A;color:#fff;padding:12px 22px;border-radius:99px;text-decoration:none">Abrir a Central de Mensagens</a></p>
    </div>`
  });
}

async function notificarClienteChat(clienteId, mensagem, anexos) {
  const dados = await getClientDataHelper(clienteId).catch(() => null);
  const email = dados?.clientInfo?.email || dados?.clientLocalInfo?.email;
  if (!email) return;
  const token = gerarTokenPortal(clienteId);
  const link = `https://www.heiantour.com/cliente/${clientId_ou_slug(dados, clienteId)}${token ? '?t=' + token : ''}`;
  await transporter.sendMail({
    from: `Heian Tour <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Você tem uma nova mensagem da Heian Tour',
    html: `<div style="font-family:Georgia,serif;color:#2C1A1D;max-width:520px;margin:auto">
      <h2 style="color:#6B1F2A">Nova mensagem da Heian Tour</h2>
      <p style="background:#F8F3EB;border-left:3px solid #C4A35A;padding:12px 16px">${(mensagem || 'Você recebeu um novo documento.').replace(/</g, '&lt;')}</p>
      ${anexos && anexos.length ? `<p>${anexos.length} anexo(s) disponível(is) no seu portal.</p>` : ''}
      <p><a href="${link}" style="background:#6B1F2A;color:#fff;padding:12px 22px;border-radius:99px;text-decoration:none">Abrir meu portal</a></p>
    </div>`
  });
}

function clientId_ou_slug(dados, clienteId) {
  const nome = dados?.clientInfo?.nome;
  return nome ? gerarSlug(nome) : clienteId;
}

function arquivosDoVoucher(voucher) {
  if (Array.isArray(voucher?.arquivos) && voucher.arquivos.length > 0) {
    return voucher.arquivos;
  }
  if (voucher?.url) {
    return [{
      id: 'legacy',
      url: voucher.url,
      fileName: voucher.fileName || voucher.nome || 'voucher'
    }];
  }
  return [];
}

function urlPublicaArquivoVoucher(clientId, voucherIndex, fileIndex, dataUrl, portalToken) {
  const versao = require('crypto')
    .createHash('sha256')
    .update(String(dataUrl))
    .digest('hex')
    .slice(0, 16);
  const query = new URLSearchParams({ v: versao });
  if (portalToken) query.set('t', String(portalToken));
  return `/api/public/client-voucher-file/${encodeURIComponent(clientId)}/${voucherIndex}/${fileIndex}?${query.toString()}`;
}

// O banco continua aceitando o formato legado em Base64, mas a resposta publica
// nunca carrega esses megabytes dentro do JSON inicial. O arquivo e entregue por
// uma rota protegida somente quando o navegador realmente precisar exibi-lo.
function prepararDadosPortalLeves(data, clientId, portalToken) {
  const local = data?.clientLocalInfo || {};
  const vouchers = Array.isArray(local.vouchers) ? local.vouchers : [];
  const vouchersLeves = vouchers.map((voucher, voucherIndex) => {
    const arquivos = arquivosDoVoucher(voucher).map((arquivo, fileIndex) => {
      const urlOriginal = String(arquivo?.url || '');
      const url = urlOriginal.startsWith('data:')
        ? urlPublicaArquivoVoucher(clientId, voucherIndex, fileIndex, urlOriginal, portalToken)
        : urlOriginal;
      return { ...arquivo, url };
    });
    return {
      ...voucher,
      arquivos,
      url: voucher?.tipo === 'link'
        ? voucher.url
        : (arquivos[0]?.url || (String(voucher?.url || '').startsWith('data:') ? '' : voucher?.url || ''))
    };
  });

  return {
    ...data,
    clientLocalInfo: {
      ...local,
      vouchers: vouchersLeves
    }
  };
}

app.get('/cliente/:slug', (req, res) => {
  res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'cliente.html'));
});

app.get('/api/public/client-voucher-file/:clientId/:voucherIndex/:fileIndex', async (req, res) => {
  try {
    const clientId = await resolverNotionIdReal(req.params.clientId);
    if (!requestAutenticadaAdmin(req) && !tokenPortalValido(clientId, req.query.t)) {
      return res.status(403).send('Acesso negado.');
    }

    const { data: localRow, error } = await supabase
      .from('clientes_locais')
      .select('data')
      .eq('id', clientId)
      .maybeSingle();
    if (error) throw error;
    const local = localRow?.data || {};
    if (local.portalAtivo === false) return res.status(403).send('Portal encerrado.');

    const voucherIndex = Number.parseInt(req.params.voucherIndex, 10);
    const fileIndex = Number.parseInt(req.params.fileIndex, 10);
    const voucher = Array.isArray(local.vouchers) ? local.vouchers[voucherIndex] : null;
    const arquivo = voucher ? arquivosDoVoucher(voucher)[fileIndex] : null;
    const dataUrl = String(arquivo?.url || '');
    const match = dataUrl.match(/^data:([^;,]+)?(?:;[^,]*)?;base64,([\s\S]+)$/);
    if (!match) return res.status(404).send('Arquivo nao encontrado.');

    const tiposPermitidos = new Set([
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'application/pdf', 'application/octet-stream'
    ]);
    const tipoOriginal = String(match[1] || 'application/octet-stream').toLowerCase();
    const contentType = tiposPermitidos.has(tipoOriginal) ? tipoOriginal : 'application/octet-stream';
    const conteudo = Buffer.from(match[2], 'base64');
    if (!conteudo.length) return res.status(404).send('Arquivo vazio.');

    const etag = `"${require('crypto').createHash('sha256').update(conteudo).digest('hex')}"`;
    if (req.headers['if-none-match'] === etag) return res.status(304).end();

    const nome = String(arquivo.fileName || voucher.fileName || voucher.nome || 'voucher')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${nome || 'voucher'}"`);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.setHeader('ETag', etag);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(conteudo);
  } catch (error) {
    console.error('Erro ao entregar arquivo de voucher:', error);
    return res.status(500).send('Erro ao carregar arquivo.');
  }
});

app.get('/api/public/client-data/:clientId', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const { clientId } = req.params;
    if (!requestAutenticadaAdmin(req) && !tokenPortalValido(clientId, req.query.t)) {
      return res.status(403).json({ success: false, error: 'Link inválido ou expirado. Solicite um novo link à Heian Tour.' });
    }

    const data = await getClientDataHelper(clientId);
    if (data?.clientLocalInfo?.portalAtivo === false) {
      return res.status(403).json({
        success: false,
        portalDesativado: true,
        error: 'O acesso a este portal de viagem foi encerrado. Caso necessite de algo, entre em contato com a Heian Tour.'
      });
    }

    const realClientId = await resolverNotionIdReal(clientId);
    const dadosLeves = prepararDadosPortalLeves(data, realClientId, req.query.t);
    res.json({
      success: true,
      portalAtivo: true,
      ...dadosLeves
    });
  } catch (error) {
    console.error('Erro na API pública da Área do Cliente:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar dados do cliente', details: error.message });
  }
});

app.post('/api/public/client-data/:clientId/estadia', express.json(), async (req, res) => {
  try {
    const { clientId } = req.params;
    const { cidade, hotelNome, dataInicio, dataFim, noites, reservaObs } = req.body;

    if (!requestAutenticadaAdmin(req) && !tokenPortalValido(clientId, req.query.t)) {
      return res.status(403).json({ success: false, error: 'Link inválido ou expirado. Solicite um novo link à Heian Tour.' });
    }

    if (!cidade || !hotelNome) {
      return res.status(400).json({ success: false, error: 'Cidade e Nome do Hotel são obrigatórios.' });
    }

    const realClientId = await resolverNotionIdReal(clientId);

    const { data: row, error: erroLeitura } = await supabase.from('clientes_locais').select('data').eq('id', realClientId).maybeSingle();
    if (erroLeitura) throw erroLeitura;
    const dados = (row && row.data) ? row.data : { id: realClientId };
    dados.estadias = normalizarEstadias(dados.estadias);

    const dIniFmt = normalizarDataEstadiaISO(dataInicio);
    const dFimFmt = normalizarDataEstadiaISO(dataFim);

    const jaTemEstadia = (lista, e) => Array.isArray(lista) && lista.some(x =>
      (x.hotel || '').trim().toLowerCase() === (e.hotel || '').trim().toLowerCase() &&
      (x.dataInicio || '') === (e.dataInicio || '') &&
      (x.dataFim || '') === (e.dataFim || '')
    );

    const novaEstadia = {
      id: 'estadia_' + Date.now(),
      cidade: cidade.trim(),
      hotel: hotelNome.trim(),
      dataInicio: dIniFmt,
      dataFim: dFimFmt,
      noites: parseInt(noites) || 0,
      observacoes: reservaObs || 'Adicionado pelo cliente via Portal',
      origem: 'cliente'
    };

    if (!jaTemEstadia(dados.estadias, novaEstadia)) dados.estadias.push(novaEstadia);

    const salvo = await salvarClienteLocalCanonico(realClientId, { estadias: dados.estadias });
    dados.estadias = salvo.dados.estadias;

    let novoHotelCadastrado = false;
    try {
      const { data: rowHoteis } = await supabase.from('config').select('data').eq('id', 'hoteis').maybeSingle();
      const listaHoteis = (rowHoteis && Array.isArray(rowHoteis.data)) ? rowHoteis.data : [];
      
      const nomeNorm = hotelNome.toLowerCase().trim();
      const cidadeNorm = cidade.toLowerCase().trim();
      const jaExiste = listaHoteis.some(h => {
        const hN = (h['Nome do Hotel'] || '').toLowerCase().trim();
        const hC = (h['Cidade'] || '').toLowerCase().trim();
        const nomeCasa = hN === nomeNorm || (hN && nomeNorm && (hN.includes(nomeNorm) || nomeNorm.includes(hN)));
        return hC === cidadeNorm && nomeCasa;
      });

      if (!jaExiste) {
        const novoHotelItem = {
          id: 'hotel_auto_' + Date.now(),
          'Nome do Hotel': hotelNome.trim(),
          'Cidade': cidade.trim(),
          'Descrição': 'Hotel adicionado pelo cliente no Portal. Pendente de revisão de fotos e descrição.',
          'Foto (URL)': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=600',
          'Comodidades': 'Pendente de revisão',
          'Link do Google Maps': `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotelNome.trim() + ', ' + cidade.trim() + ', Japan')}`,
          origem: 'cliente-portal',
          pendenteRevisao: true
        };
        listaHoteis.push(novoHotelItem);
        await supabase.from('config').upsert({ id: 'hoteis', data: listaHoteis, updated_at: new Date().toISOString() });
        novoHotelCadastrado = true;
      }
    } catch (eHoteis) {
      console.warn('Aviso ao sincronizar novo hotel para base interna:', eHoteis);
    }

    res.json({
      success: true,
      estadias: dados.estadias,
      novaEstadia,
      novoHotelCadastrado
    });
  } catch (err) {
    console.error('Erro em POST /api/public/client-data/:clientId/estadia:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/public/client-data/:clientId/estadia/:estadiaId', async (req, res) => {
  res.status(405).json({
    success: false,
    error: 'Alterações e exclusões de hospedagem são feitas somente pelo Admin em Editar Cliente.'
  });
});

async function sincronizarHoteisNoNotion(notionPageId, estadias) {
  if (!notionPageId) throw new Error('ID do cliente ausente ao sincronizar hotéis no Notion.');
  if (!NOTION_TOKEN) throw new Error('Integração com o Notion não está configurada.');

  const realId = await resolverNotionIdReal(notionPageId);
  const textoHoteis = formatarEstadiasParaNotion(estadias);
  const response = await fetch(`https://api.notion.com/v1/pages/${realId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        Hotel: {
          rich_text: textoHoteis ? [{ type: 'text', text: { content: textoHoteis } }] : []
        }
      }
    })
  });

  if (!response.ok) {
    const detalhe = await response.json().catch(() => ({}));
    throw new Error(`Notion recusou a sincronização de hotéis: ${detalhe.message || response.status}`);
  }

  const paginaAtualizada = await response.json();
  await notionMirror.upsertPage('clientes', paginaAtualizada);
  console.log(`[Notion Sync] Campo 'Hotel' atualizado para o cliente ${realId}.`);
  return textoHoteis;
}

// Endpoint autenticado (admin) com os mesmos dados — usado pelo montador de roteiros,
// que antes dependia da rota pública.
app.get('/api/clientes/:id/dados', async (req, res) => {
  try {
    const data = await getClientDataHelper(req.params.id);
    res.json({ success: true, ...data });
  } catch (error) {
    console.error('Erro na API interna de dados do cliente:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar dados do cliente', details: error.message });
  }
});

// Endpoint autenticado (admin): gera o link do portal do cliente com token
app.get('/api/clientes/:id/portal-link', async (req, res) => {
  try {
    const clientId = req.params.id;
    const token = gerarTokenPortal(clientId);
    let slug = '';
    // Tenta descobrir o slug pelo cache (reconstrói se necessário)
    const idNorm = String(clientId).replace(/-/g, '').toLowerCase();
    const achar = () => Object.keys(slugToIdCache).find(s => String(slugToIdCache[s]).replace(/-/g, '').toLowerCase() === idNorm);
    slug = achar();
    if (!slug) {
      try { await reconstruirCacheSlugs(); slug = achar(); } catch (e) { /* segue com fallback */ }
    }
    const pathPart = slug ? `/cliente/${slug}` : `/cliente/${clientId}`;
    const url = `${req.protocol}://${req.get('host')}${pathPart}${token ? `?t=${token}` : ''}`;
    res.json({ success: true, url, token, slug: slug || null });
  } catch (error) {
    console.error('Erro ao gerar link do portal:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/public/client-data/slug/:slug', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const { slug } = req.params;
    const now = Date.now();

    let clientId = slugToIdCache[slug];

    if (!clientId || (now - lastCacheUpdate) > CACHE_TTL) {
      try {
        await reconstruirCacheSlugs();
      } catch (e) {
        return res.status(400).json({ success: false, error: e.message });
      }
      clientId = slugToIdCache[slug];
    }

    if (!clientId) {
      // Se não for encontrado na tabela de slugs, tenta carregar diretamente como ID (uuid)
      if (!requestAutenticadaAdmin(req) && !tokenPortalValido(slug, req.query.t)) {
        return res.status(403).json({ success: false, error: 'Link inválido ou expirado. Solicite um novo link à Heian Tour.' });
      }
      try {
        const data = await getClientDataHelper(slug);
        if (data?.clientLocalInfo?.portalAtivo === false) {
          return res.status(403).json({
            success: false,
            portalDesativado: true,
            error: 'O acesso a este portal de viagem foi encerrado. Caso necessite de algo, entre em contato com a Heian Tour.'
          });
        }
        if (data && data.clientInfo) {
          const realClientId = await resolverNotionIdReal(slug);
          const dadosLeves = prepararDadosPortalLeves(data, realClientId, req.query.t);
          return res.json({
            success: true,
            portalAtivo: true,
            ...dadosLeves
          });
        }
      } catch (err) {
        // Fallback falhou, segue para o 404
      }
      return res.status(404).json({ success: false, error: 'Cliente não encontrado com o slug fornecido.' });
    }

    if (!requestAutenticadaAdmin(req) && !tokenPortalValido(clientId, req.query.t)) {
      return res.status(403).json({ success: false, error: 'Link inválido ou expirado. Solicite um novo link à Heian Tour.' });
    }

    const data = await getClientDataHelper(clientId);
    if (data?.clientLocalInfo?.portalAtivo === false) {
      return res.status(403).json({
        success: false,
        portalDesativado: true,
        error: 'O acesso a este portal de viagem foi encerrado. Caso necessite de algo, entre em contato com a Heian Tour.'
      });
    }

    const dadosLeves = prepararDadosPortalLeves(data, clientId, req.query.t);
    res.json({
      success: true,
      portalAtivo: true,
      ...dadosLeves
    });
  } catch (error) {
    console.error('Erro na API pública da Área do Cliente por slug:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar dados do cliente por slug', details: error.message });
  }
});

// FASE 2 — Excluir cliente (cascata, tudo REVERSÍVEL via lixeira). Arquiva no Notion o cliente
// e seus lançamentos (Entradas/Saídas/Tasks) e faz soft-delete do roteiro/cotação no app.
app.delete('/api/notion/cliente/:id', async (req, res) => {
  try {
    const clienteId = req.params.id;
    if (!clienteId) return res.status(400).json({ success: false, error: 'clienteId ausente' });
    if (!NOTION_TOKEN) return res.status(400).json({ success: false, error: 'Notion não configurado' });
    const NOTION_ENTRADAS_DB_ID = process.env.NOTION_ENTRADAS_DB_ID;
    const NOTION_SAIDAS_DB_ID = process.env.NOTION_SAIDAS_DB_ID;
    const NOTION_TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;
    const headers = { 'Authorization': `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };

    const queryRel = async (dbId, prop) => {
      if (!dbId) return [];
      try {
        const wantedDb = String(dbId).replace(/-/g, '').toLowerCase();
        const type = Object.keys(NOTION_DATABASES).find(key =>
          String(NOTION_DATABASES[key] || '').replace(/-/g, '').toLowerCase() === wantedDb
        );
        if (!type) return [];
        const wantedClient = String(clienteId).replace(/-/g, '').toLowerCase();
        const pages = await notionMirror.getPages(type);
        return pages.filter(item =>
          Object.values(item.properties || {}).some(property =>
            Array.isArray(property?.relation) &&
            property.relation.some(rel => String(rel.id).replace(/-/g, '').toLowerCase() === wantedClient)
          )
        ).map(item => item.id);
      } catch (e) { console.error('queryRel', dbId, e.message); return []; }
    };
    const arquivar = async (pageId) => {
      try {
        const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
          method: 'PATCH', headers, body: JSON.stringify({ archived: true })
        });
        return r.ok;
      } catch (e) { console.error('arquivar', pageId, e.message); return false; }
    };

    const [entradas, saidas, tasks] = await Promise.all([
      queryRel(NOTION_ENTRADAS_DB_ID, 'Cliente (Relação)'),
      queryRel(NOTION_SAIDAS_DB_ID, '🎀 Clientes'),
      queryRel(NOTION_TASKS_DB_ID, '🎀 Clientes')
    ]);

    const arquivados = { entradas: 0, saidas: 0, tasks: 0 };
    for (const id of entradas) {
      if (await arquivar(id)) {
        arquivados.entradas++;
        await notionMirror.removePage('entradas', id);
      }
    }
    for (const id of saidas) {
      if (await arquivar(id)) {
        arquivados.saidas++;
        await notionMirror.removePage('saidas', id);
      }
    }
    for (const id of tasks) {
      if (await arquivar(id)) {
        arquivados.tasks++;
        await notionMirror.removePage('tasks', id);
      }
    }
    const clienteArquivado = await arquivar(clienteId);
    if (clienteArquivado) await notionMirror.removePage('clientes', clienteId);

    // Soft-delete roteiros + cotações vinculados no app (Supabase)
    let roteirosDeletados = 0, cotacoesDeletadas = 0;
    try {
      const { data: rotRows } = await supabase.from('roteiros').select('nome, data');
      for (const r of (rotRows || [])) {
        const d = r.data; if (!d || d.deletado) continue;
        if (d.notionClienteId === clienteId || (d.cliente && d.cliente.notionClienteId === clienteId)) {
          d.deletado = true; d.deletadoEm = new Date().toISOString();
          await supabase.from('roteiros').upsert({ nome: r.nome, data: d }, { onConflict: 'nome' });
          roteirosDeletados++;
        }
      }
    } catch (e) { console.error('soft-delete roteiros (excluir cliente):', e.message); }
    try {
      const { data: orcRows } = await supabase.from('orcamentos').select('id, data');
      for (const o of (orcRows || [])) {
        const d = o.data; if (!d || d.deletado) continue;
        if (d.notionClienteId === clienteId || (d.cliente && d.cliente.notionClienteId === clienteId)) {
          d.deletado = true; d.deletadoEm = new Date().toISOString();
          await supabase.from('orcamentos').upsert({ id: String(o.id), data: d });
          cotacoesDeletadas++;
        }
      }
    } catch (e) { console.error('soft-delete orcamentos (excluir cliente):', e.message); }

    // Soft-delete da FICHA LOCAL (clientes_locais). Sem isso a ficha/estadias fica órfã
    // sob o ID do cliente apagado e a busca por nome volta a pescá-la (bug da Lipka de teste).
    let fichaLocalDeletada = false;
    try {
      const { data: fRow } = await supabase.from('clientes_locais').select('data').eq('id', String(clienteId)).maybeSingle();
      if (fRow && fRow.data) {
        const fd = fRow.data; fd.deletado = true; fd.deletadoEm = new Date().toISOString();
        await supabase.from('clientes_locais').upsert({ id: String(clienteId), data: fd });
        fichaLocalDeletada = true;
      }
    } catch (e) { console.error('soft-delete ficha local (excluir cliente):', e.message); }

    res.json({ success: true, clienteArquivado, arquivados, roteirosDeletados, cotacoesDeletadas, fichaLocalDeletada });
  } catch (e) {
    console.error('excluir cliente:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── FAXINA de fichas locais órfãs (clientes_locais sem cliente correspondente no Notion) ──
// Órfã = linha em clientes_locais cujo ID não existe (mais) na base de Clientes do Notion.
// Acontece quando um cliente é apagado DIRETO no Notion (o app não recebe webhook).
// Compara sempre por ID normalizado (sem hífens) pra evitar falso-positivo de formato.
async function _listarClientesNotion() {
  // { ok, ids:Set<idNorm>, porNome:Map<nomeNorm,{id,nome}> }. Pagina TUDO.
  // Se qualquer página falhar, ok=false — NUNCA tratar "não li o Notion" como "0 clientes".
  if (!NOTION_CLIENTS_DB_ID) return { ok: false, ids: new Set(), porNome: new Map() };
  const ids = new Set(); const porNome = new Map(); const lista = []; let cursor;
  const nomeDe = (page) => {
    const p = page.properties || {};
    const prop = p['Nome do Cliente'] || p['Name'] || p['Nome'];
    return (prop?.title?.map(t => t.plain_text).join('') || '').trim();
  };
  try {
      const pages = await notionMirror.getPages('clientes');
      for (const page of pages) {
        ids.add(String(page.id).replace(/-/g, ''));
        const nomeOrig = nomeDe(page);
        const nn = nomeOrig.toLowerCase();
        if (nomeOrig) lista.push({ id: page.id, nome: nomeOrig });
        if (nn && !porNome.has(nn)) porNome.set(nn, { id: page.id, nome: nn });
      }
    lista.sort((a, b) => a.nome.localeCompare(b.nome));
    return { ok: true, ids, porNome, lista };
  } catch (e) {
    console.error('[GC] listar clientes Notion:', e.message);
    return { ok: false, ids: new Set(), porNome: new Map(), lista: [] };
  }
}

// Classifica cada ficha cujo ID NÃO bate com cliente vivo:
//  - "desalinhada": existe cliente vivo com o MESMO nome → é o mesmo cliente com ID trocado → RE-VINCULAR (não apagar)
//  - "orfa": nem ID nem nome batem com cliente vivo → sobra segura de apagar
function _classificarFichas(localRows, notion) {
  const orfas = [], desalinhadas = [];
  for (const r of (localRows || [])) {
    if (notion.ids.has(String(r.id).replace(/-/g, ''))) continue; // ID bate com cliente vivo → ficha OK
    const d = r.data || {};
    if (d.deletado) continue; // já tratada (re-vinculada/excluída) → sai da faxina
    const nomeNorm = (d.nome || d.clienteNome || '').toLowerCase().trim();
    const base = { id: r.id, nome: (d.nome || d.clienteNome || '(sem nome)'), estadias: Array.isArray(d.estadias) ? d.estadias.length : 0, jaDeletado: !!d.deletado };
    const vivo = nomeNorm ? notion.porNome.get(nomeNorm) : null;
    if (vivo) desalinhadas.push({ ...base, alvoId: vivo.id, alvoNome: vivo.nome });
    else orfas.push(base);
  }
  return { orfas, desalinhadas };
}

// PREVIEW (read-only) — separa órfãs de verdade x fichas desalinhadas
app.get('/api/manutencao/fichas-orfas', async (req, res) => {
  try {
    const notion = await _listarClientesNotion();
    if (!notion.ok) return res.status(502).json({ success: false, error: 'Não consegui ler a lista de clientes do Notion — abortando por segurança (pra não marcar cliente vivo como órfão).' });
    const { data: localRows } = await supabase.from('clientes_locais').select('id, data');
    const { orfas, desalinhadas } = _classificarFichas(localRows, notion);
    res.json({ success: true, totalNotion: notion.ids.size, totalLocais: (localRows || []).length, orfas, desalinhadas, clientesVivos: notion.lista });
  } catch (e) {
    console.error('[GC] preview:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// LIMPAR — só órfãs de verdade. Recusa qualquer ficha cujo nome bata com cliente vivo (desalinhada).
app.post('/api/manutencao/fichas-orfas/limpar', express.json(), async (req, res) => {
  try {
    const idsPedidos = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    const hard = req.body?.hard === true;
    if (!idsPedidos.length) return res.status(400).json({ success: false, error: 'Nenhum ID informado.' });

    const notion = await _listarClientesNotion();
    if (!notion.ok) return res.status(502).json({ success: false, error: 'Não consegui revalidar contra o Notion — abortando.' });

    const resultado = { softDeletadas: 0, apagadas: 0, ignoradas: [] };
    for (const id of idsPedidos) {
      if (notion.ids.has(String(id).replace(/-/g, ''))) { resultado.ignoradas.push({ id, motivo: 'ID é de cliente vivo' }); continue; }
      const { data: row } = await supabase.from('clientes_locais').select('data').eq('id', String(id)).maybeSingle();
      const d = (row && row.data) ? row.data : { id };
      const nomeNorm = (d.nome || d.clienteNome || '').toLowerCase().trim();
      // TRAVA: nome bate com cliente vivo → é desalinhada, NÃO apaga (evita destruir dado real)
      if (nomeNorm && notion.porNome.has(nomeNorm)) { resultado.ignoradas.push({ id, motivo: 'nome bate com cliente vivo — use Re-vincular' }); continue; }
      if (hard) {
        await supabase.from('clientes_locais').delete().eq('id', String(id));
        resultado.apagadas++;
      } else {
        d.deletado = true; d.deletadoEm = new Date().toISOString(); d.deletadoMotivo = 'órfã (cliente inexistente no Notion)';
        await supabase.from('clientes_locais').upsert({ id: String(id), data: d });
        resultado.softDeletadas++;
      }
    }
    res.json({ success: true, ...resultado });
  } catch (e) {
    console.error('[GC] limpar:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// RE-VINCULAR — funde a ficha desalinhada (fromId) na ficha do cliente vivo (toId) e some com a origem (soft).
app.post('/api/manutencao/fichas-orfas/revincular', express.json(), async (req, res) => {
  try {
    const fromId = String(req.body?.fromId || ''); const toId = String(req.body?.toId || '');
    if (!fromId || !toId) return res.status(400).json({ success: false, error: 'fromId e toId são obrigatórios.' });

    const notion = await _listarClientesNotion();
    if (!notion.ok) return res.status(502).json({ success: false, error: 'Não consegui validar contra o Notion — abortando.' });
    if (!notion.ids.has(toId.replace(/-/g, ''))) return res.status(400).json({ success: false, error: 'toId não é um cliente vivo no Notion.' });
    if (notion.ids.has(fromId.replace(/-/g, ''))) return res.status(400).json({ success: false, error: 'fromId é um cliente vivo — não é ficha desalinhada.' });

    const { data: fromRow } = await supabase.from('clientes_locais').select('data').eq('id', fromId).maybeSingle();
    if (!fromRow || !fromRow.data) return res.status(404).json({ success: false, error: 'Ficha de origem não encontrada.' });
    const fromD = fromRow.data;
    const { data: toRow } = await supabase.from('clientes_locais').select('data').eq('id', toId).maybeSingle();
    const toD = (toRow && toRow.data) ? toRow.data : { id: toId };

    // Merge de estadias com dedup (hotel+datas)
    if (!Array.isArray(toD.estadias)) toD.estadias = [];
    const chave = (e) => `${(e.hotel || '').trim().toLowerCase()}|${e.dataInicio || ''}|${e.dataFim || ''}`;
    const existentes = new Set(toD.estadias.map(chave));
    let estadiasMovidas = 0;
    for (const e of (Array.isArray(fromD.estadias) ? fromD.estadias : [])) {
      if (!existentes.has(chave(e))) { toD.estadias.push(e); existentes.add(chave(e)); estadiasMovidas++; }
    }
    // Preenche só os buracos do destino (não sobrescreve o que já existe lá)
    for (const campo of ['vouchers', 'marcos', 'preferencias', 'fotoPerfil', 'viajantes', 'emails']) {
      if ((toD[campo] == null || (Array.isArray(toD[campo]) && !toD[campo].length)) && fromD[campo] != null) toD[campo] = fromD[campo];
    }
    toD.id = toId;
    await supabase.from('clientes_locais').upsert({ id: toId, data: toD });

    // Origem vira soft-deleted (reversível)
    fromD.deletado = true; fromD.deletadoEm = new Date().toISOString(); fromD.deletadoMotivo = `re-vinculada ao cliente ${toId}`;
    await supabase.from('clientes_locais').upsert({ id: fromId, data: fromD });

    res.json({ success: true, estadiasMovidas, totalEstadiasDestino: toD.estadias.length });
  } catch (e) {
    console.error('[GC] revincular:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Página simples de faxina (protegida como rota admin)
app.get('/manutencao', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public', 'manutencao.html'));
});

app.get('/api/dashboard/notion-data/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const NOTION_TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID;
    const NOTION_SAIDAS_DB_ID = process.env.NOTION_SAIDAS_DB_ID;
    const NOTION_ENTRADAS_DB_ID = process.env.NOTION_ENTRADAS_DB_ID;

    if (!NOTION_TASKS_DB_ID || !NOTION_SAIDAS_DB_ID || !NOTION_ENTRADAS_DB_ID) {
      return res.status(400).json({ error: 'Configuração do Notion incompleta no arquivo .env.' });
    }

    const queryNotionDB = async (dbId, filterProp) => {
      const wantedDb = String(dbId || '').replace(/-/g, '').toLowerCase();
      const type = Object.keys(NOTION_DATABASES).find(key =>
        String(NOTION_DATABASES[key] || '').replace(/-/g, '').toLowerCase() === wantedDb
      );
      const wantedClient = String(clientId).replace(/-/g, '').toLowerCase();
      const pages = type ? await notionMirror.getPages(type) : [];
      const results = pages.filter(item =>
        Object.values(item.properties || {}).some(prop =>
          Array.isArray(prop?.relation) &&
          prop.relation.some(rel => String(rel.id).replace(/-/g, '').toLowerCase() === wantedClient)
        )
      );
      return { results };
    };

    const [entradasData, saidasData, tasksData, calCfg] = await Promise.all([
      queryNotionDB(NOTION_ENTRADAS_DB_ID, 'Cliente (Relação)'),
      queryNotionDB(NOTION_SAIDAS_DB_ID, '🎀 Clientes'),
      queryNotionDB(NOTION_TASKS_DB_ID, '🎀 Clientes'),
      supabase.from('config').select('data').eq('id', 'calendario_eventos').single()
    ]);

    // Parse de Entradas
    let totalRecebido = 0;
    const entradas = (entradasData.results || []).map(item => {
      const p = item.properties;
      const valor = p['Valor (JPY)']?.number || 0;
      totalRecebido += valor;
      return {
        id: item.id,
        descricao: p['Descrição da Entrada']?.title?.map(t => t.plain_text).join('') || 'Entrada sem nome',
        valor,
        data: p['Data do pagamento']?.date?.start || '',
        tipo: p['Tipo de pagamento']?.select?.name || ''
      };
    });

    // Parse de Saídas
    let totalDespesas = 0;
    const saidas = (saidasData.results || []).map(item => {
      const p = item.properties;
      const valor = p['Valor (JPY)']?.number || 0;
      totalDespesas += valor;
      return {
        id: item.id,
        descricao: p['Descrição']?.title?.map(t => t.plain_text).join('') || 'Saída sem nome',
        valor,
        data: p['Data de pagamento']?.date?.start || '',
        categoria: p['Categoria']?.select?.name || '',
        tipoServico: p['Tipo de serviço']?.select?.name || ''
      };
    });

    // Parse de Tasks
    let totalLucroProjetado = 0;
    let totalTaxas = 0;
    const tasks = (tasksData.results || []).map(item => {
      const p = item.properties;
      const lucro = p['Lucro']?.formula?.number || 0;
      const taxa = p['Taxa serviço']?.number || 0;
      totalLucroProjetado += lucro;
      totalTaxas += taxa;
      return {
        id: item.id,
        nome: p['Task name']?.title?.map(t => t.plain_text).join('') || 'Task sem nome',
        status: p['Status']?.status?.name || '',
        lucro,
        taxa,
        totalCliente: p['Total Cliente']?.formula?.number || 0,
        dataServico: p['Data do Serviço']?.date?.start || ''
      };
    });

    // Processar Diárias dos Guias do Calendário Local
    let eventos = [];
    if (calCfg && calCfg.data) {
      const listaEventos = Array.isArray(calCfg.data.data) ? calCfg.data.data : (Array.isArray(calCfg.data) ? calCfg.data : []);
      eventos = listaEventos.filter(ev => ev.clienteId === clientId || (ev.clientes && ev.clientes.includes(clientId)));
    }

    let custoGuiasPago = 0;
    let custoGuiasPendente = 0;
    const guias = [];

    eventos.forEach(ev => {
      if (ev.assignee && ev.assignee.length > 0) {
        ev.assignee.forEach(colab => {
          const valor = ev.valorDiariaColab && ev.valorDiariaColab[colab.id] !== undefined
            ? Number(ev.valorDiariaColab[colab.id]) || 0
            : 0;
          const pago = ev.pagoColab && ev.pagoColab[colab.id] !== undefined
            ? !!ev.pagoColab[colab.id]
            : false;

          // Regra: Apenas listamos se for do tipo 'Roteiro' (Tour Guiado) OU se for qualquer outro tipo de serviço com diária > 0.
          // Isso oculta itens como Shinkansen/Universal Studios com diária zerada.
          const isRoteiro = ev.tipoServico && ev.tipoServico.toLowerCase() === 'roteiro';
          if (!isRoteiro && valor <= 0) {
            return;
          }

          if (pago) {
            custoGuiasPago += valor;
          } else {
            custoGuiasPendente += valor;
          }

          guias.push({
            id: ev.id,
            dataServico: ev.dataServico,
            titulo: ev.titulo,
            colabId: colab.id,
            colabName: colab.name,
            valor,
            pago
          });
        });
      }
    });

    // Resolve clientInfo e valorTotal da cotação
    let clientInfo = null;
    try {
      const clientPage = await notionMirror.getPage('clientes', clientId);
      if (clientPage) {
        const p = clientPage.properties;
        const getTitle = (prop) => prop?.title?.map(t => t.plain_text).join('') || '';
        const getNumber = (prop) => prop?.number || 0;
        const getRollupNumber = (prop) => prop?.rollup?.number || 0;
        const getFormulaNumber = (prop) => prop?.formula?.number || 0;
        const getFormulaString = (prop) => prop?.formula?.string || prop?.select?.name || '';
        clientInfo = {
          id: clientPage.id,
          nome: getTitle(p['Nome da Família'] || p['Nome']),
          valorTotal: getNumber(p['Valor Total']),
          totalPago: getRollupNumber(p['Total Pago']),
          saldoPagar: getFormulaNumber(p['Saldo a Pagar']),
          statusPagamento: getFormulaString(p['Status de pagamento'])
        };
      }
    } catch (e) {}

    let resolvedValorTotal = clientInfo ? (clientInfo.valorTotal || 0) : 0;
    if (resolvedValorTotal <= 0) {
      resolvedValorTotal = await valorPacoteDaCotacao(clientId, clientInfo ? clientInfo.nome : '');
      if (resolvedValorTotal > 0 && clientId) {
        syncNotionClienteValorTotal(clientId, resolvedValorTotal);
      }
    }

    const realSaldo = Math.max(0, Math.round(resolvedValorTotal - totalRecebido));
    const statusPgto = realSaldo <= 0 ? 'Pago' : (totalRecebido > 0 ? 'Parcial' : 'Pendente');

    res.json({
      success: true,
      summary: {
        totalRecebido,
        totalDespesas,
        lucroReal: totalRecebido - totalDespesas - custoGuiasPago,
        totalTaxas,
        totalLucroProjetado,
        custoGuiasPago,
        custoGuiasPendente,
        custoGuiasTotal: custoGuiasPago + custoGuiasPendente,
        caixaAtual: totalRecebido - totalDespesas - custoGuiasPago
      },
      clientInfo: {
        id: clientId,
        nome: clientInfo ? clientInfo.nome : 'Cliente',
        valorTotal: resolvedValorTotal,
        totalPago: totalRecebido,
        saldoPagar: realSaldo,
        statusPagamento: statusPgto
      },
      details: {
        entradas,
        saidas,
        tasks,
        guias
      }
    });

  } catch (error) {
    console.error('Erro na API de consolidação do Dashboard do Notion:', error);
    res.status(500).json({ error: 'Erro ao consolidar dados do Notion', details: error.message });
  }
});


// ── Inicia servidor ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║       HEIAN TOUR — Gerador de Orçamentos     ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Acesse: http://localhost:${PORT}              ║`);
  console.log('║  Para fechar: Ctrl + C                   ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Permite testes locais do servidor sem abrir navegador nem disparar jobs.
  if (process.env.HEIAN_TEST_MODE === '1') return;

  // Supabase é a fonte de leitura. O Notion é atualizado em segundo plano e também
  // pode avisar mudanças imediatamente pelo webhook.
  const mirrorPollMs = Math.max(
    60 * 1000,
    Number(process.env.NOTION_MIRROR_POLL_MS) || 5 * 60 * 1000
  );
  const atualizarEspelhoNotion = () => notionMirror.refreshAll()
    .then(result => console.log('[Notion Mirror] Espelho Supabase atualizado:', result))
    .then(() => reconstruirCacheSlugs())
    .catch(error => console.error('[Notion Mirror] Falha na atualização:', error.message));
  setTimeout(atualizarEspelhoNotion, 750);
  setInterval(atualizarEspelhoNotion, mirrorPollMs);

  // Abre automaticamente no browser (Windows e Mac)
  const { exec } = require('child_process');
  const url = `http://localhost:${PORT}`;
  const cmd = process.platform === 'darwin' ? `open ${url}` : `start ${url}`;
  exec(cmd);

  // Backup diário automático da Base no Google Sheets
  agendarBackupDiarioSheets();
  setTimeout(() => processarFilaSheets().catch(e => console.error('[Sheets Outbox] Falha:', e.message)), 5000);
  setInterval(() => processarFilaSheets().catch(e => console.error('[Sheets Outbox] Falha:', e.message)), 5 * 60 * 1000);

  // Inicializa o agendador de lembretes e notificações de e-mails
  console.log('[Email Init] Inicializando agendador de notificações automáticas por e-mail...');
  setTimeout(() => {
    processarNotificacoesEmail().catch(err => console.error('[Email Init] Erro na varredura inicial de e-mails:', err));
  }, 5000);

  // Executa a cada 10 minutos (10 * 60 * 1000 ms)
  setInterval(() => {
    processarNotificacoesEmail().catch(err => console.error('[Email Job] Erro no job recorrente de e-mails:', err));
  }, 10 * 60 * 1000);

  // Aquecimento do cache slug → id da Área do Cliente (evita ~10s de espera no primeiro acesso)
  setTimeout(() => {
    reconstruirCacheSlugs().then(() => {
      console.log('[Portal] Cache de slugs da Área do Cliente aquecido.');
      // Executa a auto-cura logo após o aquecimento do cache
      corrigirNomesClientesSemNome().catch(err => console.error('[Self-Heal] Falha na varredura de autocorreção:', err.message));
    }).catch(err => console.error('[Portal] Falha ao aquecer cache de slugs:', err.message));
  }, 3000);

  // Migração única roteiros → ID imutável (idempotente; roda em segundo plano)
  setTimeout(() => {
    migrarRoteirosParaId().catch(err => console.error('[Migração Roteiros→ID] Falha:', err.message));
  }, 1500);
});
