// src/domain/calculo-horas/politicas-horario/H1Base.ts
import { PoliticaHorarioBase } from "./base";
import {
  ConteoHorasTrabajadas,
  HorarioTrabajo,
  ConteoHorasProrrateo,
  HorasPorJob,
} from "../types";
import type { Segmento15 } from "./segmentador";
import type { BandaExtraProrrateo } from "./prorrateo-class";
import {
  classKeyFromActividad,
  classKeyFromSegmentClass,
  createClassNameResolver,
  jobMapKey,
  prorrateoMapToHorasPorJob,
  upsertProrrateoJob,
  type ProrrateoJobAccum,
} from "./prorrateo-class";
import { JobRepository } from "../../../repositories/JobRepository";
import { SegmentadorTiempo } from "../segmentador-tiempo";
import { addDaysYmd } from "../../../utils/dateTime";
import type { ClasificacionIncapacidadDia } from "./incapacidad-secuencias";

/**
 * Clase base abstracta para políticas H1 y sus subtipos (H1.1, H1.2, H1.3)
 * Contiene toda la lógica común de cálculo de horas, prorrateo, etc.
 * Los subtipos solo deben sobrescribir getHorarioTrabajoByDateAndEmpleado
 * para cambiar cómo se genera el horario de trabajo.
 */
export abstract class PoliticaH1Base extends PoliticaHorarioBase {
  // -------------------------- utilidades locales --------------------------
  protected static HHMM_TO_MIN(hhmm: string): number {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }
  protected static segDurMin(seg: Segmento15): number {
    return (
      PoliticaH1Base.HHMM_TO_MIN(seg.fin) -
      PoliticaH1Base.HHMM_TO_MIN(seg.inicio)
    );
  }
  protected static isDiurna(seg: Segmento15): boolean {
    const start = PoliticaH1Base.HHMM_TO_MIN(seg.inicio);
    return start >= 5 * 60 && start < 19 * 60; // 05:00–19:00
  }

  /** Hay tramo EXTRA diurno (05–19) en el mismo bloque continuo (hasta el próximo LIBRE). */
  protected static hayExtraDiurnaEnBloqueExtra(
    segmentos: Segmento15[],
    desdeIdx: number
  ): boolean {
    for (let i = desdeIdx; i < segmentos.length; i++) {
      const seg = segmentos[i];
      if (seg.tipo === "LIBRE") break;
      if (seg.tipo === "EXTRA" && PoliticaH1Base.isDiurna(seg)) return true;
    }
    return false;
  }
  protected static addDays(iso: string, d: number): string {
    return addDaysYmd(iso, d);
  }
  protected static daysInclusive(a: string, b: string): number {
    const [Y1, M1, D1] = a.split("-").map(Number);
    const [Y2, M2, D2] = b.split("-").map(Number);
    const d1 = Date.UTC(Y1, M1 - 1, D1);
    const d2 = Date.UTC(Y2, M2 - 1, D2);
    return Math.floor((d2 - d1) / 86400000) + 1;
  }

  // Estado de racha que cruza días
  protected static nuevaRacha(): ExtraStreak {
    return {
      minutosExtraAcum: 0,
      minutosP50Acum: 0, // minutos clasificados específicamente como p50
      vistoDiurna: false,
      vistoNocturna: false,
      piso: 0,
      domOFestActivo: false, // arrastre de C4 a través de medianoche
      bloquearMixta: false, // deshabilitar p75 en días no laborables
      existeDiurnaExtra: false, // indica si hay tramo extra diurno (5-19h) en la racha
      hayExtraDiurnaEnBloque: false, // diurna EXTRA pendiente en el bloque actual del día
    };
  }
  protected static copiarRacha(r: ExtraStreak): ExtraStreak {
    return { ...r };
  }
  protected static rachaEsMixta(r: ExtraStreak): boolean {
    return r.minutosExtraAcum >= 180 && r.vistoDiurna && r.vistoNocturna; // 3h y ambas franjas
  }

  // Aplica un slot de 15 min de EXTRA a la racha y suma buckets
  protected static aplicarExtraSlot(
    esLibreOFest: boolean,
    esDiurna: boolean,
    r: ExtraStreak,
    b: Buckets
  ): BandaExtraProrrateo {
    // C4: 2.00× (libre/festiva) con arrastre entre días mientras no haya LIBRE
    // domOFestActivo solo aplica p100 si el día actual también es feriado/libre
    // Si el día actual NO es feriado/libre, domOFestActivo solo eleva el piso
    const arrastraC4 = esLibreOFest;
    if (arrastraC4) {
      b.extraC4Min += 15; // p100 para presentación
      r.domOFestActivo = true; // persiste hasta que la racha termine (LIBRE)
      r.minutosExtraAcum += 15;

      // Mantener racha subyacente completa (como si fuera día normal)
      const base = esDiurna ? 1.25 : 1.5;
      if (r.piso < base) r.piso = base;

      // Activar bandera si es diurno extra
      if (esDiurna) {
        r.existeDiurnaExtra = true;
      }

      // Acumular minutosP50Acum según la clasificación que tendría en día normal
      // Regla: se clasifica como p50 cuando piso >= 1.5 (sea diurna o nocturna)
      if (r.piso >= 1.5) {
        r.minutosP50Acum += 15;
      }

      if (esDiurna) r.vistoDiurna = true;
      else r.vistoNocturna = true;

      return "p100";
    }

    // No dominical/festiva → escalera normal
    // Si domOFestActivo está activo pero el día actual NO es feriado/libre,
    // solo usar domOFestActivo para elevar el piso, no para clasificar como p100
    const base = esDiurna ? 1.25 : 1.5;
    if (r.piso < base) r.piso = base;

    // Activar bandera si el slot actual es diurno (5-19h)
    // Se hace ANTES de verificar p75
    if (esDiurna) {
      r.existeDiurnaExtra = true;
    }

    // Verificar si se debe pasar a p75 (mixta o excedente nocturno)
    // Mixta: >=3h p50 y ya hubo extra diurna en la racha.
    // Excedente nocturno: >=3h p50, slot nocturno y sin extra diurna pendiente en el bloque
    // (incluye fracciones <1h; p.ej. 3h p50 + 0.5h p75 en 19:00–22:30).
    let aplicarP75 = false;
    if (!r.bloquearMixta && r.minutosP50Acum >= 180) {
      if (r.existeDiurnaExtra) {
        aplicarP75 = true;
      } else if (!esDiurna && !r.hayExtraDiurnaEnBloque) {
        aplicarP75 = true;
      }
    }

    const mult = aplicarP75 ? 1.75 : r.piso;

    if (mult >= 1.75) {
      b.extraC3Min += 15; // p75
      r.minutosExtraAcum += 15;
      if (esDiurna) r.vistoDiurna = true;
      else r.vistoNocturna = true;
      return "p75";
    }
    if (mult >= 1.5) {
      b.extraC2Min += 15; // p50
      r.minutosP50Acum += 15;
      r.minutosExtraAcum += 15;
      if (esDiurna) r.vistoDiurna = true;
      else r.vistoNocturna = true;
      return "p50";
    }

    b.extraC1Min += 15; // p25
    r.minutosExtraAcum += 15;
    if (esDiurna) r.vistoDiurna = true;
    else r.vistoNocturna = true;
    return "p25";
  }

