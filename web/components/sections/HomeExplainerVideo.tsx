import { getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { MachineVideoPlayer } from "@/components/MachineVideoPlayer";
import { getHomeVideo } from "@/lib/homeVideoStore";

export async function HomeExplainerVideo() {
  const video = await getHomeVideo();
  if (!video.videoUrl) return null;

  const t = await getTranslations("explainerVideo");

  return (
    <section className="py-14 md:py-20">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-[var(--color-ink)] md:text-3xl">
            {video.videoTitle || t("title")}
          </h2>
          <p className="mt-3 text-[var(--color-text-muted)]">{t("subtitle")}</p>
        </div>
        <div className="mx-auto mt-8 max-w-3xl">
          <MachineVideoPlayer videoUrl={video.videoUrl} videoTitle={video.videoTitle} />
        </div>
      </Container>
    </section>
  );
}
