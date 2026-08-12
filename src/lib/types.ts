// ============================================================
// Tipos compartidos del dashboard
// Replican las estructuras que el bot persiste en bot/data/*.json
// y bot/config/clinica.json
// ============================================================

export interface Mensaje {
  role: 'user' | 'assistant' | 'system'
  content: string
  ts: string
  manual?: boolean
}

export interface Conversacion {
  telefono: string
  nombre: string | null
  interes: string | null
  motivo: string | null
  citaPendiente: boolean
  citaConfirmada: boolean
  estado: string
  handoff: boolean
  campania: string | null
  totalMensajes: number
  ultimoMensaje: string
  ultimoRol: string | null
  ultimaActividad: string | null
  historial?: Mensaje[]
}

export interface Cita {
  id: string
  telefono: string
  nombre: string
  dni: string
  fecha: string
  hora: string
  estado: 'PENDIENTE_CONFIRMACION' | 'CONFIRMADA' | 'CANCELADA' | 'COMPLETADA'
  creadaEn: string
  medioPago?: string
  motivo?: string
}

export interface Lead {
  telefono: string
  nombre?: string
  dni?: string
  nivel_interes?: 'ALTO' | 'MEDIO' | 'BAJO'
  motivo?: string
  actualizadoEn: string
}

export type EstadoConversacion =
  | 'NUEVO'
  | 'CALIFICANDO'
  | 'TOMANDO_CITA'
  | 'CITA_CONFIRMADA'
  | 'CITA_CANCELADA'
  | 'DERIVADO_A_RECEPCION'
  | 'ESPERANDO_CONFIRMACION'
  | 'COMPLETADO'

// ---- Config del consultorio (bot/config/clinica.json) ----
export interface CupoDia {
  fecha: string
  horas: string[]
}

export interface Campania {
  nombre: string
  estado: string
  vigencia: string
  precio: string
  ofertas: string[]
  articulaciones: string[]
  cupos: string[]
  instrucciones: string
}

export interface ClinicaConfig {
  identidad: {
    nombreAgente: string
    medico: string
    especialidad: string
    ciudad: string
    zonaHoraria: string
    direccion: string
    precioConsulta: string
    precioSesion?: string
    paquete10Sesiones?: string
    duracionConsulta: string
    modalidad: string
    consultaVirtualHabilitada: boolean
    saludo: string
  }
  horarioGeneral?: Record<string, string>
  agenda?: {
    diasSemana?: number[]
    bloques?: { inicio: string; fin: string }[]
    duracionSesionMin?: number
    intervaloTurnoMin?: number
    capacidadParalela?: number
    diasAdelante?: number
    diasCerrados?: string[]
  }
  cuposDisponibles: CupoDia[]
  mediosDePago: string[]
  campaniasActivas: Campania[]
}

// ---- Stats (GET /api/stats) ----
export interface Kpis {
  conversacionesHoy: number
  conversacionesDelta: number
  citasHoy: number
  citasDelta: number
  tasaConfirmacion: number
  tasaConfirmacionDelta: number
  leadsActivos: number
  leadsDelta: number
  tiempoRespuesta: string
  tiempoRespuestaDelta: number
}

export interface ConversacionDia {
  fecha: string
  total: number
  citas: number
  confirmadas: number
}

export interface CitaPorEstado {
  nombre: string
  valor: number
  color: string
}

export interface MotivoFrecuente {
  motivo: string
  cantidad: number
  porcentaje: number
}

export interface ActividadItem {
  tipo: 'cita' | 'mensaje' | 'handoff' | 'lead' | 'cancelacion'
  mensaje: string
  tiempo: string
  icono: string
  telefono?: string
}

export interface DashboardStats {
  kpis: Kpis
  conversacionesPorDia: ConversacionDia[]
  citasPorEstado: CitaPorEstado[]
  motivosFrecuentes: MotivoFrecuente[]
  actividadReciente: ActividadItem[]
}
