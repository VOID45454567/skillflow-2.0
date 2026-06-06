import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import {
    CreateCourseDto,
    UpdateCourseDto,
    CreateLessonDto,
    UpdateLessonDto,
    ReorderLessonsDto,
} from './dto';
import { PrismaService } from '../common/prisma/prisma.service';
import { VisibilityTypes } from '../generated/prisma/client';

@Injectable()
export class CourseService {
    constructor(private readonly prisma: PrismaService) { }

    async createCourse(userId: number, dto: CreateCourseDto) {
        if (!dto.isFree && (!dto.price || dto.price <= 0)) {
            throw new BadRequestException('Укажите цену для платного курса');
        }

        if (dto.organizationId) {
            const member = await this.prisma.organizationMember.findUnique({
                where: {
                    organizationId_userId: {
                        organizationId: dto.organizationId,
                        userId,
                    },
                },
            });

            if (!member) {
                throw new ForbiddenException('Вы не состоите в этой организации');
            }
        }

        const course = await this.prisma.course.create({
            data: {
                title: dto.title,
                description: dto.description,
                level: dto.level,
                isFree: dto.isFree,
                price: dto.isFree ? null : dto.price,
                refundEnabled: dto.refundEnabled,
                visibility: VisibilityTypes.DRAFT,
                userId,
                organizationId: dto.organizationId || null,
            },
        });

        if (dto.categoryIds?.length || dto.tagIds?.length) {
            const termIds = [
                ...(dto.categoryIds || []),
                ...(dto.tagIds || []),
            ];

            await this.prisma.courseTerm.createMany({
                data: termIds.map((termId) => ({
                    termId,
                    courseId: course.id,
                })),
            });
        }

        return this.getCourseById(course.id);
    }

    async getCourseById(courseId: number) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            include: {
                user: {
                    select: {
                        id: true,
                        login: true,
                        avatarUrl: true,
                    },
                },
                lessons: {
                    include: {
                        blocks: true,
                    },
                    orderBy: { order: 'asc' },
                },
                courseTerms: {
                    include: {
                        term: true,
                    },
                },
                organization: {
                    select: {
                        id: true,
                        name: true,
                        logo: true,
                    },
                },
                _count: {
                    select: {
                        purchasedCourse: true,
                        reviews: true,
                        userCourseProgresses: true,
                    },
                },
            },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        const reviews = await this.prisma.review.aggregate({
            where: { courseId },
            _avg: { rating: true },
        });

