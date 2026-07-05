// src/domain/types.ts

/**
 * Representa el horario de trabajo de un empleado en una fecha específica
 */
export interface HorarioTrabajo {
  tipoHorario: string; // H1, H2, etc.
  fecha: string;
  empleadoId: string;
  horarioTrabajo: {
    inicio: string;
    fin: string;
  };
  incluyeAlmuerzo: boolean;
  esDiaLibre: boolean;
  esFestivo: boolean;
  nombreDiaFestivo: string;
  cantidadHorasLaborables: number;
}

/**
 * Errores de validación para el conteo de horas
 */
export interface ConteoHorasValidationError {
  fechasNoAprobadas: string[]; // Fechas que no han sido aprobadas por supervisor
  fechasSinRegistro: string[]; // Fechas que no tienen registro diario creado
  /** E01 Job Desconocido: fechas con actividades cuyo job no está registrado. No se lanza excepción; se notifica en validationErrors. */
  fechasConJobDesconocido?: string[];
  /** Errores al calcular subsidio IHSS por incapacidad (techo faltante, etc.). */
  erroresIncapacidad?: string[];
}

/**
 * Conteo de horas trabajadas por un empleado en un período
 */
export interface ConteoHorasTrabajadas {
  fechaInicio: string;
  fechaFin: string;
  empleadoId: string;
  cantidadHoras: {
    normal: number;
    p25: number; // 25% de recargo
    p50: number; // 50% de recargo
    p75: number; // 75% de recargo
    p100: number; // 100% de recargo (doble)
    libre: number; // 0 del valor de la hora normal
    almuerzo: number; // 0 del valor de la hora normal
    // Incapacidades (basado en campo esIncapacidad del registro diario)
    incapacidadEmpresa?: number; // Primeros 3 días consecutivos de incapacidad
    incapacidadIHSS?: number; // A partir del 4to día consecutivo de incapacidad
    vacaciones?: number; // E02
    permisoConSueldo?: number; // E03
    permisoSinSueldo?: number; // E04
    inasistencias?: number; // E05
    llegadasTarde?: number; // E05
    compensatorio?: number; // E06 y E07
    // Horas compensatorias (actividades con esCompensatorio=true)
    horasCompensatoriasTomadas?: number; // Horas normales compensatorias (no se cuentan como normales)
    /** Extras compensatorias acumuladas: fuera de p25–p100; remuneración = tarifa hora normal. */
    horasCompensatoriasAcumuladas?: number;
  };

  /**
   * Conteo agregado en días para el período. Base 15 días por período.
   * diasLaborados = totalPeriodo − incapacidades − vacaciones − permisos − inasistencias.
   * compensatoriasTomadas se reportan aparte (horas/8) y no reducen diasLaborados.
   */
  conteoDias?: {
    totalPeriodo: number; // siempre 15
    diasLaborados: number;
    vacaciones: number; // E02 horas / 8
    permisoConSueldo: number; // E03 horas / 8
    permisoSinSueldo: number; // E04 horas / 8
    inasistencias: number; // E05 horas / 8
    incapacidadEmpresa: number; // Primeros 3 días consecutivos / 8
    incapacidadIHSS: number; // A partir del 4to día consecutivo / 8
    /** Compensatorias tomadas (normales): horas / 8, informativo; remuneración vía horas compensatorias */
    compensatoriasTomadas?: number;
  };
  /**
   * Monto IHSS por incapacidad en el período evaluado (días IHSS × subsidioDiario).
   */
  incapacidadIhss?: {
    diasIhss: number;
    montoIhss: number;
    secuencias: Array<{
      fechaInicioSecuencia: string;
      subsidioDiario: number;
      diasIhssEnRango: number;
      montoIhssEnRango: number;
    }>;
  };
  /**
   * Deducciones de alimentación calculadas
   */
  deduccionesAlimentacion?: number;
  /**
   * Detalle de deducciones de alimentación por consumo
   */
  deduccionesAlimentacionDetalle?: DeduccionAlimentacionDetalle[];
  /**
   * Información sobre el error al obtener gastos de alimentación
   */
  errorAlimentacion?: {
    tieneError: boolean;
    mensajeError: string;
  };
  /**
   * Errores de validación encontrados durante el cálculo
   */
  validationErrors?: ConteoHorasValidationError;
}

