const test = require('node:test');
const assert = require('node:assert');
const { esDuplicado } = require('../src/server');

test('esDuplicado detecta reentregas del mismo mensaje de Meta', () => {
  assert.strictEqual(esDuplicado('wamid.AAA'), false); // primera vez: se procesa
  assert.strictEqual(esDuplicado('wamid.AAA'), true);  // reentrega: se ignora
  assert.strictEqual(esDuplicado('wamid.BBB'), false); // otro mensaje: se procesa
  assert.strictEqual(esDuplicado(null), false);        // sin id: no bloquea
});

test('esDuplicado acota la memoria a los últimos 500 ids', () => {
  for (let i = 0; i < 600; i++) esDuplicado(`wamid.lote-${i}`);
  // El más antiguo del lote ya salió del registro; el más reciente sigue.
  assert.strictEqual(esDuplicado('wamid.lote-0'), false);
  assert.strictEqual(esDuplicado('wamid.lote-599'), true);
});
