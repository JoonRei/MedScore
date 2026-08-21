"use client";

import { useState } from "react";

export function ChangePinForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/student/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPin: form.get("currentPin"), newPin: form.get("newPin") }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    setOk(response.ok);
    setMsg(response.ok ? "PIN changed successfully." : body.error || "Unable to change PIN.");
    if (response.ok) event.currentTarget.reset();
  }

  return (
    <form className="change-pin-form-v419" onSubmit={submit}>
      {msg && <div className={`alert ${ok ? "alert-success" : "alert-error"}`}>{msg}</div>}
      <div className="change-pin-fields-v419">
        <div className="field">
          <label>Current PIN</label>
          <input className="input" name="currentPin" type="password" inputMode="numeric" pattern="[0-9]{4,6}" required />
        </div>
        <div className="field">
          <label>New PIN</label>
          <input className="input" name="newPin" type="password" inputMode="numeric" pattern="[0-9]{4,6}" required />
        </div>
      </div>
      <div className="change-pin-actions-v419">
        <button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Change PIN"}</button>
      </div>
    </form>
  );
}
