import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestMinioService } from 'nestjs-minio';
import * as crypto from 'crypto';

@Injectable()
export class MinioService {
    private readonly logger = new Logger(MinioService.name);
    private readonly bucket: string;

    constructor(
        private readonly minioService: NestMinioService,
        private readonly configService: ConfigService,
    ) {
        this.bucket = this.configService.getOrThrow<string>('minio.bucket');
    }

    private getClient() {
        return this.minioService.getMinio()
    }

    async uploadFile(
        objectName: string,
        buffer: Buffer,
        mimeType: string,
    ): Promise<string> {
        await this.getClient().putObject(
            this.bucket,
            objectName,
            buffer,
            undefined,
            { 'Content-Type': mimeType },
        );

        return this.getFileUrl(objectName);
    }

    async deleteFile(objectName: string): Promise<void> {
        await this.getClient().removeObject(this.bucket, objectName);
    }

    async getFile(objectName: string): Promise<Buffer> {
        const stream = await this.getClient().getObject(
            this.bucket,
            objectName,
        );
        return this.streamToBuffer(stream);
    }

    getFileUrl(objectName: string): string {
        const endpoint = this.configService.get('minio.endpoint');
        const port = this.configService.get('minio.port');
        const useSsl = this.configService.get('minio.useSsl');
        const protocol = useSsl ? 'https' : 'http';

        return `${protocol}://${endpoint}:${port}/${this.bucket}/${objectName}`;
    }

    generateObjectName(prefix: string, originalName: string): string {
        const hash = crypto.randomBytes(16).toString('hex');
        const ext = originalName.split('.').pop();
        return `${prefix}/${hash}.${ext}`;
    }

    private async streamToBuffer(stream: any): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            stream.on('data', (chunk: Buffer) => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
    }
}