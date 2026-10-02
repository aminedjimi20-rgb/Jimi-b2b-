-- Un bon de vente peut désormais exister sans client tant qu'il est en
-- brouillon (panier/proforma en préparation) — le client redevient
-- obligatoire dès la confirmation, appliquée côté application.
ALTER TABLE "sales_vouchers" ALTER COLUMN "customerId" DROP NOT NULL;
