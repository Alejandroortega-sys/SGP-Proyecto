import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { basename } from 'node:path';
import type { GeoJsonPolygon } from '../common/geo';
import { parseIdBigint } from '../common/parse-id';
import type {
  categoria_comercio,
  tipo_zona,
} from '../generated/prisma/client';
import { calcularAdvertenciasZona } from '../modulos/advertencias';
import { ModulosService } from '../modulos/modulos.service';
import { PrismaService } from '../prisma/prisma.service';
import { ZonasService } from '../zonas/zonas.service';
import {
  type ConfirmacionFila,
  type EntradaPrevisualizacion,
  type FilaPrevisualizacion,
  type ImportadoConfirmado,
  type RechazadoConfirmado,
  type ResultadoConfirmacion,
  type ResumenPrevisualizacion,
  type TipoImportacion,
  AlmacenPrevisualizaciones,
} from './almacen-previsualizaciones';
import { leerCsvModulos, type DelimitadorCsv, type FilaCsv } from './csv';
import {
  ConfirmacionResponseDto,
  FilaPreviewDto,
  PrevisualizacionResponseDto,
  SridsResponseDto,
} from './dto/importaciones.dto';
import {
  ErrorFilaImportacion,
  ErrorFormatoImportacion,
  mensajeDeError,
} from './errores';
import {
  leerDocumentoGeoJson,
  normalizarPoligonoImportado,
  normalizarZonaImportada,
  SRIDS_COMUNES,
  validarRangoWgs84,
  type DocumentoGeoJson,
  type FeatureGeoJson,
  type ZonaImportada,
} from './geojson';
import { generarReporteCsv, type FilaReporte } from './reporte';

/** Límite de tamaño de un archivo de importación. */
export const MAX_BYTES_IMPORTACION = 10 * 1024 * 1024;

