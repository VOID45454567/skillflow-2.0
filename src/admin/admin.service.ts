import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import {
    ModerateUserDto,
    ProcessReportDto,
    ProcessAppealDto,
    ProcessWithdrawalDto,
    CreateTermDto,
} from './dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { UserVerificationStatuses, ActionsTypes, ReportStatus, AppealStatus, WithdrawalStatus } from '@prisma/client';

@Injectable()
export class AdminService {
    constructor(private readonly prisma: PrismaService) { }

    async verifyUser(adminId: number, targetUserId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: targetUserId },
        });

        if (!user) {
            throw new NotFoundException('Пользователь не найден');
        }

        if (user.verificationStatus === UserVerificationStatuses.VERIFIED) {
            throw new BadRequestException('Пользователь уже верифицирован');
        }

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: targetUserId },
                data: { verificationStatus: UserVerificationStatuses.VERIFIED },
            }),
            this.prisma.adminActions.create({
                data: {
                    userId: adminId,
                    targetUserId,
                    actionType: ActionsTypes.VERIFY,
                },
            }),
            this.prisma.notification.create({
                data: {
                    userId: targetUserId,
                    type: 'FRIEND_REQUEST',
                    title: 'Верификация пройдена',
                    body: 'Ваш аккаунт успешно верифицирован',
                },
            }),
        ]);

        return { message: 'Пользователь верифицирован' };
    }

    async rejectVerification(adminId: number, targetUserId: number, dto: ModerateUserDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: targetUserId },
        });

        if (!user) {
            throw new NotFoundException('Пользователь не найден');
        }

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: targetUserId },
                data: { verificationStatus: UserVerificationStatuses.REJECTED },
            }),
            this.prisma.adminActions.create({
                data: {
                    userId: adminId,
                    targetUserId,
                    actionType: ActionsTypes.DENY,
                    reason: dto.reason,
                },
            }),
            this.prisma.notification.create({
                data: {
                    userId: targetUserId,
                    type: 'FRIEND_REQUEST',
                    title: 'Верификация отклонена',
                    body: `Ваша заявка на верификацию отклонена. Причина: ${dto.reason}`,
                },
            }),
        ]);

        return { message: 'Верификация отклонена' };
    }

    async banUser(adminId: number, targetUserId: number, dto: ModerateUserDto) {
        if (adminId === targetUserId) {
            throw new BadRequestException('Нельзя заблокировать самого себя');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: targetUserId },
        });

        if (!user) {
            throw new NotFoundException('Пользователь не найден');
        }

        if (user.role === 'ADMIN') {
            throw new ForbiddenException('Нельзя заблокировать администратора');
        }

        const existingBan = await this.prisma.blockInfo.findFirst({
            where: {
                bannedId: targetUserId,
                appeal: null,
            },
        });

        if (existingBan) {
            throw new BadRequestException('Пользователь уже заблокирован');
        }

        await this.prisma.$transaction([
            this.prisma.blockInfo.create({
                data: {
                    blockReason: dto.reason,
                    bannedId: targetUserId,
                    bannedBy: adminId,
                },
            }),
            this.prisma.adminActions.create({
                data: {
                    userId: adminId,
                    targetUserId,
                    actionType: ActionsTypes.BAN,
                    reason: dto.reason,
                },
            }),
            this.prisma.refreshToken.updateMany({
                where: {
                    userId: targetUserId,
                    isRevoked: false,
                },
                data: { isRevoked: true },
            }),
        ]);

        return { message: 'Пользователь заблокирован' };
    }

    async unbanUser(adminId: number, targetUserId: number) {
        const activeBan = await this.prisma.blockInfo.findFirst({
            where: {
                bannedId: targetUserId,
                appeal: null,
            },
        });

        if (!activeBan) {
            throw new NotFoundException('Активный бан не найден');
        }

        await this.prisma.$transaction([
            this.prisma.blockInfo.delete({
                where: { id: activeBan.id },
            }),
            this.prisma.adminActions.create({
                data: {
                    userId: adminId,
                    targetUserId,
                    actionType: ActionsTypes.UNBAN,
                },
            }),
            this.prisma.notification.create({
                data: {
                    userId: targetUserId,
                    type: 'FRIEND_REQUEST',
                    title: 'Блокировка снята',
                    body: 'Ваша блокировка была снята администратором',
                },
            }),
        ]);

        return { message: 'Блокировка снята' };
    }

    async getUsers(page: number = 1, limit: number = 20, filter?: string) {
        const where: any = {};

        if (filter === 'banned') {
            where.blockInfos = { some: { appeal: null } };
        } else if (filter === 'unverified') {
            where.verificationStatus = UserVerificationStatuses.UNVERIFIED;
        } else if (filter === 'pending') {
            where.verificationStatus = UserVerificationStatuses.PENDING;
        }

        const [users, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                select: {
                    id: true,
                    login: true,
                    email: true,
                    avatarUrl: true,
                    role: true,
                    verificationStatus: true,
                    balance: true,
                    experiencePoints: true,
                    createdAt: true,
                    _count: {
                        select: {
                            courses: true,
                            reviews: true,
                            purchasedCourses: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.user.count({ where }),
        ]);

        return {
            users,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getUserDetails(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                login: true,
                email: true,
                avatarUrl: true,
                role: true,
                verificationStatus: true,
                balance: true,
                experiencePoints: true,
                enabledTwoFactor: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        courses: true,
                        reviews: true,
                        transactions: true,
                        purchasedCourses: true,
                        certificates: true,
                        friendsOf: true,
                        blockInfos: true,
                    },
                },
            },
        });

        if (!user) {
            throw new NotFoundException('Пользователь не найден');
        }

        const activeBan = await this.prisma.blockInfo.findFirst({
            where: {
                bannedId: userId,
                appeal: null,
            },
        });

        return {
            ...user,
            activeBan: activeBan
                ? {
                    reason: activeBan.blockReason,
                    bannedAt: activeBan.createdAt,
                    bannedBy: activeBan.bannedBy,
                }
                : null,
        };
    }

    async getAdminHistory(adminId: number, page: number = 1, limit: number = 50) {
        const [actions, total] = await Promise.all([
            this.prisma.adminActions.findMany({
                include: {
                    admin: {
                        select: {
                            id: true,
                            login: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.adminActions.count(),
        ]);

        return {
            actions,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getReports(page: number = 1, limit: number = 20, status?: ReportStatus) {
        const where: any = {};
        if (status) where.status = status;

        const [reports, total] = await Promise.all([
            this.prisma.report.findMany({
                where,
                include: {
                    reporter: {
                        select: {
                            id: true,
                            login: true,
                            avatarUrl: true,
                        },
                    },
                    course: {
                        select: {
                            id: true,
                            title: true,
                        },
                    },
                    review: {
                        select: {
                            id: true,
                            text: true,
                        },
                    },
                    reportedUser: {
                        select: {
                            id: true,
                            login: true,
                        },
                    },
                },
                orderBy: { createdAt: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.report.count({ where }),
        ]);

        return {
            reports,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getReportDetails(reportId: number) {
        const report = await this.prisma.report.findUnique({
            where: { id: reportId },
            include: {
                reporter: {
                    select: {
                        id: true,
                        login: true,
                        avatarUrl: true,
                    },
                },
                course: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        user: {
                            select: {
                                id: true,
                                login: true,
                            },
                        },
                    },
                },
                review: {
                    select: {
                        id: true,
                        text: true,
                        rating: true,
                        user: {
                            select: {
                                id: true,
                                login: true,
                            },
                        },
                    },
                },
                reportedUser: {
                    select: {
                        id: true,
                        login: true,
                        avatarUrl: true,
                    },
                },
            },
        });

        if (!report) {
            throw new NotFoundException('Жалоба не найдена');
        }

        return report;
    }

    async processReport(adminId: number, reportId: number, dto: ProcessReportDto) {
        const report = await this.prisma.report.findUnique({
            where: { id: reportId },
        });

        if (!report) {
            throw new NotFoundException('Жалоба не найдена');
        }

        if (report.status !== ReportStatus.PENDING) {
            throw new BadRequestException('Жалоба уже обработана');
        }

        await this.prisma.report.update({
            where: { id: reportId },
            data: {
                status: ReportStatus.RESOLVED,
                resolvedBy: adminId,
                resolvedAt: new Date(),
            },
        });

        await this.prisma.notification.create({
            data: {
                userId: report.reporterId,
                type: 'FRIEND_REQUEST',
                title: 'Жалоба рассмотрена',
                body: `Ваша жалоба была рассмотрена. Решение: ${dto.resolution}`,
            },
        });

        return { message: 'Жалоба обработана' };
    }

    async rejectReport(adminId: number, reportId: number) {
        const report = await this.prisma.report.findUnique({
            where: { id: reportId },
        });

        if (!report) {
            throw new NotFoundException('Жалоба не найдена');
        }

        if (report.status !== ReportStatus.PENDING) {
            throw new BadRequestException('Жалоба уже обработана');
        }

        await this.prisma.report.update({
            where: { id: reportId },
            data: {
                status: ReportStatus.REJECTED,
                resolvedBy: adminId,
                resolvedAt: new Date(),
            },
        });

        return { message: 'Жалоба отклонена' };
    }

    async getAppeals(page: number = 1, limit: number = 20) {
        const [appeals, total] = await Promise.all([
            this.prisma.appeal.findMany({
                include: {
                    user: {
                        select: {
                            id: true,
                            login: true,
                            avatarUrl: true,
                        },
                    },
                    banInfo: true,
                },
                orderBy: { createdAt: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.appeal.count({ where: { status: AppealStatus.PENDING } }),
        ]);

        return {
            appeals,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async processAppeal(adminId: number, appealId: number, dto: ProcessAppealDto) {
        const appeal = await this.prisma.appeal.findUnique({
            where: { id: appealId },
            include: { banInfo: true },
        });

        if (!appeal) {
            throw new NotFoundException('Апелляция не найдена');
        }

        if (appeal.status !== AppealStatus.PENDING) {
            throw new BadRequestException('Апелляция уже обработана');
        }

        await this.prisma.$transaction([
            this.prisma.appeal.update({
                where: { id: appealId },
                data: { status: AppealStatus.APPROVED },
            }),
            this.prisma.blockInfo.delete({
                where: { id: appeal.banInfoId },
            }),
            this.prisma.adminActions.create({
                data: {
                    userId: adminId,
                    targetUserId: appeal.userId,
                    actionType: ActionsTypes.UNBAN,
                    reason: dto.resolution,
                },
            }),
            this.prisma.notification.create({
                data: {
                    userId: appeal.userId,
                    type: 'FRIEND_REQUEST',
                    title: 'Апелляция одобрена',
                    body: `Ваша апелляция была одобрена. ${dto.resolution}`,
                },
            }),
        ]);

        return { message: 'Апелляция одобрена, блокировка снята' };
    }

    async rejectAppeal(adminId: number, appealId: number, dto: ProcessAppealDto) {
        const appeal = await this.prisma.appeal.findUnique({
            where: { id: appealId },
        });

        if (!appeal) {
            throw new NotFoundException('Апелляция не найдена');
        }

        if (appeal.status !== AppealStatus.PENDING) {
            throw new BadRequestException('Апелляция уже обработана');
        }

        await this.prisma.$transaction([
            this.prisma.appeal.update({
                where: { id: appealId },
                data: {
                    status: AppealStatus.REJECTED,
                },
            }),
            this.prisma.notification.create({
                data: {
                    userId: appeal.userId,
                    type: 'FRIEND_REQUEST',
                    title: 'Апелляция отклонена',
                    body: `Ваша апелляция была отклонена. ${dto.resolution}`,
                },
            }),
        ]);

        return { message: 'Апелляция отклонена' };
    }

    async getWithdrawals(page: number = 1, limit: number = 20) {
        const [withdrawals, total] = await Promise.all([
            this.prisma.withdrawal.findMany({
                include: {
                    user: {
                        select: {
                            id: true,
                            login: true,
                            email: true,
                        },
                    },
                },
                orderBy: { createdAt: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.withdrawal.count({
                where: { status: WithdrawalStatus.PENDING },
            }),
        ]);

        return {
            withdrawals,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async processWithdrawal(
        adminId: number,
        withdrawalId: number,
        dto: ProcessWithdrawalDto,
    ) {
        const withdrawal = await this.prisma.withdrawal.findUnique({
            where: { id: withdrawalId },
        });

        if (!withdrawal) {
            throw new NotFoundException('Заявка на вывод не найдена');
        }

        if (withdrawal.status !== WithdrawalStatus.PENDING) {
            throw new BadRequestException('Заявка уже обработана');
        }

        if (dto.approved) {
            await this.prisma.withdrawal.update({
                where: { id: withdrawalId },
                data: {
                    status: WithdrawalStatus.COMPLETED,
                    processedBy: adminId,
                    processedAt: new Date(),
                },
            });

            await this.prisma.notification.create({
                data: {
                    userId: withdrawal.userId,
                    type: 'WITHDRAWAL_PROCESSED',
                    title: 'Вывод средств выполнен',
                    body: `Ваша заявка на вывод ${withdrawal.amount} руб. обработана`,
                },
            });

            return { message: 'Вывод средств одобрен' };
        } else {
            await this.prisma.$transaction([
                this.prisma.withdrawal.update({
                    where: { id: withdrawalId },
                    data: {
                        status: WithdrawalStatus.REJECTED,
                        processedBy: adminId,
                        processedAt: new Date(),
                    },
                }),
                this.prisma.user.update({
                    where: { id: withdrawal.userId },
                    data: { balance: { increment: withdrawal.amount } },
                }),
                this.prisma.notification.create({
                    data: {
                        userId: withdrawal.userId,
                        type: 'WITHDRAWAL_PROCESSED',
                        title: 'Вывод средств отклонен',
                        body: `Ваша заявка на вывод ${withdrawal.amount} руб. отклонена. Средства возвращены на баланс.`,
                    },
                }),
            ]);

            return { message: 'Вывод средств отклонен, средства возвращены' };
        }
    }

    async getStats() {
        const [
            totalUsers,
            totalCourses,
            totalRevenue,
            totalTransactions,
            activeBans,
            pendingReports,
            pendingWithdrawals,
        ] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.course.count(),
            this.prisma.transaction.aggregate({
                where: { type: 'PURCHASE' },
                _sum: { price: true },
            }),
            this.prisma.transaction.count(),
            this.prisma.blockInfo.count({
                where: { appeal: null },
            }),
            this.prisma.report.count({
                where: { status: ReportStatus.PENDING },
            }),
            this.prisma.withdrawal.count({
                where: { status: WithdrawalStatus.PENDING },
            }),
        ]);

        return {
            totalUsers,
            totalCourses,
            totalRevenue: totalRevenue._sum.price || 0,
            totalTransactions,
            activeBans,
            pendingReports,
            pendingWithdrawals,
        };
    }

    async createTerm(dto: CreateTermDto) {
        return await this.prisma.term.create({
            data: {
                name: dto.name,
                type: dto.type
            }
        })
    }
}