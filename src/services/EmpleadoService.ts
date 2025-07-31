// src/services/EmpleadoService.ts
import { Prisma, Empleado } from "@prisma/client";
import {
  CreateEmpleadoDto,
  UpdateEmpleadoDto,
  EmployeeDto,
} from "../dtos/employee.dto";
import { EmpleadoRepository } from "../repositories/EmpleadoRepository";
import { prisma } from "../config/prisma";
import { FileService } from "./FileService";

type MulterFile = Express.Multer.File;

type EmpleadoConDepartamento = Prisma.EmpleadoGetPayload<{
  include: {
    departamento: {
      select: { nombre: true; empresaId: true };
    };
  };
}>;

export class EmpleadoService {
  // ----------------------------
  // Utilidades privadas
  // ----------------------------
  private static toDtoBase(emp: Empleado): EmployeeDto {
    return {
      id: emp.id,
      nombre: emp.nombre,
      apellido: emp.apellido ?? undefined,
      codigo: emp.codigo ?? undefined,
      // construimos URLs públicas a partir del filename guardado en BD
      urlFotoPerfil: FileService.buildFotoUrl(
        emp.id,
        emp.urlFotoPerfil ?? undefined,
        false
      ),
      urlCv: FileService.buildCvUrl(emp.id, emp.urlCv ?? undefined, false),
    };
  }

  // ----------------------------
  // Código correlativo EMPxxx
  // ----------------------------
  static async generateCodigo(): Promise<string> {
    const last = await EmpleadoRepository.findLastCodigo();
    // Si no hay fila o el campo viene null, arrancamos en 001
    if (!last || last.codigo == null) {
      return "EMP001";
    }
    const num = parseInt(last.codigo.replace(/^EMP/, ""), 10) || 0;
    const next = (num + 1).toString().padStart(3, "0");
    return `EMP${next}`;
  }

  // ----------------------------
  // Lecturas
  // ----------------------------
  static async getByDepartment(departamentoId: number): Promise<EmployeeDto[]> {
    const rows = await EmpleadoRepository.findByDepartment(departamentoId);
    return rows.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      apellido: e.apellido ?? undefined,
      codigo: e.codigo ?? undefined,
      departamento: e.departamento.nombre,
      // agregar URLs públicas a partir de los filenames
      urlFotoPerfil: FileService.buildFotoUrl(
        e.id,
        (e as any).urlFotoPerfil,
        false
      ),
      urlCv: FileService.buildCvUrl(e.id, (e as any).urlCv, false),
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
      rows = await EmpleadoRepository.findAllWithDepartment();
    }

