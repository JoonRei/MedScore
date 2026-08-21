"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";

export type StudentResultRow = {
  id: string;
  title: string;
  type: string;
  date: string;
  total: number;
  score: number | null;
  passing: number | null;
  status: "scored" | "absent" | "not_entered";
  doctor: string | null;
  subject: string;
  isNew?: boolean;
  classStats?: { low: number; mean: number; high: number; count: number } | null;
};

function formatScoreValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function rangePosition(value: number, low: number, high: number) {
  if (!Number.isFinite(value) || high <= low) return 50;
  return Math.max(0, Math.min(100, ((value - low) / (high - low)) * 100));
}

function ScoreDistribution({ row, compact = false }: { row: StudentResultRow; compact?: boolean }) {
  if (row.status !== "scored" || row.score == null || !row.classStats) return null;
  const { low, mean, high } = row.classStats;
  const style = {
    "--student-score-position": `${rangePosition(Number(row.score), low, high)}%`,
    "--student-mean-position": `${rangePosition(mean, low, high)}%`,
  } as CSSProperties;

  return (
    <div className={`student-score-distribution${compact ? " is-compact" : ""}`} style={style}>
      <div className="student-score-range" aria-hidden="true">
        <span className="student-score-range-line" />
        <span className="student-score-mean-marker" />
        <span className="student-score-own-marker" />
      </div>
      <div className="student-score-range-labels">
        <div><span>Low</span><strong>{formatScoreValue(low)}</strong></div>
        <div className="is-mean"><span>Mean</span><strong>{formatScoreValue(mean)}</strong></div>
        <div><span>High</span><strong>{formatScoreValue(high)}</strong></div>
      </div>
    </div>
  );
}

