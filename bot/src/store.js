// Persistencia simple en archivos JSON: conversaciones, citas, leads y derivaciones.
// Suficiente para un consultorio; todo queda en ./data (ignorado por git).
const fs = require('fs');
const path = require('path');

const MAX_HISTORIAL_PERSISTENCIA = 1000; // mensajes guardados por conversación (panel /admin los muestra todos)

function crearStore(directorio) {
  const dir = directorio || path.join(__dirname, '..', 'data');
  fs.mkdirSync(dir, { recursive: true });

  const archivos = {
    conversaciones: path.join(dir, 'conversaciones.json'),
    citas: path.join(dir, 'citas.json'),
    leads: path.join(dir, 'leads.json'),
    derivaciones: path.join(dir, 'derivaciones.json'),
    push: path.join(dir, 'push.json'),
    listaEspera: path.join(dir, 'lista-espera.json'),
  };

  function leer(archivo, valorInicial) {
    try {
      return JSON.parse(fs.readFileSync(archivo, 'utf8'));
    } catch {
      return valorInicial;
    }
  }

  function escribir(archivo, datos) {
    const tmp = `${archivo}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(datos, null, 2), 'utf8');
    fs.renameSync(tmp, archivo);
  }

  // --- Conversaciones: { [telefono]: { historial: [], estado, handoff, campania } }
  function obtenerConversacion(telefono) {
    const todas = leer(archivos.conversaciones, {});
    return todas[telefono] || { historial: [], estado: 'NUEVO', handoff: false, campania: null };
  }

  function guardarConversacion(telefono, conversacion) {
    const todas = leer(archivos.conversaciones, {});
    if (conversacion.historial.length > MAX_HISTORIAL_PERSISTENCIA) {
      conversacion.historial = conversacion.historial.slice(-MAX_HISTORIAL_PERSISTENCIA);
    }
    todas[telefono] = conversacion;
    escribir(archivos.conversaciones, todas);
  }

  function agregarMensaje(telefono, rol, contenido, opciones) {
    const conv = obtenerConversacion(telefono);
    conv.historial.push({ role: rol, content: contenido, ts: new Date().toISOString(), ...(opciones || {}) });
    guardarConversacion(telefono, conv);
  }

  // Lista resumida de todas las conversaciones (para el panel).
  // Incluye el nombre conocido del paciente (del lead) y si tiene una cita
  // pendiente de confirmar, para ubicarlo rápido desde el buscador del panel.
  function listarConversaciones() {
    const todas = leer(archivos.conversaciones, {});
    const leads = leer(archivos.leads, {});
    const citas = leer(archivos.citas, []);
    return Object.entries(todas)
      .map(([telefono, conv]) => {
        const ultimo = conv.historial[conv.historial.length - 1] || null;
        return {
          telefono,
          nombre: (leads[telefono] && leads[telefono].nombre) || null,
          interes: (leads[telefono] && leads[telefono].nivel_interes) || null,
          motivo: (leads[telefono] && leads[telefono].motivo) || null,
          citaPendiente: citas.some((c) => c.telefono === telefono && c.estado === 'PENDIENTE_CONFIRMACION'),
          citaConfirmada: citas.some((c) => c.telefono === telefono && c.estado === 'CONFIRMADA'),
          estado: conv.estado,
          handoff: Boolean(conv.handoff),
          campania: conv.campania || null,
          totalMensajes: conv.historial.length,
          ultimoMensaje: ultimo ? ultimo.content.slice(0, 120) : '',
          ultimoRol: ultimo ? ultimo.role : null,
          ultimaActividad: ultimo && ultimo.ts ? ultimo.ts : null,
        };
      })
      .sort((a, b) => (b.ultimaActividad || '').localeCompare(a.ultimaActividad || ''));
  }

  function establecerEstado(telefono, estado) {
    const conv = obtenerConversacion(telefono);
    conv.estado = estado;
    guardarConversacion(telefono, conv);
  }

  function establecerHandoff(telefono, activo) {
    const conv = obtenerConversacion(telefono);
    conv.handoff = activo;
    guardarConversacion(telefono, conv);
  }

  function establecerCampania(telefono, campania) {
    const conv = obtenerConversacion(telefono);
    conv.campania = campania;
    guardarConversacion(telefono, conv);
  }

  // --- Citas
  function listarCitas() {
    return leer(archivos.citas, []);
  }

  function guardarCita(cita) {
    const citas = leer(archivos.citas, []);
    const nueva = {
      id: `cita_${Date.now()}`,
      estado: 'PENDIENTE_CONFIRMACION',
      creadaEn: new Date().toISOString(),
      ...cita,
    };
    citas.push(nueva);
    escribir(archivos.citas, citas);
    return nueva;
  }

  function actualizarCita(id, cambios) {
    const citas = leer(archivos.citas, []);
    const idx = citas.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    citas[idx] = { ...citas[idx], ...cambios };
    escribir(archivos.citas, citas);
    return citas[idx];
  }

  function citaPendienteDe(telefono) {
    const citas = leer(archivos.citas, []);
    return citas.find((c) => c.telefono === telefono && c.estado === 'PENDIENTE_CONFIRMACION') || null;
  }

  // --- Leads: { [telefono]: { ...datos, actualizadoEn } }
  function guardarLead(telefono, datos) {
    const leads = leer(archivos.leads, {});
    leads[telefono] = { ...leads[telefono], ...datos, actualizadoEn: new Date().toISOString() };
    escribir(archivos.leads, leads);
    return leads[telefono];
  }

  // --- Derivaciones
  function guardarDerivacion(derivacion) {
    const derivaciones = leer(archivos.derivaciones, []);
    const nueva = { id: `der_${Date.now()}`, creadaEn: new Date().toISOString(), ...derivacion };
    derivaciones.push(nueva);
    escribir(archivos.derivaciones, derivaciones);
    return nueva;
  }

  // --- Suscripciones push del panel (lista de suscripciones Web Push) ---
  function listarSuscripcionesPush() {
    return leer(archivos.push, []);
  }

  function guardarSuscripcionPush(suscripcion) {
    const todas = leer(archivos.push, []);
    if (!todas.some((s) => s.endpoint === suscripcion.endpoint)) {
      todas.push(suscripcion);
      escribir(archivos.push, todas);
    }
    return todas.length;
  }

  function eliminarSuscripcionPush(endpoint) {
    const todas = leer(archivos.push, []).filter((s) => s.endpoint !== endpoint);
    escribir(archivos.push, todas);
  }

  // --- Lista de espera: pacientes que quieren que les avisen si se libera un cupo ---
  function listaEsperaListar() {
    return leer(archivos.listaEspera, []);
  }

  function listaEsperaAgregar(entrada) {
    const todas = leer(archivos.listaEspera, []);
    if (todas.some((e) => e.telefono === entrada.telefono)) return todas.length;
    todas.push({ ...entrada, creadaEn: new Date().toISOString() });
    escribir(archivos.listaEspera, todas);
    return todas.length;
  }

  function listaEsperaQuitar(telefono) {
    const todas = leer(archivos.listaEspera, []).filter((e) => e.telefono !== telefono);
    escribir(archivos.listaEspera, todas);
  }

  return {
    obtenerConversacion,
    guardarConversacion,
    agregarMensaje,
    listarConversaciones,
    establecerEstado,
    establecerHandoff,
    establecerCampania,
    guardarCita,
    listarCitas,
    actualizarCita,
    citaPendienteDe,
    guardarLead,
    guardarDerivacion,
    listarSuscripcionesPush,
    guardarSuscripcionPush,
    eliminarSuscripcionPush,
    listaEsperaListar,
    listaEsperaAgregar,
    listaEsperaQuitar,
  };
}

module.exports = { crearStore };
