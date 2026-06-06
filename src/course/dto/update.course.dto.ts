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
import { CourseLevels, VisibilityTypes } from '../../generated/prisma/enums';

export class UpdateCourseDto {
    @IsString()
    @MinLength(3)
    @MaxLength(200)
    @IsOptional()
    title?: string;

    @IsString()
    @MinLength(10)
    @IsOptional()
    description?: string;

    @IsEnum(CourseLevels)
    @IsOptional()
    level?: CourseLevels;

    @IsBoolean()
    @IsOptional()
    isFree?: boolean;

    @IsInt()
    @Min(1)
    @IsOptional()
    price?: number;

    @IsBoolean()
    @IsOptional()
    refundEnabled?: boolean;

    @IsEnum(VisibilityTypes)
    @IsOptional()
    visibility?: VisibilityTypes;

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