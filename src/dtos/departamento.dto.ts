// src/dtos/departamento.dto.ts

export interface DepartamentoDto {
  id: number;
  empresaId: number;
  nombre: string | null;
  codigo?: string | null;
  createdAt: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}

export interface CreateDepartamentoDto {
  empresaId: number;
  nombre: string;
  codigo?: string;
}

export interface UpdateDepartamentoDto {
  nombre?: string;
  codigo?: string;
}

