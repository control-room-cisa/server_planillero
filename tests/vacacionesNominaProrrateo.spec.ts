import { describe, it, expect, vi } from "vitest";
import { PoliticaH1_1 } from "../src/domain/calculo-horas/politicas-horario/H1_1";
import { PoliticaH2_1 } from "../src/domain/calculo-horas/politicas-horario/H2_1";
import type { HorarioTrabajo } from "../src/domain/calculo-horas/types";
import {
  calcMontoFilaProrrateo,
  montosNominaDesdeDias,
  roundNomina2,
} from "../src/domain/calculo-horas/nominaMontos";

vi.mock("../src/services/VehiculoService", () => ({
  VehiculoService: {
    listVehiculos: vi.fn(async () => []),
  },
}));

const SUELDO_MENSUAL = 30_000;

function montosDesdeConteo(conteo: {
  conteoDias?: { vacaciones: number; diasLaborados: number };
}) {
  return montosNominaDesdeDias(
    SUELDO_MENSUAL,
    conteo.conteoDias!.vacaciones,
    conteo.conteoDias!.diasLaborados
  );
}

function montoFila(
  codigoJob: string,
  horas: number,
  horasProrrateables: number,
  montoDiasLaborados: number,
  salarioQuincenal: number
) {
  return roundNomina2(
    calcMontoFilaProrrateo(
      codigoJob,
      horas,
      montoDiasLaborados,
      horasProrrateables,
      salarioQuincenal
    )
  );
}

function makeDateUTC(fecha: string, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCHours(h, m ?? 0, 0, 0);
  return d;
}

