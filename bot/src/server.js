// Servidor Express: webhook de Meta WhatsApp Cloud API + comandos de recepción.
const express = require('express');
const path = require('path');
const { config, avisarConfiguracionIncompleta } = require('./config');
const { crearStore } = require('./store');
const whatsapp = require('./whatsapp');
const push = require('./push');
const { procesarMensaje } = require('./agent');
const kaminar = require('./kaminar');

const app = express();
app.use(express.json());

const store = crearStore();

// --- Panel de administración (requiere ADMIN_PASSWORD en .env) ---
if (config.adminPassword) {
  app.use('/admin', require('./admin')(store, whatsapp));
}

// --- Chat de prueba en el navegador (solo si HABILITAR_CHAT_WEB está activo) ---
if (config.habilitarChatWeb) {
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Teléfono ficticio usado por el chat de prueba (no interfiere con pacientes reales).
  const TELEFONO_WEBCHAT = 'webchat-local';

  app.post('/chat/mensaje', async (req, res) => {
    const texto = (req.body && req.body.texto ? String(req.body.texto) : '').trim();
    if (!texto) return res.status(400).json({ error: 'texto vacío' });
    if (store.obtenerConversacion(TELEFONO_WEBCHAT).handoff) {
      return res.json({ aviso: 'La conversación fue derivada a recepción. El asistente está en pausa; usa "Reiniciar chat" para empezar de nuevo.' });
    }
    const respuesta = await procesarMensaje(TELEFONO_WEBCHAT, texto, store, null);
    res.json({ respuesta });
  });

  app.post('/chat/reiniciar', (_req, res) => {
    store.guardarConversacion(TELEFONO_WEBCHAT, { historial: [], estado: 'NUEVO', handoff: false, campania: null });
    res.json({ ok: true });
  });
}

// --- Verificación del webhook (Meta envía GET con hub.challenge) ---
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.get('/health', (_req, res) => res.json({ ok: true, modoAgenda: config.modoAgenda }));

// --- Recepción de mensajes ---
app.post('/webhook', (req, res) => {
  res.sendStatus(200); // responder de inmediato para evitar reintentos de Meta
  procesarPayload(req.body).catch((err) => console.error('[webhook] Error:', err));
});

async function procesarPayload(body) {
  if (body.object !== 'whatsapp_business_account') return;
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const mensaje of value.messages || []) {
        await procesarMensajeEntrante(mensaje, value);
      }
    }
  }
}

// Contexto de campaña: cuando el paciente llega desde un anuncio (Click-to-WhatsApp),
// Meta incluye referral con la información del anuncio.
function contextoCampania(mensaje) {
  const ref = mensaje.referral;
  if (!ref) return null;
  const partes = ['El paciente llega desde un anuncio de Facebook/Instagram.'];
  if (ref.headline) partes.push(`Título del anuncio: "${ref.headline}".`);
  if (ref.body) partes.push(`Texto del anuncio: "${ref.body}".`);
  partes.push('Identifica la campaña y adapta el saludo según la sección 7.');
  return partes.join(' ');
}

