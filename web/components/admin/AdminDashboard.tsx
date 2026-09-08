"use client";

import { useState } from "react";
import { LeadsTab } from "./LeadsTab";
import { MachinesTab } from "./MachinesTab";
import { PendingListingsTab } from "./PendingListingsTab";
import { SellersTab } from "./SellersTab";
import { BuyersTab } from "./BuyersTab";
import { MachineLeadsTab } from "./MachineLeadsTab";
import { PartsTab } from "./PartsTab";
import { ProjectsTab } from "./ProjectsTab";
import { SettingsTab } from "./SettingsTab";
import type { Lead } from "@/lib/leads";
import type { Machine, Part, Project } from "@/lib/types";
import type { SellerProfile } from "@/lib/sellers";
import type { BuyerProfile } from "@/lib/buyers";
import type { MachineLead } from "@/lib/machineLeads";
import type { ServiceVideos } from "@/lib/serviceVideos";
import {
  Inbox,
  Factory,
  Settings2,
  ClipboardCheck,
  Users,
  UserSquare2,
  Handshake,
  Cog,
  ClipboardList,
} from "lucide-react";

type Tab =
  | "leads"
  | "pending"
  | "machines"
  | "parts"
  | "projects"
  | "sellers"
  | "buyers"
  | "machineLeads"
  | "settings";

export function AdminDashboard({
  initialLeads,
  initialMachines,
  initialSellers,
  initialBuyers,
  initialMachineLeads,
  initialParts,
  initialProjects,
  initialServiceVideos,
  usingDefaultPassword,
}: {
  initialLeads: Lead[];
  initialMachines: Machine[];
  initialSellers: SellerProfile[];
  initialBuyers: BuyerProfile[];
  initialMachineLeads: MachineLead[];
  initialParts: Part[];
  initialProjects: Project[];
  initialServiceVideos: ServiceVideos;
  usingDefaultPassword: boolean;
}) {
  const [tab, setTab] = useState<Tab>("leads");

  const pendingMachines = initialMachines.filter((m) => m.status === "pending" || m.status === "draft");

  const tabs: { key: Tab; label: string; icon: typeof Inbox; count?: number }[] = [
    { key: "leads", label: "Demandes reçues", icon: Inbox, count: initialLeads.length },
    { key: "pending", label: "Annonces à valider", icon: ClipboardCheck, count: pendingMachines.length },
    { key: "machineLeads", label: "Leads", icon: Handshake, count: initialMachineLeads.length },
    { key: "machines", label: "Machines", icon: Factory, count: initialMachines.length },
    { key: "parts", label: "Pièces", icon: Cog, count: initialParts.length },
    { key: "projects", label: "Réalisations", icon: ClipboardList, count: initialProjects.length },
    { key: "sellers", label: "Vendeurs", icon: UserSquare2, count: initialSellers.length },
    { key: "buyers", label: "Acheteurs", icon: Users, count: initialBuyers.length },
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
      {tab === "pending" && (
        <PendingListingsTab initialMachines={pendingMachines} sellers={initialSellers} />
      )}
      {tab === "machineLeads" && (
        <MachineLeadsTab
          initialLeads={initialMachineLeads}
          sellers={initialSellers}
          buyers={initialBuyers}
        />
      )}
      {tab === "machines" && <MachinesTab initialMachines={initialMachines} />}
      {tab === "parts" && <PartsTab initialParts={initialParts} />}
      {tab === "projects" && <ProjectsTab initialProjects={initialProjects} />}
      {tab === "sellers" && <SellersTab initialSellers={initialSellers} machines={initialMachines} />}
      {tab === "buyers" && <BuyersTab initialBuyers={initialBuyers} leads={initialMachineLeads} />}
      {tab === "settings" && (
        <SettingsTab usingDefaultPassword={usingDefaultPassword} initialServiceVideos={initialServiceVideos} />
      )}
    </div>
  );
}
