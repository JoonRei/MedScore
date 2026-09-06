"use client";

import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { FilterHorizontalIcon } from "@hugeicons/core-free-icons";

type FilterOption = { value: string; label: string };

export function StudentFilterMenu({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const active = value !== "all";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={`student-filter-menu-v448${open ? " is-open" : ""}${active ? " has-filter" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="student-filter-button-v448"
        aria-label={label}
        title={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <HugeiconsIcon icon={FilterHorizontalIcon} size={21} strokeWidth={1.8} color="currentColor" aria-hidden="true" />
        {active && <span className="student-filter-active-dot-v448" aria-hidden="true" />}
      </button>

      {open && (
        <div className="student-filter-popover-v448" role="menu" aria-label={label}>
          <div className="student-filter-popover-title-v448">{label}</div>
          <div className="student-filter-options-v448">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={value === option.value}
                className={value === option.value ? "is-selected" : ""}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {value === option.value && <i aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