function addDaysYmd(fecha: string, days: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function actE02(horas: number, descripcion = "Vacaciones") {
  return {
    descripcion,
    esExtra: false,
    esCompensatorio: false,
    job: { codigo: "E02", nombre: "Vacaciones" },
    duracionHoras: horas,
  };
}

function actJob(codigo: string, horas: number) {
  return {
    descripcion: `Job ${codigo}`,
    esExtra: false,
    esCompensatorio: false,
    job: { codigo, nombre: codigo },
    duracionHoras: horas,
  };
}

class H1Test extends PoliticaH1_1 {
  private registros: Record<string, any> = {};
  private feriados: Record<string, boolean> = {};
  private horarios: Record<
    string,
    {
      inicio: string;
      fin: string;
      incluyeAlmuerzo: boolean;
      cantidadHorasLaborables: number;
      esDiaLibre: boolean;
    }
  > = {};

  seedRegistro(fecha: string, reg: any) {
    this.registros[fecha] = reg;
  }
  seedHorario(
    fecha: string,
    data: {
      inicio: string;
      fin: string;
      incluyeAlmuerzo: boolean;
      cantidadHorasLaborables: number;
      esDiaLibre: boolean;
    }
  ) {
    this.horarios[fecha] = data;
  }
  protected async getRegistroDiario(_empleadoId: string, fecha: string) {
    return this.registros[fecha] ?? null;
  }
  protected async esFeriado(fecha: string) {
    return {
      esFeriado: !!this.feriados[fecha],
      nombre: this.feriados[fecha] ? "Feriado" : "",
    };
  }
  protected async getEmpleado(_empleadoId: string) {
    return { id: Number(_empleadoId), nombre: "Test" } as any;
  }
  async getHorarioTrabajoByDateAndEmpleado(
    fecha: string,
    empleadoId: string
  ): Promise<HorarioTrabajo> {
    const personalizado = this.horarios[fecha];
    if (personalizado) {
      return {
        tipoHorario: "H1_1",
        fecha,
        empleadoId,
        horarioTrabajo: {
          inicio: personalizado.inicio,
          fin: personalizado.fin,
        },
        incluyeAlmuerzo: personalizado.incluyeAlmuerzo,
        cantidadHorasLaborables: personalizado.cantidadHorasLaborables,
        esDiaLibre: personalizado.esDiaLibre,
        esFestivo: false,
        nombreDiaFestivo: "",
      };
    }
    return super.getHorarioTrabajoByDateAndEmpleado(fecha, empleadoId);
  }
}

class H2Test extends PoliticaH2_1 {
  private registros: Record<string, any> = {};
  seedRegistro(fecha: string, reg: any) {
    this.registros[fecha] = reg;
  }
  protected async getRegistroDiario(_empleadoId: string, fecha: string) {
    return this.registros[fecha] ?? null;
  }
  protected async esFeriado() {
    return { esFeriado: false, nombre: "" };
  }
  protected async getEmpleado(_empleadoId: string) {
    return { id: Number(_empleadoId), nombre: "Test" } as any;
  }
}

function seedH1Dia(
  p: H1Test,
  fecha: string,
  opts: {
    entradaUtc: string;
    salidaUtc: string;
    salidaFecha?: string;
    esHoraCorrida?: boolean;
    horario?: {
      inicio: string;
      fin: string;
      incluyeAlmuerzo: boolean;
      cantidadHorasLaborables: number;
    };
    actividades: any[];
  }
) {
  if (opts.horario) {
    p.seedHorario(fecha, {
      ...opts.horario,
      esDiaLibre: false,
    });
  }
  p.seedRegistro(fecha, {
    fecha,
    horaEntrada: makeDateUTC(fecha, opts.entradaUtc),
    horaSalida: makeDateUTC(opts.salidaFecha ?? fecha, opts.salidaUtc),
    esHoraCorrida: opts.esHoraCorrida ?? false,
    esDiaLibre: false,
    actividades: opts.actividades,
  });
}

describe("Vacaciones: conteo de nómina (días 8h / 9h / 12h)", () => {
  it("día 9h completo (E02 9h) → 8h / 1.0d; laborados = 14", async () => {
    const fecha = "2026-02-02";
    const p = new H1Test();
    seedH1Dia(p, fecha, {
      entradaUtc: "13:00",
      salidaUtc: "23:00",
      actividades: [actE02(9)],
    });

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    expect(res.cantidadHoras.vacaciones).toBe(8);
    expect(res.conteoDias?.vacaciones).toBe(1);
    expect(res.conteoDias?.diasLaborados).toBe(14);
    expect(res.cantidadHoras.normal).toBe(0);

    const montos = montosDesdeConteo(res);
    expect(montos.montoVacaciones).toBe(1000);
    expect(montos.montoDiasLaborados).toBe(14000);
  });

  it("día 9h medio (E02 4.5h + job 4.5h) → 4h / 0.5d; job sigue 4.5h", async () => {
    const fecha = "2026-02-03";
    const p = new H1Test();
    seedH1Dia(p, fecha, {
      entradaUtc: "13:00",
      salidaUtc: "23:00",
      actividades: [actE02(4.5), actJob("100", 4.5)],
    });

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    expect(res.cantidadHoras.vacaciones).toBe(4);
    expect(res.conteoDias?.vacaciones).toBe(0.5);
    expect(res.conteoDias?.diasLaborados).toBe(14.5);
    expect(res.cantidadHoras.normal).toBe(4.5);

    const montos = montosDesdeConteo(res);
    expect(montos.montoVacaciones).toBe(500);
    expect(montos.montoDiasLaborados).toBe(14500);
  });

  it("día 8h viernes completo (E02 8h) → 8h / 1.0d", async () => {
    const fecha = "2026-02-06";
    const p = new H1Test();
    seedH1Dia(p, fecha, {
      entradaUtc: "13:00",
      salidaUtc: "22:00",
      actividades: [actE02(8)],
    });

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    expect(res.cantidadHoras.vacaciones).toBe(8);
    expect(res.conteoDias?.vacaciones).toBe(1);
    expect(res.cantidadHoras.normal).toBe(0);
  });

  it("día 8h viernes medio (E02 4h + job 4h) → 4h / 0.5d", async () => {
    const fecha = "2026-02-06";
    const p = new H1Test();
    seedH1Dia(p, fecha, {
      entradaUtc: "13:00",
      salidaUtc: "22:00",
      actividades: [actE02(4), actJob("100", 4)],
    });

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    expect(res.cantidadHoras.vacaciones).toBe(4);
    expect(res.conteoDias?.vacaciones).toBe(0.5);
    expect(res.cantidadHoras.normal).toBe(4);
  });

  it("día 12h completo (E02 12h, hora corrida) → 8h / 1.0d", async () => {
    const fecha = "2026-03-11";
    const p = new H1Test();
    seedH1Dia(p, fecha, {
      entradaUtc: "13:00",
      salidaUtc: "01:00",
      salidaFecha: "2026-03-12",
      esHoraCorrida: true,
      horario: {
        inicio: "07:00",
        fin: "19:00",
        incluyeAlmuerzo: false,
        cantidadHorasLaborables: 12,
      },
      actividades: [actE02(12)],
    });

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    expect(res.cantidadHoras.vacaciones).toBe(8);
    expect(res.conteoDias?.vacaciones).toBe(1);
    expect(res.cantidadHoras.normal).toBe(0);
  });

  it("día 12h medio (E02 6h + job 6h) → 4h / 0.5d; job sigue 6h", async () => {
    const fecha = "2026-03-11";
    const p = new H1Test();
    seedH1Dia(p, fecha, {
      entradaUtc: "13:00",
      salidaUtc: "01:00",
      salidaFecha: "2026-03-12",
      esHoraCorrida: true,
      horario: {
        inicio: "07:00",
        fin: "19:00",
        incluyeAlmuerzo: false,
        cantidadHorasLaborables: 12,
      },
      actividades: [actE02(6), actJob("100", 6)],
    });

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    expect(res.cantidadHoras.vacaciones).toBe(4);
    expect(res.conteoDias?.vacaciones).toBe(0.5);
    expect(res.cantidadHoras.normal).toBe(6);
  });

  it("registro viejo 6h E02 en día 9h se cuenta por hora (0.75d)", async () => {
    const fecha = "2026-02-03";
    const p = new H1Test();
    seedH1Dia(p, fecha, {
      entradaUtc: "13:00",
      salidaUtc: "23:00",
      actividades: [actE02(6), actJob("100", 3)],
    });

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    expect(res.cantidadHoras.vacaciones).toBe(6);
    expect(res.conteoDias?.vacaciones).toBe(0.75);
  });

  it("dos medios días 9h → 1.0d vacaciones (múltiplo de 0.5, sin LRM)", async () => {
    const p = new H1Test();
    for (const fecha of ["2026-02-02", "2026-02-03"]) {
      seedH1Dia(p, fecha, {
        entradaUtc: "13:00",
        salidaUtc: "23:00",
        actividades: [actE02(4.5), actJob("100", 4.5)],
      });
    }

    const res = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      "2026-02-02",
      "2026-02-03",
      "1"
    );
    expect(res.cantidadHoras.vacaciones).toBe(8);
    expect(res.conteoDias?.vacaciones).toBe(1);
    expect(res.conteoDias?.diasLaborados).toBe(14);
  });
});

