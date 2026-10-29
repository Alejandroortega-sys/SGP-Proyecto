import { describe, expect, it } from "vitest";
import { esGestorAdministrador, nombreRol, rutaInicio } from "@/lib/rutas";

describe("rutas por rol", () => {
  it("redirige cada rol a su inicio", () => {
    expect(rutaInicio({ rol: "comerciante" })).toBe("/comerciante/inicio");
    expect(rutaInicio({ rol: "organizador" })).toBe("/organizador/inicio");
    expect(rutaInicio({ rol: "gestor" })).toBe("/gestor/panel");
  });

  it("identifica al gestor administrador", () => {
    expect(
      esGestorAdministrador({ rol: "gestor", perfil: "administrador" }),
    ).toBe(true);
    expect(esGestorAdministrador({ rol: "gestor", perfil: "revisor" })).toBe(
      false,
    );
    expect(
      esGestorAdministrador({ rol: "comerciante", perfil: null }),
    ).toBe(false);
    expect(esGestorAdministrador(null)).toBe(false);
  });

  it("traduce los roles", () => {
    expect(nombreRol("comerciante")).toBe("Comerciante");
    expect(nombreRol("organizador")).toBe("Organizador");
    expect(nombreRol("gestor")).toBe("Gestor municipal");
  });
});
