import { IsArray, ValidateNested, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

class QuizAnswerDto {
    @IsInt()
    questionIndex: number;

    @IsArray()
    @IsInt({ each: true })
    selectedAnswers: number[];
}

export class SubmitQuizDto {
    @IsInt()
    lessonId: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => QuizAnswerDto)
    answers: QuizAnswerDto[];
}