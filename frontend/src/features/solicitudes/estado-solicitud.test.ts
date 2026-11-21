import { describe, expect, it } from "vitest";
import {
  ETIQUETAS_ESTADO_SOLICITUD,
  estadoEsFinal,
  esEstadoSolicitud,
} from "./estado-solicitud";

describe("estados de solicitud", () => {
  it("etiqueta los estados en español", () => {
    expect(ETIQUETAS_ESTADO_SOLICITUD.radicada).toBe("Radicada");
    expect(ETIQUETAS_ESTADO_SOLICITUD.devuelta).toBe("Requiere corrección");
    expect(ETIQUETAS_ESTADO_SOLICITUD.aprobada).toBe("Aprobada");
  });

  it("reconoce estados válidos", () => {
    expect(esEstadoSolicitud("radicada")).toBe(true);
    expect(esEstadoSolicitud("otro")).toBe(false);
    expect(esEstadoSolicitud(null)).toBe(false);
  });

  it("marca los estados finales", () => {
    expect(estadoEsFinal("aprobada")).toBe(true);
    expect(estadoEsFinal("rechazada")).toBe(true);
    expect(estadoEsFinal("cancelada")).toBe(true);
    expect(estadoEsFinal("radicada")).toBe(false);
  });
});
