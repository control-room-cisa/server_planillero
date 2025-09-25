import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { EmpleadoRepository } from "../repositories/EmpleadoRepository";
import { EmpleadoService } from "../services/EmpleadoService";
import { CreateEmpleadoDto } from "../dtos/employee.dto";
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

export class AuthService {
  static async register(
    nombre: string,
    apellido: string | null,
    correoElectronico: string,
    contrasena: string,
    departamentoId: number,
    rolId: number
  ) {
    // 1) Verificar si ya existe
    //const existing = await EmpleadoService.getByEmail(correoElectronico);
    // if (existing) {
    //   throw new Error("Correo ya registrado");
    // }

    // 2) Hashear contraseña
    const hash = await bcrypt.hash(contrasena, SALT_ROUNDS);

    // 3) Generar código
    const codigo = await EmpleadoService.generateCodigo();

    // 4) Crear DTO para el servicio
    const dto: CreateEmpleadoDto = {
      codigo,
      nombre,
      apellido: apellido ?? undefined,
      correoElectronico,
      contrasena: hash,
      departamentoId,
      rolId,
      activo: true, // campo obligatorio en el DTO
      // el resto de campos opcionales puedes omitirlos aquí
    };

    // 5) Delegar al servicio (ahí ocurre el connect de departamento y rol)
    const empleado = await EmpleadoService.createEmpleado(dto);

    // 6) (Opcional) Generar token o devolver el empleado
    const token = jwt.sign({ sub: empleado.id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    return { empleado, token };
  }

  static async login(identifier: string, contrasena: string) {
    // Buscar empleado por correo electrónico, DNI o nombre de usuario
    const empleado = await EmpleadoRepository.findByEmailDniOrUsername(
      identifier
    );
    if (!empleado) {
      throw new Error("Usuario no encontrado");
    }

    // Validar que tenga contraseña configurada
    if (!empleado.contrasena) {
      throw new Error("El usuario no tiene contraseña configurada");
    }

    // Comparar contraseñas
    const valid = await bcrypt.compare(contrasena, empleado.contrasena);
    if (!valid) {
      throw new Error("Contraseña incorrecta");
    }

    // Validar que tenga correo configurado
    if (!empleado.correoElectronico) {
      throw new Error("El usuario no tiene correo configurado");
    }

    // Generar el token JWT
    const token = jwt.sign(
      {
        id: empleado.id,
        email: empleado.correoElectronico,
        name: empleado.nombre + empleado.apellido,
      },
      JWT_SECRET,
      { expiresIn: "1d" }
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
        rolId: empleado.rolId,
        tipoHorario: empleado.tipoHorario,
      },
    };
  }
}
