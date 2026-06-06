import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { type Cache } from 'cache-manager';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class LeaderboardSnapshotCron {
    private readonly logger = new Logger(LeaderboardSnapshotCron.name);

    constructor(
        private readonly prisma: PrismaService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    @Cron(CronExpression.EVERY_HOUR)
    async takeSnapshots() {
        this.logger.log('Taking leaderboard snapshots...');

        await this.takeGlobalSnapshot();
        await this.takeWeeklySnapshot();
        await this.invalidateFriendsCache();

        this.logger.log('Leaderboard snapshots completed');
    }

    private async takeGlobalSnapshot() {
        const users = await this.prisma.user.findMany({
            select: {
                id: true,
                login: true,
                avatarUrl: true,
                experiencePoints: true,
            },
            orderBy: { experiencePoints: 'desc' },
            take: 100,
        });

        await this.prisma.leaderboardSnapshot.create({
            data: {
                type: 'global',
                period: 'all_time',
                data: users.map((user, index) => ({
                    rank: index + 1,
                    ...user,
                })),
            },
        });
    }

    private async takeWeeklySnapshot() {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const users = await this.prisma.user.findMany({
            select: {
                id: true,
                login: true,
                avatarUrl: true,
                experiencePoints: true,
                heatmapDatas: {
                    where: { date: { gte: weekAgo } },
                    select: { actionsCount: true },
                },
            },
            take: 100,
        });

        const sorted = users
            .map((user) => ({
                id: user.id,
                login: user.login,
                avatarUrl: user.avatarUrl,
                experiencePoints: user.experiencePoints,
                weeklyActions: user.heatmapDatas.reduce(
                    (sum, d) => sum + d.actionsCount,
                    0,
                ),
            }))
            .sort((a, b) => b.weeklyActions - a.weeklyActions)
            .map((user, index) => ({
                rank: index + 1,
                ...user,
            }));

        await this.prisma.leaderboardSnapshot.create({
            data: {
                type: 'weekly',
                period: 'current_week',
                data: sorted,
            },
        });
    }

    private async invalidateFriendsCache() {
        const keys = await this.cacheManager.store.keys('leaderboard:friends:*');
        for (const key of keys) {
            await this.cacheManager.del(key);
        }
    }
}