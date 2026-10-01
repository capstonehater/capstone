BEGIN;

-- CreateTable
CREATE TABLE "access_roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_protected" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_user_id" TEXT,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "authorization_audit_events" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "target_user_id" TEXT,
    "target_role_id" TEXT,
    "action" TEXT NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authorization_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_roles_key_key" ON "access_roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "access_roles_name_key" ON "access_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

-- CreateIndex
CREATE INDEX "user_roles_assigned_by_user_id_idx" ON "user_roles"("assigned_by_user_id");

-- CreateIndex
CREATE INDEX "authorization_audit_events_actor_user_id_created_at_idx" ON "authorization_audit_events"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "authorization_audit_events_target_user_id_created_at_idx" ON "authorization_audit_events"("target_user_id", "created_at");

-- CreateIndex
CREATE INDEX "authorization_audit_events_target_role_id_created_at_idx" ON "authorization_audit_events"("target_role_id", "created_at");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "access_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "access_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Code-managed catalog snapshot; future catalog changes require a new migration.
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('c1a4713d-f0e4-5180-a15d-c8737e0766f6','dashboard.view','dashboard','View dashboard','View dashboard metrics; endpoint-level report dependencies must be mapped before enforcement.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('d1e026d7-e669-5e58-939f-ef7872e8ee7f','products.view','products','View products','view access for products.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('bf83ab73-f25f-5d78-bba8-bcdaa7d5f9c8','products.create','products','Create products','create access for products.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('e418b05b-c038-5bd3-b8a7-86f47e46aeff','products.edit','products','Edit products','Edit products, variants and availability; existing recipe access follows product policy.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('17a6f50b-ec77-5b2e-9239-541b7e9cbeb6','products.archive','products','Archive products','archive access for products.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('4ae1c035-d262-5cc7-ba5a-d534194b4bdd','products.restore','products','Restore products','restore access for products.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('6393ed41-ca09-5063-8dfb-11a91d640fe5','products.delete','products','Delete products','delete access for products.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('08382ffa-fca6-578b-9b75-5d3042296c41','inventory.view','inventory','View inventory','view access for inventory.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('6f46ee1b-8427-581d-ae88-372ec56064d8','inventory.create','inventory','Create inventory','create access for inventory.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('9f8da332-b541-5e48-bfe9-506b15cfe2c1','inventory.edit','inventory','Edit inventory','edit access for inventory.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('b115ba64-8062-5232-84c9-871770b6fa17','inventory.archive','inventory','Archive inventory','archive access for inventory.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('f6a722f4-6c39-5523-9ad8-37b421662591','inventory.waste','inventory','Waste inventory','waste access for inventory.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('eca05d1f-55b2-5aac-a0d6-07b29cc7f661','stockRuns.view','stockRuns','View stockRuns','view access for stockRuns.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('0f8bb6e7-22eb-511a-8085-20c57be9ea76','stockRuns.create','stockRuns','Create stockRuns','create access for stockRuns.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('532d780d-61ed-5caa-a02e-8ed9136b6dd3','stockRuns.edit','stockRuns','Edit stockRuns','edit access for stockRuns.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('c16171ac-c1ef-584d-ac4c-d88eeee1e2b3','stockRuns.delete','stockRuns','Delete stockRuns','delete access for stockRuns.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('032cd30c-ee88-5d67-aab8-f5ff9422e6ed','stockRuns.post','stockRuns','Post stockRuns','post access for stockRuns.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('902ab831-c48b-5be3-a254-7d28a96fe39e','suppliers.view','suppliers','View suppliers','view access for suppliers.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('27c6f515-fb8f-57a2-ac03-f23eb2633455','suppliers.create','suppliers','Create suppliers','create access for suppliers.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('8affd625-4c71-5ddc-bcf1-090169621d7f','suppliers.edit','suppliers','Edit suppliers','edit access for suppliers.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('bee93c8c-fca9-55c8-bcb8-cc5a77201377','suppliers.delete','suppliers','Delete suppliers','delete access for suppliers.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('94e64c36-3ee3-5fc7-854e-fb77980f196d','suppliers.searchAvailability','suppliers','Search availability suppliers','searchAvailability access for suppliers.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('c70af1fe-ea0b-51ea-baae-0d0dbea74110','reports.view','reports','View reports','view access for reports.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('c2bbba30-8791-5f96-a5a6-0d293c27c178','forecasting.view','forecasting','View forecasting','view access for forecasting.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('7560acd2-47b0-5932-8fe8-fa7f66096cb8','users.view','users','View users','view access for users.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('835d10a8-d68c-524d-89e5-3cb269614460','users.manage','users','Manage users','Create, update, suspend, reactivate, reset and delete user accounts under existing safeguards.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('92fa4795-f3a4-5cd1-9cea-03b503bc8f6a','users.sessions.revoke','users','Sessions revoke users','Revoke user sessions.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('5ca44ef7-5dc5-5175-a5c5-16155c3672ee','pos.view','pos','View pos','view access for pos.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('03a61cb4-bc69-53b5-8ee4-15a834e70b95','pos.checkout','pos','Checkout pos','checkout access for pos.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('a1db1c70-e03e-539e-9ecd-97a682ec65cd','pos.orders.view','pos','Orders view pos','orders view access for pos.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('0e00482b-1194-572b-8955-fefa94a4447c','pos.refund','pos','Refund pos','refund access for pos.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('16beddcb-32f1-5739-be6d-72bf3fb0020e','alerts.view','alerts','View alerts','view access for alerts.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('2219dbc8-536a-5e63-83d7-a78841794006','alerts.acknowledge','alerts','Acknowledge alerts','acknowledge access for alerts.');
INSERT INTO "permissions" ("id","key","module","label","description") VALUES ('aa83eca7-ba3b-5318-a6fd-9d75f48af156','alerts.dismiss','alerts','Dismiss alerts','dismiss access for alerts.');
INSERT INTO "access_roles" ("id","key","name","description","is_system","is_protected","updated_at") VALUES ('607fe8eb-f749-5d3d-9bd0-0d00d22d0230','ADMINISTRATOR','Administrator','Legacy ADMINISTRATOR compatibility role',true,true,CURRENT_TIMESTAMP);
INSERT INTO "access_roles" ("id","key","name","description","is_system","is_protected","updated_at") VALUES ('7b85d49f-efe5-5ca5-8bbf-29323a80b9b7','STAFF','Staff','Legacy STAFF compatibility role',true,true,CURRENT_TIMESTAMP);
INSERT INTO "access_roles" ("id","key","name","description","is_system","is_protected","updated_at") VALUES ('084acfa4-bcc3-5636-9056-6b88d8f212ab','MANAGER','Manager','Legacy MANAGER compatibility role',true,true,CURRENT_TIMESTAMP);

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM access_roles r CROSS JOIN permissions p WHERE r.key = 'ADMINISTRATOR';
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM access_roles r CROSS JOIN permissions p
WHERE r.key = 'STAFF' AND p.key IN (
'inventory.view','inventory.waste','suppliers.view',
'stockRuns.view','stockRuns.create','stockRuns.edit','stockRuns.delete','stockRuns.post',
'pos.view','pos.checkout','pos.orders.view','pos.refund');
-- Manager retains the currently authenticated-only catalog/POS capabilities.
-- Self-account access remains session-based; it is not settings.manage.
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM access_roles r CROSS JOIN permissions p
WHERE r.key = 'MANAGER' AND p.key IN ('pos.view','pos.checkout');

INSERT INTO "user_roles" ("user_id", "role_id")
SELECT u.id, r.id FROM users u JOIN access_roles r ON r.key = u.role::text;

-- Keep compatibility memberships aligned with existing account creation/role edits.
-- Does not create a role assignment API or change the authority of legacy guards.
CREATE FUNCTION sync_legacy_access_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.role = NEW.role THEN RETURN NEW; END IF;
    DELETE FROM user_roles WHERE user_id = NEW.id
      AND role_id = (SELECT id FROM access_roles WHERE key = OLD.role::text AND is_system);
  END IF;
  INSERT INTO user_roles (user_id, role_id)
    SELECT NEW.id, id FROM access_roles WHERE key = NEW.role::text AND is_system
    ON CONFLICT (user_id, role_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER users_sync_legacy_access_role AFTER INSERT OR UPDATE OF role ON users
FOR EACH ROW EXECUTE FUNCTION sync_legacy_access_role();

-- Even an empty protected role cannot be deleted by a future accidental DELETE.
CREATE FUNCTION protect_system_access_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_protected THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Protected access roles cannot be deleted';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.key IS DISTINCT FROM OLD.key
      OR NOT NEW.is_protected OR NEW.is_system IS DISTINCT FROM OLD.is_system THEN
      RAISE EXCEPTION 'Protected access role identity and protection cannot be changed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER access_roles_protect BEFORE DELETE OR UPDATE ON access_roles
FOR EACH ROW EXECUTE FUNCTION protect_system_access_role();
COMMIT;
