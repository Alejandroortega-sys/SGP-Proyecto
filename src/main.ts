// Parche global: serializa BigInt (todas las llaves BIGINT de la BD) como
// string en respuestas JSON. Debe importarse antes de levantar la app.
// Ver docs/uso_db.md (sección BigInt).
import './common/bigint-serialization';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validación global de los DTOs (class-validator): los @Body() que no
  // cumplan las reglas reciben 400 con los mensajes en español definidos
  // en cada decorador. `whitelist` descarta propiedades desconocidas y
  // `forbidNonWhitelisted` las rechaza de forma explícita.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Documentación interactiva de la API (OpenAPI / Swagger UI).
  // Cada endpoint nuevo se documenta con los decoradores de @nestjs/swagger;
  // ver docs/swagger.md para la guía de uso.
  const config = new DocumentBuilder()
    .setTitle('SGP Tuluá — Gestión del Espacio Público')
    .setDescription(
      'API REST de la Plataforma Web de Gestión del Espacio Público, Ferias ' +
        'Agroecológicas y Comercio Formal/Informal de Tuluá (Equipo 6). ' +
        'Los errores de base de datos se traducen con mensajes en español ' +
        '(ver docs/uso_db.md, sección "Manejo de errores").',
    )
    .setVersion('0.0.1')
    // Esquema de autenticación listo para los endpoints protegidos:
    // bastará con @ApiBearerAuth() en cada uno.
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    // JSON crudo del spec, útil para importarlo en Postman/Insomnia.
    jsonDocumentUrl: 'api/docs-json',
    customSiteTitle: 'SGP Tuluá — API',
    swaggerOptions: {
      // Mantiene el token entre recargas de la página.
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
