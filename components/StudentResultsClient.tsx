"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { formatDate, formatPercent, percent } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";

export type StudentResultRow = {
  id: string;
  title: string;
  type: string;
  date: string;
  total: number;
  score: number;
  subject: string;
};

export function StudentResultsClient({ rows }: { rows: StudentResultRow[] }) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [type, setType] = useState("all");

  const subjectOptions = useMemo(
    () => [
      { value: "all", label: "All subjects" },
      ...Array.from(new Set(rows.map((row) => row.subject)))
        .sort()
        .map((value) => ({ value, label: value })),
    ],
    [rows]
  );

  const typeOptions = useMemo(
    () => [
      { value: "all", label: "All assessment types" },
      ...Array.from(new Set(rows.map((row) => row.type)))
        .sort()
        .map((value) => ({ value, label: value })),
    ],
    [rows]
  );

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const q = query.trim().toLowerCase();
        return (
          (!q || `${row.title} ${row.subject} ${row.type}`.toLowerCase().includes(q)) &&
          (subject === "all" || row.subject === subject) &&
          (type === "all" || row.type === type)
        );
      }),
    [rows, query, subject, type]
  );

  const average = useMemo(
    () => rows.length ? rows.reduce((sum, row) => sum + percent(row.score, row.total), 0) / rows.length : 0,
    [rows]
  );

  if (!rows.length) {
    return <EmptyState title="No results yet" description="Your recorded scores will appear here after they are released." />;
  }

  return (
    <>
      <div className="student-results-summary">
        <div><span>Recorded results</span><strong>{rows.length}</strong></div>
        <div><span>Overall average</span><strong>{formatPercent(average)}</strong></div>
      </div>

      <div className="student-filterbar">
        <div className="search-box">
          <SearchIcon size={17} />
          <input
            className="input"
            placeholder="Search results"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <CustomSelect value={subject} onChange={setSubject} options={subjectOptions} searchable />
        <CustomSelect value={type} onChange={setType} options={typeOptions} searchable />
        <span className="filter-count">{filtered.length} results</span>
      </div>

      <section className="student-results-surface">
        <div className="student-results-head" aria-hidden="true">
          <span>Assessment</span>
          <span>Subject</span>
          <span>Date</span>
          <span>Score</span>
          <span>Result</span>
        </div>

        <div className="student-results-rows">
          {filtered.map((row) => (
            <article className="student-result-row" key={row.id}>
              <div className="student-result-main">
                <strong>{row.title}</strong>
                <small>{row.type}</small>
              </div>
              <div className="student-result-cell" data-label="Subject">{row.subject}</div>
              <div className="student-result-cell" data-label="Date">{formatDate(row.date)}</div>
              <div className="student-result-score" data-label="Score">
                <strong>{row.score} / {row.total}</strong>
              </div>
              <div className="student-result-percent" data-label="Result">
                <strong>{formatPercent(percent(Number(row.score), Number(row.total)))}</strong>
              </div>
            </article>
          ))}
        </div>

        {!filtered.length && <EmptyState title="No matching results" description="Try a different search or filter." />}
      </section>
    </>
  );
}
