import { DepartamentoRepository } from "../repositories/DepartamentoRepository";
import type { Departamento } from "@prisma/client";
import type {
  CreateDepartamentoDto,
  UpdateDepartamentoDto,
} from "../dtos/departamento.dto";

export class DepartamentoService {
  static async listByEmpresa(empresaId: number): Promise<Departamento[]> {
    return DepartamentoRepository.findByEmpresaId(empresaId);
  }

  static async getById(id: number): Promise<Departamento> {
    const departamento = await DepartamentoRepository.findById(id);
    if (!departamento) {
      throw new Error("Departamento no encontrado");
    }
    return departamento;
  }

  static async create(data: CreateDepartamentoDto): Promise<Departamento> {
    // Validar que el nombre no esté vacío
    if (!data.nombre || !data.nombre.trim()) {
      throw new Error("El nombre del departamento es obligatorio");
    }

    // Verificar que no exista otro departamento con el mismo nombre en la misma empresa
    const existingByName = await DepartamentoRepository.findByNameAndEmpresa(
      data.nombre,
      data.empresaId
    );
    if (existingByName) {
      throw new Error(
        "Ya existe un departamento con ese nombre en esta empresa"
      );
    }

    // Verificar que el código sea único si se proporciona
    if (data.codigo && data.codigo.trim()) {
      const existingByCodigo = await DepartamentoRepository.findByCodigo(
        data.codigo
      );
      if (existingByCodigo) {
        throw new Error("Ya existe un departamento con ese código");
      }
    }

    return DepartamentoRepository.create({
      empresaId: data.empresaId,
      nombre: data.nombre,
      codigo: data.codigo,
    });
  }

  static async update(
    id: number,
    data: UpdateDepartamentoDto
  ): Promise<Departamento> {
    // Verificar que el departamento existe
    const departamento = await DepartamentoRepository.findById(id);
    if (!departamento) {
      throw new Error("Departamento no encontrado");
    }

    // Si se está actualizando el nombre, verificar que no se repita en la misma empresa
    if (data.nombre && data.nombre.trim() !== departamento.nombre?.trim()) {
      const existingByName = await DepartamentoRepository.findByNameAndEmpresa(
        data.nombre,
        departamento.empresaId
      );
      if (existingByName && existingByName.id !== id) {
        throw new Error(
          "Ya existe un departamento con ese nombre en esta empresa"
        );
      }
    }

    // Si se está actualizando el código, verificar que sea único
    if (data.codigo !== undefined) {
      const codigoValue = data.codigo?.trim() || null;
      // Solo validar si se está proporcionando un código y es diferente al actual
      if (codigoValue && codigoValue !== departamento.codigo?.trim()) {
        const existingByCodigo = await DepartamentoRepository.findByCodigo(
          codigoValue
        );
        if (existingByCodigo && existingByCodigo.id !== id) {
          throw new Error("Ya existe un departamento con ese código");
        }
      }
    }

    return DepartamentoRepository.update(id, data);
  }

  static async delete(id: number): Promise<Departamento> {
    // Verificar que el departamento existe
    const departamento = await DepartamentoRepository.findById(id);
    if (!departamento) {
      throw new Error("Departamento no encontrado");
    }

    if (departamento.deletedAt) {
      throw new Error("El departamento ya fue eliminado");
    }

    return DepartamentoRepository.softDelete(id);
  }
}

