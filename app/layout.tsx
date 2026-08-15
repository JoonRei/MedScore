import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedScores | College of Medicine",
  description: "Private academic performance portal for the College of Medicine.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
