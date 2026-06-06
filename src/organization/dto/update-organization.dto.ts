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

export class UpdateOrganizationDto {
    @IsString()
    @MinLength(3)
    @MaxLength(100)
    @IsOptional()
    name?: string;

    @IsString()
    @MinLength(10)
    @IsOptional()
    description?: string;

    @IsEnum(OrganizationType)
    @IsOptional()
    type?: OrganizationType;

    @IsEnum(OrganizationVisibility)
    @IsOptional()
    visibility?: OrganizationVisibility;

    @IsInt()
    @Min(1)
    @IsOptional()
    maxMembers?: number;
}