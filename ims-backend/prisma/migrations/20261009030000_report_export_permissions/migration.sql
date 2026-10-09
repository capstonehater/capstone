BEGIN;
INSERT INTO "permissions" ("id", "key", "module", "label", "description") VALUES
('271a9f63-a438-42db-a830-360a14323001', 'reports.export.excel', 'reports', 'Export Excel', 'Download report data as an Excel file. Requires View reports.'),
('271a9f63-a438-42db-a830-360a14323002', 'reports.export.pdf', 'reports', 'Export PDF', 'Download or print report data as a PDF file. Requires View reports.');
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r.id, p.id FROM access_roles r CROSS JOIN permissions p
WHERE r.key = 'ADMINISTRATOR' AND p.key IN ('reports.export.excel', 'reports.export.pdf');
UPDATE access_roles SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE key = 'ADMINISTRATOR';
COMMIT;
