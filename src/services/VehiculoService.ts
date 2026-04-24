import type { Vehiculo } from "@prisma/client";
import { prisma } from "../config/prisma";

export class VehiculoService {
  static async listVehiculos(): Promise<Vehiculo[]> {
    return prisma.vehiculo.findMany({
      where: { deletedAt: null },
      orderBy: { class: "asc" },
    });
  }
}
