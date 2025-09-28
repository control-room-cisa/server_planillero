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
    const existingEmpresa = await EmpresaRepository.findByName(data.nombre);
    if (existingEmpresa) {
      throw new Error("Ya existe una empresa con ese nombre");
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
      const existingEmpresa = await EmpresaRepository.findByName(data.nombre);
      if (existingEmpresa && existingEmpresa.id !== id) {
        throw new Error("Ya existe una empresa con ese nombre");
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
