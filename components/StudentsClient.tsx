"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActivateIcon, CloseIcon, DeactivateIcon, EditIcon, KeyIcon, SearchIcon } from "@/components/icons";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { YEAR_LEVELS } from "@/lib/constants";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { CustomSelect } from "@/components/ui/CustomSelect";

export type StudentRow = {
  id: string;
  first_name: string;
  last_name: string;
  student_number: string | null;
  code_name: string;
  year_level: string;
  section: string | null;
  is_active: boolean;
  enrollments: Array<{ subject_id: string }>;
};

type SubjectOption = { id: string; name: string; code: string | null; year_level: string };

const yearOptions = [{ value: "all", label: "All year levels" }, ...YEAR_LEVELS.map((year) => ({ value: year, label: year }))];
const statusOptions = [
  { value: "all", label: "All access" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function StudentFormFields({ student, subjects }: { student?: StudentRow; subjects: SubjectOption[] }) {
  const currentSubjects = student?.enrollments?.map((row) => row.subject_id) || [];
  return (
    <div className="form-grid">
      <div className="field"><label>First name</label><input className="input" name="firstName" defaultValue={student?.first_name || ""} autoComplete="off" required /></div>
      <div className="field"><label>Last name</label><input className="input" name="lastName" defaultValue={student?.last_name || ""} autoComplete="off" required /></div>
      <div className="field"><label>Student number</label><input className="input" name="studentNumber" defaultValue={student?.student_number || ""} placeholder="Optional" autoComplete="off" /></div>
      <div className="field"><label>Preferred code name</label><input className="input code-input" name="codeName" defaultValue={student?.code_name || ""} placeholder="NightHawk27" minLength={4} maxLength={30} autoComplete="off" required /><span className="field-hint">4–30 characters. Letters, numbers, hyphen and underscore only.</span></div>
      {!student && <div className="field"><label>Initial PIN</label><input className="input" type="password" inputMode="numeric" name="pin" pattern="[0-9]{4,6}" maxLength={6} placeholder="4–6 digits" autoComplete="new-password" required /></div>}
      <div className="field"><label>Year level</label><CustomSelect name="yearLevel" defaultValue={student?.year_level || ""} options={YEAR_LEVELS.map((year) => ({ value: year, label: year }))} placeholder="Choose year level" /></div>
      <div className={student ? "field full" : "field"}><label>Section</label><input className="input" name="section" defaultValue={student?.section || ""} placeholder="Optional" autoComplete="off" /></div>
      <div className="field full">
        <div className="field-label-row"><label>Enroll in subjects</label><span>{subjects.length} available</span></div>
        <ChoiceGroup
          name="subjectIds"
          defaultValues={currentSubjects}
          options={subjects.map((subject) => ({
            value: subject.id,
            label: subject.name,
            description: `${subject.code || "No code"} · ${subject.year_level}`,
          }))}
          emptyText="Create an active subject first, then return here to enroll the student."
        />
      </div>
    </div>
  );
}

export function StudentsClient({ students, subjects }: { students: StudentRow[]; subjects: SubjectOption[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentRow | null>(null);
  const [resetStudent, setResetStudent] = useState<StudentRow | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((student) => {
      const matchesQuery = !q || `${student.first_name} ${student.last_name} ${student.code_name} ${student.student_number || ""} ${student.section || ""}`.toLowerCase().includes(q);
      const matchesYear = yearFilter === "all" || student.year_level === yearFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? student.is_active : !student.is_active);
      return matchesQuery && matchesYear && matchesStatus;
    });
  }, [query, students, yearFilter, statusFilter]);

  async function toggleActive(student: StudentRow) {
    setWorking(true); setNotice(""); setError("");
    const response = await fetch(`/api/admin/students/${student.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !student.is_active }),
    });
    setWorking(false);
    if (!response.ok) { const body = await response.json().catch(() => ({})); setError(body.error || "Unable to update access."); return; }
    setNotice(student.is_active ? "Student access deactivated." : "Student access restored.");
    router.refresh();
  }

  async function submitStudent(event: React.FormEvent<HTMLFormElement>, student?: StudentRow) {
    event.preventDefault(); setError(""); setNotice(""); setWorking(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      firstName: form.get("firstName"), lastName: form.get("lastName"), studentNumber: form.get("studentNumber"),
      codeName: form.get("codeName"), pin: form.get("pin"), yearLevel: form.get("yearLevel"), section: form.get("section"), subjectIds: form.getAll("subjectIds"),
    };
    const response = await fetch(student ? `/api/admin/students/${student.id}` : "/api/admin/students", {
      method: student ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({})); setWorking(false);
    if (!response.ok) { setError(body.error || `Unable to ${student ? "update" : "create"} student.`); return; }
    setShowAdd(false); setEditStudent(null); setNotice(student ? "Student details updated." : "Student account created."); router.refresh();
  }

  async function resetPin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!resetStudent) return;
    setError(""); setNotice(""); setWorking(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/students/${resetStudent.id}/pin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: form.get("pin") }) });
    const body = await response.json().catch(() => ({})); setWorking(false);
    if (!response.ok) { setError(body.error || "Unable to reset PIN."); return; }
    setResetStudent(null); setNotice("PIN reset successfully. Existing student sessions were cleared."); router.refresh();
  }

  function closeModals() { setShowAdd(false); setEditStudent(null); setResetStudent(null); setError(""); }

  return (
    <>
      {notice && <div className="alert alert-success page-feedback">{notice}<button type="button" onClick={() => setNotice("")}>Dismiss</button></div>}
      {error && !showAdd && !editStudent && !resetStudent && <div className="alert alert-error page-feedback">{error}<button type="button" onClick={() => setError("")}>Dismiss</button></div>}

      <div className="panel data-panel">
        <div className="panel-header panel-header-stack-mobile">
          <div><h2>Student accounts</h2><p>Manage private access, enrollment and student identity from one place.</p></div>
          <button className="button button-primary" onClick={() => { setError(""); setShowAdd(true); }}>Add student</button>
        </div>

        <div className="toolbar">
          <div className="search-box toolbar-search"><SearchIcon size={17}/><input className="input" placeholder="Search name, code, number or section" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="toolbar-filters">
            <CustomSelect value={yearFilter} onChange={setYearFilter} options={yearOptions} />
            <CustomSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
          </div>
          <div className="toolbar-count"><strong>{filtered.length}</strong><span>of {students.length} students</span></div>
        </div>

        <div className="table-wrap responsive-table-wrap">
          <table className="responsive-table">
            <thead><tr><th>Student</th><th>Code Name</th><th>Year / Section</th><th>Subjects</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.id}>
                  <td data-label="Student"><div className="student-cell"><span className="table-avatar">{student.first_name.slice(0,1)}{student.last_name.slice(0,1)}</span><div className="cell-title"><strong>{student.last_name}, {student.first_name}</strong><small>{student.student_number || "No student number"}</small></div></div></td>
                  <td data-label="Code Name"><span className="code-badge">{student.code_name}</span></td>
                  <td data-label="Year / Section"><div className="cell-title"><strong className="cell-regular">{student.year_level}</strong><small>{student.section || "No section"}</small></div></td>
                  <td data-label="Subjects"><span className="count-pill">{student.enrollments?.length || 0}</span></td>
                  <td data-label="Status"><span className={`status-dot ${student.is_active ? "active" : "inactive"}`}><i />{student.is_active ? "Active" : "Inactive"}</span></td>
                  <td data-label="Actions"><ActionMenu items={[
                    { label: "Edit student", icon: EditIcon, onClick: () => { setError(""); setEditStudent(student); } },
                    { label: "Reset PIN", icon: KeyIcon, onClick: () => { setError(""); setResetStudent(student); } },
                    { label: student.is_active ? "Deactivate access" : "Activate access", icon: student.is_active ? DeactivateIcon : ActivateIcon, tone: student.is_active ? "danger" : "accent", disabled: working, onClick: () => void toggleActive(student) },
                  ]} /></td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={6}><div className="table-empty"><strong>No students found</strong><span>Try another search or filter.</span></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeModals()}>
          <form className="modal modal-wide" onSubmit={(event) => submitStudent(event)}>
            <div className="modal-header"><div><span className="modal-eyebrow">Student access</span><h2>Add student</h2><p>Create a private account and assign current subjects.</p></div><button className="modal-close" type="button" onClick={closeModals} aria-label="Close"><CloseIcon size={20} /></button></div>
            <div className="modal-body">
              {error && <div className="alert alert-error modal-alert">{error}</div>}
              <StudentFormFields subjects={subjects} />
            </div>
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={closeModals}>Cancel</button><button className="button button-primary" disabled={working}>{working ? "Creating…" : "Create student"}</button></div>
          </form>
        </div>
      )}

      {editStudent && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeModals()}>
          <form className="modal modal-wide" onSubmit={(event) => submitStudent(event, editStudent)}>
            <div className="modal-header"><div><span className="modal-eyebrow">Student profile</span><h2>Edit student</h2><p>Update identity details and current subject enrollment.</p></div><button className="modal-close" type="button" onClick={closeModals} aria-label="Close"><CloseIcon size={20} /></button></div>
            <div className="modal-body">
              {error && <div className="alert alert-error modal-alert">{error}</div>}
              <StudentFormFields key={editStudent.id} student={editStudent} subjects={subjects} />
            </div>
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={closeModals}>Cancel</button><button className="button button-primary" disabled={working}>{working ? "Saving…" : "Save changes"}</button></div>
          </form>
        </div>
      )}

      {resetStudent && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeModals()}>
          <form className="modal modal-compact" onSubmit={resetPin}>
            <div className="modal-header"><div><span className="modal-eyebrow">Security</span><h2>Reset PIN</h2><p>Set a new private PIN for <strong>{resetStudent.code_name}</strong>. Existing sessions will be signed out.</p></div><button className="modal-close" type="button" onClick={closeModals} aria-label="Close"><CloseIcon size={20} /></button></div>
            <div className="modal-body">
              {error && <div className="alert alert-error modal-alert">{error}</div>}
              <div className="field"><label>New PIN</label><input className="input pin-input" name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} placeholder="4–6 digits" autoFocus autoComplete="new-password" required /><span className="field-hint">The current PIN is never displayed and cannot be recovered.</span></div>
            </div>
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={closeModals}>Cancel</button><button className="button button-primary" disabled={working}>{working ? "Saving…" : "Reset PIN"}</button></div>
          </form>
        </div>
      )}
    </>
  );
}
