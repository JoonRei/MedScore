"use client";

import { useState } from "react";

export function StudentWelcomeHeader({ codeName }: { codeName: string }) {
  const [revealed, setRevealed] = useState(false);

  const toggleReveal = () => setRevealed((current) => !current);

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
            data-codename-state={revealed ? "revealed" : "hidden"}
            onPointerUp={(event) => {
              // Pointer events are the most reliable path across touch PWAs, iOS Safari,
              // Android Chrome, pens, and mouse input. Prevent the synthesized click from
              // doing any additional work; keyboard activation is handled below via onClick.
              event.preventDefault();
              toggleReveal();
            }}
            onClick={(event) => {
              // Keyboard-initiated button clicks have detail === 0. Pointer activation is
              // already handled by onPointerUp above, so avoid toggling twice.
              if (event.detail === 0) toggleReveal();
            }}
          >
            <span className="student-codename-value-v423">{codeName}</span>
          </button>
        </h1>
        <p>Your latest scores and assessment activity in one place.</p>
      </div>
    </header>
  );
}
