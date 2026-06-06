import { IsOptional, IsString, IsInt, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { CourseLevels } from '../../generated/prisma/enums';

export class SearchCoursesDto {
    @IsString()
    @IsOptional()
    query?: string;

    @IsInt()
    @Type(() => Number)
    @IsOptional()
    categoryId?: number;

    @IsInt()
    @Type(() => Number)
    @IsOptional()
    tagId?: number;

    @IsEnum(CourseLevels)
    @IsOptional()
    level?: CourseLevels;

    @IsOptional()
    @IsString()
    price?: 'free' | 'paid';

    @IsOptional()
    @IsString()
    sortBy?: 'popular' | 'rating' | 'newest' | 'price_asc' | 'price_desc';

    @IsInt()
    @Type(() => Number)
    @Min(1)
    @IsOptional()
    page?: number = 1;

    @IsInt()
    @Type(() => Number)
    @Min(1)
    @Max(50)
    @IsOptional()
    limit?: number = 20;
}