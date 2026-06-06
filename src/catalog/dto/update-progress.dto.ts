import { IsInt, IsBoolean, IsOptional } from 'class-validator';

export class UpdateProgressDto {
    @IsInt()
    lessonId: number;

    @IsBoolean()
    @IsOptional()
    completed?: boolean;
}