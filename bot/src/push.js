// Notificaciones push (Web Push) hacia el panel PWA del administrador.
const webPush = require('web-push');
const { config } = require('./config');

let listo = false;
if (config.vapid.publicKey && config.vapid.privateKey) {
  webPush.setVapidDetails('mailto:admin@kaminar.pe', config.vapid.publicKey, config.vapid.privateKey);
  listo = true;
}

function pushListo() {
  return listo;
}

// Envía una notificación a todos los dispositivos suscritos.
// Las suscripciones muertas (404/410) se eliminan solas.
async function enviarPush(store, titulo, cuerpo, datos) {
  if (!listo) return;
  const suscripciones = store.listarSuscripcionesPush();
  const payload = JSON.stringify({ titulo, cuerpo, datos: datos || {} });
  await Promise.all(
    suscripciones.map(async (sus) => {
      try {
        await webPush.sendNotification(sus, payload);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          store.eliminarSuscripcionPush(sus.endpoint);
        } else {
          console.error('[push] Error al enviar:', err.message);
        }
      }
    })
  );
}

module.exports = { pushListo, enviarPush };
