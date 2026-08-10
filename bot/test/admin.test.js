const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const { config } = require('../src/config');
const { crearStore } = require('../src/store');
const crearRouterAdmin = require('../src/admin');

const AUTH = `Basic ${Buffer.from('admin:test-secret').toString('base64')}`;

// Monta el router del panel sobre un store temporal y lo sirve en un puerto
// efímero. Devuelve { base, store, cerrar }.
async function panelTemporal() {
  config.adminPassword = 'test-secret';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-test-'));
  const store = crearStore(dir);
  const app = express();
  app.use(express.json());
  app.use('/admin', crearRouterAdmin(store, { sendText: async () => {} }));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  return { base: `http://127.0.0.1:${server.address().port}/admin`, store, cerrar: () => server.close() };
}

function registrar(base, telefono, texto) {
  return fetch(`${base}/api/conversaciones/${telefono}/registrar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: AUTH },
    body: JSON.stringify({ texto }),
  }).then((r) => r.json());
}

test('la reseña anotada desde la agenda remota se registra una sola vez', async () => {
  const { base, store, cerrar } = await panelTemporal();
  try {
    const telefono = '51999000111';
    const reseña = 'Gracias por su visita. ¿Nos deja su reseña en Google? https://g.page/r/xyz';

    const primera = await registrar(base, telefono, reseña);
    assert.deepStrictEqual(primera, { ok: true });

    // La agenda remota reintenta el mismo aviso: no se duplica en el historial.
    const segunda = await registrar(base, telefono, reseña);
    assert.deepStrictEqual(segunda, { ok: true, duplicado: true });

    const historial = store.obtenerConversacion(telefono).historial;
    assert.strictEqual(historial.filter((m) => m.kaminar).length, 1);

    // Un mensaje distinto (p. ej. un recordatorio) sí se anota.
    const otra = await registrar(base, telefono, 'Le recordamos su cita de mañana a las 9:00 a. m.');
    assert.deepStrictEqual(otra, { ok: true });
    assert.strictEqual(store.obtenerConversacion(telefono).historial.filter((m) => m.kaminar).length, 2);
  } finally {
    cerrar();
  }
});
