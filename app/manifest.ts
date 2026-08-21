import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MedScores | College of Medicine",
    short_name: "MedScores",
    description: "Academic performance portal for the College of Medicine.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#74108f",
    icons: [
      { src: "/logo.png?v=419", sizes: "any", type: "image/png", purpose: "any" },
    ],
  };
}