  /**
   * Igual que `aplicarExtraSlot` para la racha (piso, minutosP50Acum, flags),
   * pero sin sumar minutos a buckets p25–p100: las compensatorias acumuladas
   * no son extras remuneradas; van en `compExtrasMin` / `horasCompensatoriasAcumuladas`.
   */
  protected static aplicarExtraSlotCompensatorioAcumulado(
    esLibreOFest: boolean,
    esDiurna: boolean,
    r: ExtraStreak
  ) {
    const arrastraC4 = esLibreOFest;
    if (arrastraC4) {
      r.domOFestActivo = true;
      r.minutosExtraAcum += 15;
      const base = esDiurna ? 1.25 : 1.5;
      if (r.piso < base) r.piso = base;
      if (esDiurna) r.existeDiurnaExtra = true;
      if (r.piso >= 1.5) r.minutosP50Acum += 15;
      if (esDiurna) r.vistoDiurna = true;
      else r.vistoNocturna = true;
      return;
    }

    const base = esDiurna ? 1.25 : 1.5;
    if (r.piso < base) r.piso = base;
    if (esDiurna) r.existeDiurnaExtra = true;

    let aplicarP75 = false;
    if (!r.bloquearMixta && r.minutosP50Acum >= 180) {
      if (r.existeDiurnaExtra) {
        aplicarP75 = true;
      } else if (!esDiurna && !r.hayExtraDiurnaEnBloque) {
        aplicarP75 = true;
      }
    }

    const mult = aplicarP75 ? 1.75 : r.piso;

    if (mult >= 1.75) {
      /* sin bucket p75 */
    } else if (mult >= 1.5) {
      r.minutosP50Acum += 15;
    } else {
      /* sin bucket p25 */
    }

    r.minutosExtraAcum += 15;
    if (esDiurna) r.vistoDiurna = true;
    else r.vistoNocturna = true;
  }

  protected static minutosAhoras(min: number): number {
    return Math.round((min / 60) * 100) / 100;
  }

  // -------------------------- implementación de conteo --------------------------

  /**
   * Resultado del procesamiento de un día individual
   */
  private static DayResultType: {
    buckets: Buckets;
    addVacacionesMin: number;
    addPermisoCSMin: number;
    addPermisoSSMin: number;
    addInasistenciasMin: number;
    addCompensatorioMin: number;
    /** null = día normal; 'empresa' = incapacidad cubierta por empresa; 'ihss' = cubierta por IHSS */
    incapacidadDia: "empresa" | "ihss" | null;
  };

  /**
   * Agrupa días consecutivos del mismo tipo de incapacidad en intervalos.
   * Retorna un array con el número de días de cada intervalo.
   * Ejemplo: [null,'empresa','empresa',null,'empresa'] → [2, 1]
   */
  private static groupIncapIntervals(
    tipos: ("empresa" | "ihss" | null)[],
    tipo: "empresa" | "ihss"
  ): number[] {
    const intervals: number[] = [];
    let count = 0;
    for (const t of tipos) {
      if (t === tipo) {
        count++;
      } else if (count > 0) {
        intervals.push(count);
        count = 0;
      }
    }
    if (count > 0) intervals.push(count);
    return intervals;
  }

  /**
   * Método de Restos Mayores (Largest Remainder Method).
   * Convierte días de incapacidad reales a días en base `baseDays` (= 15),
   * distribuyendo el redondeo a los intervalos con mayor parte decimal.
   *
   * @param intervalDays - Días de cada intervalo de incapacidad
   * @param quincenahDays - Días reales de la quincena (13, 14, 15 o 16)
   * @param baseDays - Base de cálculo (siempre 15)
   * @returns Total de días de incapacidad en base `baseDays`
   */
  private static lrmProportional(
    intervalDays: number[],
    quincenahDays: number,
    baseDays: number
  ): number {
    if (intervalDays.length === 0) return 0;
    if (quincenahDays === baseDays) return intervalDays.reduce((a, b) => a + b, 0);

    const raws = intervalDays.map((d) => (d / quincenahDays) * baseDays);
    const floors = raws.map((r) => Math.floor(r));
    const fracs = raws.map((r, i) => r - floors[i]);

    const target = Math.round(raws.reduce((a, b) => a + b, 0));
    const sumFloors = floors.reduce((a, b) => a + b, 0);
    const extra = Math.max(0, target - sumFloors);

    // Asignar los días extra a los intervalos con mayor parte decimal
    const indices = fracs
      .map((_, i) => i)
      .sort((a, b) => fracs[b] - fracs[a]);
    for (let i = 0; i < extra; i++) {
      floors[indices[i]]++;
    }

    return floors.reduce((a, b) => a + b, 0);
  }

