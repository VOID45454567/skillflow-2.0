import { IsString, IsOptional, MaxLength } from 'class-validator';

export class ProcessReportDto {
    @IsString()
    @MaxLength(500)
    resolution: string;

    @IsString()
    @IsOptional()
    notes?: string;
}