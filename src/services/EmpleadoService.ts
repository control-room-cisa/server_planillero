import { Prisma, Empleado } from "@prisma/client";
import bcrypt from "bcrypt";
import {
  CreateEmpleadoDto,
  UpdateEmpleadoDto,
  EmployeeDto,
  EmployeeDetailDto,
} from "../dtos/employee.dto";
import { EmpleadoRepository } from "../repositories/EmpleadoRepository";
import { RegistroDiarioRepository } from "../repositories/RegistroDiarioRepository";
import { PlanillaAccesoRevisionRepository } from "../repositories/PlanillaAccesoRevisionRepository";
import { FileService } from "./FileService";
import { mapTipoContrato, mapTipoCuenta } from "../utils/prismaEnumMapper";

const SALT_ROUNDS = 10;

export class EmpleadoService {
  static toDtoBase(emp: Empleado): EmployeeDto {
    return {
      id: emp.id,
      nombre: emp.nombre,
      apellido: emp.apellido ?? undefined,
      codigo: emp.codigo ?? undefined,
      cargo: emp.cargo ?? undefined,
      rolId: emp.rolId ?? undefined,
      urlFotoPerfil: FileService.buildFotoUrl(
        emp.id,
        emp.urlFotoPerfil ?? undefined
      ),
      urlCv: FileService.buildCvUrl(emp.id, emp.urlCv ?? undefined),
    };
  }

  static toDtoDetail(
    emp: Empleado & {
      departamento?: { nombre: string | null; empresaId: number } | null;
    }
  ): EmployeeDetailDto {
    return {
      id: emp.id,
      nombre: emp.nombre,
      apellido: emp.apellido ?? undefined,
      codigo: emp.codigo ?? undefined,
      departamento: emp.departamento?.nombre ?? undefined,
      empresaId: emp.departamento?.empresaId ?? undefined,
      urlFotoPerfil: FileService.buildFotoUrl(
        emp.id,
        emp.urlFotoPerfil ?? undefined
      ),
      urlCv: FileService.buildCvUrl(emp.id, emp.urlCv ?? undefined),
      nombreUsuario: emp.nombreUsuario ?? undefined,
      correoElectronico: emp.correoElectronico ?? undefined,
      dni: emp.dni ?? undefined,
      profesion: emp.profesion ?? undefined,
      // En BD se guardan códigos (H1_1, H2_1, etc.). La etiqueta legible se resuelve en frontend.
      tipoHorario: emp.tipoHorario ?? undefined,
      estadoCivil: emp.estadoCivil ?? undefined,
      nombreConyugue: emp.nombreConyugue ?? undefined,
      cargo: emp.cargo ?? undefined,
      sueldoMensual: emp.sueldoMensual ?? undefined,
      tipoContrato: mapTipoContrato(emp.tipoContrato) as any,
      condicionSalud: emp.condicionSalud ?? undefined,
      nombreContactoEmergencia: emp.nombreContactoEmergencia ?? undefined,
      numeroContactoEmergencia: emp.numeroContactoEmergencia ?? undefined,
      banco: emp.banco ?? undefined,
      tipoCuenta: mapTipoCuenta(emp.tipoCuenta) as any,
      numeroCuenta: emp.numeroCuenta ?? undefined,
      muerteBeneficiario: emp.muerteBeneficiario ?? undefined,
      nombreMadre: emp.nombreMadre ?? undefined,
      nombrePadre: emp.nombrePadre ?? undefined,
      activo: emp.activo,
      telefono: emp.telefono ?? undefined,
      direccion: emp.direccion ?? undefined,
      fechaInicioIngreso: emp.fechaInicioIngreso ?? undefined,
      editTime: emp.editTime ?? undefined,
      rolId: emp.rolId,
      departamentoId: emp.departamentoId,
      tiempoCompensatorioHoras: emp.tiempoCompensatorioHoras ?? undefined,
      tiempoVacacionesHoras: emp.tiempoVacacionesHoras ?? undefined,
    };
  }