async function procesarMensajeEntrante(mensaje, value) {
  const telefono = mensaje.from;
  const texto = mensaje.text && mensaje.text.body ? mensaje.text.body.trim() : '';

  // 1) Comandos de recepción (desde el número configurado en RECEPCION_WHATSAPP).
  if (telefono === config.recepcionWhatsapp && texto.startsWith('#')) {
    await procesarComandoRecepcion(texto);
    return;
  }

  // Aviso push al panel del administrador por cada mensaje entrante de un paciente.
  const TIPOS = { audio: 'audio', image: 'imagen', document: 'documento', video: 'video', sticker: 'sticker', location: 'ubicación' };
  const cuerpo = texto || TIPOS[mensaje.type] || 'mensaje nuevo';
  push.enviarPush(store, `${telefono}`, cuerpo.slice(0, 120), { telefono }).catch(() => {});

  // 2) Si recepción tomó la conversación, el agente no responde.
  const conv = store.obtenerConversacion(telefono);
  if (conv.handoff) {
    console.log(`[handoff] ${telefono} está atendido por recepción; el agente no responde.`);
    return;
  }

  // 2b) Respuestas directas a recordatorios (modo automático con agenda real):
  // "confirmo" → confirma la próxima cita pendiente; "cancelo" → libera el cupo.
  // Se usan palabras exactas para no chocar con el "si" del flujo de registro.
  if (texto && config.modoAgenda === 'automatico' && kaminar.lista()) {
    const plano = texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ.!¡?¿]/g, '');
    if (plano === 'confirmo' || plano === 'cancelo') {
      try {
        if (plano === 'confirmo') {
          const r = await kaminar.confirmarPorTelefono(telefono);
          if (r.ok) {
            store.agregarMensaje(telefono, 'user', texto);
            const respuesta = `Perfecto, su cita quedó confirmada para el ${r.fecha} a las ${r.hora}. Le esperamos.`;
            store.agregarMensaje(telefono, 'assistant', respuesta);
            await enviarSeguro(telefono, respuesta);
            return;
          }
          // Sin cita pendiente: sigue el flujo normal del agente.
        } else {
          const r = await kaminar.cancelarPorTelefono(telefono);
          if (r.ok) {
            store.agregarMensaje(telefono, 'user', texto);
            const respuesta = `Entendido. Su cita del ${r.fecha} a las ${r.hora} quedó cancelada. Si desea reprogramar, con gusto le muestro los horarios disponibles.`;
            store.agregarMensaje(telefono, 'assistant', respuesta);
            await enviarSeguro(telefono, respuesta);
            await whatsapp.notificarRecepcion(`El paciente ${r.nombre} (${telefono}) canceló su cita del ${r.fecha} a las ${r.hora} por WhatsApp.`);
            return;
          }
        }
      } catch (err) {
        console.error('[recordatorios] error procesando respuesta:', err.message);
      }
    }
  }

  await whatsapp.mostrarEscribiendo(mensaje.id).catch(() => {});

  // 3) Audio de voz: se transcribe con Whisper y sigue el flujo normal.
  if (mensaje.type === 'audio' && mensaje.audio && mensaje.audio.id) {
    let transcripcion = null;
    try {
      const media = await whatsapp.descargarMedia(mensaje.audio.id);
      const { transcribirAudio } = require('./transcribir');
      transcripcion = await transcribirAudio(media.buffer, media.extension);
    } catch (err) {
      console.error('[audio] No se pudo descargar/transcribir:', err.message);
    }
    if (transcripcion) {
      console.log(`[audio] ${telefono} transcrito: ${transcripcion.slice(0, 120)}`);
      const respuesta = await procesarMensaje(
        telefono,
        transcripcion,
        store,
        'El paciente envió una nota de voz; el texto es la transcripción aproximada del audio (puede tener errores menores). Responde a su contenido con naturalidad.'
      );
      if (respuesta) await responderHumano(telefono, respuesta);
      return;
    }
    // Si falla la transcripción, cae al aviso clásico de la sección 22.
  }

  // 4) Contenido no textual: responder según la sección 22 del prompt.
  if (mensaje.type !== 'text') {
    const avisos = {
      audio: 'El paciente envió un audio que no se puede transcribir. Responde con el mensaje de audios de la sección 22.',
      image: 'El paciente envió una imagen (posiblemente un estudio o fotografía). Agradécela según la sección 22; no la interpretes ni diagnostiques.',
      document: 'El paciente envió un documento (posiblemente un informe o estudio). Agradécelo según la sección 22; no lo interpretes.',
      video: 'El paciente envió un video. Indica que no puedes ver videos y pide que escriba su consulta.',
      sticker: 'El paciente envió un sticker. Continúa la conversación normalmente.',
      location: 'El paciente compartió su ubicación. Agradécela y continúa la conversación.',
    };
    const aviso = avisos[mensaje.type] || 'El paciente envió un contenido no textual. Pide que escriba su consulta.';
    const respuesta = await procesarMensaje(telefono, '', store, aviso);
    if (respuesta) await responderHumano(telefono, respuesta);
    return;
  }

  // 5) Mensaje de texto normal: pasarlo al agente.
  const nombrePerfil = value.contacts && value.contacts[0] && value.contacts[0].profile
    ? value.contacts[0].profile.name
    : null;
  const contextos = [];
  const campania = contextoCampania(mensaje);
  if (campania) contextos.push(campania);
  if (nombrePerfil && !conv.historial.length) {
    contextos.push(`El nombre del perfil de WhatsApp del paciente es "${nombrePerfil}" (úsalo como referencia, confirma su nombre real antes de registrar una cita).`);
  }

  const respuesta = await procesarMensaje(telefono, texto, store, contextos.join(' ') || null);
  if (respuesta) await responderHumano(telefono, respuesta);
}

// Envía al paciente sin que un error de la Cloud API tumbe el procesamiento del mensaje.
async function enviarSeguro(telefono, texto) {
  try {
    await whatsapp.sendText(telefono, texto);
  } catch (err) {
    console.error(`[whatsapp] No se pudo enviar a ${telefono}: ${err.message}`);
  }
}

