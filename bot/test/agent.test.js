const test = require('node:test');
const assert = require('node:assert');
const { sinEmojis, sinPreviewCalendario } = require('../src/agent');

test('sinEmojis elimina emojis comunes del consultorio', () => {
  assert.strictEqual(sinEmojis('Hola 👋 soy el asistente'), 'Hola soy el asistente');
  assert.strictEqual(sinEmojis('📅 Miércoles 9:30 a. m.'), 'Miércoles 9:30 a. m.');
  assert.strictEqual(sinEmojis('✅ Su cita quedó confirmada'), 'Su cita quedó confirmada');
  assert.strictEqual(sinEmojis('Atendemos en Cajamarca 📍'), 'Atendemos en Cajamarca');
  assert.strictEqual(sinEmojis('Hora: 🕐 4:00 p. m.'), 'Hora: 4:00 p. m.');
  assert.strictEqual(sinEmojis('📋 Nueva solicitud de cita'), 'Nueva solicitud de cita');
  assert.strictEqual(sinEmojis('🔀 Derivada a recepción'), 'Derivada a recepción');
  assert.strictEqual(sinEmojis('🦴 caso reconstructivo'), 'caso reconstructivo');
});

test('sinEmojis conserva texto plano, números y viñetas', () => {
  assert.strictEqual(sinEmojis('• Miércoles 9:30 a. m.\n• Jueves 4:30 p. m.'), '• Miércoles 9:30 a. m.\n• Jueves 4:30 p. m.');
  assert.strictEqual(sinEmojis('Consulta: S/ 100'), 'Consulta: S/ 100');
  assert.strictEqual(sinEmojis(''), '');
  assert.strictEqual(sinEmojis(null), '');
});

test('sinPreviewCalendario evita que WhatsApp detecte fechas y horas', () => {
  const t1 = sinPreviewCalendario('Miércoles 30 de julio a las 4:00 p. m.');
  assert.ok(!t1.includes('30 de julio'));
  assert.ok(t1.includes('30\u200C de julio'));
  assert.ok(!t1.includes('4:00 p. m.'));
  assert.ok(t1.includes('4:00\u200C p. m.'));

  const t2 = sinPreviewCalendario('Tengo cupo el martes 5 de agosto a las 10:30 a. m.');
  assert.ok(t2.includes('5\u200C de agosto'));
  assert.ok(t2.includes('10:30\u200C a. m.'));
});
