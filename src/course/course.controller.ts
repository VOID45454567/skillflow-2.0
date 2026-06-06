import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    ParseIntPipe,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { CourseService } from './course.service';
import {
    CreateCourseDto,
    UpdateCourseDto,
    CreateLessonDto,
    UpdateLessonDto,
    ReorderLessonsDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current.user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequireVerification } from '../common/decorators/virified.decorator';

@Controller('courses')
export class CourseController {
    constructor(private readonly courseService: CourseService) { }

    @Post()
    @RequireVerification()
    async createCourse(
        @CurrentUser('id') userId: number,
        @Body() dto: CreateCourseDto,
    ) {
        return this.courseService.createCourse(userId, dto);
    }

    @Get('my')
    async getMyCourses(@CurrentUser('id') userId: number) {
        return this.courseService.getMyCourses(userId);
    }

    @Public()
    @Get(':id')
    async getPublishedCourse(@Param('id', ParseIntPipe) courseId: number) {
        return this.courseService.getPublishedCourseById(courseId);
    }

    @Get(':id/full')
    async getFullCourse(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) courseId: number,
    ) {
        return this.courseService.getFullCourseForStudent(userId, courseId);
    }

    @Patch(':id')
    async updateCourse(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) courseId: number,
        @Body() dto: UpdateCourseDto,
    ) {
        return this.courseService.updateCourse(userId, courseId, dto);
    }

    @Delete(':id')
    @HttpCode(HttpStatus.OK)
    async deleteCourse(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) courseId: number,
    ) {
        return this.courseService.deleteCourse(userId, courseId);
    }

    @Post(':id/publish')
    @HttpCode(HttpStatus.OK)
    async publishCourse(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) courseId: number,
    ) {
        return this.courseService.publishCourse(userId, courseId);
    }

    @Get(':id/stats')
    async getCourseStats(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) courseId: number,
    ) {
        return this.courseService.getCourseStats(userId, courseId);
    }

    @Post(':id/lessons')
    async createLesson(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) courseId: number,
        @Body() dto: CreateLessonDto,
    ) {
        return this.courseService.createLesson(userId, courseId, dto);
    }

    @Patch(':id/lessons/:lessonId')
    async updateLesson(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) courseId: number,
        @Param('lessonId', ParseIntPipe) lessonId: number,
        @Body() dto: UpdateLessonDto,
    ) {
        return this.courseService.updateLesson(userId, courseId, lessonId, dto);
    }

    @Delete(':id/lessons/:lessonId')
    @HttpCode(HttpStatus.OK)
    async deleteLesson(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) courseId: number,
        @Param('lessonId', ParseIntPipe) lessonId: number,
    ) {
        return this.courseService.deleteLesson(userId, courseId, lessonId);
    }

    @Post(':id/lessons/reorder')
    @HttpCode(HttpStatus.OK)
    async reorderLessons(
        @CurrentUser('id') userId: number,
        @Param('id', ParseIntPipe) courseId: number,
        @Body() dto: ReorderLessonsDto,
    ) {
        return this.courseService.reorderLessons(userId, courseId, dto);
    }
}