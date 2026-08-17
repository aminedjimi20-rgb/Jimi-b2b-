"use client";

import { useState } from "react";
import { LeadsTab } from "./LeadsTab";
import { MachinesTab } from "./MachinesTab";
import { PendingListingsTab } from "./PendingListingsTab";
import { SettingsTab } from "./SettingsTab";
import type { Lead } from "@/lib/leads";
import type { Machine } from "@/lib/types";
import { Inbox, Factory, Settings2, ClipboardCheck } from "lucide-react";

type Tab = "leads" | "pending" | "machines" | "settings";

export function AdminDashboard({
  initialLeads,
  initialMachines,
  usingDefaultPassword,
}: {
  initialLeads: Lead[];
  initialMachines: Machine[];
  usingDefaultPassword: boolean;
}) {
  const [tab, setTab] = useState<Tab>("leads");

  const pendingMachines = initialMachines.filter(
    (m) => m.moderationStatus === "pending" || m.moderationStatus === "draft"
  );

  const tabs: { key: Tab; label: string; icon: typeof Inbox; count?: number }[] = [
    { key: "leads", label: "Demandes reçues", icon: Inbox, count: initialLeads.length },
    { key: "pending", label: "Annonces à valider", icon: ClipboardCheck, count: pendingMachines.length },
    { key: "machines", label: "Machines", icon: Factory, count: initialMachines.length },
    { key: "settings", label: "Paramètres", icon: Settings2 },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="mb-6 flex gap-2 overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === key
                ? "bg-[var(--color-ink)] text-white"
                : "bg-white text-[var(--color-text)] ring-1 ring-[var(--color-border)] hover:ring-[var(--color-accent)]"
            }`}
          >
            <Icon size={15} />
            {label}
            {typeof count === "number" && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs ${
                  tab === key ? "bg-white/20" : "bg-[var(--color-surface-2)]"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "leads" && <LeadsTab initialLeads={initialLeads} />}
      {tab === "pending" && <PendingListingsTab initialMachines={pendingMachines} />}
      {tab === "machines" && <MachinesTab initialMachines={initialMachines} />}
      {tab === "settings" && <SettingsTab usingDefaultPassword={usingDefaultPassword} />}
    </div>
  );
}
