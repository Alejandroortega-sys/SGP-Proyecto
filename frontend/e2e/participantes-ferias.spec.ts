import { expect, test } from "@playwright/test";
import {
  API_URL,
  CREDENCIALES,
  aprobarFeriaApi,
  cabecerasApi,
  campo,
  crearFeriaApi,
  iniciarSesion,
  iniciarSesionApi,
  obtenerOpcionesFeriaApi,
} from "./helpers";
import { eliminarFeriasPrueba } from "./limpieza-ferias";

const PREFIJO = "E2E Participantes";
const NOMBRE_FERIA = `${PREFIJO} Centro`;
const FECHA_INICIO = "2027-04-10";
const FECHA_FIN = "2027-04-12";
const PRIMER_VENDEDOR = "Doralice E2E";
const SEGUNDO_VENDEDOR = "Hernán E2E";

let feriaId = "";
let productoPermitido: { id: string; nombre: string };
let productoNoPermitido: { id: string; nombre: string };

function regexTexto(texto: string): RegExp {
  return new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

test.describe("Participantes de feria", () => {
  test.beforeAll(async ({ request }) => {
    await eliminarFeriasPrueba(CREDENCIALES.organizador.correo, PREFIJO);

    const tokenOrganizador = await iniciarSesionApi(
      request,
      CREDENCIALES.organizador.correo,
      CREDENCIALES.organizador.password,
    );
    const tokenGestor = await iniciarSesionApi(
      request,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
    );
    const opciones = await obtenerOpcionesFeriaApi(request, tokenOrganizador);
    const zona = opciones.zonas.find(
      (item) => item.nombre === "Centro - Calle 30",
    );
    if (!zona) throw new Error("No se encontró la zona Centro - Calle 30");

    const permitido = opciones.productos.find((item) =>
      zona.productosPermitidos.includes(item.nombre),
    );
    if (!permitido) throw new Error("La zona no tiene productos permitidos");
    productoPermitido = permitido;

    const noPermitido = opciones.productos.find(
      (item) => !zona.productosPermitidos.includes(item.nombre),
    );
    if (!noPermitido) {
      throw new Error("El catálogo no tiene un producto fuera de la zona");
    }
    productoNoPermitido = noPermitido;

    const feria = await crearFeriaApi(request, tokenOrganizador, {
      nombre: NOMBRE_FERIA,
      tipoFeria: "Feria agroecológica",
      zonaId: zona.id,
      fechaInicio: FECHA_INICIO,
      fechaFin: FECHA_FIN,
      numeroPuestos: 2,
      productoIds: [permitido.id],
    });
    feriaId = feria.id;
    await aprobarFeriaApi(request, tokenGestor, feriaId);
  });

  test.afterAll(async () => {
    await eliminarFeriasPrueba(CREDENCIALES.organizador.correo, PREFIJO);
  });

  test("gestiona participantes, valida cupo y productos, y envía el listado", async ({
    page,
    request,
  }) => {
    await iniciarSesion(
      page,
      CREDENCIALES.organizador.correo,
      CREDENCIALES.organizador.password,
      "/organizador/inicio",
    );
    await page.goto(`/organizador/ferias/${feriaId}/participantes`);
    await expect(
      page.getByRole("heading", { name: "Participantes de la feria" }),
    ).toBeVisible();
    await expect(page.getByText("0 de 2 participantes")).toBeVisible();

    await campo(page, "Nombre del vendedor").fill(PRIMER_VENDEDOR);
    await campo(page, "Documento (opcional)").fill("CC 90000001");
    await page
      .getByRole("checkbox", {
        name: regexTexto(productoPermitido.nombre),
      })
      .check();
    await page
      .getByRole("button", { name: "Agregar participante", exact: true })
      .click();
    await expect(
      page.getByText("Participante agregado correctamente."),
    ).toBeVisible();
    await expect(
      page.getByRole("listitem").filter({ hasText: PRIMER_VENDEDOR }),
    ).toBeVisible();

    await expect(
      page.getByRole("checkbox", {
        name: new RegExp(
          `${regexTexto(productoNoPermitido.nombre).source}\\s*\\(no permitido`,
        ),
      }),
    ).toBeDisabled();

    const tokenOrganizador = await iniciarSesionApi(
      request,
      CREDENCIALES.organizador.correo,
      CREDENCIALES.organizador.password,
    );
    const rechazoProducto = await request.post(
      `${API_URL}/ferias/${feriaId}/participantes`,
      {
        ...cabecerasApi(tokenOrganizador),
        data: {
          nombre: "Producto inválido E2E",
          productoIds: [productoNoPermitido.id],
        },
      },
    );
    expect(rechazoProducto.status()).toBe(400);

    await campo(page, "Nombre del vendedor").fill(SEGUNDO_VENDEDOR);
    await campo(page, "Documento (opcional)").fill("CC 90000002");
    await page
      .getByRole("checkbox", {
        name: regexTexto(productoPermitido.nombre),
      })
      .check();
    await page
      .getByRole("button", { name: "Agregar participante", exact: true })
      .click();
    await expect(
      page.getByRole("listitem").filter({ hasText: SEGUNDO_VENDEDOR }),
    ).toBeVisible();
    await expect(
      page.getByText("Se alcanzó el cupo aprobado de 2 participantes."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Agregar participante", exact: true }),
    ).toHaveCount(0);

    const rechazoCupo = await request.post(
      `${API_URL}/ferias/${feriaId}/participantes`,
      {
        ...cabecerasApi(tokenOrganizador),
        data: {
          nombre: "Tercer vendedor E2E",
          productoIds: [productoPermitido.id],
        },
      },
    );
    expect(rechazoCupo.status()).toBe(409);

    const filaPrimero = page
      .getByRole("listitem")
      .filter({ hasText: PRIMER_VENDEDOR });
    await filaPrimero.getByRole("button", { name: "Editar" }).click();
    const dialogoEdicion = page.getByRole("dialog");
    await expect(
      dialogoEdicion.getByRole("heading", { name: "Editar participante" }),
    ).toBeVisible();
    await dialogoEdicion
      .getByLabel(/^Nombre del vendedor/)
      .fill(`${PRIMER_VENDEDOR} Actualizada`);
    await dialogoEdicion
      .getByRole("button", { name: "Guardar cambios" })
      .click();
    await expect(
      page.getByText("Participante actualizado correctamente."),
    ).toBeVisible();
    await expect(
      page.getByText(`${PRIMER_VENDEDOR} Actualizada`),
    ).toBeVisible();

    const filaSegundo = page
      .getByRole("listitem")
      .filter({ hasText: SEGUNDO_VENDEDOR });
    await filaSegundo.getByRole("button", { name: "Retirar" }).click();
    await expect(
      page.getByRole("heading", { name: "Retirar participante" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Retirar participante", exact: true })
      .click();
    await expect(
      page.getByText("Participante retirado. El cupo volvió a estar disponible."),
    ).toBeVisible();
    await expect(
      page.getByRole("listitem").filter({ hasText: SEGUNDO_VENDEDOR }),
    ).toHaveCount(0);

    await page
      .getByRole("button", { name: "Enviar listado final", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Enviar listado final" }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Enviar listado final", exact: true })
      .click();
    await expect(
      page.getByText(
        "Listado final enviado correctamente. Ya no se puede modificar.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Listado final enviado", { exact: true }),
    ).toBeVisible();

    const rechazoEnviado = await request.post(
      `${API_URL}/ferias/${feriaId}/participantes`,
      {
        ...cabecerasApi(tokenOrganizador),
        data: {
          nombre: "Después del envío E2E",
          productoIds: [productoPermitido.id],
        },
      },
    );
    expect(rechazoEnviado.status()).toBe(409);

    await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
    await page.waitForURL("**/login");
    await iniciarSesion(
      page,
      CREDENCIALES.revisor.correo,
      CREDENCIALES.revisor.password,
      "/gestor/panel",
    );
    await page.goto(`/gestor/ferias/${feriaId}/participantes`);
    await expect(
      page.getByRole("heading", { name: "Listado final de participantes" }),
    ).toBeVisible();
    await expect(
      page.getByText("Fundación Agroecológica del Valle"),
    ).toBeVisible();
    await expect(page.getByText(`${PRIMER_VENDEDOR} Actualizada`)).toBeVisible();
    await expect(page.getByText("Frutas frescas").first()).toBeVisible();
  });

  test("la gestión de participantes se adapta a 360 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await iniciarSesion(
      page,
      CREDENCIALES.organizador.correo,
      CREDENCIALES.organizador.password,
      "/organizador/inicio",
    );
    await page.goto(`/organizador/ferias/${feriaId}/participantes`);
    await expect(
      page.getByRole("heading", { name: "Participantes de la feria" }),
    ).toBeVisible();
    const ancho = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(ancho).toBeLessThanOrEqual(361);
  });
});
