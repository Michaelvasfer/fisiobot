// Transcripción de notas de voz de WhatsApp con Whisper (OpenAI).
// Devuelve el texto transcrito o null si falla (el flujo cae al aviso clásico).
const OpenAI = require('openai');
const { config } = require('./config');

let cliente = null;
function obtenerCliente() {
  if (!cliente) cliente = new OpenAI({ apiKey: config.openai.apiKey });
  return cliente;
}

async function transcribirAudio(buffer, extension) {
  if (!config.openai.apiKey || !buffer || !buffer.length) return null;
  try {
    const openai = obtenerCliente();
    const archivo = await OpenAI.toFile(buffer, `audio.${extension || 'ogg'}`);
    const resultado = await openai.audio.transcriptions.create({
      file: archivo,
      model: 'whisper-1',
      language: 'es',
    });
    const texto = (resultado.text || '').trim();
    return texto || null;
  } catch (err) {
    console.error('[audio] No se pudo transcribir:', err.message);
    return null;
  }
}

module.exports = { transcribirAudio };
