import { describe, expect, it } from "vitest";
import type { EstadoRequisitoDocumental } from "@/types/api";
import {
  CLASES_ESTADO_REQUISITO,
  DESCRIPCIONES_ESTADO_REQUISITO,
  ETIQUETAS_ESTADO_REQUISITO,
} from "./estado-requisito";

describe("estado de requisito documental", () => {
  const estados: EstadoRequisitoDocumental[] = [
    "faltante",
    "cargado",
    "cumple",
    "no_cumple",
  ];

  it("tiene etiqueta, descripción y estilo para cada estado", () => {
    for (const estado of estados) {
      expect(ETIQUETAS_ESTADO_REQUISITO[estado]).toBeTruthy();
      expect(DESCRIPCIONES_ESTADO_REQUISITO[estado]).toBeTruthy();
      expect(CLASES_ESTADO_REQUISITO[estado]).toContain("border-");
    }
  });

  it("usa los textos en español esperados", () => {
    expect(ETIQUETAS_ESTADO_REQUISITO.faltante).toBe("Faltante");
    expect(ETIQUETAS_ESTADO_REQUISITO.cumple).toBe("Cumple");
    expect(ETIQUETAS_ESTADO_REQUISITO.no_cumple).toBe("No cumple");
  });
});
