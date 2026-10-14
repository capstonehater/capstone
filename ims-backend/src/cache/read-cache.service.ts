import { Injectable } from '@nestjs/common';
import { env } from '../config/env.validation';

type Entry = { json: string; expiresAt: number; bytes: number };

@Injectable()
export class ReadCacheService {
  private readonly entries = new Map<string, Entry>();
  private bytes = 0;
  private generation = 0;
  private writers = 0;

  get revision() {
    return this.generation;
  }
  get available() {
    return env.READ_CACHE_ENABLED && this.writers === 0;
  }

  get(key: string): unknown {
    if (!this.available) return undefined;
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.remove(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return JSON.parse(entry.json);
  }

  set(key: string, value: unknown, ttlMs: number, revision: number) {
    if (!this.available || revision !== this.generation || ttlMs <= 0) return;
    // Cache failures must never break a successful read (e.g. BigInt/cycles).
    let json: string | undefined;
    try {
      json = JSON.stringify(value);
    } catch {
      return;
    }
    if (json === undefined) return;
    const bytes = Buffer.byteLength(json) + Buffer.byteLength(key);
    if (
      bytes > env.READ_CACHE_MAX_ENTRY_BYTES ||
      bytes > env.READ_CACHE_MAX_BYTES
    )
      return;
    const now = Date.now();
    for (const [oldKey, entry] of this.entries) {
      if (entry.expiresAt <= now) this.remove(oldKey);
    }
    this.remove(key);
    while (
      this.entries.size >= env.READ_CACHE_MAX_ENTRIES ||
      this.bytes + bytes > env.READ_CACHE_MAX_BYTES
    ) {
      const oldest: unknown = this.entries.keys().next().value;
      if (typeof oldest !== 'string') return;
      this.remove(oldest);
    }
    this.entries.set(key, { json, bytes, expiresAt: now + ttlMs });
    this.bytes += bytes;
  }

  invalidate() {
    this.generation++;
    this.entries.clear();
    this.bytes = 0;
  }

  beginWrite() {
    this.writers++;
    this.invalidate();
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      this.writers--;
      this.invalidate();
    };
  }

  private remove(key: string) {
    const entry = this.entries.get(key);
    if (entry) this.bytes -= entry.bytes;
    this.entries.delete(key);
  }
}
