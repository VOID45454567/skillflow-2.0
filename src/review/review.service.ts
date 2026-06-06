import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { CreateReviewDto, UpdateReviewDto, VoteReviewDto } from './dto';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class ReviewService {
    constructor(private readonly prisma: PrismaService) { }

    async createReview(userId: number, dto: CreateReviewDto) {
        const course = await this.prisma.course.findUnique({
            where: { id: dto.courseId },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        if (course.userId === userId) {
            throw new ForbiddenException('Нельзя оставить отзыв на свой курс');
        }

        const hasAccess = await this.checkCourseAccess(userId, dto.courseId);

        if (!hasAccess) {
            throw new ForbiddenException('Нужно приобрести курс, чтобы оставить отзыв');
        }

        const existingReview = await this.prisma.review.findFirst({
            where: {
                userId,
                courseId: dto.courseId,
            },
        });

        if (existingReview) {
            throw new BadRequestException('Вы уже оставили отзыв на этот курс');
        }

        const review = await this.prisma.review.create({
            data: {
                userId,
                courseId: dto.courseId,
                rating: dto.rating,
                text: dto.text,
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
                        votes: true,
                    },
                },
            },
        });

        await this.updateCourseRating(dto.courseId);
        await this.createFeedEvent(userId, 'REVIEW_CREATED', { courseId: dto.courseId, reviewId: review.id });

        return review;
    }

    async getReviewsByCourse(courseId: number, page: number = 1, limit: number = 20, sortBy: string = 'useful') {
        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });

        if (!course) {
            throw new NotFoundException('Курс не найден');
        }

        let orderBy: any = { createdAt: 'desc' };

        if (sortBy === 'useful') {
            orderBy = { votes: { _count: 'desc' } };
        } else if (sortBy === 'newest') {
            orderBy = { createdAt: 'desc' };
        } else if (sortBy === 'rating_high') {
            orderBy = { rating: 'desc' };
        } else if (sortBy === 'rating_low') {
            orderBy = { rating: 'asc' };
        }

        const [reviews, total] = await Promise.all([
            this.prisma.review.findMany({
                where: { courseId },
                include: {
                    user: {
                        select: {
                            id: true,
                            login: true,
                            avatarUrl: true,
                        },
                    },
                    votes: {
                        select: {
                            vote: true,
                        },
                    },
                    _count: {
                        select: {
                            votes: true,
                        },
                    },
                },
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.review.count({ where: { courseId } }),
        ]);

        const reviewsWithVotes = reviews.map((review) => {
            const upvotes = review.votes.filter((v) => v.vote === 'UPVOTE').length;
            const downvotes = review.votes.filter((v) => v.vote === 'DOWNVOTE').length;

            return {
                id: review.id,
                rating: review.rating,
                text: review.text,
                user: review.user,
                createdAt: review.createdAt,
                upvotes,
                downvotes,
                score: upvotes - downvotes,
            };
        });

        return {
            reviews: reviewsWithVotes,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        };
    }

    async updateReview(userId: number, reviewId: number, dto: UpdateReviewDto) {
        const review = await this.prisma.review.findUnique({
            where: { id: reviewId },
        });

        if (!review) {
            throw new NotFoundException('Отзыв не найден');
        }

        if (review.userId !== userId) {
            throw new ForbiddenException('Вы не можете редактировать чужой отзыв');
        }

        const updated = await this.prisma.review.update({
            where: { id: reviewId },
            data: {
                ...(dto.rating && { rating: dto.rating }),
                ...(dto.text && { text: dto.text }),
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
        });

        if (dto.rating) {
            await this.updateCourseRating(review.courseId);
        }

        return updated;
    }

    async deleteReview(userId: number, reviewId: number) {
        const review = await this.prisma.review.findUnique({
            where: { id: reviewId },
        });

        if (!review) {
            throw new NotFoundException('Отзыв не найден');
        }

        if (review.userId !== userId) {
            throw new ForbiddenException('Вы не можете удалить чужой отзыв');
        }

        await this.prisma.review.delete({
            where: { id: reviewId },
        });

        await this.updateCourseRating(review.courseId);

        return { message: 'Отзыв удален' };
    }

    async voteReview(userId: number, reviewId: number, dto: VoteReviewDto) {
        const review = await this.prisma.review.findUnique({
            where: { id: reviewId },
        });

        if (!review) {
            throw new NotFoundException('Отзыв не найден');
        }

        if (review.userId === userId) {
            throw new BadRequestException('Нельзя голосовать за свой отзыв');
        }

        const existingVote = await this.prisma.reviewVote.findUnique({
            where: {
                userId_reviewId: { userId, reviewId },
            },
        });

        if (existingVote) {
            if (existingVote.vote === dto.vote) {
                await this.prisma.reviewVote.delete({
                    where: { id: existingVote.id },
                });

                return { message: 'Голос отменен' };
            }

            await this.prisma.reviewVote.update({
                where: { id: existingVote.id },
                data: { vote: dto.vote },
            });

            return { message: 'Голос изменен' };
        }

        await this.prisma.reviewVote.create({
            data: {
                userId,
                reviewId,
                vote: dto.vote,
            },
        });

        return { message: 'Голос учтен' };
    }

    async getMyReviews(userId: number) {
        return this.prisma.review.findMany({
            where: { userId },
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                    },
                },
                _count: {
                    select: {
                        votes: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    private async updateCourseRating(courseId: number) {
        const rating = await this.prisma.review.aggregate({
            where: { courseId },
            _avg: { rating: true },
            _count: { rating: true },
        });
    }

    private async checkCourseAccess(userId: number, courseId: number): Promise<boolean> {
        const purchased = await this.prisma.purchasedCourse.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
        });

        if (purchased) return true;

        const progress = await this.prisma.userCourseProgress.findUnique({
            where: {
                userId_courseId: { userId, courseId },
            },
        });

        if (progress && progress.progress > 0) return true;

        const course = await this.prisma.course.findUnique({
            where: { id: courseId },
        });

        if (course.isFree) return true;

        return false;
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