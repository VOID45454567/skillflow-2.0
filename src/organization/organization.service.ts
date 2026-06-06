import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
    CreateOrganizationDto,
    UpdateOrganizationDto,
    JoinOrganizationDto,
    SetMandatoryDto,
    UpdateSubscriptionDto,
} from './dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { MinioService } from '../common/minio/minio.service';
import { MembershipRequestStatus, OrganizationRole } from '../generated/prisma/enums';

@Injectable()
export class OrganizationService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly minioService: MinioService,
    ) { }

    async createOrganization(userId: number, dto: CreateOrganizationDto) {
        const inviteCode = crypto.randomBytes(8).toString('hex');

        const organization = await this.prisma.organization.create({
            data: {
                name: dto.name,
                description: dto.description,
                type: dto.type,
                visibility: dto.visibility,
                maxMembers: dto.maxMembers || null,
                inviteCode,
                userId,
            },
        });

        await this.prisma.organizationMember.create({
            data: {
                organizationId: organization.id,
                userId,
                role: OrganizationRole.OWNER,
            },
        });

        return organization;
    }

    async getOrganization(organizationId: number) {
        const organization = await this.prisma.organization.findUnique({
            where: { id: organizationId },
            include: {
                owner: {
                    select: {
                        id: true,
                        login: true,
                        avatarUrl: true,
                    },
                },
                _count: {
                    select: {
                        organizationMembers: true,
                        courses: true,
                    },
                },
            },
        });

        if (!organization) {
            throw new NotFoundException('Организация не найдена');
        }

        return {
            ...organization,
            membersCount: organization._count.organizationMembers,
            coursesCount: organization._count.courses,
        };
    }

    async getMyOrganizations(userId: number) {
        const memberships = await this.prisma.organizationMember.findMany({
            where: { userId },
            include: {
                organization: {
                    include: {
                        _count: {
                            select: {
                                organizationMembers: true,
                                courses: true,
                            },
                        },
                    },
                },
            },
        });

        return memberships.map((membership) => ({
            id: membership.organization.id,
            name: membership.organization.name,
            logo: membership.organization.logo,
            type: membership.organization.type,
            role: membership.role,
            membersCount: membership.organization._count.organizationMembers,
            coursesCount: membership.organization._count.courses,
            joinedAt: membership.joinedAt,
        }));
    }

    async updateOrganization(
        userId: number,
        organizationId: number,
        dto: UpdateOrganizationDto,
    ) {
        await this.checkAdminAccess(userId, organizationId);

        return this.prisma.organization.update({
            where: { id: organizationId },
            data: {
                ...(dto.name && { name: dto.name }),
                ...(dto.description && { description: dto.description }),
                ...(dto.type && { type: dto.type }),
                ...(dto.visibility && { visibility: dto.visibility }),
                ...(dto.maxMembers !== undefined && { maxMembers: dto.maxMembers }),
            },
        });
    }

    async deleteOrganization(userId: number, organizationId: number) {
        const membership = await this.prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: { organizationId, userId },
            },
        });

        if (!membership || membership.role !== OrganizationRole.OWNER) {
            throw new ForbiddenException('Только владелец может удалить организацию');
        }

        await this.prisma.organization.delete({
            where: { id: organizationId },
        });

        return { message: 'Организация удалена' };
    }

    async uploadLogo(userId: number, organizationId: number, file: any) {
        await this.checkAdminAccess(userId, organizationId);

        const organization = await this.prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (organization.logo) {
            const oldObjectName = this.extractObjectName(organization.logo);
            if (oldObjectName) {
                await this.minioService.deleteFile(oldObjectName).catch(() => { });
            }
        }

        const objectName = this.minioService.generateObjectName(
            'organizations',
            file.originalname,
        );
        const url = await this.minioService.uploadFile(
            objectName,
            file.buffer,
            file.mimetype,
        );

        await this.prisma.organization.update({
            where: { id: organizationId },
            data: { logo: url },
        });

        return { logoUrl: url };
    }

    async regenerateInviteCode(userId: number, organizationId: number) {
        await this.checkAdminAccess(userId, organizationId);

        const inviteCode = crypto.randomBytes(8).toString('hex');

        await this.prisma.organization.update({
            where: { id: organizationId },
            data: { inviteCode },
        });

        return { inviteCode };
    }

    async joinByInviteCode(userId: number, dto: JoinOrganizationDto) {
        const organization = await this.prisma.organization.findUnique({
            where: { inviteCode: dto.inviteCode },
        });

        if (!organization) {
            throw new NotFoundException('Неверный код приглашения');
        }

        const existingMembership = await this.prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId: organization.id,
                    userId,
                },
            },
        });

        if (existingMembership) {
            throw new ConflictException('Вы уже состоите в этой организации');
        }

        if (organization.maxMembers) {
            const membersCount = await this.prisma.organizationMember.count({
                where: { organizationId: organization.id },
            });

            if (membersCount >= organization.maxMembers) {
                throw new BadRequestException('Достигнут лимит участников');
            }
        }

        await this.prisma.organizationMember.create({
            data: {
                organizationId: organization.id,
                userId,
                role: OrganizationRole.MEMBER,
            },
        });

        await this.prisma.notification.create({
            data: {
                userId: organization.userId,
                type: 'ORGANIZATION_MEMBER_JOINED',
                title: 'Новый участник',
                body: `Новый пользователь присоединился к организации "${organization.name}"`,
                data: { organizationId: organization.id, newMemberId: userId },
            },
        });

        return { message: `Вы присоединились к организации "${organization.name}"` };
    }

    async requestToJoin(userId: number, organizationId: number) {
        const organization = await this.prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (!organization) {
            throw new NotFoundException('Организация не найдена');
        }

        if (organization.visibility !== 'PUBLIC') {
            throw new BadRequestException('Организация приватная, требуется код приглашения');
        }

        const existingRequest = await this.prisma.membershipRequest.findUnique({
            where: {
                organizationId_userId: { organizationId, userId },
            },
        });

        if (existingRequest) {
            throw new ConflictException('Заявка уже отправлена');
        }

        const existingMembership = await this.prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: { organizationId, userId },
            },
        });

        if (existingMembership) {
            throw new ConflictException('Вы уже состоите в этой организации');
        }

        await this.prisma.membershipRequest.create({
            data: {
                organizationId,
                userId,
            },
        });

        const admins = await this.prisma.organizationMember.findMany({
            where: {
                organizationId,
                role: { in: [OrganizationRole.OWNER, OrganizationRole.ADMIN] },
            },
        });

        await this.prisma.notification.createMany({
            data: admins.map((admin) => ({
                userId: admin.userId,
                type: 'ORGANIZATION_INVITE',
                title: 'Новая заявка',
                body: `Пользователь хочет вступить в организацию "${organization.name}"`,
                data: { organizationId, requesterId: userId },
            })),
        });

        return { message: 'Заявка отправлена' };
    }

    async approveRequest(userId: number, organizationId: number, requesterId: number) {
        await this.checkAdminAccess(userId, organizationId);

        const request = await this.prisma.membershipRequest.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: requesterId,
                },
            },
        });

        if (!request) {
            throw new NotFoundException('Заявка не найдена');
        }

        if (request.status !== MembershipRequestStatus.PENDING) {
            throw new BadRequestException('Заявка уже обработана');
        }

        const organization = await this.prisma.organization.findUnique({
            where: { id: organizationId },
        });

        if (organization.maxMembers) {
            const membersCount = await this.prisma.organizationMember.count({
                where: { organizationId },
            });

            if (membersCount >= organization.maxMembers) {
                throw new BadRequestException('Достигнут лимит участников');
            }
        }

        await this.prisma.$transaction([
            this.prisma.membershipRequest.update({
                where: { id: request.id },
                data: { status: MembershipRequestStatus.APPROVED },
            }),
            this.prisma.organizationMember.create({
                data: {
                    organizationId,
                    userId: requesterId,
                    role: OrganizationRole.MEMBER,
                },
            }),
            this.prisma.notification.create({
                data: {
                    userId: requesterId,
                    type: 'ORGANIZATION_REQUEST_APPROVED',
                    title: 'Заявка одобрена',
                    body: `Ваша заявка на вступление в "${organization.name}" одобрена`,
                    data: { organizationId },
                },
            }),
        ]);

        return { message: 'Заявка одобрена' };
    }

    async rejectRequest(userId: number, organizationId: number, requesterId: number) {
        await this.checkAdminAccess(userId, organizationId);

        const request = await this.prisma.membershipRequest.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: requesterId,
                },
            },
        });

        if (!request) {
            throw new NotFoundException('Заявка не найдена');
        }

        await this.prisma.$transaction([
            this.prisma.membershipRequest.update({
                where: { id: request.id },
                data: { status: MembershipRequestStatus.REJECTED },
            }),
            this.prisma.notification.create({
                data: {
                    userId: requesterId,
                    type: 'ORGANIZATION_REQUEST_REJECTED',
                    title: 'Заявка отклонена',
                    body: `Ваша заявка на вступление в организацию отклонена`,
                    data: { organizationId },
                },
            }),
        ]);

        return { message: 'Заявка отклонена' };
    }

    async getPendingRequests(userId: number, organizationId: number) {
        await this.checkAdminAccess(userId, organizationId);

        return this.prisma.membershipRequest.findMany({
            where: {
                organizationId,
                status: MembershipRequestStatus.PENDING,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        login: true,
                        avatarUrl: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    async getMembers(organizationId: number) {
        return this.prisma.organizationMember.findMany({
            where: { organizationId },
            include: {
                user: {
                    select: {
                        id: true,
                        login: true,
                        avatarUrl: true,
                        experiencePoints: true,
                    },
                },
            },
            orderBy: { joinedAt: 'asc' },
        });
    }

    async promoteToAdmin(userId: number, organizationId: number, memberId: number) {
        await this.checkOwnerAccess(userId, organizationId);

        const member = await this.prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: memberId,
                },
            },
        });

        if (!member) {
            throw new NotFoundException('Участник не найден');
        }

        if (member.role === OrganizationRole.OWNER) {
            throw new BadRequestException('Нельзя изменить роль владельца');
        }

        await this.prisma.organizationMember.update({
            where: { id: member.id },
            data: { role: OrganizationRole.ADMIN },
        });

        return { message: 'Участник назначен администратором' };
    }

    async demoteFromAdmin(userId: number, organizationId: number, memberId: number) {
        await this.checkOwnerAccess(userId, organizationId);

        const member = await this.prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: memberId,
                },
            },
        });

        if (!member) {
            throw new NotFoundException('Участник не найден');
        }

        if (member.role === OrganizationRole.OWNER) {
            throw new BadRequestException('Нельзя понизить владельца');
        }

        await this.prisma.organizationMember.update({
            where: { id: member.id },
            data: { role: OrganizationRole.MEMBER },
        });

        return { message: 'Администратор понижен до участника' };
    }

    async removeMember(userId: number, organizationId: number, memberId: number) {
        await this.checkAdminAccess(userId, organizationId);

        if (userId === memberId) {
            throw new BadRequestException('Используйте выход из организации');
        }

        const member = await this.prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId: memberId,
                },
            },
        });

        if (!member) {
            throw new NotFoundException('Участник не найден');
        }

        if (member.role === OrganizationRole.OWNER) {
            throw new BadRequestException('Нельзя удалить владельца');
        }

        await this.prisma.organizationMember.delete({
            where: { id: member.id },
        });

        return { message: 'Участник удален' };
    }

    async leaveOrganization(userId: number, organizationId: number) {
        const member = await this.prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId,
                },
            },
        });

        if (!member) {
            throw new NotFoundException('Вы не состоите в этой организации');
        }

        if (member.role === OrganizationRole.OWNER) {
            throw new BadRequestException(
                'Владелец не может покинуть организацию. Передайте права или удалите организацию.',
            );
        }

        await this.prisma.organizationMember.delete({
            where: { id: member.id },
        });

        return { message: 'Вы покинули организацию' };
    }

    async getOrganizationCourses(organizationId: number, userId: number) {
        const member = await this.prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: { organizationId, userId },
            },
        });

        if (!member) {
            throw new ForbiddenException('Вы не состоите в этой организации');
        }

        return this.prisma.course.findMany({
            where: {
                organizationId,
                visibility: 'ORGANIZATION',
            },
            include: {
                user: {
                    select: {
                        id: true,
                        login: true,
                        avatarUrl: true,
                    },
                },
                _count: {
                    select: {
                        lessons: true,
                        userCourseProgresses: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async setMandatoryCourse(userId: number, organizationId: number, dto: SetMandatoryDto) {
        await this.checkAdminAccess(userId, organizationId);

        const course = await this.prisma.course.findFirst({
            where: {
                id: dto.courseId,
                organizationId,
                visibility: 'ORGANIZATION',
            },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден в организации');
        }

        await this.prisma.course.update({
            where: { id: dto.courseId },
            data: { isMandatory: true },
        });

        const members = await this.prisma.organizationMember.findMany({
            where: { organizationId },
        });

        await this.prisma.notification.createMany({
            data: members.map((m) => ({
                userId: m.userId,
                type: 'COURSE_UPDATED',
                title: 'Обязательный курс',
                body: `Курс "${course.title}" назначен обязательным`,
                data: { courseId: course.id },
            })),
        });

        return { message: 'Курс назначен обязательным' };
    }

    async unsetMandatoryCourse(userId: number, organizationId: number, dto: SetMandatoryDto) {
        await this.checkAdminAccess(userId, organizationId);

        await this.prisma.course.updateMany({
            where: {
                id: dto.courseId,
                organizationId,
            },
            data: { isMandatory: false },
        });

        return { message: 'Обязательность курса снята' };
    }

    async getDashboard(userId: number, organizationId: number) {
        await this.checkAdminAccess(userId, organizationId);

        const organization = await this.prisma.organization.findUnique({
            where: { id: organizationId },
            include: {
                _count: {
                    select: {
                        organizationMembers: true,
                        courses: true,
                    },
                },
            },
        });

        const mandatoryCourses = await this.prisma.course.findMany({
            where: {
                organizationId,
                isMandatory: true,
            },
            select: {
                id: true,
                title: true,
                _count: {
                    select: {
                        userCourseProgresses: true,
                    },
                },
            },
        });

        const membersWithProgress = await this.prisma.organizationMember.findMany({
            where: { organizationId },
            include: {
                user: {
                    select: {
                        id: true,
                        login: true,
                        avatarUrl: true,
                        userCourseProgresses: {
                            where: {
                                course: {
                                    organizationId,
                                    isMandatory: true,
                                },
                            },
                            select: {
                                progress: true,
                                completedAt: true,
                                courseId: true,
                            },
                        },
                    },
                },
            },
        });

        const totalLearningHours = await this.prisma.userCourseProgress.aggregate({
            where: {
                course: {
                    organizationId,
                },
            },
            _sum: {
                completedLessonsCount: true,
            },
        });

        return {
            organization: {
                name: organization.name,
                membersCount: organization._count.organizationMembers,
                coursesCount: organization._count.courses,
            },
            mandatoryCourses: mandatoryCourses.map((course) => ({
                id: course.id,
                title: course.title,
                studentsCount: course._count.userCourseProgresses,
            })),
            members: membersWithProgress.map((m) => ({
                id: m.user.id,
                login: m.user.login,
                avatarUrl: m.user.avatarUrl,
                progress: m.user.userCourseProgresses,
            })),
            totalLearningHours: Math.round(
                ((totalLearningHours._sum?.completedLessonsCount || 0) * 20) / 60,
            ),
        };
    }

    async exportReport(userId: number, organizationId: number) {
        await this.checkAdminAccess(userId, organizationId);

        const data = await this.getDashboard(userId, organizationId);

        return {
            ...data,
            exportedAt: new Date().toISOString(),
            format: 'json',
        };
    }

    async createSubscription(userId: number, organizationId: number, dto: UpdateSubscriptionDto) {
        const existing = await this.prisma.organizationSubscription.findUnique({
            where: {
                organizationId_userId: { organizationId, userId },
            },
        });

        if (existing && existing.activeUntil > new Date()) {
            throw new BadRequestException('У вас уже есть активная подписка');
        }

        const activeUntil = new Date();
        activeUntil.setMonth(activeUntil.getMonth() + 1);

        const subscription = await this.prisma.organizationSubscription.upsert({
            where: {
                organizationId_userId: { organizationId, userId },
            },
            create: {
                organizationId,
                userId,
                activeUntil,
                licenseCount: dto.licenseCount,
            },
            update: {
                activeUntil,
                licenseCount: dto.licenseCount,
                autoRenew: true,
            },
        });

        return subscription;
    }

    async cancelSubscription(userId: number, organizationId: number) {
        const subscription = await this.prisma.organizationSubscription.findUnique({
            where: {
                organizationId_userId: { organizationId, userId },
            },
        });

        if (!subscription) {
            throw new NotFoundException('Подписка не найдена');
        }

        await this.prisma.organizationSubscription.update({
            where: { id: subscription.id },
            data: { autoRenew: false },
        });

        return { message: 'Автопродление отключено' };
    }

    async getSubscriptionStatus(userId: number, organizationId: number) {
        const subscription = await this.prisma.organizationSubscription.findUnique({
            where: {
                organizationId_userId: { organizationId, userId },
            },
        });

        if (!subscription) {
            return { hasSubscription: false };
        }

        return {
            hasSubscription: true,
            activeUntil: subscription.activeUntil,
            licenseCount: subscription.licenseCount,
            autoRenew: subscription.autoRenew,
            isActive: subscription.activeUntil > new Date(),
        };
    }

    private async checkAdminAccess(userId: number, organizationId: number) {
        const member = await this.prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: { organizationId, userId },
            },
        });

        if (!member) {
            throw new ForbiddenException('Вы не состоите в этой организации');
        }

        if (member.role !== OrganizationRole.OWNER && member.role !== OrganizationRole.ADMIN) {
            throw new ForbiddenException('Требуются права администратора');
        }
    }

    private async checkOwnerAccess(userId: number, organizationId: number) {
        const member = await this.prisma.organizationMember.findUnique({
            where: {
                organizationId_userId: { organizationId, userId },
            },
        });

        if (!member || member.role !== OrganizationRole.OWNER) {
            throw new ForbiddenException('Требуются права владельца');
        }
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