import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { clearDisposableForecastFiles } from './storage-cleanup';

describe('storage cleanup boundaries', () => {
  let root: string;
  const old = new Date(Date.now() - 48 * 60 * 60 * 1000);

  beforeEach(async () => { root = await mkdtemp(join(process.cwd(), 'storage-cleanup-test-')); });
  afterEach(async () => {
    if (!root.startsWith(resolve(process.cwd()) + '\\') && !root.startsWith(resolve(process.cwd()) + '/')) throw new Error('Invalid test root');
    await rm(root, { recursive: true, force: true });
  });

  async function folder(name: string, filename: string, aged: boolean) {
    const directory = join(root, name);
    await mkdir(directory);
    const file = join(directory, filename);
    await writeFile(file, 'data');
    if (aged) { await utimes(file, old, old); await utimes(directory, old, old); }
    return file;
  }

  it('removes old forecast scratch files and reports freed bytes', async () => {
    const file = await folder('ims-forecast-Ab1234', 'input.json', true);
    expect(await clearDisposableForecastFiles(root)).toEqual({ freedBytes: 4, deletedFiles: 1 });
    await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('preserves fresh forecast files and unrelated temporary folders', async () => {
    const fresh = await folder('ims-forecast-Ab1234', 'input.json', false);
    const unrelated = await folder('important-work', 'input.json', true);
    expect((await clearDisposableForecastFiles(root)).deletedFiles).toBe(0);
    expect(await readFile(fresh, 'utf8')).toBe('data');
    expect(await readFile(unrelated, 'utf8')).toBe('data');
  });

  it('preserves a matching folder containing unknown files', async () => {
    const file = await folder('ims-forecast-Ab1234', 'draft.json', true);
    expect((await clearDisposableForecastFiles(root)).deletedFiles).toBe(0);
    expect(await readFile(file, 'utf8')).toBe('data');
  });
});
