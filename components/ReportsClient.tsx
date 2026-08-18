"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { EmptyState } from "@/components/EmptyState";
import { formatDate, formatRawAverage, scoreFill } from "@/lib/utils";

type ReportRow = {
  id: string;
  title: string;
  type: string;
  date: string;
  total: number;
  passing: number | null;
  subject: string;
  doctor: string | null;
  scores: number[];
  absent: number;
};

export function ReportsClient({ reports }: { reports: ReportRow[] }) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [type, setType] = useState("all");

  const subjects = useMemo(() => [{ value: "all", label: "All subjects" }, ...Array.from(new Set(reports.map((item) => item.subject))).sort().map((value) => ({ value, label: value }))], [reports]);
  const types = useMemo(() => [{ value: "all", label: "All assessment types" }, ...Array.from(new Set(reports.map((item) => item.type))).sort().map((value) => ({ value, label: value }))], [reports]);

  const filtered = useMemo(() => reports.filter((item) => {
    const q = query.trim().toLowerCase();
    return (!q || `${item.title} ${item.subject} ${item.type} ${item.doctor || ""}`.toLowerCase().includes(q)) &&
      (subject === "all" || item.subject === subject) && (type === "all" || item.type === type);
  }), [reports, query, subject, type]);

  const summary = useMemo(() => {
    const scoreCount = reports.reduce((sum, report) => sum + report.scores.length, 0);
    const passingRows = reports.flatMap((report) => report.passing == null ? [] : report.scores.map((score) => ({ passed: score >= Number(report.passing) })));
    const passed = passingRows.filter((item) => item.passed).length;
    const absent = reports.reduce((sum, report) => sum + report.absent, 0);
    const subjectCount = new Set(reports.map((report) => report.subject)).size;
    return { scoreCount, passed, graded: passingRows.length, absent, subjectCount };
  }, [reports]);

  if (!reports.length) return <EmptyState title="No report data yet" description="Release an assessment to include it in class reports." />;


  return (
    <>
      <section className="v33-report-strip" aria-label="Report summary">
        <article className="v33-report-cell">
          <span className="v33-stat-label">Assessments</span>
          <strong className="v33-stat-value">{reports.length}</strong>
          <small className="v33-stat-note">Across {summary.subjectCount} subject{summary.subjectCount === 1 ? "" : "s"}</small>
        </article>
        <article className="v33-report-cell">
          <span className="v33-stat-label">Recorded scores</span>
          <strong className="v33-stat-value">{summary.scoreCount}</strong>
          <small className="v33-stat-note">{summary.absent ? `${summary.absent} did not take` : "All entries scored"}</small>
        </article>
        <article className="v33-report-cell">
          <span className="v33-stat-label">Passed</span>
          <strong className="v33-stat-value">{summary.graded ? `${summary.passed}/${summary.graded}` : "—"}</strong>
          <small className="v33-stat-note">{summary.graded ? "With configured passing scores" : "No passing scores configured"}</small>
        </article>
        <article className="v33-report-cell">
          <span className="v33-stat-label">Did not take</span>
          <strong className="v33-stat-value">{summary.absent}</strong>
          <small className="v33-stat-note">Across included assessments</small>
        </article>
      </section>

      <div className="report-toolbar v31-filterbar">
        <div className="search-box"><SearchIcon size={17} /><input className="input" placeholder="Search assessment or subject" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <CustomSelect value={subject} onChange={setSubject} options={subjects} searchable />
        <CustomSelect value={type} onChange={setType} options={types} searchable />
        <span className="filter-count">{filtered.length} results</span>
      </div>

      <section className="report-list-surface v31-list-surface">
        <div className="report-list-head v31-report-head" aria-hidden="true"><span>Assessment</span><span>Average score</span><span>Highest</span><span>Lowest</span><span>Passing</span></div>
        <div className="report-list">
          {filtered.map((item) => {
            const average = item.scores.length ? item.scores.reduce((sum, score) => sum + score, 0) / item.scores.length : null;
            const high = item.scores.length ? Math.max(...item.scores) : null;
            const low = item.scores.length ? Math.min(...item.scores) : null;
            const passing = item.passing == null ? null : item.scores.filter((score) => score >= Number(item.passing)).length;
            return (
              <article className="report-row v31-list-row" key={item.id}>
                <div className="report-row-main"><strong>{item.title}</strong><span>{item.subject}</span><small>{item.type} · {formatDate(item.date)} · {item.total} pts{item.doctor ? ` · ${item.doctor}` : ""}{item.absent ? ` · ${item.absent} did not take` : ""}</small></div>
                <div className="report-row-metric grade-metric" data-label="Average score"><span>Average score</span><strong>{average == null ? "—" : `${formatRawAverage(average)}/${item.total}`}</strong>{average != null && <div className="v31-score-track mini"><i style={{ width: `${scoreFill(average, item.total)}%` }}/></div>}</div>
                <div className="report-row-metric" data-label="Highest"><span>Highest</span><strong>{high == null ? "—" : `${high}/${item.total}`}</strong></div>
                <div className="report-row-metric" data-label="Lowest"><span>Lowest</span><strong>{low == null ? "—" : `${low}/${item.total}`}</strong></div>
                <div className="report-row-metric" data-label="Passing"><span>Passing</span><strong>{passing == null ? "—" : `${passing}/${item.scores.length}`}</strong></div>
              </article>
            );
          })}
        </div>
        {!filtered.length && <EmptyState title="No matching reports" description="Try another search or filter." />}
      </section>
    </>
  );
}
