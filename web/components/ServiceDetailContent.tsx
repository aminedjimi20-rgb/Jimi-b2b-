import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { MachineVideoPlayer } from "@/components/MachineVideoPlayer";
import { getServiceVideo } from "@/lib/serviceVideos";
import { CheckCircle2 } from "lucide-react";

export async function ServiceDetailContent({ serviceKey }: { serviceKey: "renovation" | "automation" | "maintenance" }) {
  const t = await getTranslations(`servicePages.${serviceKey}`);
  const tCta = await getTranslations("services.cta");
  const tVideo = await getTranslations("servicePages.video");
  const items = t.raw("items") as string[];
  const video = await getServiceVideo(serviceKey);

  return (
    <section className="py-14 md:py-20">
      <Container>
        <div className="mx-auto max-w-3xl">
          <p className="text-base leading-relaxed text-[var(--color-text)]">{t("intro")}</p>

          {video && (
            <div className="mt-8">
              <h2 className="mb-4 text-xl font-bold text-[var(--color-ink)]">{tVideo("title")}</h2>
              <MachineVideoPlayer
                videoUrl={video.videoUrl}
                videoThumbnail={video.videoThumbnail}
                videoTitle={video.videoTitle}
              />
            </div>
          )}

          <h2 className="mt-10 mb-5 text-xl font-bold text-[var(--color-ink)]">{t("whatWeDo")}</h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {items.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2.5 rounded-lg border border-[var(--color-border)] bg-white p-4 text-sm text-[var(--color-text)]"
              >
                <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-12 flex flex-col items-center gap-3 rounded-xl bg-[var(--color-surface-2)] px-6 py-10 text-center">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">{tCta("title")}</h2>
            <p className="max-w-md text-sm text-[var(--color-text-muted)]">{tCta("subtitle")}</p>
            <Button href="/contact">{tCta("button")}</Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
