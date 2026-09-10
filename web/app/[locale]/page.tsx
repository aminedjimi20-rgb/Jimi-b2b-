import { setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/sections/Hero";
import { QuickCta } from "@/components/sections/QuickCta";
import { MainCategories } from "@/components/sections/MainCategories";
import { FeaturedMachines } from "@/components/sections/FeaturedMachines";
import { NewArrivals } from "@/components/sections/NewArrivals";
import { ServicesOverview } from "@/components/sections/ServicesOverview";
import { WhyUs } from "@/components/sections/WhyUs";
import { Intermediation } from "@/components/sections/Intermediation";
import { BeforeAfter } from "@/components/sections/BeforeAfter";
import { RealisationsPreview } from "@/components/sections/RealisationsPreview";
import { ProcessTimeline } from "@/components/sections/ProcessTimeline";
import { Testimonials } from "@/components/sections/Testimonials";
import { FaqSection } from "@/components/sections/FaqSection";
import { FinalCta } from "@/components/sections/FinalCta";
import { ContactSection } from "@/components/sections/ContactSection";

export const dynamic = "force-dynamic";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <Hero />
      <QuickCta />
      <MainCategories />
      <FeaturedMachines />
      <NewArrivals />
      <ServicesOverview />
      <WhyUs />
      <Intermediation />
      <BeforeAfter />
      <RealisationsPreview />
      <ProcessTimeline />
      <Testimonials />
      <FaqSection />
      <FinalCta />
      <ContactSection />
    </>
  );
}
