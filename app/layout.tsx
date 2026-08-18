import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "MedScores | College of Medicine",
  description: "Academic performance portal for the College of Medicine.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MedScores" },
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export const viewport: Viewport = { themeColor: "#74108f" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><PwaRegister />{children}</body>
    </html>
  );
}
