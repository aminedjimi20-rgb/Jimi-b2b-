import { Fabricant, Prisma, PriceCategory, PriceTier, Product, ProductImage, ProductSalePrice } from '@prisma/client';
import { ResolvedPrice } from '../../pricing/pricing.service';

type ProductWithRelations = Product & {
  images: ProductImage[];
  priceTiers: PriceTier[];
  fabricant?: Fabricant | null;
  salePrices: (ProductSalePrice & { priceCategory: PriceCategory })[];
};

// Client view never needs salePrices/fabricant — kept separate so callers
// (e.g. FavoritesService) don't have to fetch admin-only relations just to
// satisfy the type.
type ProductForClient = Product & { images: ProductImage[]; priceTiers: PriceTier[] };

/** A price changed within the last week is flagged "Nouveau prix" — no separate stored flag, always derived. */
const NOUVEAU_PRIX_WINDOW_DAYS = 7;
function isRecent(date: Date | null, days: number): boolean {
  if (!date) return false;
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

export interface ProductDerivedInfo {
  dernierChangementPrix: Date | null;
  dernierArrivage: Date | null;
  estPromo: boolean;
}

/**
 * Allow-list mapper — Admin sees the full financial picture: purchase
 * price, margin (computed here, never stored redundantly), exact stock,
 * thresholds.
 */
export function toAdminProductDTO(product: ProductWithRelations, derived: ProductDerivedInfo) {
  const marge = product.prixVente.minus(product.prixAchat);
  const margePourcentage = product.prixAchat.isZero()
    ? new Prisma.Decimal(0)
    : marge.div(product.prixAchat).mul(100);

  return {
    id: product.id,
    nom: product.nom,
    code: product.code,
    categoryId: product.categoryId,
    fabricantId: product.fabricantId,
    fabricantNom: product.fabricant?.nom ?? null,
    description: product.description,
    taille: product.taille,
    couleur: product.couleur,
    marque: product.marque,
    prixAchat: product.prixAchat,
    prixVente: product.prixVente,
    marge,
    margePourcentage,
    stockReel: product.stockReel,
    stockMinimum: product.stockMinimum,
    minCommande: product.minCommande,
    uniteParCarton: product.uniteParCarton,
    actif: product.actif,
    estNouveau: product.estNouveau,
    estSaisonnier: product.estSaisonnier,
    estPromo: derived.estPromo,
    estNouveauPrix: isRecent(derived.dernierChangementPrix, NOUVEAU_PRIX_WINDOW_DAYS),
    dernierChangementPrix: derived.dernierChangementPrix,
    dernierArrivage: derived.dernierArrivage,
    images: product.images.map((img) => ({ id: img.id, url: img.url, isPrimary: img.isPrimary })),
    priceTiers: product.priceTiers.map((t) => ({ id: t.id, qteMin: t.qteMin, qteMax: t.qteMax, prix: t.prix })),
    salePrices: product.salePrices.map((sp) => ({
      priceCategoryId: sp.priceCategoryId,
      priceCategoryNom: sp.priceCategory.nom,
      prix: sp.prix,
    })),
  };
}

/**
 * Allow-list mapper — Client catalog view. Never includes prixAchat,
 * marge, stockReel or stockMinimum: only a derived availability status.
 * `prix` is the price already resolved for THIS client by PricingService
 * — the client never receives another client's price or the raw catalog
 * price when a custom price/promotion applies.
 */
export function toClientProductDTO(
  product: ProductForClient,
  resolved: ResolvedPrice,
  stockStatus: 'DISPONIBLE' | 'STOCK_LIMITE' | 'RUPTURE',
  estPromo: boolean,
) {
  return {
    id: product.id,
    nom: product.nom,
    code: product.code,
    categoryId: product.categoryId,
    description: product.description,
    taille: product.taille,
    couleur: product.couleur,
    marque: product.marque,
    prix: resolved.prix,
    prixSource: resolved.source,
    minCommande: product.minCommande,
    // Packaging info only (never stock exact) — needed to order by carton
    // when the client's price category is a wholesale one (see Phase 30).
    uniteParCarton: product.uniteParCarton,
    disponibilite: stockStatus,
    // Badges — purely informational, never expose purchase price/margin/stock exact.
    estNouveau: product.estNouveau,
    estSaisonnier: product.estSaisonnier,
    estPromo,
    images: product.images.map((img) => ({ id: img.id, url: img.url, isPrimary: img.isPrimary })),
    // Quantity price tiers ARE shown to the client (it's a public commercial condition),
    // but only prices — no stock/cost info rides along.
    grilleQuantite: product.priceTiers.map((t) => ({ qteMin: t.qteMin, qteMax: t.qteMax, prix: t.prix })),
  };
}

/**
 * Allow-list mapper — Employee view (preparing/counter-selling orders).
 * Sees real stock (needed to prepare/sell) and the normal sale price, but
 * NEVER prixAchat/marge — that stays Admin-only, same rule as the client.
 */
export function toEmployeeProductDTO(product: ProductWithRelations, derived: ProductDerivedInfo) {
  return {
    id: product.id,
    nom: product.nom,
    code: product.code,
    categoryId: product.categoryId,
    fabricantNom: product.fabricant?.nom ?? null,
    description: product.description,
    taille: product.taille,
    couleur: product.couleur,
    marque: product.marque,
    prixVente: product.prixVente,
    stockReel: product.stockReel,
    stockMinimum: product.stockMinimum,
    minCommande: product.minCommande,
    uniteParCarton: product.uniteParCarton,
    estNouveau: product.estNouveau,
    estSaisonnier: product.estSaisonnier,
    estPromo: derived.estPromo,
    // Never prixAchat/marge — but the arrival date is purely operational
    // (helps an employee spot what just came in), safe to expose.
    dernierArrivage: derived.dernierArrivage,
    images: product.images.map((img) => ({ id: img.id, url: img.url, isPrimary: img.isPrimary })),
    priceTiers: product.priceTiers.map((t) => ({ id: t.id, qteMin: t.qteMin, qteMax: t.qteMax, prix: t.prix })),
  };
}

export type AdminProductDTO = ReturnType<typeof toAdminProductDTO>;
export type ClientProductDTO = ReturnType<typeof toClientProductDTO>;
export type EmployeeProductDTO = ReturnType<typeof toEmployeeProductDTO>;
