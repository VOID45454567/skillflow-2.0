import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser'
import { validatorOptions } from './conf/validation/index';
import { CorsConfig } from './conf/cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.use(cookieParser())

  app.useGlobalPipes(new ValidationPipe(validatorOptions))

  app.enableCors(CorsConfig)

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