describe("Vacaciones: prorrateo por job y montos", () => {
  it("día 9h completo: E02 8h; resto de laborados (14d) en job 00 a 112h", async () => {
    const fecha = "2026-02-02";
    const p = new H1Test();
    seedH1Dia(p, fecha, {
      entradaUtc: "13:00",
      salidaUtc: "23:00",
      actividades: [actE02(9)],
    });

    const res = await p.getProrrateoHorasPorJobByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    const conteo = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    const normal = res.cantidadHoras.normal ?? [];
    const e02 = normal.find((j) => j.codigoJob === "E02");
    const job00 = normal.find((j) => j.codigoJob === "00");

    expect(e02?.cantidadHoras).toBe(8);
    expect(res.cantidadHoras.vacacionesHoras).toBe(8);
    expect(job00?.cantidadHoras).toBe(112);

    const { salarioQuincenal, montoVacaciones, montoDiasLaborados } =
      montosDesdeConteo(conteo);
    const horasProrrateables = job00!.cantidadHoras;
    expect(
      montoFila(
        "E02",
        e02!.cantidadHoras,
        horasProrrateables,
        montoDiasLaborados,
        salarioQuincenal
      )
    ).toBe(montoVacaciones);
    expect(
      montoFila(
        "00",
        job00!.cantidadHoras,
        horasProrrateables,
        montoDiasLaborados,
        salarioQuincenal
      )
    ).toBe(montoDiasLaborados);
  });

  it("día 9h medio: E02 4h y job 100 4.5h; no se agrega job 00", async () => {
    const fecha = "2026-02-03";
    const p = new H1Test();
    seedH1Dia(p, fecha, {
      entradaUtc: "13:00",
      salidaUtc: "23:00",
      actividades: [actE02(4.5), actJob("100", 4.5)],
    });

    const res = await p.getProrrateoHorasPorJobByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    const conteo = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    const normal = res.cantidadHoras.normal ?? [];
    const e02H = normal.find((j) => j.codigoJob === "E02")!.cantidadHoras;
    const job100H = normal.find((j) => j.codigoJob === "100")!.cantidadHoras;
    expect(e02H).toBe(4);
    expect(job100H).toBe(4.5);
    expect(normal.some((j) => j.codigoJob === "00")).toBe(false);

    const { salarioQuincenal, montoVacaciones, montoDiasLaborados } =
      montosDesdeConteo(conteo);
    expect(
      montoFila("E02", e02H, job100H, montoDiasLaborados, salarioQuincenal)
    ).toBe(montoVacaciones);
    expect(
      montoFila("100", job100H, job100H, montoDiasLaborados, salarioQuincenal)
    ).toBe(montoDiasLaborados);
  });

  it("día 12h medio: E02 4h y job 100 6h en prorrateo", async () => {
    const fecha = "2026-03-11";
    const p = new H1Test();
    seedH1Dia(p, fecha, {
      entradaUtc: "13:00",
      salidaUtc: "01:00",
      salidaFecha: "2026-03-12",
      esHoraCorrida: true,
      horario: {
        inicio: "07:00",
        fin: "19:00",
        incluyeAlmuerzo: false,
        cantidadHorasLaborables: 12,
      },
      actividades: [actE02(6), actJob("100", 6)],
    });

    const res = await p.getProrrateoHorasPorJobByDateAndEmpleado(
      fecha,
      fecha,
      "1"
    );
    const normal = res.cantidadHoras.normal ?? [];
    expect(normal.find((j) => j.codigoJob === "E02")?.cantidadHoras).toBe(4);
    expect(normal.find((j) => j.codigoJob === "100")?.cantidadHoras).toBe(6);
    expect(normal.some((j) => j.codigoJob === "00")).toBe(false);
  });

  it("11 días E02 completos 9h: 11d vacaciones, 4d laborados → 32h en job 00", async () => {
    const inicio = "2026-02-02";
    const p = new H1Test();
    const fechas: string[] = [];
    for (let i = 0; i < 11; i++) {
      const fecha = addDaysYmd(inicio, i);
      fechas.push(fecha);
      seedH1Dia(p, fecha, {
        entradaUtc: "13:00",
        salidaUtc: "23:00",
        horario: {
          inicio: "07:00",
          fin: "17:00",
          incluyeAlmuerzo: true,
          cantidadHorasLaborables: 9,
        },
        actividades: [actE02(9)],
      });
    }
    const fin = fechas[fechas.length - 1];

    const conteo = await p.getConteoHorasTrabajajadasByDateAndEmpleado(
      inicio,
      fin,
      "1"
    );
    expect(conteo.cantidadHoras.vacaciones).toBe(88);
    expect(conteo.conteoDias?.vacaciones).toBe(11);
    expect(conteo.conteoDias?.diasLaborados).toBe(4);

    const prorrateo = await p.getProrrateoHorasPorJobByDateAndEmpleado(
      inicio,
      fin,
      "1"
    );
    const normal = prorrateo.cantidadHoras.normal ?? [];
    const e02H = normal.find((j) => j.codigoJob === "E02")!.cantidadHoras;
    const job00H = normal.find((j) => j.codigoJob === "00")!.cantidadHoras;
    expect(e02H).toBe(88);
    expect(job00H).toBe(32);

    const { salarioQuincenal, montoVacaciones, montoDiasLaborados } =
      montosDesdeConteo(conteo);
    expect(montoVacaciones).toBe(11000);
    expect(montoDiasLaborados).toBe(4000);
    expect(
      montoFila("E02", e02H, job00H, montoDiasLaborados, salarioQuincenal)
    ).toBe(montoVacaciones);
    expect(
      montoFila("00", job00H, job00H, montoDiasLaborados, salarioQuincenal)
    ).toBe(montoDiasLaborados);
  });
});

