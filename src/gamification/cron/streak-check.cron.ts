import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class StreakCheckCron {
    private readonly logger = new Logger(StreakCheckCron.name);

    constructor(private readonly prisma: PrismaService) { }

    @Cron(CronExpression.EVERY_HOUR)
    async checkStreaks() {
        this.logger.log('Checking streaks...');
        const now = new Date();
        const currentHour = now.getHours();

        if (currentHour !== 0) return;

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const dayBefore = new Date(yesterday);
        dayBefore.setDate(dayBefore.getDate() - 1);

        const users = await this.prisma.user.findMany({
            select: {
                id: true,
                streakFreezes: true,
            },
        });

        let resetCount = 0;
        let freezeUsedCount = 0;

        for (const user of users) {
            const hasYesterdayActivity = await this.prisma.streakHistory.findUnique({
                where: {
                    userId_date: {
                        userId: user.id,
                        date: yesterday,
                    },
                },
            });

            if (hasYesterdayActivity) continue;

            const hasDayBeforeActivity = await this.prisma.streakHistory.findUnique({
                where: {
                    userId_date: {
                        userId: user.id,
                        date: dayBefore,
                    },
                },
            });

            if (!hasDayBeforeActivity) continue;

            if (user.streakFreezes > 0) {
                await this.prisma.user.update({
                    where: { id: user.id },
                    data: { streakFreezes: { decrement: 1 } },
                });

                await this.prisma.streakHistory.create({
                    data: {
                        userId: user.id,
                        date: yesterday,
                        actionCount: 0,
                    },
                });

                freezeUsedCount++;
            } else {
                resetCount++;
            }
        }

        this.logger.log(
            `Streak check completed. Freezes used: ${freezeUsedCount}, Resets: ${resetCount}`,
        );
    }
}