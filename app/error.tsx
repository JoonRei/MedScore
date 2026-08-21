"use client";

import { useEffect } from "react";
import { AppProblem } from "@/components/AppProblem";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("MedScores page error", error);
  }, [error]);

  return (
    <main className="app-problem-page">
      <AppProblem reset={reset} />
    </main>
  );
}
