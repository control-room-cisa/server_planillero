import type { Vehiculo } from "@prisma/client";
import { VehiculoRepository } from "../repositories/VehiculoRepository";
import type {
  CreateVehiculoDto,
  UpdateVehiculoDto,
} from "../dtos/vehiculo.dto";

export class VehiculoService {
  static async listVehiculos(): Promise<Vehiculo[]> {
    return VehiculoRepository.findAll();
  }

  static async getById(id: number): Promise<Vehiculo> {
    const vehiculo = await VehiculoRepository.findById(id);
    if (!vehiculo) {
      throw new Error("Vehículo no encontrado");
    }
    return vehiculo;
  }

  static async create(data: CreateVehiculoDto): Promise<Vehiculo> {
    if (!data.nombre || !data.nombre.trim()) {
      throw new Error("El nombre del vehículo es obligatorio");
    }

    if (!Number.isFinite(data.class) || data.class <= 0) {
      throw new Error("El class del vehículo es obligatorio");
    }

    const existingByClass = await VehiculoRepository.findByClass(data.class);
    if (existingByClass) {
      throw new Error(
        "Ya existe un vehículo con ese class. No se permiten duplicados."
      );
    }

    return VehiculoRepository.create({
      class: data.class,
      nombre: data.nombre,
      tipo: data.tipo,
    });
  }

  static async update(id: number, data: UpdateVehiculoDto): Promise<Vehiculo> {
    const vehiculo = await VehiculoRepository.findById(id);
    if (!vehiculo) {
      throw new Error("Vehículo no encontrado");
    }

    if (data.class !== undefined && data.class !== vehiculo.class) {
      const existingByClass = await VehiculoRepository.findByClass(
        data.class,
        id
      );
      if (existingByClass) {
        throw new Error(
          "Ya existe un vehículo con ese class. No se permiten duplicados."
        );
      }
    }

    if (data.nombre !== undefined && !data.nombre.trim()) {
      throw new Error("El nombre del vehículo es obligatorio");
    }

    return VehiculoRepository.update(id, data);
  }

  static async delete(id: number): Promise<Vehiculo> {
    const vehiculo = await VehiculoRepository.findById(id);
    if (!vehiculo) {
      throw new Error("Vehículo no encontrado");
    }

    if (vehiculo.deletedAt) {
      throw new Error("El vehículo ya fue eliminado");
    }

    return VehiculoRepository.softDelete(id);
  }
}
