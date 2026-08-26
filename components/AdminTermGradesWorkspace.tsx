"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { BookIcon, CheckIcon, FileIcon, ScoresIcon, SettingsIcon, UsersIcon } from "@/components/icons";

type Subject = {
  id: string;
  name: string;
  code?: string | null;
  term?: string | null;
  academic_year?: string | null;
};

type Assessment = {
  id: string;
  title: string;
  assessment_type?: string | null;
  total_score: number;
  status?: string | null;
};

type ComponentRow = {
  key: string;
  id?: string;
  name: string;
  weight: number;
};

type PreviewRow = {
  studentId: string;
  name: string;
  codeName?: string | null;
  complete: boolean;
  rawPercentage: number | null;
  termGrade: number | null;
  missingCount: number;
  components: Array<{
    name: string;
    earned: number;
    possible: number;
    percentage?: number;
    componentGrade?: number;
    weight: number;
    contribution?: number;
  }>;
};

type WorkspacePayload = {
  subjects: Subject[];
  subject?: Subject | null;
  assessments?: Assessment[];
  scheme?: { id: string; rounding_digits: number } | null;
  components?: Array<{ id: string; name: string; weight: number; sort_order: number }>;
  assignments?: Record<string, string>;
  preview?: PreviewRow[];
};

type Notice = { tone: "success" | "error"; text: string } | null;

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizedComponentGrade(component: PreviewRow["components"][number]) {
  const explicit = Number(component.componentGrade);
  if (Number.isFinite(explicit)) return explicit;

  const percentage = Math.min(100, Math.max(0, finiteNumber(component.percentage)));
  return 40 + percentage * 0.6;
}

function normalizedContribution(component: PreviewRow["components"][number]) {
  const explicit = Number(component.contribution);
  if (Number.isFinite(explicit)) return explicit;
  return normalizedComponentGrade(component) * (finiteNumber(component.weight) / 100);
}

