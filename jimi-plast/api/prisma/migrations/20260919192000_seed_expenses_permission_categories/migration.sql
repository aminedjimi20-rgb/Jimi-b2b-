-- Grant the new expenses.manage permission to the admin role and seed a
-- starter set of expense categories, so the feature works immediately after
-- deploy without requiring a manual `npm run seed` on production.

INSERT INTO "permissions" ("id", "key", "label", "group")
VALUES ('perm_expenses_manage', 'expenses.manage', 'Gérer les frais généraux et la situation', 'finance')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("roleId", "permissionId")
SELECT r."id", p."id"
FROM "roles" r, "permissions" p
WHERE r."key" = 'admin' AND p."key" = 'expenses.manage'
ON CONFLICT DO NOTHING;

INSERT INTO "expense_categories" ("id", "name", "sortOrder")
VALUES
  ('expcat_electricite', 'Électricité', 0),
  ('expcat_reparation', 'Réparation / Panne', 1),
  ('expcat_renouvellement', 'Renouvellement / Équipement', 2),
  ('expcat_livraison', 'Livraison', 3),
  ('expcat_loyer', 'Loyer', 4),
  ('expcat_salaires', 'Salaires', 5),
  ('expcat_autre', 'Autre', 6)
ON CONFLICT ("name") DO NOTHING;
