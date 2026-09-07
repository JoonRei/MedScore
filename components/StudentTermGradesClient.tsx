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

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
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

      <div className="student-term-grades-v423 student-term-grades-v435 student-term-grades-v436 student-term-grades-v470 student-term-grades-v471 student-term-grades-v472 student-term-grades-v473 student-term-grades-v474 student-term-grades-v475">
        {filteredGrades.map((row) => {
          const subject = row.subject;
          const scheme = row.scheme;
          const breakdown = Array.isArray(row.breakdown) ? row.breakdown : [];
          const currentPeriod = periodLabel(scheme?.grading_period);
          const releaseDate = formatReleasedDate(row.released_at);
          const roundingDigits = scheme?.rounding_digits ?? 0;

          return (
            <details className="student-term-grade-card-v475" key={row.id}>
              <summary className="student-term-grade-summary-v475">
                <div className="student-term-grade-main-v475">
                  <span className={`student-term-grade-period-v475 is-${String(scheme?.grading_period || "prelim")}`}>
                    {currentPeriod}
                  </span>

                  <div className="student-term-grade-title-v475">
                    <h2>{subject?.name || "Subject"}</h2>
                    <p>{[subject?.academic_year, subject?.term].filter(Boolean).join(" · ") || "Released academic grade"}</p>
                  </div>
                </div>

                <div className="student-term-grade-score-v475">
                  <strong>{formatGrade(row.term_grade, roundingDigits)}</strong>
                  <small>{releaseDate}</small>
                </div>
              </summary>

              <div className="student-term-grade-details-v475">
                <div className="student-term-grade-breakdown-head-v475">
                  <h3>Grade breakdown</h3>
                </div>

                <div className="student-term-grade-breakdown-list-v475">
                  {breakdown.map((component: any, index: number) => {
                    const earned = finiteNumber(component.earned);
                    const possible = finiteNumber(component.possible);
                    const grade = componentGrade(component);
                    const weight = finiteNumber(component.weight);
                    const weighted = contribution(component);
                    const children = Array.isArray(component.subcomponents) ? component.subcomponents : [];

                    return (
                      <section className="student-term-grade-breakdown-item-v475" key={`${row.id}-${component.componentId || index}`}>
                        <div className="student-term-grade-breakdown-primary-v475">
                          <div className="student-term-grade-breakdown-name-v475">
                            <strong>{component.name || "Component"}</strong>
                            <small>{formatScore(earned)} / {formatScore(possible)} points</small>
                          </div>

                          <div className="student-term-grade-breakdown-metrics-v475">
                            <div>
                              <span>Weight</span>
                              <strong>{formatScore(weight)}%</strong>
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
                        </div>

                        {children.length ? (
                          <div className="student-term-grade-subcomponent-list-v475">
                            {children.map((child: any, childIndex: number) => (
                              <div className="student-term-grade-subcomponent-row-v475" key={`${row.id}-${child.componentId || childIndex}`}>
                                <div>
                                  <strong>{child.name || "Subcomponent"}</strong>
                                  <small>{formatScore(child.earned)} / {formatScore(child.possible)} points</small>
                                </div>
                                <span>{formatScore(child.weight)}%</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </section>
                    );
                  })}
                </div>

                <div className="student-term-grade-final-v475">
                  <div>
                    <span>{currentPeriod} grade</span>
                    <strong>{subject?.name || "Subject"}</strong>
                  </div>
                  <strong>{formatGrade(row.term_grade, roundingDigits)}</strong>
                </div>
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