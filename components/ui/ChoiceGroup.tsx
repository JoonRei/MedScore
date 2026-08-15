"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export type ChoiceOption = { value: string; label: string; description?: string };

export function ChoiceGroup({
  name,
  options,
  defaultValues = [],
  columns = 2,
  emptyText,
}: {
  name: string;
  options: ChoiceOption[];
  defaultValues?: string[];
  columns?: 1 | 2 | 3;
  emptyText?: string;
}) {
  const [selected, setSelected] = useState(() => new Set(defaultValues));

  function toggle(value: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  if (!options.length) return <div className="choice-empty">{emptyText || "No options available."}</div>;

  return (
    <div className={cn("choice-grid", `choice-columns-${columns}`)}>
      {options.map((option) => {
        const active = selected.has(option.value);
        return (
          <div key={option.value}>
            {active && <input type="hidden" name={name} value={option.value} />}
            <button type="button" className={cn("choice-card", active && "selected")} onClick={() => toggle(option.value)} aria-pressed={active}>
              <span className="choice-copy"><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</span>
              <span className="choice-check">{active && <CheckIcon size={14} />}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
