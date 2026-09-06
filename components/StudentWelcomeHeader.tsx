"use client";

export function StudentWelcomeHeader({ codeName }: { codeName: string }) {
  return (
    <header className="page-header student-welcome-header-v442">
      <div>
        <div className="eyebrow">Student Portal</div>
        <h1>
          Welcome,{" "}
          <label className="student-codename-v442" title="Tap to reveal or hide your code name">
            <input type="checkbox" className="student-codename-toggle-v442" aria-label="Reveal or hide your code name" />
            <span className="student-codename-text-v442">{codeName}</span>
            <span className="student-codename-dots-v442" aria-hidden="true"><i /><i /><i /></span>
          </label>
        </h1>
        <p>Everything important from your subjects, results, and grades in one place.</p>
      </div>
    </header>
  );
}
