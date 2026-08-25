"use client";

import { useState } from "react";

export function StudentWelcomeHeader({ codeName }: { codeName: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">Student Portal</div>
        <h1>
          Welcome,{" "}
          <button
            type="button"
            className={`student-codename-privacy-v423${revealed ? " is-revealed" : ""}`}
            aria-pressed={revealed}
            aria-label={revealed ? "Hide code name" : "Reveal code name"}
            title={revealed ? "Tap to hide code name" : "Tap to reveal code name"}
            onClick={() => setRevealed((current) => !current)}
          >
            <span className="student-codename-value-v423">{codeName}</span>
          </button>
        </h1>
        <p>Your latest scores and assessment activity in one place.</p>
      </div>
    </header>
  );
}
