import { IsBoolean, IsString, IsOptional, MaxLength } from 'class-validator';

export class ProcessWithdrawalDto {
    @IsBoolean()
    approved: boolean;

    @IsString()
    @MaxLength(500)
    @IsOptional()
    notes?: string;
}