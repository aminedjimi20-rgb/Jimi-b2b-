import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { absoluteUrl } from "@/lib/seo";

export interface BreadcrumbItem {
  label: string;
  /** Relative path (e.g. "/machines"). Omit for the current page (last item). */
  href?: string;
}

/** Visible breadcrumb trail + matching BreadcrumbList JSON-LD. `items[0]`
 *  is expected to be the home page and the last item the current page
 *  (no href). */
export function Breadcrumbs({ items, locale }: { items: BreadcrumbItem[]; locale: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href, locale) } : {}),
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
        <div className="container-jimi flex flex-wrap items-center gap-1.5 py-2.5 text-xs text-[var(--color-text-muted)]">
          {items.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={12} className="shrink-0 rtl:rotate-180" />}
              {item.href ? (
                <Link href={item.href} className="hover:text-[var(--color-accent)] hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className="font-medium text-[var(--color-text)]">{item.label}</span>
              )}
            </span>
          ))}
        </div>
      </nav>
    </>
  );
}
