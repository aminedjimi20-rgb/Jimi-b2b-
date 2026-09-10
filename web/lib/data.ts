import machinesData from "@/data/machines.json";
import projectsData from "@/data/projects.json";
import articlesData from "@/data/articles.json";
import partsData from "@/data/parts.json";
import testimonialsData from "@/data/testimonials.json";
import type { Machine, Project, Article, Part, PartCategory, Testimonial } from "@/lib/types";
import { getRuntimeMachines } from "@/lib/machinesStore";
import { getRuntimeParts } from "@/lib/partsStore";
import { getRuntimeProjects } from "@/lib/projectsStore";
import { getRuntimeTestimonials } from "@/lib/testimonialsStore";

export async function getMachines(): Promise<Machine[]> {
  const runtime = await getRuntimeMachines();
  return [...runtime, ...(machinesData as Machine[])];
}

/** Machines visible on the public website: exactly status === "published",
 *  plus "reserved"/"sold" (still real, still shown, just no longer
 *  purchasable) — everything else (draft, pending, rejected) stays hidden. */
function isPublic(m: Machine): boolean {
  return m.status === "published" || m.status === "reserved" || m.status === "sold";
}

/** Machine shape allowed to reach a public page or a client component.
 *  Jimi acts as the intermediary between buyer and seller — the seller's
 *  identity and every internal admin-only field are dropped here, at the
 *  data layer, so no client bundle, RSC payload, or public API response can
 *  ever carry them (frontend-only hiding would not be enough). */
export type PublicMachine = Omit<Machine, "sellerId" | "adminNote" | "submittedAt" | "reviewedAt">;

// Deliberately an allow-list, not a deny-list: a new private field added to
// Machine later stays excluded by default instead of silently leaking here.
function toPublicMachine(m: Machine): PublicMachine {
  return {
    id: m.id,
    slug: m.slug,
    brand: m.brand,
    model: m.model,
    year: m.year,
    tonnage: m.tonnage,
    drive: m.drive,
    category: m.category,
    status: m.status,
    featured: m.featured,
    wilaya: m.wilaya,
    price: m.price,
    priceOnRequest: m.priceOnRequest,
    videoUrl: m.videoUrl,
    videoThumbnail: m.videoThumbnail,
    videoTitle: m.videoTitle,
    photos: m.photos,
    specs: m.specs,
    description: m.description,
    worksPerformed: m.worksPerformed,
    defects: m.defects,
    accessories: m.accessories,
    isDemo: m.isDemo,
    isPromo: m.isPromo,
  };
}

export async function getPublicMachines(): Promise<PublicMachine[]> {
  const machines = await getMachines();
  return machines.filter(isPublic).map(toPublicMachine);
}

export async function getMachineBySlug(slug: string): Promise<Machine | undefined> {
  const machines = await getMachines();
  return machines.find((m) => m.slug === slug);
}

export async function getPublicMachineBySlug(slug: string): Promise<PublicMachine | undefined> {
  const machines = await getPublicMachines();
  return machines.find((m) => m.slug === slug);
}

export async function getFeaturedMachines(limit = 6): Promise<PublicMachine[]> {
  const machines = await getPublicMachines();
  const featured = machines.filter((m) => m.featured);
  const pool = featured.length > 0 ? featured : machines;
  return pool.slice(0, limit);
}

/** Most recently added machines: runtime (admin/seller-added) listings come
 *  first in `getPublicMachines()`'s order — newest first — followed by the
 *  static demo catalog, so slicing the front gives the latest real
 *  additions without needing a separate "createdAt" field on PublicMachine. */
export async function getLatestMachines(limit = 4): Promise<PublicMachine[]> {
  const machines = await getPublicMachines();
  return machines.slice(0, limit);
}

export async function getMachineBrands(): Promise<string[]> {
  const machines = await getPublicMachines();
  return Array.from(new Set(machines.map((m) => m.brand))).sort();
}

export async function getProjects(): Promise<Project[]> {
  const runtime = await getRuntimeProjects();
  return [...runtime, ...(projectsData as Project[])];
}

export async function getPublicProjects(): Promise<Project[]> {
  const projects = await getProjects();
  return projects.filter((p) => p.status === "published");
}

export async function getProjectBySlug(slug: string): Promise<Project | undefined> {
  const projects = await getProjects();
  return projects.find((p) => p.slug === slug);
}

export async function getPublicProjectBySlug(slug: string): Promise<Project | undefined> {
  const projects = await getPublicProjects();
  return projects.find((p) => p.slug === slug);
}

interface RawArticleTranslation {
  title: string;
  excerpt: string;
  category: string;
  content: string[];
  relatedLinks?: { href: string; label: string }[];
  faq?: { q: string; a: string }[];
}

interface RawArticle {
  id: string;
  slug: string;
  readTimeMinutes: number;
  publishedAt: string;
  translations: Partial<Record<"fr" | "ar" | "en", RawArticleTranslation>>;
}

/** Résout un article brut (multi-langue) vers la forme locale plate que le
 *  reste du code attend — si la locale demandée n'a pas de traduction (cas
 *  des anciens articles, jamais traduits), on retombe sur le français
 *  plutôt que de casser l'affichage. */
function localizeArticle(raw: RawArticle, locale: string): Article {
  const translation =
    raw.translations[locale as "fr" | "ar" | "en"] ?? raw.translations.fr ?? Object.values(raw.translations)[0];
  return {
    id: raw.id,
    slug: raw.slug,
    title: translation!.title,
    excerpt: translation!.excerpt,
    category: translation!.category,
    content: translation!.content,
    readTimeMinutes: raw.readTimeMinutes,
    publishedAt: raw.publishedAt,
    relatedLinks: translation!.relatedLinks ?? [],
    faq: translation!.faq ?? [],
  };
}

export function getArticles(locale: string = "fr"): Article[] {
  return (articlesData as RawArticle[])
    .map((raw) => localizeArticle(raw, locale))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export function getArticleBySlug(locale: string, slug: string): Article | undefined {
  return getArticles(locale).find((a) => a.slug === slug);
}

export async function getParts(): Promise<Part[]> {
  const runtime = await getRuntimeParts();
  return [...runtime, ...(partsData as Part[])];
}

export async function getPublicParts(): Promise<Part[]> {
  const parts = await getParts();
  return parts.filter((p) => p.status === "published");
}

export async function getPublicPartsByCategory(category: PartCategory): Promise<Part[]> {
  const parts = await getPublicParts();
  return parts.filter((p) => p.category === category);
}

export async function getPublicPartBySlug(slug: string): Promise<Part | undefined> {
  const parts = await getPublicParts();
  return parts.find((p) => p.slug === slug);
}

/** Most recently added parts — same "runtime items come first" ordering as
 *  `getLatestMachines`. */
export async function getLatestParts(limit = 4): Promise<Part[]> {
  const parts = await getPublicParts();
  return parts.slice(0, limit);
}

export async function getTestimonials(): Promise<Testimonial[]> {
  const runtime = await getRuntimeTestimonials();
  return [...runtime, ...(testimonialsData as Testimonial[])];
}

export async function getPublicTestimonials(): Promise<Testimonial[]> {
  const testimonials = await getTestimonials();
  return testimonials.filter((t) => t.status === "published");
}
