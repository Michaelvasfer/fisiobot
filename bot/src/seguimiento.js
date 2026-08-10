// Motor de seguimiento automático: si el paciente deja de responder, el bot
// le envía recordatorios según los pasos de config/seguimiento.json (editable
// desde el panel, sección Seguimiento).
//
// Reglas:
// - Solo cuando el ÚLTIMO mensaje de la conversación es del asistente
//   (el paciente quedó en silencio después de que el bot le habló).
// - Nunca en conversaciones derivadas a recepción (handoff), con cita
//   solicitada o confirmada, ni al número de recepción o al chat de prueba.
// - Pausa nocturna: fuera del horario configurado no se envía nada; lo que
//   quedó pendiente sale al abrir el horario.
// - Si el paciente responde después de un seguimiento, la secuencia se
//   reinicia (vuelve al paso 1 la próxima vez que quede en silencio).
const fs = require('fs');
const path = require('path');
const { config } = require('./config');
const whatsapp = require('./whatsapp');
const agenda = require('./agenda');
const fisio = require('./fisio');
const push = require('./push');

const RUTA_CONFIG = path.join(__dirname, '..', 'config', 'seguimiento.json');
const INTERVALO_MS = 60 * 1000;
const ESTADOS_BLOQUEADOS = ['CITA_SOLICITADA', 'CITA_CONFIRMADA', 'DERIVADO_A_RECEPCION'];
const TELEFONOS_IGNORADOS = ['webchat-local'];

// Lee la configuración en cada ciclo: los cambios del panel aplican sin reiniciar.
function cargarConfig() {
  try {
    return JSON.parse(fs.readFileSync(RUTA_CONFIG, 'utf8'));
  } catch {
    return null; // sin archivo: motor apagado
  }
}

