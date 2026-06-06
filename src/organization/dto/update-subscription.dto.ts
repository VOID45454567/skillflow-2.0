import { IsInt, Min } from 'class-validator';

export class UpdateSubscriptionDto {
    @IsInt()
    @Min(1)
    licenseCount: number;
}