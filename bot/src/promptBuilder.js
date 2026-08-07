// Arma el system prompt combinando el prompt maestro con la configuración actual.
const fs = require('fs');
const path = require('path');
const { config } = require('./config');

const PLANTILLA = fs.readFileSync(path.join(__dirname, '..', 'prompts', 'system-prompt.md'), 'utf8');

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

function textoIdentidad(c) {
  const i = c.identidad;
  return [
    `* Nombre del agente: ${i.nombreAgente}`,
    `* Médico: ${i.medico}`,
    `* Especialidad: ${i.especialidad}`,
    `* Ciudad: ${i.ciudad}`,
    `* Zona horaria: ${i.zonaHoraria}`,
    `* Dirección: ${i.direccion}`,
    `* Precio de consulta: ${i.precioConsulta}`,
    `* Duración de consulta: ${i.duracionConsulta}`,
    `* Modalidad principal: ${i.modalidad}`,
    `* Consulta virtual habilitada: ${i.consultaVirtualHabilitada ? 'sí' : 'no'}`,
    `* Objetivo principal: convertir conversaciones provenientes de publicidad en citas médicas confirmadas`,
  ].join('\n');
}

function textoCupos(c) {
  if (!c.cuposDisponibles || c.cuposDisponibles.length === 0) {
    return 'No hay cupos cargados. Si el paciente quiere agendar, dile con tus palabras: "Déjeme un momento para confirmar la disponibilidad con el consultorio; en breve le respondo por este medio." y deriva a recepción.';
  }
  return 'Hay cupos cargados, pero NO están en este prompt: obténlos SIEMPRE con la herramienta consultar_disponibilidad (devuelve máximo 2 opciones por llamada). Nunca inventes horarios ni muestres listas completas.';
}

function textoModoAgenda(modo) {
  if (modo === 'automatico') {
    return 'Modo AUTOMÁTICO: consultar_disponibilidad devuelve la agenda real y solicitar_cita registra la cita directamente. Cuando solicitar_cita responde exitosamente, la sesión queda CONFIRMADA: díselo al paciente con claridad (ej. "Su sesión quedó agendada para el [fecha] a las [hora]. Le esperamos."). Recepción solo lo contactará si hay algún inconveniente con el horario.';
  }
  return [
    'Modo MANUAL: no existe agenda automática conectada.',
    '* Utiliza exclusivamente los horarios cargados en esta configuración (los devuelve consultar_disponibilidad).',
    '* Cuando el paciente elija un horario, registra la solicitud con solicitar_cita e indica que está pendiente de confirmación por recepción.',
    '* NUNCA digas "su cita está confirmada"; recepción confirmará por el mismo chat.',
    'Mensaje correspondiente: "Perfecto. Registraré su solicitud para el [fecha] a las [hora]. Recepción le confirmará la reserva por este mismo medio."',
  ].join('\n');
}

function fechaActualTexto() {
  const ahora = new Date();
  const partes = new Intl.DateTimeFormat('es-PE', {
    timeZone: config.clinica.identidad.zonaHoraria,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(ahora);
  const get = (tipo) => (partes.find((p) => p.type === tipo) || {}).value || '';
  const diaSemana = get('weekday');
  const texto = `Hoy es ${diaSemana} ${get('day')} de ${get('month')} de ${get('year')}, ${get('hour')}:${get('minute')} ${get('dayPeriod')} (hora de ${config.clinica.identidad.zonaHoraria}).`;
  // Log de diagnóstico: si el servidor tiene la fecha mal, esto se verá en los logs.
  console.log(`[promptBuilder] Fecha/hora usada en el prompt: ${texto}`);
  return texto;
}

// Estado de una campaña: usa el campo estado o, por compatibilidad, el antiguo campo activa.
function estadoDe(camp) {
  return camp.estado || (camp.activa ? 'ACTIVA' : 'SUSPENDIDA');
}

function textoCampanias(c) {
  const campanias = c.campaniasActivas || [];
  if (campanias.length === 0) {
    return 'No hay campañas activas ni registradas en este momento. Usa el flujo normal de consulta general para todos los pacientes.';
  }
  return campanias
    .map((camp) => {
      const lineas = [`### ${camp.nombre}`, `* Estado: ${estadoDe(camp)}`];
      if (camp.vigencia) lineas.push(`* Fecha de la jornada: ${camp.vigencia}`);
      if (camp.precio) lineas.push(`* Precio (todo incluido: evaluación + procedimiento): ${camp.precio}`);
      if (camp.ofertas && camp.ofertas.length) lineas.push(`* Ofertas: ${camp.ofertas.join(' | ')}`);
      if (camp.articulaciones && camp.articulaciones.length) lineas.push(`* Articulaciones autorizadas: ${camp.articulaciones.join(', ')}`);
      if (camp.instrucciones) lineas.push(`* Instrucciones: ${camp.instrucciones}`);
      return lineas.join('\n');
    })
    .join('\n\n');
}

function textoSaludo(c) {
  return c.identidad.saludo ||
    'Hola, soy el asistente del consultorio. ¿En qué parte del cuerpo presenta el problema o qué tipo de atención está buscando?';
}

function construirSystemPrompt() {
  const c = config.clinica;
  return PLANTILLA
    .replace('{{IDENTIDAD}}', textoIdentidad(c))
    .replace('{{FECHA_ACTUAL}}', fechaActualTexto())
    .replace('{{CUPOS}}', textoCupos(c))
    .replace('{{MODO_AGENDA}}', textoModoAgenda(config.modoAgenda))
    .replace('{{MEDIOS_PAGO}}', (c.mediosDePago || []).join(', '))
    .replace('{{CAMPANIAS}}', textoCampanias(c))
    .replace('{{SALUDO}}', textoSaludo(c))
    .replace(/\{\{PRECIO\}\}/g, c.identidad.precioConsulta || '');
}

module.exports = { construirSystemPrompt, textoCupos, textoModoAgenda, textoCampanias, textoSaludo, estadoDe, DIAS };
