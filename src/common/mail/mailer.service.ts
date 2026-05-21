import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);

    constructor(private readonly mailerService: MailerService) { }

    async sendMail(
        to: string,
        subject: string,
        template: string,
        context: Record<string, any>,
    ): Promise<void> {
        try {
            await this.mailerService.sendMail({
                to,
                subject,
                template,
                context,
            });
            this.logger.log(`Email sent to ${to} with subject "${subject}"`);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            const stack = error instanceof Error ? error.stack : undefined;
            this.logger.error(`Failed to send email to ${to}: ${message}`, stack);
        }
    }

    async sendVerificationEmail(to: string, code: string): Promise<void> {
        await this.sendMail(to, 'Подтверждение email', 'verification', { code });
    }

    async sendPasswordResetEmail(to: string, token: string): Promise<void> {
        await this.sendMail(to, 'Сброс пароля', 'password-reset', { token });
    }

    async sendTwoFactorCode(to: string, code: string): Promise<void> {
        await this.sendMail(to, 'Код двухфакторной аутентификации', 'two-factor', {
            code,
        });
    }
}