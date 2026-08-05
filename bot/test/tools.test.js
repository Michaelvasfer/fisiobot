const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { crearStore } = require('../src/store');
const tools = require('../src/tools');

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
