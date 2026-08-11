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
