import fs from "fs/promises";
import fssync from "fs";
import path from "path";

export type SavedFileInfo = {
  filename: string; // solo el nombre guardado en BD
  absPath: string; // ruta absoluta en disco
  publicUrl: string; // /uploads/empleados/:id/(foto|cv)/filename
};

const UPLOADS_PUBLIC_BASE = "/uploads";
const EMP_BASE_DIR = "empleados";
const FOTO_DIR = "foto";
const CV_DIR = "cv";

// Si quieres devolver URL absoluta en la respuesta, configura esto (opcional)
const APP_BASE_URL = process.env.APP_BASE_URL ?? "";

function uniqueBasename(prefix: "p" | "c", originalName: string): string {
  const ext =
    (originalName.match(/\.[^.]+$/) || [""])[0].toLowerCase() || ".bin";
  const ts = Date.now().toString(36); // timestamp base36
  const rnd = Math.random().toString(36).slice(2, 6); // 4 chars aleatorios
  return `${prefix}${ts}${rnd}${ext}`; // ej: pkvj4m1xyz.jpg
}

export class FileService {
  static baseUploadsAbs = path.join(process.cwd(), "uploads");

  private static async ensureDir(dirPath: string) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  static buildFotoUrl(empleadoId: number, filename?: string, absolute = false) {
    if (!filename) return undefined;
    // Back-compat si alguna vez quedó una ruta completa en BD
    if (filename.includes("/"))
      return absolute ? APP_BASE_URL + filename : filename;
    const rel = `${UPLOADS_PUBLIC_BASE}/${EMP_BASE_DIR}/${empleadoId}/${FOTO_DIR}/${filename}`;
    return absolute ? APP_BASE_URL + rel : rel;
  }

  static buildCvUrl(empleadoId: number, filename?: string, absolute = false) {
    if (!filename) return undefined;
    if (filename.includes("/"))
      return absolute ? APP_BASE_URL + filename : filename;
    const rel = `${UPLOADS_PUBLIC_BASE}/${EMP_BASE_DIR}/${empleadoId}/${CV_DIR}/${filename}`;
    return absolute ? APP_BASE_URL + rel : rel;
  }

  /** Mueve la foto del tmp a su carpeta final con nombre único; retorna filename y URL relativa. */
  static async saveFoto(
    empleadoId: number,
    tempAbsPath: string,
    originalName: string
  ): Promise<SavedFileInfo> {
    const filename = uniqueBasename("p", originalName);
    const dirAbs = path.join(
      this.baseUploadsAbs,
      EMP_BASE_DIR,
      String(empleadoId),
      FOTO_DIR
    );
    await this.ensureDir(dirAbs);
    const finalAbs = path.join(dirAbs, filename);

    if (fssync.existsSync(finalAbs)) await fs.rm(finalAbs, { force: true });
    await fs.rename(tempAbsPath, finalAbs);

    return {
      filename,
      absPath: finalAbs,
      publicUrl: this.buildFotoUrl(empleadoId, filename)!,
    };
  }

  /** Mueve el CV del tmp a su carpeta final con nombre único; retorna filename y URL relativa. */
  static async saveCv(
    empleadoId: number,
    tempAbsPath: string,
    originalName: string
  ): Promise<SavedFileInfo> {
    const filename = uniqueBasename("c", originalName);
    const dirAbs = path.join(
      this.baseUploadsAbs,
      EMP_BASE_DIR,
      String(empleadoId),
      CV_DIR
    );
    await this.ensureDir(dirAbs);
    const finalAbs = path.join(dirAbs, filename);

    if (fssync.existsSync(finalAbs)) await fs.rm(finalAbs, { force: true });
    await fs.rename(tempAbsPath, finalAbs);

    return {
      filename,
      absPath: finalAbs,
      publicUrl: this.buildCvUrl(empleadoId, filename)!,
    };
  }

  static async deleteFoto(empleadoId: number, filename?: string) {
    if (!filename || filename.includes("/")) return;
    const abs = path.join(
      this.baseUploadsAbs,
      EMP_BASE_DIR,
      String(empleadoId),
      FOTO_DIR,
      filename
    );
    try {
      await fs.rm(abs, { force: true });
    } catch {}
  }

  static async deleteCv(empleadoId: number, filename?: string) {
    if (!filename || filename.includes("/")) return;
    const abs = path.join(
      this.baseUploadsAbs,
      EMP_BASE_DIR,
      String(empleadoId),
      CV_DIR,
      filename
    );
    try {
      await fs.rm(abs, { force: true });
    } catch {}
  }

  static async deleteTemp(tempAbsPath?: string) {
    if (!tempAbsPath) return;
    try {
      await fs.rm(tempAbsPath, { force: true });
    } catch {}
  }
}
