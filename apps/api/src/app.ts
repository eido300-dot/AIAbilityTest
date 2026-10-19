import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

export async function createApp() {
  const app = await NestFactory.create(AppModule, {
    logger: ['warn', 'error'],
  });
  app.use(helmet());
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  return app;
}
