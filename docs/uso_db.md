# Uso de la base de datos con Prisma — Guía práctica

**Stack:** Prisma 7.10 (driver adapter `@prisma/adapter-pg`) · PostgreSQL 18 + PostGIS 3.6 · NestJS 12
**Base de datos:** `sgp_tulua` (definida en `.env` → `DATABASE_URL`)

Este documento explica cómo gestionar las peticiones a la base de datos **sin provocar errores**, con foco en los dos puntos delicados del modelo: los campos **BigInt** y los campos **geometry** de PostGIS.

---

## 1. Patrón básico de uso

`PrismaService` está registrado en un módulo **global** (`src/prisma/prisma.module.ts`), así que se inyecta en cualquier servicio sin importar módulos:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.usuarios.findMany({
      select: { id: true, nombre: true, correo: true, rol: true },
      orderBy: { id: 'asc' },
    });
  }
}
```

- El cliente de Prisma está generado en `src/generated/prisma` (`pnpm install` lo regenera automáticamente vía `postinstall`).
- Los tipos y enums se importan de `src/generated/prisma/client` o de `src/generated/prisma/models/*`.
- Los errores de base de datos **no se capturan manualmente**: el filtro global (sección 4) los traduce a respuestas HTTP.

---

## 2. BigInt — cómo gestionarlo para que `JSON.stringify` no explote

### 2.1 Por qué falla

**Todas las llaves primarias y foráneas del modelo son `BIGINT`** (`usuarios.id`, `zonas.id`, etc.). Prisma las devuelve como `bigint` nativo de JavaScript, y `res.json()` usa `JSON.stringify`, que lanza:

```
TypeError: Do not know how to serialize a BigInt
```

### 2.2 Solución global (ya aplicada)

`src/common/bigint-serialization.ts` parchea `BigInt.prototype.toJSON` para que todo `bigint` se serialice como **string**. Se aplica importándolo en `src/main.ts`:

```ts
import './common/bigint-serialization';
```

**Resultado:** los IDs llegan al frontend como `"1"`, `"1050"`, etc.

```json
{ "id": "1", "nombre": "Laura", "rol": "gestor" }
```

> **Importante para el frontend:** comparar IDs como strings (`id === "1"`). Es la forma segura de preservar la precisión de 64 bits (un `Number` de JS pierde precisión por encima de 2^53).

### 2.3 Recibir IDs desde HTTP

Los params/query de HTTP llegan como `string`; Prisma exige `bigint` para los campos `BigInt`. Conviértelos **antes** de consultar:

```ts
@Get(':id')
async findOne(@Param('id') id: string) {
  return this.prisma.usuarios.findUniqueOrThrow({
    where: { id: BigInt(id) }, // string → bigint
  });
}
```

Si el string no es un número válido, `BigInt(id)` lanza `SyntaxError` — responde 400 validando antes:

```ts
function parseId(id: string): bigint {
  if (!/^\d+$/.test(id)) {
    throw new BadRequestException(`El identificador "${id}" no es válido`);
  }
  return BigInt(id);
}
```

### 2.4 BigInt en queries crudos (`$queryRaw`)

El driver `pg` devuelve `BIGINT` como **string** (a diferencia del cliente Prisma, que devuelve `bigint`). Dos opciones:

- **Recomendado:** castear a texto en el SELECT para que la fila ya venga lista para la respuesta:

```sql
SELECT id::text AS id, nombre FROM zonas;
```

- Tipar la fila sabiendo que `id` llega como string:

```ts
interface ZonaRow {
  id: string;   // BIGINT crudo → string
  nombre: string;
}
const zonas = await this.prisma.$queryRaw<ZonaRow[]>`SELECT id, nombre FROM zonas`;
```

> Si la misma query cruda alimenta a `BigInt(...)` en código (p. ej. para otra consulta Prisma), recuerda que ya viene como string — no necesita conversión adicional.

---

## 3. Geometry (PostGIS) — se trabaja FUERA del cliente de Prisma

### 3.1 Campos afectados

Estos campos son `Unsupported("geometry")` en el schema: **el cliente de Prisma no puede leerlos ni escribirlos**. En los resultados del cliente se omiten silenciosamente, y no existen en los tipos de `create`/`update`.

| Modelo | Campo | Contenido |
|---|---|---|
| `zonas` | `geometria` | Polígono (SRID 4326) |
| `modulos` | `ubicacion` | Punto |
| `espacios_temporales` | `ubicacion` | Punto |
| `evaluaciones_factibilidad` | `ubicacion` | Punto |
| `solicitudes` | `ubicacion_solicitada` | Punto (nullable) |
| `permisos` | `ubicacion` | Punto (nullable) |

**Regla:** para cualquier operación que involucre estos campos se usa `$queryRaw` / `$executeRaw` con las funciones de PostGIS. Todo lo demás (atributos normales, relaciones, paginación) puede seguir usando el cliente Prisma.

### 3.2 Leer geometrías (SELECT + `ST_AsGeoJSON`)

```ts
interface ZonaConGeometria {
  id: string;              // id::text → string (ver sección 2.4)
  nombre: string;
  tipo: 'permitida' | 'restringida' | 'alta_congestion';
  geometria: GeoJSON.Geometry; // objeto GeoJSON listo para el frontend/mapa
}

async listarZonas(): Promise<ZonaConGeometria[]> {
  return this.prisma.$queryRaw<ZonaConGeometria[]>`
    SELECT id::text AS id, nombre, tipo,
           ST_AsGeoJSON(geometria)::jsonb AS geometria
    FROM zonas
    WHERE activa = true
    ORDER BY id
  `;
}
```

`ST_AsGeoJSON(...)::jsonb` convierte la geometría a un objeto JSON (no un string), evitando un `JSON.parse` extra en el backend.

### 3.3 Crear registros con geometría (INSERT + `ST_GeomFromGeoJSON`)

**Nunca concatenes strings** para armar SQL: usa template literals etiquetadas, que Prisma parameteriza automáticamente (protección contra inyección SQL):

```ts
async crearZona(dto: CrearZonaDto) {
  // dto.geometria es un GeoJSON Polygon recibido del frontend
  await this.prisma.$executeRaw`
    INSERT INTO zonas (nombre, tipo, geometria, creado_por)
    VALUES (
      ${dto.nombre},
      ${dto.tipo},
      ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(dto.geometria)}), 4326),
      ${dto.creadoPor}
    )
  `;
}
```

- `ST_GeomFromGeoJSON` recibe el GeoJSON como **texto** (`JSON.stringify`).
- `ST_SetSRID(..., 4326)` fija el SRID WGS84 que exige el modelo.
- Si la geometría es inválida, la BD lanza el CHECK `zonas_geometria_check` → el filtro global responde **400** con "La geometría de la zona no es válida".

### 3.4 Patrón mixto: cliente Prisma + UPDATE crudo

Cuando solo la geometría necesita SQL, crea el registro con el cliente Prisma (sin el campo geometry) y luego actualízalo con una query cruda — así se mantiene todo el tipado del cliente para el resto de campos:

```ts
async crearModulo(dto: CrearModuloDto) {
  const modulo = await this.prisma.modulos.create({
    data: {
      codigo: dto.codigo,
      categoria: dto.categoria,
      actividad: dto.actividad,
      registradoPor: dto.registradoPor,
      // 'ubicacion' NO va aquí: es Unsupported
    },
  });

  await this.prisma.$executeRaw`
    UPDATE modulos
    SET ubicacion = ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(dto.ubicacion)}), 4326)
    WHERE id = ${modulo.id}
  `;

  return modulo; // id ya se serializa como string
}
```

### 3.5 Actualizar geometrías

```ts
async moverModulo(id: bigint, nuevaUbicacion: GeoJSON.Point) {
  await this.prisma.$executeRaw`
    UPDATE modulos
    SET ubicacion = ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(nuevaUbicacion)}), 4326)
    WHERE id = ${id}
  `;
}
```

### 3.6 Queries geoespaciales

Las consultas espaciales del negocio (¿en qué zona cae este punto?, ¿qué módulos hay cerca?) también son raw:

```ts
// ¿Qué zona permitida contiene este punto? (HU de evaluación de factibilidad)
async zonaDelPunto(lat: number, lng: number) {
  return this.prisma.$queryRaw<{ id: string; nombre: string }[]>`
    SELECT id::text AS id, nombre
    FROM zonas
    WHERE activa = true
      AND tipo = 'permitida'
      AND ST_Contains(geometria, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326))
  `;
}

// Módulos activos a menos de 300 m de un punto
async modulosCercanos(lat: number, lng: number) {
  return this.prisma.$queryRaw<{ id: string; codigo: string }[]>`
    SELECT id::text AS id, codigo
    FROM modulos
    WHERE estado = 'activo'
      AND ST_DWithin(
        ubicacion,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
        300
      )
  `;
}
```

> Nota: `ST_MakePoint(lng, lat)` — **longitud primero**. Con SRID 4326, `ST_DWithin` sobre geometría (no geografía) mide en grados; si necesitas metros exactos usa `geography(ubicacion)` o `ST_DWithin(..., ..., 300, true)`.

### 3.7 Vistas materializadas (dashboards)

Las vistas `mv_ocupacion_zona`, `mv_recaudacion`, `mv_saturacion` y `mv_tiempos_atencion` **no están en el schema de Prisma** (solo introspecciona tablas). Consúltalas con `$queryRaw`:

```ts
async ocupacionPorZona() {
  return this.prisma.$queryRaw<{ zona: string; ocupados: number; total: number }[]>`
    SELECT zona, ocupados, total FROM mv_ocupacion_zona ORDER BY zona
  `;
}
```

### 3.8 Buenas prácticas para queries crudos

1. **Siempre** template literal etiquetada ($queryRaw\`...\${valor}\`) — parámetros seguros, nunca concatenación.
2. Define una **interfaz** para la forma de la fila (`$queryRaw<MiFila[]>`) — el resultado de raw NO tiene los tipos del modelo.
3. Castear ids: `id::text AS id` (ver sección 2.4).
4. Nombres de columnas en **snake_case** en raw (así están en la BD); considera alias a camelCase si el DTO lo espera.
5. Errores de raw llegan como `P2010` — el filtro global traduce el código PostgreSQL embebido (ver sección 4).

---

## 4. Manejo de errores: filtro global Prisma → HTTP

`src/common/filters/prisma-exception.filter.ts` está registrado como `APP_FILTER` en `AppModule`: **aplica a todos los módulos automáticamente**. No hay que capturar errores de BD manualmente; solo lánzalos y el filtro responde.

### 4.1 Formato de respuesta

Cuerpo estándar de NestJS (`{ statusCode, message, error }`) con mensajes en español:

```json
{
  "statusCode": 409,
  "message": "El correo ya está registrado",
  "error": "Conflict"
}
```

Las `HttpException` (pipes, validaciones, `NotFoundException` propia, etc.) pasan **intactas** por el filtro con su comportamiento normal.

### 4.2 Tabla de traducción

| Origen (Prisma / PostgreSQL) | HTTP | Mensaje |
|---|---|---|
| `P2002` / `23505` unique_violation | 409 | "El correo ya está registrado" (y las 13 constraints UNIQUE mapeadas) |
| `P2003` / `23503` foreign_key_violation | 409 | "No se puede completar la operación porque el registro está relacionado con otros datos" |
| `P2025` registro no encontrado | 404 | "El registro solicitado no existe" |
| `P2011` / `23502` not_null_violation | 400 | "Falta un valor obligatorio en: …" |
| `23514` check_violation (vía `P2010`/`P2039`) | 400 | Mensaje de la regla de negocio (14 checks mapeados, ej. "Un comerciante debe tener documento, teléfono y contraseña") |
| `23P01` exclusion_violation (vía `P2010`/`P2039`) | 409 | "Ya hay una feria en esa zona dentro de esas fechas" (y los otros 2 solapamientos) |
| `P2007` / `22P02` valor inválido | 400 | "Uno de los valores enviados no es válido" |
| `P2020` / `22003` valor fuera de rango | 400 | "Un valor numérico está fuera del rango permitido" |
| `22001` cadena demasiado larga | 400 | "Un valor excede la longitud máxima permitida" |
| `40001` / `40P01` serialización | 409 | "Conflicto de concurrencia… reintenta la operación" |
| `P1001`/`P1002`/`P1017`/`P2037` conexión | 503 | "No fue posible conectar con la base de datos" |
| `P1000`/`P1010`/`P1011` credenciales | 503 | "La configuración de acceso a la base de datos es inválida" |
| `PrismaClientValidationError` (bug de código) | 500 | "Error interno del servidor" (detalles solo en logs) |
| Otros | 500 | "Error inesperado de la base de datos" |

> **Detalle técnico:** con el driver adapter, los códigos que Prisma no mapea (checks `23514` y exclusiones `23P01`) llegan como `P2010` (queries crudas) o `P2039` (cliente), con el código PostgreSQL original anidado en `meta.driverAdapterError.cause.originalCode` o en el texto del mensaje. El filtro extrae ambas formas, y también detecta errores crudos de `pg` que no vinieran envueltos.

> El servidor PostgreSQL puede estar localizado (mensajes en español con «guillemets»); el filtro extrae el nombre de la constraint tanto de mensajes en inglés (`constraint "x"`) como localizados (`«x»`).

### 4.3 Extender los mensajes

Al agregar constraints al SQL, añade el mensaje amigable en el mapa correspondiente dentro del filtro (`UNIQUE_CONSTRAINT_MESSAGES`, `CHECK_CONSTRAINT_MESSAGES`, `EXCLUSION_CONSTRAINT_MESSAGES`). Si no está mapeada, la respuesta incluye el nombre de la constraint para depuración:

```json
{ "statusCode": 409, "message": "Ya existe un registro con ese valor (restricción \"nueva_constraint_key\")", "error": "Conflict" }
```

---

## 5. Checklist para nuevas funcionalidades

- [ ] Inyecto `PrismaService` (global, sin imports extra).
- [ ] No capturo errores de BD: el filtro global los traduce.
- [ ] IDs recibidos por HTTP: convertir con `BigInt(id)` validado (regex `^\d+$`).
- [ ] Respuestas con IDs: ya se serializan como string (parche global en `main.ts`).
- [ ] Campos `geometry`: leo/escribo **solo** con `$queryRaw`/`$executeRaw` + funciones PostGIS (`ST_AsGeoJSON`, `ST_SetSRID(ST_GeomFromGeoJSON(...), 4326)`).
- [ ] Queries crudas: template literal etiquetada (nunca concatenación) + interfaz tipada de la fila + `id::text` para los BIGINT.
- [ ] Vistas materializadas: siempre `$queryRaw`.
- [ ] Si cambio el SQL del modelo: re-ejecutar scripts → `pnpm exec prisma db pull` → `pnpm exec prisma generate` (la BD es la fuente de verdad; **no** usar `prisma migrate`).
- [ ] Si agrego constraints: mapear su mensaje en `PrismaExceptionFilter`.
