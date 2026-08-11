const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { crearStore } = require('../src/store');
const tools = require('../src/tools');
const agenda = require('../src/agenda');
const { config } = require('../src/config');

function storeTemporal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tools-test-'));
  return crearStore(dir);
}

test('solicitar_cita rechaza datos con corchetes de plantilla sin registrar nada', async () => {
  const store = storeTemporal();
  const resultado = JSON.parse(await tools.ejecutar('solicitar_cita', {
    nombre: 'Michael', dni: '44681550', motivo: 'Consulta general',
    fecha: '[fecha]', hora: '[hora]', tipo_atencion: 'CONSULTA_MEDICA',
  }, { telefono: '51999000111', store }));

  assert.strictEqual(resultado.exito, false);
  assert.match(resultado.error, /corchetes de plantilla/);
  // No se creó ninguna cita.
  assert.strictEqual(store.listarCitas().length, 0);
});

test('solicitar_cita rechaza un DNI que no tiene 8 dígitos y se lo hace notar', async () => {
  const store = storeTemporal();
  for (const dni of ['738120333', '7381234']) {
    const resultado = JSON.parse(await tools.ejecutar('solicitar_cita', {
      nombre: 'Jhakeli Chamán Guevara', dni, motivo: 'Dolor de espalda',
      fecha: 'miércoles 12 de agosto', hora: '3:00 p. m.', tipo_atencion: 'CONSULTA_MEDICA',
    }, { telefono: '51999000333', store }));
    assert.strictEqual(resultado.exito, false);
    assert.match(resultado.error, /exactamente 8/);
    assert.match(resultado.error, /verifique/);
  }
  assert.strictEqual(store.listarCitas().length, 0);
});

// Regresión: el modelo usaba el DNI viejo de 9 dígitos aunque el paciente ya
// había enviado la corrección de 8. El rechazo debe señalarle el candidato.
test('al rechazar el DNI largo, solicitar_cita sugiere el número de 8 dígitos ya enviado', async () => {
  const store = storeTemporal();
  const tel = '51999000444';
  store.agregarMensaje(tel, 'user', 'Mi DNI es 738120333');
  store.agregarMensaje(tel, 'assistant', 'Su DNI tiene un dígito de más, ¿puede verificarlo?');
  store.agregarMensaje(tel, 'user', '73812033');

  const resultado = JSON.parse(await tools.ejecutar('solicitar_cita', {
    nombre: 'Jhakeli Chamán Guevara', dni: '738120333', motivo: 'Dolor de espalda',
    fecha: 'miércoles 12 de agosto', hora: '3:00 p. m.', tipo_atencion: 'CONSULTA_MEDICA',
  }, { telefono: tel, store }));

  assert.strictEqual(resultado.exito, false);
  assert.match(resultado.error, /73812033/);
  assert.match(resultado.error, /sin pedírselo otra vez/);
  assert.strictEqual(store.listarCitas().length, 0);
});

// ─── registrar_lead como memoria permanente ───
// Regresión: el bot olvidaba nombre/DNI en conversaciones largas porque el lead
// no aceptaba dni y una llamada parcial (sin nombre) borraba el nombre guardado.

test('registrar_lead guarda el DNI y una actualización parcial no borra datos previos', async () => {
  const store = storeTemporal();
  const tel = '51999000222';

  await tools.ejecutar('registrar_lead', { nombre: 'María Rosa Quito', motivo: 'Hernia discal', nivel_interes: 'INTERES_MEDIO' }, { telefono: tel, store });
  await tools.ejecutar('registrar_lead', { dni: '48430255', motivo: 'Hernia discal', nivel_interes: 'INTERES_ALTO' }, { telefono: tel, store });

  const lead = store.obtenerLead(tel);
  assert.strictEqual(lead.nombre, 'María Rosa Quito');
  assert.strictEqual(lead.dni, '48430255');
  assert.strictEqual(lead.nivel_interes, 'INTERES_ALTO');
});

// ─── consultar_disponibilidad con fecha + hora exactas ───
// Regresión: el paciente pide "mañana a las 11" y el modelo solo veía las 2
// primeras horas del día, concluyendo mal que ese horario no existía.

function conPlantillaDePrueba() {
  const original = config.clinica.agenda;
  config.clinica.agenda = {
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    bloques: [{ inicio: '08:00', fin: '13:00' }],
    duracionSesionMin: 60,
    intervaloTurnoMin: 30,
    capacidadParalela: 4,
    diasAdelante: 3,
  };
  return () => { config.clinica.agenda = original; };
}

