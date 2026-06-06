import {
    IsString,
    IsOptional,
    IsEnum,
    IsInt,
    MinLength,
    MaxLength,
    Min,
} from 'class-validator';
import { OrganizationType, OrganizationVisibility } from '../../generated/prisma/enums';

export class CreateOrganizationDto {
    @IsString()
    @MinLength(3)
    @MaxLength(100)
    name: string;

    @IsString()
    @MinLength(10)
    description: string;

    @IsEnum(OrganizationType)
    type: OrganizationType;

    @IsEnum(OrganizationVisibility)
    visibility: OrganizationVisibility;

    @IsInt()
    @Min(1)
    @IsOptional()
    maxMembers?: number;
}