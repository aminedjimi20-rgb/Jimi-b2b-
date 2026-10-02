-- Avant le correctif de deliveries.service.ts (upsertForVoucher), facturer
-- un transport de livraison au client/fabricant sur un bon DÉJÀ CONFIRMÉ
-- mettait bien à jour transportCost sur le bon, mais jamais l'écriture
-- correspondante dans son compte : le total réel du bon (articles − remise
-- + transport) a pu dériver silencieusement de ce qui est réellement dû.
--
-- On rattrape ici l'écart pour les bons concernés, mais avec un critère
-- volontairement étroit — PAS un simple "total du bon − total au compte"
-- global : un bon peut légitimement avoir 0 article aujourd'hui (retour
-- traité, suppression approuvée...) sans que son historique de compte soit
-- faux pour autant, et reconstituer l'écart à l'aveugle risquerait d'écraser
-- une vraie dette par une correction fausse. On ne touche donc que les bons
-- qui vérifient TOUS ces critères, chacun réduisant le risque de faux
-- positif :
--   1. un transport de livraison est bien facturé dessus (transportCost > 0)
--   2. son compte n'a jamais reçu qu'UNE seule écriture SALE_VOUCHER /
--      PURCHASE_VOUCHER pour sa référence — jamais retouché depuis la
--      confirmation (un ajustement, un retour ou une modification
--      synchronisée en aurait ajouté une deuxième)
--   3. l'écart entre le total réel et cette écriture unique correspond
--      exactement (± 1 centime, arrondi) au montant du transport — la
--      signature exacte du bug, pas une dérive d'une autre origine
--
-- Un bon annulé n'apparaît jamais ici : exclu par le filtre de statut, son
-- écriture d'origine et son écriture ADJUSTMENT d'annulation restent
-- intactes.

WITH sales_totals AS (
  SELECT
    sv.id,
    sv.number,
    sv."customerId",
    sv."transportCost",
    COALESCE(SUM(svi."lineTotal"), 0) - sv.discount + sv."transportCost" AS actual_total
  FROM "sales_vouchers" sv
  LEFT JOIN "sales_voucher_items" svi ON svi."voucherId" = sv.id
  WHERE sv.status IN ('CONFIRMED', 'DELIVERED') AND sv."deletedAt" IS NULL AND sv.number IS NOT NULL
  GROUP BY sv.id, sv.number, sv."customerId", sv.discount, sv."transportCost"
),
sales_ledger_agg AS (
  SELECT reference, SUM(amount) AS ledgered_total, COUNT(*) AS entry_count
  FROM "ledger_entries"
  WHERE type = 'SALE_VOUCHER' AND "voidedAt" IS NULL AND reference IS NOT NULL
  GROUP BY reference
)
INSERT INTO "ledger_entries" (id, "customerId", type, amount, reference, note, "createdAt")
SELECT
  gen_random_uuid()::text,
  st."customerId",
  'SALE_VOUCHER',
  ROUND(st.actual_total - sla.ledgered_total, 2),
  st.number,
  'Rattrapage : transport de livraison facturé après confirmation, jamais reflété dans le compte client avant ce correctif',
  now()
FROM sales_totals st
JOIN sales_ledger_agg sla ON sla.reference = st.number
WHERE sla.entry_count = 1
  AND st."transportCost" > 0
  AND ABS(ROUND(st.actual_total - sla.ledgered_total, 2) - st."transportCost") < 0.01
  AND ROUND(st.actual_total - sla.ledgered_total, 2) > 0;

WITH purchase_totals AS (
  SELECT
    pv.id,
    pv.number,
    pv."manufacturerId",
    pv."transportCost",
    COALESCE(SUM(pvi."lineTotal"), 0) - pv.discount + pv."transportCost" AS actual_total
  FROM "purchase_vouchers" pv
  LEFT JOIN "purchase_voucher_items" pvi ON pvi."voucherId" = pv.id
  WHERE pv.status = 'CONFIRMED' AND pv."deletedAt" IS NULL AND pv.number IS NOT NULL
  GROUP BY pv.id, pv.number, pv."manufacturerId", pv.discount, pv."transportCost"
),
purchase_ledger_agg AS (
  SELECT reference, SUM(amount) AS ledgered_total, COUNT(*) AS entry_count
  FROM "supplier_ledger_entries"
  WHERE type = 'PURCHASE_VOUCHER' AND "voidedAt" IS NULL AND reference IS NOT NULL
  GROUP BY reference
)
INSERT INTO "supplier_ledger_entries" (id, "manufacturerId", type, amount, reference, note, "createdAt")
SELECT
  gen_random_uuid()::text,
  pt."manufacturerId",
  'PURCHASE_VOUCHER',
  ROUND(pt.actual_total - pla.ledgered_total, 2),
  pt.number,
  'Rattrapage : transport de livraison facturé après confirmation, jamais reflété dans le compte fabricant avant ce correctif',
  now()
FROM purchase_totals pt
JOIN purchase_ledger_agg pla ON pla.reference = pt.number
WHERE pla.entry_count = 1
  AND pt."transportCost" > 0
  AND ABS(ROUND(pt.actual_total - pla.ledgered_total, 2) - pt."transportCost") < 0.01
  AND ROUND(pt.actual_total - pla.ledgered_total, 2) > 0;
