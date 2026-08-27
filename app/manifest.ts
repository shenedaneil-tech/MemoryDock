import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.GITHUB_PAGES === "true"
    ? `/${process.env.GITHUB_REPOSITORY?.split("/")[1] || "MemoryDock"}`
    : "";

  return {
    name: "MemoryDock",
    short_name: "MemoryDock",
    description: "Say it. Save it. Find the pattern.",
    start_url: `${basePath}/`,
    display: "standalone",
    background_color: "#f5f2e9",
    theme_color: "#315e47",
    orientation: "portrait-primary",
    icons: [
      { src: `${basePath}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: `${basePath}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any maskable" },
      { src: `${basePath}/favicon.svg`, sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
