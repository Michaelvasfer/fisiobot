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

// Descarga un archivo de media (audio, imagen, documento) por su id de Meta.
// Devuelve { buffer, mime, extension }.
async function descargarMedia(mediaId) {
  if (!credencialesListas()) throw new Error('Sin credenciales de WhatsApp');
  const cabeceras = { Authorization: `Bearer ${config.whatsapp.token}` };
  const { data: meta } = await axios.get(
    `https://graph.facebook.com/${config.whatsapp.graphVersion}/${mediaId}`,
    { headers: cabeceras }
  );
  const { data: binario } = await axios.get(meta.url, {
    headers: cabeceras,
    responseType: 'arraybuffer',
  });
  const mime = meta.mime_type || 'application/octet-stream';
  const extension = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') || mime.includes('mp4/aac') ? 'm4a' : mime.includes('mpeg') ? 'mp3' : mime.includes('amr') ? 'amr' : 'bin';
  return { buffer: Buffer.from(binario), mime, extension };
}

// Autoverificación anti-cruce al arrancar: consulta a Meta qué número
// corresponde al WHATSAPP_PHONE_NUMBER_ID configurado y lo compara con
// WHATSAPP_NUMERO_ESPERADO. Si no coinciden, las credenciales son de OTRO
// número (ej. el de Kaminar Med) y este bot estaría respondiendo por la
// línea equivocada. Solo avisa (no detiene el servidor): en desarrollo sin
// credenciales o sin internet no debe estorbar.
async function verificarNumeroPropio() {
  if (!credencialesListas() || !config.whatsapp.numeroEsperado) return;
  const esperado = config.whatsapp.numeroEsperado.replace(/\D/g, '');
  try {
    const { data } = await axios.get(
      `https://graph.facebook.com/${config.whatsapp.graphVersion}/${config.whatsapp.phoneNumberId}`,
      {
        params: { fields: 'display_phone_number' },
        headers: { Authorization: `Bearer ${config.whatsapp.token}` },
      }
    );
    const real = String(data.display_phone_number || '').replace(/\D/g, '');
    if (real && (real.endsWith(esperado) || esperado.endsWith(real))) {
      console.log(`[config] Número de WhatsApp verificado: ${real}`);
    } else {
      console.error(
        `[config] ⚠️ NÚMERO CRUZADO: estas credenciales corresponden al número ${real || 'desconocido'}, ` +
        `pero WHATSAPP_NUMERO_ESPERADO es ${esperado}. Fisiobot debe usar el 51953838656 (KaminarFisio); ` +
        `el 51928742228 es de Kaminar Med (el otro bot). Corrige WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID en bot/.env.`
      );
    }
  } catch (err) {
    console.warn(`[config] No se pudo verificar el número de WhatsApp: ${err.message}`);
  }
}

module.exports = { sendText, markAsRead, mostrarEscribiendo, notificarRecepcion, credencialesListas, descargarMedia, verificarNumeroPropio };
