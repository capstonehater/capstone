import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ReadCacheInterceptor } from './read-cache.interceptor';
import { ReadCacheService } from './read-cache.service';

@Global()
@Module({
  providers: [
    ReadCacheService,
    { provide: APP_INTERCEPTOR, useClass: ReadCacheInterceptor },
  ],
  exports: [ReadCacheService],
})
export class ReadCacheModule {}
