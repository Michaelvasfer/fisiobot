const test = require('node:test');
const { before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { crearStore } = require('../src/store');
const { config } = require('../src/config');
const agenda = require('../src/agenda');

// Los tests de cupos manuales corren sin plantilla semanal (los tests de
// plantilla la configuran explícitamente al final del archivo).
let agendaOriginal;
before(() => { agendaOriginal = config.clinica.agenda; config.clinica.agenda = undefined; });
after(() => { config.clinica.agenda = agendaOriginal; });




const MESES_T = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_T = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

// Próxima ocurrencia FUTURA de un día de la semana (1=lunes ... 6=sábado).
// Siempre al menos 1 día adelante para que cupoYaPaso no lo filtre.
function proximoDia(dowObjetivo) {
  const hoy = new Date();
  let delta = (dowObjetivo - hoy.getDay() + 7) % 7;
  if (delta === 0) delta = 7;
  const f = new Date(hoy.getTime() + delta * 86400000);
  return {
    fecha: f,
    texto: `${DIAS_T[f.getDay()]} ${f.getDate()} de ${MESES_T[f.getMonth()]}`,
    iso: `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`,
  };
}

function textoDeFecha(f) {
  return `${DIAS_T[f.getDay()]} ${f.getDate()} de ${MESES_T[f.getMonth()]}`;
}

function storeTemporal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenda-test-'));
  return crearStore(dir);
}

// Fija unos cupos conocidos durante el test y devuelve una función para restaurar.
function conCuposDePrueba() {
  const LUNES = proximoDia(1);
  const MARTES = proximoDia(2);
  const originales = config.clinica.cuposDisponibles;
  config.clinica.cuposDisponibles = [
    { fecha: LUNES.texto, horas: ['4:00 p. m.', '5:00 p. m.'] },
    { fecha: MARTES.texto, horas: ['6:00 p. m.'] },
  ];
  return { restaurar: () => { config.clinica.cuposDisponibles = originales; }, LUNES, MARTES };
}

function citaDePrueba(extra) {
  return {
    telefono: '51999000111',
    nombre: 'Paciente Prueba',
    dni: '12345678',
    motivo: 'dolor de rodilla',
    fecha: proximoDia(1).texto,
    hora: '4:00 p. m.',
    tipoAtencion: 'CONSULTA_MEDICA',
    ...extra,
  };
}

test('una cita pendiente reciente bloquea su horario y libera los demás', async () => {
  const { restaurar, LUNES } = conCuposDePrueba();
  try {
    const store = storeTemporal();
    store.guardarCita(citaDePrueba());

    const disp = await agenda.consultarDisponibilidad(store);
    const lunes = disp.cupos.find((c) => c.fecha === LUNES.texto);
    assert.deepStrictEqual(lunes.horas, ['5:00 p. m.']);
    assert.ok(disp.cupos.some((c) => c.fecha === proximoDia(2).texto));
    assert.strictEqual(agenda.cupoValido(LUNES.texto, '4:00 p. m.', store), false);
    assert.strictEqual(agenda.cupoValido(LUNES.texto, '5:00 p. m.', store), true);
  } finally {
    restaurar();
  }
});

test('el horario se libera si la cita pendiente supera el TTL sin confirmarse', async () => {
  const { restaurar, LUNES } = conCuposDePrueba();
  try {
    const store = storeTemporal();
    const cita = store.guardarCita(citaDePrueba());
    // Simula que la solicitud se hizo hace 3 horas (TTL por defecto: 120 min).
    store.actualizarCita(cita.id, { creadaEn: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() });

    const disp = await agenda.consultarDisponibilidad(store);
    const lunes = disp.cupos.find((c) => c.fecha === LUNES.texto);
    assert.deepStrictEqual(lunes.horas, ['4:00 p. m.', '5:00 p. m.']);
    assert.strictEqual(agenda.cupoValido(LUNES.texto, '4:00 p. m.', store), true);
  } finally {
    restaurar();
  }
});

test('una cita confirmada bloquea su horario sin importar el tiempo', async () => {
  const { restaurar, LUNES } = conCuposDePrueba();
  try {
    const store = storeTemporal();
    const cita = store.guardarCita(citaDePrueba());
    store.actualizarCita(cita.id, {
      estado: 'CONFIRMADA',
      creadaEn: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    });

    assert.strictEqual(agenda.cupoValido(LUNES.texto, '4:00 p. m.', store), false);
  } finally {
    restaurar();
  }
});

