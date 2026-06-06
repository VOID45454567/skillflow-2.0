import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { SearchCoursesDto, SubmitQuizDto } from './dto';
import { VisibilityTypes } from '../generated/prisma/enums';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class CatalogService {
    constructor(private readonly prisma: PrismaService) { }

    async searchCourses(dto: SearchCoursesDto) {
        const where: any = {
            visibility: VisibilityTypes.PUBLISHED,
        };

        if (dto.query) {
            where.OR = [
                { title: { contains: dto.query, mode: 'insensitive' } },
                { description: { contains: dto.query, mode: 'insensitive' } },
            ];
        }

        if (dto.categoryId || dto.tagId) {
            where.courseTerms = {
                some: {
                    termId: dto.categoryId || dto.tagId,
                },
            };
        }

        if (dto.level) {
            where.level = dto.level;
        }

        if (dto.price === 'free') {
            where.isFree = true;
        } else if (dto.price === 'paid') {
            where.isFree = false;
        }

        let orderBy: any = { createdAt: 'desc' };

        switch (dto.sortBy) {
            case 'popular':
                orderBy = { purchasedCourse: { _count: 'desc' } };
                break;
            case 'rating':
                orderBy = { reviews: { _count: 'desc' } };
                break;
            case 'newest':
                orderBy = { createdAt: 'desc' };
                break;
            case 'price_asc':
                orderBy = { price: 'asc' };
                break;
            case 'price_desc':
                orderBy = { price: 'desc' };
                break;
        }

        const [courses, total] = await Promise.all([
            this.prisma.course.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            login: true,
                            avatarUrl: true,
                        },
                    },
                    courseTerms: {
                        include: {
                            term: true,
                        },
                    },
                    _count: {
                        select: {
                            purchasedCourse: true,
                            reviews: true,
                            lessons: true,
                        },
                    },
                },
                orderBy,
                skip: ((dto.page || 1) - 1) * (dto.limit || 20),
                take: dto.limit || 20,
            }),
            this.prisma.course.count({ where }),
        ]);

        const coursesWithRating = await Promise.all(
            courses.map(async (course) => {
                const rating = await this.prisma.review.aggregate({
                    where: { courseId: course.id },
                    _avg: { rating: true },
                });

                const { _count, ...courseData } = course;

                return {
                    ...courseData,
                    studentsCount: _count.purchasedCourse,
                    reviewsCount: _count.reviews,
                    lessonsCount: _count.lessons,
                    averageRating: rating._avg.rating || 0,
                };
            }),
        );

        return {
            courses: coursesWithRating,
            total,
            page: dto.page || 1,
            totalPages: Math.ceil(total / (dto.limit || 20)),
        };
    }

    async getRecommendedCourses(userId: number) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                preferredCategoryIds: true,
                preferredTagIds: true,
            },
        });

        const preferredTermIds = [
            ...(user.preferredCategoryIds || []),
            ...(user.preferredTagIds || []),
        ];

        if (preferredTermIds.length === 0) {
            return this.searchCourses({ sortBy: 'popular', limit: 10 });
        }

        const courses = await this.prisma.course.findMany({
            where: {
                visibility: VisibilityTypes.PUBLISHED,
                courseTerms: {
                    some: {
                        termId: { in: preferredTermIds },
                    },
                },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        login: true,
                        avatarUrl: true,
                    },
                },
                courseTerms: {
                    include: {
                        term: true,
                    },
                },
                _count: {
                    select: {
                        purchasedCourse: true,
                        reviews: true,
                    },
                },
            },
            take: 20,
            orderBy: { purchasedCourse: { _count: 'desc' } },
        });

        const completedCourseIds = await this.prisma.userCourseProgress.findMany({
            where: {
                userId,
                completedAt: { not: null },
            },
            select: { courseId: true },
        });

        const completedIds = new Set(completedCourseIds.map((c) => c.courseId));

        const filtered = courses.filter((c) => !completedIds.has(c.id));

        const coursesWithRating = await Promise.all(
            filtered.map(async (course) => {
                const rating = await this.prisma.review.aggregate({
                    where: { courseId: course.id },
                    _avg: { rating: true },
                });

                const { _count, ...courseData } = course;

                return {
                    ...courseData,
                    studentsCount: _count.purchasedCourse,
                    reviewsCount: _count.reviews,
                    averageRating: rating._avg.rating || 0,
                };
            }),
        );

        return { courses: coursesWithRating };
    }

    async getTerms(type: 'CATEGORY' | 'TAG') {
        return this.prisma.term.findMany({
            where: { type },
            orderBy: { name: 'asc' },
        });
    }

    async startCourse(userId: number, courseId: number) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            include: {
                lessons: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        if (course.visibility === VisibilityTypes.DRAFT) {
            throw new BadRequestException('Курс недоступен');
        }

        if (course.visibility === VisibilityTypes.ORGANIZATION && course.organizationId) {
            const member = await this.prisma.organizationMember.findUnique({
                where: {
                    organizationId_userId: {
                        organizationId: course.organizationId,
                        userId,
                    },
                },
            });

            if (!member) {
                throw new ForbiddenException('Курс доступен только членам организации');
            }
        }

        const existingProgress = await this.prisma.userCourseProgress.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
        });

        if (existingProgress) {
            return existingProgress;
        }

        const snapshotLessonIds = course.lessons.map((l) => l.id);
        const firstLesson = course.lessons[0];

        const progress = await this.prisma.userCourseProgress.create({
            data: {
                userId,
                courseId,
                currentLessonId: firstLesson?.id || null,
                snapshotLessonIds,
                totalLessons: snapshotLessonIds.length,
                lastActivityAt: new Date(),
            },
        });

        await this.prisma.heatmapData.upsert({
            where: {
                userId_date: {
                    userId,
                    date: new Date(new Date().toISOString().split('T')[0]),
                },
            },
            create: {
                userId,
                date: new Date(),
                actionsCount: 1,
            },
            update: {
                actionsCount: { increment: 1 },
            },
        });

        await this.createFeedEvent(userId, 'COURSE_STARTED', { courseId });

        return progress;
    }

    async updateProgress(userId: number, courseId: number, lessonId: number) {
        const progress = await this.prisma.userCourseProgress.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
        });

        if (!progress) {
            throw new BadRequestException('Вы не начинали этот курс');
        }

        if (!progress.snapshotLessonIds.includes(lessonId)) {
            throw new BadRequestException('Урок не входит в программу курса');
        }

        const lesson = await this.prisma.lesson.findUnique({
            where: { id: lessonId },
            include: {
                blocks: {
                    where: { type: 'QUIZ' },
                },
            },
        });

        if (!lesson) {
            throw new NotFoundException('Урок не найден');
        }

        const hasQuiz = lesson.blocks.length > 0;

        if (hasQuiz) {
            const passedQuiz = await this.prisma.quizAttempt.findFirst({
                where: {
                    userId,
                    lessonId,
                    passed: true,
                },
            });

            if (!passedQuiz) {
                throw new BadRequestException('Пройдите тест, чтобы завершить урок');
            }
        }

        const completedLessons = await this.getCompletedLessonIds(userId, courseId);
        const isAlreadyCompleted = completedLessons.includes(lessonId);

        const quizResults = progress.quizResults as Record<string, any> || {};

        if (!isAlreadyCompleted) {
            quizResults[lessonId] = { completedAt: new Date().toISOString() };

            const nextLesson = await this.prisma.lesson.findFirst({
                where: {
                    courseId,
                    order: { gt: lesson.order },
                },
                orderBy: { order: 'asc' },
            });

            const updatedCompletedCount = completedLessons.length + 1;
            const newProgress = (updatedCompletedCount / progress.totalLessons) * 100;
            const isCompleted = newProgress >= 100;

            const updated = await this.prisma.userCourseProgress.update({
                where: {
                    userId_courseId: { userId, courseId },
                },
                data: {
                    currentLessonId: nextLesson?.id || lessonId,
                    completedLessonsCount: updatedCompletedCount,
                    progress: newProgress,
                    lastActivityAt: new Date(),
                    completedAt: isCompleted && !progress.completedAt ? new Date() : progress.completedAt,
                    quizResults,
                },
            });

            await this.prisma.heatmapData.upsert({
                where: {
                    userId_date: {
                        userId,
                        date: new Date(new Date().toISOString().split('T')[0]),
                    },
                },
                create: {
                    userId,
                    date: new Date(),
                    actionsCount: 1,
                },
                update: {
                    actionsCount: { increment: 1 },
                },
            });

            await this.updateStreak(userId);

            if (isCompleted && !progress.completedAt) {
                await this.createFeedEvent(userId, 'COURSE_COMPLETED', { courseId });
                await this.addExperience(userId, 100);
                await this.checkCertificateEligibility(userId, courseId);
            }

            return updated;
        }

        return progress;
    }

    async submitQuiz(userId: number, courseId: number, dto: SubmitQuizDto) {
        const lesson = await this.prisma.lesson.findUnique({
            where: { id: dto.lessonId },
            include: {
                blocks: {
                    where: { type: 'QUIZ' },
                },
            },
        });

        if (!lesson || lesson.blocks.length === 0) {
            throw new BadRequestException('Тест не найден в этом уроке');
        }

        const quizBlock = lesson.blocks[0];
        const quizContent = quizBlock.content as any;
        const questions = quizContent.questions || [];

        let correctAnswers = 0;
        const totalQuestions = questions.length;

        for (const answer of dto.answers) {
            const question = questions[answer.questionIndex];
            if (!question) continue;

            const correct = Array.isArray(question.correctAnswer)
                ? question.correctAnswer
                : [question.correctAnswer];

            const isCorrect =
                answer.selectedAnswers.length === correct.length &&
                answer.selectedAnswers.every((a: number) => correct.includes(a));

            if (isCorrect) {
                correctAnswers++;
            }
        }

        const score = Math.round((correctAnswers / totalQuestions) * 100);
        const passed = score >= quizContent.passingScore || 70;

        await this.prisma.quizAttempt.create({
            data: {
                userId,
                lessonId: dto.lessonId,
                score,
                maxScore: 100,
                answers: dto.answers,
                passed,
            },
        });

        return { score, maxScore: 100, passed, correctAnswers, totalQuestions };
    }

    async getMyProgress(userId: number) {
        const progress = await this.prisma.userCourseProgress.findMany({
            where: { userId },
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        level: true,
                        user: {
                            select: {
                                id: true,
                                login: true,
                                avatarUrl: true,
                            },
                        },
                    },
                },
                currentLesson: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
            },
            orderBy: { lastActivityAt: 'desc' },
        });

        return progress;
    }

    async getProgressForCourse(userId: number, courseId: number) {
        const progress = await this.prisma.userCourseProgress.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                        lessons: {
                            where: {
                                id: { in: [] },
                            },
                            select: {
                                id: true,
                                title: true,
                                order: true,
                            },
                            orderBy: { order: 'asc' },
                        },
                    },
                },
            },
        });

        if (!progress) {
            throw new NotFoundException('Прогресс не найден');
        }

        const quizResults = progress.quizResults as Record<string, any> || {};
        const completedLessonIds = Object.keys(quizResults).map(Number);

        const lessons = await this.prisma.lesson.findMany({
            where: {
                id: { in: progress.snapshotLessonIds },
            },
            select: {
                id: true,
                title: true,
                order: true,
            },
            orderBy: { order: 'asc' },
        });

        return {
            ...progress,
            lessons: lessons.map((lesson) => ({
                ...lesson,
                isCompleted: completedLessonIds.includes(lesson.id),
            })),
        };
    }

    async updateSnapshot(userId: number, courseId: number) {
        const progress = await this.prisma.userCourseProgress.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
        });

        if (!progress) {
            throw new BadRequestException('Прогресс не найден');
        }

        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
            include: {
                lessons: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        const newSnapshotIds = course.lessons.map((l) => l.id);
        const newProgress = (progress.completedLessonsCount / newSnapshotIds.length) * 100;

        return this.prisma.userCourseProgress.update({
            where: {
                userId_courseId: { userId, courseId },
            },
            data: {
                snapshotLessonIds: newSnapshotIds,
                totalLessons: newSnapshotIds.length,
                progress: newProgress,
                isUpdated: false,
            },
        });
    }

    async purchaseCourse(userId: number, courseId: number) {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        if (course.isFree) {
            throw new BadRequestException('Курс бесплатный, покупка не требуется');
        }

        const existingPurchase = await this.prisma.purchasedCourse.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
        });

        if (existingPurchase) {
            throw new BadRequestException('Курс уже куплен');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (user.balance < course.price) {
            throw new BadRequestException('Недостаточно средств на балансе');
        }

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: userId },
                data: { balance: { decrement: course.price } },
            }),
            this.prisma.purchasedCourse.create({
                data: { userId, courseId },
            }),
            this.prisma.transaction.create({
                data: {
                    userId,
                    courseId,
                    type: 'PURCHASE',
                    price: course.price,
                },
            }),
        ]);

        await this.startCourse(userId, courseId);

        return { message: 'Курс успешно куплен' };
    }

    async giftCourse(userId: number, courseId: number, recipientId: number) {
        if (userId === recipientId) {
            throw new BadRequestException('Нельзя подарить курс самому себе');
        }

        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        if (course.isFree) {
            throw new BadRequestException('Бесплатные курсы не дарят');
        }

        const recipient = await this.prisma.user.findUnique({
            where: { id: recipientId },
        });

        if (!recipient) {
            throw new NotFoundException('Получатель не найден');
        }

        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (user.balance < course.price) {
            throw new BadRequestException('Недостаточно средств на балансе');
        }

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: userId },
                data: { balance: { decrement: course.price } },
            }),
            this.prisma.purchasedCourse.create({
                data: { userId: recipientId, courseId },
            }),
            this.prisma.transaction.create({
                data: {
                    userId,
                    courseId,
                    type: 'GIFT',
                    price: course.price,
                    giftToId: recipientId,
                },
            }),
            this.prisma.notification.create({
                data: {
                    userId: recipientId,
                    type: 'COURSE_GIFT',
                    title: 'Вам подарили курс',
                    body: `Пользователь подарил вам курс "${course.title}"`,
                    data: { courseId, gifterId: userId },
                },
            }),
        ]);

        return { message: 'Курс успешно подарен' };
    }

    private async getCompletedLessonIds(userId: number, courseId: number): Promise<number[]> {
        const progress = await this.prisma.userCourseProgress.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
        });

        if (!progress?.quizResults) return [];

        const quizResults = progress.quizResults as Record<string, any>;
        return Object.keys(quizResults).map(Number);
    }

    private async updateStreak(userId: number) {
        const today = new Date(new Date().toISOString().split('T')[0]);
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const hasYesterdayActivity = await this.prisma.streakHistory.findUnique({
            where: {
                userId_date: { userId, date: yesterday },
            },
        });

        await this.prisma.streakHistory.upsert({
            where: {
                userId_date: { userId, date: today },
            },
            create: {
                userId,
                date: today,
                actionCount: 1,
            },
            update: {
                actionCount: { increment: 1 },
            },
        });

        if (!hasYesterdayActivity) {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
            });

            if (user.streakFreezes > 0) {
                await this.prisma.user.update({
                    where: { id: userId },
                    data: { streakFreezes: { decrement: 1 } },
                });
            }
        }
    }

    private async addExperience(userId: number, amount: number) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { experiencePoints: { increment: amount } },
        });
    }

    private async checkCertificateEligibility(userId: number, courseId: number) {
        const progress = await this.prisma.userCourseProgress.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
        });

        if (progress && progress.progress >= 100) {
            const existing = await this.prisma.certificate.findUnique({
                where: {
                    userId_courseId: { userId, courseId },
                },
            });

            if (!existing) {
                await this.prisma.certificate.create({
                    data: {
                        userId,
                        courseId,
                        uuid: crypto.randomUUID(),
                    },
                });

                await this.prisma.notification.create({
                    data: {
                        userId,
                        type: 'CERTIFICATE_ISSUED',
                        title: 'Сертификат выдан',
                        body: 'Поздравляем! Вы получили сертификат за завершение курса.',
                        data: { courseId },
                    },
                });
            }
        }
    }

    private async createFeedEvent(userId: number, type: string, data: any) {
        await this.prisma.feedEvent.create({
            data: {
                actorId: userId,
                subjectId: userId,
                type,
                data,
            },
        });
    }
}