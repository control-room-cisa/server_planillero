import { Prisma, Empleado } from "@prisma/client";
import { CreateEmpleadoDto, EmployeeDto } from "../dtos/employee.dto";
import { EmpleadoRepository } from "../repositories/EmpleadoRepository";
import { prisma } from "../config/prisma";

type EmpleadoConDepartamento = Prisma.EmpleadoGetPayload<{
  include: {
    departamento: {
      select: { nombre: true; empresaId: true };
    };
  };
}>;

export class EmpleadoService {
  static async generateCodigo(): Promise<string> {
    const last = await EmpleadoRepository.findLastCodigo();
    // Si no hay fila o el campo viene null, arrancamos en 001
    if (!last || last.codigo == null) {
      return "EMP001";
    }

    // A partir de aquí TS sabe que last.codigo es string
    const num = parseInt(last.codigo.replace(/^EMP/, ""), 10) || 0;
    const next = (num + 1).toString().padStart(3, "0");
    return `EMP${next}`;
  }

  static async getByDepartment(departamentoId: number): Promise<EmployeeDto[]> {
    const rows = await EmpleadoRepository.findByDepartment(departamentoId);
    return rows.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      apellido: e.apellido,
      codigo: e.codigo,
      departamento: e.departamento.nombre,
    }));
  }

  static async getById(id: number) {
    return EmpleadoRepository.findById(id);
  }

  static async getByCompany(empresaId?: number): Promise<EmployeeDto[]> {
    // Si no se proporciona empresaId, obtener todos los empleados de todas las empresas
    let rows;
    if (empresaId) {
      rows = await EmpleadoRepository.findByCompany(empresaId);
    } else {
      // Obtener todos los empleados con sus departamentos
      rows = await EmpleadoRepository.findAllWithDepartment();
    }

    return rows.map(
      (e: {
        id: number;
        nombre: string;
        apellido: string;
        codigo?: string;
        departamento: {
          nombre: string;
          empresaId: number;
        };
      }) => ({
        id: e.id,
        nombre: e.nombre,
        apellido: e.apellido,
        codigo: e.codigo,
        departamento: e.departamento.nombre,
        empresaId: e.departamento.empresaId,
      })
    );
  }

  static async createEmpleado(
    dto: CreateEmpleadoDto
  ): Promise<EmpleadoConDepartamento> {
    const { rolId, departamentoId, ...rest } = dto;
    return prisma.empleado.create({
      data: {
        ...rest,
        rol: { connect: { id: rolId } },
        departamento: { connect: { id: departamentoId } },
      },
      include: {
        departamento: {
          select: { nombre: true, empresaId: true },
        },
      },
    });
  }

  static async updateEmpleado(
    id: number,
    data: Prisma.EmpleadoUpdateInput
  ): Promise<Empleado> {
    return EmpleadoRepository.updateEmpleado(id, data);
  }
}
