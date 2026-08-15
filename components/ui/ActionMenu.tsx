"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { useFloatingPopover } from "@/components/ui/useFloatingPopover";
import { cn } from "@/lib/utils";

type Item = {
  label: string;
  icon: ComponentType<{ size?: number }>;
  href?: string;
  onClick?: () => void;
  tone?: "default" | "accent" | "danger";
  disabled?: boolean;
};

export function ActionMenu({ items, label = "Manage" }: { items: Item[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { triggerRef, popoverRef, style } = useFloatingPopover(open, { minWidth: 190, preferredWidth: 210, mobileSheet: false });

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const key = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open, popoverRef]);

  const menu = open && typeof document !== "undefined" ? createPortal(
    <div ref={popoverRef} style={style} className="action-menu-popover" role="menu">
      {items.map((item) => {
        const Icon = item.icon;
        const content = <><Icon size={18} /><span>{item.label}</span></>;
        if (item.href) {
          return <Link key={item.label} className={cn("action-menu-item", item.tone && `is-${item.tone}`)} href={item.href} role="menuitem" onClick={() => setOpen(false)}>{content}</Link>;
        }
        return <button key={item.label} type="button" className={cn("action-menu-item", item.tone && `is-${item.tone}`)} disabled={item.disabled} onClick={() => { setOpen(false); item.onClick?.(); }} role="menuitem">{content}</button>;
      })}
    </div>,
    document.body
  ) : null;

  return (
    <div className="action-menu" ref={rootRef}>
      <button ref={(node) => { triggerRef.current = node; }} type="button" className="action-menu-trigger" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>{label}</span>
      </button>
      {menu}
    </div>
  );
}
