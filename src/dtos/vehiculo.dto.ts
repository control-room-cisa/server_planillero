// src/dtos/vehiculo.dto.ts

export interface VehiculoDto {
  id: number;
  class: number;
  nombre: string;
  tipo?: string | null;
  createdAt: Date | null;
  updatedAt?: Date | null;
  deletedAt?: Date | null;
}

export interface CreateVehiculoDto {
  class: number;
  nombre: string;
  tipo?: string | null;
}

export interface UpdateVehiculoDto {
  class?: number;
  nombre?: string;
  tipo?: string | null;
}
