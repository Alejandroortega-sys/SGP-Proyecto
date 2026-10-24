import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { crearOpcionesThrottler } from './throttler.config';

/**
 * Autenticación con JWT.
 *
 * `JwtModule` se registra como global para que los guards (declarados en
 * `AppModule` como `APP_GUARD`) puedan inyectar `JwtService`. La aplicación
 * no arranca si falta `JWT_SECRET`: es preferible fallar al inicio que emitir
 * tokens firmados con un secreto vacío.
 *
 * `ThrottlerModule` configura el rate limit de `POST /auth/login` (10
 * peticiones por IP por minuto). El guard se aplica solo en esa ruta con
 * `@UseGuards(ThrottlerGuard)`; declararlo también aquí garantiza que se
 * instancie al arrancar y que sus hooks de ciclo de vida se ejecuten.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error(
            'JWT_SECRET no está definida en el entorno. Agrégala al archivo .env.',
          );
        }
        return { secret };
      },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => crearOpcionesThrottler(config),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, ThrottlerGuard],
  exports: [AuthService],
})
export class AuthModule {}
