// src/dtos/empresa/empresaDtos.ts

export interface DepartamentoDto {
  id: number;
  nombre: string | null; // string (o Date según tu schema), no Date
  codigo?: string | null;
  createdAt: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
  empresaId: number; // Prisma te lo está devolviendo
}

export interface EmpresaConDepartamentosDto {
  id: number;
  codigo?: string | null;
  nombre?: string | null;
  esConsorcio?: boolean | null;
  createdAt: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
  departamentos: DepartamentoDto[];
}

export interface CreateEmpresaDto {
  nombre: string;
  codigo: string;
  esConsorcio?: boolean;
}

export interface UpdateEmpresaDto {
  nombre?: string;
  codigo?: string;
}
