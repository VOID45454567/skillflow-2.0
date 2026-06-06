import {
    IsString,
    IsOptional,
    IsBoolean,
    IsInt,
    IsEnum,
    IsArray,
    MinLength,
    MaxLength,
    Min,
} from 'class-validator';
import { CourseLevels } from '../../generated/prisma/client';

export class CreateCourseDto {
    @IsString()
    @MinLength(3)
    @MaxLength(200)
    title: string;

    @IsString()
    @MinLength(10)
    description: string;

    @IsEnum(CourseLevels)
    level: CourseLevels;

    @IsBoolean()
    isFree: boolean;

    @IsInt()
    @Min(1)
    @IsOptional()
    price?: number;

    @IsBoolean()
    refundEnabled: boolean;

    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    categoryIds?: number[];

    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    tagIds?: number[];

    @IsInt()
    @IsOptional()
    organizationId?: number;
}