// Prueba del flujo de agendamiento: verifica que el bot NO muestre el formulario
// vacío y que nombre completo + DNI solo se pidan después de elegir horario.
// Uso: node scripts/prueba-flujo-cita.js
require('dotenv').config();

if (!process.env.OPENAI_API_KEY) {
  console.error('Falta OPENAI_API_KEY en .env');
  process.exit(1);
}

const fs = require('fs');
const path = require('path');
const os = require('os');
const { crearStore } = require('../src/store');
const { procesarMensaje } = require('../src/agent');

// Store temporal para no tocar data/ real.
const dirTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prueba-agente-'));
const store = crearStore(dirTmp);

const TELEFONO = '51900000001';

// Guion del paciente: reproduce el caso reportado ("Si quiero una cita").
const guion = [
  'Hola, si quiero una cita',
  'Me duele la rodilla derecha desde hace 2 meses',
  'No, no tengo estudios',
  'Sí, muéstrame los horarios',
  'La primera opción me va bien',
  'Jhakeli Huamán Torres, DNI 71234567, tengo 34 años',
  'Sí, los datos son correctos',
];

async function main() {
  for (const msg of guion) {
    console.log(`\n[Paciente] ${msg}`);
    const respuesta = await procesarMensaje(TELEFONO, msg, store);
    const burbujas = respuesta.split('|||').map((b) => b.trim()).filter(Boolean);
    for (const b of burbujas) console.log(`[Bot] ${b}`);
  }
  fs.rmSync(dirTmp, { recursive: true, force: true });
}

main().catch((err) => {
  console.error('Error en la prueba:', err);
  process.exit(1);
});
