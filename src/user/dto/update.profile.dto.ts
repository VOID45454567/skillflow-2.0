import { IsString, IsOptional, MinLength, MaxLength, IsArray, IsInt } from 'class-validator';

export class UpdateProfileDto {
    @IsString()
    @IsOptional()
    @MinLength(3)
    @MaxLength(30)
    login?: string;

    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    preferredCategoryIds?: number[];

    @IsArray()
    @IsInt({ each: true })
    @IsOptional()
    preferredTagIds?: number[];
}