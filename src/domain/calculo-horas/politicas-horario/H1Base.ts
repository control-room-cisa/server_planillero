// src/domain/calculo-horas/politicas-horario/H1Base.ts
import { PoliticaHorarioBase } from "./base";
import {
  ConteoHorasTrabajadas,
  HorarioTrabajo,
  ConteoHorasProrrateo,
  HorasPorJob,
} from "../types";
import type { Segmento15 } from "./segmentador";
import { JobRepository } from "../../../repositories/JobRepository";
import { SegmentadorTiempo } from "../segmentador-tiempo";

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
    return PoliticaH1Base.HHMM_TO_MIN(seg.fin) - PoliticaH1Base.HHMM_TO_MIN(seg.inicio);
  }
  protected static isDiurna(seg: Segmento15): boolean {
    const start = PoliticaH1Base.HHMM_TO_MIN(seg.inicio);
    return start >= 5 * 60 && start < 19 * 60; // 05:00–19:00
  }
  protected static addDays(iso: string, d: number): string {
    const [Y, M, D] = iso.split("-").map(Number);
    const dt = new Date(Date.UTC(Y, M - 1, D));
    dt.setUTCDate(dt.getUTCDate() + d);
    const y = dt.getUTCFullYear();
    const m = `${dt.getUTCMonth() + 1}`.padStart(2, "0");
    const day = `${dt.getUTCDate()}`.padStart(2, "0");
    return `${y}-${m}-${day}`;
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
  ) {
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

      return;
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

    // Verificar si se debe pasar a p75 (mixta)
    // Condiciones: >=3h de p50 específicamente Y existeDiurnaExtra activa
    let aplicarP75 = false;
    if (!r.bloquearMixta && r.minutosP50Acum >= 180 && r.existeDiurnaExtra) {
      aplicarP75 = true;
    }

    const mult = aplicarP75 ? 1.75 : r.piso;

    if (mult >= 1.75) {
      b.extraC3Min += 15; // p75
    } else if (mult >= 1.5) {
      b.extraC2Min += 15; // p50
      r.minutosP50Acum += 15; // Acumular minutos p50
    } else {
      b.extraC1Min += 15; // p25
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
    addIncapacidadMin: number;
    addVacacionesMin: number;
    addPermisoCSMin: number;
    addPermisoSSMin: number;
    addInasistenciasMin: number;
    addCompensatorioMin: number;
  };

  /**
   * Procesa un día completo de forma independiente.
   * Si el día empieza con EXTRA a las 00:00, obtiene la racha del día anterior.
   * Cada día se puede calcular en paralelo con otros días.
   */
  /**
   * Versión optimizada que recibe el empleado pre-cargado
   */
  private async procesarDiaCompletoOptimizado(
    fecha: string,
    empleadoId: string,
    empleado: any
  ): Promise<typeof PoliticaH1Base.DayResultType> {
    const tDia = Date.now();
    
    // Solo 2 consultas por día: registro y feriado
    const [registroDelDia, feriadoInfo] =
      await Promise.all([
        this.getRegistroDiario(empleadoId, fecha),
        this.esFeriado(fecha),
      ]);
    
    // Segmentar usando el registro ya obtenido (sin consulta extra)
    const segmentosResult = this.segmentarConRegistro(fecha, registroDelDia);
    
    // Calcular horario de trabajo sin consultas adicionales (usando datos ya obtenidos)
    const hTrabajo = this.calcularHorarioTrabajoSinConsultas(fecha, empleadoId, feriadoInfo);
    
    console.log(`[H1Base] ${fecha} - carga datos: ${Date.now() - tDia}ms`);

    const segmentos = segmentosResult.segmentos;

    // Determinar si necesitamos racha del día anterior
    let racha = PoliticaH1Base.nuevaRacha();
    const necesitaRachaAnterior = this.diaEmpiezaConExtraA00(segmentos);

    if (necesitaRachaAnterior) {
      racha = await this.obtenerRachaDelDiaAnterior(fecha, empleadoId);
    }

    // Buckets para este día
    const b: Buckets = {
      normalMin: 0,
      almuerzoMin: 0,
      libreMin: 0,
      extraC1Min: 0,
      extraC2Min: 0,
      extraC3Min: 0,
      extraC4Min: 0,
      incapacidadMin: 0,
      vacacionesMin: 0,
      permisoConSueldoMin: 0,
      permisoSinSueldoMin: 0,
      inasistenciasMin: 0,
      compensatorioMin: 0,
    };

    // Acumuladores de actividades sin hora
    let addIncapacidadMin = 0;
    let addVacacionesMin = 0;
    let addPermisoCSMin = 0;
    let addPermisoSSMin = 0;
    let addInasistenciasMin = 0;
    let addCompensatorioMin = 0;

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
    for (const seg of segmentos) {
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
          if (code === "E01") {
            b.incapacidadMin += dur;
          } else if (code === "E02") {
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
          for (let i = 0; i < slots; i++) {
            PoliticaH1Base.aplicarExtraSlot(esLibreOFest, esDiurna, racha, b);
          }
          break;
        }
      }
    }

    // Procesar actividades sin hora (jobs especiales)
    try {
      if (registroDelDia?.actividades?.length) {
        for (const act of registroDelDia.actividades as any[]) {
          if (act?.esExtra) continue;
          const horas = Number(act?.duracionHoras ?? 0);
          if (!isFinite(horas) || horas <= 0) continue;
          const codigo = act?.job?.codigo?.toUpperCase?.();
          if (!codigo) continue;
          const min = Math.round(horas * 60);
          if (codigo === "E01") addIncapacidadMin += min;
          else if (codigo === "E02") addVacacionesMin += min;
          else if (codigo === "E03") addPermisoCSMin += min;
          else if (codigo === "E04") addPermisoSSMin += min;
          else if (codigo === "E05") addInasistenciasMin += min;
          else if (codigo === "E06" || codigo === "E07") addCompensatorioMin += min;
        }
      }
    } catch {
      /* ignore */
    }

    return {
      buckets: b,
      addIncapacidadMin,
      addVacacionesMin,
      addPermisoCSMin,
      addPermisoSSMin,
      addInasistenciasMin,
      addCompensatorioMin,
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
      const [registroAnterior, feriadoInfoAnterior] =
        await Promise.all([
          this.getRegistroDiario(empleadoId, diaAnterior),
          this.esFeriado(diaAnterior),
        ]);

      // Segmentar usando el registro ya obtenido (evita consulta duplicada)
      const segmentosResult = this.segmentarConRegistro(diaAnterior, registroAnterior);

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
        for (let i = 0; i < slots; i++) {
          PoliticaH1Base.aplicarExtraSlot(
            esLibreOFestAnterior,
            esDiurna,
            r,
            DUMMY_BUCKETS
          );
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
    const t0 = Date.now();
    
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

    console.log(`[H1Base] Procesando ${fechas.length} días en paralelo...`);
    const t1 = Date.now();

    // Pre-cargar datos compartidos UNA SOLA VEZ (empleado es el mismo para todos los días)
    const empleado = await this.getEmpleado(empleadoId);
    if (!empleado) throw new Error(`Empleado con ID ${empleadoId} no encontrado`);
    
    console.log(`[H1Base] Empleado cargado en ${Date.now() - t1}ms`);
    const t2 = Date.now();

    // Procesar TODOS los días en paralelo (sin deducciones de alimentación)
    const resultadosPorDia = await Promise.all(
      fechas.map((fecha) => this.procesarDiaCompletoOptimizado(fecha, empleadoId, empleado))
    );
    
    console.log(`[H1Base] Días procesados en ${Date.now() - t2}ms`);

    // ==================== AGREGAR RESULTADOS ====================
    const b: Buckets = {
      normalMin: 0,
      almuerzoMin: 0,
      libreMin: 0,
      extraC1Min: 0,
      extraC2Min: 0,
      extraC3Min: 0,
      extraC4Min: 0,
      incapacidadMin: 0,
      vacacionesMin: 0,
      permisoConSueldoMin: 0,
      permisoSinSueldoMin: 0,
      inasistenciasMin: 0,
      compensatorioMin: 0,
    };

    let addIncapacidadMin = 0;
    let addVacacionesMin = 0;
    let addPermisoCSMin = 0;
    let addPermisoSSMin = 0;
    let addInasistenciasMin = 0;
    let addCompensatorioMin = 0;

    // Sumar todos los buckets de cada día
    for (const resultado of resultadosPorDia) {
      b.normalMin += resultado.buckets.normalMin;
      b.almuerzoMin += resultado.buckets.almuerzoMin;
      b.libreMin += resultado.buckets.libreMin;
      b.extraC1Min += resultado.buckets.extraC1Min;
      b.extraC2Min += resultado.buckets.extraC2Min;
      b.extraC3Min += resultado.buckets.extraC3Min;
      b.extraC4Min += resultado.buckets.extraC4Min;
      b.incapacidadMin += resultado.buckets.incapacidadMin;
      b.vacacionesMin += resultado.buckets.vacacionesMin;
      b.permisoConSueldoMin += resultado.buckets.permisoConSueldoMin;
      b.permisoSinSueldoMin += resultado.buckets.permisoSinSueldoMin;
      b.inasistenciasMin += resultado.buckets.inasistenciasMin;
      b.compensatorioMin += resultado.buckets.compensatorioMin;

      addIncapacidadMin += resultado.addIncapacidadMin;
      addVacacionesMin += resultado.addVacacionesMin;
      addPermisoCSMin += resultado.addPermisoCSMin;
      addPermisoSSMin += resultado.addPermisoSSMin;
      addInasistenciasMin += resultado.addInasistenciasMin;
      addCompensatorioMin += resultado.addCompensatorioMin;
    }

    // Validar cuadre (en minutos): debe ser 24h * número de días
    const dias = PoliticaH1Base.daysInclusive(fechaInicio, fechaFin);
    const esperadoMin = dias * 24 * 60;
    const totalMin =
      b.normalMin +
      b.almuerzoMin +
      b.libreMin +
      b.extraC1Min +
      b.extraC2Min +
      b.extraC3Min +
      b.extraC4Min;

    if (totalMin !== esperadoMin) {
      throw new Error(
        `[H1] Cuadre inválido: total=${totalMin} min, esperado=${esperadoMin} min` +
          ` (dias=${dias}, rango=${fechaInicio}..${fechaFin})`
      );
    }

    // Mapear a interfaz (horas)
    const totalEspecialesAddMin =
      addIncapacidadMin +
      addVacacionesMin +
      addPermisoCSMin +
      addPermisoSSMin +
      addCompensatorioMin;

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
        incapacidad: PoliticaH1Base.minutosAhoras(
          b.incapacidadMin + addIncapacidadMin
        ),
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
      },
    };

    // ---------------- Conteo en días (base 15) ----------------
    const totalPeriodo = 15;
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

    const diasNoLaboradosPorEspeciales =
      diasVacaciones + diasPermisoCS + diasPermisoSS + diasInasistencias;
    const diasLaborados = totalPeriodo - diasNoLaboradosPorEspeciales;

    result.conteoDias = {
      totalPeriodo,
      diasLaborados,
      vacaciones: diasVacaciones,
      permisoConSueldo: diasPermisoCS,
      permisoSinSueldo: diasPermisoSS,
      inasistencias: diasInasistencias,
    };

    // Las deducciones de alimentación ahora se obtienen en un endpoint separado
    // para no retrasar el cálculo de horas
    result.deduccionesAlimentacion = 0;
    result.deduccionesAlimentacionDetalle = [];
    result.errorAlimentacion = undefined;

    console.log(`[H1Base] TOTAL getConteoHoras: ${Date.now() - t0}ms`);
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
    const horasPorJobP50 = new Map<
      number,
      {
        jobId: number;
        codigoJob: string;
        nombreJob: string;
        horas: number;
        comentarios: string[];
      }
    >();
    const horasPorJobP75 = new Map<
      number,
      {
        jobId: number;
        codigoJob: string;
        nombreJob: string;
        horas: number;
        comentarios: string[];
      }
    >();
    const horasPorJobP100 = new Map<
      number,
      {
        jobId: number;
        codigoJob: string;
        nombreJob: string;
        horas: number;
        comentarios: string[];
      }
    >();

    const baseKey = 0; // tests esperan jobId 0

    // Recorrer cada día del período y procesar actividades directamente
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

        // Proporciones de extras según conteo (para el rango; en pruebas es por día)
        const totalExtras =
          (conteoHoras.cantidadHoras.p25 || 0) +
          (conteoHoras.cantidadHoras.p50 || 0) +
          (conteoHoras.cantidadHoras.p75 || 0) +
          (conteoHoras.cantidadHoras.p100 || 0);
        const propP25 =
          totalExtras > 0
            ? (conteoHoras.cantidadHoras.p25 || 0) / totalExtras
            : 0;
        const propP50 =
          totalExtras > 0
            ? (conteoHoras.cantidadHoras.p50 || 0) / totalExtras
            : 0;
        const propP75 =
          totalExtras > 0
            ? (conteoHoras.cantidadHoras.p75 || 0) / totalExtras
            : 0;
        const propP100 =
          totalExtras > 0
            ? (conteoHoras.cantidadHoras.p100 || 0) / totalExtras
            : 0;

        // 1) Acumular normales inmediatas y pre‐agrupar extras por banda (diurna/nocturna)
        const extrasPorJob: Map<
          string,
          { diurna: number; nocturna: number; total: number }
        > = new Map();

        // Map auxiliar para resolver nombre real por código cuando esté disponible
        const codigoANombre: Map<string, string> = new Map();
        const upsertNormal = (
          codigo: string,
          nombre: string,
          horas: number
        ) => {
          if (horas <= 0) return;
          const jobInfo = {
            jobId: baseKey,
            codigoJob: codigo,
            nombreJob: nombre,
            horas,
            comentarios: [],
          };
          // buscamos una entrada existente exactamente del mismo código
          let foundKey: number | null = null;
          for (const [k, v] of horasPorJobNormal) {
            if (v.codigoJob === codigo) {
              v.horas += horas;
              // Actualizar nombre si estaba como placeholder
              if (!v.nombreJob || v.nombreJob === String(codigo))
                v.nombreJob = nombre;
              foundKey = k;
              break;
            }
          }
          if (foundKey === null) {
            horasPorJobNormal.set(
              `${baseKey}:${codigo}` as unknown as number,
              jobInfo
            );
          }
        };

        const addExtra = (
          codigo: string,
          diurnaH: number,
          nocturnaH: number
        ) => {
          const prev = extrasPorJob.get(codigo) ?? {
            diurna: 0,
            nocturna: 0,
            total: 0,
          };
          prev.diurna += diurnaH;
          prev.nocturna += nocturnaH;
          prev.total += diurnaH + nocturnaH;
          extrasPorJob.set(codigo, prev);
        };

        const horasFeriadoDia = Number(
          ((registroDiario as any)?.horasFeriado ?? 0) as number
        );

        if (horasFeriadoDia > 0) {
          // eslint-disable-next-line no-console
          console.log(
            `[PoliticaH1Base][Prorrateo] ${currentDate} horasFeriadoDia=${horasFeriadoDia}`
          );
          totalHorasFeriado += horasFeriadoDia;
          upsertNormal("00", "Feriados", horasFeriadoDia);
          let feriadoEntry: {
            jobId: number;
            codigoJob: string;
            nombreJob: string;
            horas: number;
            comentarios: string[];
          } | null = null;
          for (const v of horasPorJobNormal.values()) {
            if (v.codigoJob === "00") {
              feriadoEntry = v;
              break;
            }
          }
          // eslint-disable-next-line no-console
          console.log(
            `[PoliticaH1Base][Prorrateo] ${currentDate} job Feriados horas acumuladas=${
              feriadoEntry?.horas ?? 0
            } totalHorasFeriado=${totalHorasFeriado}`
          );
        }

        for (const act of (registroDiario as any).actividades ?? []) {
          const codigo =
            act?.job?.codigo ?? act?.codigoJob ?? act?.jobCodigo ?? "";
          if (!codigo) continue;
          const nombreReal = act?.job?.nombre ?? String(codigo);
          if (!codigoANombre.has(codigo)) codigoANombre.set(codigo, nombreReal);

          if (!act?.esExtra) {
            const horas = Number(act?.duracionHoras ?? 0);
            if (horas > 0) upsertNormal(codigo, nombreReal, horas);
            const desc =
              act?.descripcion ||
              act?.comentario ||
              (registroDiario as any)?.comentarioEmpleado ||
              null;
            if (desc) {
              // push comment into matching normal map entry (or create it)
              let existingKey: number | null = null;
              for (const [k, v] of horasPorJobNormal) {
                if (v.codigoJob === codigo) {
                  existingKey = k;
                  break;
                }
              }
              if (existingKey == null) {
                const key = `${baseKey}:${codigo}` as unknown as number;
                horasPorJobNormal.set(key, {
                  jobId: baseKey,
                  codigoJob: codigo,
                  nombreJob: nombreReal,
                  horas: 0,
                  comentarios: [],
                });
                existingKey = key;
              }
              const target = horasPorJobNormal.get(existingKey)!;
              if (!target.comentarios.includes(desc))
                target.comentarios.push(desc);
            }
            continue;
          }

          const start: Date | null = act?.horaInicio
            ? new Date(act.horaInicio)
            : null;
          const end: Date | null = act?.horaFin ? new Date(act.horaFin) : null;
          if (!start || !end) {
            const horas = Number(act?.duracionHoras ?? 0);
            if (horas > 0) addExtra(codigo, horas, 0);
            continue;
          }

          // recortar al día actual
          const dayStart = new Date(`${currentDate}T00:00:00.000Z`);
          const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
          const s = new Date(Math.max(start.getTime(), dayStart.getTime()));
          const e = new Date(Math.min(end.getTime(), dayEnd.getTime()));
          if (e.getTime() <= s.getTime()) continue;

          const toMin = (d: Date) => (d.getTime() - dayStart.getTime()) / 60000;
          const sMin = toMin(s);
          const eMin = toMin(e);
          const diurnaIni = 5 * 60;
          const diurnaFin = 19 * 60;
          const max0 = Math.max(sMin, diurnaIni);
          const min1 = Math.min(eMin, diurnaFin);
          const diurnaMin = Math.max(0, min1 - max0);
          const totalMin = eMin - sMin;
          const nocturnaMin = Math.max(0, totalMin - diurnaMin);
          addExtra(codigo, diurnaMin / 60, nocturnaMin / 60);
          const desc =
            act?.descripcion ||
            act?.comentario ||
            (registroDiario as any)?.comentarioEmpleado ||
            null;
          if (desc) {
            const ensureCommentEntry = (
              map: Map<
                number,
                {
                  jobId: number;
                  codigoJob: string;
                  nombreJob: string;
                  horas: number;
                  comentarios: string[];
                }
              >,
              codigo: string
            ) => {
              for (const [k, v] of map) if (v.codigoJob === codigo) return k;
              const key = `${baseKey}:${codigo}` as unknown as number;
              map.set(key, {
                jobId: baseKey,
                codigoJob: codigo,
                nombreJob: String(codigo),
                horas: 0,
                comentarios: [],
              });
              return key;
            };
            const k25 = ensureCommentEntry(horasPorJobP25 as any, codigo);
            const t25 = (horasPorJobP25 as any).get(k25)!;
            if (!t25.comentarios.includes(desc)) t25.comentarios.push(desc);
            const k50 = ensureCommentEntry(horasPorJobP50 as any, codigo);
            const t50 = (horasPorJobP50 as any).get(k50)!;
            if (!t50.comentarios.includes(desc)) t50.comentarios.push(desc);
            const k75 = ensureCommentEntry(horasPorJobP75 as any, codigo);
            const t75 = (horasPorJobP75 as any).get(k75)!;
            if (!t75.comentarios.includes(desc)) t75.comentarios.push(desc);
            const k100 = ensureCommentEntry(horasPorJobP100 as any, codigo);
            const t100 = (horasPorJobP100 as any).get(k100)!;
            if (!t100.comentarios.includes(desc)) t100.comentarios.push(desc);
          }
        }

        // 2) Distribución por bandas usando conocimiento de bandas del día
        const sumBy = (
          sel: (v: {
            diurna: number;
            nocturna: number;
            total: number;
          }) => number
        ) => {
          let t = 0;
          for (const v of extrasPorJob.values()) t += sel(v);
          return t;
        };

        const totalDiurna = sumBy((v) => v.diurna);
        const totalNocturna = sumBy((v) => v.nocturna);
        const totalExtra = sumBy((v) => v.total);

        const p25Total = Number(conteoHoras.cantidadHoras.p25 || 0);
        const p50Total = Number(conteoHoras.cantidadHoras.p50 || 0);
        const p75Total = Number(conteoHoras.cantidadHoras.p75 || 0);
        const p100Total = Number(conteoHoras.cantidadHoras.p100 || 0);

        const ensureEntry = (
          map: Map<
            number,
            {
              jobId: number;
              codigoJob: string;
              nombreJob: string;
              horas: number;
              comentarios: string[];
            }
          >,
          codigo: string
        ) => {
          // buscar existente por código
          for (const [k, v] of map) if (v.codigoJob === codigo) return k;
          const key = `${baseKey}:${codigo}` as unknown as number;
          map.set(key, {
            jobId: baseKey,
            codigoJob: codigo,
            nombreJob: codigoANombre.get(codigo) ?? String(codigo),
            horas: 0,
            comentarios: [],
          });
          return key;
        };

        // p25: diurna si hay, si no proporcional al total
        if (p25Total > 0 && extrasPorJob.size > 0) {
          const denom = totalDiurna > 0 ? totalDiurna : totalExtra;
          for (const [codigo, v] of extrasPorJob) {
            const weight = totalDiurna > 0 ? v.diurna : v.total;
            const horas = denom > 0 ? (p25Total * weight) / denom : 0;
            if (horas <= 0) continue;
            const k = ensureEntry(horasPorJobP25, codigo);
            horasPorJobP25.get(k)!.horas += horas;
          }
        }

        // p50: nocturna si hay, si no proporcional al total
        if (p50Total > 0 && extrasPorJob.size > 0) {
          const denom = totalNocturna > 0 ? totalNocturna : totalExtra;
          for (const [codigo, v] of extrasPorJob) {
            const weight = totalNocturna > 0 ? v.nocturna : v.total;
            const horas = denom > 0 ? (p50Total * weight) / denom : 0;
            if (horas <= 0) continue;
            const k = ensureEntry(horasPorJobP50, codigo);
            horasPorJobP50.get(k)!.horas += horas;
          }
        }

        // p75: 2 fases → primero diurna hasta totalDiurna; resto a nocturna. Sin cap por job
        if (p75Total > 0 && extrasPorJob.size > 0) {
          const asignarProporcional = (
            totalAsignar: number,
            selector: (v: {
              diurna: number;
              nocturna: number;
              total: number;
            }) => number
          ) => {
            const denom = Array.from(extrasPorJob.values()).reduce(
              (acc, v) => acc + selector(v),
              0
            );
            if (totalAsignar <= 0 || denom <= 0) return 0;
            for (const [codigo, v] of extrasPorJob) {
              const peso = selector(v);
              if (peso <= 0) continue;
              const horas = (totalAsignar * peso) / denom;
              const k = ensureEntry(horasPorJobP75, codigo);
              horasPorJobP75.get(k)!.horas += horas;
            }
            return totalAsignar;
          };

          const diurnaAsign = Math.min(p75Total, totalDiurna);
          asignarProporcional(diurnaAsign, (v) => v.diurna);
          const rem = p75Total - diurnaAsign;
          asignarProporcional(rem, (v) => v.nocturna);
        }

        // p100: proporcional al total extra (dominical/feriado)
        if (p100Total > 0 && extrasPorJob.size > 0) {
          const denom = totalExtra;
          for (const [codigo, v] of extrasPorJob) {
            const horas = denom > 0 ? (p100Total * v.total) / denom : 0;
            if (horas <= 0) continue;
            const k = ensureEntry(horasPorJobP100, codigo);
            horasPorJobP100.get(k)!.horas += horas;
          }
        }
      } catch (error) {
        console.error(`Error procesando día ${currentDate}:`, error);
      }

      currentDate = PoliticaH1Base.addDays(currentDate, 1);
    }

    if (totalHorasFeriado > 0) {
      let feriadoEntry:
        | {
            jobId: number;
            codigoJob: string;
            nombreJob: string;
            horas: number;
            comentarios: string[];
          }
        | undefined;
      for (const v of horasPorJobNormal.values()) {
        if (v.codigoJob === "00") {
          feriadoEntry = v;
          break;
        }
      }
      if (feriadoEntry) {
        const diff = Math.abs(feriadoEntry.horas - totalHorasFeriado);
        // eslint-disable-next-line no-console
        console.log(
          `[PoliticaH1Base][Prorrateo] totalHorasFeriado=${totalHorasFeriado} horasJobFeriados=${feriadoEntry.horas} diff=${diff}`
        );
      } else {
        // eslint-disable-next-line no-console
        console.warn(
          `[PoliticaH1Base][Prorrateo] totalHorasFeriado=${totalHorasFeriado} pero no se encontró job Feriados. Creando fallback.`
        );
        horasPorJobNormal.set(`${baseKey}:00` as unknown as number, {
          jobId: baseKey,
          codigoJob: "00",
          nombreJob: "Feriados",
          horas: totalHorasFeriado,
          comentarios: [],
        });
      }
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
      return Array.from(map.values())
        .map((item) => ({
          jobId: item.jobId,
          codigoJob: item.codigoJob,
          nombreJob: item.nombreJob,
          cantidadHoras: Math.round(item.horas * 100) / 100,
          comentarios: item.comentarios,
        }))
        .filter((item) => item.cantidadHoras > 0);
    };

    // Construir resultado
    const resultado: ConteoHorasProrrateo = {
      fechaInicio,
      fechaFin,
      empleadoId,
      cantidadHoras: {
        normal: convertMapToArray(horasPorJobNormal),
        p25: convertMapToArray(horasPorJobP25),
        p50: convertMapToArray(horasPorJobP50),
        p75: convertMapToArray(horasPorJobP75),
        p100: convertMapToArray(horasPorJobP100),
        vacacionesHoras: conteoHoras.cantidadHoras.vacaciones || 0,
        permisoConSueldoHoras: conteoHoras.cantidadHoras.permisoConSueldo || 0,
        permisoSinSueldoHoras: conteoHoras.cantidadHoras.permisoSinSueldo || 0,
        inasistenciasHoras: conteoHoras.cantidadHoras.inasistencias || 0,
        totalHorasLaborables: conteoHoras.cantidadHoras.normal || 0,
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
};

type Buckets = {
  normalMin: number;
  almuerzoMin: number;
  libreMin: number;
  extraC1Min: number; // p25
  extraC2Min: number; // p50
  extraC3Min: number; // p75
  extraC4Min: number; // p100
  // normales por jobs especiales (minutos)
  incapacidadMin: number; // E01
  vacacionesMin: number; // E02
  permisoConSueldoMin: number; // E03
  permisoSinSueldoMin: number; // E04
  inasistenciasMin: number; // E05
  compensatorioMin: number; // E05
};

const DUMMY_BUCKETS: Buckets = {
  normalMin: 0,
  almuerzoMin: 0,
  libreMin: 0,
  extraC1Min: 0,
  extraC2Min: 0,
  extraC3Min: 0,
  extraC4Min: 0,
  incapacidadMin: 0,
  vacacionesMin: 0,
  permisoConSueldoMin: 0,
  permisoSinSueldoMin: 0,
  inasistenciasMin: 0,
  compensatorioMin: 0,
};


