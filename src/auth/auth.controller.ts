import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    UseGuards,
    Req,
    Patch,
    Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
    RegisterDto,
    LoginDto,
    RefreshTokenDto,
    VerifyEmailDto,
    ForgotPasswordDto,
    ResetPasswordDto,
    TwoFactorDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current.user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RateLimit } from '../common/decorators/rate.limit.decorator';
import { JwtRefreshGuard } from '../common/guards/jwt.refresh.guard';
import type { Request, Response } from 'express';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Public()
    @Post('register')
    @RateLimit({ points: 3, duration: 60 })
    async register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Public()
    @Post('verify-email')
    @RateLimit({ points: 5, duration: 60 })
    async verifyEmail(@Body() dto: VerifyEmailDto) {
        return this.authService.verifyEmail(dto);
    }

    @Public()
    @Post('login')
    @RateLimit({ points: 5, duration: 60 })
    @HttpCode(HttpStatus.OK)
    async login(@Body() dto: LoginDto, @Req() request: any, @Res({ passthrough: true }) response: Response) {
        return this.authService.login(dto, request.ip, response);
    }

    @Public()
    @Post('two-factor')
    @RateLimit({ points: 5, duration: 60 })
    @HttpCode(HttpStatus.OK)
    async verifyTwoFactor(
        @Body() dto: TwoFactorDto,
        @Body('userId') userId: number,
    ) {
        return this.authService.verifyTwoFactor(dto, userId);
    }

    @Public()
    @Post('refresh')
    @UseGuards(JwtRefreshGuard)
    @HttpCode(HttpStatus.OK)
    async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
        return this.authService.refreshTokens(request.cookies.refreshToken || null, response);
    }

    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(@Body() dto: RefreshTokenDto, @Res({ passthrough: true }) response: Response) {
        return this.authService.logout(dto.refreshToken, response);
    }

    @Post('logout-all')
    @HttpCode(HttpStatus.OK)
    async logoutAll(@CurrentUser('id') userId: number, @Res({ passthrough: true }) response: Response) {
        return this.authService.logoutAll(userId, response);
    }

    @Public()
    @Post('forgot-password')
    @RateLimit({ points: 3, duration: 60 })
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto);
    }

    @Public()
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto);
    }

    @Post('resend-verification')
    @HttpCode(HttpStatus.OK)
    async resendVerification(@CurrentUser('id') userId: number) {
        return this.authService.resendVerification(userId);
    }

    @Patch('two-factor/toggle')
    async toggleTwoFactor(@CurrentUser('id') userId: number) {
        return this.authService.toggleTwoFactor(userId);
    }
}