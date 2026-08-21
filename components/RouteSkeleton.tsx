export function RouteSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`medscores-skeleton-page${compact ? " is-compact" : ""}`} role="status" aria-live="polite" aria-label="Loading MedScores">
      <div className="medscores-skeleton-head">
        <span className="skeleton-block skeleton-kicker" />
        <span className="skeleton-block skeleton-title" />
        <span className="skeleton-block skeleton-copy" />
      </div>

      <div className="medscores-skeleton-stats" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="medscores-skeleton-stat" key={index}>
            <span className="skeleton-block skeleton-stat-label" />
            <span className="skeleton-block skeleton-stat-value" />
            <span className="skeleton-block skeleton-stat-note" />
          </div>
        ))}
      </div>

      <div className="medscores-skeleton-content" aria-hidden="true">
        <div className="medscores-skeleton-content-head">
          <span className="skeleton-block skeleton-section-title" />
          <span className="skeleton-block skeleton-section-action" />
        </div>
        <div className="medscores-skeleton-rows">
          {Array.from({ length: compact ? 3 : 4 }, (_, index) => (
            <div className="medscores-skeleton-row" key={index}>
              <span className="skeleton-block skeleton-row-main" />
              <span className="skeleton-block skeleton-row-side" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