// Minutos desde medianoche en la zona horaria del consultorio.
function minutosAhoraEnZona() {
  const zona = (config.clinica.identidad && config.clinica.identidad.zonaHoraria) || 'America/Lima';
  const partes = new Intl.DateTimeFormat('es-PE', {
    timeZone: zona, hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parseInt((partes.find((p) => p.type === t) || {}).value || '0', 10);
  return (get('hour') % 24) * 60 + get('minute');
}

// ¿Estamos dentro del horario permitido para enviar seguimientos?
function enHorario(cfg, minutosActuales) {
  if (!cfg.pausaNocturna) return true;
  const [hi, mi] = (cfg.horaInicio || '08:00').split(':').map(Number);
  const [hf, mf] = (cfg.horaFin || '22:00').split(':').map(Number);
  return minutosActuales >= hi * 60 + mi && minutosActuales < hf * 60 + mf;
}

// Decide qué hacer con una conversación:
//   { accion: 'enviar', paso, indice } | { accion: 'reiniciar' } | null
function evaluar(conv, cfg, telefono, ahoraMs, minutosZona) {
  if (!cfg || !cfg.activo) return null;
  if (!conv || conv.handoff) return null;
  if (ESTADOS_BLOQUEADOS.includes(conv.estado)) return null;
  if (TELEFONOS_IGNORADOS.includes(telefono) || telefono === config.recepcionWhatsapp) return null;
  const historial = conv.historial || [];
  if (historial.length === 0) return null;
  const ultimo = historial[historial.length - 1];
  const seg = conv.seguimiento || null;
  const ahora = ahoraMs === undefined ? Date.now() : ahoraMs;

  if (ultimo.role === 'user') {
    // El paciente respondió DESPUÉS de un seguimiento: la secuencia se reinicia.
    if (seg && seg.pasosEnviados > 0 && seg.ultimoEnviado && new Date(ultimo.ts || 0) > new Date(seg.ultimoEnviado)) {
      return { accion: 'reiniciar' };
    }
    return null;
  }
  if (ultimo.role !== 'assistant') return null;
  // Mensaje anotado desde la agenda remota (reseña/recordatorio enviado fuera
  // del bot): no forma parte de la conversación; no debe disparar seguimientos.
  // La flag se llama "kaminar" por compatibilidad con el historial ya guardado
  // en data/conversaciones.json.
  if (ultimo.kaminar) return null;
  if (!enHorario(cfg, minutosZona === undefined ? minutosAhoraEnZona() : minutosZona)) return null;

  const pasos = (cfg.pasos || []).filter((p) => p.activo && p.mensaje);
  const max = Math.min(pasos.length, cfg.maxReintentos || pasos.length);
  const enviados = seg ? seg.pasosEnviados : 0;
  if (enviados >= max) return null;
  const paso = pasos[enviados];
  const silencioMs = ahora - new Date(ultimo.ts || 0).getTime();
  if (silencioMs < (paso.delay || 60) * 60000) return null;
  return { accion: 'enviar', paso, indice: enviados };
}

async function cicloSeguimiento(store) {
  const cfg = cargarConfig();
  if (!cfg || !cfg.activo) return;
  for (const resumen of store.listarConversaciones()) {
    const telefono = resumen.telefono;
    const conv = store.obtenerConversacion(telefono);
    const decision = evaluar(conv, cfg, telefono);
    if (!decision) continue;

    if (decision.accion === 'reiniciar') {
      store.guardarConversacion(telefono, { ...conv, seguimiento: { pasosEnviados: 0, ultimoEnviado: null } });
      continue;
    }

    try {
      await whatsapp.sendText(telefono, decision.paso.mensaje);
      store.agregarMensaje(telefono, 'assistant', decision.paso.mensaje, { seguimiento: true });
      // Releer antes de guardar para no pisar el historial recién actualizado.
      const fresco = store.obtenerConversacion(telefono);
      store.guardarConversacion(telefono, {
        ...fresco,
        seguimiento: { pasosEnviados: decision.indice + 1, ultimoEnviado: new Date().toISOString() },
      });
      console.log(`[seguimiento] paso ${decision.indice + 1} enviado a ${telefono}`);
    } catch (err) {
      console.error(`[seguimiento] no se pudo enviar a ${telefono}: ${err.message}`);
    }
  }
}

// --- Lista de espera: avisa al primero cuando aparece un cupo libre ---
async function revisarListaEspera(store) {
  const espera = store.listaEsperaListar();
  if (espera.length === 0) return;
  const disp = await agenda.consultarDisponibilidad(store).catch(() => null);
  if (!disp || disp.sinCupos || !disp.cupos.length) return;
  const primero = espera[0];
  const primera = disp.cupos[0];
  const mensaje = `Buenas noticias: se liberó un horario en el consultorio del Dr. Vásquez. Hay cupo el ${primera.fecha} a las ${primera.horas[0]}. Si desea reservarlo, responda a este mensaje y le ayudo enseguida.`;
  try {
    await whatsapp.sendText(primero.telefono, mensaje);
    store.agregarMensaje(primero.telefono, 'assistant', mensaje, { listaEspera: true });
    store.listaEsperaQuitar(primero.telefono);
    console.log(`[lista-espera] aviso enviado a ${primero.telefono}`);
  } catch (err) {
    console.error(`[lista-espera] no se pudo avisar a ${primero.telefono}:`, err.message);
  }
}

// --- Resumen matutino: a las 07:00 (Lima) manda la agenda del día a recepción ---
const RUTA_ESTADO_RESUMEN = path.join(__dirname, '..', 'data', 'resumen-state.json');

async function resumenMatutino(store) {
  if (!(config.modoAgenda === 'automatico' && fisio.lista())) return;
  const ahoraMin = minutosAhoraEnZona();
  if (ahoraMin < 7 * 60 || ahoraMin >= 7 * 60 + 5) return; // ventana 07:00–07:05
  const zona = (config.clinica.identidad && config.clinica.identidad.zonaHoraria) || 'America/Lima';
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: zona });
  let estado = {};
  try { estado = JSON.parse(fs.readFileSync(RUTA_ESTADO_RESUMEN, 'utf8')); } catch {}
  if (estado.ultimo === hoy) return;
  try {
    const r = await fisio.citasDelDia();
    const citas = r.citas || [];
    const lineas = citas.length
      ? citas.map((c) => `• ${c.hora} — ${c.paciente} (${c.estado})`)
      : ['(sin citas registradas para hoy)'];
    const resumen = [`*Agenda de hoy — ${citas.length} cita(s):*`, ...lineas].join('\n');
    await whatsapp.notificarRecepcion(resumen);
    // Respaldo por push al panel: no depende de la ventana de 24 h de Meta.
    push.enviarPush(store, `Agenda de hoy — ${citas.length} cita(s)`, lineas.join(' · ').slice(0, 200), {}).catch(() => {});
    estado.ultimo = hoy;
    fs.writeFileSync(RUTA_ESTADO_RESUMEN, JSON.stringify(estado));
    console.log('[resumen] agenda matutina enviada a recepción');
  } catch (err) {
    console.error('[resumen] no se pudo enviar:', err.message);
  }
}

async function ciclo(store) {
  await cicloSeguimiento(store);
  await revisarListaEspera(store).catch((e) => console.error('[lista-espera] error:', e.message));
  await resumenMatutino(store).catch((e) => console.error('[resumen] error:', e.message));
}

function iniciar(store) {
  if (process.env.NODE_TEST_CONTEXT) return;
  console.log('[seguimiento] motor iniciado (revisa cada 60 s)');
  setInterval(() => ciclo(store).catch((e) => console.error('[seguimiento] error en ciclo:', e.message)), INTERVALO_MS);
}

module.exports = { iniciar, evaluar, cargarConfig, enHorario };
