import { EmpresaRepository } from "../repositories/EmpresaRepository";
import type { Departamento, Empresa } from "@prisma/client";
import type { CreateEmpresaDto, UpdateEmpresaDto } from "../dtos/empresa.dto";

export class EmpresaService {
  /** Lógica de negocio: listar empresas */
  static async listEmpresas(): Promise<Empresa[]> {
    return EmpresaRepository.findAll();
  }

  static async listWithDepartments(): Promise<
    (Empresa & { departamentos: Departamento[] })[]
  > {
    return EmpresaRepository.findAllWithDepartments();
  }

  static async create(data: CreateEmpresaDto): Promise<Empresa> {
    // Verificar que el nombre no se repita
    const existingByName = await EmpresaRepository.findByName(data.nombre);
    if (existingByName) {
      throw new Error("Ya existe una empresa con ese nombre");
    }

    // Verificar que el código sea único si se proporciona
    if (data.codigo && data.codigo.trim()) {
      const existingByCodigo = await EmpresaRepository.findByCodigo(
        data.codigo
      );
      if (existingByCodigo) {
        throw new Error("Ya existe una empresa con ese código");
      }
    }

    return EmpresaRepository.create(data);
  }

  static async update(id: number, data: UpdateEmpresaDto): Promise<Empresa> {
    // Verificar que la empresa existe
    const empresa = await EmpresaRepository.findById(id);
    if (!empresa) {
      throw new Error("Empresa no encontrada");
    }

    // Si se está actualizando el nombre, verificar que no se repita
    if (data.nombre && data.nombre !== empresa.nombre) {
      const existingByName = await EmpresaRepository.findByName(data.nombre);
      if (existingByName && existingByName.id !== id) {
        throw new Error("Ya existe una empresa con ese nombre");
      }
    }

    // Si se está actualizando el código, verificar que sea único
    if (data.codigo !== undefined) {
      const codigoValue = data.codigo?.trim() || null;
      // Solo validar si se está proporcionando un código y es diferente al actual
      if (codigoValue && codigoValue !== empresa.codigo?.trim()) {
        const existingByCodigo = await EmpresaRepository.findByCodigo(
          codigoValue
        );
        if (existingByCodigo && existingByCodigo.id !== id) {
          throw new Error("Ya existe una empresa con ese código");
        }
      }
    }

    return EmpresaRepository.update(id, data);
  }

  static async softDelete(id: number): Promise<Empresa> {
    // Verificar que la empresa existe
    const empresa = await EmpresaRepository.findById(id);
    if (!empresa) {
      throw new Error("Empresa no encontrada");
    }

    if (empresa.deletedAt) {
      throw new Error("La empresa ya fue eliminada");
    }

    return EmpresaRepository.softDelete(id);
  }
}
