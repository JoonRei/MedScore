"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ActivateIcon, CloseIcon, DeactivateIcon, DeleteIcon, EditIcon, KeyIcon, SearchIcon } from "@/components/icons";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
  is_active: boolean;
  enrollments: Array<{ subject_id: string }>;
};

type SubjectOption = { id: string; name: string; code: string | null; year_level: string };
type PeriodOption = { id: string; academic_year: string; term: string };
type CarryStudent = Omit<StudentRow, "enrollments">;
type PasteRow = { rowNumber: number; name: string; studentNumber: string; codeName: string; yearLevel: string; pin: string };

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
      <div className="field"><label>Student number</label><input className="input" name="studentNumber" defaultValue={student?.student_number || ""} autoComplete="off" /></div>
      <div className="field"><label>Preferred code name</label><input className="input code-input" name="codeName" defaultValue={student?.code_name || ""} minLength={4} maxLength={30} autoComplete="off" required /><span className="field-hint">4–30 characters using letters, numbers, hyphen or underscore.</span></div>
      {!student && <div className="field"><label>Initial PIN</label><input className="input" type="password" inputMode="numeric" name="pin" pattern="[0-9]{4,6}" maxLength={6} autoComplete="new-password" required /></div>}
      <div className="field"><label>Year level</label><CustomSelect name="yearLevel" defaultValue={student?.year_level || ""} options={YEAR_LEVELS.map((year) => ({ value: year, label: year }))} placeholder="Choose year level" /></div>
      <div className="field full">
        <div className="field-label-row"><label>Enroll in subjects</label><span>{subjects.length} available</span></div>
        <ChoiceGroup
          name="subjectIds"
          defaultValues={currentSubjects}
          options={subjects.map((subject) => ({ value: subject.id, label: subject.name, description: `${subject.code || "No code"} · ${subject.year_level}` }))}
          emptyText="Create an active subject first, then return here to enroll the student."
        />
      </div>
    </div>
  );
}

function parseSmartPaste(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.trim());
  if (!lines.length) return { rows: [] as PasteRow[], issues: [] as string[] };

  const firstColumns = lines[0].split("\t").map((value) => value.trim().toLowerCase());
  const hasHeader = firstColumns.some((value) => value.includes("name")) && firstColumns.some((value) => value.includes("pin"));
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows: PasteRow[] = [];
  const issues: string[] = [];

  dataLines.forEach((line, index) => {
    const rowNumber = index + (hasHeader ? 2 : 1);
    const columns = line.split("\t").map((value) => value.trim());
    if (columns.length < 5) {
      issues.push(`Row ${rowNumber}: expected 5 columns.`);
      return;
    }
    const [name, studentNumber, codeName, yearLevel, pin] = columns;
    if (!name || !studentNumber || !codeName || !yearLevel || !pin) {
      issues.push(`Row ${rowNumber}: one or more required values are blank.`);
      return;
    }
    rows.push({ rowNumber, name, studentNumber, codeName, yearLevel, pin });
  });

  return { rows, issues };
}

