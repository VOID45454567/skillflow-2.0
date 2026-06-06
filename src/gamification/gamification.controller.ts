import {
    Controller,
    Get,
    Post,
    Query,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { CurrentUser } from '../common/decorators/current.user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('gamification')
export class GamificationController {
    constructor(private readonly gamificationService: GamificationService) { }

    @Get('achievements')
    async getAchievements(@CurrentUser('id') userId: number) {
        return this.gamificationService.getAchievements(userId);
    }

    @Public()
    @Get('leaderboard')
    async getGlobalLeaderboard(
        @Query('page') page: string,
        @Query('limit') limit: string,
    ) {
        return this.gamificationService.getGlobalLeaderboard(
            parseInt(page) || 1,
            parseInt(limit) || 20,
        );
    }

    @Public()
    @Get('leaderboard/weekly')
    async getWeeklyLeaderboard(
        @Query('page') page: string,
        @Query('limit') limit: string,
    ) {
        return this.gamificationService.getWeeklyLeaderboard(
            parseInt(page) || 1,
            parseInt(limit) || 20,
        );
    }

    @Get('leaderboard/friends')
    async getFriendsLeaderboard(@CurrentUser('id') userId: number) {
        return this.gamificationService.getFriendsLeaderboard(userId);
    }

    @Get('streak')
    async getStreak(@CurrentUser('id') userId: number) {
        return this.gamificationService.getStreak(userId);
    }

    @Get('streak/history')
    async getStreakHistory(
        @CurrentUser('id') userId: number,
        @Query('days') days: string,
    ) {
        return this.gamificationService.getStreakHistory(
            userId,
            parseInt(days) || 30,
        );
    }

    @Post('streak/freeze')
    @HttpCode(HttpStatus.OK)
    async buyStreakFreeze(@CurrentUser('id') userId: number) {
        return this.gamificationService.buyStreakFreeze(userId);
    }

    @Get('xp-history')
    async getXPHistory(
        @CurrentUser('id') userId: number,
        @Query('page') page: string,
        @Query('limit') limit: string,
    ) {
        return this.gamificationService.getXPHistory(
            userId,
            parseInt(page) || 1,
            parseInt(limit) || 20,
        );
    }
}