"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type UserRow = { id: string; display_name: string; email: string; role: "owner" | "member"; is_active: boolean };

export function AdminUsersClient({ users, ownerId }: { users: UserRow[]; ownerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [toggleUser, setToggleUser] = useState<UserRow | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function addUser(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error || "Unable to create user."); return; }
      setDisplayName(""); setEmail(""); setPassword(""); setOpen(false); setNotice("User added. They can sign in with the email and password you created.");
      router.refresh();
    } finally { setBusy(false); }
  }

  async function confirmToggle() {
    if (!toggleUser) return;
    const user = toggleUser;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.is_active }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error || "Unable to update user."); return; }
      setToggleUser(null); setNotice(user.is_active ? "User access disabled. Their data remains saved." : "User access enabled.");
      router.refresh();
    } finally { setBusy(false); }
  }

  return <section className="panel admin-users-panel">
    <div className="panel-header panel-header-stack-mobile">
      <div><h2>Users & workspaces</h2><p>Each user manages a separate set of students and subjects. The Owner can switch between workspaces.</p></div>
      <button className="button button-primary button-sm" type="button" onClick={() => setOpen((value) => !value)}>{open ? "Close" : "Add user"}</button>
    </div>
    {(notice || error) && <div className={`alert ${error ? "alert-error" : "alert-success"}`}>{error || notice}</div>}
    {open && <form className="admin-user-create" onSubmit={addUser}>
      <div className="field"><label>Name</label><input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="off" required /></div>
      <div className="field"><label>Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required /></div>
      <div className="field"><label>Temporary password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required /></div>
      <button className="button button-primary" disabled={busy}>{busy ? "Adding…" : "Create user"}</button>
    </form>}
    <div className="admin-user-list">
      {users.map((user) => <div className="admin-user-row" key={user.id}>
        <div className="admin-user-copy"><strong>{user.display_name}</strong><span>{user.email}</span></div>
        <div className="admin-user-meta"><span className={`badge ${user.is_active ? "badge-green" : "badge-gray"}`}>{user.role === "owner" ? "Owner" : user.is_active ? "Active" : "Disabled"}</span>{user.id !== ownerId && <button className="button button-quiet button-sm" type="button" onClick={() => setToggleUser(user)}>{user.is_active ? "Disable" : "Enable"}</button>}</div>
      </div>)}
    </div>
    <ConfirmDialog
      open={Boolean(toggleUser)}
      title={toggleUser?.is_active ? "Disable this user?" : "Enable this user?"}
      description={toggleUser?.is_active ? "They will no longer be able to open the Admin portal. Their students, subjects and scores stay saved." : "This user will be able to sign in and manage their workspace again."}
      confirmLabel={toggleUser?.is_active ? "Disable user" : "Enable user"}
      busyLabel="Updating…"
      busy={busy}
      onCancel={() => !busy && setToggleUser(null)}
      onConfirm={() => void confirmToggle()}
    />
  </section>;
}