export function StudentsClient({
  students,
  subjects,
  periods,
  selectedPeriodId,
}: {
  students: StudentRow[];
  subjects: SubjectOption[];
  periods: PeriodOption[];
  selectedPeriodId: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showCarry, setShowCarry] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentRow | null>(null);
  const [resetStudent, setResetStudent] = useState<StudentRow | null>(null);
  const [deleteStudent, setDeleteStudent] = useState<StudentRow | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const sourcePeriods = useMemo(() => periods.filter((period) => period.id !== selectedPeriodId), [periods, selectedPeriodId]);
  const currentPeriod = periods.find((period) => period.id === selectedPeriodId) || null;
  const [sourcePeriodId, setSourcePeriodId] = useState(sourcePeriods[0]?.id || "");
  const [carryStudents, setCarryStudents] = useState<CarryStudent[]>([]);
  const [carrySelected, setCarrySelected] = useState<Set<string>>(new Set());
  const [carryQuery, setCarryQuery] = useState("");
  const [carryLoading, setCarryLoading] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteIssues, setPasteIssues] = useState<string[]>([]);
  const [pasteResult, setPasteResult] = useState("");
  const pastePreview = useMemo(() => parseSmartPaste(pasteText), [pasteText]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((student) => {
      const matchesQuery = !q || `${student.first_name} ${student.last_name} ${student.code_name} ${student.student_number || ""}`.toLowerCase().includes(q);
      const matchesYear = yearFilter === "all" || student.year_level === yearFilter;
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? student.is_active : !student.is_active);
      return matchesQuery && matchesYear && matchesStatus;
    });
  }, [query, students, yearFilter, statusFilter]);

  const visibleCarryStudents = useMemo(() => {
    const q = carryQuery.trim().toLowerCase();
    return carryStudents.filter((student) => !q || `${student.first_name} ${student.last_name} ${student.code_name} ${student.student_number || ""}`.toLowerCase().includes(q));
  }, [carryQuery, carryStudents]);

  async function toggleActive(student: StudentRow) {
    setWorking(true); setNotice(""); setError("");
    const response = await fetch(`/api/admin/students/${student.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !student.is_active }) });
    setWorking(false);
    if (!response.ok) { const body = await response.json().catch(() => ({})); setError(body.error || "Unable to update access."); return; }
    setNotice(student.is_active ? "Student access deactivated." : "Student access restored.");
    router.refresh();
  }

  async function submitStudent(event: React.FormEvent<HTMLFormElement>, student?: StudentRow) {
    event.preventDefault(); setError(""); setNotice(""); setWorking(true);
    const form = new FormData(event.currentTarget);
    const payload = { firstName: form.get("firstName"), lastName: form.get("lastName"), studentNumber: form.get("studentNumber"), codeName: form.get("codeName"), pin: form.get("pin"), yearLevel: form.get("yearLevel"), subjectIds: form.getAll("subjectIds") };
    const response = await fetch(student ? `/api/admin/students/${student.id}` : "/api/admin/students", { method: student ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({})); setWorking(false);
    if (!response.ok) { setError(body.error || `Unable to ${student ? "update" : "create"} student.`); return; }
    setShowAdd(false); setEditStudent(null); setNotice(student ? "Student details updated." : "Student account created for the active semester."); router.refresh();
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

  async function confirmDelete() {
    if (!deleteStudent) return;
    setWorking(true); setError(""); setNotice("");
    const response = await fetch(`/api/admin/students/${deleteStudent.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setWorking(false);
    if (!response.ok) { setError(body.error || "Unable to delete student."); setDeleteStudent(null); return; }
    setNotice(`${deleteStudent.first_name} ${deleteStudent.last_name} was deleted.`);
    setDeleteStudent(null);
    router.refresh();
  }

  async function loadCarryStudents(periodId: string) {
    setSourcePeriodId(periodId); setCarrySelected(new Set()); setCarryQuery(""); setError("");
    if (!periodId) { setCarryStudents([]); return; }
    setCarryLoading(true);
    const response = await fetch(`/api/admin/students/carry-over?periodId=${encodeURIComponent(periodId)}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    setCarryLoading(false);
    if (!response.ok) { setError(body.error || "Unable to load students."); setCarryStudents([]); return; }
    setCarryStudents(body.students || []);
  }

  function openCarry() {
    setError(""); setNotice(""); setShowCarry(true);
    const initial = sourcePeriodId || sourcePeriods[0]?.id || "";
    if (initial) void loadCarryStudents(initial);
  }

  function toggleCarry(id: string) {
    setCarrySelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submitCarry() {
    if (!sourcePeriodId || !carrySelected.size) return;
    setWorking(true); setError(""); setNotice("");
    const response = await fetch("/api/admin/students/carry-over", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourcePeriodId, studentIds: [...carrySelected] }) });
    const body = await response.json().catch(() => ({})); setWorking(false);
    if (!response.ok) { setError(body.error || "Unable to add selected students."); return; }
    setShowCarry(false); setCarryStudents([]); setCarrySelected(new Set());
    setNotice(`${body.added || carrySelected.size} student${(body.added || carrySelected.size) === 1 ? "" : "s"} added to the active semester.`);
    router.refresh();
  }

  async function submitPaste() {
    const parsed = parseSmartPaste(pasteText);
    setPasteIssues(parsed.issues); setPasteResult("");
    if (!parsed.rows.length) return;
    setWorking(true); setError(""); setNotice("");
    const response = await fetch("/api/admin/students/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: parsed.rows }) });
    const body = await response.json().catch(() => ({})); setWorking(false);
    if (!response.ok) { setError(body.error || "Unable to import students."); return; }
    const serverIssues = (body.issues || []).map((issue: any) => `Row ${issue.row}: ${issue.message}`);
    const combinedIssues = [...parsed.issues, ...serverIssues];
    if (combinedIssues.length) {
      setPasteIssues(combinedIssues);
      setPasteResult(`${body.created || 0} created · ${body.carried || 0} added from existing accounts · ${body.alreadyIncluded || 0} already included.`);
      router.refresh();
      return;
    }
    setShowPaste(false); setPasteText(""); setPasteIssues([]); setPasteResult("");
    setNotice(`${body.created || 0} created · ${body.carried || 0} added from existing accounts${body.alreadyIncluded ? ` · ${body.alreadyIncluded} already included` : ""}.`);
    router.refresh();
  }

  function closeModals() {
    setShowAdd(false); setShowCarry(false); setShowPaste(false); setEditStudent(null); setResetStudent(null); setError(""); setPasteIssues([]); setPasteResult("");
  }

  return (
    <>
      {notice && <div className="alert alert-success page-feedback">{notice}<button type="button" onClick={() => setNotice("")}>Dismiss</button></div>}
      {error && !showAdd && !showCarry && !showPaste && !editStudent && !resetStudent && !deleteStudent && <div className="alert alert-error page-feedback">{error}<button type="button" onClick={() => setError("")}>Dismiss</button></div>}

      <div className="panel data-panel">
        <div className="panel-header panel-header-stack-mobile">
          <div><h2>Student accounts</h2><p>Manage students included in the active semester and their subject enrollment.</p></div>
          <div className="student-header-actions">
            <button className="button button-secondary" type="button" disabled={!sourcePeriods.length} onClick={openCarry}>Copy</button>
            <button className="button button-secondary" type="button" onClick={() => { setError(""); setPasteIssues([]); setPasteResult(""); setShowPaste(true); }}>Smart paste</button>
            <button className="button button-primary" type="button" onClick={() => { setError(""); setShowAdd(true); }}>Add student</button>
          </div>
        </div>

        <div className="toolbar">
          <div className="search-box toolbar-search"><SearchIcon size={17}/><input className="input" placeholder="Search name, code or student number" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="toolbar-filters"><CustomSelect value={yearFilter} onChange={setYearFilter} options={yearOptions} /><CustomSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} /></div>
          <div className="toolbar-count"><strong>{filtered.length}</strong><span>of {students.length} students</span></div>
        </div>

        <div className="table-wrap responsive-table-wrap">
          <table className="responsive-table">
            <thead><tr><th>Student</th><th>Code Name</th><th>Year Level</th><th>Subjects</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.id}>
                  <td data-label="Student"><div className="student-cell"><span className="table-avatar">{student.first_name.slice(0,1)}{student.last_name.slice(0,1)}</span><div className="cell-title"><strong>{student.last_name}, {student.first_name}</strong><small>{student.student_number || "No student number"}</small></div></div></td>
                  <td data-label="Code Name"><span className="code-badge">{student.code_name}</span></td>
                  <td data-label="Year Level"><strong className="cell-regular">{student.year_level}</strong></td>
                  <td data-label="Subjects"><span className="count-pill">{student.enrollments?.length || 0}</span></td>
                  <td data-label="Status"><span className={`status-dot ${student.is_active ? "active" : "inactive"}`}><i />{student.is_active ? "Active" : "Inactive"}</span></td>
                  <td data-label="Actions"><ActionMenu items={[
                    { label: "Edit student", icon: EditIcon, onClick: () => { setError(""); setEditStudent(student); } },
                    { label: "Reset PIN", icon: KeyIcon, onClick: () => { setError(""); setResetStudent(student); } },
                    { label: student.is_active ? "Deactivate access" : "Activate access", icon: student.is_active ? DeactivateIcon : ActivateIcon, tone: student.is_active ? "danger" : "accent", disabled: working, onClick: () => void toggleActive(student) },
                    { label: "Delete student", icon: DeleteIcon, tone: "danger", disabled: working, onClick: () => setDeleteStudent(student) },
                  ]} /></td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={6}><div className="table-empty"><strong>No students in this semester</strong><span>Add a new student, copy selected students from another semester, or use Smart Paste.</span></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeModals()}>
          <form className="modal modal-wide" onSubmit={(event) => submitStudent(event)}>
            <div className="modal-header"><div><span className="modal-eyebrow">Student access</span><h2>Add student</h2><p>Create an account for the active semester and assign subjects.</p></div><button className="modal-close" type="button" onClick={closeModals} aria-label="Close"><CloseIcon size={20} /></button></div>
            <div className="modal-body">{error && <div className="alert alert-error modal-alert">{error}</div>}<StudentFormFields subjects={subjects} /></div>
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={closeModals}>Cancel</button><button className="button button-primary" disabled={working}>{working ? "Creating…" : "Create student"}</button></div>
          </form>
        </div>
      )}

      {showCarry && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeModals()}>
          <div className="modal modal-wide carry-students-modal">
            <div className="modal-header"><div><span className="modal-eyebrow">Semester students</span><h2>Copy from previous semester</h2><p>Select only the students continuing into {currentPeriod ? `${currentPeriod.academic_year} · ${currentPeriod.term}` : "the active semester"}.</p></div><button className="modal-close" type="button" onClick={closeModals} aria-label="Close"><CloseIcon size={20} /></button></div>
            <div className="modal-body">
              {error && <div className="alert alert-error modal-alert">{error}</div>}
              <div className="carry-toolbar">
                <div className="field"><label>From semester</label><CustomSelect value={sourcePeriodId} onChange={(value) => void loadCarryStudents(value)} options={sourcePeriods.map((period) => ({ value: period.id, label: `${period.academic_year} · ${period.term}` }))} /></div>
                <div className="search-box carry-search"><SearchIcon size={17}/><input className="input" placeholder="Search students" value={carryQuery} onChange={(event) => setCarryQuery(event.target.value)} /></div>
              </div>
              <div className="carry-selection-bar"><span><strong>{carrySelected.size}</strong> selected</span><div><button type="button" className="button button-quiet button-sm" onClick={() => setCarrySelected(new Set(visibleCarryStudents.map((student) => student.id)))} disabled={!visibleCarryStudents.length}>Select all</button><button type="button" className="button button-quiet button-sm" onClick={() => setCarrySelected(new Set())} disabled={!carrySelected.size}>Clear</button></div></div>
              {carryLoading ? <div className="compact-loading"><span className="semester-spinner"/><strong>Loading students…</strong></div> : (
                <div className="carry-student-list">
                  {visibleCarryStudents.map((student) => {
                    const selected = carrySelected.has(student.id);
                    return <button type="button" key={student.id} className={`carry-student-row ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => toggleCarry(student.id)}>
                      <div className="carry-student-main"><strong>{student.last_name}, {student.first_name}</strong><span>{student.student_number || "No student number"} · {student.year_level}</span></div>
                      <div className="carry-student-code"><span>{student.code_name}</span><small>{selected ? "Selected" : "Select"}</small></div>
                    </button>;
                  })}
                  {!visibleCarryStudents.length && <div className="table-empty"><strong>No students available</strong><span>Everyone from this semester may already be included, or no student matches your search.</span></div>}
                </div>
              )}
            </div>
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={closeModals}>Cancel</button><button type="button" className="button button-primary" disabled={working || !carrySelected.size} onClick={() => void submitCarry()}>{working ? "Adding…" : `Add selected${carrySelected.size ? ` (${carrySelected.size})` : ""}`}</button></div>
          </div>
        </div>
      )}

      {showPaste && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeModals()}>
          <div className="modal modal-wide smart-paste-modal">
            <div className="modal-header"><div><span className="modal-eyebrow">Bulk student entry</span><h2>Smart paste</h2><p>Paste five columns directly from your sheet.</p></div><button className="modal-close" type="button" onClick={closeModals} aria-label="Close"><CloseIcon size={20} /></button></div>
            <div className="modal-body">
              {error && <div className="alert alert-error modal-alert">{error}</div>}
              <div className="paste-column-guide"><span>Name</span><span>ID number</span><span>Preferred code</span><span>Year level</span><span>Initial PIN</span></div>
              <textarea className="input smart-paste-area" value={pasteText} onChange={(event) => { setPasteText(event.target.value); setPasteIssues([]); setPasteResult(""); }} rows={9} autoComplete="off" spellCheck={false} />
              <div className="paste-summary"><span><strong>{pastePreview.rows.length}</strong> ready</span>{pastePreview.issues.length > 0 && <span className="paste-warning"><strong>{pastePreview.issues.length}</strong> need attention</span>}</div>
              {pasteResult && <div className="paste-result">{pasteResult}</div>}
              {pastePreview.rows.length > 0 && <div className="paste-preview-list">{pastePreview.rows.slice(0, 6).map((row) => <div className="paste-preview-row" key={`${row.rowNumber}-${row.studentNumber}`}><div><strong>{row.name}</strong><small>{row.studentNumber}</small></div><span>{row.codeName}</span><span>{row.yearLevel}</span></div>)}{pastePreview.rows.length > 6 && <div className="paste-preview-more">+ {pastePreview.rows.length - 6} more rows</div>}</div>}
              {(pasteIssues.length > 0 || pastePreview.issues.length > 0) && <div className="paste-issues">{[...new Set([...pastePreview.issues, ...pasteIssues])].slice(0, 8).map((issue) => <span key={issue}>{issue}</span>)}</div>}
            </div>
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={closeModals}>Cancel</button><button type="button" className="button button-primary" disabled={working || !pastePreview.rows.length} onClick={() => void submitPaste()}>{working ? "Importing…" : `Import ${pastePreview.rows.length || ""} student${pastePreview.rows.length === 1 ? "" : "s"}`}</button></div>
          </div>
        </div>
      )}

      {editStudent && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeModals()}>
          <form className="modal modal-wide" onSubmit={(event) => submitStudent(event, editStudent)}>
            <div className="modal-header"><div><span className="modal-eyebrow">Student profile</span><h2>Edit student</h2><p>Update identity details and current subject enrollment.</p></div><button className="modal-close" type="button" onClick={closeModals} aria-label="Close"><CloseIcon size={20} /></button></div>
            <div className="modal-body">{error && <div className="alert alert-error modal-alert">{error}</div>}<StudentFormFields key={editStudent.id} student={editStudent} subjects={subjects} /></div>
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={closeModals}>Cancel</button><button className="button button-primary" disabled={working}>{working ? "Saving…" : "Save changes"}</button></div>
          </form>
        </div>
      )}

      {resetStudent && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeModals()}>
          <form className="modal modal-compact" onSubmit={resetPin}>
            <div className="modal-header"><div><span className="modal-eyebrow">Security</span><h2>Reset PIN</h2><p>Set a new PIN for <strong>{resetStudent.code_name}</strong>. Existing sessions will be signed out.</p></div><button className="modal-close" type="button" onClick={closeModals} aria-label="Close"><CloseIcon size={20} /></button></div>
            <div className="modal-body">{error && <div className="alert alert-error modal-alert">{error}</div>}<div className="field"><label>New PIN</label><input className="input pin-input" name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} autoFocus autoComplete="new-password" required /><span className="field-hint">Use 4–6 digits.</span></div></div>
            <div className="modal-actions"><button type="button" className="button button-secondary" onClick={closeModals}>Cancel</button><button className="button button-primary" disabled={working}>{working ? "Saving…" : "Reset PIN"}</button></div>
          </form>
        </div>
      )}

      <ConfirmDialog open={Boolean(deleteStudent)} title="Delete student?" description={deleteStudent ? `This permanently removes ${deleteStudent.first_name} ${deleteStudent.last_name}, including every semester enrollment, recorded score and active session. This cannot be undone.` : ""} confirmLabel="Delete student" busy={working} onCancel={() => setDeleteStudent(null)} onConfirm={() => void confirmDelete()} />
    </>
  );
}