test('consultar_disponibilidad con fecha y hora confirma el cupo exacto libre', async () => {
  const restaurar = conPlantillaDePrueba();
  try {
    const store = storeTemporal();
    const disp = await agenda.consultarDisponibilidad(store);
    const dia = disp.cupos[disp.cupos.length - 1];
    const hora = dia.horas.includes('10:00 a. m.') ? '10:00 a. m.' : dia.horas[0];

    const r = JSON.parse(await tools.ejecutar('consultar_disponibilidad', {
      fecha: dia.fecha, hora,
    }, { telefono: '51999000111', store }));

    assert.strictEqual(r.disponible, true);
    assert.strictEqual(r.cupo_pedido, `${dia.fecha} a las ${hora}`);
    assert.match(r.mensaje, /SÍ está disponible/);
  } finally {
    restaurar();
  }
});

test('consultar_disponibilidad con fecha y hora avisa cuando el cupo exacto está lleno', async () => {
  const restaurar = conPlantillaDePrueba();
  try {
    const store = storeTemporal();
    const disp = await agenda.consultarDisponibilidad(store);
    const dia = disp.cupos[disp.cupos.length - 1];
    const hora = dia.horas.includes('10:00 a. m.') ? '10:00 a. m.' : dia.horas[0];

    // Llenar el turno hasta la capacidad (4 sesiones traslapadas).
    for (let i = 0; i < 4; i++) {
      store.guardarCita({
        telefono: `5190000000${i}`, nombre: 'Prueba', dni: '00000000',
        motivo: 'Test', fecha: dia.fecha, hora, tipoAtencion: 'CONSULTA_MEDICA',
      });
    }

    const r = JSON.parse(await tools.ejecutar('consultar_disponibilidad', {
      fecha: dia.fecha, hora,
    }, { telefono: '51999000111', store }));

    assert.strictEqual(r.cupo_pedido_ocupado, true);
    assert.ok(Array.isArray(r.alternativas) && r.alternativas.length > 0);
    assert.match(r.mensaje, /NO está disponible/);
  } finally {
    restaurar();
  }
});

// Regresión: en modo manual ni el registro ni el anti-duplicado deben decir
// "confirmada"; y el anti-duplicado no debe crear una segunda cita.
test('solicitar_cita no duplica la solicitud pendiente del mismo paciente y cupo', async () => {
  const restaurar = conPlantillaDePrueba();
  try {
    const store = storeTemporal();
    const disp = await agenda.consultarDisponibilidad(store);
    const dia = disp.cupos[0];
    const hora = dia.horas[0];
    const args = {
      nombre: 'Michael Vásquez', dni: '44681550', motivo: 'Test',
      fecha: dia.fecha, hora, tipo_atencion: 'CONSULTA_MEDICA',
    };
    const ctx = { telefono: '51999000666', store };

    const primero = JSON.parse(await tools.ejecutar('solicitar_cita', args, ctx));
    assert.strictEqual(primero.exito, true);
    assert.match(primero.mensaje, /recepción le confirmará/);

    const segundo = JSON.parse(await tools.ejecutar('solicitar_cita', args, ctx));
    assert.strictEqual(segundo.exito, true);
    assert.match(segundo.mensaje, /No la dupliques/);
    assert.strictEqual(store.listarCitas().length, 1);
  } finally {
    restaurar();
  }
});

// Regresión: el paciente pidió "para mañana" y el bot dijo "para mañana no
// tengo disponibilidad" mientras ofrecía cupos de mañana. Cuando la fecha
// pedida SÍ tiene cupos, la herramienta debe afirmarlo explícitamente.
test('consultar_disponibilidad afirma cuando la fecha pedida SÍ tiene cupos', async () => {
  const restaurar = conPlantillaDePrueba();
  try {
    const store = storeTemporal();
    const r = JSON.parse(await tools.ejecutar('consultar_disponibilidad', {
      fecha: 'mañana',
    }, { telefono: '51999000555', store }));

    assert.strictEqual(r.disponible, true);
    assert.ok(r.fecha_pedida_con_cupos, 'debe afirmar que la fecha pedida tiene cupos');
    assert.match(r.fecha_pedida_con_cupos, /SÍ corresponden al día que pidió/);
    assert.ok(!r.aviso_fecha_pedida, 'no debe mezclar el aviso de día sin cupos');
  } finally {
    restaurar();
  }
});
