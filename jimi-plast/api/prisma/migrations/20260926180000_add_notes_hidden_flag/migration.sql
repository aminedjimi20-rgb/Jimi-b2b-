-- Note générale (champ "notes" existant) affichée directement sur la fiche
-- client/fabricant, avec repli d'affichage possible sans perdre le texte.
ALTER TABLE "customers" ADD COLUMN "notesHidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "manufacturers" ADD COLUMN "notesHidden" BOOLEAN NOT NULL DEFAULT false;
