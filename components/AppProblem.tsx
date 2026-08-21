"use client";

import Link from "next/link";

type AppProblemProps = {
  reset?: () => void;
  title?: string;
  message?: string;
  compact?: boolean;
};

export function AppProblem({
  reset,
  title = "MedScores needs a moment",
  message = "We ran into a temporary problem while loading this part of MedScores. Please try again. If the issue continues, the service may be undergoing maintenance.",
  compact = false,
}: AppProblemProps) {
  return (
    <section className={`app-problem${compact ? " is-compact" : ""}`} role="alert">
      <div className="app-problem-mark" aria-hidden="true">
        <img src="/logo.png" alt="" />
      </div>
      <div className="app-problem-copy">
        <span className="app-problem-label">Temporary interruption</span>
        <h1>{title}</h1>
        <p>{message}</p>
      </div>
      <div className="app-problem-actions">
        {reset && <button className="button button-primary" type="button" onClick={reset}>Try again</button>}
        <Link className="button button-secondary" href="/">Return to sign in</Link>
      </div>
      <small className="app-problem-note">If retrying does not help, check back shortly.</small>
    </section>
  );
}
