const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { crearStore } = require('../src/store');

function storeTemporal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'store-test-'));
  return crearStore(dir);
}

test('conversación nueva inicia en estado NUEVO sin handoff', () => {
  const store = storeTemporal();
  const conv = store.obtenerConversacion('51999000111');
  assert.strictEqual(conv.estado, 'NUEVO');
  assert.strictEqual(conv.handoff, false);
  assert.deepStrictEqual(conv.historial, []);
});

test('agregarMensaje conserva el historial completo hasta el máximo de persistencia', () => {
  const store = storeTemporal();
  for (let i = 0; i < 40; i++) {
    store.agregarMensaje('51999000111', 'user', `mensaje ${i}`);
  }
  const conv = store.obtenerConversacion('51999000111');
  assert.strictEqual(conv.historial.length, 40);
  assert.strictEqual(conv.historial[0].content, 'mensaje 0');
  assert.strictEqual(conv.historial[39].content, 'mensaje 39');
});

test('estado y handoff se actualizan por teléfono', () => {
  const store = storeTemporal();
  store.establecerEstado('111', 'CITA_SOLICITADA');
  store.establecerHandoff('111', true);
  store.establecerEstado('222', 'CALIFICANDO');
  assert.strictEqual(store.obtenerConversacion('111').estado, 'CITA_SOLICITADA');
  assert.strictEqual(store.obtenerConversacion('111').handoff, true);
  assert.strictEqual(store.obtenerConversacion('222').estado, 'CALIFICANDO');
  assert.strictEqual(store.obtenerConversacion('222').handoff, false);
});

test('guardarCita crea cita pendiente y actualizarCita la confirma', () => {
  const store = storeTemporal();
  const cita = store.guardarCita({ telefono: '51999000111', nombre: 'Ana', fecha: 'viernes 1 de agosto', hora: '4:30 p. m.' });
  assert.strictEqual(cita.estado, 'PENDIENTE_CONFIRMACION');
  assert.ok(store.citaPendienteDe('51999000111'));
  store.actualizarCita(cita.id, { estado: 'CONFIRMADA' });
  assert.strictEqual(store.citaPendienteDe('51999000111'), null);
});

test('guardarLead fusiona datos sin borrar los anteriores', () => {
  const store = storeTemporal();
  store.guardarLead('51999000111', { motivo: 'dolor de rodilla', nivel_interes: 'INTERES_MEDIO' });
  store.guardarLead('51999000111', { nivel_interes: 'INTERES_ALTO' });
  // Leer el lead vía una nueva guarda que devuelve el objeto fusionado
  const lead = store.guardarLead('51999000111', {});
  assert.strictEqual(lead.motivo, 'dolor de rodilla');
  assert.strictEqual(lead.nivel_interes, 'INTERES_ALTO');
});
