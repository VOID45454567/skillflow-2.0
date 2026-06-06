import {
    Injectable,
    BadRequestException,
    UnauthorizedException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import {
    RegisterDto,
    LoginDto,
    VerifyEmailDto,
    ForgotPasswordDto,
    ResetPasswordDto,
    TwoFactorDto,
} from './dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { MailService } from '../common/mail/mailer.service';
import { JwtPayload, JwtRefreshPayload } from '../types/interfaces/jwt.payload';
import { Response } from 'express';

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly redisService: RedisService,
        private readonly mailService: MailService,
    ) { }

    async register(dto: RegisterDto) {
        const existingUser = await this.prisma.user.findFirst({
            where: {
                OR: [{ email: dto.email }, { login: dto.login }],
            },
        });

        if (existingUser) {
            if (existingUser.email === dto.email) {
                throw new ConflictException('Пользователь с таким email уже существует');
            }
            throw new ConflictException('Пользователь с таким логином уже существует');
        }

        const hashedPassword = await argon2.hash(dto.password);

        const user = await this.prisma.user.create({
            data: {
                login: dto.login,
                email: dto.email,
                password: hashedPassword,
            },
        });

        await this.prisma.notificationSettings.create({
            data: { userId: user.id },
        });

        const verificationCode = this.generateCode();
        await this.prisma.twoVerificationCode.create({
            data: {
                userId: user.id,
                code: verificationCode,
            },
        });

        await this.mailService.sendVerificationEmail(user.email, verificationCode);

        return {
            message: 'Регистрация успешна. Проверьте email для подтверждения.',
            userId: user.id,
        };
    }

    async verifyEmail(dto: VerifyEmailDto) {
        const verificationCode = await this.prisma.twoVerificationCode.findFirst({
            where: {
                code: dto.code,
                isUsed: false,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!verificationCode) {
            throw new BadRequestException('Неверный или уже использованный код');
        }

        const codeAge =
            (Date.now() - verificationCode.createdAt.getTime()) / 1000;
        const ttl = this.configService.get('emailVerification.tokenTtl');

        if (codeAge > ttl) {
            throw new BadRequestException('Срок действия кода истек');
        }

        await this.prisma.$transaction([
            this.prisma.twoVerificationCode.update({
                where: { id: verificationCode.id },
                data: { isUsed: true },
            }),
            this.prisma.user.update({
                where: { id: verificationCode.userId },
                data: { emailVerified: true },
            }),
        ]);

        return { message: 'Email успешно подтвержден' };
    }

    async login(dto: LoginDto, ip: string, response: Response) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user) {
            throw new UnauthorizedException('Неверный email или пароль');
        }

        const isPasswordValid = await argon2.verify(user.password, dto.password);
        if (!isPasswordValid) {
            await this.handleFailedLogin(user.id);
            throw new UnauthorizedException('Неверный email или пароль');
        }

        await this.clearFailedLoginAttempts(user.id);

        if (user.enabledTwoFactor) {
            const code = this.generateCode();
            await this.prisma.twoVerificationCode.create({
                data: {
                    userId: user.id,
                    code,
                },
            });

            await this.mailService.sendTwoFactorCode(user.email, code);

            return {
                requiresTwoFactor: true,
                userId: user.id,
                message: 'Код двухфакторной аутентификации отправлен на email',
            };
        }

        const tokens = await this.generateTokens(user.id, user.email, user.role);

        response.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/api/auth',
        });

        return {
            ...tokens,
            user: {
                id: user.id,
                login: user.login,
                email: user.email,
                role: user.role,
                avatarUrl: user.avatarUrl,
            },
        };
    }

    async verifyTwoFactor(dto: TwoFactorDto, userId: number) {
        const code = await this.prisma.twoVerificationCode.findFirst({
            where: {
                userId,
                code: dto.code,
                isUsed: false,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!code) {
            throw new BadRequestException('Неверный код');
        }

        const codeAge = (Date.now() - code.createdAt.getTime()) / 1000;
        const ttl = this.configService.get('twoFactor.codeTtl');

        if (codeAge > ttl) {
            throw new BadRequestException('Срок действия кода истек');
        }

        await this.prisma.twoVerificationCode.update({
            where: { id: code.id },
            data: { isUsed: true },
        });

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            return new NotFoundException('Пользователь не найден')
        }

        const tokens = await this.generateTokens(user.id, user.email, user.role);

        return {
            ...tokens,
            user: {
                id: user.id,
                login: user.login,
                email: user.email,
                role: user.role,
                avatarUrl: user.avatarUrl,
            },
        };
    }

    async refreshTokens(refreshToken: string, response: Response) {
        const payload = this.jwtService.verify<JwtRefreshPayload>(refreshToken, {
            secret: this.configService.get('jwt.refreshSecret'),
        });

        const storedToken = await this.prisma.refreshToken.findFirst({
            where: {
                tokenValue: refreshToken,
                isRevoked: false,
                expiresAt: { gt: new Date() },
            },
        });

        if (!storedToken) {
            throw new UnauthorizedException('Refresh токен недействителен');
        }

        await this.prisma.refreshToken.update({
            where: { id: storedToken.id },
            data: { isRevoked: true },
        });

        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
        });

        if (!user) {
            return new NotFoundException('Пользователь не найден')
        }

        const tokens = await this.generateTokens(user.id, user.email, user.role);

        response.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/api/auth',
        });

        return { accessToken: tokens.accessToken }
    }

    async logout(refreshToken: string, response: Response) {
        await this.prisma.refreshToken.updateMany({
            where: { tokenValue: refreshToken, isRevoked: false },
            data: { isRevoked: true },
        });

        response.clearCookie('refreshToken', {
            path: '/api/auth',
        });

        return { message: 'Выход выполнен успешно' };
    }

    async logoutAll(userId: number, response: Response) {
        await this.prisma.refreshToken.updateMany({
            where: { userId, isRevoked: false },
            data: { isRevoked: true },
        });

        response.clearCookie('refreshToken', {
            path: '/api/auth',
        });

        return { message: 'Выход со всех устройств выполнен успешно' };
    }

    async forgotPassword(dto: ForgotPasswordDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
        });

        if (!user) {
            return {
                message:
                    'Если пользователь с таким email существует, инструкция отправлена',
            };
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(
            Date.now() +
            this.configService.get('passwordReset.tokenTtl') * 1000,
        );

        await this.prisma.refreshToken.create({
            data: {
                userId: user.id,
                tokenValue: resetToken,
                expiresAt,
            },
        });

        await this.mailService.sendPasswordResetEmail(user.email, resetToken);

        return {
            message:
                'Если пользователь с таким email существует, инструкция отправлена',
        };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const tokenRecord = await this.prisma.refreshToken.findFirst({
            where: {
                tokenValue: dto.token,
                isRevoked: false,
                expiresAt: { gt: new Date() },
            },
        });

        if (!tokenRecord) {
            throw new BadRequestException('Токен сброса пароля недействителен');
        }

        const hashedPassword = await argon2.hash(dto.newPassword);

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: tokenRecord.userId },
                data: { password: hashedPassword },
            }),
            this.prisma.refreshToken.update({
                where: { id: tokenRecord.id },
                data: { isRevoked: true },
            }),
            this.prisma.refreshToken.updateMany({
                where: {
                    userId: tokenRecord.userId,
                    isRevoked: false,
                },
                data: { isRevoked: true },
            }),
        ]);

        return { message: 'Пароль успешно изменен' };
    }

    async resendVerification(userId: number) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return new NotFoundException('Пользователь не найден')
        }
        if (user.verificationStatus === 'VERIFIED') {
            throw new BadRequestException('Email уже подтвержден');
        }

        const code = this.generateCode();
        await this.prisma.twoVerificationCode.create({
            data: {
                userId: user.id,
                code,
            },
        });

        await this.mailService.sendVerificationEmail(user.email, code);

        return { message: 'Код подтверждения отправлен' };
    }

    async toggleTwoFactor(userId: number) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return new NotFoundException('Пользователь не найден')
        }
        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: { enabledTwoFactor: !user.enabledTwoFactor },
        });

        return {
            enabledTwoFactor: updated.enabledTwoFactor,
            message: updated.enabledTwoFactor
                ? 'Двухфакторная аутентификация включена'
                : 'Двухфакторная аутентификация отключена',
        };
    }

    private async generateTokens(userId: number, email: string, role: string) {
        const accessPayload: JwtPayload = { sub: userId, email, role };
        const refreshPayload: JwtRefreshPayload = {
            sub: userId,
            tokenId: crypto.randomUUID(),
        };

        const accessToken = this.jwtService.sign(accessPayload);

        const refreshToken = this.jwtService.sign(refreshPayload, {
            secret: this.configService.get('jwt.refreshSecret'),
            expiresIn: this.configService.get('jwt.refreshExpiresIn'),
        });

        const expiresAt = new Date(
            Date.now() +
            parseInt(this.configService.getOrThrow('jwt.refreshExpiresIn')) *
            24 *
            60 *
            60 *
            1000,
        );

        await this.prisma.refreshToken.create({
            data: {
                userId,
                tokenValue: refreshToken,
                expiresAt,
            },
        });

        return { accessToken, refreshToken };
    }

    private generateCode(): string {
        return crypto.randomInt(100000, 999999).toString();
    }

    private async handleFailedLogin(userId: number) {
        const key = `login-attempts:${userId}`;
        const attempts = await this.redisService.getOrSetCounter(key, 1);
        const maxAttempts = this.configService.get('security.maxLoginAttempts');

        if (attempts >= maxAttempts) {
            const blockTime = this.configService.get('security.loginBlockTime');
            await this.prisma.twoVerificationCode.create({
                data: {
                    userId,
                    code: 'BLOCKED',
                    isUsed: false,
                },
            });
        }
    }

    private async clearFailedLoginAttempts(userId: number) {
        const key = `login-attempts:${userId}`;
        await this.redisService.deleteKey(key);
    }
}