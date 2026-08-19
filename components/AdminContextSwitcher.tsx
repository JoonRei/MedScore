"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomSelect } from "@/components/ui/CustomSelect";

type Workspace = { id: string; display_name: string; email: string; role: "owner" | "member" };
type Period = { id: string; academic_year: string; term: string; is_active: boolean };

export function AdminContextSwitcher({
  workspaces,
  workspaceId,
  periods,
  periodId,
  isOwner,
  mobile = false,
}: {
  workspaces: Workspace[];
  workspaceId: string;
  periods: Period[];
  periodId: string;
  isOwner: boolean;
  mobile?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function update(payload: { workspaceId?: string; periodId?: string }) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={mobile ? "admin-context admin-context-mobile" : "admin-context"}>
      {isOwner && workspaces.length > 1 && (
        <div className="admin-context-field">
          {!mobile && <span>Workspace</span>}
          <CustomSelect
            value={workspaceId}
            disabled={busy}
            className="admin-context-select"
            options={workspaces.map((workspace) => ({
              value: workspace.id,
              label: workspace.display_name,
              description: workspace.role === "owner" ? "Owner" : workspace.email,
            }))}
            onChange={(value) => void update({ workspaceId: value })}
          />
        </div>
      )}
      <div className="admin-context-field">
        {!mobile && <span>Semester</span>}
        <CustomSelect
          value={periodId}
          disabled={busy || !periods.length}
          className="admin-context-select"
          placeholder="No semester"
          options={periods.map((period) => ({
            value: period.id,
            label: `${period.academic_year} · ${period.term}`,
            description: period.is_active ? "Current" : undefined,
          }))}
          onChange={(value) => void update({ periodId: value })}
        />
      </div>
    </div>
  );
}