/** Archivo recibido por multipart, ya adaptado desde Multer. */
export interface ArchivoImportacion {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

interface FilaTransformada {
  fila: number;
  geometria: unknown;
  valida: boolean;
  motivo: string | null;
}

interface ProductoImportado {
  id: bigint | string;
  nombre: string;
  activo: boolean;
}

interface TitularImportado {
  documento: string;
  id: bigint | string;
}

interface FilaZonaPunto {
  fila: number;
  zona_id: bigint | string | null;
  zona_nombre: string | null;
  zona_tipo: tipo_zona | null;
  zona_horario_inicio: string | null;
  zona_horario_fin: string | null;
  zona_aforo_maximo: number | null;
  zona_productos: unknown;
}

const CATEGORIAS_VALIDAS: readonly categoria_comercio[] = [
  'formal',
  'informal',
];

/** Convierte un dato normalizado en texto seguro para un servicio. */
function textoDeDato(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

function motivoDeFila(error: unknown): string {
  if (error instanceof ErrorFilaImportacion) return error.message;
  return mensajeDeError(error);
}

function parsearNumeroCsv(
  valor: string,
  delimitador: DelimitadorCsv,
): number | null {
  const limpio = valor.trim().replace(/\s+/g, '');
  if (limpio === '') return null;

  let normalizado = limpio;
  if (delimitador === ';') {
    normalizado = limpio.includes('.')
      ? limpio.replaceAll('.', '').replace(',', '.')
      : limpio.replace(',', '.');
  }

  if (!/^-?\d+(?:\.\d+)?$/.test(normalizado)) return null;

  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Importación de zonas (GeoJSON) y módulos (CSV) para gestores municipales.
 *
 * La escritura final se delega a `ZonasService.crear` y `ModulosService.crear`
 * para reutilizar triggers, versionado, auditoría y validación de zona
 * restringida. La previsualización no escribe datos definitivos.
 */
@Injectable()
export class ImportacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zonas: ZonasService,
    private readonly modulos: ModulosService,
    private readonly almacen: AlmacenPrevisualizaciones,
  ) {}

  /** SRID comunes que existen realmente en la base de datos. */
  async srids(): Promise<SridsResponseDto> {
    const srids = SRIDS_COMUNES.map((opcion) => opcion.srid);
    const filas = await this.prisma.$queryRaw<{ srid: number }[]>`
      SELECT srid
        FROM spatial_ref_sys
       WHERE srid = ANY(${srids}::int[])
    `;
    const disponibles = new Set(filas.map((fila) => fila.srid));

    return {
      comunes: SRIDS_COMUNES.filter((opcion) =>
        disponibles.has(opcion.srid),
      ).map((opcion) => ({ srid: opcion.srid, etiqueta: opcion.etiqueta })),
      permiteOtro: true,
    };
  }

  /** Previsualiza un GeoJSON de zonas y deja el token listo para confirmar. */
  async previsualizarZonas(
    idGestor: string,
    archivo: ArchivoImportacion | undefined,
    sridSeleccionado?: number,
  ): Promise<PrevisualizacionResponseDto> {
    const actorId = parseIdBigint(idGestor);
    const validado = this.validarArchivo(archivo, 'zonas');

    let documento: DocumentoGeoJson;
    try {
      documento = leerDocumentoGeoJson(validado.buffer, sridSeleccionado);
    } catch (error) {
      throw this.aUnprocessable(error);
    }

    await this.validarSridDisponible(documento.sridOrigen);

    const filas: FilaPrevisualizacion[] = [];
    const preparadas: Array<{ fila: number; zona: ZonaImportada }> = [];

    documento.features.forEach((feature, indice) => {
      const numeroFila = indice + 1;
      const datos = this.datosZonaInicial(feature);

      try {
        const zona = normalizarZonaImportada(feature);
        preparadas.push({ fila: numeroFila, zona });
        filas.push({
          fila: numeroFila,
          estado: 'valida',
          datos: {
            nombre: zona.nombre,
            tipo: zona.tipo,
            horarioInicio: zona.horarioInicio,
            horarioFin: zona.horarioFin,
            aforoMaximo: zona.aforoMaximo,
            productosPermitidos: zona.productosPermitidos,
          },
          geometria: zona.geometria,
          errores: [],
          advertencias: [],
        });
      } catch (error) {
        filas.push({
          fila: numeroFila,
          estado: 'rechazada',
          datos,
          errores: [motivoDeFila(error)],
          advertencias: [],
        });
      }
    });

    const transformadas = await this.transformarPoligonos(
      preparadas.map(({ fila, zona }) => ({
        fila,
        geometria: zona.geometria,
      })),
      documento.sridOrigen,
    );

    for (const preparada of preparadas) {
      const fila = filas[preparada.fila - 1];
      if (!fila) continue;

      const transformada = transformadas.get(preparada.fila);
      if (!transformada) {
        fila.errores.push(
          'No fue posible reproyectar la geometría de esta feature.',
        );
        continue;
      }

      if (transformada.geometria) {
        fila.geometria = transformada.geometria;
      }
      if (transformada.error) {
        fila.errores.push(transformada.error);
      }
    }

    await this.resolverProductosZonas(preparadas, filas);
    await this.advertirNombresZonasRepetidos(preparadas, filas);

    const candidatas = preparadas
      .filter((preparada) => {
        const fila = filas[preparada.fila - 1];
        return (
          fila !== undefined &&
          fila.errores.length === 0 &&
          fila.geometria?.type === 'Polygon'
        );
      })
      .map((preparada) => ({
        fila: preparada.fila,
        geometria: filas[preparada.fila - 1]
          .geometria as GeoJsonPolygon,
      }));

    const { solapes, advertencia } =
      await this.detectarSolapesZonas(candidatas);

    for (const [filaNumero, motivos] of solapes) {
      const fila = filas[filaNumero - 1];
      if (!fila) continue;
      fila.errores.push(...motivos);
    }

    if (advertencia) {
      for (const fila of filas) {
        if (fila.errores.length === 0) {
          fila.advertencias.push(advertencia);
        }
      }
    }

    for (const fila of filas) {
      fila.estado =
        fila.errores.length > 0
          ? 'rechazada'
          : fila.advertencias.length > 0
            ? 'advertencia'
            : 'valida';
    }

    const entrada = this.almacen.crear({
      tipo: 'zonas',
      actorId,
      archivo: {
        nombre: basename(validado.originalname),
        bytes: validado.size,
      },
      sridOrigen: documento.sridOrigen,
      sridDetectado: documento.sridDetectado,
      filas,
      resumen: this.construirResumen(filas),
    });

    return this.aPrevisualizacion(entrada);
  }

  /** Previsualiza un CSV de módulos. */
  async previsualizarModulos(
    idGestor: string,
    archivo: ArchivoImportacion | undefined,
  ): Promise<PrevisualizacionResponseDto> {
    const actorId = parseIdBigint(idGestor);
    const validado = this.validarArchivo(archivo, 'modulos');

    let csv: ReturnType<typeof leerCsvModulos>;
    try {
      csv = leerCsvModulos(validado.buffer);
    } catch (error) {
      throw this.aUnprocessable(error);
    }

    const filas: FilaPrevisualizacion[] = csv.filas.map((fila) => {
      const { datos, errores } = this.normalizarFilaModulo(
        fila,
        csv.delimitador,
      );

      return {
        fila: fila.fila,
        estado: errores.length > 0 ? 'rechazada' : 'valida',
        datos,
        errores,
        advertencias: [],
      };
    });

    await this.resolverTitulares(filas);
    await this.asignarZonasModulos(filas);

    for (const fila of filas) {
      fila.estado =
        fila.errores.length > 0
          ? 'rechazada'
          : fila.advertencias.length > 0
            ? 'advertencia'
            : 'valida';
    }

    const entrada = this.almacen.crear({
      tipo: 'modulos',
      actorId,
      archivo: {
        nombre: basename(validado.originalname),
        bytes: validado.size,
      },
      sridOrigen: 4326,
      sridDetectado: false,
      filas,
      resumen: this.construirResumen(filas),
    });

    return this.aPrevisualizacion(entrada);
  }

  /** Confirma la importación de zonas. */
  async confirmarZonas(
    idGestor: string,
    token: string,
  ): Promise<ConfirmacionResponseDto> {
    const actorId = parseIdBigint(idGestor);
    const entrada = this.obtenerEntrada(token, actorId, 'zonas');
    return this.confirmarEntrada(entrada, () => this.procesarZonas(entrada));
  }

  /** Confirma la importación de módulos. */
  async confirmarModulos(
    idGestor: string,
    token: string,
    aceptaAdvertencia = false,
  ): Promise<ConfirmacionResponseDto> {
    const actorId = parseIdBigint(idGestor);
    const entrada = this.obtenerEntrada(token, actorId, 'modulos');
    return this.confirmarEntrada(entrada, () =>
      this.procesarModulos(entrada, aceptaAdvertencia),
    );
  }

  /** Genera el CSV de errores de una importación ya confirmada. */
  async reporte(
    idGestor: string,
    token: string,
  ): Promise<{ contenido: string; nombreArchivo: string }> {
    const actorId = parseIdBigint(idGestor);
    const entrada = this.obtenerEntrada(token, actorId);

    if (!entrada.resultado) {
      throw new ConflictException(
        'La importación aún no se ha confirmado. Confírmala antes de descargar el reporte.',
      );
    }

    const filas: FilaReporte[] = entrada.resultado.rechazados.map(
      (rechazado) => {
        const fila = entrada.filas.find(
          (candidata) => candidata.fila === rechazado.fila,
        );
        return {
          fila: rechazado.fila,
          motivo: rechazado.motivo,
          datos: fila?.datos ?? {},
        };
      },
    );

    const contenido = generarReporteCsv({
      tipo: entrada.tipo,
      archivo: entrada.archivo.nombre,
      fecha: new Date(),
      total: entrada.resultado.resumen.total,
      importados: entrada.resultado.resumen.importados,
      rechazados: entrada.resultado.resumen.rechazados,
      filas,
    });

    return {
      contenido,
      nombreArchivo: this.nombreReporte(entrada),
    };
  }

  private confirmarEntrada(
    entrada: EntradaPrevisualizacion,
    procesar: () => Promise<ResultadoConfirmacion>,
  ): Promise<ConfirmacionResponseDto> {
    if (entrada.resultado) {
      return Promise.resolve(this.aConfirmacion(entrada, entrada.resultado));
    }

    if (!entrada.promesa) {
      const promesa = procesar()
        .then((resultado) => {
          entrada.resultado = resultado;
          return resultado;
        })
        .finally(() => {
          entrada.promesa = undefined;
        });

      entrada.promesa = promesa;
    }

    return entrada.promesa.then((resultado) =>
      this.aConfirmacion(entrada, resultado),
    );
  }

  private async procesarZonas(
    entrada: EntradaPrevisualizacion,
  ): Promise<ResultadoConfirmacion> {
    const importados: ImportadoConfirmado[] = [];
    const rechazados: RechazadoConfirmado[] = [];

    for (const fila of entrada.filas) {
      if (fila.confirmacion) {
        this.acumularConfirmacion(fila, importados, rechazados);
        continue;
      }

      if (fila.errores.length > 0) {
        fila.confirmacion = {
          ok: false,
          motivo: fila.errores.join('; '),
        };
        this.acumularConfirmacion(fila, importados, rechazados);
        continue;
      }

      try {
        const datos = fila.datos;
        const geometria = fila.geometria;
        if (!geometria || geometria.type !== 'Polygon') {
          throw new ErrorFilaImportacion(
            'La zona no tiene un polígono válido para importar.',
          );
        }

        const zona = await this.zonas.crear(entrada.actorId.toString(), {
          nombre: textoDeDato(datos.nombre),
          tipo: datos.tipo as tipo_zona,
          geometria,
          horarioInicio:
            typeof datos.horarioInicio === 'string'
              ? datos.horarioInicio
              : null,
          horarioFin:
            typeof datos.horarioFin === 'string' ? datos.horarioFin : null,
          aforoMaximo:
            typeof datos.aforoMaximo === 'number'
              ? datos.aforoMaximo
              : null,
          productosPermitidos: fila.productosIds ?? [],
        });

        fila.confirmacion = {
          ok: true,
          id: zona.id,
          nombre: zona.nombre,
        };
      } catch (error) {
        fila.confirmacion = {
          ok: false,
          motivo: motivoDeFila(error),
        };
      }

      this.acumularConfirmacion(fila, importados, rechazados);
    }

    return this.construirResultado(entrada.filas, importados, rechazados);
  }

  private async procesarModulos(
    entrada: EntradaPrevisualizacion,
    aceptaAdvertencia: boolean,
  ): Promise<ResultadoConfirmacion> {
    const importados: ImportadoConfirmado[] = [];
    const rechazados: RechazadoConfirmado[] = [];

    for (const fila of entrada.filas) {
      if (fila.confirmacion) {
        this.acumularConfirmacion(fila, importados, rechazados);
        continue;
      }

      if (fila.errores.length > 0) {
        fila.confirmacion = {
          ok: false,
          motivo: fila.errores.join('; '),
        };
        this.acumularConfirmacion(fila, importados, rechazados);
        continue;
      }

      if (fila.requiereConfirmacion && !aceptaAdvertencia) {
        fila.confirmacion = {
          ok: false,
          motivo:
            'El punto está en una zona restringida y no se confirmó la advertencia.',
        };
        this.acumularConfirmacion(fila, importados, rechazados);
        continue;
      }

      try {
        const datos = fila.datos;
        const ubicacion = fila.geometria;
        if (!ubicacion || ubicacion.type !== 'Point') {
          throw new ErrorFilaImportacion(
            'El módulo no tiene un punto válido para importar.',
          );
        }

        const titularId =
          typeof datos.titularId === 'string' ? datos.titularId : undefined;
        const titularNombre =
          typeof datos.titular_nombre === 'string' &&
          datos.titular_nombre.trim() !== ''
            ? datos.titular_nombre
            : undefined;

        const modulo = await this.modulos.crear(
          entrada.actorId.toString(),
          {
            categoria: datos.categoria as categoria_comercio,
            actividad: textoDeDato(datos.actividad),
            ubicacion,
            ...(titularId !== undefined ? { titularId } : {}),
            ...(titularNombre !== undefined ? { titularNombre } : {}),
            ...(fila.requiereConfirmacion || aceptaAdvertencia
              ? { aceptaAdvertencia: true }
              : {}),
          },
        );

        fila.confirmacion = {
          ok: true,
          id: modulo.id,
          codigo: modulo.codigo,
          nombre: modulo.actividad,
        };
      } catch (error) {
        fila.confirmacion = {
          ok: false,
          motivo: motivoDeFila(error),
        };
      }

      this.acumularConfirmacion(fila, importados, rechazados);
    }

    return this.construirResultado(entrada.filas, importados, rechazados);
  }

  private acumularConfirmacion(
    fila: FilaPrevisualizacion,
    importados: ImportadoConfirmado[],
    rechazados: RechazadoConfirmado[],
  ): void {
    const confirmacion: ConfirmacionFila | undefined = fila.confirmacion;
    if (!confirmacion) return;

    if (confirmacion.ok) {
      importados.push({
        fila: fila.fila,
        id: confirmacion.id,
        codigo: confirmacion.codigo,
        nombre: confirmacion.nombre,
      });
    } else {
      rechazados.push({ fila: fila.fila, motivo: confirmacion.motivo });
    }
  }

  private construirResultado(
    filas: readonly FilaPrevisualizacion[],
    importados: ImportadoConfirmado[],
    rechazados: RechazadoConfirmado[],
  ): ResultadoConfirmacion {
    return {
      resumen: {
        total: filas.length,
        importados: importados.length,
        rechazados: rechazados.length,
        conAdvertencia: filas.filter(
          (fila) => fila.advertencias.length > 0 && fila.confirmacion?.ok,
        ).length,
      },
      importados,
      rechazados,
    };
  }

  private validarArchivo(
    archivo: ArchivoImportacion | undefined,
    tipo: TipoImportacion,
  ): ArchivoImportacion {
    if (!archivo || archivo.buffer.length === 0) {
      throw new BadRequestException(
        'Debes adjuntar un archivo en el campo «archivo».',
      );
    }

    const tamano = archivo.size || archivo.buffer.length;
    if (tamano > MAX_BYTES_IMPORTACION) {
      throw new PayloadTooLargeException(
        `El archivo supera el máximo de ${Math.floor(MAX_BYTES_IMPORTACION / (1024 * 1024))} MB.`,
      );
    }

    const nombre = basename(archivo.originalname ?? '').toLowerCase();
    const extensiones = tipo === 'zonas' ? ['.geojson', '.json'] : ['.csv'];
    if (!extensiones.some((extension) => nombre.endsWith(extension))) {
      throw new BadRequestException(
        tipo === 'zonas'
          ? 'El archivo de zonas debe ser .geojson o .json.'
          : 'El archivo de módulos debe ser .csv.',
      );
    }

    return archivo;
  }

  private aUnprocessable(error: unknown): UnprocessableEntityException {
    if (error instanceof ErrorFormatoImportacion) {
      return new UnprocessableEntityException(error.message);
    }
    return new UnprocessableEntityException(mensajeDeError(error));
  }

  private async validarSridDisponible(srid: number): Promise<void> {
    const filas = await this.prisma.$queryRaw<{ srid: number }[]>`
      SELECT srid FROM spatial_ref_sys WHERE srid = ${srid}
    `;
    if (!filas[0]) {
      throw new UnprocessableEntityException(
        `El SRID EPSG:${srid} no está disponible en la base de datos.`,
      );
    }
  }

  private datosZonaInicial(
    feature: FeatureGeoJson,
  ): Record<string, unknown> {
    const propiedades = feature.properties;
    const productos = propiedades.productosPermitidos;

    return {
      nombre: typeof propiedades.nombre === 'string' ? propiedades.nombre : null,
      tipo: typeof propiedades.tipo === 'string' ? propiedades.tipo : null,
      horarioInicio:
        typeof propiedades.horarioInicio === 'string'
          ? propiedades.horarioInicio
          : null,
      horarioFin:
        typeof propiedades.horarioFin === 'string'
          ? propiedades.horarioFin
          : null,
      aforoMaximo:
        typeof propiedades.aforoMaximo === 'number'
          ? propiedades.aforoMaximo
          : null,
      productosPermitidos: Array.isArray(productos)
        ? productos.filter((item): item is string => typeof item === 'string')
        : typeof productos === 'string'
          ? productos
              .split(';')
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
    };
  }

  private async transformarPoligonos(
    entradas: Array<{ fila: number; geometria: GeoJsonPolygon }>,
    srid: number,
  ): Promise<Map<number, { geometria?: GeoJsonPolygon; error?: string }>> {
    const resultados = new Map<
      number,
      { geometria?: GeoJsonPolygon; error?: string }
    >();
    if (entradas.length === 0) return resultados;

    const json = JSON.stringify(
      entradas.map((entrada) => ({
        fila: entrada.fila,
        geojson: entrada.geometria,
      })),
    );

    try {
      const filas = await this.prisma.$queryRaw<FilaTransformada[]>`
        WITH entradas AS (
          SELECT (elem->>'fila')::int AS fila,
                 ST_Transform(
                   ST_SetSRID(ST_GeomFromGeoJSON(elem->>'geojson'), ${srid}),
                   4326
                 ) AS geom
            FROM jsonb_array_elements(${json}::jsonb) elem
        )
        SELECT fila,
               ST_AsGeoJSON(geom, 9)::jsonb AS geometria,
               ST_IsValid(geom) AS valida,
               ST_IsValidReason(geom) AS motivo
          FROM entradas
      `;

      this.registrarTransformadas(resultados, filas);
      return resultados;
    } catch {
      // Una sola geometría problemática no debe ocultar el error de las demás.
      for (const entrada of entradas) {
        try {
          const filas = await this.prisma.$queryRaw<FilaTransformada[]>`
            SELECT ${entrada.fila}::int AS fila,
                   ST_AsGeoJSON(geom, 9)::jsonb AS geometria,
                   ST_IsValid(geom) AS valida,
                   ST_IsValidReason(geom) AS motivo
              FROM (
                SELECT ST_Transform(
                         ST_SetSRID(
                           ST_GeomFromGeoJSON(${JSON.stringify(entrada.geometria)}),
                           ${srid}
                         ),
                         4326
                       ) AS geom
              ) t
          `;
          this.registrarTransformadas(resultados, filas);
        } catch (error) {
          resultados.set(entrada.fila, {
            error: motivoDeFila(error),
          });
        }
      }

      return resultados;
    }
  }

  private registrarTransformadas(
    resultados: Map<number, { geometria?: GeoJsonPolygon; error?: string }>,
    filas: readonly FilaTransformada[],
  ): void {
    for (const fila of filas) {
      const geometria = this.aPoligono(fila.geometria);

      if (!fila.valida) {
        resultados.set(fila.fila, {
          geometria,
          error: `La geometría no es válida: ${fila.motivo ?? 'la topología se autointersecta'}.`,
        });
        continue;
      }

      if (!geometria) {
        resultados.set(fila.fila, {
          error: 'La geometría transformada no es un polígono válido.',
        });
        continue;
      }

      try {
        validarRangoWgs84(geometria);
        resultados.set(fila.fila, { geometria });
      } catch (error) {
        resultados.set(fila.fila, {
          geometria,
          error: motivoDeFila(error),
        });
      }
    }
  }

  private aPoligono(valor: unknown): GeoJsonPolygon | undefined {
    try {
      return normalizarPoligonoImportado(valor);
    } catch {
      return undefined;
    }
  }

  private async resolverProductosZonas(
    preparadas: Array<{ fila: number; zona: ZonaImportada }>,
    filas: FilaPrevisualizacion[],
  ): Promise<void> {
    const nombres = [
      ...new Set(
        preparadas.flatMap((preparada) => preparada.zona.productosPermitidos),
      ),
    ];
    if (nombres.length === 0) return;

    const productos = await this.prisma.$queryRaw<ProductoImportado[]>`
      SELECT id, nombre, activo
        FROM productos
       WHERE nombre = ANY(${nombres}::text[])
    `;
    const porNombre = new Map(
      productos.map((producto) => [producto.nombre, producto]),
    );

    for (const preparada of preparadas) {
      const fila = filas[preparada.fila - 1];
      if (!fila) continue;

      const ids: string[] = [];
      for (const nombre of preparada.zona.productosPermitidos) {
        const producto = porNombre.get(nombre);
        if (!producto) {
          fila.errores.push(
            `El producto «${nombre}» no existe en el catálogo.`,
          );
          continue;
        }
        if (!producto.activo) {
          fila.errores.push(
            `El producto «${nombre}» está inactivo y no puede asociarse a una zona.`,
          );
          continue;
        }
        ids.push(producto.id.toString());
      }
      fila.productosIds = ids;
    }
  }

  private async advertirNombresZonasRepetidos(
    preparadas: Array<{ fila: number; zona: ZonaImportada }>,
    filas: FilaPrevisualizacion[],
  ): Promise<void> {
    const nombres = [
      ...new Set(preparadas.map((preparada) => preparada.zona.nombre)),
    ];
    if (nombres.length === 0) return;

    const existentes = await this.prisma.$queryRaw<{ nombre: string }[]>`
      SELECT nombre FROM zonas WHERE nombre = ANY(${nombres}::text[])
    `;
    const repetidos = new Set(existentes.map((fila) => fila.nombre));

    for (const preparada of preparadas) {
      if (!repetidos.has(preparada.zona.nombre)) continue;
      const fila = filas[preparada.fila - 1];
      fila?.advertencias.push(
        `Ya existe una zona con el nombre «${preparada.zona.nombre}».`,
      );
    }
  }

  private async detectarSolapesZonas(
    candidatas: Array<{ fila: number; geometria: GeoJsonPolygon }>,
  ): Promise<{ solapes: Map<number, string[]>; advertencia: string | null }> {
    const solapes = new Map<number, string[]>();
    if (candidatas.length === 0) {
      return { solapes, advertencia: null };
    }

    const json = JSON.stringify(
      candidatas.map((candidata) => ({
        fila: candidata.fila,
        geojson: candidata.geometria,
      })),
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          CREATE TEMP TABLE import_zonas_preview (
            fila integer PRIMARY KEY,
            geom geometry(Polygon, 4326) NOT NULL
          ) ON COMMIT DROP
        `;
        await tx.$executeRaw`
          INSERT INTO import_zonas_preview (fila, geom)
          SELECT (elem->>'fila')::int,
                 ST_SetSRID(ST_GeomFromGeoJSON(elem->>'geojson'), 4326)
            FROM jsonb_array_elements(${json}::jsonb) elem
        `;
        await tx.$executeRaw`
          CREATE INDEX import_zonas_preview_geom
              ON import_zonas_preview USING gist (geom)
        `;

        const contraExistentes = await tx.$queryRaw<
          Array<{ fila: number; nombre: string }>
        >`
          SELECT c.fila, z.nombre
            FROM import_zonas_preview c
            JOIN zonas z
              ON z.activa
             AND ST_Relate(c.geom, z.geometria, '2********')
        `;

        const entreCandidatas = await tx.$queryRaw<
          Array<{ fila_a: number; fila_b: number }>
        >`
          SELECT a.fila AS fila_a, b.fila AS fila_b
            FROM import_zonas_preview a
            JOIN import_zonas_preview b
              ON a.fila < b.fila
             AND ST_Relate(a.geom, b.geom, '2********')
        `;

        for (const fila of contraExistentes) {
          this.agregarSolape(
            solapes,
            fila.fila,
            `Se solapa con la zona activa «${fila.nombre}».`,
          );
        }
        for (const fila of entreCandidatas) {
          this.agregarSolape(
            solapes,
            fila.fila_a,
            `Se solapa con la fila ${fila.fila_b} del mismo archivo.`,
          );
          this.agregarSolape(
            solapes,
            fila.fila_b,
            `Se solapa con la fila ${fila.fila_a} del mismo archivo.`,
          );
        }
      });

      return { solapes, advertencia: null };
    } catch {
      return {
        solapes: new Map(),
        advertencia:
          'No se pudieron verificar los solapes en la previsualización. La base de datos los validará al confirmar.',
      };
    }
  }

  private agregarSolape(
    solapes: Map<number, string[]>,
    fila: number,
    motivo: string,
  ): void {
    const actuales = solapes.get(fila) ?? [];
    actuales.push(motivo);
    solapes.set(fila, actuales);
  }

  private normalizarFilaModulo(
    fila: FilaCsv,
    delimitador: DelimitadorCsv,
  ): { datos: Record<string, unknown>; errores: string[] } {
    const categoria = (fila.valores.categoria ?? '').trim().toLowerCase();
    const actividad = (fila.valores.actividad ?? '').trim();
    const latitud = parsearNumeroCsv(
      fila.valores.latitud ?? '',
      delimitador,
    );
    const longitud = parsearNumeroCsv(
      fila.valores.longitud ?? '',
      delimitador,
    );
    const documento = (fila.valores.titular_documento ?? '').trim();
    const nombre = (fila.valores.titular_nombre ?? '').trim();

    const datos: Record<string, unknown> = {
      categoria,
      actividad,
      latitud,
      longitud,
      titular_documento: documento === '' ? null : documento,
      titular_nombre: nombre === '' ? null : nombre,
      titularId: null,
    };
    const errores: string[] = [];

    if (fila.camposSobrantes.length > 0) {
      errores.push('La fila tiene más columnas que el encabezado.');
    }

    if (!CATEGORIAS_VALIDAS.includes(categoria as categoria_comercio)) {
      errores.push('La categoría debe ser formal o informal.');
    }

    if (actividad.length < 1 || actividad.length > 200) {
      errores.push(
        'La actividad es obligatoria y debe tener entre 1 y 200 caracteres.',
      );
    }

    if (latitud === null || latitud < -90 || latitud > 90) {
      errores.push('La latitud debe ser un número entre -90 y 90.');
    }

    if (longitud === null || longitud < -180 || longitud > 180) {
      errores.push('La longitud debe ser un número entre -180 y 180.');
    }

    if ((documento === '') === (nombre === '')) {
      errores.push(
        'Debe indicar exactamente uno de titular_documento o titular_nombre.',
      );
    }

    return { datos, errores };
  }

  private async resolverTitulares(
    filas: FilaPrevisualizacion[],
  ): Promise<void> {
    const documentos = [
      ...new Set(
        filas
          .map((fila) =>
            typeof fila.datos.titular_documento === 'string'
              ? fila.datos.titular_documento
              : '',
          )
          .filter((documento) => documento !== ''),
      ),
    ];
    if (documentos.length === 0) return;

    const titulares = await this.prisma.$queryRaw<TitularImportado[]>`
      SELECT u.documento, c.usuario_id AS id
        FROM usuarios u
        JOIN comerciantes c ON c.usuario_id = u.id
       WHERE u.documento = ANY(${documentos}::text[])
    `;
    const porDocumento = new Map(
      titulares.map((titular) => [titular.documento, titular.id.toString()]),
    );

    for (const fila of filas) {
      const documento =
        typeof fila.datos.titular_documento === 'string'
          ? fila.datos.titular_documento
          : '';
      const nombre =
        typeof fila.datos.titular_nombre === 'string'
          ? fila.datos.titular_nombre
          : '';

      if (documento === '' || nombre !== '') continue;

      const id = porDocumento.get(documento);
      if (!id) {
        fila.errores.push(
          `No existe un comerciante registrado con el documento «${documento}».`,
        );
        continue;
      }
      fila.datos.titularId = id;
    }
  }

  private async asignarZonasModulos(
    filas: FilaPrevisualizacion[],
  ): Promise<void> {
    const puntos = filas
      .filter(
        (fila) =>
          typeof fila.datos.latitud === 'number' &&
          typeof fila.datos.longitud === 'number',
      )
      .map((fila) => ({
        fila: fila.fila,
        lat: fila.datos.latitud as number,
        lng: fila.datos.longitud as number,
      }));

    for (const punto of puntos) {
      const fila = filas.find((candidata) => candidata.fila === punto.fila);
      if (!fila) continue;
      fila.geometria = {
        type: 'Point',
        coordinates: [punto.lng, punto.lat],
      };
    }

    if (puntos.length === 0) return;

    const json = JSON.stringify(puntos);
    const zonas = await this.prisma.$queryRaw<FilaZonaPunto[]>`
      WITH puntos AS (
        SELECT (elem->>'fila')::int AS fila,
               ST_SetSRID(
                 ST_MakePoint(
                   (elem->>'lng')::float8,
                   (elem->>'lat')::float8
                 ),
                 4326
               ) AS geom
          FROM jsonb_array_elements(${json}::jsonb) elem
      )
      SELECT p.fila,
             z.id AS zona_id,
             z.nombre AS zona_nombre,
             z.tipo AS zona_tipo,
             to_char(z.horario_inicio, 'HH24:MI') AS zona_horario_inicio,
             to_char(z.horario_fin, 'HH24:MI') AS zona_horario_fin,
             z.aforo_maximo AS zona_aforo_maximo,
             COALESCE(
               (
                 SELECT jsonb_agg(producto.nombre ORDER BY producto.nombre)
                   FROM zona_productos zp
                   JOIN productos producto ON producto.id = zp.producto_id
                  WHERE zp.zona_id = z.id
                    AND producto.activo = true
               ),
               '[]'::jsonb
             ) AS zona_productos
        FROM puntos p
        LEFT JOIN LATERAL (
          SELECT zi.id, zi.nombre, zi.tipo,
                 zi.horario_inicio, zi.horario_fin, zi.aforo_maximo
            FROM zonas zi
           WHERE zi.activa
             AND ST_Contains(zi.geometria, p.geom)
           ORDER BY
             CASE zi.tipo
               WHEN 'permitida' THEN 1
               WHEN 'alta_congestion' THEN 2
               ELSE 3
             END,
             zi.id
           LIMIT 1
        ) z ON true
    `;

    for (const zona of zonas) {
      const fila = filas.find((candidata) => candidata.fila === zona.fila);
      if (!fila) continue;

      const contenedora =
        zona.zona_id === null ||
        zona.zona_nombre === null ||
        zona.zona_tipo === null
          ? null
          : {
              id: zona.zona_id.toString(),
              nombre: zona.zona_nombre,
              tipo: zona.zona_tipo,
            };

      fila.zonaContenedora = contenedora;

      const advertencias = calcularAdvertenciasZona(contenedora);
      fila.advertencias.push(
        ...advertencias.map((advertencia) => advertencia.mensaje),
      );
      fila.requiereConfirmacion = advertencias.some(
        (advertencia) => advertencia.requiereConfirmacion,
      );
    }
  }

  private construirResumen(
    filas: readonly FilaPrevisualizacion[],
  ): ResumenPrevisualizacion {
    return {
      total: filas.length,
      validas: filas.filter((fila) => fila.errores.length === 0).length,
      rechazadas: filas.filter((fila) => fila.errores.length > 0).length,
      advertencias: filas.filter((fila) => fila.advertencias.length > 0)
        .length,
    };
  }

  private aPrevisualizacion(
    entrada: EntradaPrevisualizacion,
  ): PrevisualizacionResponseDto {
    return {
      token: entrada.token,
      tipo: entrada.tipo,
      expiraEn: entrada.expiraEn,
      archivo: entrada.archivo,
      sridOrigen: entrada.sridOrigen,
      sridDetectado: entrada.sridDetectado,
      resumen: entrada.resumen,
      filas: entrada.filas.map((fila): FilaPreviewDto => ({
        fila: fila.fila,
        estado: fila.estado,
        datos: fila.datos,
        geometria: fila.geometria as unknown as
          | Record<string, unknown>
          | undefined,
        zonaContenedora: fila.zonaContenedora ?? null,
        errores: fila.errores,
        advertencias: fila.advertencias,
        requiereConfirmacion: fila.requiereConfirmacion === true,
      })),
    };
  }

  private aConfirmacion(
    entrada: EntradaPrevisualizacion,
    resultado: ResultadoConfirmacion,
  ): ConfirmacionResponseDto {
    return {
      token: entrada.token,
      tipo: entrada.tipo,
      resumen: resultado.resumen,
      importados: resultado.importados,
      rechazados: resultado.rechazados,
      reporte: {
        disponible: resultado.rechazados.length > 0,
        nombreArchivo: this.nombreReporte(entrada),
        url: `/importaciones/${entrada.token}/reporte`,
      },
    };
  }

  private nombreReporte(entrada: EntradaPrevisualizacion): string {
    return `reporte-importacion-${entrada.tipo}-${entrada.token.slice(0, 8)}.csv`;
  }

  private obtenerEntrada(
    token: string,
    actorId: bigint,
    tipo?: TipoImportacion,
  ): EntradaPrevisualizacion {
    const entrada = this.almacen.obtener(token);
    if (!entrada) {
      throw new GoneException(
        'La previsualización expiró o no existe. Vuelve a cargar el archivo.',
      );
    }

    if (entrada.actorId !== actorId) {
      throw new ForbiddenException(
        'La previsualización pertenece a otro gestor.',
      );
    }

    if (tipo !== undefined && entrada.tipo !== tipo) {
      throw new BadRequestException(
        'El token no corresponde al tipo de importación solicitado.',
      );
    }

    return entrada;
  }
}
