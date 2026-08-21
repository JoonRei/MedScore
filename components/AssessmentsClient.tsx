"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveIcon, CloseIcon, DeleteIcon, EditIcon, PublishIcon, RestoreIcon, ScoresIcon, SearchIcon, UnpublishIcon } from "@/components/icons";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { ASSESSMENT_TYPES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { CustomDatePicker } from "@/components/ui/CustomDatePicker";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ToastNotice } from "@/components/ui/ToastNotice";

type SubjectOption = { id: string; name: string };
type AssessmentRow = {
  id: string; title: string; assessment_type: string; assessment_date: string; total_score: number; passing_score: number | null; doctor_name?: string | null; status: string;
  subjects?: any; scores?: Array<{ student_id?: string; result_status?: string }>;
};

const statusOptions = [
  { value: "all", label: "All statuses" }, { value: "draft", label: "Draft" }, { value: "published", label: "Released" }, { value: "archived", label: "Archived" },
];

function AssessmentFields({ assessment, subjects }: { assessment?: AssessmentRow; subjects: SubjectOption[] }) {
  const subject = Array.isArray(assessment?.subjects) ? assessment?.subjects[0] : assessment?.subjects;
  const defaultSubjectId = assessment ? (assessment as any).subject_id || subjects.find((item) => item.name === subject?.name)?.id || "" : "";
  return <div className="form-grid">
    <div className="field full"><label>Subject</label><CustomSelect name="subjectId" defaultValue={defaultSubjectId} options={subjects.map((item) => ({ value: item.id, label: item.name }))} placeholder="Choose subject" searchable /></div>
    <div className="field full"><label>Assessment title</label><input className="input" name="title" defaultValue={assessment?.title || ""} placeholder="e.g. Long Exam 1" autoComplete="off" required /></div>
    <div className="field"><label>Assessment type</label><CustomSelect name="assessmentType" defaultValue={assessment?.assessment_type || "Quiz"} options={ASSESSMENT_TYPES.map((type) => ({ value: type, label: type }))} placeholder="Choose type" searchable /></div>
    <div className="field"><label>Date</label><CustomDatePicker name="date" defaultValue={assessment?.assessment_date || ""} /></div>
    <div className="field full"><label>Doctor <span className="optional-label">Optional</span></label><input className="input" name="doctorName" defaultValue={assessment?.doctor_name || ""} autoComplete="off" /></div>
    <div className="field"><label>Total score</label><input className="input numeric-input" type="number" min="0.01" step="0.01" name="totalScore" defaultValue={assessment?.total_score ?? ""} placeholder="0" required /></div>
    <div className="field"><label>Passing score</label><input className="input numeric-input" type="number" min="0" step="0.01" name="passingScore" defaultValue={assessment?.passing_score ?? ""} placeholder="Optional" /></div>
  </div>;
}

