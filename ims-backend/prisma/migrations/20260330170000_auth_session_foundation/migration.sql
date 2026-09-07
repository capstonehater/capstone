CREATE TYPE "Role" AS ENUM ('ADMINISTRATOR', 'SYSTEM_ADMINISTRATOR', 'STAFF');

ALTER TABLE "users" ADD COLUMN "role" "Role";

UPDATE "users" AS u
SET "role" = r."role_name"::"Role"
FROM "roles" AS r
WHERE u."role_id" = r."id";

ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "username" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);

UPDATE "users"
SET "email_verified_at" = CURRENT_TIMESTAMP
WHERE "email_verified" = true;

ALTER TABLE "users" ADD COLUMN "password_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "users" ADD COLUMN "last_login_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "locked_until" TIMESTAMP(3);
ALTER TABLE "users" DROP CONSTRAINT "users_role_id_fkey";
ALTER TABLE "users" DROP COLUMN "role_id";
ALTER TABLE "users" DROP COLUMN "email_verified";

DROP TABLE "login_sessions";
DROP TABLE "password_resets";
DROP TABLE "roles";

CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "idle_expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoke_reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "users_role_idx" ON "users"("role");
CREATE UNIQUE INDEX "auth_sessions_session_token_hash_key" ON "auth_sessions"("session_token_hash");
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE INDEX "auth_sessions_user_id_revoked_at_idx" ON "auth_sessions"("user_id", "revoked_at");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");
CREATE INDEX "auth_sessions_idle_expires_at_idx" ON "auth_sessions"("idle_expires_at");
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");
CREATE INDEX "email_verification_tokens_expires_at_idx" ON "email_verification_tokens"("expires_at");

ALTER TABLE "auth_sessions"
ADD CONSTRAINT "auth_sessions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "password_reset_tokens"
ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "email_verification_tokens"
ADD CONSTRAINT "email_verification_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
