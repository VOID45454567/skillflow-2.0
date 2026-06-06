import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Query,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { SearchCoursesDto, SubmitQuizDto } from './dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current.user.decorator';

@Controller('catalog')
export class CatalogController {
    constructor(private readonly catalogService: CatalogService) { }

    @Public()
    @Get('courses')
    async searchCourses(@Query() dto: SearchCoursesDto) {
        return this.catalogService.searchCourses(dto);
    }

    @Get('recommended')
    async getRecommendedCourses(@CurrentUser('id') userId: number) {
        return this.catalogService.getRecommendedCourses(userId);
    }

    @Public()
    @Get('terms/:type')
    async getTerms(@Param('type') type: 'CATEGORY' | 'TAG') {
        return this.catalogService.getTerms(type);
    }

    @Post('courses/:courseId/start')
    @HttpCode(HttpStatus.OK)
    async startCourse(
        @CurrentUser('id') userId: number,
        @Param('courseId', ParseIntPipe) courseId: number,
    ) {
        return this.catalogService.startCourse(userId, courseId);
    }

    @Post('courses/:courseId/progress')
    @HttpCode(HttpStatus.OK)
    async updateProgress(
        @CurrentUser('id') userId: number,
        @Param('courseId', ParseIntPipe) courseId: number,
        @Body('lessonId') lessonId: number,
    ) {
        return this.catalogService.updateProgress(userId, courseId, lessonId);
    }

    @Post('courses/:courseId/quiz')
    @HttpCode(HttpStatus.OK)
    async submitQuiz(
        @CurrentUser('id') userId: number,
        @Param('courseId', ParseIntPipe) courseId: number,
        @Body() dto: SubmitQuizDto,
    ) {
        return this.catalogService.submitQuiz(userId, courseId, dto);
    }

    @Get('my/progress')
    async getMyProgress(@CurrentUser('id') userId: number) {
        return this.catalogService.getMyProgress(userId);
    }

    @Get('courses/:courseId/progress')
    async getProgressForCourse(
        @CurrentUser('id') userId: number,
        @Param('courseId', ParseIntPipe) courseId: number,
    ) {
        return this.catalogService.getProgressForCourse(userId, courseId);
    }

    @Post('courses/:courseId/update-snapshot')
    @HttpCode(HttpStatus.OK)
    async updateSnapshot(
        @CurrentUser('id') userId: number,
        @Param('courseId', ParseIntPipe) courseId: number,
    ) {
        return this.catalogService.updateSnapshot(userId, courseId);
    }

    @Post('courses/:courseId/purchase')
    @HttpCode(HttpStatus.OK)
    async purchaseCourse(
        @CurrentUser('id') userId: number,
        @Param('courseId', ParseIntPipe) courseId: number,
    ) {
        return this.catalogService.purchaseCourse(userId, courseId);
    }

    @Post('courses/:courseId/gift')
    @HttpCode(HttpStatus.OK)
    async giftCourse(
        @CurrentUser('id') userId: number,
        @Param('courseId', ParseIntPipe) courseId: number,
        @Body('recipientId', ParseIntPipe) recipientId: number,
    ) {
        return this.catalogService.giftCourse(userId, courseId, recipientId);
    }
}