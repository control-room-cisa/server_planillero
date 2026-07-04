import { TechoIhssRepository } from "../repositories/TechoIhssRepository";
import type {
  TechoIhssCreateDto,
  TechoIhssUpdateDto,
} from "../validators/techoIhss.validator";
import { TECHO_IHSS_PAGE_SIZE } from "../validators/techoIhss.validator";
import { prismaDateToYmd } from "../utils/dateTime";

/** Solape inclusivo: [a0,a1] con [b0,b1] (strings YYYY-MM-DD). */
function rangosSeTraslapa(
  a0: string,
  a1: string,
  b0: string,
  b1: string,
): boolean {
  return a0 <= b1 && b0 <= a1;
}

function clientError(
  message: string,
  statusCode = 400,
): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

async function assertSinTraslape(
  fechaInicio: string,
  fechaFin: string,
  excludeId?: number,
): Promise<void> {
  const rows = await TechoIhssRepository.findAll();
  for (const row of rows) {
    if (excludeId != null && row.id === excludeId) continue;
    if (
      rangosSeTraslapa(
        fechaInicio,
        fechaFin,
        prismaDateToYmd(row.fechaInicio),
        prismaDateToYmd(row.fechaFin),
      )
    ) {
      throw clientError(
        "El rango de fechas se traslapa con otro registro existente.",
      );
    }
  }
}

export class TechoIhssService {
  static async list(page = 0) {
    const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
    const pageSize = TECHO_IHSS_PAGE_SIZE;
    let { rows, total } = await TechoIhssRepository.findPaginated(
      safePage,
      pageSize,
    );
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    let currentPage = safePage;

    if (total > 0 && safePage >= totalPages) {
      currentPage = totalPages - 1;
      ({ rows, total } = await TechoIhssRepository.findPaginated(
        currentPage,
        pageSize,
      ));
    }

    return {
      items: rows.map((row) => TechoIhssRepository.toDto(row)),
      total,
      page: currentPage,
      pageSize,
      totalPages,
    };
  }

  static async create(dto: TechoIhssCreateDto) {
    await assertSinTraslape(dto.fechaInicio, dto.fechaFin);
    const row = await TechoIhssRepository.create(dto);
    return TechoIhssRepository.toDto(row);
  }

  static async update(id: number, dto: TechoIhssUpdateDto) {
    const row = await TechoIhssRepository.findById(id);
    if (!row) {
      const err: Error & { statusCode?: number } = new Error(
        "Registro no encontrado",
      );
      err.statusCode = 404;
      throw err;
    }
    await assertSinTraslape(dto.fechaInicio, dto.fechaFin, id);
    const updated = await TechoIhssRepository.update(id, dto);
    return TechoIhssRepository.toDto(updated);
  }

  static async delete(id: number) {
    const row = await TechoIhssRepository.findById(id);
    if (!row) {
      const err: Error & { statusCode?: number } = new Error(
        "Registro no encontrado",
      );
      err.statusCode = 404;
      throw err;
    }
    await TechoIhssRepository.delete(id);
  }
}
