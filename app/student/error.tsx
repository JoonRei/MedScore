"use client";

import { useEffect } from "react";
import { AppProblem } from "@/components/AppProblem";

export default function StudentPortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("MedScores student portal error", error);
  }, [error]);

  return <AppProblem reset={reset} compact />;
}
