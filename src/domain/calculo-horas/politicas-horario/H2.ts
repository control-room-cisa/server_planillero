// src/domain/calculo-horas/politicas-horario/H2.ts
import { PoliticaHorarioBase } from "./base";
import type {
  HorarioTrabajo,
  ConteoHorasTrabajadas,
  ConteoHorasProrrateo,
  HorasPorJob,
} from "../types";

/**
 * Política H2 — Turnos rotativos de 12h, sin almuerzo.
 *
 * Reglas:
 * - Entrada/Salida: mismo formato de retorno que H1; H2 SIEMPRE ignora almuerzo.
 * - Feriado o día libre: NORMAL = 0; todo lo trabajado es EXTRA al 25% (p25). Sin excepciones.
 * - Turno diurno: 12 h normales por día (lo normal).
 * - Turno nocturno:
 *      * Martes: 6 h normales (cambio de turno).
 *      * Otros días: normales según intervalo declarado (típicamente 12 h).
 * - Las horas NORMALES deben coincidir con el intervalo Entrada/Salida del día,
 *   excepto la regla especial del martes nocturno (6 h).
 * - H2 NO usa p50/p75/p100 ni almuerzo (si aparece ALMUERZO → ERROR).
 * - Validación global: suma de horas por día = 24 h; en el rango = 24 h * #días.
 */
