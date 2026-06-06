import { TermTypes } from "@prisma/client";
import { IsEnum, IsString } from "class-validator";

export class CreateTermDto {
    @IsEnum(TermTypes)
    type: TermTypes

    @IsString()
    name: string
}