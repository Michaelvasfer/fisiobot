// Carga y valida la configuración del entorno y del consultorio.
const path = require('path');
// Carga bot/.env con ruta absoluta: PM2/systemd pueden arrancar el proceso
// con otro directorio de trabajo y dotenv buscaría el .env en ese cwd.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');

// En tests (NODE_TEST_CONTEXT lo define `node --test`) se usa una config fija:
// la real (bot/config/clinica.json) está gitignored y en el servidor tiene los
// datos del consultorio, lo que haría fallar los tests en el deploy.
const esTest = !!process.env.NODE_TEST_CONTEXT;
const clinicaPath = esTest
  ? path.join(__dirname, '..', 'test', 'fixtures', 'clinica.test.json')
  : path.join(__dirname, '..', 'config', 'clinica.json');
const clinica = JSON.parse(fs.readFileSync(clinicaPath, 'utf8'));

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    verifyToken: process.env.WEBHOOK_VERIFY_TOKEN || '',
    graphVersion: 'v21.0',
  },
  recepcionWhatsapp: process.env.RECEPCION_WHATSAPP || '',
  // Agenda real (Kaminar Med). Con MODO_AGENDA=automatico el bot consulta y
  // registra citas ahí en vez de usar los cupos manuales de clinica.json.
  kaminar: {
    url: process.env.KAMINAR_API_URL || '',
    token: process.env.KAMINAR_API_TOKEN || '',
  },
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
  },
  // Contraseña del panel de administración (/admin). Si está vacía, el panel queda deshabilitado.
  adminPassword: process.env.ADMIN_PASSWORD || '',
  // En tests se fuerza 'manual': el .env del servidor usa 'automatico' y los
  // tests del prompt esperan el texto del modo manual.
  modoAgenda: esTest ? 'manual' : (process.env.MODO_AGENDA === 'automatico' ? 'automatico' : 'manual'),
  // Minutos que un horario queda bloqueado por una solicitud pendiente; si recepción
  // no confirma la cita dentro de ese plazo, el cupo se libera y el bot vuelve a ofrecerlo.
  reservaTtlMinutos: parseInt(process.env.RESERVA_TTL_MINUTOS || '120', 10),
  // Minutos de antelación mínima para ofrecer una hora del día de hoy. Con 120,
  // si el paciente escribe a las 9:00 a. m. no se le ofrece nada antes de las 11:00 a. m.
  antelacionMinutos: parseInt(process.env.ANTELACION_MINUTOS || '120', 10),
  // Chat de prueba del navegador: activo en local, desactívalo en producción
  // (HABILITAR_CHAT_WEB=false) para que nadie externo hable con el agente por la web.
  habilitarChatWeb: process.env.HABILITAR_CHAT_WEB !== 'false',
  clinica,
};

// Relee config/clinica.json y actualiza el objeto en caliente (el bot usa los
// nuevos valores en el siguiente mensaje, sin reiniciar).
function recargarClinica() {
  const nueva = JSON.parse(fs.readFileSync(clinicaPath, 'utf8'));
  Object.keys(config.clinica).forEach((k) => delete config.clinica[k]);
  Object.assign(config.clinica, nueva);
  return config.clinica;
}

// Recarga en caliente: cuando el dashboard guarda clinica.json (PUT /api/config),
// el bot la retoma solo en el siguiente mensaje, sin reiniciar el proceso.
// Se omite bajo `node --test` (NODE_TEST_CONTEXT está definida): el watcher
// mantiene vivo el proceso y los tests no terminarían nunca.
if (!process.env.NODE_TEST_CONTEXT) {
  fs.watchFile(clinicaPath, { interval: 1000 }, () => {
    try {
      recargarClinica();
      console.log('[config] clinica.json recargada en caliente');
    } catch (err) {
      console.warn('[config] No se pudo recargar clinica.json:', err.message);
    }
  });
}

module.exports = { config, clinicaPath, avisarConfiguracionIncompleta, recargarClinica };

// Avisa (sin detener el servidor) de credenciales faltantes: en desarrollo el bot
// puede arrancar, pero no podrá llamar a OpenAI ni a la Cloud API hasta completarlas.
function avisarConfiguracionIncompleta() {
  const faltantes = [];
  if (!config.openai.apiKey) faltantes.push('OPENAI_API_KEY');
  if (!config.whatsapp.token) faltantes.push('WHATSAPP_TOKEN');
  if (!config.whatsapp.phoneNumberId) faltantes.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!config.whatsapp.verifyToken) faltantes.push('WEBHOOK_VERIFY_TOKEN');
  if (!config.recepcionWhatsapp) faltantes.push('RECEPCION_WHATSAPP');
  if (!config.adminPassword) faltantes.push('ADMIN_PASSWORD (panel /admin deshabilitado)');
  if (faltantes.length > 0) {
    console.warn(`[config] Variables sin definir en .env: ${faltantes.join(', ')}`);
  }
}
