import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  static as serveStatic,
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { PROFILE_PICTURE_DIRECTORY } from './settings/profile-picture';
import { PRODUCT_IMAGE_DIRECTORY } from './catalog/product-image';
import { env } from './config/env.validation';
import { AppModule } from './app.module';
import { csrfOriginMiddleware } from './auth/csrf-origin.middleware';
import { frontendOrigins } from './auth/frontend-origins';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const expressApp = app.getHttpAdapter().getInstance() as Express;

  expressApp.set(
    'trust proxy',
    env.TRUST_PROXY
      ? env.TRUST_PROXY.split(',').map((address) => address.trim())
      : false,
  );
  expressApp.disable('x-powered-by');
  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.enableCors({
    origin: frontendOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.use(csrfOriginMiddleware);
  app.use(
    '/product-images',
    serveStatic(PRODUCT_IMAGE_DIRECTORY, {
      index: false,
      dotfiles: 'deny',
      maxAge: '1y',
      immutable: true,
      setHeaders: (response) =>
        response.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );
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
