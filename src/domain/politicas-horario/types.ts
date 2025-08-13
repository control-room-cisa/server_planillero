// src/domain/politicas-horario/types.ts
export type FechaISO = string; // 'YYYY-MM-DD'
export type FechaHoraISO = string; // 'YYYY-MM-DDTHH:mm:ss'

export enum TipoHorario {
  H1 = "H1",
  H2 = "H2",
}

export type PeriodoDia = "diurno" | "nocturno";
export type TipoActividad = "trabajo" | "almuerzo" | "libre";

export interface Almuerzo {
  inicio: string; // 'HH:mm'
  fin: string; // 'HH:mm'
}

export interface JornadaUnica {
  inicio: string; // 'HH:mm' (si fin < inicio => cruza medianoche)
  fin: string; // 'HH:mm'
  almuerzo?: Almuerzo;
}

export interface HorarioDelDia {
  fecha: FechaISO;
  esDiaLibre: boolean;
  esFestivo: boolean;
  jornada?: JornadaUnica;
  cantidadHorasLaborables: number; // horas decimales
}

export interface EmpleadoRef {
  id: number;
  tipoHorario: TipoHorario;
}

export interface OpcionesConteo {
  tz?: string; // 'America/Tegucigalpa' por defecto
  festivos?: Set<FechaISO>;
  escalonesExtras?: { tramo25min: number; tramo50min: number }; // minutos
  incluirDetalle?: boolean;
}

export interface ResultadoConteo {
  fechaInicio: FechaHoraISO;
  fechaFin: FechaHoraISO;
  cantidadHoras: {
    normal: number;
    p25: number;
    p50: number;
    p75: number;
    p100: number;
  };
  detalle?: IntervaloDetallado[];
}

export interface IntervaloDetallado {
  inicio: FechaHoraISO;
  fin: FechaHoraISO;
  horas: number; // en horas decimales
  periodo: PeriodoDia;
  actividad: TipoActividad;
  enJornada: boolean;
  esFestivo: boolean;
  esDiaLibre: boolean;
}

// Para evitar problemas si algún config de TS requiere que sea módulo aunque todo sea "export":
export {};
