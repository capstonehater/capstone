// Unit tests use mocked database clients and never need deployment credentials.
process.env.NODE_ENV = 'test';
process.env.SESSION_TOKEN_SECRET = 'unit-test-only-session-secret';
process.env.RESET_TOKEN_SECRET = 'unit-test-only-reset-secret';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/unit_tests';
process.env.ENABLE_BACKGROUND_JOBS = 'false';
