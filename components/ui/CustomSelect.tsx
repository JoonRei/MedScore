"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useFloatingPopover } from "@/components/ui/useFloatingPopover";
import { cn } from "@/lib/utils";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

type Props = {
  name?: string;
  value?: string;
  defaultValue?: string;
  options: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
  className?: string;
};

export function CustomSelect({
  name,
  value,
  defaultValue = "",
  options,
  placeholder = "Select an option",
  searchable = false,
  disabled = false,
  onChange,
  className,
}: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedValue = controlled ? value! : internalValue;
  const selected = options.find((option) => option.value === selectedValue);
  const { triggerRef, popoverRef, style } = useFloatingPopover(open, { minWidth: 240, mobileSheet: true });

  useEffect(() => {
    if (!open) return;
    function handlePointer(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, popoverRef]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => `${option.label} ${option.description || ""}`.toLowerCase().includes(q));
  }, [options, query]);

  function choose(next: string) {
    if (!controlled) setInternalValue(next);
    onChange?.(next);
    setOpen(false);
    setQuery("");
  }

  const popover = open && typeof document !== "undefined" ? createPortal(
    <div ref={popoverRef} style={style} className="custom-select-popover" role="listbox" aria-labelledby={id}>
      <div className="popover-mobile-handle" />
      {searchable && (
        <div className="select-search">
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search options" />
        </div>
      )}
      <div className="custom-select-options">
        {filtered.map((option) => {
          const active = option.value === selectedValue;
          return (
            <button
              type="button"
              role="option"
              aria-selected={active}
              className={cn("custom-select-option", active && "selected")}
              disabled={option.disabled}
              key={option.value}
              onClick={() => choose(option.value)}
            >
              <span className="select-option-copy">
                <strong>{option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
            </button>
          );
        })}
        {!filtered.length && <div className="select-empty">No matching options</div>}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={rootRef} className={cn("custom-select", open && "is-open", disabled && "is-disabled", className)}>
      {name && <input type="hidden" name={name} value={selectedValue} />}
      <button
        ref={(node) => { triggerRef.current = node; }}
        id={id}
        type="button"
        className="custom-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={cn("custom-select-value", !selected && "placeholder")}>{selected?.label || placeholder}</span>
      </button>
      {popover}
    </div>
  );
}
