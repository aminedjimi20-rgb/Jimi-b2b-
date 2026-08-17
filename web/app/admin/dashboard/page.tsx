import { redirect } from "next/navigation";
import { isAdminAuthenticated, usingDefaultPassword } from "@/lib/adminAuth";
import { getLeads } from "@/lib/leads";
import { getMachines } from "@/lib/data";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin");
  }

  const [leads, machines] = await Promise.all([getLeads(), getMachines()]);

  return (
    <>
      <AdminTopBar />
      <AdminDashboard
        initialLeads={leads}
        initialMachines={machines}
        usingDefaultPassword={usingDefaultPassword()}
      />
    </>
  );
}
