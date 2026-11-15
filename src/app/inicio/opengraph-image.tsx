import { ImageResponse } from "next/og";

export const alt = "Nutritional Manager: sigue tu plan de alimentación sin volver a abrir el PDF";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "#f4f4f7", color: "#16171d" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 32, fontWeight: 700 }}>
          <div style={{ width: 64, height: 64, borderRadius: 9999, background: "#c8d9ef", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="64" height="64" viewBox="0 0 40 40" fill="none" stroke="#2f4e8c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 28V19" />
              <path d="M20 19c0-4.2-2.6-6.6-6.6-6.8 0 4 2.4 6.6 6.6 6.8Z" />
              <path d="M20 22.5c0-3.6 2.3-5.8 6-6 0 3.5-2.2 5.8-6 6Z" />
              <path d="M15.5 28h9" />
            </svg>
          </div>
          Nutritional Manager
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.03em" }}>Sigue tu plan de alimentación sin volver a abrir el PDF</div>
          <div style={{ fontSize: 32, color: "#6b6e7a" }}>Horarios, recetas y lista de compras desde el plan de tu nutriólogo.</div>
        </div>
      </div>
    ),
    size
  );
}
