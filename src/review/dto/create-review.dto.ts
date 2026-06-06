import { IsString, IsInt, Min, Max, MinLength, MaxLength } from 'class-validator';

export class CreateReviewDto {
    @IsInt()
    courseId: number;

    @IsInt()
    @Min(1)
    @Max(5)
    rating: number;

    @IsString()
    @MinLength(10)
    @MaxLength(2000)
    text: string;
}