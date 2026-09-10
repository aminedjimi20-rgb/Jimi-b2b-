import { redirect } from "next/navigation";
import { isAdminAuthenticated, usingDefaultPassword } from "@/lib/adminAuth";
import { getLeads } from "@/lib/leads";
import { getMachines, getParts, getProjects, getTestimonials, getAllArticlesRaw } from "@/lib/data";
import { getSellers } from "@/lib/sellers";
import { getBuyers } from "@/lib/buyers";
import { getMachineLeads } from "@/lib/machineLeads";
import { getServiceVideos } from "@/lib/serviceVideos";
import { getBusinessInfo } from "@/lib/businessInfoStore";
import { AdminTopBar } from "@/components/admin/AdminTopBar";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin");
  }

  const [
    leads,
    machines,
    sellers,
    buyers,
    machineLeads,
    parts,
    projects,
    articles,
    testimonials,
    serviceVideos,
    businessInfo,
  ] = await Promise.all([
    getLeads(),
    getMachines(),
    getSellers(),
    getBuyers(),
    getMachineLeads(),
    getParts(),
    getProjects(),
    getAllArticlesRaw(),
    getTestimonials(),
    getServiceVideos(),
    getBusinessInfo(),
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
        initialArticles={articles}
        initialTestimonials={testimonials}
        initialServiceVideos={serviceVideos}
        initialBusinessInfo={businessInfo}
        usingDefaultPassword={usingDefaultPassword()}
      />
    </>
  );
}
