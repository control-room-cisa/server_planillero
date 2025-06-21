import { connectDBPlanillero } from "../config/connectDB.js";

const savedateDay = async (req, res) => {
  const {
    usuario_id,
    empresa_id,
    fecha,
    fechaInicio,
    fechaFin,
    turno,
    horaEntrada,
    horaSalida,
    horasNormales,
    tareas,
    tareaExtra,
  } = req.body;

  try {
    // Verificar si ya existe el registro diario
    const [existe] = await connectDBPlanillero.query(
      `SELECT id FROM registros_diarios WHERE usuario_id = ? AND fecha = ?`,
      [usuario_id, fecha]
    );

    let registroId;

    if (existe.length > 0) {
      // Ya existe → actualizar registro principal
      registroId = existe[0].id;

      await connectDBPlanillero.query(
        `UPDATE registros_diarios SET
            empresa_id = ?,
            turno = ?,
            fecha_inicio = ?,
            fecha_fin = ?,
            hora_entrada = ?,
            hora_salida = ?,
            horas_normales = ?
          WHERE id = ?`,
        [
          empresa_id,
          turno,
          fechaInicio,
          fechaFin,
          horaEntrada,
          horaSalida,
          horasNormales,
          registroId,
        ]
      );

      // Actualizar tareas_registradas si ya existen
      const [tareaExistente] = await connectDBPlanillero.query(
        `SELECT id FROM tareas_registradas WHERE registro_id = ?`,
        [registroId]
      );

      if (tareaExistente.length > 0) {
        await connectDBPlanillero.query(
          `UPDATE tareas_registradas SET descripcion_tarea = ? WHERE registro_id = ?`,
          [JSON.stringify({ tareas }), registroId]
        );
      } else {
        await connectDBPlanillero.query(
          `INSERT INTO tareas_registradas (registro_id, descripcion_tarea) VALUES (?, ?)`,
          [registroId, JSON.stringify({ tareas })]
        );
      }

      // Actualizar tareaExtra si ya existe
      const [extraExistente] = await connectDBPlanillero.query(
        `SELECT id FROM tareas_extras WHERE registro_id = ?`,
        [registroId]
      );

      if (
        tareaExtra &&
        tareaExtra.descripcion &&
        tareaExtra.horas &&
        tareaExtra.job
      ) {
        if (extraExistente.length > 0) {
          await connectDBPlanillero.query(
            `UPDATE tareas_extras SET descripcion = ?, horas = ?, job_id = ?, class_number = ? WHERE registro_id = ?`,
            [
              tareaExtra.descripcion,
              tareaExtra.horas,
              tareaExtra.job,
              tareaExtra.classNumber || null,
              registroId,
            ]
          );
        } else {
          await connectDBPlanillero.query(
            `INSERT INTO tareas_extras (registro_id, descripcion, horas, job_id, class_number) VALUES (?, ?, ?, ?, ?)`,
            [
              registroId,
              tareaExtra.descripcion,
              tareaExtra.horas,
              tareaExtra.job,
              tareaExtra.classNumber || null,
            ]
          );
        }
      }

      res.status(200).json({
        success: true,
        message: "Registro actualizado correctamente.",
      });
    } else {
      // No existe → insertar nuevo
      const [registro] = await connectDBPlanillero.query(
        `INSERT INTO registros_diarios
          (usuario_id, empresa_id, fecha, turno, fecha_inicio, fecha_fin, hora_entrada, hora_salida, horas_normales)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          usuario_id,
          empresa_id,
          fecha,
          turno,
          fechaInicio,
          fechaFin,
          horaEntrada,
          horaSalida,
          horasNormales,
        ]
      );

      registroId = registro.insertId;

      // Insertar tareas
      await connectDBPlanillero.query(
        `INSERT INTO tareas_registradas (registro_id, descripcion_tarea) VALUES (?, ?)`,
        [registroId, JSON.stringify({ tareas })]
      );

      // Insertar tarea extra si existe
      if (
        tareaExtra &&
        tareaExtra.descripcion &&
        tareaExtra.horas &&
        tareaExtra.job
      ) {
        await connectDBPlanillero.query(
          `INSERT INTO tareas_extras (registro_id, descripcion, horas, job_id, class_number) VALUES (?, ?, ?, ?, ?)`,
          [
            registroId,
            tareaExtra.descripcion,
            tareaExtra.horas,
            tareaExtra.job,
            tareaExtra.classNumber || null,
          ]
        );
      }

      res.status(200).json({
        success: true,
        message: "Registro guardado correctamente.",
      });
    }
  } catch (error) {
    console.error("Error al guardar:", error);
    res.status(500).json({
      success: false,
      message: "Error al guardar o actualizar el registro.",
    });
  }
};

const getTaskDay = async (req, res) => {
  const { usuario_id, fecha } = req.params;
  console.log("data", usuario_id, fecha);

  try {
    const [result] = await connectDBPlanillero.query(
      `
            SELECT r.*, t.descripcion_tarea, e.descripcion AS extra_desc, e.horas AS extra_horas, e.job_id AS extra_job, e.class_number AS extra_class
            FROM registros_diarios r
            LEFT JOIN tareas_registradas t ON r.id = t.registro_id
            LEFT JOIN tareas_extras e ON r.id = e.registro_id
            WHERE r.usuario_id = ? AND r.fecha = ?
        `,
      [usuario_id, fecha]
    );

    console.log("result", result);

    if (result.length === 0)
      return res.status(404).json({ success: false, message: "No data found" });

    res.json({ success: true, data: result[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error retrieving data" });
  }
};

// const getDataAllByUser = async (req, res) => {
//   const { usuario_id } = req.params;

//   try {
//     const [result] = await connectDBPlanillero.query(
//       `
//         SELECT r.*, t.descripcion_tarea, e.descripcion AS extra_desc, e.horas AS extra_horas, e.job_id AS extra_job, e.class_number AS extra_class
//         FROM registros_diarios r
//         LEFT JOIN tareas_registradas t ON r.id = t.registro_id
//         LEFT JOIN tareas_extras e ON r.id = e.registro_id
//         WHERE r.usuario_id = ?
//         ORDER BY r.fecha DESC
//         LIMIT 1
//         `,
//       [usuario_id]
//     );

//     if (result.length === 0) {
//       return res.status(404).json({ success: false, message: "No data found" });
//     }

//     res.json({ success: true, data: result[0] });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: "Error retrieving data" });
//   }
// };

// const getDataAllByUser = async (req, res) => {
//   const { usuario_id } = req.params;
//   const offset = parseInt(req.query.offset, 10) || 0;

//   try {
//     // Obtener todos los registros del usuario
//     const [allRecords] = await connectDBPlanillero.query(
//       `SELECT r.id 
//        FROM registros_diarios r 
//        WHERE r.usuario_id = ? 
//        ORDER BY r.fecha DESC`,
//       [usuario_id]
//     );

//     const total = allRecords.length;

//     if (total === 0 || offset >= total) {
//       return res.status(404).json({ success: false, message: "No data found", total });
//     }

//     const registroId = allRecords[offset].id;

//     const [result] = await connectDBPlanillero.query(
//       `
//         SELECT r.*, 
//                t.descripcion_tarea, 
//                e.descripcion AS extra_desc, 
//                e.horas AS extra_horas, 
//                e.job_id AS extra_job, 
//                e.class_number AS extra_class,
//                cj.job_number AS extra_job_number,
//                cj.job_description AS extra_job_description
//         FROM registros_diarios r
//         LEFT JOIN tareas_registradas t ON r.id = t.registro_id
//         LEFT JOIN tareas_extras e ON r.id = e.registro_id
//         LEFT JOIN company_jobs cj ON e.job_id = cj.id
//         WHERE r.id = ?
//       `,
//       [registroId]
//     );

//     res.json({
//       success: true,
//       data: result[0],
//       total
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: "Error retrieving data" });
//   }
// };

// const getAllDataByUserFilter = async (req, res) => {
//   const { usuario_id } = req.params;
//   const { fechaInicio, fechaFin } = req.query;

//   try {
//     let query = `
//       SELECT r.*, 
//              t.descripcion_tarea, 
//              e.descripcion AS extra_desc, 
//              e.horas AS extra_horas, 
//              e.job_id AS extra_job, 
//              e.class_number AS extra_class,
//              cj.job_number AS extra_job_number,
//              cj.job_description AS extra_job_description
//       FROM registros_diarios r
//       LEFT JOIN tareas_registradas t ON r.id = t.registro_id
//       LEFT JOIN tareas_extras e ON r.id = e.registro_id
//       LEFT JOIN company_jobs cj ON e.job_id = cj.id
//       WHERE r.usuario_id = ?
//     `;

//     const params = [usuario_id];

//     if (fechaInicio && fechaFin) {
//       query += ` AND r.fecha BETWEEN ? AND ?`;
//       params.push(fechaInicio, fechaFin);
//     }

//     query += ` ORDER BY r.fecha DESC`;

//     const [result] = await connectDBPlanillero.query(query, params);

//     res.json({
//       success: true,
//       data: result
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, message: "Error retrieving data" });
//   }
// };

