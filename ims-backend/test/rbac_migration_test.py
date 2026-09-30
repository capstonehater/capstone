"""Isolated RBAC migration regression test. Uses local .env credentials without printing them.
Creates a uniquely named temporary database and drops only that database afterward.
Run: python ims-backend/test/rbac_migration_test.py
"""
from pathlib import Path
from urllib.parse import urlparse, unquote
import os, subprocess, uuid

root = Path(__file__).resolve().parents[2]
line = next(x for x in (root / 'ims-backend/.env').read_text(encoding='utf-8-sig').splitlines() if x.startswith('DATABASE_URL='))
u = urlparse(line.split('=', 1)[1].strip().strip('\"').strip("'"))
assert u.hostname in ('localhost', '127.0.0.1'), 'Integration test requires local PostgreSQL'
pgbin = Path(os.environ.get('PG_BIN', r'C:\Program Files\PostgreSQL\18\bin'))
env = os.environ.copy()
env.update(PGHOST=u.hostname, PGPORT=str(u.port or 5432), PGUSER=unquote(u.username or ''), PGPASSWORD=unquote(u.password or ''), PGCONNECT_TIMEOUT='10')
db = 'rbac_test_' + uuid.uuid4().hex

def sql(database, text):
    result = subprocess.run([str(pgbin/'psql.exe'), '-X', '-v', 'ON_ERROR_STOP=1', '-d', database, '-At'], input=text, text=True, capture_output=True, env=env)
    if result.returncode: raise RuntimeError(result.stderr)
    return result.stdout

sql('postgres', f'CREATE DATABASE "{db}" TEMPLATE template0;')
try:
    sql(db, '''CREATE TYPE "Role" AS ENUM ('ADMINISTRATOR','STAFF','MANAGER');
CREATE TABLE users (id text PRIMARY KEY, role "Role" NOT NULL);
CREATE TABLE auth_sessions (id text PRIMARY KEY, user_id text);
INSERT INTO users VALUES ('admin','ADMINISTRATOR'),('staff','STAFF'),('manager','MANAGER');
INSERT INTO auth_sessions VALUES ('existing-session','admin');''')
    migration = root/'ims-backend/prisma/migrations/20260929000000_rbac_foundation/migration.sql'
    sql(db, migration.read_text())
    sql(db, '''DO $$ BEGIN
 IF (SELECT count(*) FROM user_roles) <> 3 THEN RAISE EXCEPTION 'Backfill missing'; END IF;
 IF (SELECT count(*) FROM auth_sessions) <> 1 THEN RAISE EXCEPTION 'Sessions changed'; END IF;
 IF (SELECT role FROM users WHERE id='staff') <> 'STAFF' THEN RAISE EXCEPTION 'Legacy role changed'; END IF;
 IF NOT EXISTS (SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id='staff' AND p.key='stockRuns.post') THEN RAISE EXCEPTION 'Staff operational access missing'; END IF;
 IF EXISTS (SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id='manager' AND p.key='users.manage') THEN RAISE EXCEPTION 'Manager escalated'; END IF;
END $$;
-- Prove protected roles cannot be deleted even without FK dependents.
DO $$ BEGIN
 BEGIN
  DELETE FROM user_roles WHERE role_id=(SELECT id FROM access_roles WHERE key='ADMINISTRATOR');
  DELETE FROM role_permissions WHERE role_id=(SELECT id FROM access_roles WHERE key='ADMINISTRATOR');
  DELETE FROM access_roles WHERE key='ADMINISTRATOR';
  RAISE EXCEPTION 'Protection failed';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'Protected access roles cannot be deleted' THEN RAISE; END IF;
 END;
 BEGIN
  UPDATE access_roles SET is_protected=false WHERE key='ADMINISTRATOR';
  RAISE EXCEPTION 'Protection could be disabled';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'Protected access role identity and protection cannot be changed' THEN RAISE; END IF;
 END;
END $$;
INSERT INTO users VALUES ('new-user','STAFF');
UPDATE users SET role='ADMINISTRATOR' WHERE id='new-user';
DO $$ BEGIN
 IF (SELECT count(*) FROM user_roles WHERE user_id='new-user') <> 1 THEN RAISE EXCEPTION 'Compatibility sync duplicated roles'; END IF;
 IF NOT EXISTS (SELECT 1 FROM user_roles u JOIN access_roles r ON r.id=u.role_id WHERE u.user_id='new-user' AND r.key='ADMINISTRATOR') THEN RAISE EXCEPTION 'Compatibility sync missing'; END IF;
END $$;
INSERT INTO authorization_audit_events(id,actor_user_id,target_user_id,action) VALUES ('history','new-user','new-user','test');
DELETE FROM users WHERE id='new-user';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM authorization_audit_events WHERE id='history' AND target_user_id='new-user') THEN RAISE EXCEPTION 'History lost'; END IF;
END $$;''')
    print('PASS: migration, backfill, session preservation, Staff/Manager grants, protected roles, compatibility sync, history preservation')
finally:
    assert db.startswith('rbac_test_') and len(db) == 42
    sql('postgres', f'DROP DATABASE "{db}";')
