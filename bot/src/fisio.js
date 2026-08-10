// Cliente HTTP del bot hacia la agenda real de KaminarFisio, fisio.kaminar.pe
// (POST/GET /api/bot-agenda). NO confundir con kaminar.pe (Kaminar Med): ese es
// el sistema de otro consultorio, con su propio bot y su propio número.
// Se activa con FISIO_API_URL y FISIO_API_TOKEN en .env (MODO_AGENDA=automatico).
const { config } = require('./config');

function lista() {
  return Boolean(config.fisio && config.fisio.url && config.fisio.token);
}

async function llamar(params, opciones) {
  const url = `${config.fisio.url}${params ? `?${params}` : ''}`;
  const res = await fetch(url, {
    method: opciones && opciones.method ? opciones.method : 'GET',
    headers: { 'x-bot-token': config.fisio.token, 'Content-Type': 'application/json' },
    body: opciones && opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(datos.error || `HTTP ${res.status}`);
  return datos;
}

// Cupos libres de la agenda real. antelacion: minutos mínimos para horas de hoy
// (120 al ofrecer, 30 al validar un registro en curso).
function disponibilidad(antelacion) {
  return llamar(`accion=disponibilidad&antelacion=${antelacion || 120}`);
}

// Crea paciente (si no existe) + cita en estado 'pendiente'. Devuelve { citaId }.
function registrar(datos) {
  return llamar(null, { method: 'POST', body: { accion: 'registrar', ...datos } });
}

// Cambia el estado de una cita de la agenda real ('confirmada', 'cancelada', ...).
function actualizarEstado(citaId, estado) {
  return llamar(null, { method: 'POST', body: { accion: 'estado', citaId, estado } });
}

// Confirma la próxima cita pendiente del paciente (respuesta "CONFIRMO" al recordatorio).
function confirmarPorTelefono(telefono) {
  return llamar(null, { method: 'POST', body: { accion: 'confirmar-por-telefono', telefono } });
}

// Cancela la próxima cita del paciente (respuesta "CANCELO" o pedido del paciente).
function cancelarPorTelefono(telefono) {
  return llamar(null, { method: 'POST', body: { accion: 'cancelar-por-telefono', telefono } });
}

// Citas de hoy del doctor (resumen matutino para recepción).
function citasDelDia() {
  return llamar(null, { method: 'POST', body: { accion: 'citas-del-dia' } });
}

module.exports = { lista, disponibilidad, registrar, actualizarEstado, confirmarPorTelefono, cancelarPorTelefono, citasDelDia };
