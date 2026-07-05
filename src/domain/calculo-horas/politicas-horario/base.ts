// src/domain/politicas-horario/base.ts
import { IPoliticaHorario } from "../interfaces";
import {
  HorarioTrabajo,
  ConteoHorasTrabajadas,
  ConteoHorasProrrateo,
} from "../types";
import { RegistroDiarioRepository } from "../../../repositories/RegistroDiarioRepository";
import { TechoIhssRepository } from "../../../repositories/TechoIhssRepository";
import { FeriadoRepository } from "../../../repositories/FeriadoRepository";
import { EmpleadoRepository } from "../../../repositories/EmpleadoRepository";
import { AppError } from "../../../errors/AppError";
import { ResultadoSegmentacion, segmentarRegistroDiario } from "./segmentador";
import { GastosAlimentacionService } from "../../../services/GastosAlimentacionService";
import type { DeduccionAlimentacionDetalle } from "../types";
import {
  calcularSecuenciasIncapacidadEnRango,
  type ClasificacionIncapacidadDia,
  type IncapacidadIhssResumen,
  type SecuenciaIncapacidadEnRango,
} from "./incapacidad-secuencias";

/**
 * Clase base abstracta para todas las políticas de horario
 */
export abstract class PoliticaHorarioBase implements IPoliticaHorario {
  abstract getHorarioTrabajoByDateAndEmpleado(
    fecha: string,
    empleadoId: string
  ): Promise<HorarioTrabajo>;

  abstract getConteoHorasTrabajajadasByDateAndEmpleado(
    fechaInicio: string,
    fechaFin: string,
    empleadoId: string
  ): Promise<ConteoHorasTrabajadas>;

  abstract getProrrateoHorasPorJobByDateAndEmpleado(
    fechaInicio: string,
    fechaFin: string,
    empleadoId: string
  ): Promise<ConteoHorasProrrateo>;

  /**
   * Implementación base del método requerido por la interfaz
   */
  async getConteoHorasTrabajadasByDateAndEmpleado(
    fechaInicio: string,
    fechaFin: string,
    empleadoId: string
  ): Promise<ConteoHorasTrabajadas> {
    return this.getConteoHorasTrabajajadasByDateAndEmpleado(
      fechaInicio,
      fechaFin,
      empleadoId
    );
  }

  /**
   * Verifica si una fecha es feriado
   */
  protected async esFeriado(
    fecha: string
  ): Promise<{ esFeriado: boolean; nombre: string }> {
    try {
      const feriado = await FeriadoRepository.findByDate(fecha);
      return {
        esFeriado: !!feriado,
        nombre: feriado?.nombre || "",
      };
    } catch {
      return { esFeriado: false, nombre: "" };
    }
  }

  async generarSegmentosDeDiaConValidacion(
    fecha: string,
    empleadoId: string
  ): Promise<ResultadoSegmentacion> {
    if (!this.validarFormatoFecha(fecha)) {
      throw new Error("Formato de fecha inválido. Use YYYY-MM-DD");
    }

    const reg = await this.getRegistroDiario(empleadoId, fecha);
    return this.segmentarConRegistro(fecha, reg);
  }

  /**
   * Segmenta un día usando un registro ya obtenido (evita consultas duplicadas)
   */
  protected segmentarConRegistro(
    fecha: string,
    reg: any
  ): ResultadoSegmentacion {
    if (!reg) {
      // Sin registro: todo LIBRE; NO aplica almuerzo.
      const fake: any = {
        fecha,
        horaEntrada: new Date(`${fecha}T00:00:00`),
        horaSalida: new Date(`${fecha}T00:00:00`),
        esHoraCorrida: true,
        esDiaLibre: true,
        actividades: [],
      };
      return segmentarRegistroDiario(fake);
    }

    // Ideal: include { actividades: { include: { job: true }}} para poblar jobNombre/codigo
    return segmentarRegistroDiario(reg as any);
  }

  /**
   * Obtiene el registro diario de un empleado para una fecha
   */
  protected async getRegistroDiario(empleadoId: string, fecha: string) {
    return RegistroDiarioRepository.findByEmpleadoAndDateWithActivities(
      parseInt(empleadoId),
      fecha
    );
  }

