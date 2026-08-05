// Definición y ejecución de las herramientas (function calling) del agente.
const { config } = require('./config');
const agenda = require('./agenda');
const kaminar = require('./kaminar');
const whatsapp = require('./whatsapp');
const { estadoDe } = require('./promptBuilder');

const definiciones = [
  {
    type: 'function',
    function: {
      name: 'consultar_disponibilidad',
      description:
        'Devuelve las opciones de horario para ofrecer al paciente (MÁXIMO 2 por llamada: una de mañana y otra de tarde cuando haya). Úsala SIEMPRE antes de mencionar horarios. Si el paciente rechaza las opciones ofrecidas, vuelve a llamarla pasándolas en excluir para obtener la siguiente. Para un paciente de CAMPAÑA, pasa en fecha la fecha exacta de la jornada y solo_fecha=true: solo se ofrecen horas de ese día.',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'Día o fecha que el paciente pidió (ej. "hoy", "mañana", "el viernes") o la fecha de la jornada de campaña. Si el paciente mencionó un día, DEBES pasarlo aquí siempre; se priorizan esos cupos. Solo omítelo si el paciente no mencionó ningún día.' },
          solo_fecha: { type: 'boolean', description: 'Opcional: si es true, devuelve ÚNICAMENTE cupos de la fecha indicada (úsalo con la fecha de la jornada para pacientes de campaña).' },
          excluir: { type: 'array', items: { type: 'string' }, description: 'Opciones ya ofrecidas que el paciente rechazó, copiadas tal cual las recibiste.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'solicitar_cita',
      description:
        'Registra la solicitud de cita después de que el paciente confirmó todos sus datos. Datos obligatorios del paciente: nombre y apellidos, DNI y teléfono (el teléfono se obtiene automáticamente del número que escribe: NO se lo pidas al paciente). En modo manual la cita queda pendiente de confirmación por recepción (NO confirmada). Si es una campaña, indica tipo_atencion=CAMPAÑA_MEDICA y el nombre de la campaña: se validará que la fecha sea la de la jornada y que la hora siga libre en el pool de horarios compartido.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombres y apellidos completos del paciente' },
          dni: { type: 'string', description: 'Número de DNI del paciente' },
          edad: { type: 'string', description: 'Edad del paciente SOLO si la mencionó en la conversación; es opcional, no la pidas para registrar' },
          motivo: { type: 'string', description: 'Motivo principal de consulta según la conversación; si el paciente no lo mencionó, usa "Consulta general"' },
          fecha: { type: 'string', description: 'Fecha elegida, copiada EXACTAMENTE como aparece en las opciones de consultar_disponibilidad (ej. "miércoles 30 de julio"); no la conviertas a otro formato' },
          hora: { type: 'string', description: 'Hora elegida, copiada EXACTAMENTE como aparece en las opciones de consultar_disponibilidad (ej. "4:00 p. m."); no la conviertas a otro formato' },
          tipo_atencion: { type: 'string', enum: ['CONSULTA_MEDICA', 'CAMPAÑA_MEDICA'], description: 'Tipo de atención; por defecto CONSULTA_MEDICA' },
          campania: { type: 'string', description: 'Nombre exacto de la campaña (solo si tipo_atencion es CAMPAÑA_MEDICA)' },
        },
        required: ['nombre', 'dni', 'fecha', 'hora'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'registrar_lead',
      description:
        'Registra o actualiza los datos del contacto. Úsala cuando identifiques el motivo principal y al menos un dato del paciente, y cuando cambie su nivel de interés.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string' },
          campania: { type: 'string', description: 'Campaña o anuncio de procedencia, si se conoce' },
          motivo: { type: 'string', description: 'Motivo principal de consulta' },
          ciudad: { type: 'string' },
          nivel_interes: {
            type: 'string',
            enum: ['INTERES_ALTO', 'INTERES_MEDIO', 'INTERES_BAJO', 'CASO_RECONSTRUCTIVO', 'PACIENTE_OPERADO'],
          },
          resumen: { type: 'string', description: 'Resumen breve de la conversación' },
        },
        required: ['motivo', 'nivel_interes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'anotar_lista_espera',
      description:
        'Anota al paciente en la lista de espera cuando NO hay cupos disponibles y él acepta que le avisen. En cuanto se libere un horario, el sistema le escribe automáticamente.',
      parameters: {
        type: 'object',
        properties: {
          preferencia: { type: 'string', description: 'Preferencia de día u horario si la mencionó (ej. "en la mañana", "el sábado"); opcional' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelar_cita',
      description:
        'Cancela la próxima cita del paciente cuando pide cancelarla o dice que no podrá asistir (ej. "no puedo ir", "cancélame la cita"). Para REPROGRAMAR: cancela con esta herramienta y luego ofrece horarios nuevos con consultar_disponibilidad.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'derivar_recepcion',
      description:
        'Transfiere la conversación a una persona de recepción, con el resumen del caso. Después de usarla, el agente queda en pausa para este paciente.',
      parameters: {
        type: 'object',
        properties: {
          motivo_derivacion: { type: 'string', description: 'Por qué se deriva (presupuesto, paciente operado, queja, etc.)' },
          resumen: {
            type: 'object',
            description: 'Resumen del paciente según la sección 17 del prompt',
            properties: {
              nombre: { type: 'string' },
              edad: { type: 'string' },
              ciudad: { type: 'string' },
              campania: { type: 'string' },
              motivo_principal: { type: 'string' },
              parte_cuerpo: { type: 'string' },
              tiempo_evolucion: { type: 'string' },
              diagnostico_previo: { type: 'string' },
              cirugias_anteriores: { type: 'string' },
              estudios_disponibles: { type: 'string' },
              horario_solicitado: { type: 'string' },
              nivel_interes: { type: 'string' },
              duda_pendiente: { type: 'string' },
              senales_urgencia: { type: 'string' },
            },
          },
        },
        required: ['motivo_derivacion'],
      },
    },
  },
];

// Ejecuta una herramienta y devuelve el texto-resultado que verá el modelo.
// ctx: { telefono, store }
async function ejecutar(nombre, args, ctx) {
  const { telefono, store } = ctx;
  console.log(`[tools] ${telefono} → ${nombre} ${JSON.stringify(args)}`);

  switch (nombre) {
    case 'consultar_disponibilidad': {
      store.establecerEstado(telefono, 'CONSULTANDO_DISPONIBILIDAD');
      const disp = await agenda.consultarDisponibilidad(store);
      if (disp.sinCupos) {
        return JSON.stringify({
          disponible: false,
          mensaje: 'No hay horarios disponibles en este momento. Ofrece al paciente anotarlo en la LISTA DE ESPERA con tus palabras: "En cuanto se libere un cupo, le escribo por este medio, ¿le parece?". Si acepta, usa la herramienta anotar_lista_espera. Si prefiere hablar con una persona, deriva a recepción.',
        });
      }
      // La agenda completa NO se devuelve: solo 2 opciones por llamada, para que
      // el modelo no pueda soltar la lista entera al paciente.
      const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
      const excluir = [...(args.excluir || [])].map(norm);
      // Coincidencia flexible: el modelo puede mandar la opción completa o solo la hora.
      const estaExcluida = (t) => {
        const n = norm(t);
        return excluir.some((e) => e && (n.includes(e) || e.includes(n)));
      };
      let aplanados = [];
      for (const c of disp.cupos || []) for (const h of c.horas) aplanados.push(`${c.fecha} a las ${h}`);
      // Priorizar la fecha que el paciente pidió, si la hubiera. Las fechas
      // relativas ("mañana", "el viernes") se resuelven a un día concreto primero.
      let sinCuposEnFechaPedida = null;
      if (args.fecha) {
        const relativa = agenda.resolverFechaRelativa(args.fecha);
        const buscada = norm(relativa || args.fecha);
        if (args.solo_fecha) {
          // Modo campaña: solo horas de la fecha indicada, sin rellenar con otras.
          aplanados = aplanados.filter((t) => norm(t).includes(buscada));
          if (aplanados.length === 0) {
            return JSON.stringify({
              disponible: false,
              mensaje: 'No quedan horas libres en la fecha indicada. Informa al paciente que los cupos de esa jornada se agotaron y ofrece derivarlo a recepción o anotarlo para una próxima fecha.',
            });
          }
        } else {
          const coincidentes = aplanados.filter((t) => norm(t).includes(buscada));
          if (relativa && coincidentes.length === 0) {
            // El día que pidió no tiene cupos: ofrecer los más próximos, pero
            // el modelo debe avisar que ese día no hay atención.
            sinCuposEnFechaPedida = relativa;
          } else {
            // Cuando el paciente pide una fecha concreta, se le muestran solo opciones
            // de esa fecha (hasta 2). Si no hay suficientes, se completan con otras fechas.
            aplanados = coincidentes.length >= 2
              ? coincidentes
              : [...coincidentes, ...aplanados.filter((t) => !norm(t).includes(buscada))];
          }
        }
      }
      const disponibles = aplanados.filter((t) => !estaExcluida(t));
      let sugerencia = [];
      if (args.fecha && !args.solo_fecha) {
        // Fecha concreta pedida: hasta 2 opciones de esa misma fecha.
        const relativa = agenda.resolverFechaRelativa(args.fecha);
        const buscada = norm(relativa || args.fecha);
        sugerencia = disponibles.filter((t) => norm(t).includes(buscada)).slice(0, 2);
      }
      if (sugerencia.length === 0) {
        // Sin fecha pedida o sin opciones en la fecha pedida: variedad mañana/tarde.
        const esManana = (t) => /a\. m\./i.test(t);
        const deManana = disponibles.find(esManana);
        const deTarde = disponibles.find((t) => !esManana(t));
        if (deManana) sugerencia.push(deManana);
        if (deTarde) sugerencia.push(deTarde);
        for (const t of disponibles) {
          if (sugerencia.length >= 2) break;
          if (!sugerencia.includes(t)) sugerencia.push(t);
        }
      }
      // Presentar en orden cronológico: primero la opción más próxima (hoy en la
      // tarde va antes que mañana/pasado en la mañana, aunque sean días distintos).
      sugerencia = [...sugerencia].sort((a, b) => agenda.claveCronologica(a) - agenda.claveCronologica(b));
      if (sugerencia.length === 0) {
        return JSON.stringify({
          disponible: true,
          sin_opciones_nuevas: true,
          mensaje: 'No quedan más opciones distintas de las ya ofrecidas. Si ninguna le acomoda al paciente, dile con tus palabras: "Déjeme un momento para confirmar la disponibilidad con el consultorio; en breve le respondo por este medio." y deriva a recepción con derivar_recepcion.',
        });
      }
      const cantidad = sugerencia.length;
      return JSON.stringify({
        disponible: true,
        modo: disp.modo,
        ofrece_estas_opciones: sugerencia,
        quedan_mas_opciones: disponibles.length > sugerencia.length,
        ...(sinCuposEnFechaPedida
          ? {
              aviso_fecha_pedida: `El día que pidió el paciente (${sinCuposEnFechaPedida}) NO tiene cupos. Dile claramente que ese día no hay atención y ofrece estas alternativas como las fechas más próximas disponibles; no las presentes como si fueran del día que pidió.`,
            }
          : {}),
        instruccion_presentacion:
          `Muestra EXACTAMENTE estas ${cantidad} opciones y ninguna más: ${sugerencia.join(' | ')}. Si el paciente las rechaza o pide otra hora, vuelve a llamar a esta herramienta pasando en excluir las opciones ya ofrecidas (cópialas tal cual) y propón UNA nueva con la fórmula "¿Le parece bien el <opción>?", de una en una, hasta que confirme.`,
      });
    }

    case 'solicitar_cita': {
      // El modelo a veces envía los corchetes de la plantilla ("[fecha]", "[hora]")
      // como si fueran datos reales. Rechazar con instrucción clara.
      const conPlaceholder = ['nombre', 'dni', 'fecha', 'hora'].some((k) => /[[\]]/.test(String(args[k] || '')));
      if (conPlaceholder) {
        return JSON.stringify({
          exito: false,
          error: 'Los datos contienen corchetes de plantilla (ej. "[fecha]"). No uses la plantilla literal: primero ofrece horarios reales con consultar_disponibilidad, espera a que el paciente elija uno y confirma su nombre y DNI reales.',
        });
      }
      // Sin los 3 datos del paciente (nombre, DNI, teléfono) recepción no puede agendarlo.
      // El teléfono llega solo en ctx; nombre y DNI los debe confirmar el paciente.
      if (!args.nombre || !args.dni || !String(args.dni).trim()) {
        return JSON.stringify({
          exito: false,
          error: 'Faltan datos obligatorios del paciente. Pide y confirma sus nombres y apellidos completos y su número de DNI antes de registrar (el teléfono se obtiene automáticamente, no lo pidas).',
        });
      }
      // Si este mismo paciente ya tiene una solicitud pendiente para esa fecha/hora,
      // no es un conflicto: la reserva que "ocupa" el cupo es la suya. Responder
      // éxito sin duplicar la cita (el modelo a veces reintenta el registro).
      const pendientePropia = agenda.citaPendienteEnCupo(store, telefono, args.fecha, args.hora);
      if (pendientePropia) {
        return JSON.stringify({
          exito: true,
          pendienteDeConfirmacion: true,
          mensaje: `Este paciente ya tiene una solicitud pendiente para el ${pendientePropia.fecha} a las ${pendientePropia.hora}. No la dupliques: indícale que su solicitud sigue registrada y que recepción le confirmará por este mismo medio. No digas que está confirmada.`,
        });
      }
      const esCampania = args.tipo_atencion === 'CAMPAÑA_MEDICA' && args.campania;
      // El motivo no es obligatorio: si el paciente no lo mencionó, se registra así.
      const motivo = args.motivo || 'Consulta general';

      if (esCampania) {
        // --- Reserva de campaña: valida contra la ficha y los cupos propios de la campaña ---
        const norm = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9:]/g, '');
        const campania = (config.clinica.campaniasActivas || []).find((c) => norm(c.nombre) === norm(args.campania));
        if (!campania) {
          return JSON.stringify({ exito: false, error: `No existe una campaña llamada "${args.campania}" en la configuración. No inventes sus datos; pregunta al paciente o deriva a recepción.` });
        }
        const estado = estadoDe(campania);
        if (estado !== 'ACTIVA' && estado !== 'CUPOS_LIMITADOS') {
          return JSON.stringify({ exito: false, error: `La campaña "${campania.nombre}" está en estado ${estado}; no se pueden registrar cupos. Informa el estado al paciente y ofrece la consulta habitual.` });
        }
        if (campania.vigencia && norm(campania.vigencia) !== norm(args.fecha)) {
          return JSON.stringify({ exito: false, error: `La fecha de esta campaña es ${campania.vigencia}. Ofrece únicamente esa fecha.` });
        }
        // Pool único de horarios: la hora debe existir y estar libre ese día
        // (lo bloquea igual una consulta que otra reserva de campaña).
        if (!agenda.cupoValido(args.fecha, args.hora, store)) {
          return JSON.stringify({ exito: false, error: 'Esa hora no está disponible en la jornada (puede no existir o ya haber sido reservada). Vuelve a llamar a consultar_disponibilidad con la fecha de la jornada y solo_fecha=true, y ofrece solo esas opciones.' });
        }
        const cita = store.guardarCita({
          telefono,
          nombre: args.nombre,
          dni: args.dni,
          edad: args.edad,
          motivo,
          fecha: args.fecha,
          hora: args.hora,
          tipoAtencion: 'CAMPAÑA_MEDICA',
          campania: campania.nombre,
          precio: campania.precio || config.clinica.identidad.precioConsulta,
        });
        store.establecerEstado(telefono, 'CITA_SOLICITADA');
        store.guardarLead(telefono, { nombre: args.nombre, dni: args.dni, motivo, campania: campania.nombre, nivel_interes: 'INTERES_ALTO' });
        await whatsapp.notificarRecepcion(
          [
            '*Nueva solicitud de CAMPAÑA (pendiente de confirmar)*',
            `Campaña: ${campania.nombre} (${campania.vigencia || 'fecha por confirmar'})`,
            `Paciente: ${args.nombre} (${args.edad} años)`,
            `DNI: ${args.dni}`,
            `Teléfono: ${telefono}`,
            `Motivo: ${motivo}`,
            `Hora: ${args.hora}`,
            `Precio informado: ${campania.precio || '—'}`,
            `Para confirmarla responde: #confirmar ${telefono}`,
          ].join('\n')
        );
        return JSON.stringify({
          exito: true,
          pendienteDeConfirmacion: true,
          mensaje: `Solicitud de campaña "${campania.nombre}" registrada para ${args.fecha} a las ${args.hora}. Informa al paciente que recepción le confirmará la reserva por este mismo medio. No digas que está confirmada.`,
        });
      }

      // --- Reserva de consulta médica habitual ---
      // Modo automático: la agenda real es Kaminar Med; el registro crea
      // paciente + cita ahí y se guarda una copia local con el id remoto.
      let kaminarId = null;
      if (config.modoAgenda === 'automatico' && kaminar.lista()) {
        if (!(await agenda.cupoValidoKaminar(args.fecha, args.hora))) {
          return JSON.stringify({
            exito: false,
            error: 'La fecha u hora ya no está disponible en la agenda. Vuelve a llamar a consultar_disponibilidad y ofrece solo esas opciones.',
          });
        }
        try {
          const r = await kaminar.registrar({
            nombre: args.nombre, dni: args.dni, motivo,
            fecha: args.fecha, hora: args.hora, telefono,
          });
          kaminarId = r.citaId || null;
        } catch (err) {
          return JSON.stringify({
            exito: false,
            error: `No se pudo registrar en la agenda del consultorio (${err.message}). Vuelve a consultar disponibilidad y reintenta; si persiste, deriva a recepción.`,
          });
        }
      } else if (!agenda.cupoValido(args.fecha, args.hora, store)) {
        return JSON.stringify({
          exito: false,
          error: 'La fecha u hora no coincide con un cupo libre (puede no existir o ya haber sido reservada por otro paciente). Vuelve a llamar a consultar_disponibilidad y ofrece solo esas opciones.',
        });
      }
      const cita = store.guardarCita({
        telefono,
        nombre: args.nombre,
        dni: args.dni,
        edad: args.edad,
        motivo,
        fecha: args.fecha,
        hora: args.hora,
        tipoAtencion: 'CONSULTA_MEDICA',
        precio: config.clinica.identidad.precioConsulta,
        ...(kaminarId ? { kaminarId } : {}),
      });
      store.establecerEstado(telefono, 'CITA_SOLICITADA');
      store.guardarLead(telefono, { nombre: args.nombre, dni: args.dni, motivo, nivel_interes: 'INTERES_ALTO' });
      await whatsapp.notificarRecepcion(
        [
          '*Nueva solicitud de cita (pendiente de confirmar)*',
          `Paciente: ${args.nombre} (${args.edad} años)`,
          `DNI: ${args.dni}`,
          `Teléfono: ${telefono}`,
          `Motivo: ${motivo}`,
          `Fecha: ${args.fecha}, ${args.hora}`,
          `Para confirmarla responde: #confirmar ${telefono}`,
        ].join('\n')
      );
      return JSON.stringify({
        exito: true,
        pendienteDeConfirmacion: true,
        mensaje: `Solicitud registrada para el ${args.fecha} a las ${args.hora}. Informa al paciente que recepción le confirmará la reserva por este mismo medio. No digas que la cita está confirmada.`,
      });
    }

    case 'registrar_lead': {
      store.guardarLead(telefono, {
        nombre: args.nombre,
        campania: args.campania,
        motivo: args.motivo,
        ciudad: args.ciudad,
        nivel_interes: args.nivel_interes,
        resumen: args.resumen,
      });
      if (args.campania) store.establecerCampania(telefono, args.campania);
      if (store.obtenerConversacion(telefono).estado === 'NUEVO') {
        store.establecerEstado(telefono, 'CALIFICANDO');
      }
      return JSON.stringify({ exito: true });
    }

    case 'anotar_lista_espera': {
      const conv = store.obtenerConversacion(telefono);
      const nombre = (store.listarCitas().find((c) => c.telefono === telefono) || {}).nombre || null;
      store.listaEsperaAgregar({ telefono, nombre, preferencia: args.preferencia || null, motivo: (conv.historial.slice(-6).find((m) => m.role === 'user') || {}).content || null });
      return JSON.stringify({
        exito: true,
        mensaje: 'Paciente anotado en la lista de espera. Dile con tus palabras: "Listo, le aviso por este medio en cuanto se libere un cupo." No prometas fecha.',
      });
    }

    case 'cancelar_cita': {
      if (!(config.modoAgenda === 'automatico' && kaminar.lista())) {
        return JSON.stringify({ exito: false, error: 'La cancelación automática no está disponible en este momento. Deriva a recepción.' });
      }
      try {
        const r = await kaminar.cancelarPorTelefono(telefono);
        if (!r.ok) {
          return JSON.stringify({ exito: false, error: 'No encontré una cita próxima a nombre de este paciente. Confirma sus datos o deriva a recepción.' });
        }
        const pendiente = store.citaPendienteDe(telefono);
        if (pendiente) store.actualizarCita(pendiente.id, { estado: 'CANCELADA' });
        await whatsapp.notificarRecepcion(`El paciente ${r.nombre} (${telefono}) canceló su cita del ${r.fecha} a las ${r.hora} por WhatsApp.`);
        return JSON.stringify({
          exito: true,
          mensaje: `Cita del ${r.fecha} a las ${r.hora} cancelada. Informa al paciente con tus palabras y, si quiere reprogramar, ofrece horarios con consultar_disponibilidad.`,
        });
      } catch (err) {
        return JSON.stringify({ exito: false, error: `No se pudo cancelar: ${err.message}. Deriva a recepción.` });
      }
    }

    case 'derivar_recepcion': {
      const resumen = args.resumen || {};
      store.guardarDerivacion({ telefono, motivo: args.motivo_derivacion, resumen });
      store.establecerHandoff(telefono, true);
      store.establecerEstado(telefono, 'DERIVADO_A_RECEPCION');
      const lineas = [
        '*Conversación derivada al equipo*',
        `Teléfono: ${telefono}`,
        `Motivo de derivación: ${args.motivo_derivacion}`,
        ...Object.entries(resumen)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`),
        `Para responder tú mismo al paciente: #tomar ${telefono}`,
        `Para devolver la conversación al asistente: #soltar ${telefono}`,
      ];
      await whatsapp.notificarRecepcion(lineas.join('\n'));
      return JSON.stringify({
        exito: true,
        mensaje: 'Conversación derivada a recepción. Envía al paciente un único mensaje de despedida indicando que recepción continuará la atención por este mismo chat. No sigas respondiendo después.',
      });
    }

    default:
      return JSON.stringify({ exito: false, error: `Herramienta desconocida: ${nombre}` });
  }
}

module.exports = { definiciones, ejecutar };
