import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { UpdateProfileDto, ChangePasswordDto } from './dto';
import { MinioService } from '../common/minio/minio.service';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class UserService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly minioService: MinioService,
    ) { }

    async getProfile(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                login: true,
                email: true,
                avatarUrl: true,
                role: true,
                verificationStatus: true,
                enabledTwoFactor: true,
                balance: true,
                experiencePoints: true,
                streakFreezes: true,
                preferredCategoryIds: true,
                preferredTagIds: true,
                notificationSettings: true,
                _count: {
                    select: {
                        courses: true,
                        certificates: true,
                        purchasedCourses: true,
                        friendsOf: true,
                        transactions: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('Пользователь не найден');
        }

        const { _count, ...userData } = user;

        return {
            ...userData,
            coursesCount: _count.courses,
            certificatesCount: _count.certificates,
            purchasedCoursesCount: _count.purchasedCourses,
            friendsCount: _count.friendsOf,
            transactionsCount: _count.transactions,
        };
    }

    async getPublicProfile(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                login: true,
                avatarUrl: true,
                verificationStatus: true,
                experiencePoints: true,
                _count: {
                    select: {
                        courses: true,
                        certificates: true,
                        friendsOf: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('Пользователь не найден');
        }

        const { _count, ...userData } = user;

        return {
            ...userData,
            coursesCount: _count.courses,
            certificatesCount: _count.certificates,
            friendsCount: _count.friendsOf,
        };
    }

    async updateProfile(userId: number, dto: UpdateProfileDto) {
        if (dto.login) {
            const existingUser = await this.prisma.user.findFirst({
                where: {
                    login: dto.login,
                    NOT: { id: userId },
                },
            });

            if (existingUser) {
                throw new BadRequestException('Этот логин уже занят');
            }
        }

        return this.prisma.user.update({
            where: { id: userId },
            data: {
                ...(dto.login && { login: dto.login }),
                ...(dto.preferredCategoryIds && {
                    preferredCategoryIds: dto.preferredCategoryIds,
                }),
                ...(dto.preferredTagIds && {
                    preferredTagIds: dto.preferredTagIds,
                }),
            },
            select: {
                id: true,
                login: true,
                email: true,
                avatarUrl: true,
                preferredCategoryIds: true,
                preferredTagIds: true,
            },
        });
    }

    async updateAvatar(userId: number, file: Express.Multer.File) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            return new NotFoundException('Пользователь не найден')
        }

        if (user.avatarUrl) {
            const oldObjectName = this.extractObjectName(user.avatarUrl);
            if (oldObjectName) {
                await this.minioService.deleteFile(oldObjectName).catch(() => { });
            }
        }

        const objectName = this.minioService.generateObjectName(
            'avatars',
            file.originalname,
        );
        const url = await this.minioService.uploadFile(
            objectName,
            file.buffer,
            file.mimetype,
        );

        await this.prisma.user.update({
            where: { id: userId },
            data: { avatarUrl: url },
        });

        return { avatarUrl: url };
    }

    async deleteAvatar(userId: number) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            return new NotFoundException('Пользователь не найден')
        }

        if (user.avatarUrl) {
            const objectName = this.extractObjectName(user.avatarUrl);
            if (objectName) {
                await this.minioService.deleteFile(objectName).catch(() => { });
            }
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: { avatarUrl: null },
        });

        return { message: 'Аватар удален' };
    }

    async changePassword(userId: number, dto: ChangePasswordDto) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            return new NotFoundException('Пользователь не найден')
        }

        const isOldPasswordValid = await argon2.verify(
            user.password,
            dto.oldPassword,
        );

        if (!isOldPasswordValid) {
            throw new BadRequestException('Неверный текущий пароль');
        }

        const hashedPassword = await argon2.hash(dto.newPassword);

        await this.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        await this.prisma.refreshToken.updateMany({
            where: {
                userId,
                isRevoked: false,
            },
            data: { isRevoked: true },
        });

        return { message: 'Пароль успешно изменен. Войдите заново.' };
    }

    async getHeatmap(userId: number, startDate: string, endDate: string) {
        return this.prisma.heatmapData.findMany({
            where: {
                userId,
                date: {
                    gte: new Date(startDate),
                    lte: new Date(endDate),
                },
            },
            orderBy: { date: 'asc' },
        });
    }

    async getCertificates(userId: number) {
        return this.prisma.certificate.findMany({
            where: { userId },
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
            orderBy: { issuedAt: 'desc' },
        });
    }

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

    async getWishlist(userId: number) {
        return this.prisma.wishlistItem.findMany({
            where: { userId },
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        price: true,
                        level: true,
                        visibility: true,
                        user: {
                            select: {
                                id: true,
                                login: true,
                                avatarUrl: true,
                            },
                        },
                        reviews: {
                            select: {
                                rating: true,
                            },
                        },
                        _count: {
                            select: {
                                purchasedCourse: true,
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async addToWishlist(userId: number, courseId: number) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        if (course.isFree) {
            throw new BadRequestException('Бесплатные курсы не нужно добавлять в вишлист');
        }

        const existing = await this.prisma.wishlistItem.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
        });

        if (existing) {
            throw new BadRequestException('Курс уже в вишлисте');
        }

        await this.prisma.wishlistItem.create({
            data: { userId, courseId },
        });

        return { message: 'Курс добавлен в вишлист' };
    }

    async removeFromWishlist(userId: number, courseId: number) {
        const item = await this.prisma.wishlistItem.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
        });

        if (!item) {
            throw new NotFoundException('Курс не найден в вишлисте');
        }

        await this.prisma.wishlistItem.delete({
            where: { id: item.id },
        });

        return { message: 'Курс удален из вишлиста' };
    }

    async getSubscriptions(userId: number) {
        const [authorSubs, orgSubs] = await Promise.all([
            this.prisma.authorSubscription.findMany({
                where: { userId },
                include: {
                    author: {
                        select: {
                            id: true,
                            login: true,
                            avatarUrl: true,
                        },
                    },
                },
            }),
            this.prisma.organizationSubscription.findMany({
                where: { userId },
                include: {
                    organization: {
                        select: {
                            id: true,
                            name: true,
                            logo: true,
                        },
                    },
                },
            }),
        ]);

        return { authorSubscriptions: authorSubs, organizationSubscriptions: orgSubs };
    }

    async getFriends(userId: number) {
        const friendships = await this.prisma.friendship.findMany({
            where: {
                OR: [{ userAId: userId }, { userBId: userId }],
            },
            include: {
                userA: {
                    select: {
                        id: true,
                        login: true,
                        avatarUrl: true,
                        experiencePoints: true,
                    },
                },
                userB: {
                    select: {
                        id: true,
                        login: true,
                        avatarUrl: true,
                        experiencePoints: true,
                    },
                },
            },
        });

        return friendships.map((friendship) => {
            const friend =
                friendship.userAId === userId ? friendship.userB : friendship.userA;
            return friend;
        });
    }

    async getFriendRequests(userId: number) {
        const [incoming, outgoing] = await Promise.all([
            this.prisma.friendRequest.findMany({
                where: {
                    recipientId: userId,
                    status: 'pending',
                },
                include: {
                    requester: {
                        select: {
                            id: true,
                            login: true,
                            avatarUrl: true,
                        },
                    },
                },
            }),
            this.prisma.friendRequest.findMany({
                where: {
                    requesterId: userId,
                    status: 'pending',
                },
                include: {
                    recipient: {
                        select: {
                            id: true,
                            login: true,
                            avatarUrl: true,
                        },
                    },
                },
            }),
        ]);

        return { incoming, outgoing };
    }

    async sendFriendRequest(userId: number, targetId: number) {
        if (userId === targetId) {
            throw new BadRequestException('Нельзя отправить заявку самому себе');
        }

        const targetUser = await this.prisma.user.findUnique({
            where: { id: targetId },
        });

        if (!targetUser) {
            throw new NotFoundException('Пользователь не найден');
        }

        const existingFriendship = await this.prisma.friendship.findFirst({
            where: {
                OR: [
                    { userAId: userId, userBId: targetId },
                    { userAId: targetId, userBId: userId },
                ],
            },
        });

        if (existingFriendship) {
            throw new BadRequestException('Вы уже друзья');
        }

        const existingRequest = await this.prisma.friendRequest.findUnique({
            where: {
                requesterId_recipientId: {
                    requesterId: userId,
                    recipientId: targetId,
                },
            },
        });

        if (existingRequest) {
            throw new BadRequestException('Заявка уже отправлена');
        }

        const reverseRequest = await this.prisma.friendRequest.findUnique({
            where: {
                requesterId_recipientId: {
                    requesterId: targetId,
                    recipientId: userId,
                },
            },
        });

        if (reverseRequest) {
            await this.prisma.$transaction([
                this.prisma.friendRequest.delete({
                    where: { id: reverseRequest.id },
                }),
                this.prisma.friendship.create({
                    data: {
                        userAId: userId,
                        userBId: targetId,
                    },
                }),
                this.prisma.notification.create({
                    data: {
                        userId: targetId,
                        type: 'FRIEND_ACCEPTED',
                        title: 'Заявка принята',
                        body: `Пользователь принял вашу заявку в друзья`,
                    },
                }),
            ]);

            return { status: 'accepted' };
        }

        await this.prisma.friendRequest.create({
            data: {
                requesterId: userId,
                recipientId: targetId,
            },
        });

        await this.prisma.notification.create({
            data: {
                userId: targetId,
                type: 'FRIEND_REQUEST',
                title: 'Новая заявка в друзья',
                body: `Пользователь хочет добавить вас в друзья`,
                data: { requesterId: userId },
            },
        });

        return { status: 'pending' };
    }

    async acceptFriendRequest(userId: number, requestId: number) {
        const request = await this.prisma.friendRequest.findUnique({
            where: { id: requestId },
        });

        if (!request || request.recipientId !== userId) {
            throw new NotFoundException('Заявка не найдена');
        }

        await this.prisma.$transaction([
            this.prisma.friendRequest.delete({
                where: { id: requestId },
            }),
            this.prisma.friendship.create({
                data: {
                    userAId: request.requesterId,
                    userBId: request.recipientId,
                },
            }),
            this.prisma.notification.create({
                data: {
                    userId: request.requesterId,
                    type: 'FRIEND_ACCEPTED',
                    title: 'Заявка принята',
                    body: `Пользователь принял вашу заявку в друзья`,
                },
            }),
        ]);

        return { message: 'Заявка принята' };
    }

    async rejectFriendRequest(userId: number, requestId: number) {
        const request = await this.prisma.friendRequest.findUnique({
            where: { id: requestId },
        });

        if (!request || request.recipientId !== userId) {
            throw new NotFoundException('Заявка не найдена');
        }

        await this.prisma.friendRequest.delete({
            where: { id: requestId },
        });

        return { message: 'Заявка отклонена' };
    }

    async cancelFriendRequest(userId: number, requestId: number) {
        const request = await this.prisma.friendRequest.findUnique({
            where: { id: requestId },
        });

        if (!request || request.requesterId !== userId) {
            throw new NotFoundException('Заявка не найдена');
        }

        await this.prisma.friendRequest.delete({
            where: { id: requestId },
        });

        return { message: 'Заявка отменена' };
    }

    async removeFriend(userId: number, friendId: number) {
        const friendship = await this.prisma.friendship.findFirst({
            where: {
                OR: [
                    { userAId: userId, userBId: friendId },
                    { userAId: friendId, userBId: userId },
                ],
            },
        });

        if (!friendship) {
            throw new NotFoundException('Дружба не найдена');
        }

        await this.prisma.friendship.delete({
            where: { id: friendship.id },
        });

        return { message: 'Пользователь удален из друзей' };
    }

    async getNotifications(userId: number, page: number = 1, limit: number = 20) {
        const [notifications, total] = await Promise.all([
            this.prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.notification.count({ where: { userId } }),
        ]);

        return {
            notifications,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async markNotificationRead(userId: number, notificationId: number) {
        const notification = await this.prisma.notification.findFirst({
            where: {
                id: notificationId,
                userId,
            },
        });

        if (!notification) {
            throw new NotFoundException('Уведомление не найдено');
        }

        await this.prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true },
        });

        return { message: 'Уведомление отмечено как прочитанное' };
    }

    async markAllNotificationsRead(userId: number) {
        await this.prisma.notification.updateMany({
            where: {
                userId,
                isRead: false,
            },
            data: { isRead: true },
        });

        return { message: 'Все уведомления отмечены как прочитанные' };
    }

    async updateNotificationSettings(
        userId: number,
        settings: Record<string, boolean>,
    ) {
        await this.prisma.notificationSettings.upsert({
            where: { userId },
            create: { userId, ...settings },
            update: settings,
        });

        return { message: 'Настройки уведомлений обновлены' };
    }

    async getFriendsFeed(userId: number, page: number = 1, limit: number = 20) {
        const friendIds = await this.prisma.friendship.findMany({
            where: {
                OR: [{ userAId: userId }, { userBId: userId }],
            },
            select: {
                userAId: true,
                userBId: true,
            },
        });

        const ids = friendIds.map((f) =>
            f.userAId === userId ? f.userBId : f.userAId,
        );

        const [events, total] = await Promise.all([
            this.prisma.feedEvent.findMany({
                where: {
                    subjectId: { in: ids },
                },
                include: {
                    subject: {
                        select: {
                            id: true,
                            login: true,
                            avatarUrl: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.feedEvent.count({
                where: {
                    subjectId: { in: ids },
                },
            }),
        ]);

        return {
            events,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    private extractObjectName(url: string): string | null {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname.substring(1);
        } catch {
            return null;
        }
    }
}