"use client";

export function StudentWelcomeHeader({ codeName }: { codeName: string }) {
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">Student Portal</div>
        <h1>
          Welcome,{" "}
          <label
            className="student-codename-privacy-v423 student-codename-native-v423"
            title="Tap to reveal or hide code name"
          >
            <input
              type="checkbox"
              className="student-codename-toggle-v423"
              aria-label="Reveal or hide code name"
            />
            <span className="student-codename-value-v423">{codeName}</span>
            <span className="student-codename-mask-v423" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
          </label>
        </h1>
        <p>Your latest scores and assessment activity in one place.</p>
      </div>
    </header>
  );
}
