-- Avant ce correctif, assigner/modifier une livraison sur un bon ne
-- répercutait jamais son montant facturé dans le transport du bon — le
-- total restait faux tant que le bon n'était pas retouché après le fix.
-- On resynchronise ici une bonne fois pour toutes les bons déjà liés à
-- une livraison, en rejouant exactement la même règle que le service :
-- transport = montant facturé de la livraison (0 si elle est annulée).

UPDATE "sales_vouchers" sv
SET "transportCost" = d."billedToCustomer"
FROM "deliveries" d
WHERE d."salesVoucherId" = sv."id" AND d."status" <> 'CANCELLED';

UPDATE "sales_vouchers" sv
SET "transportCost" = 0
FROM "deliveries" d
WHERE d."salesVoucherId" = sv."id" AND d."status" = 'CANCELLED';

UPDATE "purchase_vouchers" pv
SET "transportCost" = d."billedToManufacturer"
FROM "deliveries" d
WHERE d."purchaseVoucherId" = pv."id" AND d."status" <> 'CANCELLED';

UPDATE "purchase_vouchers" pv
SET "transportCost" = 0
FROM "deliveries" d
WHERE d."purchaseVoucherId" = pv."id" AND d."status" = 'CANCELLED';
