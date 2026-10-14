import { SetMetadata } from '@nestjs/common';

export const CACHE_READ = 'ims:cache-read';
// Opt in only JSON reads whose bounded staleness is acceptable. Zero opts out.
export const CacheRead = (ttlMs: number) => SetMetadata(CACHE_READ, ttlMs);
