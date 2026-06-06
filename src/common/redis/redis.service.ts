import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class RedisService {
    constructor(
        @InjectQueue('default') private readonly defaultQueue: Queue,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    async addJob(name: string, data: any, opts?: any) {
        return this.defaultQueue.add(name, data, opts);
    }

    async getJob(jobId: string) {
        return this.defaultQueue.getJob(jobId);
    }

    async removeJob(jobId: string) {
        const job = await this.defaultQueue.getJob(jobId);
        if (job) {
            await job.remove();
        }
    }

    async getOrSetCounter(key: string, ttl: number): Promise<number> {
        const current = await this.cacheManager.get<number>(key);
        const newValue = (current || 0) + 1;
        await this.cacheManager.set(key, newValue, ttl);
        return newValue;
    }

    async deleteKey(key: string): Promise<void> {
        await this.cacheManager.del(key);
    }
}