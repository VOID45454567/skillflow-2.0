import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { type Cache } from 'cache-manager';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class GamificationService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    async getAchievements(userId: number) {
        const achievements = await this.prisma.achievement.findMany({
            include: {
                progresses: {
                    where: { userId },
                },
            },
        });

        return achievements.map((achievement) => {
            const progress = achievement.progresses[0];
            return {
                id: achievement.id,
                name: achievement.name,
                description: achievement.description,
                iconUrl: achievement.iconUrl,
                category: achievement.category,
                xpReward: achievement.xpReward,
                progress: progress?.progress ?? 0,
                isUnlocked: progress?.isUnlocked ?? false,
                unlockedAt: progress?.unlockedAt ?? null,
            };
        });
    }

    async getGlobalLeaderboard(page: number = 1, limit: number = 20) {
        const cacheKey = `leaderboard:global:${page}:${limit}`;
        const cached = await this.cacheManager.get(cacheKey);

        if (cached) {
            return cached;
        }

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                select: {
                    id: true,
                    login: true,
                    avatarUrl: true,
                    experiencePoints: true,
                    _count: {
                        select: {
                            certificates: true,
                            courses: true,
                            friendsOf: true,
                        },
                    },
                },
                orderBy: { experiencePoints: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.user.count(),
        ]);

        const leaderboard = {
            users: users.map((user, index) => ({
                rank: (page - 1) * limit + index + 1,
                ...user,
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };

        await this.cacheManager.set(cacheKey, leaderboard, 60000);

        return leaderboard;
    }

    async getWeeklyLeaderboard(page: number = 1, limit: number = 20) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const cacheKey = `leaderboard:weekly:${page}:${limit}`;
        const cached = await this.cacheManager.get(cacheKey);

        if (cached) {
            return cached;
        }

        const users = await this.prisma.user.findMany({
            select: {
                id: true,
                login: true,
                avatarUrl: true,
                experiencePoints: true,
                heatmapDatas: {
                    where: {
                        date: { gte: weekAgo },
                    },
                    select: {
                        actionsCount: true,
                    },
                },
                _count: {
                    select: {
                        certificates: true,
                    },
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
            .slice((page - 1) * limit, page * limit)
            .map((user, index) => ({
                rank: (page - 1) * limit + index + 1,
                ...user,
            }));

        const result = {
            users: sorted,
            page,
        };

        await this.cacheManager.set(cacheKey, result, 300000);

        return result;
    }

    async getFriendsLeaderboard(userId: number) {
        const cacheKey = `leaderboard:friends:${userId}`;
        const cached = await this.cacheManager.get(cacheKey);

        if (cached) {
            return cached;
        }

        const friendships = await this.prisma.friendship.findMany({
            where: {
                OR: [{ userAId: userId }, { userBId: userId }],
            },
        });

        const friendIds = friendships.map((f) =>
            f.userAId === userId ? f.userBId : f.userAId,
        );

        const users = await this.prisma.user.findMany({
            where: { id: { in: [userId, ...friendIds] } },
            select: {
                id: true,
                login: true,
                avatarUrl: true,
                experiencePoints: true,
                _count: {
                    select: {
                        certificates: true,
                    },
                },
            },
            orderBy: { experiencePoints: 'desc' },
        });

        const leaderboard = users.map((user, index) => ({
            rank: index + 1,
            ...user,
            isYou: user.id === userId,
        }));

        await this.cacheManager.set(cacheKey, leaderboard, 60000);

        return leaderboard;
    }

    async getStreak(userId: number) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let streakCount = 0;
        let currentDate = new Date(today);

        for (let i = 0; i < 365; i++) {
            const activity = await this.prisma.streakHistory.findUnique({
                where: {
                    userId_date: {
                        userId,
                        date: currentDate,
                    },
                },
            });

            if (activity) {
                streakCount++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else if (i === 0) {
                currentDate.setDate(currentDate.getDate() - 1);
                continue;
            } else {
                break;
            }
        }

        const hasTodayActivity = await this.prisma.streakHistory.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: today,
                },
            },
        });

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { streakFreezes: true },
        });

        return {
            currentStreak: streakCount,
            hasTodayActivity: !!hasTodayActivity,
            streakFreezes: user.streakFreezes,
        };
    }

    async getStreakHistory(userId: number, days: number = 30) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        return this.prisma.streakHistory.findMany({
            where: {
                userId,
                date: { gte: startDate },
            },
            orderBy: { date: 'asc' },
        });
    }

    async buyStreakFreeze(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        const freezeCost = this.configService.get('streak.freezeCost');

        if (user.balance < freezeCost) {
            throw new BadRequestException(
                `Недостаточно средств. Стоимость заморозки: ${freezeCost} руб.`,
            );
        }

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: userId },
                data: {
                    balance: { decrement: freezeCost },
                    streakFreezes: { increment: 1 },
                },
            }),
        ]);

        return {
            message: 'Заморозка серии куплена',
            streakFreezes: user.streakFreezes + 1,
            balance: user.balance - freezeCost,
        };
    }

    async getXPHistory(userId: number, page: number = 1, limit: number = 20) {
        const [activities, total] = await Promise.all([
            this.prisma.feedEvent.findMany({
                where: { subjectId: userId },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.feedEvent.count({
                where: { subjectId: userId },
            }),
        ]);

        return {
            activities,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
}