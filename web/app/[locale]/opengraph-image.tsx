import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site.config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0a0f14 0%, #10181f 60%, #0a0f14 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "#ffffff18",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 800,
              color: "#0e6bd6",
            }}
          >
            J
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 30, fontWeight: 800 }}>JIMI</span>
            <span style={{ fontSize: 16, opacity: 0.7, letterSpacing: 2 }}>
              RENOVATION &amp; INSTALLATION
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
          <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.15 }}>
            Machines d&apos;injection plastique &amp; Automatisation industrielle
          </div>
          <div style={{ fontSize: 26, opacity: 0.75 }}>
            Rénovation · Retrofit · Maintenance · Achat &amp; vente de machines — Algérie
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {["Rénovation", "PLC / HMI", "Servo & Hydraulique", "Intermédiation"].map((tag) => (
            <div
              key={tag}
              style={{
                fontSize: 18,
                padding: "8px 18px",
                borderRadius: 999,
                background: "#ffffff14",
                border: "1px solid #ffffff2a",
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}

export const alt = siteConfig.companyName;
