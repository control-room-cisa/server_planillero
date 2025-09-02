import { Prisma, Empleado } from "@prisma/client";
import {
  CreateEmpleadoDto,
  UpdateEmpleadoDto,
  EmployeeDto,
  EmployeeDetailDto,
} from "../dtos/employee.dto";
import { EmpleadoRepository } from "../repositories/EmpleadoRepository";
import { FileService } from "./FileService";

export class EmpleadoService {
  static toDtoBase(emp: Empleado): EmployeeDto {
    return {
      id: emp.id,
      nombre: emp.nombre,
      apellido: emp.apellido ?? undefined,
      codigo: emp.codigo ?? undefined,
      urlFotoPerfil: FileService.buildFotoUrl(
        emp.id,
        emp.urlFotoPerfil ?? undefined,
        true
      ),
      urlCv: FileService.buildCvUrl(emp.id, emp.urlCv ?? undefined, true),
    };
  }

  static toDtoDetail(emp: Empleado): EmployeeDetailDto {
    return {
      id: emp.id,
      nombre: emp.nombre,
      apellido: emp.apellido ?? undefined,
      codigo: emp.codigo ?? undefined,
      urlFotoPerfil: FileService.buildFotoUrl(
        emp.id,
        emp.urlFotoPerfil ?? undefined,
        true
      ),
      urlCv: FileService.buildCvUrl(emp.id, emp.urlCv ?? undefined, true),
      nombreUsuario: emp.nombreUsuario ?? undefined,
      correoElectronico: emp.correoElectronico ?? undefined,
      dni: emp.dni ?? undefined,
      profesion: emp.profesion ?? undefined,
      tipoHorario: emp.tipoHorario ?? undefined,
      estadoCivil: emp.estadoCivil ?? undefined,
      nombreConyugue: emp.nombreConyugue ?? undefined,
      cargo: emp.cargo ?? undefined,
      sueldoMensual: emp.sueldoMensual ?? undefined,
      tipoContrato: emp.tipoContrato ?? undefined,
      condicionSalud: emp.condicionSalud ?? undefined,
      nombreContactoEmergencia: emp.nombreContactoEmergencia ?? undefined,
      numeroContactoEmergencia: emp.numeroContactoEmergencia ?? undefined,
      banco: emp.banco ?? undefined,
      tipoCuenta: emp.tipoCuenta ?? undefined,
      numeroCuenta: emp.numeroCuenta ?? undefined,
      muerteBeneficiario: emp.muerteBeneficiario ?? undefined,
      nombreMadre: emp.nombreMadre ?? undefined,
      nombrePadre: emp.nombrePadre ?? undefined,
      activo: emp.activo,
      telefono: emp.telefono ?? undefined,
      direccion: emp.direccion ?? undefined,
      fechaInicioIngreso: emp.fechaInicioIngreso ?? undefined,
      rolId: emp.rolId,
      departamentoId: emp.departamentoId,
    };
  }

  static async generateCodigo(): Promise<string> {
    const last = await EmpleadoRepository.findLastCodigo();
    if (!last || last.codigo == null) return "EMP001";
    const num = parseInt(last.codigo.replace(/^EMP/, ""), 10) || 0;
    return `EMP${(num + 1).toString().padStart(3, "0")}`;
  }

  static async getByDepartment(departamentoId: number): Promise<EmployeeDto[]> {
    const rows = await EmpleadoRepository.findByDepartment(departamentoId);
    return rows.map((e: any) => ({
      id: e.id,
      nombre: e.nombre,
      apellido: e.apellido ?? undefined,
      codigo: e.codigo ?? undefined,
      departamento: e.departamento?.nombre,
      empresaId: e.departamento?.empresaId,
      empresa: e.departamento?.empresa?.nombre
        ? { nombre: e.departamento.empresa.nombre }
        : undefined,
      urlFotoPerfil: FileService.buildFotoUrl(
        e.id,
        e.urlFotoPerfil ?? undefined,
        true
      ),
      urlCv: FileService.buildCvUrl(e.id, e.urlCv ?? undefined, true),
      activo: e.activo,
    }));
  }

  static async getById(id: number) {
    return EmpleadoRepository.findById(id);
  }

