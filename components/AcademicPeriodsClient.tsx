"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TERMS } from "@/lib/constants";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Period = { id: string; academic_year: string; term: string; is_active: boolean };

export function AcademicPeriodsClient({ periods, selectedPeriodId }: { periods: Period[]; selectedPeriodId: string }) {
  const router = useRouter();
  const [academicYear, setAcademicYear] = useState("");
  const [term, setTerm] = useState("1st Semester");
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removePeriod, setRemovePeriod] = useState<Period | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function switchSemester(value: string) {
    if (!value || value === selectedPeriodId || switching) return;
    setSwitching(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/context", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ periodId: value }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error || "Unable to switch semester."); setSwitching(false); return; }
      window.location.reload();
    } catch {
      setError("Unable to switch semester.");
      setSwitching(false);
    }
  }

  async function addPeriod(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/admin/academic-periods", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ academicYear, term }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(body.error || "Unable to create academic period."); return; }
    setAcademicYear("");
    setNotice("Academic period added.");
    router.refresh();
  }

  async function confirmRemove() {
    if (!removePeriod) return;
    const period = removePeriod;
    setBusyId(period.id); setError(""); setNotice("");
    const response = await fetch(`/api/admin/academic-periods/${period.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setBusyId(null); setRemovePeriod(null);
    if (!response.ok) { setError(body.error || "Unable to remove academic period."); return; }
    setNotice("Academic period removed.");
    router.refresh();
  }

  return <section className="panel academic-period-panel settings-compact-panel">
    {switching && <div className="semester-switch-loading" role="status" aria-live="polite"><div className="semester-switch-loading-card"><span className="semester-spinner"/><strong>Switching semester</strong><small>Updating subjects, assessments and reports…</small></div></div>}
    <div className="settings-compact-head"><div><h2>Academic year & semester</h2><p>Choose the semester you are currently working on.</p></div></div>
    {(notice || error) && <div className={`alert ${error ? "alert-error" : "alert-success"}`}>{error || notice}</div>}

    <div className="semester-settings-switch">
      <div><strong>Active semester</strong><span>Students, subjects and assessment records follow the active semester.</span></div>
      <CustomSelect
        value={selectedPeriodId}
        disabled={switching || !periods.length}
        className="semester-settings-select"
        placeholder="Choose semester"
        options={periods.map((period) => ({ value: period.id, label: `${period.academic_year} · ${period.term}` }))}
        onChange={(value) => void switchSemester(value)}
      />
    </div>

    <div className="settings-divider" />
    <form className="academic-period-create compact-period-create" onSubmit={addPeriod}>
      <div className="field"><label>Academic year</label><input className="input" value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} placeholder="2026-2027" autoComplete="off" required /></div>
      <div className="field"><label>Semester</label><CustomSelect value={term} onChange={setTerm} options={TERMS.map((item) => ({ value: item, label: item }))} /></div>
      <button className="button button-primary" disabled={busy}>{busy ? "Adding…" : "Add semester"}</button>
    </form>

    <div className="academic-period-list compact-period-list">
      {periods.map((period) => <div className={`academic-period-row ${period.id === selectedPeriodId ? "is-current" : ""}`} key={period.id}>
        <div><strong>{period.academic_year}</strong><span>{period.term}</span></div>
        <div className="academic-period-actions">
          {period.id === selectedPeriodId ? <span className="status-dot active"><i />Active</span> : <button type="button" className="button button-quiet button-sm" disabled={busyId === period.id || switching} onClick={() => setRemovePeriod(period)}>Remove</button>}
        </div>
      </div>)}
      {!periods.length && <div className="table-empty"><strong>No academic periods yet</strong><span>Add your first academic year and semester.</span></div>}
    </div>
    <ConfirmDialog open={Boolean(removePeriod)} title="Remove academic period?" description={removePeriod ? `${removePeriod.academic_year} · ${removePeriod.term} can be removed only when no subject uses it.` : ""} confirmLabel="Remove period" busyLabel="Removing…" busy={Boolean(removePeriod && busyId === removePeriod.id)} onCancel={() => !busyId && setRemovePeriod(null)} onConfirm={() => void confirmRemove()} />
  </section>;
}
