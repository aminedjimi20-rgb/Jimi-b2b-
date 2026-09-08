import { redirect } from "next/navigation";
import { isAdminAuthenticated, usingDefaultPassword } from "@/lib/adminAuth";
import { getLeads } from "@/lib/leads";
import { getMachines, getParts, getProjects, getTestimonials } from "@/lib/data";
import { getSellers } from "@/lib/sellers";
import { getBuyers } from "@/lib/buyers";
import { getMachineLeads } from "@/lib/machineLeads";
import { getServiceVideos } from "@/lib/serviceVideos";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin");
  }

  const [leads, machines, sellers, buyers, machineLeads, parts, projects, testimonials, serviceVideos] =
    await Promise.all([
      getLeads(),
      getMachines(),
      getSellers(),
      getBuyers(),
      getMachineLeads(),
      getParts(),
      getProjects(),
      getTestimonials(),
      getServiceVideos(),
    ]);

  return (
    <>
      <AdminTopBar />
      <AdminDashboard
        initialLeads={leads}
        initialMachines={machines}
        initialSellers={sellers}
        initialBuyers={buyers}
        initialMachineLeads={machineLeads}
        initialParts={parts}
        initialProjects={projects}
        initialTestimonials={testimonials}
        initialServiceVideos={serviceVideos}
        usingDefaultPassword={usingDefaultPassword()}
      />
    </>
  );
}