    return rows.map(
      (e: {
        id: number;
        nombre: string;
        apellido: string | null;
        codigo?: string | null;
        urlFotoPerfil?: string | null;
        urlCv?: string | null;
        departamento: { nombre: string; empresaId: number };
      }) => ({
        id: e.id,
        nombre: e.nombre,
        apellido: e.apellido ?? undefined,
        codigo: e.codigo ?? undefined,
        departamento: e.departamento.nombre,
        empresaId: e.departamento.empresaId,
        urlFotoPerfil: FileService.buildFotoUrl(
          e.id,
          e.urlFotoPerfil ?? undefined,
          false
        ),
        urlCv: FileService.buildCvUrl(e.id, e.urlCv ?? undefined, false),
      })
    );
  }

  // ----------------------------
  // Escrituras sin archivos (legacy / uso interno)
  // ----------------------------
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

  // ----------------------------
  // NUEVO: Escrituras con archivos (orquestación DB + FS)
  // Guardamos SOLO el "filename" en BD (no la ruta completa)
  // ----------------------------

  /**
   * Crea empleado y maneja archivos (foto/cv).
   * - Genera código "EMPxxx"
   * - Crea registro sin archivos
   * - Mueve archivos desde tmp → /uploads/empleados/:id/(foto|cv)/<filename-único>
   * - Actualiza BD con SOLO el filename en urlFotoPerfil/urlCv
   * - Devuelve DTO con URLs públicas construidas
   */
  static async createWithFiles(
    body: CreateEmpleadoDto,
    files: { foto?: MulterFile; cv?: MulterFile }
  ): Promise<EmployeeDto> {
    // 1) Generar código y crear registro base (sin archivos)
    body.codigo = await this.generateCodigo();

    const { rolId, departamentoId, ...rest } = body;
    const emp = await prisma.empleado.create({
      data: {
        ...rest,
        rol: { connect: { id: rolId } },
        departamento: { connect: { id: departamentoId } },
      },
    });

    let fotoFilename: string | undefined;
    let cvFilename: string | undefined;

    try {
      // 2) Guardar archivos (si vienen)
      if (files.foto) {
        const saved = await FileService.saveFoto(
          emp.id,
          files.foto.path,
          files.foto.originalname
        );
        fotoFilename = saved.filename; // SOLO filename a BD
      }
      if (files.cv) {
        const saved = await FileService.saveCv(
          emp.id,
          files.cv.path,
          files.cv.originalname
        );
        cvFilename = saved.filename; // SOLO filename a BD
      }

      // 3) Actualizar BD con filenames
      const empFinal =
        fotoFilename || cvFilename
          ? await prisma.empleado.update({
              where: { id: emp.id },
              data: {
                ...(fotoFilename ? { urlFotoPerfil: fotoFilename } : {}),
                ...(cvFilename ? { urlCv: cvFilename } : {}),
              },
            })
          : emp;

      // 4) DTO con URLs públicas
      return this.toDtoBase(empFinal);
    } catch (err) {
      // Compensación: borra archivos recién guardados si algo falla
      await FileService.deleteFoto(emp.id, fotoFilename);
      await FileService.deleteCv(emp.id, cvFilename);
      throw err;
    } finally {
      // Limpieza de temporales de multer
      await FileService.deleteTemp(files.foto?.path);
      await FileService.deleteTemp(files.cv?.path);
    }
  }

  /**
   * Actualiza datos del empleado y, si se envían, reemplaza foto/cv.
   * - Actualiza campos "normales"
   * - Si hay archivos, guarda los nuevos (filename único), actualiza BD y borra los anteriores
   * - Devuelve DTO con URLs públicas
   */
  static async updateWithFiles(
    body: UpdateEmpleadoDto,
    files: { foto?: MulterFile; cv?: MulterFile }
  ): Promise<EmployeeDto> {
    const { id, ...rest } = body as any;

    // 1) Obtener estado previo para poder limpiar archivos viejos si se reemplazan
    const empPrev = await prisma.empleado.findUnique({ where: { id } });
    if (!empPrev) {
      await FileService.deleteTemp(files.foto?.path);
      await FileService.deleteTemp(files.cv?.path);
      throw new Error("Empleado no encontrado");
    }

    // 2) Actualizar campos normales primero
    let emp = await EmpleadoRepository.updateEmpleado(
      id,
      rest as Prisma.EmpleadoUpdateInput
    );

    // 3) Si vienen archivos, guardarlos y actualizar filenames
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
        emp = await prisma.empleado.update({
          where: { id },
          data: {
            ...(newFotoFilename ? { urlFotoPerfil: newFotoFilename } : {}),
            ...(newCvFilename ? { urlCv: newCvFilename } : {}),
          },
        });

        // 4) Borrar archivos anteriores SOLO si hubo reemplazo
        if (newFotoFilename && empPrev.urlFotoPerfil) {
          await FileService.deleteFoto(id, empPrev.urlFotoPerfil);
        }
        if (newCvFilename && empPrev.urlCv) {
          await FileService.deleteCv(id, empPrev.urlCv);
        }
      }

      // 5) DTO con URLs públicas
      return this.toDtoBase(emp);
    } catch (err) {
      // Si falla actualización, borra archivos nuevos para no dejar huérfanos
      await FileService.deleteFoto(id, newFotoFilename);
      await FileService.deleteCv(id, newCvFilename);
      throw err;
    } finally {
      // Limpieza de temporales de multer
      await FileService.deleteTemp(files.foto?.path);
      await FileService.deleteTemp(files.cv?.path);
    }
  }
}

export type { EmpleadoConDepartamento };
