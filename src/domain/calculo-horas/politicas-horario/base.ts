// src/domain/politicas-horario/base.ts
import { IPoliticaHorario } from "../interfaces";
import {
  HorarioTrabajo,
  ConteoHorasTrabajadas,
  ConteoHorasProrrateo,
} from "../types";
import { RegistroDiarioRepository } from "../../../repositories/RegistroDiarioRepository";
import { FeriadoRepository } from "../../../repositories/FeriadoRepository";
import { EmpleadoRepository } from "../../../repositories/EmpleadoRepository";
import { ResultadoSegmentacion, segmentarRegistroDiario } from "./segmentador";
import { GastosAlimentacionService } from "../../../services/GastosAlimentacionService";
import type { DeduccionAlimentacionDetalle } from "../types";

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

  /**
   * Calcula las deducciones de alimentación para un empleado en un rango de fechas.
   * Retorna tanto el total como el detalle por consumo (si está disponible).
   */
  protected async calcularDeduccionesAlimentacion(
    empleadoId: string,
    fechaInicio: string,
    fechaFin: string
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
      const empleado = await this.getEmpleado(empleadoId);
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
