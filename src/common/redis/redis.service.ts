import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class RedisService {
    constructor(@InjectQueue('default') private readonly defaultQueue: Queue) { }

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
}