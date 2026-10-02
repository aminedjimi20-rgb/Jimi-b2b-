-- La migration précédente (20260926163000) ne rattrapait que la signature
-- exacte du bug de transport de livraison. Un autre cas, plus ancien,
-- cause la même dérive : avant l'ajout de la synchronisation de l'écart de
-- total dans le compte (les commits "Fix : le total du bon... n'entrait
-- jamais dans le compte client/fabricant"), modifier les articles d'un bon
-- déjà confirmé changeait son total réel sans jamais toucher son compte.
-- Exemple observé : un bon confirmé à 40 pièces (2 600 DA), puis remonté à
-- plusieurs reprises jusqu'à 155 pièces (23 240 DA) avant l'existence de
-- cette synchronisation — le compte est resté figé sur 2 600 DA.
--
-- On rattrape ici l'écart pour tout bon confirmé/livré qui a AU MOINS UN
-- ARTICLE aujourd'hui et dont le total réel ne correspond plus à la somme
-- de son compte. Le filtre "au moins un article" est la garde-fou clé :
-- un bon confirmé sans aucun article n'est jamais une vente/un achat réel
-- au sens du compte — quand ce cas existe (données de test/seed
-- anciennes), reconstituer l'écart à l'aveugle écraserait à tort un solde
-- réel par une correction fausse. Un bon avec au moins un article, en
-- revanche, ne peut avoir un compte différent de son total réel que par
-- une dérive historique de ce type — jamais une situation légitime.
--
-- Un bon annulé n'apparaît jamais ici (exclu par le filtre de statut) : son
-- écriture d'origine et son écriture ADJUSTMENT d'annulation restent
-- intactes. Les bons déjà rattrapés par la migration précédente n'ont plus
-- d'écart et ne réapparaissent pas ici.

WITH sales_totals AS (
  SELECT
    sv.id,
    sv.number,
    sv."customerId",
    COUNT(svi.id) AS item_count,
    COALESCE(SUM(svi."lineTotal"), 0) - sv.discount + sv."transportCost" AS actual_total
  FROM "sales_vouchers" sv
  LEFT JOIN "sales_voucher_items" svi ON svi."voucherId" = sv.id
  WHERE sv.status IN ('CONFIRMED', 'DELIVERED') AND sv."deletedAt" IS NULL AND sv.number IS NOT NULL
  GROUP BY sv.id, sv.number, sv."customerId", sv.discount, sv."transportCost"
),
sales_ledgered AS (
  SELECT reference, SUM(amount) AS ledgered_total
  FROM "ledger_entries"
  WHERE type = 'SALE_VOUCHER' AND "voidedAt" IS NULL AND reference IS NOT NULL
  GROUP BY reference
)
INSERT INTO "ledger_entries" (id, "customerId", type, amount, reference, note, "createdAt")
SELECT
  gen_random_uuid()::text,
  st."customerId",
  'SALE_VOUCHER',
  ROUND(st.actual_total - COALESCE(sl.ledgered_total, 0), 2),
  st.number,
  'Rattrapage : le bon a été modifié après confirmation avant que ces changements ne soient répercutés dans le compte client — écart comblé ici',
  now()
FROM sales_totals st
LEFT JOIN sales_ledgered sl ON sl.reference = st.number
WHERE st.item_count > 0
  AND ROUND(st.actual_total - COALESCE(sl.ledgered_total, 0), 2) <> 0;

WITH purchase_totals AS (
  SELECT
    pv.id,
    pv.number,
    pv."manufacturerId",
    COUNT(pvi.id) AS item_count,
    COALESCE(SUM(pvi."lineTotal"), 0) - pv.discount + pv."transportCost" AS actual_total
  FROM "purchase_vouchers" pv
  LEFT JOIN "purchase_voucher_items" pvi ON pvi."voucherId" = pv.id
  WHERE pv.status = 'CONFIRMED' AND pv."deletedAt" IS NULL AND pv.number IS NOT NULL
  GROUP BY pv.id, pv.number, pv."manufacturerId", pv.discount, pv."transportCost"
),
purchase_ledgered AS (
  SELECT reference, SUM(amount) AS ledgered_total
  FROM "supplier_ledger_entries"
  WHERE type = 'PURCHASE_VOUCHER' AND "voidedAt" IS NULL AND reference IS NOT NULL
  GROUP BY reference
)
INSERT INTO "supplier_ledger_entries" (id, "manufacturerId", type, amount, reference, note, "createdAt")
SELECT
  gen_random_uuid()::text,
  pt."manufacturerId",
  'PURCHASE_VOUCHER',
  ROUND(pt.actual_total - COALESCE(pl.ledgered_total, 0), 2),
  pt.number,
  'Rattrapage : le bon a été modifié après confirmation avant que ces changements ne soient répercutés dans le compte fabricant — écart comblé ici',
  now()
FROM purchase_totals pt
LEFT JOIN purchase_ledgered pl ON pl.reference = pt.number
WHERE pt.item_count > 0
  AND ROUND(pt.actual_total - COALESCE(pl.ledgered_total, 0), 2) <> 0;