  static async generateCodigo(): Promise<string> {
    const last = await EmpleadoRepository.findLastCodigo();
    if (!last || last.codigo == null) return "EMP001";
    const num = parseInt(last.codigo.replace(/^EMP/, ""), 10) || 0;
    return `EMP${(num + 1).toString().padStart(3, "0")}`;
  }

  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static async getByDepartment(
    departamentoId: number,
    supervisorId?: number
  ): Promise<EmployeeDto[]> {
    // 1. Obtener empleados del mismo departamento
    const empleadosDepartamento = await EmpleadoRepository.findByDepartment(
      departamentoId
    );

    // 2. Si hay supervisorId, obtener empleados de PlanillaAcceso
    let empleadosPlanillaAcceso: Empleado[] = [];
    if (supervisorId) {
      const accesos = await PlanillaAccesoRevisionRepository.findAll({
        supervisorId,
      });
      // Extraer los empleados únicos de los accesos
      const empleadoIds = new Set(accesos.map((acceso) => acceso.empleadoId));
      if (empleadoIds.size > 0) {
        empleadosPlanillaAcceso = await EmpleadoRepository.findByIds(
          Array.from(empleadoIds)
        );
      }
    }

    // 3. Combinar ambos conjuntos y eliminar duplicados por ID
    const empleadosMap = new Map<number, any>();

    // Agregar empleados del departamento
    empleadosDepartamento.forEach((e) => {
      empleadosMap.set(e.id, e);
    });

    // Agregar empleados de PlanillaAcceso (sobrescriben si hay duplicados)
    empleadosPlanillaAcceso.forEach((e) => {
      empleadosMap.set(e.id, e);
    });

    const rows = Array.from(empleadosMap.values());

    // 4. Cargar en paralelo el estado de los últimos 20 días para todos los empleados
    const enriched = await Promise.all(
      rows.map(async (e: any) => {
        const approvals =
          await RegistroDiarioRepository.findApprovalStatusInLastDays(e.id, 20);
        return {
          id: e.id,
          nombre: e.nombre,
          apellido: e.apellido ?? undefined,
          codigo: e.codigo ?? undefined,
          departamento: e.departamento?.nombre,
          empresaId: e.departamento?.empresaId,
          empresa: e.departamento?.empresa?.nombre
            ? { nombre: e.departamento.empresa.nombre }
            : undefined,
          cargo: e.cargo ?? undefined,
          rolId: e.rolId ?? undefined,
          urlFotoPerfil: FileService.buildFotoUrl(
            e.id,
            e.urlFotoPerfil ?? undefined
          ),
          urlCv: FileService.buildCvUrl(e.id, e.urlCv ?? undefined),
          activo: e.activo,
          registrosUltimos20Dias: approvals.map((a) => ({
            fecha: a.fecha,
            aprobacionSupervisor: a.aprobacionSupervisor ?? null,
            aprobacionRrhh: a.aprobacionRrhh ?? null,
          })),
        } as EmployeeDto;
      })
    );
    return enriched;
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
      cargo: e.cargo ?? undefined,
      rolId: e.rolId ?? undefined,
      urlFotoPerfil: FileService.buildFotoUrl(
        e.id,
        e.urlFotoPerfil ?? undefined
      ),
      urlCv: FileService.buildCvUrl(e.id, e.urlCv ?? undefined),
      activo: e.activo,
    }));
  }

  static async createEmpleado(dto: CreateEmpleadoDto) {
    // Hashear contraseña si está presente
    if (dto.contrasena) {
      dto.contrasena = await this.hashPassword(dto.contrasena);
    }
    return EmpleadoRepository.createEmpleado(dto);
  }

  static async updateEmpleado(
    id: number,
    data: Prisma.EmpleadoUpdateInput
  ): Promise<Empleado> {
    // Hashear contraseña si está presente
    if (data.contrasena && typeof data.contrasena === "string") {
      data.contrasena = await this.hashPassword(data.contrasena);
    }
    return EmpleadoRepository.updateEmpleado(id, data);
  }

  static async createWithFiles(
    body: CreateEmpleadoDto,
    files: { foto?: Express.Multer.File; cv?: Express.Multer.File }
  ): Promise<EmployeeDto> {
    // Validar que el nombre de usuario no exista
    if (body.nombreUsuario) {
      const existingByUsername = await EmpleadoRepository.findByUsername(
        body.nombreUsuario
      );
      if (existingByUsername) {
        throw new Error("El nombre de usuario ya está en uso");
      }
    }

    // Validar que el correo no exista (si se proporciona)
    if (body.correoElectronico) {
      const existingByEmail = await EmpleadoRepository.findByEmail(
        body.correoElectronico
      );
      if (existingByEmail) {
        throw new Error("El correo electrónico ya está en uso");
      }
    }

    // Validar que el DNI no exista (si se proporciona)
    if (body.dni) {
      const existingByDni = await EmpleadoRepository.findByDni(body.dni);
      if (existingByDni) {
        throw new Error("El DNI ya está registrado");
      }
    }

    body.codigo = await this.generateCodigo();

    // Hashear contraseña si está presente
    if (body.contrasena) {
      body.contrasena = await this.hashPassword(body.contrasena);
    }

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

    // Validar que el nombre de usuario no exista (si se está actualizando y es diferente)
    if (rest.nombreUsuario && rest.nombreUsuario !== empPrev.nombreUsuario) {
      const existingByUsername = await EmpleadoRepository.findByUsername(
        rest.nombreUsuario
      );
      if (existingByUsername && existingByUsername.id !== id) {
        throw new Error("El nombre de usuario ya está en uso");
      }
    }

    // Validar que el correo no exista (si se está actualizando y es diferente)
    if (
      rest.correoElectronico &&
      rest.correoElectronico !== empPrev.correoElectronico
    ) {
      const existingByEmail = await EmpleadoRepository.findByEmail(
        rest.correoElectronico
      );
      if (existingByEmail && existingByEmail.id !== id) {
        throw new Error("El correo electrónico ya está en uso");
      }
    }

    // Validar que el DNI no exista (si se está actualizando y es diferente)
    if (rest.dni && rest.dni !== empPrev.dni) {
      const existingByDni = await EmpleadoRepository.findByDni(rest.dni);
      if (existingByDni && existingByDni.id !== id) {
        throw new Error("El DNI ya está registrado");
      }
    }

    // Hashear contraseña si está presente
    if (rest.contrasena) {
      rest.contrasena = await this.hashPassword(rest.contrasena);
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
