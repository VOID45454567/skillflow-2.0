import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { JwtRefreshPayload } from '../../types/interfaces/jwt.payload';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        super({
            jwtFromRequest: (req: Request) => req.cookies.refreshToken || null,
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow<string>('jwt.refreshSecret'),
            passReqToCallback: true,
        });
    }

    async validate(req: Request, payload: JwtRefreshPayload) {
        const refreshToken = req.cookies?.refreshToken;

        if (!refreshToken) {
            throw new UnauthorizedException('Refresh токен не предоставлен');
        }

        const storedToken = await this.prisma.refreshToken.findFirst({
            where: {
                tokenValue: refreshToken,
                isRevoked: false,
                expiresAt: { gt: new Date() },
            },
        });

        if (!storedToken) {
            throw new UnauthorizedException('Refresh токен недействителен или отозван');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            select: {
                id: true,
                email: true,
                role: true,
                verificationStatus: true,
            },
        });

        if (!user) {
            throw new UnauthorizedException('Пользователь не найден');
        }

        return { ...user, refreshTokenId: storedToken.id };
    }
}