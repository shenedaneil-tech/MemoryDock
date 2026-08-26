import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MemoryDock",
    short_name: "MemoryDock",
    description: "Say it. Save it. Find the pattern.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f2e9",
    theme_color: "#315e47",
    orientation: "portrait-primary",
    icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }],
  };
}
