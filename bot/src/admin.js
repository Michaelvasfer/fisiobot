// Panel de administración (/admin): edita config/clinica.json desde el navegador.
// Protegido con Basic Auth (ADMIN_PASSWORD). Los cambios aplican en caliente.
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { config, clinicaPath, recargarClinica } = require('./config');

const router = express.Router();

const CLAVES_REQUERIDAS = ['identidad', 'cuposDisponibles', 'mediosDePago', 'campaniasActivas'];

// --- Basic Auth: usuario "admin", contraseña ADMIN_PASSWORD ---
router.use((req, res, next) => {
  const cabecera = req.headers.authorization || '';
  const credenciales = Buffer.from(cabecera.replace(/^Basic\s+/i, ''), 'base64').toString();
  const [usuario, password] = credenciales.split(':');
  const ok =
    usuario === 'admin' &&
    password &&
    config.adminPassword &&
    crypto.timingSafeEqual(
      Buffer.from(password.padEnd(64).slice(0, 64)),
      Buffer.from(config.adminPassword.padEnd(64).slice(0, 64))
    );
  if (!ok) {
    res.set('WWW-Authenticate', 'Basic realm="Panel del consultorio"');
    return res.status(401).send('Acceso restringido');
  }
  next();
});

// --- Panel ---
router.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// --- Archivos PWA (manifest, service worker, íconos) ---
const TIPOS_PWA = { '.webmanifest': 'application/manifest+json', '.js': 'text/javascript', '.png': 'image/png' };
router.get(['/manifest.webmanifest', '/sw.js', '/pwa/:archivo'], (req, res) => {
  const archivo = req.params.archivo || req.path.split('/').pop();
  if (!/^[\w.-]+$/.test(archivo)) return res.sendStatus(400);
  const ruta = path.join(__dirname, '..', 'public', 'pwa', archivo);
  const tipo = TIPOS_PWA[path.extname(archivo)];
  if (tipo) res.type(tipo);
  if (archivo === 'sw.js') res.set('Service-Worker-Allowed', '/admin/');
  res.sendFile(ruta, (err) => { if (err) res.sendStatus(404); });
});

// --- API: leer configuración actual ---
router.get('/api/config', (_req, res) => {
  res.json(config.clinica);
});

// --- API: guardar configuración (aplica en caliente) ---
router.post('/api/config', (req, res) => {
  const nueva = req.body;
  if (!nueva || typeof nueva !== 'object' || Array.isArray(nueva)) {
    return res.status(400).json({ error: 'El cuerpo debe ser un objeto JSON.' });
  }
  const faltantes = CLAVES_REQUERIDAS.filter((k) => !(k in nueva));
  if (faltantes.length > 0) {
    return res.status(400).json({ error: `Faltan secciones requeridas: ${faltantes.join(', ')}` });
  }
  if (!Array.isArray(nueva.cuposDisponibles) || nueva.cuposDisponibles.some((c) => !c.fecha || !Array.isArray(c.horas))) {
    return res.status(400).json({ error: 'cuposDisponibles debe ser una lista de { fecha, horas: [] }.' });
  }
  try {
    // Respaldo antes de sobrescribir.
    fs.copyFileSync(clinicaPath, clinicaPath.replace(/\.json$/, '.backup.json'));
    fs.writeFileSync(clinicaPath, JSON.stringify(nueva, null, 2), 'utf8');
    recargarClinica();
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin] Error al guardar clinica.json:', err.message);
    res.status(500).json({ error: 'No se pudo guardar la configuración.' });
  }
});

module.exports = function crearRouterAdmin(store, whatsapp) {
  // --- API: notificaciones push del panel ---
  router.get('/api/push/clave-publica', (_req, res) => {
    res.json({ clave: config.vapid.publicKey || null });
  });

  router.post('/api/push/suscribir', (req, res) => {
    const sus = req.body;
    if (!sus || !sus.endpoint || !sus.keys || !sus.keys.p256dh || !sus.keys.auth) {
      return res.status(400).json({ error: 'Suscripción inválida.' });
    }
    store.guardarSuscripcionPush({ endpoint: sus.endpoint, keys: sus.keys });
    res.json({ ok: true });
  });

  router.post('/api/push/desuscribir', (req, res) => {
    if (req.body && req.body.endpoint) store.eliminarSuscripcionPush(req.body.endpoint);
    res.json({ ok: true });
  });

  // --- API: listar conversaciones (resumen) ---
  router.get('/api/conversaciones', (_req, res) => {
    res.json(store.listarConversaciones());
  });

  // --- API: ver una conversación completa ---
  router.get('/api/conversaciones/:telefono', (req, res) => {
    res.json(store.obtenerConversacion(req.params.telefono));
  });

  // --- API: pausar/reanudar el bot en una conversación ---
  router.post('/api/conversaciones/:telefono/handoff', (req, res) => {
    const activo = Boolean(req.body && req.body.activo);
    store.establecerHandoff(req.params.telefono, activo);
    store.establecerEstado(req.params.telefono, activo ? 'DERIVADO_A_RECEPCION' : 'NUEVO');
    res.json({ ok: true, handoff: activo });
  });

  // --- API: responder manualmente al paciente (intervención humana) ---
  router.post('/api/conversaciones/:telefono/mensaje', async (req, res) => {
    const texto = (req.body && req.body.texto ? String(req.body.texto) : '').trim();
    if (!texto) return res.status(400).json({ error: 'texto vacío' });
    try {
      await whatsapp.sendText(req.params.telefono, texto);
      store.agregarMensaje(req.params.telefono, 'assistant', texto, { manual: true });
      res.json({ ok: true });
    } catch (err) {
      console.error('[admin] Error al enviar mensaje manual:', err.message);
      res.status(502).json({ error: 'No se pudo enviar el mensaje por WhatsApp.' });
    }
  });

  // --- API: registrar un mensaje enviado FUERA del bot (p. ej. la solicitud
  // de reseña que la fisioapp manda directo por la Cloud API) para que se vea
  // en el chat del panel. NO envía nada por WhatsApp; solo lo anota. ---
  router.post('/api/conversaciones/:telefono/registrar', (req, res) => {
    const texto = (req.body && req.body.texto ? String(req.body.texto) : '').trim();
    if (!texto) return res.status(400).json({ error: 'texto vacío' });
    store.agregarMensaje(req.params.telefono, 'assistant', texto, { kaminar: true });
    res.json({ ok: true });
  });

  return router;
};
