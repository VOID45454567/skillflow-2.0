import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto, UpdateReviewDto, VoteReviewDto } from './dto';
import { CurrentUser } from '../common/decorators/current.user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('reviews')
export class ReviewController {
    constructor(private readonly reviewService: ReviewService) { }

    @Post()
    async createReview(
        @CurrentUser('id') userId: number,
        @Body() dto: CreateReviewDto,
    ) {
        return this.reviewService.createReview(userId, dto);
    }

    @Public()
    @Get('course/:courseId')
    async getReviewsByCourse(
        @Param('courseId', ParseIntPipe) courseId: number,
        @Query('page') page: string,
        @Query('limit') limit: string,
        @Query('sortBy') sortBy: string,
    ) {
        return this.reviewService.getReviewsByCourse(
            courseId,
            parseInt(page) || 1,
            parseInt(limit) || 20,
            sortBy || 'useful',
        );
    }

    @Get('my')
    async getMyReviews(@CurrentUser('id') userId: number) {
        return this.reviewService.getMyReviews(userId);
    }

    @Patch(':id')
    async updateReview(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) reviewId: number,
        @Body() dto: UpdateReviewDto,
    ) {
        return this.reviewService.updateReview(userId, reviewId, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async deleteReview(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) reviewId: number,
    ) {
        return this.reviewService.deleteReview(userId, reviewId);
    }

    @Post(':id/vote')
    @HttpCode(HttpStatus.OK)
    async voteReview(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) reviewId: number,
        @Body() dto: VoteReviewDto,
    ) {
        return this.reviewService.voteReview(userId, reviewId, dto);
    }
}