export default function AdminLoading() {
  return (
    <div className="route-loading route-loading-v416" role="status" aria-label="Loading page">
      <div className="route-loading-head">
        <span className="route-loading-kicker" />
        <span className="route-loading-title" />
        <span className="route-loading-copy" />
      </div>
      <div className="route-loading-grid" aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      <div className="route-loading-panel" aria-hidden="true">
        <span className="route-loading-panel-title" />
        <span /><span /><span />
      </div>
    </div>
  );
}
