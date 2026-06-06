import { IsInt } from 'class-validator';

export class SetMandatoryDto {
    @IsInt()
    courseId: number;
}