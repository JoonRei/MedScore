"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "@/components/icons";

export function ScoreEntryClient({ assessment, students }: { assessment: any; students: any[] }) {
  const router = useRouter();
  const initial = Object.fromEntries(students.map((student) => [student.id, student.score ?? ""]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [paste, setPaste] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);

  const entered = useMemo(() => Object.values(values).filter((value) => value !== "").length, [values]);
  const progress = students.length ? Math.round((entered / students.length) * 100) : 0;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((student) => `${student.first_name} ${student.last_name} ${student.code_name} ${student.student_number || ""}`.toLowerCase().includes(q));
  }, [students, query]);

  function update(studentId: string, next: string) {
    setValues((current) => ({ ...current, [studentId]: next }));
    setDirty(true); setMessage(""); setError("");
  }

  function applyPaste() {
    setError(""); setMessage("");
    const raw = paste.split(/\r?\n|\t|,/).map((value) => value.trim()).filter(Boolean);
    if (!raw.length) { setError("Paste at least one score first."); return; }
    const invalid = raw.find((value) => !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > Number(assessment.total_score));
    if (invalid !== undefined) { setError(`“${invalid}” is outside the valid 0–${assessment.total_score} range.`); return; }
    const next = { ...values };
    students.forEach((student, index) => { if (raw[index] !== undefined) next[student.id] = raw[index]; });
    setValues(next); setDirty(true); setMessage(`${Math.min(raw.length, students.length)} pasted scores applied.`);
  }

  function clearVisible() {
    const visibleIds = new Set(visible.map((student) => student.id));
    setValues((current) => Object.fromEntries(Object.entries(current).map(([id, value]) => [id, visibleIds.has(id) ? "" : value])));
    setDirty(true); setMessage("Visible score fields cleared. Save to apply the change."); setError("");
  }

  async function save() {
    setBusy(true); setMessage(""); setError("");
    const invalidStudent = students.find((student) => {
      const value = values[student.id];
      if (value === "") return false;
      const number = Number(value);
      return !Number.isFinite(number) || number < 0 || number > Number(assessment.total_score);
    });
    if (invalidStudent) {
      setBusy(false); setError(`Check the score entered for ${invalidStudent.last_name}, ${invalidStudent.first_name}. Valid scores are 0–${assessment.total_score}.`); return;
    }
    const response = await fetch(`/api/admin/assessments/${assessment.id}/scores`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scores: students.map((student) => ({ studentId: student.id, score: values[student.id] === "" ? null : values[student.id] })) }),
    });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setError(body.error || "Unable to save scores."); return; }
    setDirty(false); setMessage("Scores saved successfully."); router.refresh();
  }

  return <div className="score-entry-head">
    <div className="panel score-workspace">
      <div className="panel-header score-panel-head">
        <div><h2>{assessment.title}</h2><p>{assessment.assessment_type} · Maximum {assessment.total_score} points</p></div>
        <button className="button button-primary" type="button" onClick={save} disabled={busy || !dirty}>{busy ? "Saving…" : dirty ? "Save scores" : "Saved"}</button>
      </div>
      <div className="score-summary-strip">
        <div><span>Completion</span><strong>{entered} / {students.length}</strong></div>
        <div className="score-progress"><span style={{ width: `${progress}%` }} /></div>
        <b>{progress}%</b>
      </div>
      {(message || error) && <div className={`alert ${error ? "alert-error" : "alert-success"} score-feedback`}>{error || message}</div>}
      <div className="score-toolbar">
        <div className="search-box"><SearchIcon size={17}/><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student or code name" /></div>
        <button type="button" className="button button-secondary button-sm" onClick={clearVisible} disabled={!visible.length}>Clear visible</button>
      </div>
      <div className="table-wrap responsive-table-wrap"><table className="responsive-table score-entry-table"><thead><tr><th>Student</th><th>Code Name</th><th>Score</th></tr></thead><tbody>
        {visible.map((student) => {
          const raw = values[student.id];
          const invalid = raw !== "" && (!Number.isFinite(Number(raw)) || Number(raw) < 0 || Number(raw) > Number(assessment.total_score));
          return <tr key={student.id}>
            <td data-label="Student"><div className="student-cell"><span className="table-avatar">{student.first_name.slice(0,1)}{student.last_name.slice(0,1)}</span><div className="cell-title"><strong>{student.last_name}, {student.first_name}</strong><small>{student.student_number || "No student number"}</small></div></div></td>
            <td data-label="Code Name"><span className="code-badge">{student.code_name}</span></td>
            <td data-label="Score"><div className={`score-input-wrap ${invalid ? "invalid" : ""}`}><input className="input" inputMode="decimal" value={raw} onChange={(event) => update(student.id, event.target.value.replace(/[^0-9.]/g, ""))} placeholder="—" /><span>/ {assessment.total_score}</span></div></td>
          </tr>;
        })}
        {!visible.length && <tr><td colSpan={3}><div className="table-empty"><strong>No students found</strong><span>Try a different search.</span></div></td></tr>}
      </tbody></table></div>
    </div>
    <aside className="paste-card">
      <span className="modal-eyebrow">Quick entry</span><h3>Paste a score column</h3><p>Copy scores from Excel or Google Sheets. They are applied in the same student order as this assessment list.</p>
      <textarea className="textarea paste-area" value={paste} onChange={(event) => setPaste(event.target.value)} placeholder={"42\n46\n38\n45"} />
      <button className="button button-secondary button-block" type="button" onClick={applyPaste}>Apply pasted scores</button>
      <div className="paste-note"><strong>Accepted range</strong><span>0 to {assessment.total_score} points</span></div>
    </aside>
  </div>;
}
