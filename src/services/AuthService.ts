import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { EmpleadoRepository } from '../repositories/EmpleadoRepository';
import { EmpleadoService } from "../services/EmpleadoService";
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

export class AuthService {
  static async register(
    nombre: string,
    apellido: string,
    correoElectronico: string,
    contrasena: string,
    departamentoId: number,
    rolId: number
  ) {
    // Verificar si ya existe alguien con ese correo
    const existing = await EmpleadoRepository.findByEmail(correoElectronico);
    if (existing) {
      throw new Error('Correo ya registrado');
    }

    // Hashear la contraseña
    const hash = await bcrypt.hash(contrasena, SALT_ROUNDS);

    const codigo = await EmpleadoService.generateCodigo();
    // Crear el empleado 
    const empleado = await EmpleadoRepository.createEmpleado({
      codigo,
      nombre,
      apellido,
      correoElectronico,
      contrasena: hash,
      departamentoId,
      rolId: rolId
    });

    return empleado;
  }

  static async login(correoElectronico: string, contrasena: string) {
    // Buscar empleado por correo
    const empleado = await EmpleadoRepository.findByEmail(correoElectronico);
    if (!empleado) {
      throw new Error('Usuario no encontrado');
    }

    // Validar que tenga contraseña configurada
    if (!empleado.contrasena) {
      throw new Error('El usuario no tiene contraseña configurada');
    }

    // Comparar contraseñas
    const valid = await bcrypt.compare(contrasena, empleado.contrasena);
    if (!valid) {
      throw new Error('Contraseña incorrecta');
    }

    // Validar que tenga correo configurado
    if (!empleado.correoElectronico) {
      throw new Error('El usuario no tiene correo configurado');
    }

    // Generar el token JWT
    const token = jwt.sign(
      {
        id: empleado.id,
        email: empleado.correoElectronico,
        name: empleado.nombre + empleado.apellido
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Devolver token y datos esenciales del empleado
    return {
      token,
      empleado: {
        id: empleado.id,
        nombre: empleado.nombre,
        apellido: empleado.apellido,
        correoElectronico: empleado.correoElectronico,
        departamentoId: empleado.departamentoId,
        rolId: empleado.rolId
      }
    };
  }
}
