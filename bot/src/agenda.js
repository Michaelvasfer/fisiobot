// Agenda del consultorio.
// Modo MANUAL: los cupos vienen de config/clinica.json y las citas se registran
// como solicitudes pendientes. Para pasar a modo AUTOMÁTICO (Google Calendar,
// sistema de citas, etc.), implementa aquí las mismas dos funciones contra la
// agenda real y cambia MODO_AGENDA=automatico en .env. El resto del bot no cambia.
//
// Bloqueo de horarios: un cupo queda bloqueado cuando existe una cita
// CONFIRMADA en esa fecha/hora, o una cita PENDIENTE_CONFIRMACION creada hace
// menos de RESERVA_TTL_MINUTOS. Si recepción no confirma dentro de ese plazo,
// el cupo se libera solo y el bot vuelve a ofrecerlo. El pool de horarios es
// único y compartido: una reserva (de consulta o de campaña) bloquea la hora
// para todos.
//
// Dos márgenes distintos para las horas de hoy:
// - Oferta (ANTELACION_MINUTOS, 120): holgura para que recepción vea y confirme.
// - Registro (MARGEN_REGISTRO_MINUTOS, 30): al validar solicitar_cita solo se
//   exige que el cupo no empiece en menos de 30 min. Si se aplicara la
//   antelación completa también al registrar, un cupo ofrecido cuando era
//   válido se "vencería" a mitad de la conversación y el bot rechazaría la
//   confirmación del paciente con un "ya no está disponible".
const { config } = require('./config');
const kaminar = require('./kaminar');

// Margen mínimo (minutos) para ACEPTAR el registro de un cupo de hoy.
const MARGEN_REGISTRO_MINUTOS = 30;

