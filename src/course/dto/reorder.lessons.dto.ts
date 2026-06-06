import { IsArray, IsInt, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class LessonOrderDto {
    @IsInt()
    id: number;

    @IsInt()
    order: number;
}

export class ReorderLessonsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LessonOrderDto)
    lessons: LessonOrderDto[];
}