describe("Vacaciones H2 12h: conteo y prorrateo", () => {
  const FECHA = "2026-04-06";
  const FECHA_SIG = "2026-04-07";

  function seedH2(p: H2Test, actividades: any[]) {
    p.seedRegistro(FECHA, {
      fecha: FECHA,
      horaEntrada: makeDateUTC(FECHA, "13:00"),
      horaSalida: makeDateUTC(FECHA_SIG, "01:00"),
      esHoraCorrida: true,
      esDiaLibre: false,
      actividades,
    });
  }

  it("jornada completa E02 12h → 8h / 1.0d", async () => {
    const p = new H2Test();
    seedH2(p, [actE02(12)]);

    const conteo = await p.getConteoHorasTrabajadasByDateAndEmpleado(
      FECHA,
      FECHA,
      "1"
    );
    expect(conteo.cantidadHoras.vacaciones).toBe(8);
    expect(conteo.conteoDias?.vacaciones).toBe(1);
    const montos = montosDesdeConteo(conteo);
    expect(montos.montoVacaciones).toBe(1000);
    expect(montos.montoDiasLaborados).toBe(14000);

    const prorrateo = await p.getProrrateoHorasPorJobByDateAndEmpleado(
      FECHA,
      FECHA,
      "1"
    );
    expect(
      (prorrateo.cantidadHoras.normal ?? []).find((j) => j.codigoJob === "E02")
        ?.cantidadHoras
    ).toBe(8);
  });

  it("media E02 6h + job 6h → 4h vacaciones; job 6h en prorrateo", async () => {
    const p = new H2Test();
    seedH2(p, [actE02(6), actJob("100", 6)]);

    const conteo = await p.getConteoHorasTrabajadasByDateAndEmpleado(
      FECHA,
      FECHA,
      "1"
    );
    expect(conteo.cantidadHoras.vacaciones).toBe(4);
    expect(conteo.conteoDias?.vacaciones).toBe(0.5);

    const prorrateo = await p.getProrrateoHorasPorJobByDateAndEmpleado(
      FECHA,
      FECHA,
      "1"
    );
    const normal = prorrateo.cantidadHoras.normal ?? [];
    expect(normal.find((j) => j.codigoJob === "E02")?.cantidadHoras).toBe(4);
    expect(normal.find((j) => j.codigoJob === "100")?.cantidadHoras).toBe(6);
  });
});
