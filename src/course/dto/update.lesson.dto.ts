import {
    IsString,
    IsOptional,
    IsInt,
    IsArray,
    IsBoolean,
    Min,
    ValidateNested,
    IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LessonBlockType } from '../../generated/prisma/enums';

class UpdateLessonBlockDto {
    @IsInt()
    @IsOptional()
    id?: number;

    @IsEnum(LessonBlockType)
    type: LessonBlockType;

    @IsInt()
    order: number;

    content: any;
}

export class UpdateLessonDto {
    @IsString()
    @IsOptional()
    title?: string;

    @IsInt()
    @Min(0)
    @IsOptional()
    requredTime?: number;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    goals?: string[];

    @IsBoolean()
    @IsOptional()
    isPreview?: boolean;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateLessonBlockDto)
    @IsOptional()
    blocks?: UpdateLessonBlockDto[];
}