// Definición y ejecución de las herramientas (function calling) del agente.
const { config } = require('./config');
const agenda = require('./agenda');
const fisio = require('./fisio');
const whatsapp = require('./whatsapp');
const { estadoDe } = require('./promptBuilder');

const definiciones = [
  {
    type: 'function',
    function: {
      name: 'consultar_disponibilidad',
      description:
        'Devuelve las opciones de horario para ofrecer al paciente (MÁXIMO 2 por llamada: una de mañana y otra de tarde cuando haya). Úsala SIEMPRE antes de mencionar horarios. Si el paciente pide una hora concreta (ej. "mañana a las 11"), pasa fecha y hora: la herramienta verifica ESE cupo exacto y te dice si está libre — NUNCA digas que un horario pedido no está disponible sin haberlo verificado así. Si el paciente rechaza las opciones ofrecidas, vuelve a llamarla pasándolas en excluir para obtener la siguiente. Para un paciente de CAMPAÑA, pasa en fecha la fecha exacta de la jornada y solo_fecha=true: solo se ofrecen horas de ese día.',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'Día o fecha que el paciente pidió (ej. "hoy", "mañana", "el viernes") o la fecha de la jornada de campaña. Si el paciente mencionó un día, DEBES pasarlo aquí siempre; se priorizan esos cupos. Solo omítelo si el paciente no mencionó ningún día.' },
          hora: { type: 'string', description: 'Hora concreta que el paciente pidió (ej. "11:00 a. m.", "11 am", "15:00"). DEBES pasarla junto con fecha cuando el paciente menciona una hora específica: así se verifica ese cupo exacto en vez de adivinar con las primeras horas del día.' },
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
        'Registra la solicitud de cita en cuanto el paciente eligió horario y dio sus datos (nombre y DNI suelen llegar juntos en un solo mensaje: extráelos y registra sin pedirlos de nuevo). Datos obligatorios del paciente: nombre y apellidos, DNI y teléfono (el teléfono se obtiene automáticamente del número que escribe: NO se lo pidas al paciente). En modo manual la cita queda pendiente de confirmación por recepción (NO confirmada). Si es una campaña, indica tipo_atencion=CAMPAÑA_MEDICA y el nombre de la campaña: se validará que la fecha sea la de la jornada y que la hora siga libre en el pool de horarios compartido.',
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
        'Registra o actualiza los datos del contacto. Llámala EN EL MISMO TURNO cada vez que el paciente te dé un dato personal (nombre, DNI, ciudad) o el motivo de consulta: es la memoria permanente del paciente; si no la usas, en conversaciones largas esos datos se pierden y terminarías pidiéndolos de nuevo. Úsala también cuando cambie su nivel de interés.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombres y apellidos completos, cuando el paciente los dé' },
          dni: { type: 'string', description: 'Número de DNI, cuando el paciente lo dé' },
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
      // Consulta puntual: el paciente pidió fecha Y hora ("mañana a las 11").
      // Se verifica ESE cupo exacto contra la agenda. Sin esto el modelo solo
      // veía las 2 primeras horas del día y concluía (mal) que la hora pedida
      // no existía.
      if (args.fecha && args.hora && !args.solo_fecha) {
        const relativa = agenda.resolverFechaRelativa(args.fecha);
        const fechaPedida = relativa || args.fecha;
        const valido = config.modoAgenda === 'automatico' && fisio.lista()
          ? await agenda.cupoValidoFisio(fechaPedida, args.hora)
          : agenda.cupoValido(fechaPedida, args.hora, store);
        const dia = (disp.cupos || []).find((c) => agenda.mismaFecha(c.fecha, fechaPedida));
        const horaExacta = dia && dia.horas.find(
          (h) => agenda.normalizarHora(h) === agenda.normalizarHora(args.hora)
        );
        if (valido && dia && horaExacta) {
          const cupo = `${dia.fecha} a las ${horaExacta}`;
          const alternativa = dia.horas.find(
            (h) => agenda.normalizarHora(h) !== agenda.normalizarHora(horaExacta)
          );
          return JSON.stringify({
            disponible: true,
            cupo_pedido: cupo,
            ...(alternativa ? { alternativa_mismo_dia: `${dia.fecha} a las ${alternativa}` } : {}),
            mensaje: `El horario que pidió el paciente SÍ está disponible: ${cupo}. Confírmalo directamente (ej. "Sí, tengo disponible el ${cupo}") y, si acepta, registra con solicitar_cita copiando exactamente esa fecha y hora. La alternativa es solo una opción adicional.`,
          });
        }
        if (dia && dia.horas.length > 0) {
          // El cupo exacto no está libre (lleno, fuera de bloque o ya pasó):
          // decirlo claramente y ofrecer alternativas del mismo día.
          const alternativas = dia.horas.slice(0, 2).map((h) => `${dia.fecha} a las ${h}`);
          return JSON.stringify({
            disponible: true,
            cupo_pedido_ocupado: true,
            alternativas,
            mensaje: 'El horario exacto que pidió el paciente NO está disponible. Infórmalo con tus palabras y ofrece SOLO estas alternativas del mismo día.',
          });
        }
        // Ese día no tiene ningún cupo: sigue el flujo normal (ofrece los días más próximos).
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
      let fechaPedidaConCupos = null;
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
            // El día que pidió SÍ tiene cupos: se lo decimos explícitamente al
            // modelo para que no contradiga (decía "mañana no tengo" mientras
            // ofrecía cupos de mañana).
            if (coincidentes.length > 0) fechaPedidaConCupos = relativa || args.fecha;
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
        ...(fechaPedidaConCupos
          ? {
              fecha_pedida_con_cupos: `Las opciones ofrecidas SÍ corresponden al día que pidió el paciente (${fechaPedidaConCupos}). Preséntalas como opciones de ese día; PROHIBIDO decir que ese día no hay disponibilidad.`,
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
      // El DNI peruano tiene exactamente 8 dígitos. El modelo no cuenta dígitos de
      // forma confiable, así que la validación es determinística: si llega un número
      // con otra cantidad, se rechaza y se pide al paciente que lo verifique.
      // (Solo aplica a DNI puro numérico; un carné de extranjería con letras pasa.)
      const dniTexto = String(args.dni).trim();
      if (/^\d+$/.test(dniTexto) && dniTexto.length !== 8) {
        // El modelo a veces usa un DNI viejo de la conversación aunque el paciente
        // ya envió la corrección: se busca en el historial un número de 8 dígitos
        // y se le entrega como candidato para que registre sin repreguntar.
        const historial = store.obtenerConversacion(telefono).historial || [];
        const candidatos = [...new Set(
          historial
            .filter((m) => m.role === 'user')
            .flatMap((m) => String(m.content).match(/\b\d{8}\b/g) || [])
        )].filter((d) => d !== dniTexto);
        return JSON.stringify({
          exito: false,
          error:
            `El DNI recibido ("${dniTexto}") tiene ${dniTexto.length} dígitos y el DNI peruano tiene exactamente 8. NO lo registres así.` +
            (candidatos.length > 0
              ? ` OJO: en la conversación el paciente ya envió este número de 8 dígitos: ${candidatos.join(', ')} — muy probablemente es la corrección de su DNI. Úsalo y vuelve a llamar a solicitar_cita con ese DNI de 8 dígitos, sin pedírselo otra vez.`
              : ' Hazle notar al paciente la cantidad de dígitos y pídele que verifique su DNI (puede tener un dígito de más o de menos), luego vuelve a llamar a solicitar_cita con el DNI corregido.'),
        });
      }
      // Si este mismo paciente ya tiene una solicitud pendiente para esa fecha/hora,
      // no es un conflicto: la reserva que "ocupa" el cupo es la suya. Responder
      // éxito sin duplicar la cita (el modelo a veces reintenta el registro).
      const pendientePropia = agenda.citaPendienteEnCupo(store, telefono, args.fecha, args.hora);
      if (pendientePropia) {
        const yaAgendada = pendientePropia.estado === 'CONFIRMADA' || (config.modoAgenda === 'automatico' && fisio.lista());
        return JSON.stringify({
          exito: true,
          pendienteDeConfirmacion: !yaAgendada,
          mensaje: yaAgendada
            ? `Este paciente YA tiene la sesión agendada para el ${pendientePropia.fecha} a las ${pendientePropia.hora} (quedó registrada en la agenda). No la dupliques: confírmale con claridad que su sesión quedó agendada para esa fecha y hora (ej. "Su sesión quedó agendada para el ${pendientePropia.fecha} a las ${pendientePropia.hora}. Le esperamos.").`
            : `Este paciente ya tiene una solicitud pendiente para el ${pendientePropia.fecha} a las ${pendientePropia.hora}. No la dupliques: indícale que su solicitud sigue registrada y que recepción le confirmará por este mismo medio. No digas que está confirmada.`,
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
        // Modo automático: la sesión queda CONFIRMADA de una vez; recepción recibe
      // el aviso y solo contacta al paciente si hay algún inconveniente.
      store.actualizarCita(cita.id, { estado: 'CONFIRMADA' });
      store.establecerEstado(telefono, 'CITA_CONFIRMADA');
        store.guardarLead(telefono, { nombre: args.nombre, dni: args.dni, motivo, campania: campania.nombre, nivel_interes: 'INTERES_ALTO' });
        await whatsapp.notificarRecepcion(
          [
            '*Nueva solicitud de CAMPAÑA (pendiente de confirmar)*',
            `Campaña: ${campania.nombre} (${campania.vigencia || 'fecha por confirmar'})`,
            `Paciente: ${args.nombre}`,
            `DNI: ${args.dni}`,
            `Teléfono: ${telefono}`,
            `Motivo: ${motivo}`,
            `Hora: ${args.hora}`,
            `Precio informado: ${campania.precio || '—'}`,
            'Si hay algún inconveniente con el horario, comunícate con el paciente para reagendar.',
          ].join('\n')
        );
        return JSON.stringify({
          exito: true,
          pendienteDeConfirmacion: true,
          mensaje: `Solicitud de campaña "${campania.nombre}" registrada para ${args.fecha} a las ${args.hora}. Informa al paciente que recepción le confirmará la reserva por este mismo medio. No digas que está confirmada.`,
        });
      }

      // --- Reserva de consulta médica habitual ---
      // Modo automático: la agenda real es KaminarFisio (fisio.kaminar.pe); el
      // registro crea paciente + cita ahí y se guarda una copia local con el id remoto.
      let fisioId = null;
      let codigoPaciente = null;
      let registradoEnFisio = false;
      if (config.modoAgenda === 'automatico' && fisio.lista()) {
        if (!(await agenda.cupoValidoFisio(args.fecha, args.hora))) {
          return JSON.stringify({
            exito: false,
            error: 'La fecha u hora ya no está disponible en la agenda. Vuelve a llamar a consultar_disponibilidad y ofrece solo esas opciones. Si el paciente insiste en esa hora o hay cualquier inconveniente con el horario, NO fuerces el registro: deriva la conversación a recepción con derivar_recepcion para que una persona lo reagende manualmente.',
          });
        }
        try {
          const r = await fisio.registrar({
            nombre: args.nombre, dni: args.dni, motivo,
            fecha: args.fecha, hora: args.hora, telefono,
          });
          fisioId = r.citaId || null;
          codigoPaciente = r.codigoPaciente || null;
          registradoEnFisio = true;
        } catch (err) {
          return JSON.stringify({
            exito: false,
            error: `No se pudo registrar en la agenda (${err.message}). Hay un inconveniente con el horario: deriva la conversación a recepción con derivar_recepcion para que una persona confirme y reagende manualmente. Informa al paciente que recepción le escribirá para coordinar.`,
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
        // La clave guardada se queda como "kaminarId" por compatibilidad: las
        // citas ya persistidas en data/citas.json usan ese nombre. Se refiere
        // al id de la cita en la agenda remota (hoy KaminarFisio).
        ...(fisioId ? { kaminarId: fisioId } : {}),
      });
      // Si la cita ya existe en la agenda real (modo automático), la copia local
      // queda CONFIRMADA de una vez — igual que la rama de campaña — para que el
      // panel la muestre como agendada y no como "por confirmar".
      if (registradoEnFisio) {
        store.actualizarCita(cita.id, { estado: 'CONFIRMADA' });
        store.establecerEstado(telefono, 'CITA_CONFIRMADA');
      } else {
        store.establecerEstado(telefono, 'CITA_SOLICITADA');
      }
      store.guardarLead(telefono, { nombre: args.nombre, dni: args.dni, motivo, nivel_interes: 'INTERES_ALTO' });
      await whatsapp.notificarRecepcion(
        [
          '*Nueva cita agendada por el bot*',
          `Paciente: ${args.nombre} (${args.edad} años)`,
          `DNI: ${args.dni}`,
          `Teléfono: ${telefono}`,
          `Motivo: ${motivo}`,
          `Fecha: ${args.fecha}, ${args.hora}`,
          `Para confirmarla responde: #confirmar ${telefono}`,
        ].join('\n')
      );
      const esAutomatico = config.modoAgenda === 'automatico' && fisio.lista();
      return JSON.stringify({
        exito: true,
        pendienteDeConfirmacion: !esAutomatico,
        mensaje: esAutomatico
          ? `Sesión agendada y confirmada para el ${args.fecha} a las ${args.hora}. Informa al paciente que su sesión quedó CONFIRMADA (ej: "Su sesión quedó agendada para el ${args.fecha} a las ${args.hora}. Le esperamos.").`
          : `Solicitud registrada para el ${args.fecha} a las ${args.hora}. Modo manual: la cita NO está confirmada todavía. Informa al paciente que su solicitud quedó registrada y que recepción le confirmará la reserva por este mismo medio; no digas que está confirmada.`,
      });
    }

    case 'registrar_lead': {
      // Solo campos definidos: pasar undefined borraría del JSON el dato ya guardado
      // (p. ej. una llamada sin nombre eliminaría el nombre registrado antes).
      const campos = ['nombre', 'dni', 'campania', 'motivo', 'ciudad', 'nivel_interes', 'resumen'];
      const datos = Object.fromEntries(campos.filter((k) => args[k] !== undefined).map((k) => [k, args[k]]));
      store.guardarLead(telefono, datos);
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
      if (!(config.modoAgenda === 'automatico' && fisio.lista())) {
        return JSON.stringify({ exito: false, error: 'La cancelación automática no está disponible en este momento. Deriva a recepción.' });
      }
      try {
        const r = await fisio.cancelarPorTelefono(telefono);
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
