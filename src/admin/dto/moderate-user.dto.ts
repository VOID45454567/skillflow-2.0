import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ModerateUserDto {
    @IsString()
    @MaxLength(500)
    reason: string;

    @IsString()
    @IsOptional()
    notes?: string;
}