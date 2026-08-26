import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://log-anything.shenedawatson1.chatgpt.site"),
  title: "MemoryDock",
  description: "MemoryDock turns quick voice and text entries into an organized picture of your meals, spending, habits, and life.",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  applicationName: "MemoryDock",
  appleWebApp: { capable: true, title: "MemoryDock", statusBarStyle: "default" },
  alternates: { canonical: "/" },
  openGraph: {
    title: "MemoryDock",
    description: "Say it. Save it. Find the pattern.",
    url: "https://log-anything.shenedawatson1.chatgpt.site",
    siteName: "MemoryDock",
    type: "website",
    images: [{ url: "https://log-anything.shenedawatson1.chatgpt.site/og.png", width: 1200, height: 630, alt: "MemoryDock — Say it. Save it. Find the pattern." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MemoryDock",
    description: "Say it. Save it. Find the pattern.",
    images: ["https://log-anything.shenedawatson1.chatgpt.site/og.png"],
  },
};

export const viewport: Viewport = { themeColor: "#315e47", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