// Normaliza texto de fecha/hora para comparar: "4:30 p. m." y "4:30 pm" deben coincidir.
function normalizar(t) {
  return (t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes (rango Unicode de marcas diacríticas)
    .replace(/[^a-z0-9:]/g, ''); // quita espacios, puntos y demás separadores
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

// Fecha/hora actual en la zona horaria del consultorio (no la del servidor).
function ahoraEnZona() {
  const partes = new Intl.DateTimeFormat('es-PE', {
    timeZone: (config.clinica.identidad && config.clinica.identidad.zonaHoraria) || 'America/Lima',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(new Date());
  const get = (t) => (partes.find((p) => p.type === t) || {}).value || '0';
  return {
    anio: parseInt(get('year'), 10),
    mes: parseInt(get('month'), 10),
    dia: parseInt(get('day'), 10),
    hora: parseInt(get('hour'), 10) % 24,
    minuto: parseInt(get('minute'), 10),
  };
}

// Interpreta la fecha de un cupo ("martes, 4 de agosto", "miércoles 30 de julio",
// o ISO "2026-08-04") como Date. Sin año en el texto: se asume el año en curso;
// si con ese año quedó más de 60 días atrás, se asume el año siguiente.
function fechaCupo(fechaTexto) {
  const m = /(\d{1,2})de([a-z]+)/.exec(normalizarFecha(fechaTexto));
  if (!m) return null;
  const mes = MESES.indexOf(m[2]);
  if (mes === -1) return null;
  const ahora = ahoraEnZona();
  const hoy = new Date(ahora.anio, ahora.mes - 1, ahora.dia);
  let fecha = new Date(ahora.anio, mes, parseInt(m[1], 10));
  if (fecha.getTime() < hoy.getTime() - 60 * 86400000) {
    fecha = new Date(ahora.anio + 1, mes, parseInt(m[1], 10));
  }
  return fecha;
}

// Convierte "4:30 p. m.", "9:00 a. m." o "16:00" a minutos desde medianoche.
function horaEnMinutos(horaTexto) {
  const m = /(\d{1,2}):(\d{2})(am|pm)/.exec(normalizarHora(horaTexto));
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3] === 'pm') h += 12;
  return h * 60 + parseInt(m[2], 10);
}

// Minutos de antelación mínima para ofrecer una hora del día de hoy.
// Ejemplo: si el paciente escribe a las 9:00 a. m., con 120 min no se le ofrece
// nada antes de las 11:00 a. m.
function antelacionMinutos() {
  return config.antelacionMinutos || 120;
}

// ¿El cupo ya pasó? Fechas anteriores a hoy siempre; las horas de hoy solo si
// empiezan en menos de `margenMinutos` (por defecto la antelación de oferta).
// Si el texto no se puede interpretar, no se filtra (conserva el comportamiento
// anterior).
function cupoYaPaso(fechaTexto, horaTexto, margenMinutos) {
  const margen = margenMinutos === undefined ? antelacionMinutos() : margenMinutos;
  const fecha = fechaCupo(fechaTexto);
  if (!fecha) return false;
  const ahora = ahoraEnZona();
  const hoy = new Date(ahora.anio, ahora.mes - 1, ahora.dia);
  if (fecha.getTime() < hoy.getTime()) return true;
  if (fecha.getTime() > hoy.getTime() || !horaTexto) return false;
  const mins = horaEnMinutos(horaTexto);
  if (mins === null) return false;
  return mins <= ahora.hora * 60 + ahora.minuto + margen;
}

// Convierte lo que pide el paciente ("mañana", "pasado mañana", "hoy", "el viernes")
// en un texto comparable con las fechas de los cupos ("5 de agosto").
// Devuelve null si no es una fecha relativa (ej. ya viene "4 de agosto").
function resolverFechaRelativa(texto) {
  const n = normalizar(texto);
  const ahora = ahoraEnZona();
  const hoy = new Date(ahora.anio, ahora.mes - 1, ahora.dia);
  let offset = null;
  if (n.includes('pasadomanana')) offset = 2;
  else if (n.includes('manana')) offset = 1;
  else if (n === 'hoy' || n === 'estatarde' || n === 'estanoche') offset = 0;
  else {
    const idx = DIAS_SEMANA.findIndex((d) => n.includes(d));
    if (idx === -1) return null;
    // Próxima ocurrencia de ese día de la semana, incluyendo hoy.
    offset = (idx - hoy.getDay() + 7) % 7;
  }
  const f = new Date(hoy.getTime() + offset * 86400000);
  return `${f.getDate()} de ${MESES[f.getMonth()]}`;
}

// El modelo a veces manda la fecha en formato ISO ("2026-07-30") aunque los cupos
// digan "miércoles 30 de julio". Se reduce ambas formas a "<dia>de<mes>" para comparar.
function normalizarFecha(t) {
  const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$/.exec(t || '');
  if (m) return normalizar(`${parseInt(m[3], 10)} de ${MESES[parseInt(m[2], 10) - 1]}`);
  return normalizar(t);
}

function mismaFecha(a, b) {
  const na = normalizarFecha(a);
  const nb = normalizarFecha(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

// El modelo a veces manda la hora en 24h ("16:00") aunque los cupos digan "4:00 p. m.".
function normalizarHora(t) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(t || '');
  if (m) {
    let h = parseInt(m[1], 10);
    const sufijo = h >= 12 ? 'pm' : 'am';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return normalizar(`${h}:${m[2]} ${sufijo}`);
  }
  return normalizar(t);
}

// Citas que bloquean su horario: confirmadas, o pendientes dentro del TTL.
function citasQueBloquean(store) {
  const ttlMs = (config.reservaTtlMinutos || 120) * 60 * 1000;
  const ahora = Date.now();
  return store.listarCitas().filter((c) => {
    if (c.estado === 'CONFIRMADA') return true;
    if (c.estado !== 'PENDIENTE_CONFIRMACION') return false;
    const creada = new Date(c.creadaEn || 0).getTime();
    return ahora - creada < ttlMs;
  });
}

// ¿Esa fecha/hora ya la tomó otra cita? El pool es compartido: bloquea igual
// una consulta médica que una reserva de campaña.
function cupoOcupado(store, fecha, hora) {
  return citasQueBloquean(store).some(
    (c) => mismaFecha(c.fecha, fecha) && normalizarHora(c.hora) === normalizarHora(hora)
  );
}

// Devuelve los cupos disponibles tal como se los debe mostrar el agente al paciente
// (ya sin fechas pasadas, sin las horas de hoy que ya pasaron y sin los horarios
// bloqueados por citas confirmadas o pendientes recientes).
// En modo AUTOMÁTICO los cupos vienen de la agenda real de Kaminar Med.
async function consultarDisponibilidad(store) {
  if (config.modoAgenda === 'automatico' && kaminar.lista()) {
    const r = await kaminar.disponibilidad(antelacionMinutos());
    return { modo: config.modoAgenda, cupos: r.cupos || [], sinCupos: Boolean(r.sinCupos) };
  }
  const cupos = (config.clinica.cuposDisponibles || [])
    .map((c) => ({
      fecha: c.fecha,
      horas: c.horas.filter((h) => !cupoYaPaso(c.fecha, h) && !cupoOcupado(store, c.fecha, h)),
    }))
    .filter((c) => c.horas.length > 0);
  return {
    modo: config.modoAgenda,
    cupos,
    sinCupos: cupos.length === 0,
  };
}

// Validación de fecha/hora contra la agenda real (modo automático). Usa el
// margen de registro (30 min), no la antelación completa de oferta.
async function cupoValidoKaminar(fecha, hora) {
  const r = await kaminar.disponibilidad(MARGEN_REGISTRO_MINUTOS);
  const dia = (r.cupos || []).find((c) => mismaFecha(c.fecha, fecha));
  if (!dia) return false;
  return dia.horas.some((h) => normalizarHora(h) === normalizarHora(hora));
}

// Verifica que la fecha/hora elegida exista en los cupos cargados, no esté ocupada
// y no sea una fecha/hora pasada. Para las horas de hoy usa el margen de registro
// (30 min), no la antelación completa de oferta: un cupo que era válido cuando se
// ofreció no debe "vencerse" mientras el paciente confirma sus datos.
function cupoValido(fecha, hora, store) {
  if (cupoYaPaso(fecha, hora, MARGEN_REGISTRO_MINUTOS)) return false;
  const cupos = config.clinica.cuposDisponibles || [];
  const dia = cupos.find((c) => mismaFecha(c.fecha, fecha));
  if (!dia) return false;
  if (!dia.horas.some((h) => normalizarHora(h) === normalizarHora(hora))) return false;
  return !cupoOcupado(store, fecha, hora);
}

// La cita PENDIENTE_CONFIRMACION de este teléfono en esa fecha/hora, si existe.
// Sirve para que solicitar_cita no rechace (ni duplique) el registro cuando el
// modelo lo reintenta: la reserva que "ocupa" el cupo es del mismo paciente.
function citaPendienteEnCupo(store, telefono, fecha, hora) {
  return store.listarCitas().find(
    (c) =>
      c.telefono === telefono &&
      c.estado === 'PENDIENTE_CONFIRMACION' &&
      mismaFecha(c.fecha, fecha) &&
      normalizarHora(c.hora) === normalizarHora(hora)
  ) || null;
}

// Clave para ordenar opciones "martes, 4 de agosto a las 4:30 p. m." de la más
// próxima a la más lejana (fecha y luego hora). Las que no se puedan
// interpretar van al final.
function claveCronologica(opcion) {
  const idx = (opcion || '').lastIndexOf(' a las ');
  const f = fechaCupo(idx === -1 ? opcion : opcion.slice(0, idx));
  const h = horaEnMinutos(idx === -1 ? '' : opcion.slice(idx + 7));
  return (f ? f.getTime() : Number.MAX_SAFE_INTEGER - 172800000) + (h === null ? 0 : h * 60000);
}

module.exports = { consultarDisponibilidad, cupoValido, cupoValidoKaminar, cupoOcupado, cupoYaPaso, resolverFechaRelativa, citaPendienteEnCupo, claveCronologica };
