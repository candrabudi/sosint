import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({ origin: process.env.PANEL_ORIGIN ?? 'http://localhost:5173', credentials: true });
  app.enableShutdownHooks();
  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  console.log(`API running at http://localhost:${port}/api`);
}
bootstrap();
