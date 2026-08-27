"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { CheckIcon } from "@/components/icons";

type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

type GradeRow = {
  id: string;
  scheme_id?: string | null;
  subject_id?: string | null;
  raw_percentage?: number | null;
  term_grade?: number | null;
  breakdown?: any[] | null;
  released_at?: string | null;
  subject?: {
    id?: string | null;
    name?: string | null;
    code?: string | null;
    term?: string | null;
    academic_year?: string | null;
  } | null;
  scheme?: {
    id?: string | null;
    grading_period?: string | null;
    track_name?: string | null;
    rounding_digits?: number | null;
  } | null;
};

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatScore(value: unknown) {
  const number = finiteNumber(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

function formatGrade(value: unknown, digits: unknown) {
  const number = finiteNumber(value);
  const places = Math.min(2, Math.max(0, Math.trunc(finiteNumber(digits, 0))));
  return number.toFixed(places);
}

function formatReleasedDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "—";

  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T00:00:00`)
    : new Date(text);

  if (Number.isNaN(date.getTime())) return "—";

  return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(-2)}`;
}

function periodLabel(value: unknown) {
  const period = String(value || "prelim");
  return period === "midterm" ? "Midterm" : period === "finals" ? "Finals" : "Prelim";
}

function componentGrade(component: any) {
  const explicit = Number(component?.componentGrade);
  if (Number.isFinite(explicit)) return explicit;
  const percentage = Math.min(100, Math.max(0, finiteNumber(component?.percentage)));
  return 40 + percentage * 0.6;
}

function contribution(component: any) {
  const explicit = Number(component?.contribution);
  if (Number.isFinite(explicit)) return explicit;
  return componentGrade(component) * (finiteNumber(component?.weight) / 100);
}

function StudentGradeFilter({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!options.length) return;
    const currentIndex = Math.max(0, options.findIndex((option) => option.value === value));
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (currentIndex + delta + options.length) % options.length;
      onChange(options[nextIndex].value);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((current) => !current);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={`student-grade-filter-v436${open ? " is-open" : ""}${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="student-grade-filter-trigger-v436"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        <span>
          <strong>{selected?.label || "Select"}</strong>
          {selected?.description ? <small>{selected.description}</small> : null}
        </span>
      </button>

      {open ? (
        <div id={listboxId} className="student-grade-filter-menu-v436" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                className={`student-grade-filter-option-v436${active ? " is-selected" : ""}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.description ? <small>{option.description}</small> : null}
                </span>
                {active ? <CheckIcon size={15} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function StudentTermGradesClient({ grades }: { grades: GradeRow[] }) {
  const [subjectId, setSubjectId] = useState("all");
  const [period, setPeriod] = useState("all");

  const subjectOptions = useMemo<SelectOption[]>(() => {
    const unique = new Map<string, SelectOption>();
    grades.forEach((row) => {
      const id = String(row.subject_id || row.subject?.id || "").trim();
      if (!id || unique.has(id)) return;
      const name = String(row.subject?.name || "Subject");
      const detail = [row.subject?.code, row.subject?.term, row.subject?.academic_year].filter(Boolean).join(" · ");
      unique.set(id, { value: id, label: name, description: detail || undefined });
    });

    return [
      { value: "all", label: "All subjects", description: `${unique.size} ${unique.size === 1 ? "subject" : "subjects"}` },
      ...Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [grades]);

  const periodOptions = useMemo<SelectOption[]>(() => {
    const present = new Set(grades.map((row) => String(row.scheme?.grading_period || "prelim")));
    const options: SelectOption[] = [{ value: "all", label: "All periods" }];
    if (present.has("prelim")) options.push({ value: "prelim", label: "Prelim" });
    if (present.has("midterm")) options.push({ value: "midterm", label: "Midterm" });
    if (present.has("finals")) options.push({ value: "finals", label: "Finals" });
    return options;
  }, [grades]);

  const filteredGrades = useMemo(() => {
    return grades.filter((row) => {
      const rowSubjectId = String(row.subject_id || row.subject?.id || "");
      const rowPeriod = String(row.scheme?.grading_period || "prelim");
      return (subjectId === "all" || rowSubjectId === subjectId) && (period === "all" || rowPeriod === period);
    });
  }, [grades, subjectId, period]);

  return (
    <>
      <div className="student-term-grade-filters-v436" aria-label="Filter term grades">
        <div className="student-term-grade-filter-field-v436 is-subject">
          <span>Subject</span>
          <StudentGradeFilter value={subjectId} options={subjectOptions} onChange={setSubjectId} ariaLabel="Filter by subject" />
        </div>
        <div className="student-term-grade-filter-field-v436 is-period">
          <span>Period</span>
          <StudentGradeFilter value={period} options={periodOptions} onChange={setPeriod} ariaLabel="Filter by grading period" />
        </div>
      </div>

      <div className="student-term-grades-v423 student-term-grades-v435 student-term-grades-v436">
        {filteredGrades.map((row) => {
          const subject = row.subject;
          const scheme = row.scheme;
          const breakdown = Array.isArray(row.breakdown) ? row.breakdown : [];
          const currentPeriod = periodLabel(scheme?.grading_period);
          const trackName = String(scheme?.track_name || "Subject grade");
          const isMainGrade = trackName === "Subject grade";
          const releaseDate = formatReleasedDate(row.released_at);
          const roundingDigits = scheme?.rounding_digits ?? 0;

          return (
            <details className="student-term-grade-card-v423 student-period-grade-card-v427 student-term-grade-card-v435 student-term-grade-card-v436" key={row.id}>
              <summary className="student-term-grade-summary-v435 student-term-grade-summary-v436">
                <div className="student-term-grade-copy-v423 student-term-grade-copy-v435 student-term-grade-copy-v436">
                  <div className="student-term-grade-badges-v435">
                    <span className="student-term-grade-code-v435">{subject?.code || "Subject"}</span>
                    <span className="student-term-grade-period-v435">{currentPeriod}</span>
                    {!isMainGrade ? <span className="student-term-grade-type-v435">{trackName}</span> : null}
                  </div>
                  <h2>{subject?.name || "Subject"}</h2>
                  <p>{[subject?.academic_year, subject?.term].filter(Boolean).join(" · ") || "Released academic grade"}</p>
                </div>

                <div className="student-term-grade-value-v423 student-term-grade-value-v435 student-term-grade-value-v436">
                  <strong>{formatGrade(row.term_grade, roundingDigits)}</strong>
                  <small>Released {releaseDate}</small>
                </div>
              </summary>

              <div className="student-term-grade-breakdown-v423 student-base40-breakdown-v426 student-hierarchy-breakdown-v427 student-term-grade-details-v435 student-term-grade-details-v436">
                <div className="student-term-grade-details-head-v435">
                  <div>
                    <span>Grade details</span>
                    <strong>{breakdown.length} {breakdown.length === 1 ? "component" : "components"}</strong>
                  </div>
                  <div>
                    <span>Overall performance</span>
                    <strong>{finiteNumber(row.raw_percentage).toFixed(2)}%</strong>
                  </div>
                </div>

                <div className="student-term-grade-components-v435">
                  {breakdown.map((component: any, index: number) => {
                    const earned = finiteNumber(component.earned);
                    const possible = finiteNumber(component.possible);
                    const percentage = finiteNumber(component.percentage);
                    const grade = componentGrade(component);
                    const weight = finiteNumber(component.weight);
                    const weighted = contribution(component);
                    const children = Array.isArray(component.subcomponents) ? component.subcomponents : [];

                    return (
                      <section className="student-term-grade-component-v435" key={`${row.id}-${component.componentId || index}`}>
                        <div className="student-term-grade-component-head-v435">
                          <strong>{component.name || "Component"}</strong>
                          <span>{formatScore(weight)}% of grade</span>
                        </div>

                        {children.length ? (
                          <div className="student-term-grade-subcomponents-v435">
                            {children.map((child: any, childIndex: number) => (
                              <div className="student-term-grade-subcomponent-v435" key={`${row.id}-${child.componentId || childIndex}`}>
                                <div>
                                  <strong>{child.name || "Subcomponent"}</strong>
                                  <small>{formatScore(child.earned)} / {formatScore(child.possible)}</small>
                                </div>
                                <div>
                                  <span>{formatScore(child.weight)}%</span>
                                  <strong>{finiteNumber(child.percentage).toFixed(2)}%</strong>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <div className="student-term-grade-metrics-v435">
                          <div>
                            <span>Score</span>
                            <strong>{formatScore(earned)} / {formatScore(possible)}</strong>
                          </div>
                          <div>
                            <span>Performance</span>
                            <strong>{percentage.toFixed(2)}%</strong>
                          </div>
                          <div>
                            <span>Grade</span>
                            <strong>{grade.toFixed(2)}</strong>
                          </div>
                          <div>
                            <span>Weighted</span>
                            <strong>{weighted.toFixed(2)}</strong>
                          </div>
                        </div>
                      </section>
                    );
                  })}
                </div>

                <div className="student-term-grade-final-v435 student-term-grade-final-v436">
                  <div>
                    <span>Released grade</span>
                    <strong>{currentPeriod}{!isMainGrade ? ` · ${trackName}` : ""}</strong>
                  </div>
                  <strong>{formatGrade(row.term_grade, roundingDigits)}</strong>
                </div>

                <p className="student-term-grade-note-v423 student-term-grade-note-v435">Assessment scores remain available separately in Results.</p>
              </div>
            </details>
          );
        })}

        {!filteredGrades.length ? (
          <div className="student-term-grades-filter-empty-v436">
            <strong>No matching grades</strong>
            <span>Try another subject or period.</span>
          </div>
        ) : null}
      </div>
    </>
  );
}
