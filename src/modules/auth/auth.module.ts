import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ApiKey } from './entities/api-key.entity';
import { User } from './entities/user.entity';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { AuthSessionService } from './auth-session.service';
import { AuthController } from './auth.controller';
import { AuthValidateController } from './auth-validate.controller';
import { AuthSessionController } from './auth-session.controller';
import { UsersController } from './users.controller';
import { JwtOrApiKeyGuard } from './guards/jwt-or-api-key.guard';
import { AppThrottlerGuard } from './guards/app-throttler.guard';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, User], 'main'),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('jwt.secret');
        if (!secret && process.env.NODE_ENV === 'production') {
          throw new Error('JWT_SECRET is required in production');
        }
        const accessExpiresIn = configService.get<string>('jwt.accessExpiresIn', '8h');
        return {
          secret: secret || 'openwa-jwt-dev-secret-change-me',
          signOptions: {
            expiresIn: accessExpiresIn as `${number}h`,
          },
        };
      },
    }),
  ],
  controllers: [
    AuthController,
    AuthValidateController,
    AuthSessionController,
    UsersController,
  ],
  providers: [
    AuthService,
    UserService,
    AuthSessionService,
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtOrApiKeyGuard,
    },
  ],
  exports: [AuthService, UserService, AuthSessionService],
})
export class AuthModule {}
