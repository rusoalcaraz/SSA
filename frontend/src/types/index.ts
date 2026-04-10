// -------------------------------------------------------
// Roles
// -------------------------------------------------------
export type Rol =
  | 'superadmin'
  | 'gerencial'
  | 'area_contratante'
  | 'asesor_tecnico'
  | 'dgt'
  | 'inspeccion'

// -------------------------------------------------------
// Entidades base
// -------------------------------------------------------
export interface UsuarioResumen {
  _id: string
  nombre: string
  apellidos: string
  correo: string
  rol: Rol
  direccionGeneral: string | null
}

export type TipoOrganismo =
  | 'organo_de_direccion'
  | 'area_contratante'
  | 'area_requiriente'
  | 'area_usuaria'

export interface DireccionGeneral {
  _id: string
  nombre: string
  siglas: string
  descripcion?: string
  tipo?: TipoOrganismo
  activa: boolean
}

export interface BienServicio {
  _id: string
  clave: string
  descripcion: string
  tipo: 'bien' | 'servicio' | 'bien_y_servicio'
  unidadMedida?: string
  activo: boolean
}

export interface CatalogoEtapa {
  _id: string
  nombre: string
  descripcion?: string
  tipo: 'cronograma' | 'hoja_de_trabajo'
  obligatoria: boolean
  aplicaA: TipoProcedimiento[]
  orden: number
  diasAlertaUrgente?: number
  activa: boolean
}

// -------------------------------------------------------
// Tipos de procedimiento
// -------------------------------------------------------
export type TipoProcedimiento =
  | 'licitacion_publica_nacional'
  | 'licitacion_publica_internacional_libre'
  | 'licitacion_publica_internacional_tratados'
  | 'invitacion_tres_personas'
  | 'adjudicacion_directa'

export type EtapaActual =
  | 'cronograma'
  | 'hoja_de_trabajo'
  | 'entregas'
  | 'concluido'
  | 'cancelado'

export type EstadoEtapa =
  | 'pendiente'
  | 'activo'
  | 'completado'
  | 'vencido'
  | 'fecha_propuesta'
  | 'fecha_rechazada'

// -------------------------------------------------------
// Sub-tipos de procedimiento
// -------------------------------------------------------
export interface HistorialFecha {
  fechaAnterior?: string
  fechaNueva?: string
  accion: 'propuesta' | 'aceptada' | 'rechazada' | 'sobreescrita'
  realizadoPor: UsuarioResumen
  timestamp: string
  motivo?: string
}

export interface Observacion {
  _id: string
  texto: string
  archivos: { nombre: string; ruta: string }[]
  creadoPor: UsuarioResumen
  timestamp: string
}

export interface EtapaProcedimiento {
  _id: string
  catalogoEtapa: string
  nombre: string
  orden: number
  obligatoria: boolean
  noAplica: boolean
  fechaPlaneada?: string
  fechaReal?: string
  estado: EstadoEtapa
  fechaPropuesta?: string
  motivoRechazo?: string
  historialFechas: HistorialFecha[]
  observaciones: Observacion[]
  alertaEnviada: boolean
  completadoPor?: UsuarioResumen
  completadoEn?: string
}

export interface InfoCronograma {
  organismo?: string
  fecha?: string
  asesorTecnico?: string
  fuenteFinanciamiento?: string
  telefonoCelular?: string
  extensionSatelital?: string
  nombreProcedimientoContratacion?: string
  numeroPartidas?: number
  numeroArticulos?: number
  capituloGasto?: string
  requiereAnualidad?: boolean | null
  numeroOficioPlurianualidad?: string
  claveCartera?: string
  numeroClaveCartera?: string
}

export interface InfoHojaDeTrabajo {
  organismo?: string
  fecha?: string
  nombreResponsable?: string
  telefonoCelular?: string
  extensionSatelital?: string
  nombreProcedimientoContratacion?: string
  techoPresupuestal?: number
  claveCartera?: string
  origenRecursos?: string
  tipoProcedimientoContratacion?: string
  areaContratante?: string
  extensionSatelitalAreaContratante?: string
}

export interface DocumentoEntrega {
  _id: string
  tipo: 'constancia_recepcion' | 'hoja_aceptacion' | 'otro'
  nombre: string
  ruta: string
  fechaCarga: string
  cargadoPor?: UsuarioResumen
}

export interface Entrega {
  _id: string
  descripcion: string
  tipo: 'parcial' | 'total'
  fechaEstimada?: string
  fechaReal?: string
  estado: 'pendiente' | 'recibida' | 'rechazada'
  documentos: DocumentoEntrega[]
  observaciones?: string
  registradoPor?: UsuarioResumen
}

export interface ArchivoAdjunto {
  _id: string
  nombre: string
  ruta: string
  fechaCarga: string
  cargadoPor?: UsuarioResumen
}

// -------------------------------------------------------
// Procedimiento
// -------------------------------------------------------
export interface Procedimiento {
  _id: string
  numeroProcedimiento?: string
  anioFiscal: number
  titulo: string
  descripcion?: string
  bienServicio: BienServicio
  descripcionEspecifica?: string
  montoEstimado?: number
  moneda: string
  direccionGeneral: DireccionGeneral
  asesorTitular: UsuarioResumen
  asesorSuplente?: UsuarioResumen
  tipoProcedimiento: TipoProcedimiento
  supuestoExcepcion?: string
  tipoConsultoria?: string
  justificacionTipo?: string
  evidenciaJustificacion: ArchivoAdjunto[]
  urgente: boolean
  justificacionUrgencia?: string
  etapaActual: EtapaActual
  infoCronograma: InfoCronograma
  cronograma: EtapaProcedimiento[]
  infoHojaDeTrabajo: InfoHojaDeTrabajo
  hojaDeTrabajoEtapas: EtapaProcedimiento[]
  entregas: Entrega[]
  creadoPor: UsuarioResumen
  createdAt: string
  updatedAt: string
  // Campo calculado por el dashboard
  etapasConAlerta?: EtapaConAlerta[]
}

export interface EtapaConAlerta {
  etapaId: string
  nombre: string
  estado: EstadoEtapa
  fechaPlaneada: string
  vencida: boolean
  proximaAVencer: boolean
}

// -------------------------------------------------------
// Respuestas API estandar
// -------------------------------------------------------
export interface ApiResponse<T> {
  success: boolean
  data: T
  message: string
  pagination?: Paginacion
}

export interface ApiError {
  success: false
  error: {
    code: string
    message: string
  }
}

export interface Paginacion {
  page: number
  limit: number
  total: number
  totalPaginas: number
}