function formatScore(value: unknown) {
  const number = finiteNumber(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

function componentContributionTotal(components: PreviewRow["components"]) {
  return components.reduce((sum, component) => sum + normalizedContribution(component), 0);
}

function normalizeWorkspacePayload(data: WorkspacePayload): WorkspacePayload {
  return {
    ...data,
    preview: (data.preview || []).map((row) => ({
      ...row,
      components: (row.components || []).map((component) => {
        const earned = finiteNumber(component.earned);
        const possible = finiteNumber(component.possible);
        const percentage = Number.isFinite(Number(component.percentage))
          ? finiteNumber(component.percentage)
          : possible > 0
            ? Math.min(100, Math.max(0, (earned / possible) * 100))
            : 0;
        const componentGrade = Number.isFinite(Number(component.componentGrade))
          ? finiteNumber(component.componentGrade)
          : 40 + Math.min(100, Math.max(0, percentage)) * 0.6;
        const contribution = Number.isFinite(Number(component.contribution))
          ? finiteNumber(component.contribution)
          : componentGrade * (finiteNumber(component.weight) / 100);

        return {
          ...component,
          earned,
          possible,
          percentage,
          componentGrade,
          weight: finiteNumber(component.weight),
          contribution,
        };
      }),
    })),
  };
}


type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

function MedScoresSelect({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  className = "",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
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
    if (disabled) return;
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
    <div ref={rootRef} className={`grades-select-v425${open ? " is-open" : ""}${disabled ? " is-disabled" : ""}${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        className="grades-select-trigger-v425"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        <span className="grades-select-value-v425">
          <strong>{selected?.label || "Select"}</strong>
          {selected?.description ? <small>{selected.description}</small> : null}
        </span>
        <span className="grades-select-chevron-v425" aria-hidden="true" />
      </button>

      {open && (
        <div id={listboxId} className="grades-select-menu-v425" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                className={`grades-select-option-v425${active ? " is-selected" : ""}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>
                  <strong>{option.label}</strong>
                  {option.description ? <small>{option.description}</small> : null}
                </span>
                {active ? <CheckIcon size={16} /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TermGradesSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grades-skeleton-v425${compact ? " is-compact" : ""}`} aria-hidden="true">
      {!compact ? (
        <div className="grades-skeleton-context-v425">
          <span className="grades-skeleton-line-v425 is-wide" />
          <span className="grades-skeleton-pill-v425" />
        </div>
      ) : null}
      <div className="grades-skeleton-summary-v425">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="grades-skeleton-summary-card-v425" key={index}>
            <span className="grades-skeleton-square-v425" />
            <span className="grades-skeleton-line-v425 is-short" />
            <span className="grades-skeleton-line-v425 is-mid" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, panelIndex) => (
        <div className="grades-skeleton-panel-v425" key={panelIndex}>
          <div className="grades-skeleton-panel-head-v425">
            <span className="grades-skeleton-square-v425 is-small" />
            <div>
              <span className="grades-skeleton-line-v425 is-mid" />
              <span className="grades-skeleton-line-v425 is-wide" />
            </div>
          </div>
          <div className="grades-skeleton-rows-v425">
            {Array.from({ length: panelIndex === 2 ? 3 : 2 }).map((__, rowIndex) => (
              <span className="grades-skeleton-row-v425" key={rowIndex} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function tempKey() {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultComponents(): ComponentRow[] {
  return [
    { key: tempKey(), name: "Quizzes & Long Exams", weight: 50 },
    { key: tempKey(), name: "Term Examination", weight: 50 },
  ];
}

export function AdminTermGradesWorkspace() {
  const [payload, setPayload] = useState<WorkspacePayload>({ subjects: [] });
  const [subjectId, setSubjectId] = useState("");
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [roundingDigits, setRoundingDigits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const load = async (nextSubjectId?: string) => {
    setLoading(true);
    setNotice(null);

    try {
      const requestedId = nextSubjectId ?? subjectId;
      const response = await fetch(
        `/api/admin/grades${requestedId ? `?subjectId=${encodeURIComponent(requestedId)}` : ""}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to load term grades.");

      const normalizedData = normalizeWorkspacePayload(data as WorkspacePayload);
      setPayload(normalizedData);

      if (!requestedId && normalizedData.subjects?.length) {
        const firstSubjectId = String(normalizedData.subjects[0].id);
        setSubjectId(firstSubjectId);
        await load(firstSubjectId);
        return;
      }

      if (requestedId) setSubjectId(requestedId);

      const rows: Array<{ key: string; id: string; name: string; weight: number }> = (normalizedData.components || []).map(
        (row: any) => ({
          key: String(row.id),
          id: String(row.id),
          name: String(row.name || ""),
          weight: Number(row.weight),
        }),
      );

      const nextComponents = rows.length ? rows : defaultComponents();
      setComponents(nextComponents);

      const componentKeyById = new Map(rows.map((row) => [row.id, row.key]));
      const nextAssignments: Record<string, string> = {};
      for (const [assessmentId, componentId] of Object.entries(normalizedData.assignments || {})) {
        const key = componentKeyById.get(componentId as string);
        if (key) nextAssignments[assessmentId] = key;
      }
      setAssignments(nextAssignments);
      setRoundingDigits(Number(normalizedData.scheme?.rounding_digits || 0));
      setConfigDirty(false);
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to load term grades.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load("");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const assessments = payload.assessments || [];
  const preview = payload.preview || [];
  const weightTotal = useMemo(
    () => components.reduce((sum, row) => sum + (Number(row.weight) || 0), 0),
    [components],
  );
  const weightIsValid = Math.abs(weightTotal - 100) < 0.001;
  const componentNamesValid = components.length > 0 && components.every((row) => row.name.trim());
  const readyCount = preview.filter((row) => row.complete).length;
  const incompleteCount = preview.length - readyCount;
  const assignedAssessmentCount = assessments.filter((row) => assignments[row.id]).length;
  const excludedAssessmentCount = Math.max(0, assessments.length - assignedAssessmentCount);
  const schemeSaved = Boolean(payload.scheme?.id);
  const canSave = Boolean(subjectId) && weightIsValid && componentNamesValid && !saving;
  const canRelease = Boolean(subjectId) && schemeSaved && readyCount > 0 && !configDirty && !saving;

  const selectedSubject = payload.subjects.find((subject) => subject.id === subjectId) || payload.subject || null;
  const subjectMeta = [selectedSubject?.term, selectedSubject?.academic_year].filter(Boolean).join(" · ");

  const markDirty = () => {
    setConfigDirty(true);
    setNotice(null);
  };

  const addComponent = () => {
    setComponents((rows) => [...rows, { key: tempKey(), name: "", weight: 0 }]);
    markDirty();
  };

  const removeComponent = (key: string) => {
    setComponents((rows) => rows.filter((row) => row.key !== key));
    setAssignments((current) =>
      Object.fromEntries(Object.entries(current).filter(([, value]) => value !== key)),
    );
    markDirty();
  };

  const updateComponentName = (key: string, value: string) => {
    setComponents((rows) => rows.map((row) => (row.key === key ? { ...row, name: value } : row)));
    markDirty();
  };

  const updateComponentWeight = (key: string, value: number) => {
    setComponents((rows) => rows.map((row) => (row.key === key ? { ...row, weight: value } : row)));
    markDirty();
  };

  const updateAssignment = (assessmentId: string, componentKey: string) => {
    setAssignments((current) => ({ ...current, [assessmentId]: componentKey }));
    markDirty();
  };

  const save = async () => {
    if (!canSave) return;

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_config",
          subjectId,
          roundingDigits,
          components: components.map((row, index) => ({
            clientKey: row.key,
            name: row.name.trim(),
            weight: Number(row.weight),
            sortOrder: index,
          })),
          assignments: Object.entries(assignments)
            .filter(([, componentKey]) => componentKey)
            .map(([assessmentId, componentKey]) => ({ assessmentId, componentKey })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to save grading changes.");

      await load(subjectId);
      setNotice({ tone: "success", text: "Changes saved. Grade preview is up to date." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to save grading changes.",
      });
    } finally {
      setSaving(false);
    }
  };

  const release = async () => {
    if (!canRelease) return;

    const confirmed = window.confirm(
      `Release ${readyCount} complete term grade${readyCount === 1 ? "" : "s"}? Incomplete students will be skipped.`,
    );
    if (!confirmed) return;

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch("/api/admin/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release", subjectId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to release term grades.");

      await load(subjectId);
      setNotice({
        tone: "success",
        text: `${data.released || 0} term grade${data.released === 1 ? "" : "s"} released successfully.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to release term grades.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !payload.subjects.length) {
    return (
      <div className="grades-skeleton-wrap-v425" role="status" aria-label="Loading term grades workspace">
        <TermGradesSkeleton />
        <span className="grades-sr-only-v424">Loading term grades workspace…</span>
      </div>
    );
  }

  if (!payload.subjects.length) {
    return (
      <section className="grades-empty-state-v424">
        <div className="grades-empty-icon-v424"><BookIcon size={22} /></div>
        <h2>No subjects available</h2>
        <p>Create or assign a subject first. Term grading is configured separately for each subject.</p>
      </section>
    );
  }

  return (
    <div className={`grades-workspace-v424${loading ? " is-loading" : ""}`}>
      <section className="grades-context-v424" aria-label="Term grade context">
        <div className="grades-context-copy-v424">
          
          <div className="grades-subject-field-v424">
            <span className="grades-sr-only-v424">Subject</span>
            <MedScoresSelect
              value={subjectId}
              ariaLabel="Choose subject"
              disabled={loading}
              options={payload.subjects.map((subject) => ({
                value: subject.id,
                label: subject.name,
                description: [subject.code, subject.term, subject.academic_year].filter(Boolean).join(" · ") || undefined,
              }))}
              onChange={(nextId) => {
                if (!nextId || nextId === subjectId) return;
                setSubjectId(nextId);
                setConfigDirty(false);
                void load(nextId);
              }}
            />
          </div>
          {(selectedSubject?.code || subjectMeta) && (
            <div className="grades-subject-meta-v424">
              {selectedSubject?.code ? <span>{selectedSubject.code}</span> : null}
              {subjectMeta ? <span>{subjectMeta}</span> : null}
            </div>
          )}
        </div>

        <div className="grades-context-state-v424">
          <span className={`grades-save-state-v424${configDirty ? " is-dirty" : schemeSaved ? " is-saved" : ""}`}>
            {configDirty ? "Unsaved changes" : schemeSaved ? "Saved" : "Not saved"}
          </span>
          <div className={`grades-weight-total-v424${weightIsValid ? " is-valid" : " is-invalid"}`}>
            <span>Total weight</span>
            <strong>{weightTotal.toFixed(weightTotal % 1 ? 1 : 0)}%</strong>
          </div>
        </div>
      </section>

      {notice && (
        <div className={`grades-notice-v424 grades-toast-v425 is-${notice.tone}`} role="status">
          <span className="grades-notice-icon-v424">
            {notice.tone === "success" ? <CheckIcon size={16} /> : "!"}
          </span>
          <span>{notice.text}</span>
        </div>
      )}

      {loading ? (
        <TermGradesSkeleton compact />
      ) : (
      <>
      <section className="grades-summary-grid-v424" aria-label="Grading overview">
        <div className="grades-summary-card-v424">
          <span className="grades-summary-icon-v424"><SettingsIcon size={18} /></span>
          <div><strong>{components.length}</strong><span>Components</span></div>
          <small>{weightIsValid ? "Weights balanced" : `${weightTotal.toFixed(1)}% total`}</small>
        </div>
        <div className="grades-summary-card-v424">
          <span className="grades-summary-icon-v424"><FileIcon size={18} /></span>
          <div><strong>{assignedAssessmentCount}</strong><span>Included assessments</span></div>
          <small>{excludedAssessmentCount ? `${excludedAssessmentCount} excluded` : "All included"}</small>
        </div>
        <div className="grades-summary-card-v424">
          <span className="grades-summary-icon-v424"><UsersIcon size={18} /></span>
          <div><strong>{readyCount}</strong><span>Ready to release</span></div>
          <small>{preview.length ? `${preview.length} student${preview.length === 1 ? "" : "s"} in preview` : "No preview yet"}</small>
        </div>
        <div className="grades-summary-card-v424">
          <span className="grades-summary-icon-v424"><ScoresIcon size={18} /></span>
          <div><strong>{incompleteCount}</strong><span>Incomplete</span></div>
          <small>{incompleteCount ? "Missing recorded scores" : "Nothing pending"}</small>
        </div>
      </section>

      <section className="grades-panel-v424">
        <div className="grades-panel-heading-v424">
          <div className="grades-heading-main-v424">
            <span className="grades-step-v424">1</span>
            <div>
              <h2>Grade components</h2>
              <p>Define how much each group contributes to the term grade. The total must equal 100%.</p>
            </div>
          </div>
          <button className="button button-secondary button-sm" type="button" onClick={addComponent} disabled={saving}>
            Add component
          </button>
        </div>

        <div className="grades-components-v424">
          {components.map((component, index) => (
            <div className="grades-component-row-v424" key={component.key}>
              <span className="grades-component-index-v424">{index + 1}</span>
              <label className="grades-component-name-v424">
                <span>Component</span>
                <input
                  value={component.name}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => updateComponentName(component.key, event.target.value)}
                  placeholder="e.g. Quizzes & Long Exams"
                />
              </label>
              <label className="grades-weight-field-v424">
                <span>Weight</span>
                <div>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={component.weight}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => updateComponentWeight(component.key, Number(event.target.value))}
                  />
                  <b>%</b>
                </div>
              </label>
              <button
                className="grades-remove-v424"
                type="button"
                aria-label={`Remove ${component.name || "component"}`}
                onClick={() => removeComponent(component.key)}
                disabled={saving || components.length <= 1}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="grades-component-footer-v424">
          <div className="grades-formula-note-v424">
            <span className="grades-formula-mark-v424">40</span>
            <div>
              <strong>Weighted Base-40 calculation</strong>
              <p>Each component uses ((earned ÷ possible) × 60 + 40) × its weight. The weighted component contributions are then added for the term grade.</p>
            </div>
          </div>

          <div className="grades-rounding-v424">
            <span>Released grade rounding</span>
            <MedScoresSelect
              value={String(roundingDigits)}
              ariaLabel="Released grade rounding"
              options={[
                { value: "0", label: "Whole number" },
                { value: "1", label: "1 decimal" },
                { value: "2", label: "2 decimals" },
              ]}
              onChange={(nextValue) => {
                setRoundingDigits(Number(nextValue));
                markDirty();
              }}
            />
          </div>
        </div>
      </section>

      <section className="grades-panel-v424">
        <div className="grades-panel-heading-v424">
          <div className="grades-heading-main-v424">
            <span className="grades-step-v424">2</span>
            <div>
              <h2>Assessment mapping</h2>
              <p>Choose which component each assessment belongs to. Excluded assessments never affect the term grade.</p>
            </div>
          </div>
          <span className="grades-panel-count-v424">{assignedAssessmentCount} of {assessments.length} included</span>
        </div>

        <div className="grades-assessment-list-v424">
          {assessments.map((assessment) => {
            const assigned = Boolean(assignments[assessment.id]);
            return (
              <div className={`grades-assessment-row-v424${assigned ? " is-assigned" : ""}`} key={assessment.id}>
                <div className="grades-assessment-copy-v424">
                  <div className="grades-assessment-title-v424">
                    <strong>{assessment.title}</strong>
                    <span className={`grades-assessment-state-v424${assigned ? " is-included" : ""}`}>
                      {assigned ? "Included" : "Excluded"}
                    </span>
                  </div>
                  <span>{assessment.assessment_type || "Assessment"} · {assessment.total_score} points</span>
                </div>
                <div className="grades-assessment-select-v424">
                  <span>Component</span>
                  <MedScoresSelect
                    value={assignments[assessment.id] || ""}
                    ariaLabel={`Component for ${assessment.title}`}
                    options={[
                      { value: "", label: "Not included", description: "Does not affect the term grade" },
                      ...components.map((component) => ({
                        value: component.key,
                        label: component.name || "Untitled component",
                        description: `${Number(component.weight) || 0}% of term grade`,
                      })),
                    ]}
                    onChange={(nextValue) => updateAssignment(assessment.id, nextValue)}
                  />
                </div>
              </div>
            );
          })}

          {!assessments.length && (
            <div className="grades-inline-empty-v424">
              <FileIcon size={19} />
              <div><strong>No assessments yet</strong><span>Create assessments for this subject before mapping grade components.</span></div>
            </div>
          )}
        </div>

        <div className="grades-save-bar-v424">
          <div>
            <strong>{configDirty ? "Review and save your changes" : schemeSaved ? "Changes are saved" : "Save grading changes"}</strong>
            <span>
              {!weightIsValid
                ? `Weights currently total ${weightTotal.toFixed(2)}%. They must equal 100%.`
                : !componentNamesValid
                  ? "Every component needs a name before saving."
                  : configDirty
                    ? "Saving recalculates the preview using the latest component weights and assessment assignments."
                    : "Assessment scores remain separate from the released term grade."}
            </span>
          </div>
          <button className="button button-primary" type="button" disabled={!canSave} onClick={save}>
            {saving ? "Saving…" : configDirty || !schemeSaved ? "Save changes" : "Saved"}
          </button>
        </div>
      </section>

      <section className="grades-panel-v424 grades-preview-panel-v424">
        <div className="grades-panel-heading-v424">
          <div className="grades-heading-main-v424">
            <span className="grades-step-v424">3</span>
            <div>
              <h2>Grade preview & release</h2>
              <p>Only complete students are eligible. Missing assessment entries remain incomplete and are skipped during release.</p>
            </div>
          </div>
          <div className="grades-ready-cluster-v424">
            <span><strong>{readyCount}</strong> ready</span>
            <span><strong>{incompleteCount}</strong> incomplete</span>
          </div>
        </div>

        {configDirty && (
          <div className="grades-preview-stale-v424">
            <span>!</span>
            <div>
              <strong>Preview is waiting for your latest changes</strong>
              <p>Save your changes before reviewing or releasing grades.</p>
            </div>
          </div>
        )}

        <div className="grades-preview-table-v424">
          <div className="grades-preview-head-v424" aria-hidden="true">
            <span>Student</span>
            <span>Raw weighted %</span>
            <span>Term grade</span>
            <span>Status</span>
          </div>

          {preview.map((row) => (
            <details className="grades-preview-row-v424" key={row.studentId}>
              <summary>
                <span className="grades-student-cell-v424">
                  <strong>{row.name}</strong>
                  {row.codeName ? <small>{row.codeName}</small> : null}
                </span>
                <span className="grades-data-cell-v424" data-label="Raw weighted %">
                  {row.rawPercentage == null ? "—" : `${row.rawPercentage.toFixed(2)}%`}
                </span>
                <span className="grades-data-cell-v424 grades-final-value-v424" data-label="Term grade">
                  {row.termGrade ?? "—"}
                </span>
                <span className="grades-status-cell-v424" data-label="Status">
                  <span className={`grades-status-v424 ${row.complete ? "is-ready" : "is-incomplete"}`}>
                    {row.complete ? "Ready" : `Incomplete${row.missingCount ? ` · ${row.missingCount}` : ""}`}
                  </span>
                </span>
              </summary>

              <div className="grades-breakdown-v424 grades-base40-breakdown-v426">
                <div className="grades-breakdown-title-v424">
                  <strong>Base-40 calculation</strong>
                  <span>Each component is transmuted first, then multiplied by its weight.</span>
                </div>

                {row.components.map((component) => {
                  const earned = finiteNumber(component.earned);
                  const possible = finiteNumber(component.possible);
                  const percentage = finiteNumber(component.percentage);
                  const componentGrade = normalizedComponentGrade(component);
                  const weight = finiteNumber(component.weight);
                  const contribution = normalizedContribution(component);

                  return (
                    <div className="grades-base40-component-v426" key={component.name}>
                      <div className="grades-base40-component-head-v426">
                        <strong>{component.name}</strong>
                        <span>{weight}% weight</span>
                      </div>

                      <div className="grades-base40-metrics-v426">
                        <span><small>Subtotal</small><strong>{formatScore(earned)} / {formatScore(possible)}</strong></span>
                        <span><small>Raw</small><strong>{percentage.toFixed(2)}%</strong></span>
                        <span><small>Base-40</small><strong>{componentGrade.toFixed(2)}</strong></span>
                        <span className="is-contribution"><small>Contribution</small><strong>{contribution.toFixed(2)}</strong></span>
                      </div>

                      <div className="grades-base40-equation-v426">
                        (({formatScore(earned)} ÷ {formatScore(possible)}) × 60 + 40) × {(weight / 100).toFixed(2)} = <strong>{contribution.toFixed(2)}</strong>
                      </div>
                    </div>
                  );
                })}

                <div className="grades-base40-total-v426">
                  <span>
                    <strong>Term Grade</strong>
                    <small>Sum of all weighted Base-40 contributions{roundingDigits === 0 ? ", rounded to a whole grade" : roundingDigits === 1 ? ", rounded to 1 decimal" : ", rounded to 2 decimals"}.</small>
                  </span>
                  <span className="grades-base40-total-values-v426">
                    <small>{componentContributionTotal(row.components).toFixed(2)} total</small>
                    <strong>{row.termGrade ?? "—"}</strong>
                  </span>
                </div>
              </div>
            </details>
          ))}

          {!preview.length && (
            <div className="grades-inline-empty-v424 grades-preview-empty-v424">
              <UsersIcon size={19} />
              <div><strong>No grade preview yet</strong><span>Save your grade components and record assessment scores to calculate student term grades.</span></div>
            </div>
          )}
        </div>

        <div className="grades-release-bar-v424">
          <div className="grades-release-copy-v424">
            <span className="grades-release-icon-v424"><ScoresIcon size={18} /></span>
            <div>
              <strong>Release term grades</strong>
              <span>
                {configDirty
                  ? "Save your latest changes before release."
                  : readyCount
                    ? `${readyCount} complete grade${readyCount === 1 ? "" : "s"} will be released. Incomplete students stay private.`
                    : "No complete grades are ready to release yet."}
              </span>
            </div>
          </div>
          <button className="button button-primary" type="button" disabled={!canRelease} onClick={release}>
            {saving ? "Working…" : `Release ${readyCount || ""} grade${readyCount === 1 ? "" : "s"}`.trim()}
          </button>
        </div>
      </section>
      </>
      )}
    </div>
  );
}