export function AssessmentsClient({ assessments, subjects }: { assessments: AssessmentRow[]; subjects: SubjectOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<AssessmentRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyForm, setBusyForm] = useState(false);
  const [deleteAssessment, setDeleteAssessment] = useState<AssessmentRow | null>(null);
  const [releaseAssessment, setReleaseAssessment] = useState<AssessmentRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");

  const typeOptions = useMemo(() => [{ value: "all", label: "All assessment types" }, ...ASSESSMENT_TYPES.map((type) => ({ value: type, label: type }))], []);
  const subjectOptions = useMemo(() => [{ value: "all", label: "All subjects" }, ...subjects.map((subject) => ({ value: subject.id, label: subject.name }))], [subjects]);
  const filtered = useMemo(() => assessments.filter((assessment) => {
    const subject = Array.isArray(assessment.subjects) ? assessment.subjects[0] : assessment.subjects;
    const q = query.trim().toLowerCase();
    return (!q || `${assessment.title} ${assessment.assessment_type} ${subject?.name || ""} ${assessment.doctor_name || ""}`.toLowerCase().includes(q)) && (statusFilter === "all" || assessment.status === statusFilter) && (typeFilter === "all" || assessment.assessment_type === typeFilter) && (subjectFilter === "all" || (assessment as any).subject_id === subjectFilter || subject?.id === subjectFilter);
  }), [assessments, query, statusFilter, typeFilter, subjectFilter]);

  async function submit(event: React.FormEvent<HTMLFormElement>, assessment?: AssessmentRow) {
    event.preventDefault(); setBusyForm(true); setError(""); setNotice("");
    const form = new FormData(event.currentTarget);
    const payload = { subjectId: form.get("subjectId"), title: form.get("title"), assessmentType: form.get("assessmentType"), date: form.get("date"), totalScore: form.get("totalScore"), passingScore: form.get("passingScore"), doctorName: form.get("doctorName") };
    const response = await fetch(assessment ? `/api/admin/assessments/${assessment.id}` : "/api/admin/assessments", { method: assessment ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json().catch(() => ({})); setBusyForm(false);
    if (!response.ok) { setError(body.error || `Unable to ${assessment ? "update" : "create"} assessment.`); return; }
    setOpen(false); setEdit(null); setNotice(assessment ? "Assessment updated." : "Assessment created as Draft."); router.refresh();
  }

  async function changeStatus(assessment: AssessmentRow, next: string) {
    setBusyId(assessment.id); setError(""); setNotice("");
    const response = await fetch(`/api/admin/assessments/${assessment.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }) });
    const body = await response.json().catch(() => ({})); setBusyId(null);
    if (!response.ok) { setError(body.error || "Unable to update assessment."); return; }
    if (next === "published") setReleaseAssessment(null);
    setNotice(next === "published" ? "Scores released to students." : next === "archived" ? "Assessment archived." : "Assessment returned to Draft."); router.refresh();
  }

  async function confirmDelete() {
    if (!deleteAssessment) return;
    setDeleting(true); setError(""); setNotice("");
    const response = await fetch(`/api/admin/assessments/${deleteAssessment.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setDeleting(false);
    if (!response.ok) { setDeleteAssessment(null); setError(body.error || "Unable to delete assessment."); return; }
    const title = deleteAssessment.title;
    setDeleteAssessment(null);
    setNotice(`${title} was deleted.`);
    router.refresh();
  }

  function close() { setOpen(false); setEdit(null); setError(""); }

  return <>
    {notice && <ToastNotice message={notice} tone="success" onDismiss={() => setNotice("")} />}
    {error && !open && !edit && <ToastNotice message={error} tone="error" onDismiss={() => setError("")} />}
    <div className="panel data-panel">
      <div className="panel-header panel-header-stack-mobile"><div><h2>Assessment workspace</h2><p>Encode in Draft, review scores, then release when ready.</p></div><button className="button button-primary" onClick={() => { setError(""); setOpen(true); }}>New assessment</button></div>
      <div className="toolbar">
        <div className="search-box toolbar-search"><SearchIcon size={17}/><input className="input" placeholder="Search assessment or subject" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <div className="toolbar-filters"><CustomSelect value={subjectFilter} onChange={setSubjectFilter} options={subjectOptions} searchable /><CustomSelect value={typeFilter} onChange={setTypeFilter} options={typeOptions} searchable /><CustomSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} /></div>
        <div className="toolbar-count"><strong>{filtered.length}</strong><span>of {assessments.length} assessments</span></div>
      </div>
      <div className="table-wrap responsive-table-wrap"><table className="responsive-table"><thead><tr><th>Assessment</th><th>Subject</th><th>Date</th><th>Scores</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {filtered.map((assessment) => { const subject = Array.isArray(assessment.subjects) ? assessment.subjects[0] : assessment.subjects; const count = assessment.scores?.length ?? 0; return <tr key={assessment.id}>
          <td data-label="Assessment"><div className="cell-title"><strong>{assessment.title}</strong><small>{assessment.assessment_type} · {assessment.total_score} pts{assessment.passing_score != null ? ` · Pass ${assessment.passing_score}` : ""}{assessment.doctor_name ? ` · ${assessment.doctor_name}` : ""}</small></div></td>
          <td data-label="Subject">{subject?.name || "—"}</td><td data-label="Date">{formatDate(assessment.assessment_date)}</td><td data-label="Scores"><span className="count-pill">{count}</span></td>
          <td data-label="Status"><span className={`status-dot ${assessment.status === "published" ? "active" : assessment.status === "archived" ? "inactive" : "draft"}`}><i />{assessment.status === "published" ? "Released" : assessment.status.charAt(0).toUpperCase() + assessment.status.slice(1)}</span></td>
          <td data-label="Actions"><ActionMenu items={[
            { label: "Enter scores", icon: ScoresIcon, href: `/admin/assessments/${assessment.id}/scores` },
            ...(assessment.status !== "archived" ? [{ label: "Edit assessment", icon: EditIcon, onClick: () => { setError(""); setEdit(assessment); } }] : []),
            assessment.status === "published"
              ? { label: "Return to draft", icon: UnpublishIcon, onClick: () => void changeStatus(assessment, "draft"), disabled: busyId === assessment.id }
              : assessment.status === "archived"
                ? { label: "Restore assessment", icon: RestoreIcon, tone: "accent" as const, onClick: () => void changeStatus(assessment, "draft"), disabled: busyId === assessment.id }
                : { label: "Release scores", icon: PublishIcon, tone: "accent" as const, onClick: () => setReleaseAssessment(assessment), disabled: busyId === assessment.id },
            ...(assessment.status !== "archived" ? [{ label: "Archive assessment", icon: ArchiveIcon, tone: "danger" as const, onClick: () => void changeStatus(assessment, "archived"), disabled: busyId === assessment.id }] : []),
            { label: "Delete assessment", icon: DeleteIcon, tone: "danger" as const, onClick: () => setDeleteAssessment(assessment), disabled: busyId === assessment.id },
          ]} /></td>
        </tr>; })}
        {!filtered.length && <tr><td colSpan={6}><div className="table-empty"><strong>No assessments found</strong><span>Try another search or filter.</span></div></td></tr>}
      </tbody></table></div>
    </div>

    {releaseAssessment && (() => {
      const subject = Array.isArray(releaseAssessment.subjects) ? releaseAssessment.subjects[0] : releaseAssessment.subjects;
      const enrolledIds = new Set<string>((subject?.enrollments || []).map((item: any) => item.student_id));
      const enrolled = enrolledIds.size;
      const scored = (releaseAssessment.scores || []).filter((item) => enrolledIds.has(String(item.student_id || "")) && item.result_status === "scored").length;
      const absent = (releaseAssessment.scores || []).filter((item) => enrolledIds.has(String(item.student_id || "")) && item.result_status === "absent").length;
      const remaining = Math.max(enrolled - scored - absent, 0);
      return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && busyId !== releaseAssessment.id && setReleaseAssessment(null)}>
        <div className="modal modal-compact release-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="release-confirm-title">
          <div className="modal-header"><div><span className="modal-eyebrow">Release confirmation</span><h2 id="release-confirm-title">Release {releaseAssessment.title}?</h2><p>Review the score-entry summary before students can see this assessment.</p></div><button type="button" className="modal-close" onClick={() => setReleaseAssessment(null)} disabled={busyId === releaseAssessment.id} aria-label="Close"><CloseIcon size={20} /></button></div>
          <div className="modal-body">
            <div className="release-summary-grid">
              <div><span>Enrolled</span><strong>{enrolled}</strong></div>
              <div><span>Scored</span><strong>{scored}</strong></div>
              <div><span>Did not take</span><strong>{absent}</strong></div>
              <div className={remaining ? "has-warning" : ""}><span>Not entered</span><strong>{remaining}</strong></div>
            </div>
            {remaining > 0 ? <div className="release-warning"><strong>{remaining} student{remaining === 1 ? "" : "s"} still {remaining === 1 ? "has" : "have"} no entry.</strong><span>You can still release, but those students will have no result until scores are entered and saved.</span></div> : <div className="release-ready"><strong>All enrolled students have an entry.</strong><span>The assessment is ready to release.</span></div>}
          </div>
          <div className="modal-actions"><button type="button" className="button button-secondary" onClick={() => setReleaseAssessment(null)} disabled={busyId === releaseAssessment.id}>Cancel</button><button type="button" className="button button-primary" onClick={() => void changeStatus(releaseAssessment, "published")} disabled={busyId === releaseAssessment.id}>{busyId === releaseAssessment.id ? "Releasing…" : "Release scores"}</button></div>
        </div>
      </div>;
    })()}

    <ConfirmDialog
      open={Boolean(deleteAssessment)}
      title={deleteAssessment ? `Delete ${deleteAssessment.title}?` : "Delete assessment?"}
      description={deleteAssessment ? `This permanently removes ${deleteAssessment.title} and every recorded score attached to it. This action cannot be undone.` : ""}
      confirmLabel="Delete assessment"
      busyLabel="Deleting…"
      busy={deleting}
      onCancel={() => !deleting && setDeleteAssessment(null)}
      onConfirm={() => void confirmDelete()}
    />

    {(open || edit) && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="modal" onSubmit={(event) => submit(event, edit || undefined)}>
      <div className="modal-header"><div><span className="modal-eyebrow">Assessment</span><h2>{edit ? "Edit assessment" : "New assessment"}</h2><p>{edit ? "Update assessment details without removing recorded scores." : "New assessments start as Draft and remain unavailable to students until you release the scores."}</p></div><button type="button" className="modal-close" onClick={close} aria-label="Close"><CloseIcon size={20} /></button></div>
      <div className="modal-body">
        {error && <div className="alert alert-error modal-alert">{error}</div>}
        <AssessmentFields key={edit?.id || "new"} assessment={edit || undefined} subjects={subjects} />
      </div>
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={close}>Cancel</button><button className="button button-primary" disabled={busyForm}>{busyForm ? "Saving…" : edit ? "Save changes" : "Create assessment"}</button></div>
    </form></div>}
  </>;
}
