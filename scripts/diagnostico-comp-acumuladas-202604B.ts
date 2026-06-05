/**
 * Diagnóstico: compensatorias acumuladas conteo vs prorrateo (quincena 202604B).
 * Uso: npx tsx scripts/diagnostico-comp-acumuladas-202604B.ts [empleadoId]
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { HorarioTrabajoDomain } from "../src/domain/calculo-horas/horario-trabajo-domain";
import { FabricaPoliticas } from "../src/domain/calculo-horas/politicas-horario/fabrica-politicas";
import { RegistroDiarioRepository } from "../src/repositories/RegistroDiarioRepository";

const CODIGO_NOMINA = "202604B";
// Segunda quincena abril 2026 (convención NominaService)
const FECHA_INICIO = "2026-04-12";
const FECHA_FIN = "2026-04-26";

const prisma = new PrismaClient();

function sumProrrateoCompAcum(
  items: { cantidadHoras: number }[] | undefined
): number {
  return (items ?? []).reduce((a, x) => a + (x.cantidadHoras ?? 0), 0);
}

function horasFromActividadProrrateoH2(
  act: {
    horaInicio?: Date | null;
    horaFin?: Date | null;
    duracionHoras?: number | null;
  },
  currentDate: string
): number {
  if (act?.horaInicio && act?.horaFin) {
    const start = new Date(act.horaInicio);
    const end = new Date(act.horaFin);
    const dayStart = new Date(`${currentDate}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const s = new Date(Math.max(start.getTime(), dayStart.getTime()));
    const e = new Date(Math.min(end.getTime(), dayEnd.getTime()));
    if (e.getTime() > s.getTime()) {
      return (e.getTime() - s.getTime()) / 3_600_000;
    }
    return 0;
  }
  return Number(act?.duracionHoras ?? 0);
}

function horasFromActividadSegmentador(act: {
  esExtra?: boolean | null;
  horaInicio?: Date | null;
  horaFin?: Date | null;
  duracionHoras?: number | null;
}): number {
  if (act.esExtra && act.horaInicio && act.horaFin) {
    const duracionMs =
      new Date(act.horaFin).getTime() - new Date(act.horaInicio).getTime();
    return duracionMs / 3_600_000;
  }
  return Number(act.duracionHoras ?? 0);
}

async function main() {
  const empleadoIdArg = process.argv[2];

  console.log("=== Diagnóstico compensatorias acumuladas ===");
  console.log(`Quincena: ${CODIGO_NOMINA} | Rango: ${FECHA_INICIO} .. ${FECHA_FIN}`);
  console.log(`DB: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@")}\n`);

  const nominas = await prisma.nomina.findMany({
    where: { codigoNomina: CODIGO_NOMINA, deletedAt: null },
    select: {
      id: true,
      empleadoId: true,
      fechaInicio: true,
      fechaFin: true,
      codigoNomina: true,
    },
    take: 5,
  });
  console.log(`Nóminas con codigoNomina=${CODIGO_NOMINA}: ${nominas.length}`);
  if (nominas[0]) {
    console.log(
      "  Ejemplo:",
      JSON.stringify({
        empleadoId: nominas[0].empleadoId,
        fechaInicio: nominas[0].fechaInicio,
        fechaFin: nominas[0].fechaFin,
      })
    );
  }

  const actividades = await prisma.actividad.findMany({
    where: {
      deletedAt: null,
      esCompensatorio: true,
      esExtra: true,
      registroDiario: {
        deletedAt: null,
        fecha: { gte: FECHA_INICIO, lte: FECHA_FIN },
        ...(empleadoIdArg
          ? { empleadoId: parseInt(empleadoIdArg, 10) }
          : {}),
      },
    },
    include: {
      job: { select: { id: true, codigo: true, nombre: true } },
      registroDiario: {
        select: {
          id: true,
          fecha: true,
          empleadoId: true,
          aprobacionSupervisor: true,
          aprobacionRrhh: true,
        },
      },
    },
    orderBy: [{ registroDiario: { empleadoId: "asc" } }, { id: "asc" }],
  });

  console.log(
    `\nActividades compensatorias ACUMULADAS (esExtra+esCompensatorio) en rango: ${actividades.length}`
  );

  const byEmpleado = new Map<
    number,
    typeof actividades
  >();
  for (const a of actividades) {
    const eid = a.registroDiario.empleadoId;
    if (!byEmpleado.has(eid)) byEmpleado.set(eid, []);
    byEmpleado.get(eid)!.push(a);
  }

  for (const [empleadoId, acts] of byEmpleado) {
    const empleado = await prisma.empleado.findUnique({
      where: { id: empleadoId },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        apellido: true,
        tipoHorario: true,
      },
    });

    console.log("\n" + "—".repeat(72));
    console.log(
      `Empleado ${empleadoId} | ${empleado?.codigo ?? "?"} | ${empleado?.nombre ?? ""} ${empleado?.apellido ?? ""} | tipoHorario=${empleado?.tipoHorario}`
    );

    let sumSeg = 0;
    let sumProrH2 = 0;
    let sumProrSkippedNoJob = 0;

    for (const act of acts) {
      const fecha = act.registroDiario.fecha;
      const hSeg = horasFromActividadSegmentador(act);
      const hPror = horasFromActividadProrrateoH2(act, fecha);
      const jobId = act.jobId;
      const codigo = act.job?.codigo ?? "";
      const skipped = !jobId && !codigo;

      sumSeg += hSeg;
      if (!skipped) sumProrH2 += hPror;
      else sumProrSkippedNoJob += hPror;

      console.log(
        `  act#${act.id} fecha=${fecha} jobId=${jobId ?? "null"} codigo=${codigo || "(vacío)"}`
      );
      console.log(
        `    duracionHoras=${act.duracionHoras} horaInicio=${act.horaInicio?.toISOString() ?? "null"} horaFin=${act.horaFin?.toISOString() ?? "null"}`
      );
      console.log(
        `    horas segmentador(lógica)=${hSeg.toFixed(4)} | horas prorrateo H2(lógica)=${hPror.toFixed(4)}${skipped ? " [SKIP prorrateo: sin jobId ni codigo]" : ""}`
      );
      if (Math.abs(hSeg - hPror) > 0.01) {
        console.log(`    >>> DIFERENCIA por recorte UTC / duración`);
      }
    }

    console.log(`  Suma manual segmentador: ${sumSeg.toFixed(2)}h`);
    console.log(
      `  Suma manual prorrateo H2 (con job): ${sumProrH2.toFixed(2)}h | omitidas sin job: ${sumProrSkippedNoJob.toFixed(2)}h`
    );

    try {
      const conteo =
        await HorarioTrabajoDomain.getConteoHorasTrabajadasByDateAndEmpleado(
          FECHA_INICIO,
          FECHA_FIN,
          String(empleadoId)
        );
      const compAcumConteo =
        conteo.cantidadHoras.horasCompensatoriasAcumuladas ?? 0;
      console.log(
        `  API conteo horasCompensatoriasAcumuladas: ${compAcumConteo}h`
      );
    } catch (e: any) {
      console.log(`  API conteo ERROR: ${e?.message?.slice(0, 200)}`);
    }

    try {
      const prorrateo =
        await HorarioTrabajoDomain.getProrrateoHorasPorJobByDateAndEmpleado(
          FECHA_INICIO,
          FECHA_FIN,
          String(empleadoId)
        );
      const compAcumPror = sumProrrateoCompAcum(
        prorrateo.cantidadHoras.horasCompensatoriasAcumuladasPorJob
      );
      console.log(
        `  API prorrateo sum(horasCompensatoriasAcumuladasPorJob): ${compAcumPror}h`
      );
      console.log(
        "  Detalle por job:",
        JSON.stringify(
          prorrateo.cantidadHoras.horasCompensatoriasAcumuladasPorJob,
          null,
          2
        )
      );
    } catch (e: any) {
      console.log(`  API prorrateo ERROR: ${e?.message?.slice(0, 300)}`);
      if (e?.validationErrors) {
        console.log("  validationErrors:", JSON.stringify(e.validationErrors));
      }
    }

    // Política directa (sin validación aprobación del domain prorrateo)
    if (empleado?.tipoHorario) {
      const politica = FabricaPoliticas.crearPolitica(empleado.tipoHorario);
      try {
        const prDirect = await politica.getProrrateoHorasPorJobByDateAndEmpleado(
          FECHA_INICIO,
          FECHA_FIN,
          String(empleadoId)
        );
        const sumDirect = sumProrrateoCompAcum(
          prDirect.cantidadHoras.horasCompensatoriasAcumuladasPorJob
        );
        console.log(
          `  Política directa (${empleado.tipoHorario}) prorrateo comp dev: ${sumDirect}h`
        );
      } catch (e: any) {
        console.log(`  Política directa ERROR: ${e?.message?.slice(0, 200)}`);
      }
    }

    const approval =
      await RegistroDiarioRepository.validateApprovalStatusInRange(
        empleadoId,
        FECHA_INICIO,
        FECHA_FIN
      );
    if (
      approval.fechasNoAprobadas.length ||
      approval.fechasSinRegistro.length
    ) {
      console.log("  Aprobación:", JSON.stringify(approval));
    }
  }

  if (byEmpleado.size === 0) {
    console.log("\nNo hay actividades compensatorias acumuladas en ese rango.");
    console.log(
      "Pase empleadoId como argumento si el caso es otro rango de fechas."
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
