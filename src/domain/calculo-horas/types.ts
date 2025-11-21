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
    // Variantes por jobs especiales en horas NORMALES
    incapacidad?: number; // E01
    incapacidadIHSS?: number; // E01
    vacaciones?: number; // E02
    permisoConSueldo?: number; // E03
    permisoSinSueldo?: number; // E04
    inasistencias?: number; // E05
    llegadasTarde?: number; // E05
    compensatorio?: number; // E06 y E07
  };

  /**
   * Conteo agregado en días para el período. Base 15 días por período.
   * La suma debe cumplir: 15 = diasLaborados + vacaciones + permisoConSueldo + permisoSinSueldo + incapacidad + incapacidadIHSS
   */
  conteoDias?: {
    totalPeriodo: number; // siempre 15
    diasLaborados: number; // 15 - (otras categorías)
    vacaciones: number; // E02 horas / 8
    permisoConSueldo: number; // E03 horas / 8
    permisoSinSueldo: number; // E04 horas / 8
    inasistencias: number; // E05 horas / 8
  };
  /**
   * Deducciones de alimentación calculadas
   */
  deduccionesAlimentacion?: number;
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

export interface HorasPorJob {
  jobId: number;
  codigoJob: string;
  nombreJob: string;
  cantidadHoras: number;
  /** Comentarios de actividades asociadas a este job en el rango */
  comentarios?: string[];
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
