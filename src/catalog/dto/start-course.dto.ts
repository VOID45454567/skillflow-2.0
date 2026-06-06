import { IsInt } from 'class-validator';

export class StartCourseDto {
    @IsInt()
    courseId: number;
}