export interface DeduccionAlimentacionDetalle {
  producto: string;
  precio: number;
  fecha: string;
}

/**
 * Conteo de horas trabajadas por un empleado en un período
 */
export interface ConteoHorasProrrateo {
  fechaInicio: string;
  fechaFin: string;
  empleadoId: string;

  cantidadHoras: {
    normal: HorasPorJob[];
    p25: HorasPorJob[]; // 25% de recargo
    p50: HorasPorJob[]; // 50% de recargo
    p75: HorasPorJob[]; // 75% de recargo
    p100: HorasPorJob[]; // 100% de recargo (doble)

    vacacionesHoras: number; // E02 horas / 8
    permisoConSueldoHoras: number; // E03 horas / 8
    permisoSinSueldoHoras: number; // E04 horas / 8
    inasistenciasHoras: number; // E05 horas / 8

    totalHorasLaborables: number;
    horasFeriado: number; // Horas laborables asignadas a feriado

    /** Horas de jornada normal marcadas como compensatorio=true (se "toman" a cuenta del banco) */
    horasCompensatoriasTomadas?: number;
    /** Compensatorias tomadas desglosadas por job (con comentarios por actividad) */
    horasCompensatoriasTomadasPorJob?: HorasPorJob[];
    /** Horas extra marcadas como compensatorio=true (acumulación al banco), desglosadas por job */
    horasCompensatoriasAcumuladasPorJob?: HorasPorJob[];

    deduccionesISR: number;
    deduccionesRAP: number;
    deduccionesAlimentacion: number;
    deduccionesIHSS: number;
    Prestamo: number;
    Total: number;
  };

  /**
   * Errores de validación encontrados durante el cálculo
   */
  validationErrors?: ConteoHorasValidationError;
}

export interface HorasPorClass {
  /** Número de class (vehículo); null = sin class */
  class: number | null;
  /** Nombre del vehículo asociado a la class */
  nombreClass: string | null;
  cantidadHoras: number;
}

/** Comentario de actividad/segmento dentro de un job, asociado a su class. */
export interface ComentarioProrrateoJob {
  texto: string;
  /** Número de class al que corresponde el comentario; null = sin class */
  class: number | null;
  /** Nombre legible del vehículo asociado a la class */
  nombreClass?: string | null;
}

export interface HorasPorJob {
  jobId: number;
  codigoJob: string;
  nombreJob: string;
  cantidadHoras: number;
  /** Comentarios de actividades asociadas a este job en el rango */
  comentarios?: ComentarioProrrateoJob[];
  /** Desglose de horas por class dentro de este job (suma ≈ cantidadHoras) */
  horasPorClass?: HorasPorClass[];
}

/**
 * Tipos de intervalos en la línea de tiempo del día
 */
export enum TipoIntervalo {
  NORMAL = "NORMAL",
  EXTRA = "EXTRA",
  ALMUERZO = "ALMUERZO",
  LIBRE = "LIBRE",
}

/**
 * Representa un intervalo de tiempo en el día
 */
export interface IntervaloTiempo {
  horaInicio: string; // HH:mm format
  horaFin: string; // HH:mm format
  tipo: TipoIntervalo;
  jobId?: number; // Solo para NORMAL y EXTRA
  descripcion?: string;
}

/**
 * Línea de tiempo completa del día (24 horas)
 */
export interface LineaTiempoDia {
  fecha: string;
  empleadoId: string;
  intervalos: IntervaloTiempo[];
}
