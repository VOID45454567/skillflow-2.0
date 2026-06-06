import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { MinioModule } from './common/minio/minio.module';
import { RolesGuard } from './common/guards/roles.guard';
import { VerifiedGuard } from './common/guards/verified.guard';
import { BannedGuard } from './common/guards/banned.guard';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard, RateLimitGuard } from './common/guards';
import { MailModule } from './common/mail/mailer.module';
import { configModuleOptions } from './conf/configModule';
import { UserModule } from './user/user.module';
import { CourseModule } from './course/course.module';
import { CatalogModule } from './catalog/catalog.module';
import { OrganizationModule } from './organization/organization.module';
import { AdminModule } from './admin/admin.module';
import { PaymentModule } from './payment/payment.module';
import { GamificationModule } from './gamification/gamification.module';
import { ReviewModule } from './review/review.module';

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions),
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    MinioModule,
    MailModule,
    AuthModule,
    UserModule,
    CourseModule,
    CatalogModule,
    ReviewModule,
    OrganizationModule,
    AdminModule,
    PaymentModule,
    GamificationModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: VerifiedGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BannedGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule { }