
import { Dayjs } from 'dayjs';

/** Petición para calcular horas extra en un periodo */
export interface CalculateOvertimePeriodRequest {
  empleadoId:  number;
  fechaInicio: string;
  fechaFin:    string;
}

/** Detalle de cada segmento de la jornada */
export interface OvertimeDetail {
  fecha: string;
  segments: {
    inicio:     string;
    fin:        string;
    tipo:       string;
    porcentaje: number;
  }[];
}

/** Respuesta con totales, metadatos y detalle de segmentos */
export interface OvertimeResponse {
  empleadoId: number;
  periodo: {
    desde: string;
    hasta: string;
  };
  conteoHoras: {
    horasNormal:         number;
    horasPorcentaje25:   number;
    horasPorcentaje50:   number;
    horasPorcentaje75:   number;
    horasPorcentaje100:  number; // recargo 100% en domingos, falta para vacaciones
    totalHorasExtras:    number;
    totalHoras:          number;
  };
}

// ---------------------------------------------------
// Contexto y reglas de negocio

/** Contexto que acompaña al cálculo, guarda la fecha y cuántas horas ya se asignaron por tipo */
export interface CalculationContext {
  fecha: Dayjs;
  acumulado: {
    horasNormal:   number;
    diurna25:      number;
    nocturna50:    number;
    mixta75:       number;
  };
  esHoraCorrida?: boolean; // NUEVO: indica si se debe contar almuerzo
}


/**
 * Un tramo de tiempo a evaluar (normalmente 1 h, pero puede ser parcial)
 */
export interface TimeSegment {
  inicio: Dayjs;
  fin:    Dayjs;
}

/**
 * Representa un bloque de tiempo clasificado como trabajo normal o extra,
 * con su porcentaje de recargo correspondiente.
 */
export interface OvertimeSegment {
  inicio: Date;
  fin: Date;
  /**
   * Tipo de segmento:
   * - 'normal'       → turnos diurnos sin recargo, no se paga extra
   * - 'diurna25'     → recargo 25% en diurna extra
   * - 'noctuna50'     → recargo 50% en nocturna extra
   * - 'mixta75'      → recargo 75% por combinación de diurna+nocturna extra
   * - 'sabado25'     → recargo 25% por trabajar en sábado extra
   * - 'domingo100'   → recargo 100% por trabajar en domingo extra
   */
  tipo:
    | 'normal'
    | 'diurna25'
    | 'nocturna50'
    | 'mixta75'
    | 'sabado25'
    | 'domingo100';
  porcentaje: number; // (0, 0.25, 0.5, 0.75, 1)
}

/**
 * Interfaz que debe implementar cada “regla” de recargo:
 *  - priority: orden de evaluación (más bajo = se prueba primero)
 *  - matches: si esta regla aplica al segmento y contexto dado
 *  - build:   cómo construir el OvertimeSegment resultante
 */
export interface OvertimeRule {
  priority: number;
  matches(seg: TimeSegment, ctx: CalculationContext): boolean;
  build(seg: TimeSegment, ctx: CalculationContext): OvertimeSegment;
}