test('una cita de campaña bloquea el pool compartido igual que una consulta', async () => {
  const { restaurar, LUNES } = conCuposDePrueba();
  try {
    const store = storeTemporal();
    store.guardarCita(citaDePrueba({ tipoAtencion: 'CAMPAÑA_MEDICA', campania: 'Plasma rico en plaquetas' }));

    // El pool es único: la reserva de campaña bloquea la hora para todos.
    assert.strictEqual(agenda.cupoValido(LUNES.texto, '4:00 p. m.', store), false);
    assert.strictEqual(agenda.cupoOcupado(store, LUNES.texto, '4:00 p. m.'), true);
    const disp = await agenda.consultarDisponibilidad(store);
    const lunes = disp.cupos.find((c) => c.fecha === LUNES.texto);
    assert.deepStrictEqual(lunes.horas, ['5:00 p. m.']);
  } finally {
    restaurar();
  }
});

test('cupoValido acepta fecha ISO y hora en formato 24h', () => {
  const { restaurar, LUNES, MARTES } = conCuposDePrueba();
  try {
    const store = storeTemporal();
    assert.strictEqual(agenda.cupoValido(LUNES.iso, '16:00', store), true);
    assert.strictEqual(agenda.cupoValido(MARTES.iso, '18:00', store), true);
    assert.strictEqual(agenda.cupoValido(MARTES.iso, '16:00', store), false); // hora que no existe ese día
    assert.strictEqual(agenda.cupoValido(proximoDia(3).iso, '16:00', store), false); // fecha sin cupos
  } finally {
    restaurar();
  }
});

test('cupoOcupado reconoce la reserva aunque se consulte en otro formato', () => {
  const { restaurar, LUNES } = conCuposDePrueba();
  try {
    const store = storeTemporal();
    store.guardarCita(citaDePrueba()); // lunes, 4:00 p. m.
    assert.strictEqual(agenda.cupoOcupado(store, LUNES.iso, '16:00'), true);
    assert.strictEqual(agenda.cupoValido(LUNES.iso, '16:00', store), false);
  } finally {
    restaurar();
  }
});

test('no ofrece cupos de fechas pasadas', async () => {
  const originales = config.clinica.cuposDisponibles;
  const ayer = new Date(Date.now() - 86400000);
  const FUTURO = proximoDia(1);
  config.clinica.cuposDisponibles = [
    { fecha: textoDeFecha(ayer), horas: ['9:00 a. m.', '10:00 a. m.'] },
    { fecha: FUTURO.texto, horas: ['9:00 a. m.'] },
  ];
  try {
    const store = storeTemporal();
    const disp = await agenda.consultarDisponibilidad(store);
    assert.strictEqual(disp.cupos.length, 1);
    assert.strictEqual(disp.cupos[0].fecha, FUTURO.texto);
    // Tampoco se puede registrar una cita en una fecha pasada.
    assert.strictEqual(agenda.cupoValido(textoDeFecha(ayer), '9:00 a. m.', store), false);
  } finally {
    config.clinica.cuposDisponibles = originales;
  }
});

test('las horas de hoy que ya pasaron no se ofrecen', async () => {
  const originales = config.clinica.cuposDisponibles;
  const hoy = new Date();
  const textoHoy = textoDeFecha(hoy);
  // 12:00 a. m. ya pasó siempre; 11:59 p. m. casi siempre sigue futura.
  config.clinica.cuposDisponibles = [{ fecha: textoHoy, horas: ['12:00 a. m.', '11:59 p. m.'] }];
  try {
    const store = storeTemporal();
    const disp = await agenda.consultarDisponibilidad(store);
    const dia = disp.cupos.find((c) => c.fecha === textoHoy);
    assert.ok(!dia || !dia.horas.includes('12:00 a. m.'));
    assert.strictEqual(agenda.cupoValido(textoHoy, '12:00 a. m.', store), false);
  } finally {
    config.clinica.cuposDisponibles = originales;
  }
});

test('resolverFechaRelativa convierte "mañana" y días de la semana a fechas concretas', () => {
  const f1 = new Date(Date.now() + 86400000);
  assert.strictEqual(agenda.resolverFechaRelativa('mañana'), `${f1.getDate()} de ${MESES_T[f1.getMonth()]}`);
  const f2 = new Date(Date.now() + 2 * 86400000);
  assert.strictEqual(agenda.resolverFechaRelativa('pasado mañana'), `${f2.getDate()} de ${MESES_T[f2.getMonth()]}`);

  // "el viernes" → próxima ocurrencia del viernes (incluyendo hoy si hoy es viernes).
  const hoy = new Date();
  const offsetV = (5 - hoy.getDay() + 7) % 7;
  const fv = new Date(hoy.getTime() + offsetV * 86400000);
  assert.strictEqual(agenda.resolverFechaRelativa('el viernes'), `${fv.getDate()} de ${MESES_T[fv.getMonth()]}`);

  // Una fecha literal no es relativa: no se toca.
  assert.strictEqual(agenda.resolverFechaRelativa('4 de agosto'), null);
});

