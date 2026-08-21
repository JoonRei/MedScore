"use client";

import { useEffect } from "react";
import { AppProblem } from "@/components/AppProblem";

export default function AdminPortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("MedScores admin portal error", error);
  }, [error]);

  return <AppProblem reset={reset} compact />;
}
