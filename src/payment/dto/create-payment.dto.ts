import { IsInt, IsEnum, Min } from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/enums';

export class CreatePaymentDto {
    @IsInt()
    @Min(1)
    amount: number;

    @IsEnum(PaymentMethod)
    method: PaymentMethod;
}