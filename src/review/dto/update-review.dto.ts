import { IsString, IsInt, IsOptional, Min, Max, MinLength, MaxLength } from 'class-validator';

export class UpdateReviewDto {
    @IsInt()
    @Min(1)
    @Max(5)
    @IsOptional()
    rating?: number;

    @IsString()
    @MinLength(10)
    @MaxLength(2000)
    @IsOptional()
    text?: string;
}