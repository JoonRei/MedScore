"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
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
};

export function StudentResultsClient({ rows }: { rows: StudentResultRow[] }) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [type, setType] = useState("all");

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

  if (!rows.length) return <EmptyState title="No results yet" description="Your recorded scores will appear here when they are ready." />;

  return (
    <>
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

      <section className="student-results-surface student-v2-results-surface">
        <div className="student-results-head" aria-hidden="true"><span>Assessment</span><span>Subject</span><span>Date</span><span>Score</span><span>Result</span></div>
        <div className="student-results-rows">
          {filtered.map((row) => {
            const absent = row.status === "absent";
            const hasPass = row.passing != null;
            const passed = !absent && hasPass && Number(row.score) >= Number(row.passing);
            const resultLabel = absent ? "Did not take" : hasPass ? (passed ? "Passed" : "Below passing") : "Recorded";
            return (
              <article className={`student-result-row student-v2-result-row ${absent ? "is-absent" : ""}`} key={row.id}>
                <div className="student-result-main"><strong>{row.title}</strong><small>{row.type}{row.doctor ? ` · ${row.doctor}` : ""}</small></div>
                <div className="student-result-cell" data-label="Subject">{row.subject}</div>
                <div className="student-result-cell" data-label="Date">{formatDate(row.date)}</div>
                <div className="student-result-score" data-label="Score"><strong>{absent ? "—" : `${row.score} / ${row.total}`}</strong></div>
                <div className="student-result-percent" data-label="Result"><strong className={absent ? "result-neutral" : hasPass ? (passed ? "result-pass" : "result-below") : "result-neutral"}>{resultLabel}</strong></div>
              </article>
            );
          })}
        </div>
        {!filtered.length && <EmptyState title="No matching results" description="Try a different search or filter." />}
      </section>
    </>
  );
}