export class PoliticaH2 extends PoliticaHorarioBase {
  // --------------------- utilidades locales mínimas ---------------------
  private static hhmmToMin(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }
  private static minutesOfDayInTZ(d: Date, tz = "America/Tegucigalpa"): number {
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
  private static addDays(iso: string, d: number): string {
    const [Y, M, D] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(Y, M - 1, D));
    dt.setUTCDate(dt.getUTCDate() + d);
    const y = dt.getUTCFullYear();
    const m = `${dt.getUTCMonth() + 1}`.padStart(2, "0");
    const day = `${dt.getUTCDate()}`.padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  private static dayCountInclusive(a: string, b: string): number {
    const [Y1, M1, D1] = a.split("-").map(Number);
    const [Y2, M2, D2] = b.split("-").map(Number);
    const d1 = Date.UTC(Y1, M1 - 1, D1);
    const d2 = Date.UTC(Y2, M2 - 1, D2);
    return Math.floor((d2 - d1) / 86400000) + 1;
  }

  /**
   * Verifica si los 3 días anteriores a la fecha dada tienen esIncapacidad=true.
   * Si los 3 días anteriores tienen incapacidad, retorna true (incapacidad > 3 días → IHSS).
   * Si alguno de los 3 días anteriores no tiene incapacidad, retorna false (≤ 3 días → Empresa).
   *
   * @param fecha - Fecha del día actual en formato YYYY-MM-DD
   * @param empleadoId - ID del empleado
   * @returns true si los 3 días anteriores tienen esIncapacidad=true (consecutivos)
   */
  private async verificar3DiasAnterioresIncapacidad(
    fecha: string,
    empleadoId: string
  ): Promise<boolean> {
    // Verificar los 3 días anteriores
    for (let i = 1; i <= 3; i++) {
      const fechaAnterior = PoliticaH2.addDays(fecha, -i);
      const registroAnterior = await this.getRegistroDiario(
        empleadoId,
        fechaAnterior
      );

      // Si algún día anterior no tiene incapacidad, los días de incapacidad son ≤3
      if (!registroAnterior || registroAnterior.esIncapacidad !== true) {
        return false;
      }
    }

    // Los 3 días anteriores tienen incapacidad → este es el día 4+ → IHSS
    return true;
  }
  /** Minutos declarados como NORMAL por Entrada/Salida (sin almuerzo). */
  private static normalesDeclaradosMin(e: Date, s: Date): number {
    const em = this.minutesOfDayInTZ(e);
    const sm = this.minutesOfDayInTZ(s);
    if (em === sm) return 0;
    if (em < sm) return sm - em;
    return sm + (24 * 60 - em); // cruza medianoche
  }
  /** Nocturno para la regla del martes (sin cortes 05/19: solo 19–07). */
  private static esNocturno(e: Date, s: Date): boolean {
    const em = this.minutesOfDayInTZ(e);
    const sm = this.minutesOfDayInTZ(s);
    if (em > sm) return true; // típico 19–07 (parte en 2 días)
    const enNocheA = em >= 19 * 60; // 19–24
    const enNocheB = sm <= 7 * 60; // 00–07
    return enNocheA || enNocheB;
  }

  // --------------------- plan diario (misma interfaz que H1) ---------------------
  async getHorarioTrabajoByDateAndEmpleado(
    fecha: string,
    empleadoId: string
  ): Promise<HorarioTrabajo> {
    if (!this.validarFormatoFecha(fecha)) {
      throw new Error("Formato de fecha inválido. Use YYYY-MM-DD");
    }
    const empleado = await this.getEmpleado(empleadoId);
    if (!empleado)
      throw new Error(`Empleado con ID ${empleadoId} no encontrado`);

    const reg = await this.getRegistroDiario(empleadoId, fecha);
    const feriadoInfo = await this.esFeriado(fecha);
    const esDiaLibre = reg?.esDiaLibre || false;

    let inicio = "07:00";
    let fin = "19:00";
    let cantidadHorasLaborables = 12;
    const incluyeAlmuerzo = false; // H2 jamás almuerzo

    if (reg) {
      const e = new Date(reg.horaEntrada);
      const s = new Date(reg.horaSalida);
      const toHHMM = (d: Date) => d.toTimeString().slice(0, 5);
      inicio = toHHMM(e);
      fin = toHHMM(s);
      cantidadHorasLaborables = PoliticaH2.normalesDeclaradosMin(e, s) / 60;
    }

    return {
      tipoHorario: "H2",
      fecha,
      empleadoId,
      horarioTrabajo: { inicio, fin },
      incluyeAlmuerzo,
      esDiaLibre,
      esFestivo: feriadoInfo.esFeriado,
      nombreDiaFestivo: feriadoInfo.nombre,
      cantidadHorasLaborables,
    };
  }

  // --------------------- conteo por rango (simple) ---------------------
  async getConteoHorasTrabajajadasByDateAndEmpleado(
    fechaInicio: string,
    fechaFin: string,
    empleadoId: string
  ): Promise<
    ConteoHorasTrabajadas & {
      tiposDias: Array<{
        fecha: string;
        tipo: "diurno" | "nocturno" | "libre" | "festivo";
      }>;
    }
  > {
    if (
      !this.validarFormatoFecha(fechaInicio) ||
      !this.validarFormatoFecha(fechaFin)
    ) {
      throw new Error("Formato de fecha inválido. Use YYYY-MM-DD");
    }
    if (fechaFin < fechaInicio)
      throw new Error("El rango de fechas es inválido (fin < inicio).");

    // acumuladores en minutos
    let normalMin = 0;
    let p25Min = 0;
    let libreMin = 0;
    let compNormalesMin = 0; // Horas compensatorias tomadas (normales)
    let compExtrasMin = 0; // Horas compensatorias pagadas (extras)
    let incapacidadEmpresaMin = 0; // Primeros 3 días consecutivos (24h por día)
    let incapacidadIHSSMin = 0; // A partir del 4to día consecutivo (24h por día)
    // H2 no usa estos:
    const p50Min = 0,
      p75Min = 0,
      p100Min = 0,
      almuerzoMin = 0;

    const tiposDias: Array<{
      fecha: string;
      tipo: "diurno" | "nocturno" | "libre" | "festivo";
    }> = [];
    const errores: Array<{ fecha: string; motivo: string; detalle?: any }> = [];

    // recorrer días
    let f = fechaInicio;
    while (f <= fechaFin) {
      const reg = await this.getRegistroDiario(empleadoId, f);
      const feriadoInfo = await this.esFeriado(f);
      const esFestivo = feriadoInfo.esFeriado;
      const esLibre = reg?.esDiaLibre ?? false;

      // ==================== MANEJO DE INCAPACIDAD ====================
      // Si el día está marcado como incapacidad, asignar 24h de incapacidad
      // Se ignoran todas las actividades del día
      if (reg?.esIncapacidad === true) {
        const HORAS_INCAPACIDAD_MIN = 24 * 60; // 1440 minutos = 24 horas = 1 día literal

        // Verificar si los 3 días anteriores también tienen incapacidad
        const incapacidadMayorATresDias =
          await this.verificar3DiasAnterioresIncapacidad(f, empleadoId);

        if (incapacidadMayorATresDias) {
          // A partir del 4to día consecutivo → IHSS
          incapacidadIHSSMin += HORAS_INCAPACIDAD_MIN;
        } else {
          // Primeros 3 días consecutivos → Empresa
          incapacidadEmpresaMin += HORAS_INCAPACIDAD_MIN;
        }

        console.log(
          `[H2] ${f} - INCAPACIDAD: ${
            incapacidadMayorATresDias ? "IHSS (>3 días)" : "Empresa (≤3 días)"
          }`
        );

        // Avanzar al siguiente día sin procesar segmentos
        f = PoliticaH2.addDays(f, 1);
        continue;
      }

      // ==================== PROCESAMIENTO NORMAL (sin incapacidad) ====================
      const segmentosResult = await this.generarSegmentosDeDiaConValidacion(
        f,
        empleadoId
      );
      const { segmentos, errores: segErrs } = segmentosResult;
      if (segErrs?.length)
        errores.push({ fecha: f, motivo: "segmentador", detalle: segErrs });

      // Extraer horas compensatorias calculadas por el segmentador
      const compNormalesHoras = segmentosResult.horasCompensatoriasTomadas || 0;
      const compExtrasArray = segmentosResult.horasCompensatoriasPagadas || [];

      // Agregar horas compensatorias a los acumuladores (convertir de horas a minutos)
      compNormalesMin += Math.round(compNormalesHoras * 60);
      for (const comp of compExtrasArray) {
        compExtrasMin += Math.round(comp.cantidadHoras * 60);
      }

      // Tipo de día
      let tipoDia: "diurno" | "nocturno" | "libre" | "festivo";
      if (esFestivo) tipoDia = "festivo";
      else if (esLibre || !reg) tipoDia = "libre";
      else {
        const e = new Date(reg.horaEntrada);
        const s = new Date(reg.horaSalida);
        tipoDia = PoliticaH2.esNocturno(e, s) ? "nocturno" : "diurno";
      }
      tiposDias.push({ fecha: f, tipo: tipoDia });

      // Sumar por tipo de segmento (H2: ALMUERZO NO se acepta → error si aparece)
      let normalMinDia = 0;
      let extraMinDia = 0;
      let libreMinDia = 0;
      let almuerzoMinDia = 0;

      for (const seg of segmentos) {
        const a = PoliticaH2.hhmmToMin(seg.inicio);
        const b = PoliticaH2.hhmmToMin(seg.fin);
        const dur = Math.max(0, b - a);
        if (dur === 0) continue;

        switch (seg.tipo) {
          case "LIBRE":
            libreMinDia += dur;
            break;
          case "EXTRA":
            extraMinDia += dur;
            break;
          case "ALMUERZO":
            almuerzoMinDia += dur;
            break; // PROHIBIDO en H2
          case "NORMAL":
            normalMinDia += dur;
            break;
        }
      }

      const dow = new Date(`${f}T00:00:00`).getDay(); // 0=Dom, 2=Mar
      let esperadaNormalMin = 0;

      if (esFestivo || esLibre || !reg) {
        // Feriado/Libre: NORMAL debe ser 0; todo lo demás es EXTRA
        esperadaNormalMin = 0;
        if (normalMinDia > 0) {
          errores.push({
            fecha: f,
            motivo: "FERIADO_O_LIBRE_CON_NORMAL",
            detalle: { normalMinDia },
          });
        }
        if (almuerzoMinDia > 0) {
          errores.push({
            fecha: f,
            motivo: "ALMUERZO_NO_PERMITIDO_EN_H2",
            detalle: { almuerzoMinDia },
          });
        }
      } else {
        const e = new Date(reg.horaEntrada);
        const s = new Date(reg.horaSalida);
        const nocturno = PoliticaH2.esNocturno(e, s);

        // Esperado por día (sin almuerzo)
        // Si entrada == salida, no hay rango normal → esperadaNormalMin = 0
        const rangoNormalMin = PoliticaH2.normalesDeclaradosMin(e, s);
        if (rangoNormalMin === 0) {
          // Sin rango normal declarado → no se esperan horas normales
          esperadaNormalMin = 0;
        } else if (nocturno && dow === 2) {
          // Martes nocturno con rango normal → solo 6h normales (regla especial)
          esperadaNormalMin = 6 * 60;
        } else {
          // Otros días → usar rango normal completo
          esperadaNormalMin = rangoNormalMin;
        }

        // 1) Almuerzo jamás permitido en H2 (y tu regla específica pide error si aparece en horas normales)
        if (almuerzoMinDia > 0) {
          errores.push({
            fecha: f,
            motivo: "ALMUERZO_NO_PERMITIDO_EN_H2",
            detalle: { almuerzoMinDia },
          });
        }

        // 2) NORMAL debe coincidir exactamente con lo esperado (sin considerar almuerzo)
        // IMPORTANTE: Las horas compensatorias tomadas se despintan a LIBRE por el segmentador,
        // pero deben contarse en la validación como horas normales esperadas
        const compNormalesMinDia = Math.round(compNormalesHoras * 60);
        const normalMinDiaConCompensatorias = normalMinDia + compNormalesMinDia;

        if (normalMinDiaConCompensatorias !== esperadaNormalMin) {
          errores.push({
            fecha: f,
            motivo: "NORMAL_NO_COINCIDE_CON_INTERVALO",
            detalle: {
              normalMinDia,
              compNormalesMinDia,
              normalMinDiaConCompensatorias,
              esperadaNormalMin,
              entrada: e.toTimeString().slice(0, 5),
              salida: s.toTimeString().slice(0, 5),
              nocturno,
              esMartes: dow === 2,
            },
          });
        }
      }

      // Acumular totales
      normalMin += normalMinDia;
      p25Min += extraMinDia; // todas extras a p25
      libreMin += libreMinDia;

      f = PoliticaH2.addDays(f, 1);
    }

    // Cuadre global (24 h por día)
    const dias = PoliticaH2.dayCountInclusive(fechaInicio, fechaFin);
    const esperadoGlobalMin = dias * 24 * 60;
    const totalMin =
      normalMin +
      p25Min +
      libreMin +
      incapacidadEmpresaMin +
      incapacidadIHSSMin; /* + p50+p75+p100(0) + almuerzo(0) */

    if (totalMin !== esperadoGlobalMin) {
      errores.push({
        fecha: `${fechaInicio}..${fechaFin}`,
        motivo: "CUADRE_GLOBAL_INVALIDO",
        detalle: { totalMin, esperadoGlobalMin, dias },
      });
    }

    // Lanzar si hay cualquier error (incluye almuerzo no permitido)
    if (errores.length > 0) {
      throw new Error(
        `[H2] Validaciones fallidas: ${JSON.stringify(errores, null, 2)}`
      );
    }

    // Respuesta (horas a 2 decimales)
    const toHours = (m: number) => Math.round((m / 60) * 100) / 100;

    // Las horas compensatorias NO se cuentan en normalMin (el segmentador las excluye)
    // Ya están en sus buckets separados (compNormalesMin y compExtrasMin)
    const conteo: ConteoHorasTrabajadas = {
      fechaInicio,
      fechaFin,
      empleadoId,
      cantidadHoras: {
        normal: toHours(normalMin),
        p25: toHours(p25Min),
        p50: 0,
        p75: 0,
        p100: 0,
        libre: toHours(libreMin),
        almuerzo: 0,
        // Incapacidades NO se reportan en horas (solo en días literales)
        incapacidadEmpresa: 0,
        incapacidadIHSS: 0,
        // Horas compensatorias separadas por tipo (calculadas por el segmentador)
        horasCompensatoriasTomadas: toHours(compNormalesMin),
        horasCompensatoriasPagadas: toHours(compExtrasMin),
      },
    };

    // ---------------- Conteo en días (base 15) ----------------
    const totalPeriodo = 15;
    const horasVacaciones = 0;
    const horasPermisoCS = 0;
    const horasPermisoSS = 0;
    const horasInasistencias = 0;

    const diasVacaciones = horasVacaciones / 8;
    const diasPermisoCS = horasPermisoCS / 8;
    const diasPermisoSS = horasPermisoSS / 8;
    const diasInasistencias = horasInasistencias / 8;

    // Incapacidades: conteo en DÍAS LITERALES (no basado en horas)
    // Cada día con esIncapacidad=true cuenta como 1 día completo
    const diasIncapacidadEmpresa = incapacidadEmpresaMin / (24 * 60); // minutos a días literales
    const diasIncapacidadIHSS = incapacidadIHSSMin / (24 * 60); // minutos a días literales

    const diasNoLaborados =
      diasVacaciones +
      diasPermisoCS +
      diasPermisoSS +
      diasInasistencias +
      diasIncapacidadEmpresa +
      diasIncapacidadIHSS;
    const diasLaborados = totalPeriodo - diasNoLaborados;

    conteo.conteoDias = {
      totalPeriodo,
      diasLaborados,
      vacaciones: diasVacaciones,
      permisoConSueldo: diasPermisoCS,
      permisoSinSueldo: diasPermisoSS,
      inasistencias: diasInasistencias,
      incapacidadEmpresa: diasIncapacidadEmpresa,
      incapacidadIHSS: diasIncapacidadIHSS,
    };

    // Las deducciones de alimentación ahora se obtienen en un endpoint separado
    // para no retrasar el cálculo de horas
    conteo.deduccionesAlimentacion = 0;
    conteo.deduccionesAlimentacionDetalle = [];
    conteo.errorAlimentacion = undefined;

    return Object.assign(conteo, { tiposDias });
  }

  // --------------------- overrides abstract mínimos ---------------------
  protected getHorasLaborablesBase(): number {
    return 12;
  }
  protected getHorarioEstandar(): { inicio: string; fin: string } {
    return { inicio: "07:00", fin: "19:00" };
  }
  protected incluyeAlmuerzoDefault(): boolean {
    return false;
  }

  /**
   * Obtiene el prorrateo de horas por job para un empleado en un período
   */
  async getProrrateoHorasPorJobByDateAndEmpleado(
    fechaInicio: string,
    fechaFin: string,
    empleadoId: string
  ): Promise<ConteoHorasProrrateo> {
    if (
      !this.validarFormatoFecha(fechaInicio) ||
      !this.validarFormatoFecha(fechaFin)
    ) {
      throw new Error("Formato de fecha inválido. Use YYYY-MM-DD");
    }
    if (fechaFin < fechaInicio)
      throw new Error("El rango de fechas es inválido (fin < inicio).");

    // Obtener conteo de horas trabajadas
    const conteoHoras = await this.getConteoHorasTrabajadasByDateAndEmpleado(
      fechaInicio,
      fechaFin,
      empleadoId
    );

    // Mapas para acumular horas por job y categoría
    const horasPorJobNormal = new Map<
      number,
      {
        jobId: number;
        codigoJob: string;
        nombreJob: string;
        horas: number;
        comentarios: string[];
      }
    >();
    const horasPorJobP25 = new Map<
      number,
      {
        jobId: number;
        codigoJob: string;
        nombreJob: string;
        horas: number;
        comentarios: string[];
      }
    >();

    // Recorrer cada día del período y procesar actividades
    let currentDate = fechaInicio;
    while (currentDate <= fechaFin) {
      try {
        // Obtener registro diario con actividades
        const registroDiario = await this.getRegistroDiario(
          empleadoId,
          currentDate
        );

        if (!registroDiario) {
          currentDate = PoliticaH2.addDays(currentDate, 1);
          continue;
        }

        // Helper para agregar horas normales por job
        const upsertNormal = (
          jobId: number,
          codigo: string,
          nombre: string,
          horas: number,
          descripcion?: string | null
        ) => {
          if (horas <= 0) return;
          const existing = horasPorJobNormal.get(jobId);
          if (existing) {
            existing.horas += horas;
            if (descripcion && !existing.comentarios.includes(descripcion)) {
              existing.comentarios.push(descripcion);
            }
          } else {
            horasPorJobNormal.set(jobId, {
              jobId,
              codigoJob: codigo,
              nombreJob: nombre,
              horas,
              comentarios: descripcion ? [descripcion] : [],
            });
          }
        };

        // Helper para agregar horas extras (p25) por job
        const upsertExtra = (
          jobId: number,
          codigo: string,
          nombre: string,
          horas: number,
          descripcion?: string | null
        ) => {
          if (horas <= 0) return;
          const existing = horasPorJobP25.get(jobId);
          if (existing) {
            existing.horas += horas;
            if (descripcion && !existing.comentarios.includes(descripcion)) {
              existing.comentarios.push(descripcion);
            }
          } else {
            horasPorJobP25.set(jobId, {
              jobId,
              codigoJob: codigo,
              nombreJob: nombre,
              horas,
              comentarios: descripcion ? [descripcion] : [],
            });
          }
        };

        // Procesar actividades directamente (sin depender del segmentador para jobId)
        for (const act of (registroDiario as any).actividades ?? []) {
          // Obtener código y nombre del job
          const jobId = act?.jobId || act?.job?.id;
          const codigo = act?.job?.codigo ?? act?.codigoJob ?? "";
          const nombre = act?.job?.nombre ?? String(codigo);
          const descripcion =
            act?.descripcion ||
            (registroDiario as any)?.comentarioEmpleado ||
            null;

          if (!jobId && !codigo) continue;

          // Determinar si es actividad normal o extra
          if (!act?.esExtra) {
            // ACTIVIDAD NORMAL: usar duracionHoras directamente
            const horas = Number(act?.duracionHoras ?? 0);
            if (horas > 0) {
              // Si tenemos jobId, usarlo; si no, buscar por código
              const id = jobId || 0;
              upsertNormal(id, codigo, nombre, horas, descripcion);
            }
          } else {
            // ACTIVIDAD EXTRA: calcular horas desde horaInicio/horaFin o usar duracionHoras
            let horas = 0;

            if (act?.horaInicio && act?.horaFin) {
              const start = new Date(act.horaInicio);
              const end = new Date(act.horaFin);

              // Recortar al día actual
              const dayStart = new Date(`${currentDate}T00:00:00.000Z`);
              const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
              const s = new Date(Math.max(start.getTime(), dayStart.getTime()));
              const e = new Date(Math.min(end.getTime(), dayEnd.getTime()));

              if (e.getTime() > s.getTime()) {
                horas = (e.getTime() - s.getTime()) / 3_600_000; // ms a horas
              }
            } else {
              // Sin horas explícitas, usar duracionHoras
              horas = Number(act?.duracionHoras ?? 0);
            }

            if (horas > 0) {
              const id = jobId || 0;
              upsertExtra(id, codigo, nombre, horas, descripcion);
            }
          }
        }
      } catch (error) {
        console.error(`Error procesando día ${currentDate}:`, error);
      }

      // Avanzar al siguiente día
      currentDate = PoliticaH2.addDays(currentDate, 1);
    }

    // Convertir mapas a arrays
    const convertMapToArray = (
      map: Map<
        number,
        {
          jobId: number;
          codigoJob: string;
          nombreJob: string;
          horas: number;
          comentarios: string[];
        }
      >
    ): HorasPorJob[] => {
      return Array.from(map.values()).map((item) => ({
        jobId: item.jobId,
        codigoJob: item.codigoJob,
        nombreJob: item.nombreJob,
        cantidadHoras: Math.round(item.horas * 100) / 100,
        comentarios: item.comentarios,
      }));
    };

    // Construir resultado
    const resultado: ConteoHorasProrrateo = {
      fechaInicio,
      fechaFin,
      empleadoId,
      cantidadHoras: {
        normal: convertMapToArray(horasPorJobNormal),
        p25: convertMapToArray(horasPorJobP25),
        p50: [], // H2 no usa p50
        p75: [], // H2 no usa p75
        p100: [], // H2 no usa p100
        vacacionesHoras: conteoHoras.cantidadHoras.vacaciones || 0,
        permisoConSueldoHoras: conteoHoras.cantidadHoras.permisoConSueldo || 0,
        permisoSinSueldoHoras: conteoHoras.cantidadHoras.permisoSinSueldo || 0,
        inasistenciasHoras: conteoHoras.cantidadHoras.inasistencias || 0,
        totalHorasLaborables: conteoHoras.cantidadHoras.normal || 0,
        horasFeriado: 0,
        deduccionesISR: 0,
        deduccionesRAP: 0,
        deduccionesAlimentacion: 0,
        deduccionesIHSS: 0,
        Prestamo: 0,
        Total: 0,
      },
      validationErrors: {
        fechasNoAprobadas: [],
        fechasSinRegistro: [],
      },
    };

    return resultado;
  }
}
