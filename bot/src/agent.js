// Núcleo del agente: llama a OpenAI con el system prompt, el historial y las tools,
// ejecuta las herramientas que el modelo pida y devuelve el texto final para el paciente.
const OpenAI = require('openai');
const { config } = require('./config');
const { construirSystemPrompt } = require('./promptBuilder');
const tools = require('./tools');

const MAX_ITERACIONES_TOOLS = 5;
const MENSAJES_HISTORIAL_OPENAI = 20; // solo los últimos N mensajes van a OpenAI (ahorro de tokens)
// Red determinística: texto que habla de horarios o disponibilidad. Si el modelo
// responde algo así SIN haber llamado a consultar_disponibilidad en este turno
// (p. ej. repitiendo una respuesta vieja del historial), se le obliga a verificar.
const PATRON_HORARIOS = /disponibil|disponible|ocupad[ao]|a las \d{1,2}/i;
const MENSAJE_ERROR =
  'Disculpe, tuve un inconveniente técnico para responder. Derivaré su consulta a recepción para que continúe ayudándole por este mismo medio.';

let cliente = null;
function obtenerCliente() {
  if (!cliente) cliente = new OpenAI({ apiKey: config.openai.apiKey });
  return cliente;
}

// Quita emojis e íconos de un texto. Se usa sobre el historial del asistente
// (el modelo imita el formato de sus mensajes viejos, que tenían íconos, aunque
// el prompt actual los prohíba) y como red de seguridad sobre la respuesta final.
function sinEmojis(texto) {
  return (texto || '')
    .replace(
      /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}-\u{2B55}\u{FE0F}\u{2190}-\u{21FF}]/gu,
      ' '
    )
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^ +| +$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Evita que WhatsApp genere previews automáticos de eventos/calendario al detectar
// fechas y horas. Inserta un zero-width non-joiner invisible entre el número y la
// palabra "de" en fechas, y entre la hora y "a. m./p. m.". El texto se ve igual.
function sinPreviewCalendario(texto) {
  return (texto || '')
    .replace(/(\d{1,2})\s+de\s+([a-z]+)/gi, '$1\u200C de $2')
    .replace(/(\d{1,2}:\d{2})\s+(a\. m\.|p\. m\.)/gi, '$1\u200C $2');
}

// Procesa un mensaje del paciente y devuelve la respuesta del asistente.
// telefono: número del paciente; texto: mensaje; contextoExtra: líneas de sistema
// (p. ej. campaña de origen o aviso de que envió un audio/imagen).
async function procesarMensaje(telefono, texto, store, contextoExtra) {
  const conv = store.obtenerConversacion(telefono);
  const contenidoUsuario = contextoExtra ? `[Sistema: ${contextoExtra}]\n\n${texto}` : texto;

  const mensajes = [
    { role: 'system', content: construirSystemPrompt() },
    // El historial guardado puede tener campos extra (ts, manual); la API solo acepta role/content.
    // Las respuestas viejas del asistente se sanean de emojis para que el modelo no los imite.
    // Se envían solo los últimos mensajes para controlar tokens; el panel /admin conserva todo.
    ...conv.historial.slice(-MENSAJES_HISTORIAL_OPENAI).map((m) => ({ role: m.role, content: m.role === 'assistant' ? sinEmojis(m.content) : m.content })),
    { role: 'user', content: contenidoUsuario },
  ];

  const openai = obtenerCliente();

  try {
    let iteraciones = 0;
    let consultoAgenda = false;
    let correccionAgendaHecha = false;
    // Historial temporal de esta llamada (incluye tool calls y sus resultados).
    const trabajo = [...mensajes];

    while (iteraciones < MAX_ITERACIONES_TOOLS) {
      const respuesta = await openai.chat.completions.create({
        model: config.openai.model,
        messages: trabajo,
        tools: tools.definiciones,
        tool_choice: 'auto',
        temperature: 0.4,
      });

      const mensaje = respuesta.choices[0].message;
      trabajo.push(mensaje);

      if (!mensaje.tool_calls || mensaje.tool_calls.length === 0) {
        // Red de seguridad: aunque el modelo desobedezca, al paciente no le llegan emojis
        // ni previews automáticos de calendario de WhatsApp.
        const textoFinal = sinPreviewCalendario(sinEmojis(mensaje.content));
        if (!consultoAgenda && !correccionAgendaHecha && PATRON_HORARIOS.test(textoFinal)) {
          correccionAgendaHecha = true;
          console.warn(`[agente] ${telefono} habló de horarios sin consultar la agenda; se le obliga a verificar.`);
          trabajo.push({
            role: 'system',
            content:
              '[Sistema: Acabas de mencionar horarios o disponibilidad SIN consultar la agenda en este turno. Está prohibido. ' +
              'Llama AHORA a consultar_disponibilidad — pasando fecha y hora si el paciente pidió un horario concreto — ' +
              'y responde usando únicamente lo que la herramienta devuelva.]',
          });
          continue;
        }
        // Guardar en el historial persistente: usuario + respuesta final.
        store.agregarMensaje(telefono, 'user', contenidoUsuario);
        store.agregarMensaje(telefono, 'assistant', textoFinal);
        return textoFinal;
      }

      iteraciones += 1;
      for (const llamada of mensaje.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(llamada.function.arguments || '{}');
        } catch {
          args = {};
        }
        if (llamada.function.name === 'consultar_disponibilidad') consultoAgenda = true;
        let resultado;
        try {
          resultado = await tools.ejecutar(llamada.function.name, args, { telefono, store });
        } catch (err) {
          console.error(`[tools] Error en ${llamada.function.name}:`, err.message);
          resultado = JSON.stringify({ exito: false, error: 'Error interno al ejecutar la acción.' });
        }
        trabajo.push({ role: 'tool', tool_call_id: llamada.id, content: resultado });
      }
    }

    // Demasiadas llamadas a herramientas seguidas: derivar por seguridad.
    console.warn(`[agente] Límite de iteraciones de tools alcanzado para ${telefono}`);
    await tools.ejecutar('derivar_recepcion', { motivo_derivacion: 'El asistente no pudo completar la acción automáticamente.' }, { telefono, store });
    store.agregarMensaje(telefono, 'user', contenidoUsuario);
    store.agregarMensaje(telefono, 'assistant', MENSAJE_ERROR);
    return MENSAJE_ERROR;
  } catch (err) {
    console.error('[agente] Error al llamar a OpenAI:', err.message);
    store.agregarMensaje(telefono, 'user', contenidoUsuario);
    store.agregarMensaje(telefono, 'assistant', MENSAJE_ERROR);
    return MENSAJE_ERROR;
  }
}

module.exports = { procesarMensaje, sinEmojis, sinPreviewCalendario };
