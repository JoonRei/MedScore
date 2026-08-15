"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { EmptyState } from "@/components/EmptyState";
import { formatDate, formatPercent, percent } from "@/lib/utils";

type ReportRow = {
  id: string;
  title: string;
  type: string;
  date: string;
  total: number;
  passing: number | null;
  subject: string;
  scores: number[];
};

export function ReportsClient({ reports }: { reports: ReportRow[] }) {
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [type, setType] = useState("all");

  const subjects = useMemo(
    () => [
      { value: "all", label: "All subjects" },
      ...Array.from(new Set(reports.map((item) => item.subject)))
        .sort()
        .map((value) => ({ value, label: value })),
    ],
    [reports]
  );

  const types = useMemo(
    () => [
      { value: "all", label: "All assessment types" },
      ...Array.from(new Set(reports.map((item) => item.type)))
        .sort()
        .map((value) => ({ value, label: value })),
    ],
    [reports]
  );

  const filtered = useMemo(
    () =>
      reports.filter((item) => {
        const q = query.trim().toLowerCase();
        return (
          (!q || `${item.title} ${item.subject} ${item.type}`.toLowerCase().includes(q)) &&
          (subject === "all" || item.subject === subject) &&
          (type === "all" || item.type === type)
        );
      }),
    [reports, query, subject, type]
  );

  const summary = useMemo(() => {
    const scores = reports.flatMap((report) => report.scores.map((score) => ({ score, total: report.total })));
    const average = scores.length
      ? scores.reduce((sum, item) => sum + percent(item.score, item.total), 0) / scores.length
      : 0;
    const passingRows = reports.flatMap((report) =>
      report.passing == null
        ? []
        : report.scores.map((score) => ({ passed: score >= Number(report.passing) }))
    );
    const passRate = passingRows.length
      ? (passingRows.filter((item) => item.passed).length / passingRows.length) * 100
      : null;
    return { scoreCount: scores.length, average, passRate };
  }, [reports]);

  if (!reports.length) {
    return <EmptyState title="No report data yet" description="Release an assessment to include it in class reports." />;
  }

  return (
    <>
      <div className="report-summary-strip">
        <div><span>Assessments</span><strong>{reports.length}</strong></div>
        <div><span>Recorded scores</span><strong>{summary.scoreCount}</strong></div>
        <div><span>Overall average</span><strong>{summary.scoreCount ? formatPercent(summary.average) : "—"}</strong></div>
        <div><span>Overall pass rate</span><strong>{summary.passRate == null ? "—" : formatPercent(summary.passRate)}</strong></div>
      </div>

      <div className="report-toolbar">
        <div className="search-box">
          <SearchIcon size={17} />
          <input
            className="input"
            placeholder="Search assessment or subject"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <CustomSelect value={subject} onChange={setSubject} options={subjects} searchable />
        <CustomSelect value={type} onChange={setType} options={types} searchable />
        <span className="filter-count">{filtered.length} results</span>
      </div>

      <section className="report-list-surface">
        <div className="report-list-head" aria-hidden="true">
          <span>Assessment</span>
          <span>Average</span>
          <span>Highest</span>
          <span>Lowest</span>
          <span>Passing</span>
        </div>

        <div className="report-list">
          {filtered.map((item) => {
            const average = item.scores.length
              ? item.scores.reduce((sum, score) => sum + score, 0) / item.scores.length
              : 0;
            const high = item.scores.length ? Math.max(...item.scores) : null;
            const low = item.scores.length ? Math.min(...item.scores) : null;
            const passing = item.passing == null
              ? null
              : item.scores.filter((score) => score >= Number(item.passing)).length;

            return (
              <article className="report-row" key={item.id}>
                <div className="report-row-main">
                  <strong>{item.title}</strong>
                  <span>{item.subject}</span>
                  <small>{item.type} · {formatDate(item.date)} · {item.total} pts</small>
                </div>
                <div className="report-row-metric" data-label="Average">
                  <span>Average</span>
                  <strong>{item.scores.length ? formatPercent(percent(average, item.total)) : "—"}</strong>
                  <small>{item.scores.length ? `${average.toFixed(1)} / ${item.total}` : "No scores"}</small>
                </div>
                <div className="report-row-metric" data-label="Highest">
                  <span>Highest</span>
                  <strong>{high == null ? "—" : high}</strong>
                </div>
                <div className="report-row-metric" data-label="Lowest">
                  <span>Lowest</span>
                  <strong>{low == null ? "—" : low}</strong>
                </div>
                <div className="report-row-metric" data-label="Passing">
                  <span>Passing</span>
                  <strong>{passing == null ? "—" : `${passing}/${item.scores.length}`}</strong>
                </div>
              </article>
            );
          })}
        </div>

        {!filtered.length && <EmptyState title="No matching reports" description="Try another search or filter." />}
      </section>
    </>
  );
}
