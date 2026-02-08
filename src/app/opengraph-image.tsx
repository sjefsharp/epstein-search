import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "DOJ Epstein Files Search";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        fontSize: 64,
        background: "linear-gradient(135deg, #18181b 0%, #27272a 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontFamily: "system-ui, sans-serif",
        padding: "80px",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "32px",
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          DOJ Epstein Files
        </div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 400,
            textAlign: "center",
            opacity: 0.9,
            lineHeight: 1.3,
          }}
        >
          AI-Powered Search &amp; Analysis
        </div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 300,
            textAlign: "center",
            opacity: 0.7,
            marginTop: "24px",
          }}
        >
          2,000+ Official Documents • Free &amp; Open Source
        </div>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
