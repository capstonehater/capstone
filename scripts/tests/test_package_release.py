import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    'package_release', Path(__file__).resolve().parents[1] / 'package-release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleasePackageTests(unittest.TestCase):
    def test_allowlist_excludes_secrets_uploads_datasets_and_models(self):
        for name in [
            'ims-backend/.env', 'ims-frontend/.env.production',
            'AI-Store Reco/.env', 'ims-frontend/public/private.key',
            'ims-backend/tmp/dump.sql', 'salvacion_newest_data_samples.sql',
            'ims-backend/product-images/user.webp',
            'ims-backend/profile picture/user.webp',
            'python/trained_models/model.pkl', 'python/_archive/old.py',
            'python/historical-raw-material-data.csv',
            '../ims-frontend/src/secret.ts',
        ]:
            with self.subTest(name=name):
                self.assertFalse(release.included(name))
        self.assertTrue(release.included('ims-backend/prisma/migrations/20261011/migration.sql'))
        self.assertTrue(release.included('python/raw-materials-and-products.csv'))

    def test_packages_commit_content_and_checksums_not_working_tree(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            def git(*args):
                return subprocess.check_output(['git', '-C', str(root), *args]).decode().strip()
            git('init', '-q')
            for name in ['ims-backend/package.json', 'ims-frontend/package.json',
                         'ims-backend/prisma/schema.prisma', 'python/requirements.txt',
                         'ims-backend/.env']:
                file = root / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text('committed', encoding='utf-8')
            git('add', '.')
            git('-c', 'user.name=CI test', '-c', 'user.email=ci@example.invalid',
                'commit', '-qm', 'fixture')
            revision = git('rev-parse', 'HEAD')
            (root / 'ims-backend/package.json').write_text('uncommitted')
            archive = release.package(revision, 'development', root / 'output', root=root)
            with tarfile.open(archive) as tar:
                self.assertNotIn('ims-backend/.env', tar.getnames())
                self.assertEqual(tar.extractfile('ims-backend/package.json').read(), b'committed')
                manifest = json.load(tar.extractfile('release-manifest.json'))
                self.assertEqual(manifest['commit'], revision)
                for name, digest in manifest['files'].items():
                    self.assertEqual(hashlib.sha256(tar.extractfile(name).read()).hexdigest(), digest)
            checksum = archive.with_suffix('.gz.sha256').read_text().split()[0]
            self.assertEqual(checksum, hashlib.sha256(archive.read_bytes()).hexdigest())
            with self.assertRaises(FileExistsError):
                release.package(revision, 'development', root / 'output', root=root)

    def test_rejects_non_sha_revision(self):
        with self.assertRaises(ValueError):
            release.package('--help', 'production', Path('unused'))


if __name__ == '__main__':
    unittest.main()