  static async getByCompany(empresaId?: number): Promise<EmployeeDto[]> {
    const rows = empresaId
      ? await EmpleadoRepository.findByCompany(empresaId)
      : await EmpleadoRepository.findAllWithDepartment();

    return rows.map((e: any) => ({
      id: e.id,
      nombre: e.nombre,
      apellido: e.apellido ?? undefined,
      codigo: e.codigo ?? undefined,
      departamento: e.departamento?.nombre,
      empresaId: e.departamento?.empresaId,
      empresa: e.departamento?.empresa?.nombre
        ? { nombre: e.departamento.empresa.nombre }
        : undefined,
      urlFotoPerfil: FileService.buildFotoUrl(
        e.id,
        e.urlFotoPerfil ?? undefined,
        true
      ),
      urlCv: FileService.buildCvUrl(e.id, e.urlCv ?? undefined, true),
      activo: e.activo,
    }));
  }

  static async createEmpleado(dto: CreateEmpleadoDto) {
    return EmpleadoRepository.createEmpleado(dto);
  }

  static async updateEmpleado(
    id: number,
    data: Prisma.EmpleadoUpdateInput
  ): Promise<Empleado> {
    return EmpleadoRepository.updateEmpleado(id, data);
  }

  static async createWithFiles(
    body: CreateEmpleadoDto,
    files: { foto?: Express.Multer.File; cv?: Express.Multer.File }
  ): Promise<EmployeeDto> {
    body.codigo = await this.generateCodigo();
    const empleado = await EmpleadoRepository.createEmpleado(body);

    let fotoFilename: string | undefined;
    let cvFilename: string | undefined;

    try {
      if (files.foto) {
        const saved = await FileService.saveFoto(
          empleado.id,
          files.foto.path,
          files.foto.originalname
        );
        fotoFilename = saved.filename;
      }
      if (files.cv) {
        const saved = await FileService.saveCv(
          empleado.id,
          files.cv.path,
          files.cv.originalname
        );
        cvFilename = saved.filename;
      }

      if (fotoFilename || cvFilename) {
        await EmpleadoRepository.updateEmpleado(empleado.id, {
          ...(fotoFilename ? { urlFotoPerfil: fotoFilename } : {}),
          ...(cvFilename ? { urlCv: cvFilename } : {}),
        });
      }

      return this.toDtoBase({
        ...empleado,
        urlFotoPerfil: fotoFilename ?? null,
        urlCv: cvFilename ?? null,
      });
    } catch (err) {
      await FileService.deleteFoto(empleado.id, fotoFilename);
      await FileService.deleteCv(empleado.id, cvFilename);
      throw err;
    } finally {
      await FileService.deleteTemp(files.foto?.path);
      await FileService.deleteTemp(files.cv?.path);
    }
  }

  static async updateWithFiles(
    body: UpdateEmpleadoDto,
    files: { foto?: Express.Multer.File; cv?: Express.Multer.File }
  ): Promise<EmployeeDto> {
    const { id, ...rest } = body as any;
    const empPrev = await EmpleadoRepository.findById(id);
    if (!empPrev) {
      await FileService.deleteTemp(files.foto?.path);
      await FileService.deleteTemp(files.cv?.path);
      throw new Error("Empleado no encontrado");
    }

    let emp = await EmpleadoRepository.updateEmpleado(
      id,
      rest as Prisma.EmpleadoUpdateInput
    );

    let newFotoFilename: string | undefined;
    let newCvFilename: string | undefined;

    try {
      if (files.foto) {
        const saved = await FileService.saveFoto(
          id,
          files.foto.path,
          files.foto.originalname
        );
        newFotoFilename = saved.filename;
      }
      if (files.cv) {
        const saved = await FileService.saveCv(
          id,
          files.cv.path,
          files.cv.originalname
        );
        newCvFilename = saved.filename;
      }

      if (newFotoFilename || newCvFilename) {
        emp = await EmpleadoRepository.updateEmpleado(id, {
          ...(newFotoFilename ? { urlFotoPerfil: newFotoFilename } : {}),
          ...(newCvFilename ? { urlCv: newCvFilename } : {}),
        });

        if (newFotoFilename && empPrev.urlFotoPerfil) {
          await FileService.deleteFoto(id, empPrev.urlFotoPerfil);
        }
        if (newCvFilename && empPrev.urlCv) {
          await FileService.deleteCv(id, empPrev.urlCv);
        }
      }

      return this.toDtoBase(emp);
    } catch (err) {
      await FileService.deleteFoto(id, newFotoFilename);
      await FileService.deleteCv(id, newCvFilename);
      throw err;
    } finally {
      await FileService.deleteTemp(files.foto?.path);
      await FileService.deleteTemp(files.cv?.path);
    }
  }
}
