import { z } from "zod";

export const registerSchema = z.object({
  body: z.object({
    nombre: z.string().min(1, "El nombre es obligatorio"),
    apellido: z.string().min(1, "El apellido es obligatorio"),
    correoElectronico: z.string().email("Correo inválido"),
    contrasena: z
      .string()
      .min(6, "La contraseña debe tener al menos 6 caracteres"),
    departamentoId: z
      .number({
        required_error: "El ID de departamento es obligatorio",
        invalid_type_error: "departamentoId debe ser un número",
      })
      .int()
      .positive(),
  }),
});

export const loginSchema = z.object({
  body: z
    .object({
      usuario: z.string().optional(),
      correoElectronico: z.string().optional(),
      contrasena: z.string().min(1, "La contraseña es obligatoria"),
    })
    .refine((data) => data.usuario || data.correoElectronico, {
      message: "Debe proporcionar usuario o correoElectronico",
      path: ["usuario"], // Asigna el error al campo usuario
    }),
});

export const changePasswordSchema = z.object({
  body: z
    .object({
      usuario: z.string().optional(),
      correoElectronico: z.string().email("Correo inválido").optional(),
      dni: z.string().optional(),
      contrasenaActual: z.string().min(1, "La contraseña actual es obligatoria"),
      nuevaContrasena: z
        .string()
        .min(6, "La nueva contraseña debe tener al menos 6 caracteres"),
    })
    .refine((data) => data.usuario || data.correoElectronico || data.dni, {
      message: "Debe proporcionar usuario, correo electrónico o DNI",
      path: ["usuario"],
    }),
});
