// Cliente mínimo de la Meta WhatsApp Cloud API.
// Sin credenciales (desarrollo), los mensajes se muestran en consola en lugar de enviarse.
const axios = require('axios');
const { config } = require('./config');

function urlMensajes() {
  return `https://graph.facebook.com/${config.whatsapp.graphVersion}/${config.whatsapp.phoneNumberId}/messages`;
}

function credencialesListas() {
  return Boolean(config.whatsapp.token && config.whatsapp.phoneNumberId);
}

async function sendText(destinatario, texto) {
  if (!credencialesListas()) {
    console.log(`[whatsapp:simulado] → ${destinatario}: ${texto}`);
    return { simulado: true };
  }
  const { data } = await axios.post(
    urlMensajes(),
    {
      messaging_product: 'whatsapp',
      to: destinatario,
      type: 'text',
      text: { body: texto },
    },
    { headers: { Authorization: `Bearer ${config.whatsapp.token}` } }
  );
  return data;
}

async function markAsRead(messageId) {
  if (!credencialesListas()) return { simulado: true };
  const { data } = await axios.post(
    urlMensajes(),
    { messaging_product: 'whatsapp', status: 'read', message_id: messageId },
    { headers: { Authorization: `Bearer ${config.whatsapp.token}` } }
  );
  return data;
}

// Marca el mensaje como leído y muestra "escribiendo…" al paciente.
// El indicador desaparece solo al enviar la respuesta o a los ~25 s.
async function mostrarEscribiendo(messageId) {
  if (!credencialesListas()) {
    console.log('[whatsapp:simulado] leido + escribiendo...');
    return { simulado: true };
  }
  const { data } = await axios.post(
    urlMensajes(),
    {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
      typing_indicator: { type: 'text' },
    },
    { headers: { Authorization: `Bearer ${config.whatsapp.token}` } }
  );
  return data;
}

// Avisa a recepción (nuevo lead, solicitud de cita, derivación).
async function notificarRecepcion(texto) {
  if (!config.recepcionWhatsapp) {
    console.error(`[recepcion:sin-numero] No se pudo notificar a recepción porque RECEPCION_WHATSAPP no está configurado en .env. Mensaje: ${texto}`);
    return { simulado: true };
  }
  return sendText(config.recepcionWhatsapp, texto);
}

module.exports = { sendText, markAsRead, mostrarEscribiendo, notificarRecepcion, credencialesListas };
