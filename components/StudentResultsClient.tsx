"use client";

import { useMemo, useState } from "react";
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
  status: "scored" | "absent";
  doctor: string | null;
  subject: string;
  isNew?: boolean;
};

export function StudentResultsClient({ rows }: { rows: StudentResultRow[] }) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [type, setType] = useState("all");
  const [openResult, setOpenResult] = useState<StudentResultRow | null>(null);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  const subjectOptions = useMemo(() => [{ value: "all", label: "All subjects" }, ...Array.from(new Set(rows.map((row) => row.subject))).sort().map((value) => ({ value, label: value }))], [rows]);
  const typeOptions = useMemo(() => [{ value: "all", label: "All assessment types" }, ...Array.from(new Set(rows.map((row) => row.type))).sort().map((value) => ({ value, label: value }))], [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    const q = query.trim().toLowerCase();
    return (!q || `${row.title} ${row.subject} ${row.type} ${row.doctor || ""}`.toLowerCase().includes(q)) && (subject === "all" || row.subject === subject) && (type === "all" || row.type === type);
  }), [rows, query, subject, type]);

  const scoredRows = useMemo(() => rows.filter((row) => row.status === "scored" && row.score != null), [rows]);
  const passingRows = useMemo(() => scoredRows.filter((row) => row.passing != null), [scoredRows]);
  const passedCount = useMemo(() => passingRows.filter((row) => Number(row.score) >= Number(row.passing)).length, [passingRows]);
  const absentCount = rows.length - scoredRows.length;

  async function viewResult(row: StudentResultRow) {
    setOpenResult(row);
    if (!row.isNew || viewedIds.has(row.id)) return;
    setViewedIds((current) => new Set(current).add(row.id));
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
        const hasPass = row.passing != null;
        const passed = !absent && hasPass && Number(row.score) >= Number(row.passing);
        const resultLabel = absent ? "Did not take" : hasPass ? (passed ? "Passed" : "Below passing") : "Recorded";
        const statusClass = absent ? "is-neutral" : hasPass ? (passed ? "is-pass" : "is-below") : "is-neutral";
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
          <div className="student-result-card-bottom">
            <div className="student-result-card-score"><span>Score</span><div><strong>{absent ? "—" : row.score}</strong><small>{absent ? "Not recorded" : ` / ${row.total}`}</small></div></div>
            <div className="student-result-card-status"><span>Result</span><strong className={statusClass}>{resultLabel}</strong>{!absent && hasPass && <small>Passing score {row.passing} / {row.total}</small>}</div>
          </div>
        </button>;
      })}
    </section> : <div className="student-results-empty"><EmptyState title="No matching results" description="Try a different search or filter." /></div>}

    {openResult && (() => {
      const absent = openResult.status === "absent";
      const hasPass = openResult.passing != null;
      const passed = !absent && hasPass && Number(openResult.score) >= Number(openResult.passing);
      return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setOpenResult(null)}>
        <div className="modal modal-compact student-result-detail" role="dialog" aria-modal="true" aria-labelledby="student-result-detail-title">
          <div className="modal-header"><div><span className="modal-eyebrow">{openResult.subject}</span><h2 id="student-result-detail-title">{openResult.title}</h2><p>{openResult.type} · {formatDate(openResult.date)}{openResult.doctor ? ` · ${openResult.doctor}` : ""}</p></div><button type="button" className="modal-close" onClick={() => setOpenResult(null)} aria-label="Close"><CloseIcon size={20} /></button></div>
          <div className="modal-body">
            <div className="student-result-detail-score"><span>Score</span><strong>{absent ? "Did not take" : `${openResult.score} / ${openResult.total}`}</strong></div>
            <div className="student-result-detail-grid"><div><span>Result</span><strong>{absent ? "Did not take" : hasPass ? (passed ? "Passed" : "Below passing score") : "Recorded"}</strong></div><div><span>Passing score</span><strong>{openResult.passing == null ? "Not set" : `${openResult.passing} / ${openResult.total}`}</strong></div></div>
          </div>
          <div className="modal-actions"><button type="button" className="button button-primary" onClick={() => setOpenResult(null)}>Done</button></div>
        </div>
      </div>;
    })()}
  </>;
}
