import { describe, expect, it } from "vitest";
import type { ZonaFeature } from "@/types/api";
import {
  aGeoJsonPoligono,
  areaAproximadaM2,
  areaPoligono,
  buscarSolape,
  esAutointersectado,
  poligonosDesdeZonas,
  poligonosIguales,
  poligonosSeSolapan,
  validarGeometriaZona,
  type Punto,
} from "./geometria-zona";

const CUADRADO: Punto[] = [
  [-76.202, 4.08],
  [-76.198, 4.08],
  [-76.198, 4.083],
  [-76.202, 4.083],
];

const CUADRADO_VECINO: Punto[] = [
  [-76.198, 4.08],
  [-76.194, 4.08],
  [-76.194, 4.083],
  [-76.198, 4.083],
];

const CUADRADO_SOLAPADO: Punto[] = [
  [-76.2, 4.081],
  [-76.196, 4.081],
  [-76.196, 4.084],
  [-76.2, 4.084],
];

const CUADRADO_CONTENIDO: Punto[] = [
  [-76.201, 4.081],
  [-76.199, 4.081],
  [-76.199, 4.082],
  [-76.201, 4.082],
];

const BOWTIE: Punto[] = [
  [-76.202, 4.08],
  [-76.198, 4.083],
  [-76.202, 4.083],
  [-76.198, 4.08],
];

function feature(
  id: string,
  nombre: string,
  puntos: Punto[],
): ZonaFeature {
  return {
    type: "Feature",
    geometry: aGeoJsonPoligono(puntos),
    properties: {
      id,
      nombre,
      tipo: "permitida",
      horarios: { inicio: null, fin: null },
      aforo: null,
      productos: [],
    },
  };
}

describe("geometría de zonas", () => {
  it("cierra el anillo GeoJSON y conserva el orden longitud-latitud", () => {
    const poligono = aGeoJsonPoligono(CUADRADO);

    expect(poligono.type).toBe("Polygon");
    expect(poligono.coordinates[0]).toHaveLength(5);
    expect(poligono.coordinates[0][0]).toEqual([-76.202, 4.08]);
    expect(poligono.coordinates[0][4]).toEqual(poligono.coordinates[0][0]);
  });

  it("aproxima el área en metros cuadrados para Tuluá", () => {
    const area = areaAproximadaM2(CUADRADO);
    expect(area).toBeGreaterThan(130_000);
    expect(area).toBeLessThan(165_000);
  });

  it("calcula el área de un polígono simple", () => {
    expect(areaPoligono(CUADRADO)).toBeGreaterThan(0);
    expect(areaPoligono([CUADRADO[0], CUADRADO[1]])).toBe(0);
  });

  it("detecta una geometría autointersectada", () => {
    expect(esAutointersectado(BOWTIE)).toBe(true);
    expect(esAutointersectado(CUADRADO)).toBe(false);
  });

  it("detecta vértices repetidos", () => {
    const repetido: Punto[] = [
      [-76.202, 4.08],
      [-76.198, 4.08],
      [-76.198, 4.083],
      [-76.198, 4.08],
    ];

    expect(esAutointersectado(repetido)).toBe(true);
  });

  it("detecta solapes por cruce y por contención", () => {
    expect(poligonosSeSolapan(CUADRADO, CUADRADO_SOLAPADO)).toBe(true);
    expect(poligonosSeSolapan(CUADRADO, CUADRADO_CONTENIDO)).toBe(true);
  });

  it("permite bordes compartidos entre zonas adyacentes", () => {
    expect(poligonosSeSolapan(CUADRADO, CUADRADO_VECINO)).toBe(false);
  });

  it("detecta solapes parciales que comparten parte de un borde", () => {
    const parcial: Punto[] = [
      [-76.2, 4.08],
      [-76.196, 4.08],
      [-76.196, 4.083],
      [-76.2, 4.083],
    ];

    expect(poligonosSeSolapan(CUADRADO, parcial)).toBe(true);
  });

  it("busca la zona activa en conflicto y devuelve su nombre", () => {
    const zonas = [
      {
        id: "1",
        nombre: "Centro - Calle 30",
        tipo: "permitida" as const,
        anillos: [CUADRADO],
      },
    ];

    expect(buscarSolape(CUADRADO_SOLAPADO, zonas)).toEqual({
      zonaId: "1",
      zonaNombre: "Centro - Calle 30",
    });
    expect(buscarSolape(CUADRADO, zonas)).toBeNull();
  });

  it("valida mínimo de vértices, autointersección y solape", () => {
    const zonas = [
      {
        id: "1",
        nombre: "Centro - Calle 30",
        tipo: "permitida" as const,
        anillos: [CUADRADO],
      },
    ];

    expect(validarGeometriaZona(CUADRADO.slice(0, 2), zonas).valido).toBe(
      false,
    );
    expect(validarGeometriaZona(BOWTIE, zonas).valido).toBe(false);
    expect(validarGeometriaZona(BOWTIE, zonas).errores[0]).toContain(
      "cruza a sí mismo",
    );
    expect(
      validarGeometriaZona(CUADRADO_SOLAPADO, zonas).errores[0],
    ).toContain("Centro - Calle 30");
    expect(validarGeometriaZona(CUADRADO, zonas).valido).toBe(true);
  });

  it("convierte los features activos y excluye la zona editada", () => {
    const zonas = poligonosDesdeZonas(
      [
        feature("1", "Centro", CUADRADO),
        feature("2", "Plaza", CUADRADO_VECINO),
      ],
      "1",
    );

    expect(zonas).toHaveLength(1);
    expect(zonas[0].id).toBe("2");
  });

  it("compara polígonos ignorando el punto de cierre", () => {
    const geometria = aGeoJsonPoligono(CUADRADO);

    expect(poligonosIguales(CUADRADO, geometria)).toBe(true);
    expect(
      poligonosIguales(
        [...CUADRADO, CUADRADO[0]],
        geometria,
      ),
    ).toBe(true);
    expect(poligonosIguales(CUADRADO_SOLAPADO, geometria)).toBe(false);
  });
});
