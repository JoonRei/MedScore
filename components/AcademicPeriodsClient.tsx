"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TERMS } from "@/lib/constants";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Period = { id: string; academic_year: string; term: string; is_active: boolean };

export function AcademicPeriodsClient({ periods }: { periods: Period[] }) {
  const router = useRouter();
  const [academicYear, setAcademicYear] = useState("");
  const [term, setTerm] = useState("1st Semester");
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removePeriod, setRemovePeriod] = useState<Period | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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

  async function makeCurrent(period: Period) {
    if (period.is_active) return;
    setBusyId(period.id); setError(""); setNotice("");
    const response = await fetch(`/api/admin/academic-periods/${period.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: true }),
    });
    const body = await response.json().catch(() => ({}));
    setBusyId(null);
    if (!response.ok) { setError(body.error || "Unable to change the current period."); return; }
    setNotice(`${period.academic_year} · ${period.term} is now current.`);
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

  return <section className="panel academic-period-panel">
    <div className="panel-header"><div><h2>Academic year & semester</h2><p>Set the current period used as the default when creating subjects.</p></div></div>
    {(notice || error) && <div className={`alert ${error ? "alert-error" : "alert-success"}`}>{error || notice}</div>}
    <form className="academic-period-create" onSubmit={addPeriod}>
      <div className="field"><label>Academic year</label><input className="input" value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} placeholder="2026-2027" autoComplete="off" required /></div>
      <div className="field"><label>Semester</label><CustomSelect value={term} onChange={setTerm} options={TERMS.map((item) => ({ value: item, label: item }))} /></div>
      <button className="button button-primary" disabled={busy}>{busy ? "Adding…" : "Add period"}</button>
    </form>
    <div className="academic-period-list">
      {periods.map((period) => <div className={`academic-period-row ${period.is_active ? "is-current" : ""}`} key={period.id}>
        <div><strong>{period.academic_year}</strong><span>{period.term}</span></div>
        <div className="academic-period-actions">
          {period.is_active ? <span className="status-dot active"><i />Current</span> : <button type="button" className="button button-secondary button-sm" disabled={busyId === period.id} onClick={() => void makeCurrent(period)}>{busyId === period.id ? "Updating…" : "Set current"}</button>}
          {!period.is_active && <button type="button" className="button button-quiet button-sm" disabled={busyId === period.id} onClick={() => setRemovePeriod(period)}>Remove</button>}
        </div>
      </div>)}
      {!periods.length && <div className="table-empty"><strong>No academic periods yet</strong><span>Add the current academic year and semester first.</span></div>}
    </div>
    <ConfirmDialog open={Boolean(removePeriod)} title="Remove academic period?" description={removePeriod ? `${removePeriod.academic_year} · ${removePeriod.term} can be removed only when no subject uses it.` : ""} confirmLabel="Remove period" busyLabel="Removing…" busy={Boolean(removePeriod && busyId === removePeriod.id)} onCancel={() => !busyId && setRemovePeriod(null)} onConfirm={() => void confirmRemove()} />
  </section>;
}
