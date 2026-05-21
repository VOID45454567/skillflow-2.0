import {
    Injectable,
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { RATE_LIMIT_KEY, RateLimitOptions } from '../decorators/rate.limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const rateLimitOptions = this.reflector.getAllAndOverride<RateLimitOptions>(
            RATE_LIMIT_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!rateLimitOptions) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const userId = request.user?.id || request.ip;
        const key = `rate-limit:${context.getHandler().name}:${userId}`;

        const currentCount = (await this.cacheManager.get<number>(key)) || 0;

        if (currentCount >= rateLimitOptions.points) {
            throw new HttpException(
                {
                    statusCode: HttpStatus.TOO_MANY_REQUESTS,
                    message: 'Слишком много запросов. Попробуйте позже.',
                    retryAfter: rateLimitOptions.duration,
                },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        await this.cacheManager.set(key, currentCount + 1, rateLimitOptions.duration * 1000);

        return true;
    }
}