  /** Sobrescribir en tests para usar registros en memoria. */
  protected async fetchIncapacidadFlagsEnRango(
    empleadoId: string,
    fechaDesde: string,
    fechaHasta: string
  ): Promise<Array<{ fecha: string; esIncapacidad: boolean }>> {
    return RegistroDiarioRepository.findIncapacidadFlagsByEmpleadoAndRange(
      parseInt(empleadoId),
      fechaDesde,
      fechaHasta
    );
  }

  /** Sobrescribir en tests. Retorna monto del techo vigente en la fecha. */
  protected async fetchTechoIhssEnFecha(fecha: string): Promise<number | null> {
    const row = await TechoIhssRepository.findVigenteEnFecha(fecha);
    if (row) {
      const dto = TechoIhssRepository.toDto(row);
      console.log("[Incapacidad/IHSS] Techo IHSS en BD", {
        fechaConsulta: fecha,
        encontrado: true,
        id: dto.id,
        monto: dto.monto,
        fechaInicio: dto.fechaInicio,
        fechaFin: dto.fechaFin,
      });
      return dto.monto;
    }
    console.log("[Incapacidad/IHSS] Techo IHSS en BD", {
      fechaConsulta: fecha,
      encontrado: false,
    });
    return null;
  }

  protected lanzarErroresValidacionIncapacidad(errores: string[]): never {
    throw new AppError(
      "No se puede calcular nómina por errores de incapacidad IHSS",
      422,
      {
        fechasNoAprobadas: [],
        fechasSinRegistro: [],
        erroresIncapacidad: errores,
      }
    );
  }

  /**
   * Secuencias de incapacidad en el rango de nómina y clasificación por día
   * (días 1–3 empresa, 4+ IHSS con subsidioDiario).
   */
  protected async resolverSecuenciasIncapacidadEnRango(
    empleadoId: string,
    fechaInicio: string,
    fechaFin: string
  ): Promise<{
    secuencias: SecuenciaIncapacidadEnRango[];
    clasificacionPorFecha: Map<string, ClasificacionIncapacidadDia>;
    errores: string[];
    incapacidadIhss: IncapacidadIhssResumen;
  }> {
    return calcularSecuenciasIncapacidadEnRango(
      fechaInicio,
      fechaFin,
      (desde, hasta) =>
        this.fetchIncapacidadFlagsEnRango(empleadoId, desde, hasta),
      (fecha) => this.fetchTechoIhssEnFecha(fecha)
    );
  }

  /**
   * Obtiene la información del empleado
   */
  protected async getEmpleado(empleadoId: string) {
    return EmpleadoRepository.findById(parseInt(empleadoId));
  }

  /**
   * Calcula las horas laborables base según el tipo de horario
   */
  protected abstract getHorasLaborablesBase(): number;

  /**
   * Obtiene el horario estándar de trabajo (inicio y fin)
   */
  protected abstract getHorarioEstandar(): { inicio: string; fin: string };

  /**
   * Determina si incluye almuerzo por defecto
   */
  protected abstract incluyeAlmuerzoDefault(): boolean;

  /**
   * Convierte una fecha string a formato de visualización
   */
  protected formatearFecha(fecha: string): string {
    return fecha; // Por ahora mantener el formato original
  }

  /**
   * Valida el formato de fecha YYYY-MM-DD
   */
  protected validarFormatoFecha(fecha: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    return regex.test(fecha);
  }

