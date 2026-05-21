import { CacheManagerOptions, CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet'

export const RedisConf = (configService: ConfigService) => {
    return {
        store: redisStore,
        host: configService.getOrThrow<string>('redis.host'),
        port: configService.getOrThrow<number>('redis.port'),
        password: configService.getOrThrow<string>('redis.password'),
        ttl: 60000,
    }

}