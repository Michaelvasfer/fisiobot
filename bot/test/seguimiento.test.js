const test = require('node:test');
const assert = require('node:assert');
const { evaluar, enHorario } = require('../src/seguimiento');

const AHORA = Date.parse('2026-08-04T18:00:00.000Z'); // 13:00 en Lima
const MEDIODIA_LIMA = 13 * 60;

function cfgBase(extra) {
  return {
    activo: true,
    pasos: [
      { id: 's1', activo: true, delay: 120, mensaje: 'Paso 1' },
      { id: 's2', activo: true, delay: 1440, mensaje: 'Paso 2' },
      { id: 's3', activo: false, delay: 4320, mensaje: 'Paso 3 (inactivo)' },
    ],
    maxReintentos: 3,
    pausaNocturna: false,
    ...extra,
  };
}

function convBase(extra) {
  return {
    historial: [
      { role: 'user', content: 'quiero una cita', ts: new Date(AHORA - 5 * 3600000).toISOString() },
      { role: 'assistant', content: 'claro, ¿qué día?', ts: new Date(AHORA - 4 * 3600000).toISOString() },
    ],
    estado: 'CALIFICANDO',
    handoff: false,
    campania: null,
    ...extra,
  };
}

test('envía el paso 1 cuando el paciente lleva en silencio más que el delay', () => {
  const d = evaluar(convBase(), cfgBase(), '51999', AHORA, MEDIODIA_LIMA);
  assert.strictEqual(d.accion, 'enviar');
  assert.strictEqual(d.indice, 0);
  assert.strictEqual(d.paso.mensaje, 'Paso 1');
});

test('no envía si el silencio es menor que el delay del paso', () => {
  const conv = convBase();
  conv.historial[1].ts = new Date(AHORA - 30 * 60000).toISOString(); // 30 min de silencio
  assert.strictEqual(evaluar(conv, cfgBase(), '51999', AHORA, MEDIODIA_LIMA), null);
});

test('el segundo paso usa el silencio desde el seguimiento anterior', () => {
  const conv = convBase({
    seguimiento: { pasosEnviados: 1, ultimoEnviado: new Date(AHORA - 4 * 3600000).toISOString() },
  });
  // El último mensaje (el seguimiento) fue hace 4h: paso 2 pide 1440 min (24h) → aún no.
  assert.strictEqual(evaluar(conv, cfgBase(), '51999', AHORA, MEDIODIA_LIMA), null);
  // Si el seguimiento fue hace 25h, sí toca el paso 2.
  conv.historial[1].ts = new Date(AHORA - 25 * 3600000).toISOString();
  const d = evaluar(conv, cfgBase(), '51999', AHORA, MEDIODIA_LIMA);
  assert.strictEqual(d.accion, 'enviar');
  assert.strictEqual(d.indice, 1);
});

test('respeta maxReintentos y los pasos inactivos', () => {
  // Solo 2 pasos activos; con 2 enviados ya no hay más.
  const conv = convBase({
    seguimiento: { pasosEnviados: 2, ultimoEnviado: new Date(AHORA - 50 * 3600000).toISOString() },
  });
  conv.historial[1].ts = new Date(AHORA - 50 * 3600000).toISOString();
  assert.strictEqual(evaluar(conv, cfgBase(), '51999', AHORA, MEDIODIA_LIMA), null);
  // Con maxReintentos=1 se detiene después del primero.
  const conv1 = convBase({ seguimiento: { pasosEnviados: 1, ultimoEnviado: new Date(AHORA - 50 * 3600000).toISOString() } });
  conv1.historial[1].ts = new Date(AHORA - 50 * 3600000).toISOString();
  assert.strictEqual(evaluar(conv1, cfgBase({ maxReintentos: 1 }), '51999', AHORA, MEDIODIA_LIMA), null);
});

test('no envía si el último mensaje es del paciente', () => {
  const conv = convBase();
  conv.historial.push({ role: 'user', content: 'déjame pensarlo', ts: new Date(AHORA - 3 * 3600000).toISOString() });
  assert.strictEqual(evaluar(conv, cfgBase(), '51999', AHORA, MEDIODIA_LIMA), null);
});

test('no dispara seguimiento sobre mensajes registrados desde la fisioapp', () => {
  const conv = convBase();
  conv.historial[1].kaminar = true; // reseña anotada por la fisioapp, no es conversación del bot
  assert.strictEqual(evaluar(conv, cfgBase(), '51999', AHORA, MEDIODIA_LIMA), null);
});

test('reinicia la secuencia si el paciente respondió después del seguimiento', () => {
  const conv = convBase({
    seguimiento: { pasosEnviados: 1, ultimoEnviado: new Date(AHORA - 4 * 3600000).toISOString() },
  });
  conv.historial.push({ role: 'user', content: 'hola, sigo aquí', ts: new Date(AHORA - 3600000).toISOString() });
  const d = evaluar(conv, cfgBase(), '51999', AHORA, MEDIODIA_LIMA);
  assert.strictEqual(d.accion, 'reiniciar');
});

test('nunca envía con handoff, cita registrada/confirmada o motor apagado', () => {
  assert.strictEqual(evaluar(convBase({ handoff: true }), cfgBase(), '51999', AHORA, MEDIODIA_LIMA), null);
  assert.strictEqual(evaluar(convBase({ estado: 'CITA_SOLICITADA' }), cfgBase(), '51999', AHORA, MEDIODIA_LIMA), null);
  assert.strictEqual(evaluar(convBase({ estado: 'CITA_CONFIRMADA' }), cfgBase(), '51999', AHORA, MEDIODIA_LIMA), null);
  assert.strictEqual(evaluar(convBase({ estado: 'DERIVADO_A_RECEPCION' }), cfgBase(), '51999', AHORA, MEDIODIA_LIMA), null);
  assert.strictEqual(evaluar(convBase(), cfgBase({ activo: false }), '51999', AHORA, MEDIODIA_LIMA), null);
  assert.strictEqual(evaluar(convBase(), null, '51999', AHORA, MEDIODIA_LIMA), null);
});

test('ignora el chat de prueba y el número de recepción', () => {
  assert.strictEqual(evaluar(convBase(), cfgBase(), 'webchat-local', AHORA, MEDIODIA_LIMA), null);
});

test('pausa nocturna: fuera de horario no envía', () => {
  const cfg = cfgBase({ pausaNocturna: true, horaInicio: '08:00', horaFin: '22:00' });
  assert.strictEqual(evaluar(convBase(), cfg, '51999', AHORA, 23 * 60), null); // 11 p. m.
  const d = evaluar(convBase(), cfg, '51999', AHORA, 9 * 60); // 9 a. m.
  assert.strictEqual(d.accion, 'enviar');
});

test('enHorario valida los bordes del horario', () => {
  const cfg = { pausaNocturna: true, horaInicio: '08:00', horaFin: '22:00' };
  assert.strictEqual(enHorario(cfg, 8 * 60), true);
  assert.strictEqual(enHorario(cfg, 22 * 60), false);
  assert.strictEqual(enHorario(cfg, 7 * 60 + 59), false);
  assert.strictEqual(enHorario({ pausaNocturna: false }, 3 * 60), true);
});
