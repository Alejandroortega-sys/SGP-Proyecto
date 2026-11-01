import { describe, expect, it } from "vitest";
import {
  agruparEspacios,
  proyectarMercator,
  type PuntoEspacio,
} from "./agrupar-espacios";

const PUNTOS: PuntoEspacio[] = [
  {
    id: "1",
    lat: 4.089,
    lng: -76.195,
    estado: "disponible",
    disponible: true,
  },
  {
    id: "2",
    lat: 4.0888,
    lng: -76.194,
    estado: "disponible",
    disponible: true,
  },
  {
    id: "3",
    lat: 4.0888,
    lng: -76.1905,
    estado: "bloqueado",
    disponible: false,
  },
  {
    id: "4",
    lat: 4.091,
    lng: -76.1875,
    estado: "mantenimiento",
    disponible: false,
  },
];

describe("agrupación de espacios por zoom", () => {
  it("proyecta coordenadas a píxeles Web Mercator", () => {
    const centro = proyectarMercator(0, 0, 1);
    expect(centro).toEqual({ x: 256, y: 256 });

    const tuluá = proyectarMercator(4.0847, -76.1954, 16);
    expect(tuluá.x).toBeGreaterThan(0);
    expect(tuluá.y).toBeGreaterThan(0);
  });

  it("agrupa todos los puntos cuando el zoom es muy bajo", () => {
    const grupos = agruparEspacios(PUNTOS, 11);

    expect(grupos).toHaveLength(1);
    expect(grupos[0].espacios).toHaveLength(4);
    expect(grupos[0].estados).toEqual({
      disponible: 2,
      bloqueado: 1,
      asignado: 0,
      mantenimiento: 1,
    });
  });

  it("separa los marcadores al acercar el mapa", () => {
    const zoomAlto = agruparEspacios(PUNTOS, 19);

    expect(zoomAlto).toHaveLength(4);
    expect(zoomAlto.every((grupo) => grupo.espacios.length === 1)).toBe(true);
  });

  it("agrupa puntos que caen en la misma celda", () => {
    const grupos = agruparEspacios(
      [
        PUNTOS[0],
        {
          ...PUNTOS[1],
          lat: PUNTOS[0].lat,
          lng: PUNTOS[0].lng,
        },
      ],
      16,
    );

    expect(grupos).toHaveLength(1);
    expect(grupos[0].espacios).toHaveLength(2);
  });

  it("mantiene identificadores estables y ordenados", () => {
    const primera = agruparEspacios(PUNTOS, 16);
    const segunda = agruparEspacios(PUNTOS, 16);

    expect(primera.map((grupo) => grupo.id)).toEqual(
      segunda.map((grupo) => grupo.id),
    );
    expect(primera.map((grupo) => grupo.id)).toEqual(
      [...primera.map((grupo) => grupo.id)].sort((a, b) =>
        a.localeCompare(b, "es"),
      ),
    );
  });

  it("ignora coordenadas no finitas", () => {
    const grupos = agruparEspacios(
      [
        ...PUNTOS,
        {
          id: "invalido",
          lat: Number.NaN,
          lng: -76.19,
          estado: "disponible",
          disponible: true,
        },
      ],
      16,
    );

    expect(
      grupos.flatMap((grupo) => grupo.espacios).some(
        (punto) => punto.id === "invalido",
      ),
    ).toBe(false);
  });
});