const getDataAllByUser = async (req, res) => {
  const { usuario_id } = req.params;
  const { fechaInicio, fechaFin } = req.query;

  try {
    let query = `
      SELECT r.*, 
             t.descripcion_tarea, 
             e.descripcion AS extra_desc, 
             e.horas AS extra_horas, 
             e.job_id AS extra_job, 
             e.class_number AS extra_class,
             cj.job_number AS extra_job_number,
             cj.job_description AS extra_job_description
      FROM registros_diarios r
      LEFT JOIN tareas_registradas t ON r.id = t.registro_id
      LEFT JOIN tareas_extras e ON r.id = e.registro_id
      LEFT JOIN company_jobs cj ON e.job_id = cj.id
      WHERE r.usuario_id = ?
    `;

    const params = [usuario_id];

    if (fechaInicio && fechaFin) {
      query += ` AND r.fecha BETWEEN ? AND ?`;
      params.push(fechaInicio, fechaFin);
    }

    query += ` ORDER BY r.fecha DESC`;

    const [result] = await connectDBPlanillero.query(query, params);

    if (!fechaInicio && !fechaFin) {
      // Si no hay filtros, devuelve solo el registro más reciente
      if (result.length > 0) {
        return res.json({ success: true, data: [result[0]] }); // devuelve como array
      } else {
        return res.json({ success: true, data: [] });
      }
    }

    // Si hay filtros, devuelve todos los registros en el rango
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error retrieving data" });
  }
};


export { 
  savedateDay, 
  getTaskDay, 
  getDataAllByUser,
};