export function StudentResultsClient({ rows, initialOpenId = "" }: { rows: StudentResultRow[]; initialOpenId?: string }) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [type, setType] = useState("all");
  const [openResult, setOpenResult] = useState<StudentResultRow | null>(null);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!initialOpenId) return;
    const match = rows.find((row) => row.id === initialOpenId);
    if (match) setOpenResult(match);
  }, [initialOpenId, rows]);

  const subjectOptions = useMemo(() => [{ value: "all", label: "All subjects" }, ...Array.from(new Set(rows.map((row) => row.subject))).sort().map((value) => ({ value, label: value }))], [rows]);
  const typeOptions = useMemo(() => [{ value: "all", label: "All assessment types" }, ...Array.from(new Set(rows.map((row) => row.type))).sort().map((value) => ({ value, label: value }))], [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    const q = query.trim().toLowerCase();
    return (!q || `${row.title} ${row.subject} ${row.type} ${row.doctor || ""}`.toLowerCase().includes(q)) && (subject === "all" || row.subject === subject) && (type === "all" || row.type === type);
  }), [rows, query, subject, type]);

  const scoredRows = useMemo(() => rows.filter((row) => row.status === "scored" && row.score != null), [rows]);
  const passingRows = useMemo(() => scoredRows.filter((row) => row.passing != null), [scoredRows]);
  const passedCount = useMemo(() => passingRows.filter((row) => Number(row.score) >= Number(row.passing)).length, [passingRows]);
  const absentCount = rows.filter((row) => row.status === "absent").length;

  async function viewResult(row: StudentResultRow) {
    setOpenResult(row);
    if (!row.isNew || viewedIds.has(row.id)) return;
    setViewedIds((current) => new Set(current).add(row.id));
    window.dispatchEvent(new CustomEvent("medscores:result-viewed", { detail: { assessmentId: row.id } }));
    await fetch(`/api/student/results/${row.id}/view`, { method: "POST" }).catch(() => undefined);
  }

  if (!rows.length) return <EmptyState title="No results yet" description="Your recorded scores will appear here when they are ready." />;

  return <>
    <div className="student-results-summary student-v2-results-summary">
      <div><span>Entries</span><strong>{rows.length}</strong></div>
      <div><span>Scored results</span><strong>{scoredRows.length}</strong></div>
      <div><span>Passed</span><strong>{passingRows.length ? `${passedCount}/${passingRows.length}` : "—"}</strong></div>
      <div><span>Did not take</span><strong>{absentCount}</strong></div>
    </div>

    <div className="student-filterbar student-v2-filterbar">
      <div className="search-box"><SearchIcon size={17} /><input className="input" placeholder="Search results" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      <CustomSelect value={subject} onChange={setSubject} options={subjectOptions} searchable />
      <CustomSelect value={type} onChange={setType} options={typeOptions} searchable />
      <span className="filter-count">{filtered.length} results</span>
    </div>

    {filtered.length ? <section className="student-results-card-grid" aria-label="Assessment results">
      {filtered.map((row) => {
        const absent = row.status === "absent";
        const notEntered = row.status === "not_entered" || (!absent && row.score == null);
        const hasScore = !absent && !notEntered && row.score != null;
        const hasPass = hasScore && row.passing != null;
        const passed = hasPass && Number(row.score) >= Number(row.passing);
        const resultLabel = absent ? "Did not take" : notEntered ? "Not entered" : hasPass ? (passed ? "Passed" : "Below passing") : "Recorded";
        const statusClass = absent || notEntered ? "is-neutral" : hasPass ? (passed ? "is-pass" : "is-below") : "is-neutral";
        const isNew = Boolean(row.isNew && !viewedIds.has(row.id));
        return <button type="button" className={`student-result-card student-result-card-button ${absent ? "is-absent" : ""}`} key={row.id} onClick={() => void viewResult(row)}>
          <div className="student-result-card-top">
            <div className="student-result-card-copy">
              <div className="student-result-card-meta"><span>{row.subject}</span><i aria-hidden="true" /><span>{row.type}</span>{isNew && <span className="new-result-badge">New</span>}</div>
              <h3>{row.title}</h3>
              <p>{row.doctor ? row.doctor : "Assessment result"}</p>
            </div>
            <time dateTime={row.date}>{formatDate(row.date)}</time>
          </div>
          <div className={`student-result-performance${absent ? " is-absent" : ""}`}>
            <div className="student-result-performance-head">
              <div className="student-result-performance-score">
                <span>{absent ? "Score" : "Your score"}</span>
                {absent ? <strong>Did not take</strong> : notEntered ? <strong>Not entered</strong> : <strong>{formatScoreValue(Number(row.score))} <small>points out of {formatScoreValue(row.total)}</small></strong>}
              </div>
              <div className="student-result-performance-result">
                <span>Result</span>
                <strong className={statusClass}>{resultLabel}</strong>
              </div>
            </div>
            <ScoreDistribution row={row} />
            {hasScore && hasPass && <div className="student-result-performance-note">Passing score {formatScoreValue(Number(row.passing))} out of {formatScoreValue(row.total)}</div>}
          </div>
        </button>;
      })}
    </section> : <div className="student-results-empty"><EmptyState title="No matching results" description="Try a different search or filter." /></div>}

    {openResult && (() => {
      const absent = openResult.status === "absent";
      const notEntered = openResult.status === "not_entered" || (!absent && openResult.score == null);
      const hasScore = !absent && !notEntered && openResult.score != null;
      const hasPass = hasScore && openResult.passing != null;
      const passed = hasPass && Number(openResult.score) >= Number(openResult.passing);
      return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpenResult(null)}>
        <div className="modal modal-compact student-result-detail" role="dialog" aria-modal="true" aria-labelledby="student-result-detail-title">
          <div className="modal-header"><div><span className="modal-eyebrow">{openResult.subject}</span><h2 id="student-result-detail-title">{openResult.title}</h2><p>{openResult.type} · {formatDate(openResult.date)}{openResult.doctor ? ` · ${openResult.doctor}` : ""}</p></div><button type="button" className="modal-close" onClick={() => setOpenResult(null)} aria-label="Close"><CloseIcon size={20} /></button></div>
          <div className="modal-body">
            <div className="student-result-detail-score"><span>Score</span><strong>{absent ? "Did not take" : notEntered ? "Not entered" : `${formatScoreValue(Number(openResult.score))} points out of ${formatScoreValue(openResult.total)}`}</strong></div>
            {hasScore && <ScoreDistribution row={openResult} compact />}
            <div className="student-result-detail-grid"><div><span>Result</span><strong>{absent ? "Did not take" : notEntered ? "Not entered" : hasPass ? (passed ? "Passed" : "Below passing score") : "Recorded"}</strong></div><div><span>Passing score</span><strong>{openResult.passing == null ? "Not set" : `${formatScoreValue(Number(openResult.passing))} out of ${formatScoreValue(openResult.total)}`}</strong></div></div>
          </div>
          <div className="modal-actions"><button type="button" className="button button-primary" onClick={() => setOpenResult(null)}>Done</button></div>
        </div>
      </div>;
    })()}
  </>;
}
