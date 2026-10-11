"""Package allowlisted source from a Git commit, never from the working tree."""

import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile


ROOT = Path(__file__).resolve().parents[1]


def included(name):
    path = PurePosixPath(name)
    if path.is_absolute() or '..' in path.parts:
        return False
    if name in {'.dockerignore', 'deploy/.env.example'}:
        return True
    if any(part.startswith('.') or part in {
        'node_modules', 'dist', 'coverage', 'tmp', '_archive', 'trained_models',
        'product-images', 'profile picture', '__pycache__',
    } for part in path.parts):
        return False
    if path.suffix in {'.pem', '.key', '.sql', '.log', '.pkl'}:
        # Only reviewed Prisma migration SQL belongs in a release.
        return path.suffix == '.sql' and name.startswith('ims-backend/prisma/migrations/')
    if name.startswith('ims-backend/src/'):
        return path.suffix == '.ts' and not name.endswith('.spec.ts')
    if name.startswith('ims-backend/prisma/migrations/'):
        return path.name == 'migration_lock.toml'
    if name in {
        'ims-backend/prisma/schema.prisma',
        'ims-backend/scripts/ensure-prisma-client.cjs',
        'ims-backend/package.json', 'ims-backend/package-lock.json',
        'ims-backend/nest-cli.json', 'ims-backend/tsconfig.json',
        'ims-backend/tsconfig.build.json',
        'ims-backend/Dockerfile', 'ims-frontend/Dockerfile',
        'ims-frontend/package.json', 'ims-frontend/package-lock.json',
        'ims-frontend/next.config.ts', 'ims-frontend/tsconfig.json',
        'ims-frontend/postcss.config.mjs',
        'python/requirements.txt', 'AI-Store Reco/requirements.txt',
        'python/raw-materials-and-products.csv',
        'docs/ci-cd.md', 'docs/deployment-security.md',
        'docs/scaling.md', 'deploy/compose.yml', 'deploy/nginx.conf',
        'deploy/proxy-headers.conf', 'scripts/smoke-scaling.py',
    }:
        return True
    if name.startswith(('ims-frontend/src/', 'ims-frontend/public/', 'ims-frontend/scripts/')):
        return True
    if len(path.parts) == 2 and path.parts[0] in {'python', 'AI-Store Reco'}:
        return path.suffix == '.py' and not path.name.startswith('test_')
    return False


def git(*args, root=ROOT):
    return subprocess.check_output(['git', '-C', str(root), *args])


def package(revision, environment, output, root=ROOT):
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('Revision must be a full lowercase Git commit SHA')
    if environment not in {'development', 'production'}:
        raise ValueError('Unknown environment')
    git('cat-file', '-e', revision + '^{commit}', root=root)
    files = []
    for record in git('ls-tree', '-rz', '--full-tree', revision, root=root).split(b'\0'):
        if not record:
            continue
        metadata, raw_name = record.split(b'\t', 1)
        mode, kind, oid = metadata.decode().split()
        name = raw_name.decode('utf-8')
        if not included(name):
            continue
        if kind != 'blob' or mode not in {'100644', '100755'}:
            raise ValueError(f'Unsupported release entry: {name}')
        files.append((name, oid, mode))
    required = {'ims-backend/package.json', 'ims-frontend/package.json',
                'ims-backend/prisma/schema.prisma', 'python/requirements.txt'}
    missing = required - {name for name, _, _ in files}
    if missing:
        raise ValueError(f'Missing release files: {sorted(missing)}')
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    archive = output / f'salvacion-{environment}-{revision}.tar.gz'
    if archive.exists():
        raise FileExistsError(archive)
    manifest = {'commit': revision, 'environment': environment,
                'format': 'source', 'files': {}}
    with tarfile.open(archive, 'w:gz') as tar:
        for name, oid, mode in sorted(files):
            content = git('cat-file', 'blob', oid, root=root)
            manifest['files'][name] = hashlib.sha256(content).hexdigest()
            info = tarfile.TarInfo(name)
            info.size = len(content)
            info.mode = 0o755 if mode == '100755' else 0o644
            tar.addfile(info, io.BytesIO(content))
        content = (json.dumps(manifest, indent=2) + '\n').encode()
        info = tarfile.TarInfo('release-manifest.json')
        info.size = len(content)
        info.mode = 0o644
        tar.addfile(info, io.BytesIO(content))
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    archive.with_suffix(archive.suffix + '.sha256').write_text(
        f'{digest}  {archive.name}\n', encoding='utf-8')
    print(f'Prepared {archive.name}: {len(files)} files, SHA256 {digest}')
    return archive


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--environment', required=True, choices=['development', 'production'])
    parser.add_argument('--output', type=Path, default=ROOT / '.release-output')
    args = parser.parse_args()
    package(args.revision, args.environment, args.output)
