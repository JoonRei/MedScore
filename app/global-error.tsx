"use client";

import { useEffect } from "react";
import { AppProblem } from "@/components/AppProblem";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("MedScores global error", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="app-problem-page">
          <AppProblem reset={reset} />
        </main>
      </body>
    </html>
  );
}
