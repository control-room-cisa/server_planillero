// src/domain/segmentador-tiempo.ts
import { TipoIntervalo, IntervaloTiempo, LineaTiempoDia } from "./types";
import { RegistroDiarioDetail } from "../repositories/RegistroDiarioRepository";

/**
 * Clase encargada de segmentar la línea de tiempo del día en intervalos de 24 horas
 */
export class SegmentadorTiempo {
  /**
   * Segmenta el día en intervalos basado en el registro diario y sus actividades
   */
  static segmentarDia(registroDiario: RegistroDiarioDetail): LineaTiempoDia {
    const {
      fecha,
      empleadoId,
      horaEntrada,
      horaSalida,
      esHoraCorrida,
      actividades,
    } = registroDiario;

    // Validar que las horas normales cuadren
    this.validarHorasNormales(registroDiario);

    // Crear intervalos base
    const intervalos: IntervaloTiempo[] = [];

    // Puntos de segmentación importantes: 00:00, 05:00, 12:00, 13:00, 19:00, 24:00
    const puntosSegmentacion = [
      "00:00",
      "05:00",
      "12:00",
      "13:00",
      "19:00",
      "24:00",
    ];

    // Agregar horarios de entrada y salida a los puntos de segmentación
    const horaEntradaStr = this.dateToTimeString(horaEntrada);
    const horaSalidaStr = this.dateToTimeString(horaSalida);

    const todosPuntos = [...puntosSegmentacion, horaEntradaStr, horaSalidaStr]
      .sort()
      .filter((punto, index, arr) => arr.indexOf(punto) === index); // Eliminar duplicados

    // Crear intervalos entre puntos consecutivos
    for (let i = 0; i < todosPuntos.length - 1; i++) {
      const inicio = todosPuntos[i];
      const fin = todosPuntos[i + 1];

      if (inicio === fin) continue;

      const tipoIntervalo = this.determinarTipoIntervalo(
        inicio,
        fin,
        horaEntradaStr,
        horaSalidaStr,
        esHoraCorrida || false,
        actividades
      );

      const intervalo: IntervaloTiempo = {
        horaInicio: inicio,
        horaFin: fin,
        tipo: tipoIntervalo.tipo,
        jobId: tipoIntervalo.jobId,
        descripcion: tipoIntervalo.descripcion,
      };

      intervalos.push(intervalo);
    }

    return {
      fecha,
      empleadoId: empleadoId.toString(),
      intervalos,
    };
  }

  /**
   * Valida que las horas normales (esExtra=false) cuadren con la jornada
   */
  private static validarHorasNormales(
    registroDiario: RegistroDiarioDetail
  ): void {
    const { horaEntrada, horaSalida, esHoraCorrida, actividades } =
      registroDiario;

    const horasNormales = actividades
      .filter((act) => !act.esExtra)
      .reduce((sum, act) => sum + act.duracionHoras, 0);

    const duracionJornada =
      (horaSalida.getTime() - horaEntrada.getTime()) / 3_600_000;
    const duracionEsperada = esHoraCorrida
      ? duracionJornada
      : duracionJornada - 1;

    const tolerancia = 0.1; // 6 minutos de tolerancia

    if (Math.abs(horasNormales - duracionEsperada) > tolerancia) {
      throw new Error(
        `Las horas normales (${horasNormales}) no cuadran con la jornada esperada (${duracionEsperada})`
      );
    }
  }

  /**
   * Determina el tipo de intervalo basado en los horarios y actividades
   */
  private static determinarTipoIntervalo(
    inicio: string,
    fin: string,
    horaEntrada: string,
    horaSalida: string,
    esHoraCorrida: boolean,
    actividades: any[]
  ): { tipo: TipoIntervalo; jobId?: number; descripcion?: string } {
    // Verificar si está dentro del horario laboral
    const dentroHorario = this.estaEnRango(
      inicio,
      fin,
      horaEntrada,
      horaSalida
    );

    if (!dentroHorario) {
      return {
        tipo: TipoIntervalo.LIBRE,
        descripcion: "Fuera del horario laboral",
      };
    }

    // Verificar si es hora de almuerzo (12:00-13:00) y no es hora corrida
    if (!esHoraCorrida && this.esHoraAlmuerzo(inicio, fin)) {
      return { tipo: TipoIntervalo.ALMUERZO, descripcion: "Hora de almuerzo" };
    }

    // Buscar actividades extras que coincidan exactamente con este intervalo
    const actividadExtra = actividades.find(
      (act) =>
        act.esExtra &&
        act.horaInicio &&
        act.horaFin &&
        this.dateToTimeString(act.horaInicio) === inicio &&
        this.dateToTimeString(act.horaFin) === fin
    );

    if (actividadExtra) {
      return {
        tipo: TipoIntervalo.EXTRA,
        jobId: actividadExtra.jobId,
        descripcion: actividadExtra.descripcion,
      };
    }

    // Buscar actividades normales que puedan aplicar a este intervalo
    const actividadNormal = actividades.find((act) => !act.esExtra);

    if (actividadNormal) {
      return {
        tipo: TipoIntervalo.NORMAL,
        jobId: actividadNormal.jobId,
        descripcion: actividadNormal.descripcion,
      };
    }

    return { tipo: TipoIntervalo.LIBRE, descripcion: "Sin actividad asignada" };
  }

  /**
   * Verifica si un intervalo está dentro del rango especificado
   */
  private static estaEnRango(
    intervaloInicio: string,
    intervaloFin: string,
    rangoInicio: string,
    rangoFin: string
  ): boolean {
    return intervaloInicio >= rangoInicio && intervaloFin <= rangoFin;
  }

  /**
   * Verifica si un intervalo corresponde a la hora de almuerzo
   */
  private static esHoraAlmuerzo(inicio: string, fin: string): boolean {
    return (
      inicio >= "12:00" && fin <= "13:00" && inicio < "13:00" && fin > "12:00"
    );
  }

  /**
   * Convierte un Date a string en formato HH:mm
   */
  private static dateToTimeString(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }
}