// Divide la respuesta del agente en burbujas (el prompt le pide separarlas con |||).
function dividirEnBurbujas(texto) {
  return texto.split('|||').map((t) => t.trim()).filter(Boolean).slice(0, 3);
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simula el tecleo humano: pausa proporcional al largo del mensaje, con algo de azar.
function demoraTecleo(texto) {
  const base = 800 + Math.random() * 700;
  return Math.min(base + texto.length * 35, 6000);
}

// Envía la respuesta en burbujas, con pausas de "escritura" entre ellas.
// En modo simulado (sin credenciales) no hay esperas para no alentar las pruebas.
async function responderHumano(telefono, respuesta) {
  const burbujas = dividirEnBurbujas(respuesta);
  for (const burbuja of burbujas) {
    if (whatsapp.credencialesListas()) await esperar(demoraTecleo(burbuja));
    await enviarSeguro(telefono, burbuja);
  }
}

// Comandos que recepción puede enviar al número del bot:
//   #tomar <telefono>              → recepción atiende manualmente (agente en pausa)
//   #soltar <telefono>             → el agente vuelve a responder
//   #confirmar <telefono>          → confirma la cita pendiente y avisa al paciente
//   #decir <telefono> <mensaje>    → envía un mensaje libre al paciente desde el número del bot
async function procesarComandoRecepcion(texto) {
  const partes = texto.split(/\s+/);
  const comando = partes[0].toLowerCase();
  const telefono = partes[1];
  const AYUDA = 'Comandos disponibles:\n#tomar <telefono>\n#soltar <telefono>\n#confirmar <telefono>\n#decir <telefono> <mensaje>';

  if (!telefono) {
    await whatsapp.notificarRecepcion(AYUDA);
    return;
  }

  switch (comando) {
    case '#tomar':
      store.establecerHandoff(telefono, true);
      await whatsapp.notificarRecepcion(`Ahora estás atendiendo a ${telefono}. El asistente está en pausa para ese chat.\nEscríbele con: #decir ${telefono} <tu mensaje>`);
      break;

    case '#soltar':
      store.establecerHandoff(telefono, false);
      await whatsapp.notificarRecepcion(`El asistente vuelve a responder a ${telefono}.`);
      break;

    case '#decir': {
      const mensajeLibre = partes.slice(2).join(' ').trim();
      if (!mensajeLibre) {
        await whatsapp.notificarRecepcion(`Falta el mensaje. Uso: #decir ${telefono} <tu mensaje>`);
        return;
      }
      await enviarSeguro(telefono, mensajeLibre);
      store.agregarMensaje(telefono, 'assistant', mensajeLibre);
      await whatsapp.notificarRecepcion(`Enviado a ${telefono}.`);
      break;
    }

    case '#confirmar': {
      const cita = store.citaPendienteDe(telefono);
      if (!cita) {
        await whatsapp.notificarRecepcion(`No encontré una cita pendiente para ${telefono}.`);
        return;
      }
      store.actualizarCita(cita.id, { estado: 'CONFIRMADA' });
      // Si la cita también existe en la agenda real (modo automático), confirmarla allá.
      if (cita.kaminarId) {
        kaminar.actualizarEstado(cita.kaminarId, 'confirmada')
          .catch((e) => console.error('[kaminar] no se pudo confirmar la cita remota:', e.message));
      }
      store.establecerEstado(telefono, 'CITA_CONFIRMADA');
      const i = config.clinica.identidad;
      await whatsapp.sendText(
        telefono,
        [
          `Su cita quedó confirmada con el ${i.medico}.`,
          '',
          `Fecha: ${cita.fecha}`,
          `Hora: ${cita.hora}`,
          `Dirección: ${i.direccion}`,
          `Consulta: ${i.precioConsulta}`,
          '',
          'Le recomendamos llegar entre 10 y 15 minutos antes y traer sus estudios e informes médicos.',
        ].join('\n')
      );
      await whatsapp.notificarRecepcion(`Cita de ${cita.nombre} (${telefono}) confirmada y notificada al paciente.`);
      break;
    }

    default:
      await whatsapp.notificarRecepcion(`Comando no reconocido: ${comando}\n${AYUDA}`);
  }
}

if (require.main === module) {
  avisarConfiguracionIncompleta();
  app.listen(config.port, () => {
    console.log(`Agente de WhatsApp escuchando en http://localhost:${config.port}`);
    if (config.habilitarChatWeb) {
      console.log(`Chat de prueba: abre http://localhost:${config.port} en tu navegador`);
    }
    console.log(`Modo de agenda: ${config.modoAgenda}`);
  });
  // Motor de seguimiento automático (config/seguimiento.json).
  require('./seguimiento').iniciar(store);
}

module.exports = { app, store };
