"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveIcon, CloseIcon, EditIcon, RestoreIcon, SearchIcon } from "@/components/icons";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { TERMS, YEAR_LEVELS } from "@/lib/constants";
import { CustomSelect } from "@/components/ui/CustomSelect";

const yearOptions = [{ value: "all", label: "All year levels" }, ...YEAR_LEVELS.map((year) => ({ value: year, label: year }))];
const statusOptions = [
  { value: "all", label: "All subjects" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

type SubjectRow = {
  id: string;
  name: string;
  code: string | null;
  year_level: string;
  term: string;
  academic_year: string;
  is_archived: boolean;
};

function SubjectFields({ subject }: { subject?: SubjectRow }) {
  return (
    <div className="form-grid">
      <div className="field full"><label>Subject name</label><input className="input" name="name" defaultValue={subject?.name || ""} placeholder="e.g. Human Anatomy" autoComplete="off" required /></div>
      <div className="field"><label>Subject code</label><input className="input code-input" name="code" defaultValue={subject?.code || ""} placeholder="Optional" autoComplete="off" /></div>
      <div className="field"><label>Year level</label><CustomSelect name="yearLevel" defaultValue={subject?.year_level || ""} options={YEAR_LEVELS.map((year) => ({ value: year, label: year }))} placeholder="Choose year level" /></div>
      <div className="field"><label>Term</label><CustomSelect name="term" defaultValue={subject?.term || ""} options={TERMS.map((term) => ({ value: term, label: term }))} placeholder="Choose term" /></div>
      <div className="field"><label>Academic year</label><input className="input" name="academicYear" defaultValue={subject?.academic_year || ""} placeholder="2026–2027" autoComplete="off" required /></div>
    </div>
  );
}

export function SubjectsClient({ subjects }: { subjects: SubjectRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<SubjectRow | null>(null);
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

  function close() { setOpen(false); setEdit(null); setError(""); }

  return (
    <>
      {notice && <div className="alert alert-success page-feedback">{notice}<button type="button" onClick={() => setNotice("")}>Dismiss</button></div>}
      {error && !open && !edit && <div className="alert alert-error page-feedback">{error}<button type="button" onClick={() => setError("")}>Dismiss</button></div>}
      <div className="panel data-panel">
        <div className="panel-header panel-header-stack-mobile"><div><h2>Subject catalog</h2><p>Organize the curriculum by year level, term and academic year.</p></div><button className="button button-primary" onClick={() => { setError(""); setOpen(true); }}>Add subject</button></div>
        <div className="toolbar">
          <div className="search-box toolbar-search"><SearchIcon size={17}/><input className="input" placeholder="Search subject, code or academic year" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="toolbar-filters"><CustomSelect value={year} onChange={setYear} options={yearOptions} /><CustomSelect value={status} onChange={setStatus} options={statusOptions} /></div>
          <div className="toolbar-count"><strong>{filtered.length}</strong><span>of {subjects.length} subjects</span></div>
        </div>
        <div className="table-wrap responsive-table-wrap"><table className="responsive-table"><thead><tr><th>Subject</th><th>Year Level</th><th>Term</th><th>Academic Year</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {filtered.map((subject) => <tr key={subject.id}>
            <td data-label="Subject"><div className="student-cell"><span className="subject-mini-mark">{(subject.code || subject.name).slice(0, 3).toUpperCase()}</span><div className="cell-title"><strong>{subject.name}</strong><small>{subject.code || "No subject code"}</small></div></div></td>
            <td data-label="Year Level">{subject.year_level}</td><td data-label="Term">{subject.term}</td><td data-label="Academic Year">{subject.academic_year}</td>
            <td data-label="Status"><span className={`status-dot ${subject.is_archived ? "inactive" : "active"}`}><i />{subject.is_archived ? "Archived" : "Active"}</span></td>
            <td data-label="Actions"><ActionMenu items={[
              { label: "Edit subject", icon: EditIcon, onClick: () => { setError(""); setEdit(subject); } },
              { label: subject.is_archived ? "Restore subject" : "Archive subject", icon: subject.is_archived ? RestoreIcon : ArchiveIcon, tone: subject.is_archived ? "accent" : "danger", disabled: busy, onClick: () => void archive(subject) },
            ]} /></td>
          </tr>)}
          {!filtered.length && <tr><td colSpan={6}><div className="table-empty"><strong>No subjects found</strong><span>Try another search or filter.</span></div></td></tr>}
        </tbody></table></div>
      </div>

      {(open || edit) && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="modal" onSubmit={(event) => submit(event, edit || undefined)}>
        <div className="modal-header"><div><span className="modal-eyebrow">Curriculum</span><h2>{edit ? "Edit subject" : "Add subject"}</h2><p>{edit ? "Update the subject details without losing existing scores." : "Create a subject for the current or upcoming academic term."}</p></div><button type="button" className="modal-close" onClick={close} aria-label="Close"><CloseIcon size={20} /></button></div>
        <div className="modal-body">
          {error && <div className="alert alert-error modal-alert">{error}</div>}
          <SubjectFields key={edit?.id || "new"} subject={edit || undefined} />
        </div>
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={close}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : edit ? "Save changes" : "Create subject"}</button></div>
      </form></div>}
    </>
  );
}
