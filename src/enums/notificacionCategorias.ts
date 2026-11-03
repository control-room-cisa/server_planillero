/** Códigos de categoría para notificaciones_log (UI distinta por tipo). */
export const NotificacionCategorias = {
  CAMBIO_JOB: "CAMBIO_JOB",
  CAMBIO_CLASS: "CAMBIO_CLASS",
  DATOS_PERSONALES: "DATOS_PERSONALES",
  ACTIVACION: "ACTIVACION",
  SOLICITUD_PERMISO: "SOLICITUD_PERMISO",
} as const;

export type NotificacionCategoria =
  (typeof NotificacionCategorias)[keyof typeof NotificacionCategorias];
