"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { BookIcon, CheckIcon, FileIcon, ScoresIcon, UsersIcon } from "@/components/icons";

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

type SubcomponentRow = {
  key: string;
  id?: string;
  name: string;
  weight: number;
};

type ComponentRow = {
  key: string;
  id?: string;
  name: string;
  weight: number;
  subcomponents: SubcomponentRow[];
};

type TrackRow = {
  id: string;
  trackKey: string;
  name: string;
  sortOrder: number;
  weight: number;
  roundingDigits?: number;
};

type AssignmentContext = {
  componentId: string;
  componentName: string;
  schemeId: string;
  gradingPeriod: string;
  trackKey: string;
  trackName: string;
};

type PreviewSubcomponent = {
  componentId?: string;
  name: string;
  weight: number;
  earned: number;
  possible: number;
  percentage: number;
  rawShare: number;
};

type PreviewComponent = {
  componentId?: string;
  name: string;
  earned: number;
  possible: number;
  percentage?: number;
  componentGrade?: number;
  weight: number;
  contribution?: number;
  subcomponents?: PreviewSubcomponent[];
};

type PreviewTrackGrade = {
  trackKey: string;
  name: string;
  weight: number;
  complete: boolean;
  rawPercentage: number | null;
  termGrade: number | null;
  missingCount: number;
  components: PreviewComponent[];
};

type PreviewRow = {
  studentId: string;
  name: string;
  codeName?: string | null;
  complete: boolean;
  rawPercentage: number | null;
  termGrade: number | null;
  missingCount: number;
  components: PreviewComponent[];
  trackGrades?: PreviewTrackGrade[];
};

type WorkspacePayload = {
  subjects: Subject[];
  subject?: Subject | null;
  assessments?: Assessment[];
  gradingPeriod?: string;
  tracks?: TrackRow[];
  scheme?: {
    id: string;
    rounding_digits: number;
    grading_period?: string;
    track_key?: string;
    track_name?: string;
    subject_weight?: number;
  } | null;
  components?: Array<{
    id: string;
    name: string;
    weight: number;
    sort_order: number;
    parent_component_id?: string | null;
  }>;
  assignments?: Record<string, string>;
  assignmentContexts?: Record<string, AssignmentContext>;
  preview?: PreviewRow[];
  releaseStatus?: {
    releasedCount: number;
    releasedAt?: string | null;
    studentIds?: string[];
  };
  trackWeightTotal?: number;
  trackWeightsValid?: boolean;
};

type Notice = { tone: "success" | "error"; text: string } | null;
type ConfirmAction =
  | { kind: "release"; title: string; message: string; confirmLabel: string }
  | { kind: "delete-track"; title: string; message: string; confirmLabel: string }
  | null;

type SelectOption = { value: string; label: string; description?: string };

const PERIOD_OPTIONS: SelectOption[] = [
  { value: "prelim", label: "Prelim" },
  { value: "midterm", label: "Midterm" },
  { value: "finals", label: "Finals" },
];

function periodLabel(value: string) {
  return value === "midterm" ? "Midterm" : value === "finals" ? "Finals" : "Prelim";
}

function finiteNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatScore(value: unknown) {
  const number = finiteNumber(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

function normalizedComponentGrade(component: PreviewComponent) {
  const explicit = Number(component.componentGrade);
  if (Number.isFinite(explicit)) return explicit;
  const percentage = Math.min(100, Math.max(0, finiteNumber(component.percentage)));
  return 40 + percentage * 0.6;
}

function normalizedContribution(component: PreviewComponent) {
  const explicit = Number(component.contribution);
  if (Number.isFinite(explicit)) return explicit;
  return normalizedComponentGrade(component) * (finiteNumber(component.weight) / 100);
}

function tempKey(prefix = "tmp") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultComponents(): ComponentRow[] {
  return [
    { key: tempKey(), name: "Periodical Exam", weight: 60, subcomponents: [] },
    { key: tempKey(), name: "Long Exams, Quizzes & Other Assessments", weight: 40, subcomponents: [] },
  ];
}

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
    if (disabled || !options.length) return;
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

function TermGradesSkeleton() {
  return (
    <div className="grades-skeleton-v425 grades-hierarchy-skeleton-v427" aria-hidden="true">
      <div className="grades-hierarchy-skeleton-toolbar-v427">
        {Array.from({ length: 3 }).map((_, index) => <span className="grades-skeleton-row-v425" key={index} />)}
      </div>
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
            <div><span className="grades-skeleton-line-v425 is-mid" /><span className="grades-skeleton-line-v425 is-wide" /></div>
          </div>
          <div className="grades-skeleton-rows-v425">
            {Array.from({ length: panelIndex === 2 ? 3 : 2 }).map((__, rowIndex) => <span className="grades-skeleton-row-v425" key={rowIndex} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function normalizePreview(data: WorkspacePayload): WorkspacePayload {
  const normalizeComponents = (rows: PreviewComponent[] = []) => rows.map((component) => ({
    ...component,
    earned: finiteNumber(component.earned),
    possible: finiteNumber(component.possible),
    percentage: finiteNumber(component.percentage),
    componentGrade: normalizedComponentGrade(component),
    weight: finiteNumber(component.weight),
    contribution: normalizedContribution(component),
    subcomponents: (component.subcomponents || []).map((child) => ({
      ...child,
      earned: finiteNumber(child.earned),
      possible: finiteNumber(child.possible),
      percentage: finiteNumber(child.percentage),
      weight: finiteNumber(child.weight),
      rawShare: finiteNumber(child.rawShare),
    })),
  }));

  return {
    ...data,
    tracks: (data.tracks || []).map((track) => ({ ...track, weight: finiteNumber(track.weight) })),
    preview: (data.preview || []).map((row) => ({
      ...row,
      components: normalizeComponents(row.components || []),
      trackGrades: (row.trackGrades || []).map((track) => ({
        ...track,
        weight: finiteNumber(track.weight),
        rawPercentage: track.rawPercentage == null ? null : finiteNumber(track.rawPercentage),
        termGrade: track.termGrade == null ? null : finiteNumber(track.termGrade),
        missingCount: finiteNumber(track.missingCount),
        components: normalizeComponents(track.components || []),
      })),
    })),
  };
}

export function AdminTermGradesWorkspace() {
  const [payload, setPayload] = useState<WorkspacePayload>({ subjects: [] });
  const [subjectId, setSubjectId] = useState("");
  const [gradingPeriod, setGradingPeriod] = useState("prelim");
  const [trackKey, setTrackKey] = useState("overall");
  const [trackName, setTrackName] = useState("Subject grade");
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [roundingDigits, setRoundingDigits] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configDirty, setConfigDirty] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [addingTrack, setAddingTrack] = useState(false);
  const [newTrackName, setNewTrackName] = useState("");
  const [trackWeights, setTrackWeights] = useState<Record<string, number>>({});
  const [trackWeightsDirty, setTrackWeightsDirty] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const load = async (nextSubjectId?: string, nextPeriod?: string, nextTrackKey?: string) => {
    setLoading(true);
    setNotice(null);
    try {
      const requestedSubject = nextSubjectId ?? subjectId;
      const requestedPeriod = nextPeriod ?? gradingPeriod;
      const requestedTrack = nextTrackKey ?? trackKey;
      const params = new URLSearchParams();
      if (requestedSubject) params.set("subjectId", requestedSubject);
      if (requestedPeriod) params.set("gradingPeriod", requestedPeriod);
      if (requestedTrack) params.set("trackKey", requestedTrack);
      const response = await fetch(`/api/admin/grades${params.size ? `?${params.toString()}` : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to load term grades.");
      const normalized = normalizePreview(data as WorkspacePayload);
      setPayload(normalized);

      if (!requestedSubject && normalized.subjects.length) {
        const first = String(normalized.subjects[0].id);
        setSubjectId(first);
        await load(first, requestedPeriod || "prelim", "overall");
        return;
      }

      if (requestedSubject) setSubjectId(requestedSubject);
      const activePeriod = String(normalized.gradingPeriod || requestedPeriod || "prelim");
      setGradingPeriod(activePeriod);
      const activeTrackKey = String(normalized.scheme?.track_key || normalized.tracks?.[0]?.trackKey || requestedTrack || "overall");
      setTrackKey(activeTrackKey);
      setTrackName(String(normalized.scheme?.track_name || normalized.tracks?.find((row) => row.trackKey === activeTrackKey)?.name || "Subject grade"));
      setTrackWeights(Object.fromEntries((normalized.tracks || []).map((row) => [row.trackKey, finiteNumber(row.weight)])));
      setTrackWeightsDirty(false);
      setSelectedStudentIds(new Set((normalized.preview || []).filter((row) => row.complete).map((row) => String(row.studentId))));

      const flat = normalized.components || [];
      const parents = flat.filter((row) => !row.parent_component_id);
      const nextComponents: ComponentRow[] = parents.map((parent) => ({
        key: String(parent.id),
        id: String(parent.id),
        name: String(parent.name || ""),
        weight: finiteNumber(parent.weight),
        subcomponents: flat
          .filter((row) => String(row.parent_component_id || "") === String(parent.id))
          .map((child) => ({
            key: String(child.id),
            id: String(child.id),
            name: String(child.name || ""),
            weight: finiteNumber(child.weight),
          })),
      }));
      const usableComponents = nextComponents.length ? nextComponents : defaultComponents();
      setComponents(usableComponents);

      const keyById = new Map<string, string>();
      usableComponents.forEach((component) => {
        if (component.id) keyById.set(component.id, component.key);
        component.subcomponents.forEach((child) => { if (child.id) keyById.set(child.id, child.key); });
      });
      const nextAssignments: Record<string, string> = {};
      for (const [assessmentId, componentId] of Object.entries(normalized.assignments || {})) {
        const key = keyById.get(String(componentId));
        if (key) nextAssignments[assessmentId] = key;
      }
      setAssignments(nextAssignments);
      setRoundingDigits(Number(normalized.scheme?.rounding_digits || 0));
      setConfigDirty(false);
      setAddingTrack(false);
      setNewTrackName("");
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to load term grades." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load("", "prelim", "overall"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const assessments = payload.assessments || [];
  const preview = payload.preview || [];
  const tracks = payload.tracks || [];
  const assignmentContexts = payload.assignmentContexts || {};
  const releaseStatus = payload.releaseStatus || { releasedCount: 0, releasedAt: null, studentIds: [] };
  const releasedStudentIds = useMemo(() => new Set((releaseStatus.studentIds || []).map(String)), [releaseStatus.studentIds]);

  const weightTotal = useMemo(() => components.reduce((sum, row) => sum + finiteNumber(row.weight), 0), [components]);
  const topWeightValid = Math.abs(weightTotal - 100) < 0.001;
  const namesValid = components.length > 0 && Boolean(trackName.trim()) && components.every((row) => row.name.trim() && row.subcomponents.every((child) => child.name.trim()));
  const weightsPositive = components.every((row) => finiteNumber(row.weight) > 0 && row.subcomponents.every((child) => finiteNumber(child.weight) > 0));
  const subWeightsValid = components.every((row) => !row.subcomponents.length || Math.abs(row.subcomponents.reduce((sum, child) => sum + finiteNumber(child.weight), 0) - 100) < 0.001);
  const readyCount = preview.filter((row) => row.complete).length;
  const incompleteCount = preview.length - readyCount;
  const assignedAssessmentCount = assessments.filter((row) => assignments[row.id]).length;
  const autoZeroCount = preview.reduce((sum, row) => sum + (row.missingCount || 0), 0);
  const schemeSaved = Boolean(payload.scheme?.id);
  const trackWeightTotal = tracks.reduce((sum, row) => sum + finiteNumber(trackWeights[row.trackKey], row.weight), 0);
  const trackWeightsValid = tracks.length > 0
    && tracks.every((row) => finiteNumber(trackWeights[row.trackKey], row.weight) > 0)
    && Math.abs(trackWeightTotal - 100) < 0.001;
  const readyStudentIds = preview.filter((row) => row.complete).map((row) => String(row.studentId));
  const selectedCount = readyStudentIds.filter((id) => selectedStudentIds.has(id)).length;
  const allReadySelected = readyStudentIds.length > 0 && selectedCount === readyStudentIds.length;
  const canSave = Boolean(subjectId) && topWeightValid && subWeightsValid && weightsPositive && namesValid && !saving;
  const canRelease = Boolean(subjectId)
    && readyCount > 0
    && selectedCount > 0
    && trackWeightsValid
    && !trackWeightsDirty
    && !configDirty
    && !saving;

  const markDirty = () => { setConfigDirty(true); setNotice(null); };

  const addComponent = () => {
    setComponents((rows) => [...rows, { key: tempKey(), name: "", weight: 0, subcomponents: [] }]);
    markDirty();
  };
  const removeComponent = (key: string) => {
    const removed = components.find((row) => row.key === key);
    const removedKeys = new Set([key, ...(removed?.subcomponents || []).map((child) => child.key)]);
    setComponents((rows) => rows.filter((row) => row.key !== key));
    setAssignments((current) => Object.fromEntries(Object.entries(current).filter(([, value]) => !removedKeys.has(value))));
    markDirty();
  };
  const updateComponent = (key: string, patch: Partial<ComponentRow>) => {
    setComponents((rows) => rows.map((row) => row.key === key ? { ...row, ...patch } : row));
    markDirty();
  };
  const addSubcomponent = (parentKey: string) => {
    setComponents((rows) => rows.map((row) => row.key === parentKey
      ? { ...row, subcomponents: [...row.subcomponents, { key: tempKey("sub"), name: "", weight: 0 }] }
      : row));
    setAssignments((current) => Object.fromEntries(Object.entries(current).filter(([, value]) => value !== parentKey)));
    markDirty();
  };
  const updateSubcomponent = (parentKey: string, childKey: string, patch: Partial<SubcomponentRow>) => {
    setComponents((rows) => rows.map((row) => row.key === parentKey
      ? { ...row, subcomponents: row.subcomponents.map((child) => child.key === childKey ? { ...child, ...patch } : child) }
      : row));
    markDirty();
  };
  const removeSubcomponent = (parentKey: string, childKey: string) => {
    setComponents((rows) => rows.map((row) => row.key === parentKey
      ? { ...row, subcomponents: row.subcomponents.filter((child) => child.key !== childKey) }
      : row));
    setAssignments((current) => Object.fromEntries(Object.entries(current).filter(([, value]) => value !== childKey)));
    markDirty();
  };
  const updateAssignment = (assessmentId: string, componentKey: string) => {
    setAssignments((current) => componentKey ? { ...current, [assessmentId]: componentKey } : Object.fromEntries(Object.entries(current).filter(([id]) => id !== assessmentId)));
    markDirty();
  };

  const leafOptions = useMemo(() => {
    const options: SelectOption[] = [];
    for (const component of components) {
      if (!component.subcomponents.length) {
        options.push({
          value: component.key,
          label: component.name || "Untitled component",
          description: `${finiteNumber(component.weight)}% of this grade`,
        });
      } else {
        component.subcomponents.forEach((child) => options.push({
          value: child.key,
          label: child.name || "Untitled subcomponent",
          description: `${component.name || "Component"} · ${finiteNumber(child.weight)}% within component`,
        }));
      }
    }
    return options;
  }, [components]);

  const save = async () => {
    if (!canSave) return;
    setSaving(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_config",
          subjectId,
          gradingPeriod,
          trackKey,
          trackName,
          roundingDigits,
          components: components.map((row, index) => ({
            clientKey: row.key,
            name: row.name.trim(),
            weight: finiteNumber(row.weight),
            sortOrder: index,
            subcomponents: row.subcomponents.map((child, childIndex) => ({
              clientKey: child.key,
              name: child.name.trim(),
              weight: finiteNumber(child.weight),
              sortOrder: childIndex,
            })),
          })),
          assignments: Object.entries(assignments).map(([assessmentId, componentKey]) => ({ assessmentId, componentKey })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to save grading changes.");
      await load(subjectId, gradingPeriod, trackKey);
      setNotice({ tone: "success", text: "Changes saved. Grade preview is up to date." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to save grading changes." });
    } finally { setSaving(false); }
  };

  const createTrack = async () => {
    const name = newTrackName.trim();
    if (!name || saving) return;
    setSaving(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_track", subjectId, gradingPeriod, trackName: name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to create grade type.");
      await load(subjectId, gradingPeriod, String(data.trackKey || ""));
      setNotice({ tone: "success", text: `${name} added for ${periodLabel(gradingPeriod)}.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to create grade type." });
    } finally { setSaving(false); }
  };

  const performDeleteTrack = async () => {
    if (!schemeSaved || tracks.length < 2 || saving) return;
    setConfirmAction(null);
    setSaving(true); setNotice(null);
    try {
      const response = await fetch("/api/admin/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_track", subjectId, gradingPeriod, trackKey }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to delete grade type.");
      await load(subjectId, gradingPeriod, "");
      setNotice({ tone: "success", text: "Grade type removed." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to delete grade type." });
    } finally { setSaving(false); }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const toggleAllReady = () => {
    setSelectedStudentIds((current) => {
      if (readyStudentIds.length && readyStudentIds.every((id) => current.has(id))) return new Set();
      return new Set(readyStudentIds);
    });
  };

  const updateTrackWeight = (key: string, value: number) => {
    setTrackWeights((current) => ({ ...current, [key]: value }));
    setTrackWeightsDirty(true);
    setNotice(null);
  };

  const saveTrackWeights = async () => {
    if (!trackWeightsValid || !trackWeightsDirty || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_track_weights",
          subjectId,
          gradingPeriod,
          trackWeights: tracks.map((track) => ({
            trackKey: track.trackKey,
            weight: finiteNumber(trackWeights[track.trackKey], track.weight),
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to save grade type weights.");
      await load(subjectId, gradingPeriod, trackKey);
      setNotice({ tone: "success", text: "Final subject grade weights saved." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to save grade type weights." });
    } finally {
      setSaving(false);
    }
  };

  const performRelease = async () => {
    if (!canRelease) return;
    setConfirmAction(null);
    setSaving(true); setNotice(null);
    try {
      const studentIds = readyStudentIds.filter((id) => selectedStudentIds.has(id));
      const response = await fetch("/api/admin/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release", subjectId, gradingPeriod, trackKey, studentIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to release grades.");
      await load(subjectId, gradingPeriod, trackKey);
      setNotice({ tone: "success", text: `${data.released || 0} ${periodLabel(gradingPeriod)} grade${data.released === 1 ? "" : "s"} released successfully.` });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to release grades." });
    } finally { setSaving(false); }
  };

  const requestDeleteTrack = () => {
    if (!schemeSaved || tracks.length < 2 || saving) return;
    setConfirmAction({
      kind: "delete-track",
      title: "Delete grade type?",
      message: `“${trackName}” will be removed from ${periodLabel(gradingPeriod)}. This is only allowed when no grades have been released.`,
      confirmLabel: "Delete grade type",
    });
  };

  const requestRelease = () => {
    if (!canRelease) return;
    const updating = releaseStatus.releasedCount > 0;
    setConfirmAction({
      kind: "release",
      title: updating ? "Release selected grades?" : `Release ${periodLabel(gradingPeriod)} grades?`,
      message: `${selectedCount} selected student${selectedCount === 1 ? "" : "s"} will receive the final ${periodLabel(gradingPeriod)} subject grade. Only the selected students will be released or updated.`,
      confirmLabel: updating ? "Release selected" : "Release selected",
    });
  };

  const formatReleaseTime = (value?: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
  };

  if (loading && !payload.subjects.length) {
    return <div className="grades-skeleton-wrap-v425" role="status" aria-label="Loading term grades workspace"><TermGradesSkeleton /><span className="grades-sr-only-v424">Loading term grades workspace…</span></div>;
  }
  if (!payload.subjects.length) {
    return <section className="grades-empty-state-v424"><div className="grades-empty-icon-v424"><BookIcon size={22} /></div><h2>No subjects available</h2><p>Create or assign a subject first. Grading is configured separately for each subject.</p></section>;
  }

  const trackOptions: SelectOption[] = tracks.length
    ? tracks.map((track) => ({
        value: track.trackKey,
        label: track.name,
        description: tracks.length > 1 ? `${finiteNumber(trackWeights[track.trackKey], track.weight).toFixed(0)}% of final grade` : undefined,
      }))
    : [{ value: "overall", label: "Subject grade" }];

  return (
    <div className={`grades-workspace-v424 grades-hierarchy-workspace-v427 grades-consistent-v430${loading ? " is-loading" : ""}`}>
      {notice ? (
        <div className={`grades-toast-v433 is-${notice.tone}`} role="status" aria-live="polite">
          <span className="grades-toast-mark-v433">{notice.tone === "success" ? <CheckIcon size={16} /> : "!"}</span>
          <div><strong>{notice.tone === "success" ? "Done" : "Needs attention"}</strong><span>{notice.text}</span></div>
          <button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button>
        </div>
      ) : null}

      <section className="grades-context-v424 grades-hierarchy-context-v427" aria-label="Grade context">
        <div className="grades-hierarchy-context-grid-v427">
          <div className="grades-hierarchy-field-v427 grades-subject-field-v433">
            <span>Subject</span>
            <MedScoresSelect
              value={subjectId}
              ariaLabel="Choose subject"
              options={payload.subjects.map((subject) => ({ value: subject.id, label: subject.name, description: [subject.code, subject.term, subject.academic_year].filter(Boolean).join(" · ") }))}
              onChange={(value) => { setSubjectId(value); setTrackKey("overall"); void load(value, gradingPeriod, "overall"); }}
            />
          </div>
          <div className="grades-hierarchy-field-v427 grades-period-field-v432">
            <span>Period</span>
            <MedScoresSelect
              value={gradingPeriod}
              ariaLabel="Choose period"
              options={PERIOD_OPTIONS}
              onChange={(value) => { setGradingPeriod(value); setTrackKey("overall"); void load(subjectId, value, "overall"); }}
            />
          </div>
          <div className="grades-hierarchy-field-v427">
            <span>Grade type</span>
            <div className="grades-track-control-v427">
              <MedScoresSelect
                value={trackOptions.some((option) => option.value === trackKey) ? trackKey : trackOptions[0].value}
                ariaLabel="Choose grade type"
                options={trackOptions}
                onChange={(value) => { setTrackKey(value); void load(subjectId, gradingPeriod, value); }}
              />
              <button className="button button-secondary grades-control-button-v429" type="button" onClick={() => setAddingTrack((current) => !current)}>Add type</button>
            </div>
          </div>
        </div>
        {addingTrack ? (
          <div className="grades-track-create-v427">
            <label><span>Grade name</span><input value={newTrackName} onChange={(event) => setNewTrackName(event.target.value)} placeholder="e.g. Practicals / Clinics" maxLength={80} /></label>
            <div><button type="button" className="button button-secondary grades-control-button-v429" onClick={() => { setAddingTrack(false); setNewTrackName(""); }}>Cancel</button><button type="button" className="button button-primary grades-control-button-v429" disabled={!newTrackName.trim() || saving} onClick={createTrack}>Create</button></div>
          </div>
        ) : null}
      </section>

      {confirmAction ? (
        <div className="grades-modal-backdrop-v433" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget && !saving) setConfirmAction(null); }}>
          <div className="grades-confirm-v433" role="dialog" aria-modal="true" aria-labelledby="grades-confirm-title-v433">
            <span className={`grades-confirm-icon-v433 is-${confirmAction.kind}`}><ScoresIcon size={20} /></span>
            <div className="grades-confirm-copy-v433">
              <h3 id="grades-confirm-title-v433">{confirmAction.title}</h3>
              <p>{confirmAction.message}</p>
            </div>
            <div className="grades-confirm-actions-v433">
              <button type="button" className="button button-secondary" disabled={saving} onClick={() => setConfirmAction(null)}>Cancel</button>
              <button type="button" className={`button ${confirmAction.kind === "delete-track" ? "grades-danger-button-v433" : "button-primary"}`} disabled={saving} onClick={() => { if (confirmAction.kind === "delete-track") void performDeleteTrack(); else void performRelease(); }}>{saving ? "Working…" : confirmAction.confirmLabel}</button>
            </div>
          </div>
        </div>
      ) : null}

      {loading ? <TermGradesSkeleton /> : (
        <>
          <div className="grades-summary-grid-v424 grades-summary-grid-v432">
            <div className="grades-summary-card-v424 grades-stat-card-v432"><span className="grades-summary-icon-v424"><ScoresIcon size={19} /></span><div><span className="grades-stat-label-v432">Components</span><strong>{components.length}</strong><small>{weightTotal.toFixed(0)}% total</small></div></div>
            <div className="grades-summary-card-v424 grades-stat-card-v432"><span className="grades-summary-icon-v424"><FileIcon size={19} /></span><div><span className="grades-stat-label-v432">Assessments</span><strong>{assignedAssessmentCount}/{assessments.length}</strong><small>Included</small></div></div>
            <div className="grades-summary-card-v424 grades-stat-card-v432"><span className="grades-summary-icon-v424"><UsersIcon size={19} /></span><div><span className="grades-stat-label-v432">Students</span><strong>{preview.length}</strong><small>{readyCount} ready</small></div></div>
            <div className="grades-summary-card-v424 grades-stat-card-v432"><span className="grades-summary-icon-v424"><CheckIcon size={19} /></span><div><span className="grades-stat-label-v432">Missing scores</span><strong>{autoZeroCount}</strong><small>Counted as 0</small></div></div>
          </div>

          {tracks.length > 1 ? (
            <section className="grades-track-weights-v476">
              <div className="grades-track-weights-head-v476">
                <div>
                  <span>Final subject grade</span>
                  <h2>Grade type weights</h2>
                  <p>Set how much each grade type contributes to the final {periodLabel(gradingPeriod)} grade.</p>
                </div>
                <strong className={trackWeightsValid ? "is-valid" : ""}>{trackWeightTotal.toFixed(2)}%</strong>
              </div>

              <div className="grades-track-weights-grid-v476">
                {tracks.map((track) => (
                  <label className="grades-track-weight-item-v476" key={track.trackKey}>
                    <span>{track.name}</span>
                    <div>
                      <input
                        type="number"
                        min="0.01"
                        max="100"
                        step="0.01"
                        value={finiteNumber(trackWeights[track.trackKey], track.weight)}
                        onChange={(event) => updateTrackWeight(track.trackKey, Number(event.target.value))}
                      />
                      <b>%</b>
                    </div>
                  </label>
                ))}
              </div>

              <div className="grades-track-weights-footer-v476">
                <span>{trackWeightsValid ? "Ready to calculate the final subject grade." : `Weights must total 100%. Current total: ${trackWeightTotal.toFixed(2)}%.`}</span>
                <button className="button button-primary" type="button" disabled={!trackWeightsDirty || !trackWeightsValid || saving} onClick={saveTrackWeights}>
                  {saving ? "Saving…" : trackWeightsDirty ? "Save weights" : "Weights saved"}
                </button>
              </div>
            </section>
          ) : null}

          <section className="grades-panel-v424 grades-hierarchy-panel-v427">
            <div className="grades-panel-heading-v424">
              <div className="grades-heading-main-v424"><span className="grades-step-v424">1</span><div><h2>Grade components</h2><p>Set how much each part counts. The total must be 100%.</p></div></div>
              <div className="grades-heading-actions-v430"><span className={`grades-weight-total-v424${topWeightValid ? " is-valid" : ""}`}>{weightTotal.toFixed(2)}% total</span><button className="grades-add-component-v424" type="button" onClick={addComponent}>Add component</button></div>
            </div>

            <div className="grades-structure-settings-v427">
              <label className="grades-text-field-v427"><span>Grade name</span><input value={trackName} onChange={(event) => { setTrackName(event.target.value); markDirty(); }} maxLength={80} /></label>
              <div className="grades-hierarchy-field-v427"><span>Decimals</span><MedScoresSelect value={String(roundingDigits)} ariaLabel="Grade rounding" options={[{ value: "0", label: "Whole grade", description: "No decimal places" }, { value: "1", label: "1 decimal", description: "Show one decimal place" }, { value: "2", label: "2 decimals", description: "Show two decimal places" }]} onChange={(value) => { setRoundingDigits(Number(value)); markDirty(); }} /></div>
              {schemeSaved && tracks.length > 1 ? <button type="button" className="button button-secondary grades-delete-track-v427 grades-control-button-v429" onClick={requestDeleteTrack}>Delete type</button> : null}
            </div>

            <div className="grades-component-list-v424 grades-hierarchy-component-list-v427">
              {components.map((component, componentIndex) => {
                const childTotal = component.subcomponents.reduce((sum, child) => sum + finiteNumber(child.weight), 0);
                const childValid = !component.subcomponents.length || Math.abs(childTotal - 100) < 0.001;
                return (
                  <div className="grades-component-row-v424 grades-hierarchy-component-v427" key={component.key}>
                    <div className="grades-component-index-v424">{componentIndex + 1}</div>
                    <div className="grades-hierarchy-component-main-v427">
                      <div className="grades-component-fields-v424">
                        <label><span>Component</span><input value={component.name} onChange={(event) => updateComponent(component.key, { name: event.target.value })} placeholder="Component name" /></label>
                        <label className="grades-weight-field-v424"><span>Weight</span><div><input type="number" min="0.01" max="100" step="0.01" value={component.weight} onChange={(event) => updateComponent(component.key, { weight: Number(event.target.value) })} /><b>%</b></div></label>
                        <div className="grades-component-actions-v431">
                          <button type="button" className="grades-add-subcomponent-v427" onClick={() => addSubcomponent(component.key)}>Add</button>
                          <button className="grades-remove-component-v424" type="button" disabled={components.length <= 1} onClick={() => removeComponent(component.key)}>Remove</button>
                        </div>
                      </div>

                      {component.subcomponents.length ? (
                        <div className="grades-subcomponents-v427">
                          <div className="grades-subcomponents-head-v427"><div><strong>Subcomponents</strong><span>Optional · add only when this component needs its own weights.</span></div><span className={childValid ? "is-valid" : ""}>{childTotal.toFixed(2)}% total</span></div>
                          {component.subcomponents.map((child) => (
                            <div className="grades-subcomponent-row-v427" key={child.key}>
                              <label><span>Subcomponent</span><input value={child.name} onChange={(event) => updateSubcomponent(component.key, child.key, { name: event.target.value })} placeholder="e.g. Quizzes" /></label>
                              <label><span>Weight</span><div className="grades-subcomponent-weight-v427"><input type="number" min="0.01" max="100" step="0.01" value={child.weight} onChange={(event) => updateSubcomponent(component.key, child.key, { weight: Number(event.target.value) })} /><b>%</b></div></label>
                              <button type="button" onClick={() => removeSubcomponent(component.key, child.key)}>Remove</button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grades-panel-v424 grades-hierarchy-panel-v427">
            <div className="grades-panel-heading-v424">
              <div className="grades-heading-main-v424"><span className="grades-step-v424">2</span><div><h2>Assessments</h2><p>Choose which grade part each assessment belongs to.</p></div></div>

            </div>
            <div className="grades-assessment-list-v424">
              {assessments.map((assessment) => {
                const external = assignmentContexts[assessment.id];
                const externalElsewhere = external && (external.gradingPeriod !== gradingPeriod || external.trackKey !== trackKey);
                return (
                  <div className={`grades-assessment-row-v424${assignments[assessment.id] ? " is-assigned" : ""}`} key={assessment.id}>
                    <div className="grades-assessment-copy-v424">
                      <div className="grades-assessment-title-v424"><strong>{assessment.title}</strong>{assignments[assessment.id] ? <span className="grades-assessment-included-v431">Included</span> : null}</div>
                      <span>{assessment.assessment_type || "Assessment"} · {assessment.total_score} points</span>
                      {externalElsewhere ? <small className="grades-assessment-location-v427">Used in {periodLabel(external.gradingPeriod)} · {external.trackName} · {external.componentName}. Choosing a new place here will move it when you save.</small> : null}
                    </div>
                    <div className="grades-assessment-select-v424">
                      <MedScoresSelect
                        value={assignments[assessment.id] || ""}
                        ariaLabel={`Grade component for ${assessment.title}`}
                        options={[{ value: "", label: externalElsewhere ? "Keep current" : "Not included", description: externalElsewhere ? "Leave its current grade assignment unchanged" : "This assessment will not count in this grade" }, ...leafOptions]}
                        onChange={(value) => updateAssignment(assessment.id, value)}
                      />
                    </div>
                  </div>
                );
              })}
              {!assessments.length ? <div className="grades-inline-empty-v424"><FileIcon size={19} /><div><strong>No assessments yet</strong><span>Create assessments for this subject before adding them to the grade.</span></div></div> : null}
            </div>
            <div className="grades-save-bar-v424">
              <div><strong>{configDirty ? "Unsaved changes" : schemeSaved ? "All changes saved" : "Save grade settings"}</strong><span>{!topWeightValid ? `Components total ${weightTotal.toFixed(2)}%. They must equal 100%.` : !subWeightsValid ? "Subcomponents must total 100%." : !weightsPositive ? "Every weight must be greater than zero." : !namesValid ? "Enter a name for each item." : configDirty ? "Save to update student grades." : "Ready."}</span></div>
              <button className="button button-primary" type="button" disabled={!canSave} onClick={save}>{saving ? "Saving…" : configDirty || !schemeSaved ? "Save changes" : "Saved"}</button>
            </div>
          </section>

          <section className="grades-panel-v424 grades-preview-panel-v424 grades-hierarchy-panel-v427 grades-preview-panel-v476">
            <div className="grades-panel-heading-v424">
              <div className="grades-heading-main-v424"><span className="grades-step-v424">3</span><div><h2>Student grades</h2><p>Select the students whose final {periodLabel(gradingPeriod)} grade you want to release.</p></div></div>
              <div className="grades-ready-cluster-v424"><span><strong>{readyCount}</strong> ready</span><span><strong>{incompleteCount}</strong> unavailable</span></div>
            </div>

            {configDirty || trackWeightsDirty ? (
              <div className="grades-preview-stale-v424">
                <span>!</span>
                <div><strong>Save your changes</strong><p>Save the grading setup and grade type weights before release.</p></div>
              </div>
            ) : null}

            <div className="grades-release-selection-bar-v476">
              <div>
                <strong>{selectedCount} selected</strong>
                <span>Only selected ready students will receive or update their grade.</span>
              </div>
              <button type="button" onClick={toggleAllReady} disabled={!readyStudentIds.length}>
                {allReadySelected ? "Clear selection" : "Select all ready"}
              </button>
            </div>

            <div className="grades-preview-table-v424 grades-preview-table-v476">
              <div className="grades-preview-head-v424 grades-preview-head-v476" aria-hidden="true">
                <span>Student</span>
                <span>Grade types</span>
                <span>Final grade</span>
                <span>Status</span>
              </div>

              {preview.map((row) => {
                const studentId = String(row.studentId);
                const isReleased = releasedStudentIds.has(studentId);
                const isSelected = selectedStudentIds.has(studentId) && row.complete;
                const rowTracks = row.trackGrades || [];

                return (
                  <details className="grades-preview-row-v424 grades-hierarchy-preview-row-v427 grades-preview-row-v476" key={row.studentId}>
                    <summary>
                      <span className="grades-student-cell-v424 grades-student-cell-v476">
                        <button
                          type="button"
                          className={`grades-student-select-v476${isSelected ? " is-selected" : ""}`}
                          aria-label={`${isSelected ? "Deselect" : "Select"} ${row.name}`}
                          aria-pressed={isSelected}
                          disabled={!row.complete}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (row.complete) toggleStudentSelection(studentId);
                          }}
                        >
                          {isSelected ? <CheckIcon size={13} /> : null}
                        </button>
                        <span><strong>{row.name}</strong>{row.codeName ? <small>{row.codeName}</small> : null}</span>
                      </span>

                      <span className="grades-track-snapshot-v476" data-label="Grade types">
                        {rowTracks.length ? rowTracks.map((track) => (
                          <span key={track.trackKey}>
                            <small>{track.name}</small>
                            <strong>{track.termGrade ?? "—"}</strong>
                          </span>
                        )) : <span><small>Subject grade</small><strong>—</strong></span>}
                      </span>

                      <span className="grades-data-cell-v424 grades-final-value-v424 grades-final-value-v476" data-label="Final grade">{row.termGrade ?? "—"}</span>
                      <span className="grades-status-cell-v424" data-label="Status"><span className={`grades-status-v424 ${isReleased ? "is-released" : row.complete ? "is-ready" : "is-incomplete"}`}>{isReleased ? "Released" : row.complete ? "Ready" : "Unavailable"}</span></span>
                    </summary>

                    <div className="grades-combined-details-v476">
                      <div className="grades-combined-details-head-v476">
                        <div><strong>Final grade calculation</strong><span>{periodLabel(gradingPeriod)} · {rowTracks.length > 1 ? `${rowTracks.length} grade types` : rowTracks[0]?.name || "Subject grade"}</span></div>
                        {row.missingCount ? <span>{row.missingCount} missing {row.missingCount === 1 ? "score" : "scores"} counted as 0</span> : null}
                      </div>

                      <div className="grades-combined-track-list-v476">
                        {rowTracks.map((track) => (
                          <section className="grades-combined-track-v476" key={track.trackKey}>
                            <div className="grades-combined-track-head-v476">
                              <div><strong>{track.name}</strong><span>{formatScore(track.weight)}% of final grade</span></div>
                              <strong>{track.termGrade ?? "—"}</strong>
                            </div>

                            <div className="grades-combined-component-list-v476">
                              {track.components.map((component, index) => (
                                <div className="grades-combined-component-v476" key={component.componentId || `${track.trackKey}-${component.name}-${index}`}>
                                  <div><strong>{component.name}</strong><span>{formatScore(component.earned)} / {formatScore(component.possible)} points</span></div>
                                  <span>{formatScore(component.weight)}%</span>
                                  <strong>{normalizedComponentGrade(component).toFixed(2)}</strong>
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>

                      <div className="grades-combined-total-v476">
                        <span>Final {periodLabel(gradingPeriod)} grade</span>
                        <strong>{row.termGrade ?? "—"}</strong>
                      </div>
                    </div>
                  </details>
                );
              })}

              {!preview.length ? <div className="grades-inline-empty-v424 grades-preview-empty-v424"><UsersIcon size={19} /><div><strong>No student grades yet</strong><span>Save your settings and record assessment scores first.</span></div></div> : null}
            </div>

            <div className={`grades-release-bar-v424 grades-release-bar-v433 grades-release-bar-v476${releaseStatus.releasedCount ? " is-released" : ""}`}>
              <div className="grades-release-copy-v424">
                <span className="grades-release-icon-v424"><ScoresIcon size={18} /></span>
                <div>
                  <div className="grades-release-title-v433">
                    <strong>{releaseStatus.releasedCount ? `${periodLabel(gradingPeriod)} grades released` : `Release ${periodLabel(gradingPeriod)} grades`}</strong>
                    {releaseStatus.releasedCount ? <span className="grades-release-badge-v433">Released</span> : null}
                  </div>
                  <span>
                    {configDirty
                      ? "Save your grading changes first."
                      : trackWeightsDirty
                        ? "Save the final grade weights first."
                        : !trackWeightsValid
                          ? "Grade type weights must total 100%."
                          : selectedCount
                            ? `${selectedCount} selected · ${readyCount} ready${incompleteCount ? ` · ${incompleteCount} unavailable` : ""}.`
                            : "Select at least one ready student."}
                  </span>
                </div>
              </div>
              <button className="button button-primary" type="button" disabled={!canRelease} onClick={requestRelease}>
                {saving ? "Working…" : `Release ${selectedCount || ""} selected`.trim()}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
