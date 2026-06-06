import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailService } from './mailer.service';
import { join } from 'path';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter'
@Global()
@Module({
    imports: [
        MailerModule.forRootAsync({
            imports: [ConfigModule],

            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                transport: {
                    host: configService.get('mail.host'),
                    port: configService.get('mail.port'),
                    secure: false,
                    auth:
                        configService.get('mail.user')
                            ? {
                                user: configService.get('mail.user'),
                                pass: configService.get('mail.password'),
                            }
                            : undefined,
                },
                defaults: {
                    from: configService.get('mail.from'),
                },
                template: {
                    dir: join(process.cwd(), configService.getOrThrow<string>('emailTemplates.path')),
                    adapter: new HandlebarsAdapter(),
                    options: {
                        strict: true,
                    },
                },
            }),
        }),
    ],
    providers: [MailService],
    exports: [MailService],
})
export class MailModule { }