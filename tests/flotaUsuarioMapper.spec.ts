import { describe, it, expect } from "vitest";
import {
  mapEmpleadoToFlotaUsuario,
  type EmpleadoConEmpresa,
} from "../src/integrations/flotaUsuarioMapper";

function makeEmpleado(
  overrides: Partial<EmpleadoConEmpresa> = {}
): EmpleadoConEmpresa {
  return {
    id: 1,
    codigo: "EMP001",
    nombre: "Juan Carlos",
    apellido: "Pérez García",
    nombreUsuario: "jperez",
    correoElectronico: "Juan.Perez@Empresa.COM",
    contrasena: "$2b$10$abcdefghijklmnopqrstuv",
    departamentoId: 1,
    rolId: 1,
    activo: true,
    departamento: {
      id: 1,
      empresaId: 1,
      nombre: "RRHH",
      codigo: "DEP01",
      createdAt: null,
      updatedAt: null,
      deletedAt: null,
      empresa: { codigo: "EC01" },
    },
    ...overrides,
  } as EmpleadoConEmpresa;
}

describe("mapEmpleadoToFlotaUsuario", () => {
  it("mapea campos y trunca nombre/apellido/codigo", () => {
    const empleado = makeEmpleado({
      codigo: "EMP1234567890",
      nombre: "Nombre muy largo que excede veinticinco",
      apellido: "Apellido muy largo que excede veinticinco chars",
    });

    const result = mapEmpleadoToFlotaUsuario(empleado);

    expect(result).not.toBeNull();
    expect(result!.codigo_empleado).toHaveLength(10);
    expect(result!.nombre).toHaveLength(25);
    expect(result!.apellido).toHaveLength(25);
    expect(result!.codigo_empresa).toBe("EC01");
    expect(result!.correo_electronico).toBe("juan.perez@empresa.com");
    expect(result!.nombre_usuario).toBe("jperez");
    expect(result!.contrasena).toBe(empleado.contrasena);
  });

  it("retorna null si falta codigo", () => {
    expect(mapEmpleadoToFlotaUsuario(makeEmpleado({ codigo: null }))).toBeNull();
    expect(mapEmpleadoToFlotaUsuario(makeEmpleado({ codigo: "   " }))).toBeNull();
  });

  it("retorna null si falta contrasena", () => {
    expect(
      mapEmpleadoToFlotaUsuario(makeEmpleado({ contrasena: null }))
    ).toBeNull();
  });

  it("apellido null se envía como cadena vacía", () => {
    const result = mapEmpleadoToFlotaUsuario(
      makeEmpleado({ apellido: null })
    );
    expect(result!.apellido).toBe("");
  });

  it("codigo_empresa y correo null cuando no hay datos", () => {
    const result = mapEmpleadoToFlotaUsuario(
      makeEmpleado({
        correoElectronico: null,
        nombreUsuario: null,
        departamento: {
          ...makeEmpleado().departamento,
          empresa: { codigo: null },
        },
      })
    );
    expect(result!.codigo_empresa).toBeNull();
    expect(result!.correo_electronico).toBeNull();
    expect(result!.nombre_usuario).toBeNull();
  });
});
