"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { formatDate } from "@/lib/utils";
import { ToastNotice } from "@/components/ui/ToastNotice";

type EntryStatus = "unentered" | "scored" | "absent";
type EntryState = { value: string; status: EntryStatus };
type Filter = "all" | EntryStatus;

export function ScoreEntryClient({ assessment, students }: { assessment: any; students: any[] }) {
  const router = useRouter();
  const initial = Object.fromEntries(students.map((student) => [student.id, {
    value: student.result_status === "scored" && student.score != null ? String(student.score) : "",
    status: student.result_status === "absent" ? "absent" : student.score != null ? "scored" : "unentered",
  }])) as Record<string, EntryState>;

  const [entries, setEntries] = useState<Record<string, EntryState>>(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const maxScore = Number(assessment.total_score);

  function isInvalid(entry: EntryState | undefined) {
    if (!entry || entry.status !== "scored") return false;
    if (entry.value.trim() === "") return true;
    const value = Number(entry.value);
    return !Number.isFinite(value) || value < 0 || value > maxScore;
  }

  const totals = useMemo(() => {
    const all = Object.values(entries) as EntryState[];
    const scored = all.filter((entry) => entry.status === "scored").length;
    const absent = all.filter((entry) => entry.status === "absent").length;
    const recorded = scored + absent;
    return { scored, absent, recorded, remaining: Math.max(students.length - recorded, 0), progress: students.length ? Math.round((recorded / students.length) * 100) : 0 };
  }, [entries, students.length]);

  const invalidCount = useMemo(() => (Object.values(entries) as EntryState[]).filter((entry) => isInvalid(entry)).length, [entries, maxScore]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((student) => {
      const entry = entries[student.id] || { status: "unentered" as EntryStatus, value: "" };
      const matchesQuery = !q || `${student.first_name} ${student.last_name} ${student.code_name} ${student.student_number || ""}`.toLowerCase().includes(q);
      const matchesFilter = filter === "all" || entry.status === filter;
      return matchesQuery && matchesFilter;
    });
  }, [students, entries, query, filter]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const protectLinks = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.href === window.location.href) return;
      if (!window.confirm("You have unsaved score changes. Leave this page without saving?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", protectLinks, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", protectLinks, true);
    };
  }, [dirty]);

  function setEntry(studentId: string, next: EntryState) {
    setEntries((current) => ({ ...current, [studentId]: next }));
    setDirty(true); setMessage(""); setError("");
  }

  function updateScore(studentId: string, raw: string) {
    let next = raw.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
    if (next.includes(".")) {
      const [whole, decimal = ""] = next.split(".");
      next = `${whole}.${decimal.slice(0, 2)}`;
    }
    setEntry(studentId, { value: next, status: next === "" ? "unentered" : "scored" });
  }

  function toggleAbsent(studentId: string) {
    const current = entries[studentId];
    setEntry(studentId, current?.status === "absent" ? { value: "", status: "unentered" } : { value: "", status: "absent" });
  }

  function handleScoreKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!["Enter", "ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-score-input="true"]:not(:disabled)'));
    const index = inputs.indexOf(event.currentTarget);
    if (index < 0) return;
    const direction = event.key === "ArrowUp" ? -1 : 1;
    const next = inputs[index + direction];
    if (next) { next.focus(); next.select(); }
  }

  function parsePasteColumn(text: string) {
    let normalized = text.replace(/\r/g, "");
    if (normalized.endsWith("\n")) normalized = normalized.slice(0, -1);
    if (normalized.includes("\n") || normalized.includes("\t")) return normalized.split(/\n|\t/).map((value) => value.trim());
    return normalized.split(",").map((value) => value.trim());
  }

  function applyPaste() {
    setError(""); setMessage("");
    if (paste === "") { setError("Paste a score column first."); return; }
    const raw = parsePasteColumn(paste);
    if (raw.length > students.length) { setError(`The pasted column has ${raw.length} rows, but this subject has only ${students.length} enrolled students.`); return; }
    const invalid = raw.find((value) => value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > maxScore));
    if (invalid !== undefined) { setError(`“${invalid}” is outside the valid 0–${assessment.total_score} range.`); return; }

    const next = { ...entries };
    students.forEach((student, index) => {
      if (raw[index] === undefined) return;
      next[student.id] = raw[index] === "" ? { value: "", status: "absent" } : { value: raw[index], status: "scored" };
    });
    setEntries(next);
    setDirty(true);
    setPasteOpen(false);
    setPaste("");
    setMessage(`${raw.length} roster entr${raw.length === 1 ? "y" : "ies"} applied. Blank rows were marked Did not take.`);
  }

  function clearVisible() {
    const ids = new Set(visible.map((student) => student.id));
    setEntries((current) => Object.fromEntries(Object.entries(current).map(([id, entry]) => [id, ids.has(id) ? { value: "", status: "unentered" } : entry])) as Record<string, EntryState>);
    setDirty(true); setMessage("Visible entries cleared. Save to apply the change."); setError("");
  }

  async function save() {
    setMessage(""); setError("");
    const invalidStudent = students.find((student) => isInvalid(entries[student.id]));
    if (invalidStudent) {
      setError(`Check the score entered for ${invalidStudent.last_name}, ${invalidStudent.first_name}. Valid scores are 0–${assessment.total_score}.`);
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/admin/assessments/${assessment.id}/scores`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scores: students.map((student) => ({ studentId: student.id, score: entries[student.id]?.value || null, status: entries[student.id]?.status || "unentered" })) }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(body.error || "Unable to save scores."); return; }
    setDirty(false); setMessage("Score entries saved successfully."); router.refresh();
  }

  return <>
    <section className="score-entry-overview">
      <div className="score-assessment-copy">
        <span className="modal-eyebrow">{assessment.assessment_type}</span>
        <h2>{assessment.title}</h2>
        <p>{assessment.subjectName} · {formatDate(assessment.assessment_date)} · Maximum {assessment.total_score} points{assessment.doctor_name ? ` · ${assessment.doctor_name}` : ""}</p>
      </div>
      <div className="score-save-area">{dirty && <span className="unsaved-label">Unsaved changes</span>}<button className="button button-primary score-save-button" type="button" onClick={save} disabled={busy || !dirty || invalidCount > 0}>{busy ? "Saving…" : dirty ? "Save entries" : "Saved"}</button></div>
    </section>

    <div className="score-metric-grid">
      <div><span>Enrolled</span><strong>{students.length}</strong></div>
      <div><span>Scored</span><strong>{totals.scored}</strong></div>
      <div><span>Did not take</span><strong>{totals.absent}</strong></div>
      <div><span>Remaining</span><strong>{totals.remaining}</strong></div>
    </div>

    <div className="score-progress-line"><span><i style={{ width: `${totals.progress}%` }} /></span><strong>{totals.progress}% complete</strong></div>
    {invalidCount > 0 && <div className="alert alert-error score-feedback">{invalidCount} invalid score entr{invalidCount === 1 ? "y" : "ies"}. Every score must be between 0 and {assessment.total_score}.</div>}
    {(message || error) && <ToastNotice message={error || message} tone={error ? "error" : "success"} onDismiss={() => { setError(""); setMessage(""); }} />}

    <section className="score-roster-surface">
      <div className="score-roster-toolbar">
        <div className="search-box"><SearchIcon size={17} /><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student or code name" /></div>
        <div className="score-filter-tabs" aria-label="Filter score entries">
          {(["all", "scored", "absent", "unentered"] as Filter[]).map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "All" : item === "scored" ? "Scored" : item === "absent" ? "Did not take" : "Not entered"}</button>)}
        </div>
        <div className="score-toolbar-actions"><button className="button button-secondary button-sm" type="button" onClick={() => { setPasteOpen(true); setError(""); }}>Paste scores</button><button className="button button-quiet button-sm" type="button" onClick={clearVisible} disabled={!visible.length}>Clear visible</button></div>
      </div>

      <div className="score-keyboard-note">Keyboard: Enter or ↓ moves to the next score, ↑ moves back. Focusing a score selects it so typing replaces the existing value.</div>
      <div className="score-entry-list-head" aria-hidden="true"><span>Student</span><span>Code Name</span><span>Entry</span></div>
      <div className="score-entry-list">
        {visible.map((student) => {
          const entry = entries[student.id] || { value: "", status: "unentered" as EntryStatus };
          const invalid = isInvalid(entry);
          return <article className={`score-entry-row ${entry.status === "absent" ? "is-absent" : entry.status === "scored" ? "is-scored" : ""} ${invalid ? "has-invalid-score" : ""}`} key={student.id}>
            <div className="student-cell score-student-cell"><span className="table-avatar">{student.first_name.slice(0,1)}{student.last_name.slice(0,1)}</span><div className="cell-title"><strong>{student.last_name}, {student.first_name}</strong><small>{student.student_number || "No student number"}</small></div></div>
            <div className="score-code-cell"><span className="code-badge">{student.code_name}</span></div>
            <div className="score-entry-control">
              <div className={`score-input-wrap ${invalid ? "invalid" : ""} ${entry.status === "absent" ? "is-disabled" : ""}`}><input className="input" data-score-input="true" inputMode="decimal" type="text" value={entry.value} disabled={entry.status === "absent"} onChange={(event) => updateScore(student.id, event.target.value)} onFocus={(event) => event.currentTarget.select()} onKeyDown={handleScoreKeyDown} aria-invalid={invalid} aria-label={`Score for ${student.code_name}`} /><span>/ {assessment.total_score}</span></div>
              <button type="button" className={`score-absence-toggle ${entry.status === "absent" ? "active" : ""}`} onClick={() => toggleAbsent(student.id)}>{entry.status === "absent" ? "Did not take" : "Mark absent"}</button>
              {invalid && <small className="score-inline-error">Enter 0–{assessment.total_score}</small>}
            </div>
          </article>;
        })}
        {!visible.length && <div className="table-empty"><strong>No students found</strong><span>Try another search or filter.</span></div>}
      </div>
    </section>

    {pasteOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPasteOpen(false)}>
      <div className="modal modal-compact paste-score-modal" role="dialog" aria-modal="true" aria-labelledby="paste-score-title">
        <div className="modal-header"><div><span className="modal-eyebrow">Quick entry</span><h2 id="paste-score-title">Paste score column</h2><p>Paste one roster-aligned column from Excel or Google Sheets. Keep an empty row for a student who did not take the assessment.</p></div><button type="button" className="modal-close" onClick={() => setPasteOpen(false)} aria-label="Close"><CloseIcon size={20} /></button></div>
        <div className="modal-body"><textarea className="textarea paste-area-v2" value={paste} onChange={(event) => setPaste(event.target.value)} autoFocus /><div className="paste-rule"><span>Rows map from the first enrolled student downward.</span><strong>Blank row = Did not take</strong></div></div>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setPasteOpen(false)}>Cancel</button><button type="button" className="button button-primary" onClick={applyPaste}>Apply entries</button></div>
      </div>
    </div>}
  </>;
}
