import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { static as serveStatic, type Express } from 'express';
import { PROFILE_PICTURE_DIRECTORY } from './settings/profile-picture';
import { env } from './config/env.validation';
import { AppModule } from './app.module';
import { csrfOriginMiddleware } from './auth/csrf-origin.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const expressApp = app.getHttpAdapter().getInstance() as Express;

  expressApp.set('trust proxy', 1);

  app.enableCors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.use(csrfOriginMiddleware);
  app.use(
    '/profile-picture',
    serveStatic(PROFILE_PICTURE_DIRECTORY, {
      index: false,
      dotfiles: 'deny',
      maxAge: '1y',
      immutable: true,
      setHeaders: (response) => {
        response.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(env.PORT, '0.0.0.0');
}

void bootstrap();
