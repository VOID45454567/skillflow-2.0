import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MailService } from '../../common/mail/mailer.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SubscriptionCheckCron {
    private readonly logger = new Logger(SubscriptionCheckCron.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
    ) { }

    @Cron(CronExpression.EVERY_DAY_AT_10AM)
    async checkExpiringSubscriptions() {
        this.logger.log('Checking expiring subscriptions...');

        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

        const [authorSubs, orgSubs] = await Promise.all([
            this.prisma.authorSubscription.findMany({
                where: {
                    activeUntil: {
                        gte: new Date(),
                        lte: threeDaysFromNow,
                    },
                    autoRenew: false,
                },
                include: {
                    user: {
                        select: { email: true },
                    },
                    author: {
                        select: { login: true },
                    },
                },
            }),
            this.prisma.organizationSubscription.findMany({
                where: {
                    activeUntil: {
                        gte: new Date(),
                        lte: threeDaysFromNow,
                    },
                    autoRenew: false,
                },
                include: {
                    user: {
                        select: { email: true },
                    },
                    organization: {
                        select: { name: true },
                    },
                },
            }),
        ]);

        for (const sub of authorSubs) {
            await this.prisma.notification.create({
                data: {
                    userId: sub.userId,
                    type: 'SUBSCRIPTION_EXPIRING',
                    title: 'Подписка истекает',
                    body: `Подписка на автора "${sub.author.login}" истекает ${sub.activeUntil.toLocaleDateString()}`,
                },
            });

            await this.mailService.sendMail(
                sub.user.email,
                'Подписка истекает',
                'subscription-expiring',
                {
                    name: sub.author.login,
                    type: 'автора',
                    date: sub.activeUntil.toLocaleDateString(),
                },
            ).catch(() => { });
        }

        for (const sub of orgSubs) {
            await this.prisma.notification.create({
                data: {
                    userId: sub.userId,
                    type: 'SUBSCRIPTION_EXPIRING',
                    title: 'Подписка истекает',
                    body: `Подписка на организацию "${sub.organization.name}" истекает ${sub.activeUntil.toLocaleDateString()}`,
                },
            });

            await this.mailService.sendMail(
                sub.user.email,
                'Подписка истекает',
                'subscription-expiring',
                {
                    name: sub.organization.name,
                    type: 'организацию',
                    date: sub.activeUntil.toLocaleDateString(),
                },
            ).catch(() => { });
        }

        this.logger.log(
            `Found ${authorSubs.length} expiring author subscriptions and ${orgSubs.length} org subscriptions`,
        );
    }

    @Cron(CronExpression.EVERY_HOUR)
    async deactivateExpiredSubscriptions() {
        const now = new Date();

        const [authorDeactivated, orgDeactivated] = await Promise.all([
            this.prisma.authorSubscription.updateMany({
                where: {
                    activeUntil: { lte: now },
                    autoRenew: false,
                },
                data: {
                    activeUntil: new Date(0),
                },
            }),
            this.prisma.organizationSubscription.updateMany({
                where: {
                    activeUntil: { lte: now },
                    autoRenew: false,
                },
                data: {
                    activeUntil: new Date(0),
                },
            }),
        ]);

        if (authorDeactivated.count > 0 || orgDeactivated.count > 0) {
            this.logger.log(
                `Deactivated ${authorDeactivated.count} author and ${orgDeactivated.count} org subscriptions`,
            );
        }
    }
}