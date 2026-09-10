import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Administration — JIMI Industrie",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-[var(--color-surface-2)] text-[var(--color-text)]">
        {children}
      </body>
    </html>
  );
}
