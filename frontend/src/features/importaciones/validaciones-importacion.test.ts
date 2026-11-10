import { describe, expect, it } from "vitest";
import type { FilaPreviewImportacion } from "@/types/api";
import {
  crearPlantillaCsvModulos,
  crearPlantillaGeoJsonZonas,
  formatearBytes,
  formatearDato,
  MAX_BYTES_IMPORTACION,
  resumenFilaImportacion,
  validarArchivoImportacion,
} from "./validaciones-importacion";

function archivo(nombre: string, size: number): File {
  return { name: nombre, size } as File;
}

const FILA_ZONA: FilaPreviewImportacion = {
  fila: 1,
  estado: "valida",
  datos: {
    nombre: "Zona nueva",
    tipo: "permitida",
    aforoMaximo: 20,
    productosPermitidos: ["Frutas frescas", "Verduras"],
  },
  errores: [],
  advertencias: [],
};

const FILA_MODULO: FilaPreviewImportacion = {
  fila: 2,
  estado: "advertencia",
  datos: {
    categoria: "informal",
    actividad: "Empanadas",
    latitud: 4.08,
    longitud: -76.19,
    titular_nombre: "Nelson",
  },
  zonaContenedora: {
    id: "3",
    nombre: "Entorno Hospital",
    tipo: "restringida",
  },
  errores: [],
  advertencias: ["Zona restringida"],
  requiereConfirmacion: true,
};

describe("validaciones de importación", () => {
  it("valida archivo ausente, vacío, extensión y tamaño", () => {
    expect(validarArchivoImportacion(null, "zonas")).toMatch(/Selecciona/);
    expect(validarArchivoImportacion(archivo("a.csv", 0), "modulos")).toMatch(
      /vacío/,
    );
    expect(
      validarArchivoImportacion(archivo("a.txt", 10), "zonas"),
    ).toMatch(/geojson/i);
    expect(
      validarArchivoImportacion(
        archivo("a.csv", MAX_BYTES_IMPORTACION + 1),
        "modulos",
      ),
    ).toMatch(/máximo/);
    expect(
      validarArchivoImportacion(archivo("a.csv", 10), "modulos"),
    ).toBeNull();
  });

  it("formatea bytes y datos heterogéneos", () => {
    expect(formatearBytes(500)).toBe("500 B");
    expect(formatearBytes(2048)).toBe("2.0 KB");
    expect(formatearBytes(2 * 1024 * 1024)).toBe("2.0 MB");
    expect(formatearDato(null)).toBe("—");
    expect(formatearDato(["a", "b"])).toBe("a, b");
    expect(formatearDato({ a: 1 })).toBe('{"a":1}');
  });

  it("resume una fila de zona y una de módulo", () => {
    expect(resumenFilaImportacion(FILA_ZONA, "zonas")).toEqual({
      titulo: "Zona nueva",
      detalle: "Tipo: permitida · Aforo: 20 · Productos: Frutas frescas, Verduras",
    });

    const modulo = resumenFilaImportacion(FILA_MODULO, "modulos");
    expect(modulo.titulo).toBe("Empanadas");
    expect(modulo.detalle).toContain("Titular: Nelson");
    expect(modulo.detalle).toContain("Zona: Entorno Hospital");
  });

  it("genera plantillas con BOM y encabezados", () => {
    const csv = crearPlantillaCsvModulos();
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(
      "categoria,actividad,latitud,longitud,titular_documento,titular_nombre",
    );

    const geojson = JSON.parse(crearPlantillaGeoJsonZonas()) as {
      type: string;
      features: unknown[];
    };
    expect(geojson.type).toBe("FeatureCollection");
    expect(geojson.features).toHaveLength(1);
  });
});