        return {
            ...course,
            averageRating: reviews._avg.rating || 0,
            studentsCount: course._count.userCourseProgresses,
            reviewsCount: course._count.reviews,
        };
    }

    async getPublishedCourseById(courseId: number) {
        const course = await this.prisma.course.findFirst({
            where: {
                id: courseId,
                visibility: { in: [VisibilityTypes.PUBLISHED, VisibilityTypes.ORGANIZATION] },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        login: true,
                        avatarUrl: true,
                    },
                },
                lessons: {
                    where: {
                        isPreview: true,
                    },
                    include: {
                        blocks: true,
                    },
                    orderBy: { order: 'asc' },
                },
                courseTerms: {
                    include: {
                        term: true,
                    },
                },
                organization: {
                    select: {
                        id: true,
                        name: true,
                        logo: true,
                    },
                },
                _count: {
                    select: {
                        purchasedCourse: true,
                        reviews: true,
                    },
                },
            },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        const reviews = await this.prisma.review.aggregate({
            where: { courseId },
            _avg: { rating: true },
        });

        return {
            ...course,
            averageRating: reviews._avg.rating || 0,
            studentsCount: course._count.purchasedCourse,
            reviewsCount: course._count.reviews,
            isPreviewOnly: true,
        };
    }

    async getFullCourseForStudent(userId: number, courseId: number) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        if (course.userId === userId) {
            return this.getCourseById(courseId);
        }

        const hasAccess = await this.checkCourseAccess(userId, courseId);

        if (!hasAccess) {
            throw new ForbiddenException('Нет доступа к курсу');
        }

        const progress = await this.prisma.userCourseProgress.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
        });

        const fullCourse = await this.prisma.course.findUnique({
            where: { id: courseId },
            include: {
                user: {
                    select: {
                        id: true,
                        login: true,
                        avatarUrl: true,
                    },
                },
                lessons: {
                    include: {
                        blocks: true,
                    },
                    orderBy: { order: 'asc' },
                },
                courseTerms: {
                    include: {
                        term: true,
                    },
                },
                organization: {
                    select: {
                        id: true,
                        name: true,
                        logo: true,
                    },
                },
            },
        });

        return {
            ...fullCourse,
            progress: progress
                ? {
                    progress: progress.progress,
                    currentLessonId: progress.currentLessonId,
                    completedLessonsCount: progress.completedLessonsCount,
                    totalLessons: progress.totalLessons,
                    isUpdated: progress.isUpdated,
                }
                : null,
        };
    }

    async updateCourse(userId: number, courseId: number, dto: UpdateCourseDto) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        if (course.userId !== userId) {
            throw new ForbiddenException('Вы не являетесь автором курса');
        }

        if (dto.organizationId) {
            const member = await this.prisma.organizationMember.findUnique({
                where: {
                    organizationId_userId: {
                        organizationId: dto.organizationId,
                        userId,
                    },
                },
            });

            if (!member) {
                throw new ForbiddenException('Вы не состоите в этой организации');
            }
        }

        const updateData: any = {};

        if (dto.title !== undefined) updateData.title = dto.title;
        if (dto.description !== undefined) updateData.description = dto.description;
        if (dto.level !== undefined) updateData.level = dto.level;
        if (dto.isFree !== undefined) {
            updateData.isFree = dto.isFree;
            updateData.price = dto.isFree ? null : dto.price;
        }
        if (dto.price !== undefined && !dto.isFree) updateData.price = dto.price;
        if (dto.refundEnabled !== undefined) updateData.refundEnabled = dto.refundEnabled;
        if (dto.visibility !== undefined) updateData.visibility = dto.visibility;
        if (dto.organizationId !== undefined) updateData.organizationId = dto.organizationId;

        await this.prisma.course.update({
            where: { id: courseId },
            data: updateData,
        });

        if (dto.categoryIds !== undefined || dto.tagIds !== undefined) {
            await this.prisma.courseTerm.deleteMany({
                where: { courseId },
            });

            const termIds = [
                ...(dto.categoryIds || []),
                ...(dto.tagIds || []),
            ];

            if (termIds.length > 0) {
                await this.prisma.courseTerm.createMany({
                    data: termIds.map((termId) => ({
                        termId,
                        courseId,
                    })),
                });
            }
        }

        if (dto.visibility === VisibilityTypes.PUBLISHED) {
            await this.notifyCoursePublished(courseId);
        }

        return this.getCourseById(courseId);
    }

    async deleteCourse(userId: number, courseId: number) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        if (course.userId !== userId) {
            throw new ForbiddenException('Вы не являетесь автором курса');
        }

        await this.prisma.course.delete({
            where: { id: courseId },
        });

        return { message: 'Курс удален' };
    }

    async publishCourse(userId: number, courseId: number) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            include: {
                lessons: true,
            },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        if (course.userId !== userId) {
            throw new ForbiddenException('Вы не являетесь автором курса');
        }

        if (course.lessons.length === 0) {
            throw new BadRequestException('Добавьте хотя бы один урок перед публикацией');
        }

        await this.prisma.course.update({
            where: { id: courseId },
            data: { visibility: VisibilityTypes.PUBLISHED },
        });

        await this.notifyCoursePublished(courseId);

        return this.getCourseById(courseId);
    }

    async getMyCourses(userId: number) {
        return this.prisma.course.findMany({
            where: { userId },
            include: {
                _count: {
                    select: {
                        lessons: true,
                        purchasedCourse: true,
                        reviews: true,
                    },
                },
                courseTerms: {
                    select: {
                        term: {
                            select: {
                                name: true,
                                type: true
                            }
                        }
                    }
                }
            },
            orderBy: { updatedAt: 'desc' },
        });
    }

    async createLesson(userId: number, courseId: number, dto: CreateLessonDto) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        if (course.userId !== userId) {
            throw new ForbiddenException('Вы не являетесь автором курса');
        }

        const maxOrder = await this.prisma.lesson.aggregate({
            where: { courseId },
            _max: { order: true },
        });

        const lesson = await this.prisma.lesson.create({
            data: {
                title: dto.title,
                requredTime: dto.requredTime,
                goals: dto.goals || [],
                isPreview: dto.isPreview || false,
                order: (maxOrder._max.order || 0) + 1,
                courseId,
                blocks: {
                    create: dto.blocks.map((block) => ({
                        type: block.type,
                        content: block.content,
                        order: block.order,
                    })),
                },
            },
            include: {
                blocks: true,
            },
        });

        await this.notifyCourseUpdated(courseId);

        return lesson;
    }

    async updateLesson(
        userId: number,
        courseId: number,
        lessonId: number,
        dto: UpdateLessonDto,
    ) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        if (course.userId !== userId) {
            throw new ForbiddenException('Вы не являетесь автором курса');
        }

        const lesson = await this.prisma.lesson.findFirst({
            where: { id: lessonId, courseId },
        });

        if (!lesson) {
            throw new NotFoundException('Урок не найден');
        }

        const updateData: any = {};

        if (dto.title !== undefined) updateData.title = dto.title;
        if (dto.requredTime !== undefined) updateData.requredTime = dto.requredTime;
        if (dto.goals !== undefined) updateData.goals = dto.goals;
        if (dto.isPreview !== undefined) updateData.isPreview = dto.isPreview;

        await this.prisma.lesson.update({
            where: { id: lessonId },
            data: updateData,
        });

        if (dto.blocks) {
            await this.prisma.lessonBlock.deleteMany({
                where: { lessonId },
            });

            await this.prisma.lessonBlock.createMany({
                data: dto.blocks.map((block) => ({
                    lessonId,
                    type: block.type,
                    content: block.content,
                    order: block.order,
                })),
            });
        }

        await this.notifyCourseUpdated(courseId);

        return this.prisma.lesson.findUnique({
            where: { id: lessonId },
            include: { blocks: true },
        });
    }

    async deleteLesson(userId: number, courseId: number, lessonId: number) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        if (course.userId !== userId) {
            throw new ForbiddenException('Вы не являетесь автором курса');
        }

        const lesson = await this.prisma.lesson.findFirst({
            where: { id: lessonId, courseId },
        });

        if (!lesson) {
            throw new NotFoundException('Урок не найден');
        }

        await this.prisma.lesson.delete({
            where: { id: lessonId },
        });

        await this.reorderRemainingLessons(courseId);
        await this.notifyCourseUpdated(courseId);

        return { message: 'Урок удален' };
    }

    async reorderLessons(
        userId: number,
        courseId: number,
        dto: ReorderLessonsDto,
    ) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        if (course.userId !== userId) {
            throw new ForbiddenException('Вы не являетесь автором курса');
        }

        await this.prisma.$transaction(
            dto.lessons.map((lesson) =>
                this.prisma.lesson.update({
                    where: { id: lesson.id },
                    data: { order: lesson.order },
                }),
            ),
        );

        return this.prisma.lesson.findMany({
            where: { courseId },
            orderBy: { order: 'asc' },
        });
    }

    async getCourseStats(userId: number, courseId: number) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        if (course.userId !== userId) {
            throw new ForbiddenException('Вы не являетесь автором курса');
        }

        const [totalStudents, completedStudents, totalRevenue] = await Promise.all([
            this.prisma.userCourseProgress.count({ where: { courseId } }),
            this.prisma.userCourseProgress.count({
                where: {
                    courseId,
                    completedAt: { not: null },
                },
            }),
            this.prisma.transaction.aggregate({
                where: {
                    courseId,
                    type: { in: ['PURCHASE', 'SUBSCRIPTION'] },
                },
                _sum: { price: true },
            }),
        ]);

        return {
            totalStudents,
            completedStudents,
            completionRate: totalStudents > 0 ? (completedStudents / totalStudents) * 100 : 0,
            totalRevenue: totalRevenue._sum.price || 0,
        };
    }

    private async checkCourseAccess(userId: number, courseId: number): Promise<boolean> {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });

        if (!course) return false;
        if (course.isFree) return true;

        const purchased = await this.prisma.purchasedCourse.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
        });

        if (purchased) return true;

        if (course.organizationId) {
            const member = await this.prisma.organizationMember.findUnique({
                where: {
                    organizationId_userId: {
                        organizationId: course.organizationId,
                        userId,
                    },
                },
            });

            if (member) return true;
        }

        const authorSubscription = await this.prisma.authorSubscription.findFirst({
            where: {
                userId,
                authorId: course.userId,
                activeUntil: { gt: new Date() },
            },
        });

        if (authorSubscription) return true;

        const orgSubscription = await this.prisma.organizationSubscription.findFirst({
            where: {
                userId,
                organizationId: course.organizationId || 0,
                activeUntil: { gt: new Date() },
            },
        });

        if (orgSubscription) return true;

        return false;
    }

    private async reorderRemainingLessons(courseId: number) {
        const lessons = await this.prisma.lesson.findMany({
            where: { courseId },
            orderBy: { order: 'asc' },
        });

        await this.prisma.$transaction(
            lessons.map((lesson, index) =>
                this.prisma.lesson.update({
                    where: { id: lesson.id },
                    data: { order: index + 1 },
                }),
            ),
        );
    }

    private async notifyCourseUpdated(courseId: number) {
        const students = await this.prisma.userCourseProgress.findMany({
            where: { courseId },
            select: { userId: true },
        });

        if (students.length === 0) return;

        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            select: { title: true },
        });

        await this.prisma.$transaction(
            students.map((student) =>
                this.prisma.userCourseProgress.updateMany({
                    where: {
                        userId: student.userId,
                        courseId,
                    },
                    data: { isUpdated: true },
                }),
            ),
        );

        await this.prisma.notification.createMany({
            data: students.map((student) => ({
                userId: student.userId,
                type: 'COURSE_UPDATED',
                title: 'Курс обновлен',
                body: `Курс "${course!.title}" был обновлен автором`,
                data: { courseId },
            })),
        });
    }

    private async notifyCoursePublished(courseId: number) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            include: {
                user: {
                    select: {
                        subscribers: {
                            select: { userId: true },
                        },
                    },
                },
            },
        });

        if (!course || course.user.subscribers.length === 0) return;

        await this.prisma.notification.createMany({
            data: course.user.subscribers.map((sub) => ({
                userId: sub.userId,
                type: 'NEW_COURSE_BY_AUTHOR',
                title: 'Новый курс от автора',
                body: `Автор выпустил новый курс "${course.title}"`,
                data: { courseId },
            })),
        });
    }
}