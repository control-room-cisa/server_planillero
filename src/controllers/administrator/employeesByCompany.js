import { connectDBPlanillero } from "../../config/connectDB.js";

const getEmployeesByCompany = async (req, res) => {
  const empresaId = req.params.empresa;
  const { usuario_id, fechaInicio, fechaFin } = req.query;

  try {
    let query = `
      SELECT 
        r.id AS registro_id,
        r.usuario_id,
        u.nombre AS usuario_nombre,
        u.apellido AS usuario_apellido,
        r.fecha,
        r.turno,
        r.hora_entrada,
        r.hora_salida,
        r.horas_normales,

        te.id AS tarea_extra_id,
        te.descripcion AS tarea_extra_descripcion,
        te.horas AS tarea_extra_horas,
        cj.job_number AS tarea_extra_job_number,
        cj.job_description AS tarea_extra_job_description,
        te.class_number AS tarea_extra_class,

        tr.descripcion_tarea AS tareas_registradas_json

      FROM registros_diarios r
      JOIN usuarios u ON u.id = r.usuario_id
      LEFT JOIN tareas_extras te ON te.registro_id = r.id
      LEFT JOIN company_jobs cj ON cj.id = te.job_id
      LEFT JOIN tareas_registradas tr ON tr.registro_id = r.id
      WHERE r.empresa_id = ?
    `;

    const values = [empresaId];

    const hasFilters = usuario_id || fechaInicio || fechaFin;

    if (usuario_id) {
      query += ` AND r.usuario_id = ?`;
      values.push(usuario_id);
    }

    if (fechaInicio && fechaFin) {
      query += ` AND r.fecha BETWEEN ? AND ?`;
      values.push(fechaInicio, fechaFin);
    } else if (fechaInicio) {
      query += ` AND r.fecha = ?`;
      values.push(fechaInicio);
    }

    query += ` ORDER BY r.fecha DESC`;

    // Solo limitar si no hay filtros aplicados
    if (!hasFilters) {
      query += ` LIMIT 5`;
    }

    const [rows] = await connectDBPlanillero.query(query, values);

    res.json(rows);
  } catch (error) {
    console.error("Error al obtener registros:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export { getEmployeesByCompany };
