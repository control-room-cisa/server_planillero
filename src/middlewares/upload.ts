import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuid } from "uuid";

const TMP_DIR = path.join(process.cwd(), "uploads", "tmp");

// Crea el directorio temporal si no existe
fs.mkdirSync(TMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, TMP_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuid()}${ext}`);
  },
});

const allowedByField: Record<string, string[]> = {
  // campo "foto": imágenes comunes
  foto: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
    // 'image/heic', // opcional
  ],
  // campo "cv": pdf/doc/docx
  cv: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

function fileFilter(
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const allowed = allowedByField[file.fieldname];
  if (!allowed) {
    return cb(new Error(`Campo no permitido: ${file.fieldname}`));
  }
  if (!allowed.includes(file.mimetype)) {
    return cb(
      new Error(`Tipo no permitido para ${file.fieldname}: ${file.mimetype}`)
    );
  }
  cb(null, true);
}

// Límite global razonable (p.ej. 15MB)
export const uploadEmpleado = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
  },
}).fields([
  { name: "foto", maxCount: 1 },
  { name: "cv", maxCount: 1 },
]);