  /**
   * Procesa un día completo de forma independiente.
   * Si el día empieza con EXTRA a las 00:00, obtiene la racha del día anterior.
   * Cada día se puede calcular en paralelo con otros días.
   */
  /**
   * Versión optimizada que recibe el empleado pre-cargado
   *
   * REGLA DE INCAPACIDAD:
   * - Si esIncapacidad=true en el registro diario:
   *   - Se asignan 24 horas (1440 min) de incapacidad = 1 día literal
   *   - Se ignoran todas las actividades del día
   *   - Ordinal en la secuencia consecutiva (día 1 encontrado con lookback):
   *     → días 1–3: incapacidadEmpresa
   *     → día 4+: incapacidadIHSS (montoIhssDiario=0 por ahora)
   *   - El conteo de días es LITERAL (1 día = 1 día, no basado en horas de 8 o 9)
   */
  private async procesarDiaCompletoOptimizado(
    fecha: string,
    empleadoId: string,
    empleado: any,
    clasificacionIncapacidad: Map<string, ClasificacionIncapacidadDia>
  ): Promise<typeof PoliticaH1Base.DayResultType> {
    // Solo 2 consultas por día: registro y feriado
    const [registroDelDia, feriadoInfo] = await Promise.all([
      this.getRegistroDiario(empleadoId, fecha),
      this.esFeriado(fecha),
    ]);


    // Buckets para este día
    const b: Buckets = {
      normalMin: 0,
      almuerzoMin: 0,
      libreMin: 0,
      extraC1Min: 0,
      extraC2Min: 0,
      extraC3Min: 0,
      extraC4Min: 0,
      incapacidadEmpresaMin: 0,
      incapacidadIHSSMin: 0,
      vacacionesMin: 0,
      permisoConSueldoMin: 0,
      permisoSinSueldoMin: 0,
      inasistenciasMin: 0,
      compensatorioMin: 0,
      compNormalesMin: 0,
      compExtrasMin: 0,
    };

    // Acumuladores de actividades sin hora
    let addVacacionesMin = 0;
    let addPermisoCSMin = 0;
    let addPermisoSSMin = 0;
    let addInasistenciasMin = 0;
    let addCompensatorioMin = 0;

    // ==================== MANEJO DE INCAPACIDAD ====================
    // Si el día está marcado como incapacidad, asignar 24h de incapacidad (1 día literal).
    // Se ignoran todas las actividades del día.
    if (registroDelDia?.esIncapacidad === true) {
      const HORAS_INCAPACIDAD_MIN = 24 * 60; // 1440 minutos = 24 horas = 1 día literal
      const clasificacion = clasificacionIncapacidad.get(fecha);
      const esIhss = clasificacion?.tipo === "ihss";

      if (esIhss) {
        b.incapacidadIHSSMin = HORAS_INCAPACIDAD_MIN;
      } else {
        b.incapacidadEmpresaMin = HORAS_INCAPACIDAD_MIN;
      }

      return {
        buckets: b,
        addVacacionesMin: 0,
        addPermisoCSMin: 0,
        addPermisoSSMin: 0,
        addInasistenciasMin: 0,
        addCompensatorioMin: 0,
        incapacidadDia: esIhss ? "ihss" : "empresa",
      };
    }

    // ==================== PROCESAMIENTO NORMAL (sin incapacidad) ====================
    // Segmentar usando el registro ya obtenido (sin consulta extra)
    const segmentosResult = this.segmentarConRegistro(fecha, registroDelDia);

    // Calcular horario de trabajo sin consultas adicionales (usando datos ya obtenidos)
    const hTrabajo = this.calcularHorarioTrabajoSinConsultas(
      fecha,
      empleadoId,
      feriadoInfo
    );

    const segmentos = segmentosResult.segmentos;

    // Extraer horas compensatorias calculadas por el segmentador
    const compNormalesHoras = segmentosResult.horasCompensatoriasTomadas;
    const compExtrasArray = segmentosResult.horasCompensatoriasAcumuladas;

    // Agregar horas compensatorias a los buckets (convertir de horas a minutos)
    b.compNormalesMin += Math.round(compNormalesHoras * 60);
    for (const comp of compExtrasArray) {
      b.compExtrasMin += Math.round(comp.cantidadHoras * 60);
    }

    // Determinar si necesitamos racha del día anterior
    let racha = PoliticaH1Base.nuevaRacha();
    const necesitaRachaAnterior = this.diaEmpiezaConExtraA00(segmentos);

    if (necesitaRachaAnterior) {
      racha = await this.obtenerRachaDelDiaAnterior(fecha, empleadoId);
    }

    // Info del día
    const esFestivo = feriadoInfo.esFeriado;
    const esDiaLibreMarcado = registroDelDia?.esDiaLibre === true;
    const esLibreOFest = esDiaLibreMarcado || esFestivo;

    // Bloquear mixta si es día libre de contrato
    const esDiaLibreContrato =
      hTrabajo.esDiaLibre ||
      hTrabajo.cantidadHorasLaborables === 0 ||
      hTrabajo.horarioTrabajo.inicio === hTrabajo.horarioTrabajo.fin;
    racha.bloquearMixta = esDiaLibreContrato;

    // Procesar segmentos del día
    for (let segIdx = 0; segIdx < segmentos.length; segIdx++) {
      const seg = segmentos[segIdx]!;
      const dur = PoliticaH1Base.segDurMin(seg);
      if (dur <= 0) continue;

      switch (seg.tipo) {
        case "LIBRE":
          b.libreMin += dur;
          racha = PoliticaH1Base.nuevaRacha();
          break;

        case "ALMUERZO":
          b.almuerzoMin += dur;
          break;

        case "NORMAL": {
          const code = seg.jobCodigo?.toUpperCase?.();
          // E01 ya no se maneja aquí - la incapacidad se maneja con el campo esIncapacidad
          if (code === "E02") {
            b.vacacionesMin += dur;
          } else if (code === "E03") {
            b.permisoConSueldoMin += dur;
          } else if (code === "E04") {
            b.permisoSinSueldoMin += dur;
          } else if (code === "E05") {
            b.inasistenciasMin += dur;
          } else if (code === "E06" || code === "E07") {
            b.compensatorioMin += dur;
          } else {
            b.normalMin += dur;
          }
          break;
        }

        case "EXTRA": {
          const slots = dur / 15;
          const esDiurna = PoliticaH1Base.isDiurna(seg);
          const esCompAcum = seg.esCompensatorio === true;
          racha.hayExtraDiurnaEnBloque =
            PoliticaH1Base.hayExtraDiurnaEnBloqueExtra(segmentos, segIdx);
          for (let i = 0; i < slots; i++) {
            if (esCompAcum) {
              PoliticaH1Base.aplicarExtraSlotCompensatorioAcumulado(
                esLibreOFest,
                esDiurna,
                racha
              );
            } else {
              void PoliticaH1Base.aplicarExtraSlot(
                esLibreOFest,
                esDiurna,
                racha,
                b
              );
            }
          }
          break;
        }
      }
    }

    // Procesar actividades sin hora (jobs especiales)
    // NOTA: E01 ya no se maneja aquí - la incapacidad se maneja con el campo esIncapacidad
    // NOTA: Las horas compensatorias ya se procesaron en el segmentador
    try {
      if (registroDelDia?.actividades?.length) {
        for (const act of registroDelDia.actividades as any[]) {
          // Ignorar actividades compensatorias (ya procesadas por el segmentador)
          if (act?.esCompensatorio === true) continue;

          // Si es extra, ya se procesó en segmentos, skip
          if (act?.esExtra) continue;

          const horas = Number(act?.duracionHoras ?? 0);
          if (!isFinite(horas) || horas <= 0) continue;
          const min = Math.round(horas * 60);
          const codigo = act?.job?.codigo?.toUpperCase?.();

          // Actividades normales con jobs especiales
          if (!codigo) continue;
          // E01 ya no se procesa - incapacidad se maneja con esIncapacidad del registro
          if (codigo === "E02") addVacacionesMin += min;
          else if (codigo === "E03") addPermisoCSMin += min;
          else if (codigo === "E04") addPermisoSSMin += min;
          else if (codigo === "E05") addInasistenciasMin += min;
          else if (codigo === "E06" || codigo === "E07")
            addCompensatorioMin += min;
        }
      }
    } catch {
      /* ignore */
    }

    // Regla: si la totalidad de horas normales del día son de vacaciones (E02),
    // se limita a 8h (jornada legal ordinaria). El exceso se transfiere a libre
    // para mantener el cuadre de 24h.
    const totalVacActivMin = b.vacacionesMin + addVacacionesMin;
    if (totalVacActivMin > 0 && b.normalMin > 0 && totalVacActivMin >= b.normalMin) {
      const capMin = Math.min(b.normalMin, 8 * 60);
      const excessMin = b.normalMin - capMin;
      if (excessMin > 0) {
        b.normalMin = capMin;
        b.libreMin += excessMin;
      }
      addVacacionesMin = Math.max(0, capMin - b.vacacionesMin);
    }

    return {
      buckets: b,
      addVacacionesMin,
      addPermisoCSMin,
      addPermisoSSMin,
      addInasistenciasMin,
      addCompensatorioMin,
      incapacidadDia: null,
    };
  }

