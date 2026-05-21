import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestMinioModule } from 'nestjs-minio';
import { MinioService } from './minio.service';

@Global()
@Module({
    imports: [
        NestMinioModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                endPoint: configService.getOrThrow<string>('minio.endpoint'),
                port: configService.getOrThrow<number>('minio.port'),
                accessKey: configService.getOrThrow<string>('minio.accessKey'),
                secretKey: configService.getOrThrow<string>('minio.secretKey'),
                useSSL: configService.getOrThrow<boolean>('minio.useSsl'),
            }),
        }),
    ],
    providers: [MinioService],
    exports: [MinioService],
})
export class MinioModule { }