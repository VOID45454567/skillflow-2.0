import {
    IsString,
    IsOptional,
    IsInt,
    IsArray,
    IsBoolean,
    Min,
    ValidateNested,
    IsEnum,
    ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LessonBlockType } from '../../generated/prisma/client';

class CreateLessonBlockDto {
    @IsEnum(LessonBlockType)
    type: LessonBlockType;

    @IsInt()
    order: number;

    content: any;
}

export class CreateLessonDto {
    @IsString()
    title: string;

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
    @Type(() => CreateLessonBlockDto)
    @ArrayMinSize(1)
    blocks: CreateLessonBlockDto[];
}