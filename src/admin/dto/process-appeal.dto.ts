import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ProcessAppealDto {
    @IsString()
    @MaxLength(500)
    resolution: string;
}