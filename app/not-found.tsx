import { AppProblem } from "@/components/AppProblem";

export default function NotFound() {
  return (
    <main className="app-problem-page">
      <AppProblem
        title="This page is not available"
        message="The page may have moved, the link may be outdated, or this section may not be available right now. Return to MedScores and continue from there."
      />
    </main>
  );
}
