import { Module } from '@nestjs/common';
import { ProductosController } from './productos.controller';
import { ProductosService } from './productos.service';

/**
 * Catálogo maestro de productos del espacio público.
 *
 * `PrismaModule` es global y los guards de autenticación/autorización se
 * aplican desde `AppModule`. El controlador restringe la creación y el cambio
 * de estado al rol gestor.
 */
@Module({
  controllers: [ProductosController],
  providers: [ProductosService],
})
export class ProductosModule {}
