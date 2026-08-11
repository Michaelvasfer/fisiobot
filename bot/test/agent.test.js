const test = require('node:test');
const assert = require('node:assert');
const { sinEmojis, sinPreviewCalendario, necesitaVerificacionAgenda, datosRegistroConocidos, esAceptacion } = require('../src/agent');

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

// Regresión: la red de agenda obligaba a verificar el cupo incluso cuando el
// modelo ya estaba pidiendo nombre/DNI para registrar, y eso lo metía en un
// bucle ("Sí, tengo disponible... ¿me confirma su DNI?") sin registrar nunca.
test('la red de agenda no se dispara cuando el modelo está pidiendo datos de registro', () => {
  const pidiendoDatos = 'Sí, tengo disponible el miércoles, 12 de agosto a las 3:00 p. m. Para registrarla, ¿me confirma su DNI?';
  assert.strictEqual(necesitaVerificacionAgenda(pidiendoDatos, false, false), false);
  // Ofrecer horarios sin verificar sí se sigue bloqueando.
  const ofreciendo = 'Tengo estas opciones: martes a las 8:00 a. m. o a las 9:00 a. m. ¿Cuál le acomoda?';
  assert.strictEqual(necesitaVerificacionAgenda(ofreciendo, false, false), true);
  // Si ya consultó la agenda en este turno, nunca se fuerza de nuevo.
  assert.strictEqual(necesitaVerificacionAgenda(ofreciendo, true, false), false);
});

test('datosRegistroConocidos detecta nombre/DNI del lead y un DNI suelto en el mensaje', () => {
  assert.deepStrictEqual(datosRegistroConocidos({ nombre: 'Jhakeli Chamán', dni: '73812033' }, 'gracias'), ['nombre "Jhakeli Chamán"', 'DNI 73812033']);
  const soloMensaje = datosRegistroConocidos(null, '73812033');
  assert.strictEqual(soloMensaje.length, 1);
  assert.ok(soloMensaje[0].includes('73812033'));
  assert.deepStrictEqual(datosRegistroConocidos(null, 'hola quiero una cita'), []);
});

// Regresión: el paciente dijo "Agéndame" y el modelo respondió otra vez
// "¿Le gustaría agendar para esa hora?" en vez de registrar.
test('esAceptacion reconoce aceptaciones del horario y no frases neutras', () => {
  for (const t of ['Agendame', 'agéndame esa', 'Sí', 'si, está bien', 'dale', 'ok', 'Perfecto', 'me parece', 'quiero esa hora']) {
    assert.ok(esAceptacion(t), `debería ser aceptación: ${t}`);
  }
  for (const t of ['no puedo', 'a qué hora es', 'cuánto cuesta', 'gracias', '']) {
    assert.ok(!esAceptacion(t), `NO debería ser aceptación: ${t}`);
  }
});
