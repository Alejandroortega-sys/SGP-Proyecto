import { describe, expect, it } from "vitest";
import {
  borradorTieneDatos,
  normalizarBorrador,
} from "@/lib/borrador-solicitud";

describe("borrador local de solicitud", () => {
  it("normaliza un borrador completo", () => {
    const borrador = normalizarBorrador({
      espacioId: "1",
      actividad: "Artesanías",
      productoIds: ["1", 2, "3"],
      fechaInicio: "2027-02-10",
      fechaFin: "2027-02-12",
      horaInicio: "09:00",
      horaFin: "12:00",
      paso: 4,
      actualizadoEn: "2026-11-20T10:00:00.000Z",
    });

    expect(borrador).toEqual({
      espacioId: "1",
      actividad: "Artesanías",
      productoIds: ["1", "3"],
      fechaInicio: "2027-02-10",
      fechaFin: "2027-02-12",
      horaInicio: "09:00",
      horaFin: "12:00",
      paso: 4,
      actualizadoEn: "2026-11-20T10:00:00.000Z",
    });
  });

  it("descarta un borrador vacío o inválido", () => {
    expect(normalizarBorrador(null)).toBeNull();
    expect(normalizarBorrador({})).toBeNull();
    expect(normalizarBorrador({ paso: 3 })).toBeNull();
  });

  it("limita el paso al rango del formulario", () => {
    expect(
      normalizarBorrador({ actividad: "Artesanías", paso: 99 })?.paso,
    ).toBe(5);
    expect(
      normalizarBorrador({ actividad: "Artesanías", paso: -2 })?.paso,
    ).toBe(1);
  });

  it("indica si tiene datos relevantes", () => {
    expect(borradorTieneDatos(null)).toBe(false);
    expect(
      borradorTieneDatos(
        normalizarBorrador({ actividad: "Artesanías", paso: 2 }),
      ),
    ).toBe(true);
  });
});
