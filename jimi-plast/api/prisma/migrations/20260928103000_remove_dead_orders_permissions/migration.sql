-- "orders.create"/"orders.edit" ("Commandes") were never checked anywhere
-- in the codebase — only "vouchers.create"/"vouchers.edit" ("Bons") gate
-- anything real. Removing the dead permission rows also cleans up the
-- confusing "COMMANDES" group in the permissions matrix UI. Cascades to
-- role_permissions/user_permissions automatically (onDelete: Cascade).
DELETE FROM "permissions" WHERE "key" IN ('orders.create', 'orders.edit');
