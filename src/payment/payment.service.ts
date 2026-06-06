import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { CreatePaymentDto, CreateWithdrawalDto } from './dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { WithdrawalStatus } from '../generated/prisma/enums';

@Injectable()
export class PaymentService {
    constructor(private readonly prisma: PrismaService) { }

    async createPayment(userId: number, dto: CreatePaymentDto) {
        const payment = await this.prisma.payment.create({
            data: {
                userId,
                method: dto.method,
                count: dto.amount,
                status: 'completed',
            },
        });

        await this.prisma.user.update({
            where: { id: userId },
            data: { balance: { increment: dto.amount } },
        });

        return {
            message: `Баланс пополнен на ${dto.amount} руб.`,
            balance: (await this.getBalance(userId)).balance,
            paymentId: payment.id,
        };
    }

    async getBalance(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { balance: true, id: true },
        });

        return { balance: user.balance, userId: user.id };
    }

    async getTransactions(
        userId: number,
        page: number = 1,
        limit: number = 20,
    ) {
        const [transactions, total] = await Promise.all([
            this.prisma.transaction.findMany({
                where: {
                    OR: [
                        { userId },
                        { giftToId: userId },
                    ],
                },
                include: {
                    course: {
                        select: {
                            id: true,
                            title: true,
                        },
                    },
                    giftTo: {
                        select: {
                            id: true,
                            login: true,
                        },
                    },
                    user: {
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
            this.prisma.transaction.count({
                where: {
                    OR: [
                        { userId },
                        { giftToId: userId },
                    ],
                },
            }),
        ]);

        return {
            transactions,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getPaymentHistory(userId: number, page: number = 1, limit: number = 20) {
        const [payments, total] = await Promise.all([
            this.prisma.payment.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.payment.count({ where: { userId } }),
        ]);

        return {
            payments,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async requestRefund(userId: number, courseId: number) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        if (!course.refundEnabled) {
            throw new BadRequestException('Возврат для этого курса недоступен');
        }

        const purchase = await this.prisma.transaction.findFirst({
            where: {
                userId,
                courseId,
                type: 'PURCHASE',
            },
        });

        if (!purchase) {
            throw new BadRequestException('Покупка не найдена');
        }

        const hoursSincePurchase =
            (Date.now() - purchase.createdAt.getTime()) / (1000 * 60 * 60);

        if (hoursSincePurchase > 48) {
            throw new BadRequestException('Возврат возможен только в течение 48 часов');
        }

        const progress = await this.prisma.userCourseProgress.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
        });

        if (progress && progress.completedLessonsCount > 2) {
            throw new BadRequestException('Возврат невозможен: пройдено более 2 уроков');
        }

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: userId },
                data: { balance: { increment: purchase.price } },
            }),
            this.prisma.transaction.create({
                data: {
                    userId,
                    courseId,
                    type: 'REFUND',
                    price: purchase.price,
                },
            }),
            this.prisma.purchasedCourse.deleteMany({
                where: {
                    userId,
                    courseId,
                },
            }),
            this.prisma.userCourseProgress.deleteMany({
                where: {
                    userId,
                    courseId,
                },
            }),
        ]);

        return { message: `Возврат на сумму ${purchase.price} руб. выполнен` };
    }

    async createWithdrawal(userId: number, dto: CreateWithdrawalDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (user.balance < dto.amount) {
            throw new BadRequestException('Недостаточно средств на балансе');
        }

        if (dto.amount < 100) {
            throw new BadRequestException('Минимальная сумма вывода: 100 руб.');
        }

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: userId },
                data: { balance: { decrement: dto.amount } },
            }),
            this.prisma.withdrawal.create({
                data: {
                    userId,
                    amount: dto.amount,
                    method: dto.method,
                    account: dto.account,
                    status: WithdrawalStatus.PENDING,
                },
            }),
        ]);

        return { message: `Заявка на вывод ${dto.amount} руб. создана` };
    }

    async getWithdrawals(userId: number) {
        return this.prisma.withdrawal.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getReferralInfo(userId: number) {
        const referralCount = await this.prisma.referral.count({
            where: { referrerId: userId },
        });

        const referralEarnings = await this.prisma.transaction.aggregate({
            where: {
                userId,
                type: 'REFERRAL_BONUS',
            },
            _sum: { price: true },
        });

        return {
            referralCount,
            totalEarnings: referralEarnings._sum.price || 0,
        };
    }

    async getReferralHistory(userId: number, page: number = 1, limit: number = 20) {
        const [referrals, total] = await Promise.all([
            this.prisma.referral.findMany({
                where: { referrerId: userId },
                include: {
                    referred: {
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
            this.prisma.referral.count({ where: { referrerId: userId } }),
        ]);

        return {
            referrals,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }
}