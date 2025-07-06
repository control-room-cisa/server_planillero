// src/dtos/planilla/planillaDtos.ts

/**
 * Payload al crear una planilla
 */
export interface CreatePlanillaDto {
  fechaInicio: Date;
  fechaFin:    Date;
}

/**
 * Representación “plana” de una planilla
 */
export interface PlanillaResponse {
  id:           number;
  fechaInicio:  Date;
  fechaFin:     Date;
  estado:       'A' | 'R';
  empleadoId:   number;
  empresaId:    number;
  createdAt:    Date;
  updatedAt?:   Date | null;
  deletedAt?:   Date | null;
}

/**
 * Job asociado a una actividad
 */
export interface JobDto {
  id:          number;
  nombre?:     string | null;
  codigo?:     string | null;
  descripcion?: string | null;
}

/**
 * Actividad diaria dentro de un día de planilla
 */
export interface PlanillaActividadDto {
  id:            number;
  duracionHoras: number;
  esExtra:       boolean;
  class?:        string | null;
  descripcion:   string;
  job:           JobDto;
}

/**
 * Día de la planilla con sus actividades
 */
export interface PlanillaDiaDto {
  id:               number;
  horaEntrada:      Date;
  horaSalida:       Date;
  jornada?:         string | null;
  esDiaLibre?:      boolean | null;
  comentario?:      string | null;
  diasPlanillaCol?: string | null;
  actividades:      PlanillaActividadDto[];
}

/**
 * Planilla completa, con sus días y actividades
 */
export interface PlanillaDetailResponse extends PlanillaResponse {
  planillaDias: PlanillaDiaDto[];
}

// Payload para crear una actividad dentro de un día de planilla
export interface CreatePlanillaActividadDto {
  jobId:         number;
  duracionHoras: number;
  esExtra?:      boolean;
  class?:        string | null;
  descripcion:   string;
}

// Payload para crear un día de planilla *con* sus actividades
export interface CreatePlanillaDiaDto {
  planillaId:       number;
  horaEntrada:      Date;
  horaSalida:       Date;
  jornada?:         string | null;
  esDiaLibre?:      boolean | null;
  comentario?:      string | null;
  diasPlanillaCol?: string | null;
  actividades?:     CreatePlanillaActividadDto[];
}

// Respuesta de un día de planilla con actividades y job
export interface PlanillaDiaResponse {
  id:               number;
  planillaId:       number;
  horaEntrada:      Date;
  horaSalida:       Date;
  jornada?:         string | null;
  esDiaLibre?:      boolean | null;
  comentario?:      string | null;
  diasPlanillaCol?: string | null;
  createdAt:        Date;
  updatedAt?:       Date | null;
  deletedAt?:       Date | null;
  actividades: Array<{
    id:            number;
    duracionHoras: number;
    esExtra:       boolean | null;
    class:         string | null;
    descripcion:   string;
    job: {
      id:          number;
      nombre?:     string | null;
      codigo?:     string | null;
      descripcion?:string | null;
    };
  }>;
}
