"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CalendarIcon, CloseIcon } from "@/components/icons";
import { useFloatingPopover } from "@/components/ui/useFloatingPopover";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fromISO(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

function formatDisplay(value: string) {
  const date = fromISO(value);
  return date ? new Intl.DateTimeFormat("en-PH", { month: "long", day: "numeric", year: "numeric" }).format(date) : "";
}

export function CustomDatePicker({
  name,
  value,
  defaultValue = "",
  placeholder = "Choose date",
  onChange,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const selectedValue = controlled ? value! : internalValue;
  const selectedDate = fromISO(selectedValue);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => selectedDate || new Date());
  const { triggerRef, popoverRef, style } = useFloatingPopover(open, { preferredWidth: 360, minWidth: 340, mobileSheet: true });

  useEffect(() => {
    if (!open) return;
    function outside(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open, popoverRef]);

  const days = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [view]);

  function commit(date: Date) {
    const next = toISO(date);
    if (!controlled) setInternalValue(next);
    onChange?.(next);
    setOpen(false);
  }

  function clear() {
    if (!controlled) setInternalValue("");
    onChange?.("");
    setOpen(false);
  }

  function changeMonth(offset: number) {
    setView(new Date(view.getFullYear(), view.getMonth() + offset, 1));
  }

  const calendar = open && typeof document !== "undefined" ? createPortal(
    <div ref={popoverRef} style={style} className="date-popover" role="dialog" aria-label="Choose assessment date">
      <div className="popover-mobile-handle" />
      <div className="date-head">
        <div>
          <span className="date-head-label">Select date</span>
          <strong>{new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(view)}</strong>
        </div>
        <button type="button" className="icon-button" onClick={() => setOpen(false)} aria-label="Close calendar"><CloseIcon size={19} /></button>
      </div>
      <div className="calendar-month-nav">
        <button type="button" className="calendar-nav" onClick={() => changeMonth(-1)} aria-label="Previous month"><ArrowLeftIcon size={18} /></button>
        <button type="button" className="calendar-today-button" onClick={() => setView(new Date())}>Current month</button>
        <button type="button" className="calendar-nav" onClick={() => changeMonth(1)} aria-label="Next month"><ArrowRightIcon size={18} /></button>
      </div>
      <div className="calendar-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day.slice(0, 2)}</span>)}</div>
      <div className="calendar-grid">
        {days.map((date) => {
          const iso = toISO(date);
          const outside = date.getMonth() !== view.getMonth();
          const today = iso === toISO(new Date());
          const active = iso === selectedValue;
          return (
            <button
              type="button"
              key={iso}
              aria-label={new Intl.DateTimeFormat("en-PH", { month: "long", day: "numeric", year: "numeric" }).format(date)}
              className={cn("calendar-day", outside && "outside", today && "today", active && "selected")}
              onClick={() => commit(date)}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <div className="calendar-footer">
        <button type="button" className="button button-secondary button-sm" onClick={() => { const today = new Date(); setView(today); commit(today); }}>Use today</button>
        {selectedValue && <button type="button" className="calendar-clear" onClick={clear}>Clear date</button>}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className={cn("date-picker", open && "is-open")} ref={rootRef}>
      {name && <input type="hidden" name={name} value={selectedValue} />}
      <button ref={(node) => { triggerRef.current = node; }} type="button" className="date-trigger" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <span className={cn("date-trigger-value", !selectedValue && "placeholder")}>{selectedValue ? formatDisplay(selectedValue) : placeholder}</span>
        <CalendarIcon size={19} />
      </button>
      {calendar}
    </div>
  );
}
