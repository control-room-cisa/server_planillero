import { EmpresaRepository } from "../repositories/EmpresaRepository";
import type { Departamento, Empresa } from "@prisma/client";

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
}