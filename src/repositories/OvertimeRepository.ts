
import { PrismaClient, RegistroDiario } from '@prisma/client';

export class OvertimeRepository {
  private prisma = new PrismaClient();

  async findByEmpleadoAndDateRange(
    empleadoId: number,
    fechaInicio: string,
    fechaFin: string
  ): Promise<RegistroDiario[]> {
    const registros = await this.prisma.registroDiario.findMany({
      where: {
        empleadoId,
        fecha: { gte: fechaInicio, lte: fechaFin },
      },
      orderBy: { fecha: 'asc' },
    });
    return registros;
  }
}