  /** Minutos del día en TZ (misma lógica que segmentador.ts). */
  protected minutesOfDayInTZ(
    d: Date,
    tz = "America/Tegucigalpa"
  ): number {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: tz,
    }).formatToParts(d);
    const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return hh * 60 + mm;
  }

  /**
   * Horas de actividad con rango horario — alineado con segmentador / conteo:
   * si hay horaInicio y horaFin, usa la diferencia completa; si no, duracionHoras.
   */
  protected horasActividadConRangoHorario(act: {
    horaInicio?: Date | string | null;
    horaFin?: Date | string | null;
    duracionHoras?: number | null;
  }): number {
    if (act?.horaInicio && act?.horaFin) {
      const duracionMs =
        new Date(act.horaFin).getTime() - new Date(act.horaInicio).getTime();
      const horas = duracionMs / 3_600_000;
      if (Number.isFinite(horas) && horas > 0) return horas;
    }
    const fallback = Number(act?.duracionHoras ?? 0);
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0;
  }

  /**
   * Reparto diurna/nocturna (05:00–19:00 local) sobre el rango completo,
   * sin recortar al día UTC del registro.
   */
  protected horasExtraDiurnaNocturnaDesdeRango(
    horaInicio: Date,
    horaFin: Date,
    tz = "America/Tegucigalpa"
  ): { diurna: number; nocturna: number } {
    const diurnaIni = 5 * 60;
    const diurnaFin = 19 * 60;
    const DAY_MIN = 24 * 60;

    const splitSegment = (sMin: number, eMin: number) => {
      const max0 = Math.max(sMin, diurnaIni);
      const min1 = Math.min(eMin, diurnaFin);
      const diurnaMin = Math.max(0, min1 - max0);
      const totalMin = eMin - sMin;
      const nocturnaMin = Math.max(0, totalMin - diurnaMin);
      return { diurna: diurnaMin / 60, nocturna: nocturnaMin / 60 };
    };

    const startMin = this.minutesOfDayInTZ(horaInicio, tz);
    const endMin = this.minutesOfDayInTZ(horaFin, tz);

    if (endMin > startMin) {
      return splitSegment(startMin, endMin);
    }

    const part1 = splitSegment(startMin, DAY_MIN);
    const part2 = splitSegment(0, endMin);
    return {
      diurna: part1.diurna + part2.diurna,
      nocturna: part1.nocturna + part2.nocturna,
    };
  }

  /**
   * Calcula las deducciones de alimentación para un empleado en un rango de fechas.
   * Retorna tanto el total como el detalle por consumo (si está disponible).
   * @param empleadoPrecargado - Empleado ya obtenido (opcional, evita consulta adicional)
   */
  async calcularDeduccionesAlimentacion(
    empleadoId: string,
    fechaInicio: string,
    fechaFin: string,
    empleadoPrecargado?: any
  ): Promise<{
    deduccionesAlimentacion: number;
    detalle: DeduccionAlimentacionDetalle[];
    errorAlimentacion?: { tieneError: boolean; mensajeError: string };
  }> {
    let deduccionesAlimentacion = 0;
    let detalle: DeduccionAlimentacionDetalle[] = [];
    let errorAlimentacion:
      | { tieneError: boolean; mensajeError: string }
      | undefined;

    try {
      const empleado = empleadoPrecargado ?? await this.getEmpleado(empleadoId);
      if (empleado?.codigo) {
        const gastosAlimentacion =
          await GastosAlimentacionService.obtenerConsumo({
            codigoEmpleado: empleado.codigo,
            fechaInicio,
            fechaFin,
          });

        if (!gastosAlimentacion.success) {
          errorAlimentacion = {
            tieneError: true,
            mensajeError:
              gastosAlimentacion.message ||
              "El servicio de gastos de alimentación respondió con error",
          };
        } else {
          detalle = (gastosAlimentacion.items || []).map((item) => ({
            producto: item.producto,
            precio: item.precio,
            fecha: item.fecha,
          }));

          deduccionesAlimentacion = detalle.reduce(
            (total, item) => total + item.precio,
            0
          );
        }
      } else {
        errorAlimentacion = {
          tieneError: true,
          mensajeError: "El empleado no tiene código asignado",
        };
      }
    } catch (error: any) {
      const mensajeError =
        error?.message || "Error al obtener deducciones de alimentación";
      errorAlimentacion = {
        tieneError: true,
        mensajeError,
      };
      console.error(
        `Error al obtener gastos de alimentación para empleado ${empleadoId}:`,
        error
      );
    }

    return {
      deduccionesAlimentacion,
      detalle,
      errorAlimentacion,
    };
  }
}
