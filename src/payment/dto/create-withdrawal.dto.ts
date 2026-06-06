import { IsInt, IsEnum, IsString, Min } from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/enums';

export class CreateWithdrawalDto {
    @IsInt()
    @Min(1)
    amount: number;

    @IsEnum(PaymentMethod)
    method: PaymentMethod;

    @IsString()
    account: string;
}