  /**
   * Calcula el horario de trabajo sin hacer consultas a la BD
   * (usa el feriadoInfo ya obtenido en paralelo)
   */
  protected calcularHorarioTrabajoSinConsultas(
    fecha: string,
    empleadoId: string,
    feriadoInfo: { esFeriado: boolean; nombre: string }
  ): HorarioTrabajo {
    const dia = new Date(`${fecha}T00:00:00`).getDay(); // 0=Dom

    let inicio = "07:00";
    let fin = "07:00";
    let incluyeAlmuerzo = false;
    let cantidadHorasLaborables = 0;
    let esDiaLibre = false;

    // Los feriados y domingos marcan el día como "día libre"
    if (feriadoInfo.esFeriado) {
      esDiaLibre = true;
    } else {
      switch (dia) {
        case 0: // Domingo
          esDiaLibre = true;
          break;
        case 6: // Sábado
          break;
        case 5: // Viernes
          fin = "16:00";
          incluyeAlmuerzo = true;
          cantidadHorasLaborables = 8;
          break;
        default: // Lunes a Jueves
          fin = "17:00";
          incluyeAlmuerzo = true;
          cantidadHorasLaborables = 9;
          break;
      }
    }

    return {
      tipoHorario: "H1",
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

  /**
   * Verifica si un día empieza con EXTRA a las 00:00
   */
  private diaEmpiezaConExtraA00(segmentos: Segmento15[]): boolean {
    for (const seg of segmentos) {
      if (seg.tipo === "LIBRE") return false;
      if (seg.tipo === "EXTRA") {
        const inicio = seg.inicio.substring(0, 5);
        return inicio === "00:00";
      }
    }
    return false;
  }

  /**
   * Obtiene la racha final del día anterior (simulando todo el día)
   */
  private async obtenerRachaDelDiaAnterior(
    fecha: string,
    empleadoId: string
  ): Promise<ExtraStreak> {
    const diaAnterior = PoliticaH1Base.addDays(fecha, -1);
    let r = PoliticaH1Base.nuevaRacha();

    try {
      const [registroAnterior, feriadoInfoAnterior] = await Promise.all([
        this.getRegistroDiario(empleadoId, diaAnterior),
        this.esFeriado(diaAnterior),
      ]);

      // Segmentar usando el registro ya obtenido (evita consulta duplicada)
      const segmentosResult = this.segmentarConRegistro(
        diaAnterior,
        registroAnterior
      );

      const esLibreOFestAnterior =
        registroAnterior?.esDiaLibre === true || feriadoInfoAnterior.esFeriado;
      const segmentos = segmentosResult.segmentos;

      let huboExtra = false;

      for (const seg of segmentos) {
        const dur = PoliticaH1Base.segDurMin(seg);
        if (dur <= 0) continue;

        if (seg.tipo === "LIBRE") {
          if (huboExtra) {
            r = PoliticaH1Base.nuevaRacha();
            huboExtra = false;
          }
          continue;
        }

        if (seg.tipo === "ALMUERZO" || seg.tipo === "NORMAL") continue;

        // EXTRA
        huboExtra = true;
        const slots = dur / 15;
        const esDiurna = PoliticaH1Base.isDiurna(seg);
        const esCompAcum = seg.esCompensatorio === true;
        for (let i = 0; i < slots; i++) {
          if (esCompAcum) {
            PoliticaH1Base.aplicarExtraSlotCompensatorioAcumulado(
              esLibreOFestAnterior,
              esDiurna,
              r
            );
          } else {
            void PoliticaH1Base.aplicarExtraSlot(
              esLibreOFestAnterior,
              esDiurna,
              r,
              DUMMY_BUCKETS
            );
          }
        }
      }

      return r;
    } catch {
      return PoliticaH1Base.nuevaRacha();
    }
  }

  async getConteoHorasTrabajajadasByDateAndEmpleado(
    fechaInicio: string,
    fechaFin: string,
    empleadoId: string
  ): Promise<ConteoHorasTrabajadas> {
    if (
      !this.validarFormatoFecha(fechaInicio) ||
      !this.validarFormatoFecha(fechaFin)
    ) {
      throw new Error("Formato de fecha inválido. Use YYYY-MM-DD");
    }
    if (fechaFin < fechaInicio)
      throw new Error("El rango de fechas es inválido (fin < inicio).");

    // ==================== PROCESAMIENTO 100% PARALELO POR DÍA ====================
    // Generar lista de fechas del rango
    const fechas: string[] = [];
    let f = fechaInicio;
    while (f <= fechaFin) {
      fechas.push(f);
      f = PoliticaH1Base.addDays(f, 1);
    }

    // Pre-cargar datos compartidos UNA SOLA VEZ (empleado es el mismo para todos los días)
    const empleado = await this.getEmpleado(empleadoId);
    if (!empleado)
      throw new Error(`Empleado con ID ${empleadoId} no encontrado`);

    const {
      clasificacionPorFecha: clasificacionIncapacidad,
      errores: erroresIncapacidad,
      incapacidadIhss,
    } = await this.resolverSecuenciasIncapacidadEnRango(
      empleadoId,
      fechaInicio,
      fechaFin
    );

    if (erroresIncapacidad.length > 0) {
      this.lanzarErroresValidacionIncapacidad(erroresIncapacidad);
    }

    // Procesar TODOS los días en paralelo (sin deducciones de alimentación)
    const resultadosPorDia = await Promise.all(
      fechas.map((fecha) =>
        this.procesarDiaCompletoOptimizado(
          fecha,
          empleadoId,
          empleado,
          clasificacionIncapacidad
        )
      )
    );

    // ==================== AGREGAR RESULTADOS ====================
    const b: Buckets = {
      normalMin: 0,
      almuerzoMin: 0,
      libreMin: 0,
      extraC1Min: 0,
      extraC2Min: 0,
      extraC3Min: 0,
      extraC4Min: 0,
      incapacidadEmpresaMin: 0,
      incapacidadIHSSMin: 0,
      vacacionesMin: 0,
      permisoConSueldoMin: 0,
      permisoSinSueldoMin: 0,
      inasistenciasMin: 0,
      compensatorioMin: 0,
      compNormalesMin: 0,
      compExtrasMin: 0,
    };

    let addVacacionesMin = 0;
    let addPermisoCSMin = 0;
    let addPermisoSSMin = 0;
    let addInasistenciasMin = 0;
    let addCompensatorioMin = 0;

    // Sumar todos los buckets de cada día y recolectar tipos de incapacidad
    const tiposIncapPorDia = resultadosPorDia.map((r) => r.incapacidadDia);

    for (const resultado of resultadosPorDia) {
      b.normalMin += resultado.buckets.normalMin;
      b.almuerzoMin += resultado.buckets.almuerzoMin;
      b.libreMin += resultado.buckets.libreMin;
      b.extraC1Min += resultado.buckets.extraC1Min;
      b.extraC2Min += resultado.buckets.extraC2Min;
      b.extraC3Min += resultado.buckets.extraC3Min;
      b.extraC4Min += resultado.buckets.extraC4Min;
      b.incapacidadEmpresaMin += resultado.buckets.incapacidadEmpresaMin;
      b.incapacidadIHSSMin += resultado.buckets.incapacidadIHSSMin;
      b.vacacionesMin += resultado.buckets.vacacionesMin;
      b.permisoConSueldoMin += resultado.buckets.permisoConSueldoMin;
      b.permisoSinSueldoMin += resultado.buckets.permisoSinSueldoMin;
      b.inasistenciasMin += resultado.buckets.inasistenciasMin;
      b.compensatorioMin += resultado.buckets.compensatorioMin;
      b.compNormalesMin += resultado.buckets.compNormalesMin;
      b.compExtrasMin += resultado.buckets.compExtrasMin;

      addVacacionesMin += resultado.addVacacionesMin;
      addPermisoCSMin += resultado.addPermisoCSMin;
      addPermisoSSMin += resultado.addPermisoSSMin;
      addInasistenciasMin += resultado.addInasistenciasMin;
      addCompensatorioMin += resultado.addCompensatorioMin;
    }

    // Validar cuadre (en minutos): debe ser 24h * número de días
    // NOTA: Las horas de incapacidad (empresa + IHSS) se incluyen en el cuadre porque
    // cuando esIncapacidad=true se asignan 24h de incapacidad = 1 día literal completo
    const dias = PoliticaH1Base.daysInclusive(fechaInicio, fechaFin);
    const esperadoMin = dias * 24 * 60;
    // Cuadre 24h: las compensatorias tomadas vienen como LIBRE en el segmentador (mismo tiempo
    // que compNormalesMin). Se descompone libre = (libre − tomadas) + tomadas para que totalMin
    // refleje explícitamente la suma de compensatorias tomadas sin duplicar minutos.
    const libreSinCompTomadas = Math.max(0, b.libreMin - b.compNormalesMin);
    const totalMin =
      b.normalMin +
      b.almuerzoMin +
      libreSinCompTomadas +
      b.extraC1Min +
      b.extraC2Min +
      b.extraC3Min +
      b.extraC4Min +
      b.incapacidadEmpresaMin +
      b.incapacidadIHSSMin +
      // Extras compensatorias acumuladas no van a p25–p100; minutos solo en compExtrasMin
      b.compExtrasMin +
      b.compNormalesMin;

    if (totalMin !== esperadoMin) {
      throw new Error(
        `[H1] Cuadre inválido: total=${totalMin} min, esperado=${esperadoMin} min` +
          ` (dias=${dias}, rango=${fechaInicio}..${fechaFin})`
      );
    }

    // Mapear a interfaz (horas)
    const totalEspecialesAddMin =
      addVacacionesMin +
      addPermisoCSMin +
      addPermisoSSMin +
      addCompensatorioMin;

    // Las horas compensatorias NO se cuentan en normalMin (el segmentador las excluye)
    // Ya están en sus buckets separados (compNormalesMin y compExtrasMin)
    const result: ConteoHorasTrabajadas = {
      fechaInicio,
      fechaFin,
      empleadoId,
      cantidadHoras: {
        normal: PoliticaH1Base.minutosAhoras(
          Math.max(0, b.normalMin - totalEspecialesAddMin)
        ),
        p25: PoliticaH1Base.minutosAhoras(b.extraC1Min),
        p50: PoliticaH1Base.minutosAhoras(b.extraC2Min),
        p75: PoliticaH1Base.minutosAhoras(b.extraC3Min),
        p100: PoliticaH1Base.minutosAhoras(b.extraC4Min),
        libre: PoliticaH1Base.minutosAhoras(b.libreMin),
        almuerzo: PoliticaH1Base.minutosAhoras(b.almuerzoMin),
        // Incapacidades NO se reportan en horas (solo en días literales)
        incapacidadEmpresa: 0,
        incapacidadIHSS: 0,
        vacaciones: PoliticaH1Base.minutosAhoras(
          b.vacacionesMin + addVacacionesMin
        ),
        permisoConSueldo: PoliticaH1Base.minutosAhoras(
          b.permisoConSueldoMin + addPermisoCSMin
        ),
        permisoSinSueldo: PoliticaH1Base.minutosAhoras(
          b.permisoSinSueldoMin + addPermisoSSMin
        ),
        inasistencias: PoliticaH1Base.minutosAhoras(
          b.inasistenciasMin + addInasistenciasMin
        ),
        compensatorio: PoliticaH1Base.minutosAhoras(
          b.compensatorioMin + addCompensatorioMin
        ),
        // Horas compensatorias separadas por tipo (calculadas por el segmentador)
        horasCompensatoriasTomadas: PoliticaH1Base.minutosAhoras(
          b.compNormalesMin
        ),
        horasCompensatoriasAcumuladas: PoliticaH1Base.minutosAhoras(
          b.compExtrasMin
        ),
      },
    };

    // ---------------- Conteo en días (base 15) ----------------
    // totalPeriodo = 15 siempre (es la base proporcional de la quincena).
    // quincenahDays = días reales del rango consultado (puede ser 13, 14, 15 o 16).
    const totalPeriodo = 15;
    const quincenahDays = fechas.length;

    const horasVacaciones = PoliticaH1Base.minutosAhoras(
      b.vacacionesMin + addVacacionesMin
    );
    const horasPermisoCS = PoliticaH1Base.minutosAhoras(
      b.permisoConSueldoMin + addPermisoCSMin
    );
    const horasPermisoSS = PoliticaH1Base.minutosAhoras(
      b.permisoSinSueldoMin + addPermisoSSMin
    );
    const horasInasistencias = PoliticaH1Base.minutosAhoras(
      b.inasistenciasMin + addInasistenciasMin
    );

    const diasVacaciones = horasVacaciones / 8;
    const diasPermisoCS = horasPermisoCS / 8;
    const diasPermisoSS = horasPermisoSS / 8;
    const diasInasistencias = horasInasistencias / 8;
    const horasCompTomadas = PoliticaH1Base.minutosAhoras(b.compNormalesMin);
    const diasCompensatoriasTomadas = horasCompTomadas / 8;

    // Incapacidades: Método de Restos Mayores (LRM) en base 15.
    // Los días reales de cada intervalo se convierten a días en base 15,
    // distribuyendo el redondeo a los intervalos con mayor parte decimal.
    const intervalosEmpresa = PoliticaH1Base.groupIncapIntervals(
      tiposIncapPorDia,
      "empresa"
    );
    const intervalosIHSS = PoliticaH1Base.groupIncapIntervals(
      tiposIncapPorDia,
      "ihss"
    );
    const diasIncapacidadEmpresa = PoliticaH1Base.lrmProportional(
      intervalosEmpresa,
      quincenahDays,
      totalPeriodo
    );
    const diasIncapacidadIHSS = PoliticaH1Base.lrmProportional(
      intervalosIHSS,
      quincenahDays,
      totalPeriodo
    );

    // diasDespuesIncapacidad: días del período base que quedan disponibles
    // tras descontar los días de incapacidad (en base 15).
    const totalIncapacidad = diasIncapacidadEmpresa + diasIncapacidadIHSS;
    const diasDespuesIncapacidad = totalPeriodo - totalIncapacidad;

    const diasNoLaboradosPorEspeciales =
      diasVacaciones + diasPermisoCS + diasPermisoSS + diasInasistencias;
    const diasLaborados = Math.max(
      0,
      diasDespuesIncapacidad - diasNoLaboradosPorEspeciales
    );

    result.conteoDias = {
      totalPeriodo,
      diasLaborados,
      vacaciones: diasVacaciones,
      permisoConSueldo: diasPermisoCS,
      permisoSinSueldo: diasPermisoSS,
      inasistencias: diasInasistencias,
      incapacidadEmpresa: diasIncapacidadEmpresa,
      incapacidadIHSS: diasIncapacidadIHSS,
      compensatoriasTomadas: diasCompensatoriasTomadas,
    };

    result.incapacidadIhss = incapacidadIhss;

    // Las deducciones de alimentación ahora se obtienen en un endpoint separado
    // para no retrasar el cálculo de horas
    result.deduccionesAlimentacion = 0;
    result.deduccionesAlimentacionDetalle = [];
    result.errorAlimentacion = undefined;

    return result;
  }

  // -------------------------- otros métodos requeridos --------------------------

  protected getHorasLaborablesBase(): number {
    return 9; // referencial
  }

  protected getHorarioEstandar(): { inicio: string; fin: string } {
    return { inicio: "07:00", fin: "17:00" }; // L–J
  }

  protected incluyeAlmuerzoDefault(): boolean {
    return true;
  }

  /**
   * Método abstracto que debe ser implementado por cada subtipo de H1
   * para definir cómo se genera el horario de trabajo según la fecha
   */
  abstract getHorarioTrabajoByDateAndEmpleado(
    fecha: string,
    empleadoId: string
  ): Promise<HorarioTrabajo>;

  /**
   * Acumula prorrateo de un día (H1): mismas reglas de bandas que conteo, desglose por class.
   */
  private async acumularProrrateoDiaH1(
    currentDate: string,
    empleadoId: string,
    registroDiario: any,
    maps: {
      normal: Map<number, ProrrateoJobAccum>;
      p25: Map<number, ProrrateoJobAccum>;
      p50: Map<number, ProrrateoJobAccum>;
      p75: Map<number, ProrrateoJobAccum>;
      p100: Map<number, ProrrateoJobAccum>;
      compTom: Map<number, ProrrateoJobAccum>;
      compAcum: Map<number, ProrrateoJobAccum>;
    },
    baseKey: number,
    fechasConJobDesconocido: Set<string>
  ): Promise<number> {
    for (const act of registroDiario.actividades ?? []) {
      if ((act?.codigoJob || act?.jobCodigo) && !act?.job) {
        fechasConJobDesconocido.add(currentDate);
        break;
      }
    }

    const feriadoInfo = await this.esFeriado(currentDate);
    const hTrabajo = await this.getHorarioTrabajoByDateAndEmpleado(
      currentDate,
      empleadoId
    );
    const segmentosResult = this.segmentarConRegistro(
      currentDate,
      registroDiario
    );
    const segmentos = segmentosResult.segmentos;

    let racha = PoliticaH1Base.nuevaRacha();
    if (this.diaEmpiezaConExtraA00(segmentos)) {
      racha = await this.obtenerRachaDelDiaAnterior(currentDate, empleadoId);
    }

    const esFestivo = feriadoInfo.esFeriado;
    const esLibreOFest =
      registroDiario?.esDiaLibre === true || esFestivo;
    const esDiaLibreContrato =
      hTrabajo.esDiaLibre ||
      hTrabajo.cantidadHorasLaborables === 0 ||
      hTrabajo.horarioTrabajo.inicio === hTrabajo.horarioTrabajo.fin;
    racha.bloquearMixta = esDiaLibreContrato;

    const horasFeriadoDia = Number(registroDiario?.horasFeriado ?? 0);
    if (horasFeriadoDia > 0) {
      upsertProrrateoJob(
        maps.normal,
        jobMapKey(baseKey, "00"),
        baseKey,
        "00",
        "Feriados",
        "null",
        horasFeriadoDia
      );
    }

    const bandMaps: Record<BandaExtraProrrateo, Map<number, ProrrateoJobAccum>> =
      {
        p25: maps.p25,
        p50: maps.p50,
        p75: maps.p75,
        p100: maps.p100,
      };

    const SLOT_MIN = 15;
    const slotHoras = SLOT_MIN / 60;

    for (let segIdx = 0; segIdx < segmentos.length; segIdx++) {
      const seg = segmentos[segIdx]!;
      const durMin = PoliticaH1Base.segDurMin(seg);
      if (durMin <= 0) continue;
      const horasSeg = durMin / 60;

      if (seg.tipo === "LIBRE") {
        racha = PoliticaH1Base.nuevaRacha();
        continue;
      }

      if (seg.tipo === "ALMUERZO") continue;

      const codigo = seg.jobCodigo ?? "";
      if (!codigo) continue;
      const nombre = seg.jobNombre ?? String(codigo);
      const classKey = classKeyFromSegmentClass(seg.className ?? null);
      const desc = seg.descripcion ?? null;

      if (seg.tipo === "NORMAL") {
        const code = codigo.toUpperCase();
        if (
          code === "E02" ||
          code === "E03" ||
          code === "E04" ||
          code === "E05" ||
          code === "E06" ||
          code === "E07"
        ) {
          continue;
        }
        upsertProrrateoJob(
          maps.normal,
          jobMapKey(baseKey, codigo),
          baseKey,
          codigo,
          nombre,
          classKey,
          horasSeg,
          desc
        );
        continue;
      }

      if (seg.tipo === "EXTRA") {
        const slots = durMin / SLOT_MIN;
        const esDiurna = PoliticaH1Base.isDiurna(seg);
        racha.hayExtraDiurnaEnBloque =
          PoliticaH1Base.hayExtraDiurnaEnBloqueExtra(segmentos, segIdx);
        if (seg.esCompensatorio === true) {
          for (let i = 0; i < slots; i++) {
            PoliticaH1Base.aplicarExtraSlotCompensatorioAcumulado(
              esLibreOFest,
              esDiurna,
              racha
            );
          }
          upsertProrrateoJob(
            maps.compAcum,
            jobMapKey(baseKey, codigo),
            baseKey,
            codigo,
            nombre,
            classKey,
            horasSeg,
            desc
          );
        } else {
          for (let i = 0; i < slots; i++) {
            const band = PoliticaH1Base.aplicarExtraSlot(
              esLibreOFest,
              esDiurna,
              racha,
              DUMMY_BUCKETS
            );
            upsertProrrateoJob(
              bandMaps[band],
              jobMapKey(baseKey, codigo),
              baseKey,
              codigo,
              nombre,
              classKey,
              slotHoras,
              desc
            );
          }
        }
      }
    }

    for (const act of registroDiario.actividades ?? []) {
      const classKey = classKeyFromActividad(act);
      const desc =
        act?.descripcion ||
        act?.comentario ||
        registroDiario?.comentarioEmpleado ||
        null;

      // Compensatorias tomadas: pueden ir sin job (banco de horas); siempre acumular comentarios
      if (!act?.esExtra && act?.esCompensatorio === true) {
        const horas =
          act?.horaInicio && act?.horaFin
            ? this.horasActividadConRangoHorario(act)
            : Number(act?.duracionHoras ?? 0);
        if (horas > 0) {
          const codigoComp =
            act?.job?.codigo ?? act?.codigoJob ?? act?.jobCodigo ?? "—";
          const jobIdComp = act?.jobId || act?.job?.id || baseKey;
          const nombreComp =
            act?.job?.nombre ??
            (codigoComp === "—"
              ? "Compensatorias tomadas"
              : String(codigoComp));
          upsertProrrateoJob(
            maps.compTom,
            jobMapKey(jobIdComp, codigoComp),
            jobIdComp,
            codigoComp,
            nombreComp,
            classKey,
            horas,
            desc
          );
        }
        continue;
      }

      const codigo =
        act?.job?.codigo ?? act?.codigoJob ?? act?.jobCodigo ?? "";
      if (!codigo) continue;
      const nombre = act?.job?.nombre ?? String(codigo);

      if (!act?.esExtra) {
        if (act?.horaInicio && act?.horaFin) continue;
        const horas = Number(act?.duracionHoras ?? 0);
        if (horas > 0) {
          upsertProrrateoJob(
            maps.normal,
            jobMapKey(baseKey, codigo),
            baseKey,
            codigo,
            nombre,
            classKey,
            horas,
            desc
          );
        }
        continue;
      }

      if (act?.esCompensatorio === true) {
        if (act?.horaInicio && act?.horaFin) continue;
        const horas = this.horasActividadConRangoHorario(act);
        if (horas > 0) {
          upsertProrrateoJob(
            maps.compAcum,
            jobMapKey(baseKey, codigo),
            baseKey,
            codigo,
            nombre,
            classKey,
            horas,
            desc
          );
        }
        continue;
      }

      if (act?.horaInicio && act?.horaFin) continue;

      const horas = Number(act?.duracionHoras ?? 0);
      if (horas > 0) {
        upsertProrrateoJob(
          maps.p25,
          jobMapKey(baseKey, codigo),
          baseKey,
          codigo,
          nombre,
          classKey,
          horas,
          desc
        );
      }
    }

    return horasFeriadoDia;
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

    // Obtener conteo de horas trabajadas (para obtener los segmentos clasificados)
    const conteoHoras = await this.getConteoHorasTrabajadasByDateAndEmpleado(
      fechaInicio,
      fechaFin,
      empleadoId
    );

    const resolveNombreClass = await createClassNameResolver();
    const horasPorJobNormal = new Map<number, ProrrateoJobAccum>();
    const horasPorJobP25 = new Map<number, ProrrateoJobAccum>();
    const horasPorJobP50 = new Map<number, ProrrateoJobAccum>();
    const horasPorJobP75 = new Map<number, ProrrateoJobAccum>();
    const horasPorJobP100 = new Map<number, ProrrateoJobAccum>();
    const horasPorJobCompTomadas = new Map<number, ProrrateoJobAccum>();
    const horasPorJobCompAcumuladas = new Map<number, ProrrateoJobAccum>();

    const baseKey = 0;
    const fechasConJobDesconocido = new Set<string>();
    let totalHorasFeriado = 0;
    let currentDate = fechaInicio;

    while (currentDate <= fechaFin) {
      try {
        const registroDiario = await this.getRegistroDiario(
          empleadoId,
          currentDate
        );
        if (!registroDiario) {
          currentDate = PoliticaH1Base.addDays(currentDate, 1);
          continue;
        }

        totalHorasFeriado += await this.acumularProrrateoDiaH1(
          currentDate,
          empleadoId,
          registroDiario,
          {
            normal: horasPorJobNormal,
            p25: horasPorJobP25,
            p50: horasPorJobP50,
            p75: horasPorJobP75,
            p100: horasPorJobP100,
            compTom: horasPorJobCompTomadas,
            compAcum: horasPorJobCompAcumuladas,
          },
          baseKey,
          fechasConJobDesconocido
        );
      } catch (error) {
        console.error(`Error procesando día ${currentDate}:`, error);
      }
      currentDate = PoliticaH1Base.addDays(currentDate, 1);
    }

    const resultado: ConteoHorasProrrateo = {
      fechaInicio,
      fechaFin,
      empleadoId,
      cantidadHoras: {
        normal: prorrateoMapToHorasPorJob(horasPorJobNormal, resolveNombreClass),
        p25: prorrateoMapToHorasPorJob(horasPorJobP25, resolveNombreClass),
        p50: prorrateoMapToHorasPorJob(horasPorJobP50, resolveNombreClass),
        p75: prorrateoMapToHorasPorJob(horasPorJobP75, resolveNombreClass),
        p100: prorrateoMapToHorasPorJob(horasPorJobP100, resolveNombreClass),
        vacacionesHoras: conteoHoras.cantidadHoras.vacaciones || 0,
        permisoConSueldoHoras: conteoHoras.cantidadHoras.permisoConSueldo || 0,
        permisoSinSueldoHoras: conteoHoras.cantidadHoras.permisoSinSueldo || 0,
        inasistenciasHoras: conteoHoras.cantidadHoras.inasistencias || 0,
        totalHorasLaborables: conteoHoras.cantidadHoras.normal || 0,
        horasCompensatoriasTomadas:
          conteoHoras.cantidadHoras.horasCompensatoriasTomadas,
        horasCompensatoriasTomadasPorJob: prorrateoMapToHorasPorJob(
          horasPorJobCompTomadas,
          resolveNombreClass
        ),
        horasCompensatoriasAcumuladasPorJob: prorrateoMapToHorasPorJob(
          horasPorJobCompAcumuladas,
          resolveNombreClass
        ),
        horasFeriado: totalHorasFeriado,
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
        // E01 Job Desconocido: notificar en stack sin lanzar; mensaje: "No se pueden realizar cálculos con Job desconocidos"
        fechasConJobDesconocido:
          fechasConJobDesconocido.size > 0
            ? Array.from(fechasConJobDesconocido).sort()
            : undefined,
      },
    };

    return resultado;
  }
}

/* ----------------------- tipos auxiliares internos ----------------------- */

type ExtraStreak = {
  minutosExtraAcum: number; // total EXTRA desde último LIBRE
  minutosP50Acum: number; // minutos clasificados específicamente como p50
  vistoDiurna: boolean;
  vistoNocturna: boolean;
  piso: number; // 0 | 1.25 | 1.5 (no decrece)
  domOFestActivo: boolean; // arrastre de p100 entre días
  bloquearMixta: boolean; // deshabilita p75 en no laborables
  existeDiurnaExtra: boolean; // indica si hay tramo extra diurno (5-19h) en la racha
  hayExtraDiurnaEnBloque: boolean; // extra diurna pendiente en el bloque actual (hasta LIBRE)
};

type Buckets = {
  normalMin: number;
  almuerzoMin: number;
  libreMin: number;
  extraC1Min: number; // p25
  extraC2Min: number; // p50
  extraC3Min: number; // p75
  extraC4Min: number; // p100
  // Incapacidades (basado en campo esIncapacidad del registro diario)
  incapacidadEmpresaMin: number; // Primeros 3 días consecutivos
  incapacidadIHSSMin: number; // A partir del 4to día consecutivo
  // normales por jobs especiales (minutos)
  vacacionesMin: number; // E02
  permisoConSueldoMin: number; // E03
  permisoSinSueldoMin: number; // E04
  inasistenciasMin: number; // E05
  compensatorioMin: number; // E06, E07 (deprecated - usar compNormalesMin/compExtrasMin)
  // Horas compensatorias separadas por tipo
  compNormalesMin: number; // Horas normales con esCompensatorio=true (se restan de normales)
  compExtrasMin: number; // Horas extras con esCompensatorio=true (no se cuentan como extras)
};

const DUMMY_BUCKETS: Buckets = {
  normalMin: 0,
  almuerzoMin: 0,
  libreMin: 0,
  extraC1Min: 0,
  extraC2Min: 0,
  extraC3Min: 0,
  extraC4Min: 0,
  incapacidadEmpresaMin: 0,
  incapacidadIHSSMin: 0,
  vacacionesMin: 0,
  permisoConSueldoMin: 0,
  permisoSinSueldoMin: 0,
  inasistenciasMin: 0,
  compensatorioMin: 0,
  compNormalesMin: 0,
  compExtrasMin: 0,
};
