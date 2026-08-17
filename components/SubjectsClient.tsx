"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveIcon, CloseIcon, DeleteIcon, EditIcon, RestoreIcon, SearchIcon, UsersIcon } from "@/components/icons";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { TERMS, YEAR_LEVELS } from "@/lib/constants";
import { CustomSelect } from "@/components/ui/CustomSelect";

const yearOptions = [{ value: "all", label: "All year levels" }, ...YEAR_LEVELS.map((year) => ({ value: year, label: year }))];
const statusOptions = [
  { value: "all", label: "All subjects" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

type StudentOption = {
  id: string;
  first_name: string;
  last_name: string;
  code_name: string;
  student_number: string | null;
  year_level: string;
  is_active: boolean;
};

type SubjectRow = {
  id: string;
  name: string;
  code: string | null;
  year_level: string;
  term: string;
  academic_year: string;
  is_archived: boolean;
  enrollments: Array<{ student_id: string }>;
};

function SubjectFields({ subject }: { subject?: SubjectRow }) {
  return (
    <div className="form-grid">
      <div className="field full"><label>Subject name</label><input className="input" name="name" defaultValue={subject?.name || ""} autoComplete="off" required /></div>
      <div className="field"><label>Subject code</label><input className="input code-input" name="code" defaultValue={subject?.code || ""} autoComplete="off" /></div>
      <div className="field"><label>Year level</label><CustomSelect name="yearLevel" defaultValue={subject?.year_level || ""} options={YEAR_LEVELS.map((year) => ({ value: year, label: year }))} placeholder="Choose year level" /></div>
      <div className="field"><label>Term</label><CustomSelect name="term" defaultValue={subject?.term || ""} options={TERMS.map((term) => ({ value: term, label: term }))} placeholder="Choose term" /></div>
      <div className="field"><label>Academic year</label><input className="input" name="academicYear" defaultValue={subject?.academic_year || ""} autoComplete="off" required /></div>
    </div>
  );
}

function SubjectRoster({
  subject,
  students,
  selected,
  setSelected,
}: {
  subject: SubjectRow;
  students: StudentOption[];
  selected: Set<string>;
  setSelected: (next: Set<string>) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = students.filter((student) => !q || `${student.first_name} ${student.last_name} ${student.code_name} ${student.student_number || ""} ${student.year_level}`.toLowerCase().includes(q));
  const suggested = students.filter((student) => student.year_level === subject.year_level && student.is_active);
  const activeStudents = students.filter((student) => student.is_active);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  function selectIds(ids: string[]) {
    const next = new Set(selected);
    ids.forEach((id) => next.add(id));
    setSelected(next);
  }

  return (
    <div className="roster-manager">
      <div className="roster-summary">
        <div><strong>{selected.size}</strong><span>selected</span></div>
        <div><strong>{suggested.length}</strong><span>{subject.year_level}</span></div>
        <div><strong>{students.filter((student) => student.is_active).length}</strong><span>active students</span></div>
      </div>

      <div className="roster-smartbar">
        <button type="button" className="button button-soft button-sm" onClick={() => selectIds(suggested.map((student) => student.id))}>Select {subject.year_level}</button>
        <button type="button" className="button button-secondary button-sm" onClick={() => setSelected(new Set(activeStudents.map((student) => student.id)))}>Select All</button>
        <button type="button" className="button button-quiet button-sm" onClick={() => setSelected(new Set())}>Clear All</button>
      </div>

      <div className="search-box roster-search"><SearchIcon size={17}/><input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students" /></div>

      <div className="roster-list" role="listbox" aria-multiselectable="true">
        {filtered.map((student) => {
          const isSelected = selected.has(student.id);
          return (
            <button
              key={student.id}
              type="button"
              className={`roster-row ${isSelected ? "selected" : ""} ${!student.is_active ? "inactive" : ""}`}
              onClick={() => (student.is_active || isSelected) && toggle(student.id)}
              aria-selected={isSelected}
              aria-disabled={!student.is_active && !isSelected}
            >
              <span className="table-avatar">{student.first_name.slice(0, 1)}{student.last_name.slice(0, 1)}</span>
              <span className="roster-copy">
                <strong>{student.last_name}, {student.first_name}</strong>
                <small>{student.code_name} · {student.year_level}{student.student_number ? ` · ${student.student_number}` : ""}</small>
              </span>
              <span className="roster-state">{isSelected ? "Selected" : student.is_active ? "Select" : "Inactive"}</span>
            </button>
          );
        })}
        {!filtered.length && <div className="table-empty roster-empty"><strong>No students found</strong><span>Try another search.</span></div>}
      </div>
    </div>
  );
}

export function SubjectsClient({ subjects, students }: { subjects: SubjectRow[]; students: StudentOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<SubjectRow | null>(null);
  const [rosterSubject, setRosterSubject] = useState<SubjectRow | null>(null);
  const [rosterSelection, setRosterSelection] = useState<Set<string>>(new Set());
  const [rosterInitialSelection, setRosterInitialSelection] = useState<Set<string>>(new Set());
  const [rosterOverrides, setRosterOverrides] = useState<Record<string, string[]>>({});
  const [deleteSubject, setDeleteSubject] = useState<SubjectRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("all");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => subjects.filter((subject) => {
    const q = query.trim().toLowerCase();
    const queryMatch = !q || `${subject.name} ${subject.code || ""} ${subject.academic_year}`.toLowerCase().includes(q);
    const yearMatch = year === "all" || subject.year_level === year;
    const statusMatch = status === "all" || (status === "active" ? !subject.is_archived : subject.is_archived);
    return queryMatch && yearMatch && statusMatch;
  }), [subjects, query, year, status]);

  async function submit(event: React.FormEvent<HTMLFormElement>, subject?: SubjectRow) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    const payload = { name: form.get("name"), code: form.get("code"), yearLevel: form.get("yearLevel"), term: form.get("term"), academicYear: form.get("academicYear") };
    const response = await fetch(subject ? `/api/admin/subjects/${subject.id}` : "/api/admin/subjects", { method: subject ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setError(body.error || `Unable to ${subject ? "update" : "create"} subject.`); return; }
    setOpen(false); setEdit(null); setNotice(subject ? "Subject updated." : "Subject created."); router.refresh();
  }

  async function archive(subject: SubjectRow) {
    setBusy(true); setError(""); setNotice("");
    const response = await fetch(`/api/admin/subjects/${subject.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isArchived: !subject.is_archived }) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setError(body.error || "Unable to update subject."); return; }
    setNotice(subject.is_archived ? "Subject restored." : "Subject archived. Existing academic records were kept."); router.refresh();
  }

  function enrollmentIdsFor(subject: SubjectRow) {
    return rosterOverrides[subject.id] || (subject.enrollments || []).map((row) => row.student_id);
  }

  function openRoster(subject: SubjectRow) {
    setError("");
    const existing = new Set(enrollmentIdsFor(subject));
    setRosterSubject(subject);
    setRosterSelection(existing);
    setRosterInitialSelection(new Set(existing));
  }

  async function saveRoster() {
    if (!rosterSubject) return;
    const subject = rosterSubject;
    const previousIds = [...rosterInitialSelection];
    const nextIds = [...rosterSelection];
    const addIds = nextIds.filter((id) => !rosterInitialSelection.has(id));
    const removeIds = previousIds.filter((id) => !rosterSelection.has(id));

    if (!addIds.length && !removeIds.length) {
      setNotice(`${subject.name} roster is already up to date.`);
      setRosterSubject(null);
      return;
    }

    // Update the visible roster immediately; roll it back only if the server rejects the change.
    setRosterOverrides((current) => ({ ...current, [subject.id]: nextIds }));
    setRosterSubject(null);
    setBusy(true);
    setError("");
    setNotice(`Saving ${subject.name} roster…`);

    const response = await fetch(`/api/admin/subjects/${subject.id}/students`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addIds, removeIds, total: nextIds.length }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);

    if (!response.ok) {
      setRosterOverrides((current) => ({ ...current, [subject.id]: previousIds }));
      setNotice("");
      setError(body.error || "Unable to update the subject roster.");
      return;
    }

    setNotice(`${subject.name} roster updated with ${nextIds.length} students.`);
  }

  async function confirmDelete() {
    if (!deleteSubject) return;
    setBusy(true); setError(""); setNotice("");
    const response = await fetch(`/api/admin/subjects/${deleteSubject.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({})); setBusy(false);
    if (!response.ok) { setError(body.error || "Unable to delete subject."); setDeleteSubject(null); return; }
    setNotice(`${deleteSubject.name} was deleted.`);
    setDeleteSubject(null);
    router.refresh();
  }

  function close() { setOpen(false); setEdit(null); setError(""); }

  return (
    <>
      {notice && <div className="alert alert-success page-feedback">{notice}<button type="button" onClick={() => setNotice("")}>Dismiss</button></div>}
      {error && !open && !edit && !rosterSubject && !deleteSubject && <div className="alert alert-error page-feedback">{error}<button type="button" onClick={() => setError("")}>Dismiss</button></div>}
      <div className="panel data-panel">
        <div className="panel-header panel-header-stack-mobile"><div><h2>Subject catalog</h2><p>Organize subjects and manage student rosters from one place.</p></div><button className="button button-primary" onClick={() => { setError(""); setOpen(true); }}>Add subject</button></div>
        <div className="toolbar">
          <div className="search-box toolbar-search"><SearchIcon size={17}/><input className="input" placeholder="Search subject, code or academic year" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="toolbar-filters"><CustomSelect value={year} onChange={setYear} options={yearOptions} /><CustomSelect value={status} onChange={setStatus} options={statusOptions} /></div>
          <div className="toolbar-count"><strong>{filtered.length}</strong><span>of {subjects.length} subjects</span></div>
        </div>
        <div className="table-wrap responsive-table-wrap"><table className="responsive-table"><thead><tr><th>Subject</th><th>Year Level</th><th>Term</th><th>Students</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {filtered.map((subject) => <tr key={subject.id}>
            <td data-label="Subject"><div className="student-cell"><span className="subject-mini-mark">{(subject.code || subject.name).slice(0, 3).toUpperCase()}</span><div className="cell-title"><strong>{subject.name}</strong><small>{subject.code || "No subject code"} · {subject.academic_year}</small></div></div></td>
            <td data-label="Year Level">{subject.year_level}</td><td data-label="Term">{subject.term}</td><td data-label="Students"><span className="count-pill">{enrollmentIdsFor(subject).length}</span></td>
            <td data-label="Status"><span className={`status-dot ${subject.is_archived ? "inactive" : "active"}`}><i />{subject.is_archived ? "Archived" : "Active"}</span></td>
            <td data-label="Actions"><ActionMenu items={[
              { label: "Manage students", icon: UsersIcon, onClick: () => openRoster(subject) },
              { label: "Edit subject", icon: EditIcon, onClick: () => { setError(""); setEdit(subject); } },
              { label: subject.is_archived ? "Restore subject" : "Archive subject", icon: subject.is_archived ? RestoreIcon : ArchiveIcon, tone: subject.is_archived ? "accent" : "default", disabled: busy, onClick: () => void archive(subject) },
              { label: "Delete subject", icon: DeleteIcon, tone: "danger", disabled: busy, onClick: () => setDeleteSubject(subject) },
            ]} /></td>
          </tr>)}
          {!filtered.length && <tr><td colSpan={6}><div className="table-empty"><strong>No subjects found</strong><span>Try another search or filter.</span></div></td></tr>}
        </tbody></table></div>
      </div>

      {(open || edit) && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="modal" onSubmit={(event) => submit(event, edit || undefined)}>
        <div className="modal-header"><div><span className="modal-eyebrow">Curriculum</span><h2>{edit ? "Edit subject" : "Add subject"}</h2><p>{edit ? "Update the subject details without changing existing records." : "Create a subject for the current or upcoming academic term."}</p></div><button type="button" className="modal-close" onClick={close} aria-label="Close"><CloseIcon size={20} /></button></div>
        <div className="modal-body">{error && <div className="alert alert-error modal-alert">{error}</div>}<SubjectFields key={edit?.id || "new"} subject={edit || undefined} /></div>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={close}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : edit ? "Save changes" : "Create subject"}</button></div>
      </form></div>}

      {rosterSubject && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && setRosterSubject(null)}><div className="modal modal-wide roster-modal">
        <div className="modal-header"><div><span className="modal-eyebrow">Subject roster</span><h2>{rosterSubject.name}</h2><p>Add or remove multiple students in one step. Students from {rosterSubject.year_level} can be selected automatically.</p></div><button type="button" className="modal-close" onClick={() => setRosterSubject(null)} disabled={busy} aria-label="Close"><CloseIcon size={20} /></button></div>
        <div className="modal-body">{error && <div className="alert alert-error modal-alert">{error}</div>}<SubjectRoster subject={rosterSubject} students={students} selected={rosterSelection} setSelected={setRosterSelection} /></div>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setRosterSubject(null)} disabled={busy}>Cancel</button><button type="button" className="button button-primary" onClick={() => void saveRoster()} disabled={busy}>{busy ? "Saving…" : `Save ${rosterSelection.size} students`}</button></div>
      </div></div>}

      <ConfirmDialog
        open={Boolean(deleteSubject)}
        title="Delete subject?"
        description={deleteSubject ? `This permanently removes ${deleteSubject.name}, including its student enrollments, assessments and recorded scores. This cannot be undone.` : ""}
        confirmLabel="Delete subject"
        busy={busy}
        onCancel={() => setDeleteSubject(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
