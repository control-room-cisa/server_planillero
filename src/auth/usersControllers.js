import { connectDBPlanillero } from "../config/connectDB.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "secretpl";

const registerUser = async (req, res) => {
  const {
    empresa_id,
    nombre,
    apellido,
    correo_electronico,
    password,
    rol_id,
    diasLaborales = [],
  } = req.body;

  try {
    
    const requiredFields = [
      "empresa_id",
      "nombre",
      "apellido",
      "correo_electronico",
      "password",
    ];
    const missingFields = requiredFields.filter((field) => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Faltan campos requeridos: ${missingFields.join(", ")}`,
      });
    }

    // Verificar si el correo ya está registrado
    const [existingUser] = await connectDBPlanillero.query(
      `SELECT id FROM usuarios WHERE correo_electronico = ?`,
      [correo_electronico]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({
        error: "El correo electrónico ya está registrado. Por favor, usa otro.",
      });
    }

    // Encriptar contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insertar usuario
    const [result] = await connectDBPlanillero.query(
      `INSERT INTO usuarios 
      (empresa_id, nombre, apellido, correo_electronico, rol_id, password) 
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        empresa_id,
        nombre,
        apellido,
        correo_electronico,
        rol_id || 2,
        hashedPassword,
      ]
    );

    const userId = result.insertId;

    // Insertar días laborales
    const diasSemana = [
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábado",
      "domingo",
    ];
    const insertDias = diasSemana.map((dia) => [
      userId,
      dia,
      diasLaborales.includes(dia.charAt(0).toUpperCase() + dia.slice(1)), // Comparar con mayúscula inicial
    ]);

    await connectDBPlanillero.query(
      `INSERT INTO horarios_empleados (empleado_id, dia_semana, trabaja) VALUES ?`,
      [insertDias]
    );

    res.status(201).json({
      success: true,
      message: "Usuario registrado exitosamente",
      userId,
      timestamps: {
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  } catch (error) {
    console.error("Error en registro:", error);
    res.status(500).json({
      error: "Error interno del servidor al registrar usuario",
    });
  }
};

const loginUser = async (req, res) => {
  const { correo_electronico, password } = req.body;
  console.log(req.body);

  try {
    if (!correo_electronico || !password) {
      return res.status(400).json({
        error: "Correo electrónico y contraseña son requeridos",
      });
    }

    // Consulta con JOIN para obtener nombre de empresa y rol
    const [rows] = await connectDBPlanillero.query(
      `SELECT 
         u.*, 
         e.nombre AS nombre_empresa,
         r.rol AS nombre_rol
       FROM usuarios u
       LEFT JOIN empresas e ON u.empresa_id = e.id
       LEFT JOIN roles r ON u.rol_id = r.id
       WHERE u.correo_electronico = ?`,
      [correo_electronico]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        error: "Credenciales inválidas",
      });
    }

    const user = rows[0];

    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        error: "Credenciales inválidas",
      });
    }

    // Crear token
    const token = jwt.sign(
      {
        id: user.id,
        correo_electronico: user.correo_electronico,
        rol_id: user.rol_id,
        rol: user.nombre_rol,
        empresa_id: user.empresa_id,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Respuesta
    res.status(200).json({
      success: true,
      message: "Inicio de sesión exitoso",
      token,
      user: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        correo_electronico: user.correo_electronico,
        rol_id: user.rol_id,
        rol: user.nombre_rol,
        empresa_id: user.empresa_id,
        nombre_empresa: user.nombre_empresa,
      },
    });
  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({
      error: "Error interno del servidor al iniciar sesión",
    });
  }
};

export { registerUser, loginUser };
