import { IsString, IsIn } from 'class-validator';

export class VoteReviewDto {
    @IsString()
    @IsIn(['UPVOTE', 'DOWNVOTE'])
    vote: 'UPVOTE' | 'DOWNVOTE';
}