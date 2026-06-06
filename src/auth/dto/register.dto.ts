import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
    @IsString()
    @MinLength(3)
    @MaxLength(30)
    login: string;

    @IsEmail()
    email: string;

    @IsString()
    @MinLength(8)
    @MaxLength(64)
    password: string;
}