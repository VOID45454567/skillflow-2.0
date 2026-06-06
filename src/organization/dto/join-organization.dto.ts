import { IsString } from 'class-validator';

export class JoinOrganizationDto {
    @IsString()
    inviteCode: string;
}