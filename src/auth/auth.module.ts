import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshGuard } from '../common/guards/jwt.refresh.guard';
import { JwtRefreshStrategy } from './strategies/jwt.refresh.strategy';

@Module({
    imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get('jwt.accessSecret'),
                signOptions: {
                    expiresIn: configService.get('jwt.accessExpiresIn'),
                },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy, JwtRefreshStrategy, JwtRefreshGuard],
    exports: [JwtModule, PassportModule, AuthService],
})
export class AuthModule { }