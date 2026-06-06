import { Module } from '@nestjs/common';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';
import { LeaderboardSnapshotCron, StreakCheckCron, SubscriptionCheckCron } from './cron';

@Module({
    controllers: [GamificationController],
    providers: [
        GamificationService,
        StreakCheckCron,
        LeaderboardSnapshotCron,
        SubscriptionCheckCron
    ],
    exports: [GamificationService],
})
export class GamificationModule { }