// Fecha/hora actual en la zona del consultorio, como Date local (para construir cupos de "hoy").
function ahoraLima() {
  const partes = new Intl.DateTimeFormat('es-PE', {
    timeZone: (config.clinica.identidad && config.clinica.identidad.zonaHoraria) || 'America/Lima',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parseInt((partes.find((p) => p.type === t) || {}).value || '0', 10);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
}

function horaTexto(f) {
  let h = f.getHours();
  const suf = h >= 12 ? 'p. m.' : 'a. m.';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${String(f.getMinutes()).padStart(2, '0')} ${suf}`;
}

test('un cupo de hoy dentro de la antelación de oferta pero a más de 30 min sí se puede registrar', async () => {
  const ahora = ahoraLima();
  const en60 = new Date(ahora.getTime() + 60 * 60000);
  const fecha = textoDeFecha(en60);
  const hora = horaTexto(en60);
  const originales = config.clinica.cuposDisponibles;
  config.clinica.cuposDisponibles = [{ fecha, horas: [hora] }];
  try {
    const store = storeTemporal();
    // Si el cupo sigue siendo de hoy: no se ofrece (está dentro de los 120 min de
    // antelación) pero solicitar_cita debe aceptarlo (margen de registro: 30 min).
    if (textoDeFecha(ahora) === fecha) {
      const disp = await agenda.consultarDisponibilidad(store);
      const dia = disp.cupos.find((c) => c.fecha === fecha);
      assert.ok(!dia || !dia.horas.includes(hora));
    }
    assert.strictEqual(agenda.cupoValido(fecha, hora, store), true);
  } finally {
    config.clinica.cuposDisponibles = originales;
  }
});

test('un cupo de hoy que empieza en menos de 30 min no se puede registrar', () => {
  const ahora = ahoraLima();
  const en15 = new Date(ahora.getTime() + 15 * 60000);
  if (textoDeFecha(ahora) !== textoDeFecha(en15)) return; // cruzó medianoche: no aplica
  const fecha = textoDeFecha(en15);
  const hora = horaTexto(en15);
  const originales = config.clinica.cuposDisponibles;
  config.clinica.cuposDisponibles = [{ fecha, horas: [hora] }];
  try {
    const store = storeTemporal();
    assert.strictEqual(agenda.cupoValido(fecha, hora, store), false);
  } finally {
    config.clinica.cuposDisponibles = originales;
  }
});

test('claveCronologica ordena por fecha y luego por hora (día cercano en la tarde antes que día lejano de mañana)', () => {
  const d1 = new Date(Date.now() + 86400000);
  const d2 = new Date(Date.now() + 2 * 86400000);
  const cercanoTarde = `${textoDeFecha(d1)} a las 4:30 p. m.`;
  const lejanoManana = `${textoDeFecha(d2)} a las 9:00 a. m.`;
  assert.ok(agenda.claveCronologica(cercanoTarde) < agenda.claveCronologica(lejanoManana));
  // Mismo día: la hora manda.
  const cercanoManana = `${textoDeFecha(d1)} a las 9:00 a. m.`;
  assert.ok(agenda.claveCronologica(cercanoManana) < agenda.claveCronologica(cercanoTarde));
  // Texto irreconocible va al final.
  assert.ok(agenda.claveCronologica('texto sin fecha') > agenda.claveCronologica(cercanoTarde));
});

test('citaPendienteEnCupo reconoce la reserva pendiente del mismo paciente', () => {
  const { restaurar, LUNES } = conCuposDePrueba();
  try {
    const store = storeTemporal();
    const cita = store.guardarCita(citaDePrueba()); // lunes 4:00 p. m., teléfono 51999000111
    // La encuentra aunque se consulte en otro formato (ISO / 24h).
    assert.strictEqual(agenda.citaPendienteEnCupo(store, '51999000111', LUNES.iso, '16:00').id, cita.id);
    // Otro cupo u otro teléfono: no.
    assert.strictEqual(agenda.citaPendienteEnCupo(store, '51999000111', LUNES.texto, '5:00 p. m.'), null);
    assert.strictEqual(agenda.citaPendienteEnCupo(store, '51900000000', LUNES.texto, '4:00 p. m.'), null);
    // Una vez confirmada, ya no es "pendiente".
    store.actualizarCita(cita.id, { estado: 'CONFIRMADA' });
    assert.strictEqual(agenda.citaPendienteEnCupo(store, '51999000111', LUNES.texto, '4:00 p. m.'), null);
  } finally {
    restaurar();
  }
});

// ─── Plantilla semanal del centro de fisioterapia ───

function conPlantillaDePrueba(extra) {
  const originales = { agenda: config.clinica.agenda };
  config.clinica.agenda = {
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    bloques: [{ inicio: '08:00', fin: '13:00' }],
    duracionSesionMin: 60,
    intervaloTurnoMin: 30,
    capacidadParalela: 4,
    diasAdelante: 3,
    ...extra,
  };
  return () => { config.clinica.agenda = originales.agenda; };
}

test('la plantilla genera turnos cada 30 min respetando la duración de sesión', async () => {
  const restaurar = conPlantillaDePrueba();
  try {
    const store = storeTemporal();
    const disp = await agenda.consultarDisponibilidad(store);
    assert.ok(disp.cupos.length > 0);
    const horas = disp.cupos[0].horas;
    // Último turno del bloque 08:00-13:00 con sesión de 60 min: 12:00 p. m.
    assert.ok(horas.includes('12:00 p. m.'));
    assert.ok(!horas.includes('12:30 p. m.'));
    // Turnos consecutivos de 30 min
    const i = horas.indexOf('8:00 a. m.');
    if (i !== -1) assert.ok(horas[i + 1] === '8:30 a. m.');
  } finally {
    restaurar();
  }
});

test('capacidad 4: el turno se llena solo con 4 sesiones traslapadas', async () => {
  const restaurar = conPlantillaDePrueba();
  try {
    const store = storeTemporal();
    const disp1 = await agenda.consultarDisponibilidad(store);
    const dia = disp1.cupos[0];
    const hora = dia.horas.find((h) => h.includes('9:00')) || dia.horas[0];

    // Con 3 reservas en el mismo turno sigue libre.
    for (let i = 0; i < 3; i++) {
      store.guardarCita(citaDePrueba({ fecha: dia.fecha, hora, telefono: `5190000000${i}` }));
    }
    assert.strictEqual(agenda.cupoValido(dia.fecha, hora, store), true);

    // Con la 4.ª se llena.
    store.guardarCita(citaDePrueba({ fecha: dia.fecha, hora, telefono: '51900000003' }));
    assert.strictEqual(agenda.cupoValido(dia.fecha, hora, store), false);

    // Un turno 60 min después NO traslapa y sigue libre.
    const [h12] = hora.split(':');
    const horaMas60 = `${parseInt(h12, 10) + 1}:${hora.split(':')[1]}`;
    assert.strictEqual(agenda.cupoValido(dia.fecha, horaMas60, store), true);
  } finally {
    restaurar();
  }
});

test('sesiones traslapadas cuentan para la capacidad (30 min sí, 60 min no)', async () => {
  const restaurar = conPlantillaDePrueba({ capacidadParalela: 1 });
  try {
    const store = storeTemporal();
    const disp1 = await agenda.consultarDisponibilidad(store);
    const dia = disp1.cupos[0];
    const idx = dia.horas.findIndex((h) => h.includes('9:00'));
    const hora = idx === -1 ? dia.horas[0] : dia.horas[idx];
    store.guardarCita(citaDePrueba({ fecha: dia.fecha, hora }));
    // El turno de 30 min después traslapa con la sesión de 60 min → lleno.
    const horaSiguiente = dia.horas[idx + 1];
    if (horaSiguiente) assert.strictEqual(agenda.cupoValido(dia.fecha, horaSiguiente, store), false);
  } finally {
    restaurar();
  }
});

test('un día cerrado no se ofrece ni se puede reservar', async () => {
  const restaurar = conPlantillaDePrueba();
  try {
    const store = storeTemporal();
    const disp1 = await agenda.consultarDisponibilidad(store);
    const dia = disp1.cupos[0];
    // Cerrar ese día y re-consultar.
    config.clinica.agenda.diasCerrados = [dia.fecha];
    const disp2 = await agenda.consultarDisponibilidad(store);
    assert.ok(!disp2.cupos.some((c) => c.fecha === dia.fecha));
    assert.strictEqual(agenda.cupoValido(dia.fecha, dia.horas[0], store), false);
  } finally {
    restaurar();
  }
});
