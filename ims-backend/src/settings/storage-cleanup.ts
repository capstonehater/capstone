import { lstat, readdir, realpath, rmdir, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const MINIMUM_AGE_MS = 24 * 60 * 60 * 1000;
const FORECAST_FILES = new Set(['input.json', 'output.json']);

// Only abandoned, flat forecast work folders qualify. Never traverse links or
// remove arbitrary temp files, application builds, drafts, or uploaded images.
export async function scanDisposableForecastFiles(root = tmpdir(), now = Date.now()) {
  const resolvedRoot = await realpath(root);
  const candidates: { directory: string; files: { path: string; bytes: number }[] }[] = [];
  for (const name of await readdir(resolvedRoot)) {
    if (!/^ims-forecast-[A-Za-z0-9]{6}$/.test(name)) continue;
    const directory = join(resolvedRoot, name);
    try {
      const info = await lstat(directory);
      if (!info.isDirectory() || info.isSymbolicLink() || now - info.mtimeMs < MINIMUM_AGE_MS) continue;
      if (dirname(await realpath(directory)) !== resolvedRoot) continue;
      const names = await readdir(directory);
      if (names.some((file) => !FORECAST_FILES.has(file))) continue;
      const files = [] as { path: string; bytes: number }[];
      let safe = true;
      for (const filename of names) {
        const path = join(directory, filename);
        const file = await lstat(path);
        if (!file.isFile() || file.isSymbolicLink() || now - file.mtimeMs < MINIMUM_AGE_MS) { safe = false; break; }
        files.push({ path, bytes: file.size });
      }
      if (safe) candidates.push({ directory, files });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return candidates;
}

export async function clearDisposableForecastFiles(root = tmpdir()) {
  let freedBytes = 0;
  let deletedFiles = 0;
  const resolvedRoot = await realpath(root);
  for (const candidate of await scanDisposableForecastFiles(resolvedRoot)) {
    // Recheck containment immediately before deleting known individual files.
    if (dirname(await realpath(candidate.directory)) !== resolvedRoot) continue;
    for (const file of candidate.files) {
      try {
        await unlink(file.path);
        freedBytes += file.bytes;
        deletedFiles += 1;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    try { await rmdir(candidate.directory); } catch (error) {
      if (!['ENOENT', 'ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
    }
  }
  return { freedBytes, deletedFiles };
}
