# Swagger / OpenAPI — Cómo documentar los endpoints

**UI interactiva:** <http://localhost:3000/api/docs>
**Spec OpenAPI (JSON):** <http://localhost:3000/api/docs-json> (importable en Postman/Insomnia)

La documentación se genera **desde el código**: cada endpoint nuevo se documenta con decoradores de `@nestjs/swagger` al momento de crearlo, y aparece automáticamente en la UI.

---

## 1. Configuración (ya aplicada)

- **`src/main.ts`** — construye el documento (`DocumentBuilder`: título, descripción, versión) y lo monta en `/api/docs` con `addBearerAuth()` listo para los endpoints protegidos.
- **`nest-cli.json`** — plugin CLI de `@nestjs/swagger` con:
  - `introspectComments: true` → los comentarios JSDoc (`/** ... */`) de controllers y propiedades se convierten en **descripciones** de Swagger automáticamente.
  - `classValidatorShim: true` → cuando se agregue `class-validator`, los DTOs con validadores generan sus schemas sin decoradores extra.

> Con el plugin activo, un DTO con tipos correctos y JSDoc queda documentado **sin necesidad de `@ApiProperty`** en cada campo; solo se usa `@ApiProperty` para casos especiales (ejemplos, formatos, enums).

---

## 2. Decoradores esenciales

| Decorador | Dónde | Para qué |
|---|---|---|
| `@ApiTags('usuarios')` | Clase controller | Agrupa los endpoints en la UI |
| `@ApiOperation({ summary, description })` | Método | Título y detalle de la operación |
| `@ApiParam({ name, description, example })` | Método | Documenta un param de ruta (`:id`) |
| `@ApiQuery({ name, description, required })` | Método | Documenta un query param |
| `@ApiOkResponse({ type, description })` | Método | Respuesta 200 con su tipo |
| `@ApiCreatedResponse({ type })` | Método | Respuesta 201 (POST) |
| `@ApiNotFoundResponse(...)` / `@ApiConflictResponse(...)` / `@ApiBadRequestResponse(...)` | Método | Documenta los errores que puede devolver el filtro global |
| `@ApiBearerAuth()` | Clase o método | Marca el endpoint como protegido (JWT) |
| `@ApiExcludeEndpoint()` | Método | Oculta un endpoint de la doc |

---

## 3. Patrón recomendado para un endpoint nuevo

```ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiConflictResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CrearUsuarioDto, UsuarioResponseDto } from './dto/usuarios.dto';

@ApiTags('usuarios')
@ApiBearerAuth() // mientras no exista auth, puede omitirse
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuarios: UsuariosService) {}

  /**
   * Registra un usuario comerciante con sus datos de contacto.
   */
  @ApiOperation({ summary: 'Crear usuario' })
  @ApiCreatedResponse({ type: UsuarioResponseDto, description: 'Usuario creado' })
  @ApiConflictResponse({
    description: 'El correo o documento ya están registrados',
  })
  @Post()
  crear(@Body() dto: CrearUsuarioDto): Promise<UsuarioResponseDto> {
    return this.usuarios.crear(dto);
  }

  /**
   * Devuelve un usuario por su identificador numérico.
   */
  @ApiOperation({ summary: 'Obtener usuario por id' })
  @ApiParam({ name: 'id', description: 'Identificador del usuario', example: '3' })
  @ApiOkResponse({ type: UsuarioResponseDto })
  @ApiNotFoundResponse({ description: 'El registro solicitado no existe' })
  @Get(':id')
  obtener(@Param('id') id: string): Promise<UsuarioResponseDto> {
    return this.usuarios.obtener(BigInt(id));
  }
}
```

### DTOs

```ts
export class CrearUsuarioDto {
  /** Nombre completo del usuario. */
  nombre: string;

  /** Correo único de la cuenta (se valida sin mayúsculas en la BD). */
  correo: string;

  /** Rol dentro de la plataforma. */
  rol: 'comerciante' | 'organizador' | 'gestor';

  /** Documento de identidad (obligatorio para comerciantes). */
  documento?: string;
}

export class UsuarioResponseDto {
  /** Identificador. Los BIGINT se serializan como string (ver docs/uso_db.md §2). */
  id: string;
  nombre: string;
  correo: string;
  rol: 'comerciante' | 'organizador' | 'gestor';
}
```

**Reglas del proyecto para DTOs:**

1. **IDs como `string`.** Las llaves BIGINT llegan al frontend como string (parche global de serialización); declara `id: string` en los DTOs de respuesta y en `@ApiParam({ example: '3' })`.
2. Comenta cada propiedad con JSDoc: con `introspectComments` se vuelven descripciones del schema en la UI.
3. Cuando se instale `class-validator` (recomendado para validar los `@Body()`), agregar los validadores basta — el plugin genera los schemas y `ValidationPipe` devuelve 400 automáticos.
4. Enums de la BD (rol, estados): usar los enums generados (`import { rol_usuario } from '../generated/prisma/client'`) y `@ApiProperty({ enum: ... })` si se quiere el desplegable en la UI.

---

## 4. Documentar los errores del filtro global

El `PrismaExceptionFilter` responde con el cuerpo estándar
`{ statusCode, message, error }` (ver `docs/uso_db.md` §4). En cada endpoint documenta solo los errores que realmente puede producir:

| Situación | Decorador |
|---|---|
| UNIQUE (correo, documento, NIT…) | `@ApiConflictResponse({ description: 'El correo ya está registrado' })` |
| Relación FK que impide la operación | `@ApiConflictResponse({ description: 'El registro está relacionado con otros datos' })` |
| Registro inexistente | `@ApiNotFoundResponse({ description: 'El registro solicitado no existe' })` |
| CHECK de negocio (fechas, valores, roles) | `@ApiBadRequestResponse({ description: 'Viola una regla de negocio' })` |
| Solapamiento (ferias, espacios, permisos) | `@ApiConflictResponse({ description: 'Conflicto de solapamiento de fechas/zona' })` |

---

## 5. Verificar los cambios

- UI: <http://localhost:3000/api/docs> (`pnpm start:dev`)
- El JSON siempre refleja el código al momento de levantar la app; no hay que mantener nada aparte.
- `pnpm start:dev` re-genera la doc en cada reinicio del servidor.

> Si en producción no se quiere exponer la documentación, condiciona el bloque de Swagger en `main.ts` a `process.env.NODE_ENV !== 'production'`.
