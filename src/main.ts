// Parche global: serializa BigInt (todas las llaves BIGINT de la BD) como
// string en respuestas JSON. Debe importarse antes de levantar la app.
// Ver docs/uso_db.md (sección BigInt).
import './common/bigint-serialization';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
