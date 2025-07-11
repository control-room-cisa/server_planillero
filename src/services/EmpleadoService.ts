import { EmployeeDto } from "../dtos/employee";
import { EmpleadoRepository } from "../repositories/EmpleadoRepository";

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

};

static async getByDepartment(departamentoId: number): Promise<EmployeeDto[]> {
    const rows = await EmpleadoRepository.findByDepartment(departamentoId);
    return rows.map(e => ({
      id:       e.id,
      nombre:   e.nombre,
      apellido: e.apellido,
      codigo:   e.codigo,
      departamento: e.departamento.nombre
    }));
  }

}
