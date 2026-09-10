import { notFound } from "next/navigation";

/** Sans ce catch-all, une URL sous [locale] qui ne correspond à aucune page
 *  (typo, ancien lien, bot) n'est matchée par aucun segment de route et
 *  Next.js sert son shell de 404 générique au lieu du app/[locale]/not-found.tsx
 *  de la marque — en forçant le match ici, on déclenche ce not-found.tsx. */
export default function CatchAll(): never {
  notFound();
}
