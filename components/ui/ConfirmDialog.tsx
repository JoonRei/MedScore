"use client";

import { CloseIcon } from "@/components/icons";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busyLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  busyLabel = "Deleting…",
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onCancel()}>
      <div className="modal modal-compact confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div className="modal-header">
          <div>
            <span className="modal-eyebrow danger-eyebrow">Permanent action</span>
            <h2 id="confirm-dialog-title">{title}</h2>
            <p>{description}</p>
          </div>
          <button type="button" className="modal-close" onClick={onCancel} disabled={busy} aria-label="Close">
            <CloseIcon size={20} />
          </button>
        </div>
        <div className="modal-actions">
          <button type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="button button-danger" onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
