"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/Brand";
import { BookIcon, ChartIcon, FileIcon, HomeIcon, LogoutIcon, SettingsIcon, UsersIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { InactivityLogout } from "@/components/InactivityLogout";

const nav = [
  { href: "/admin", label: "Overview", icon: HomeIcon },
  { href: "/admin/students", label: "Students", icon: UsersIcon },
  { href: "/admin/subjects", label: "Subjects", icon: BookIcon },
  { href: "/admin/assessments", label: "Assessments", icon: FileIcon },
  { href: "/admin/reports", label: "Reports", icon: ChartIcon },
  { href: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export function AdminShell({ children, email }: { children: React.ReactNode; email: string }) {
  const pathname = usePathname();
  return (
    <div className="app-shell">
      <InactivityLogout role="admin" />
      <aside className="sidebar">
        <div className="sidebar-brand"><Brand href="/admin" /></div>
        <div className="sidebar-section-label">Workspace</div>
        <nav className="sidebar-nav" aria-label="Admin navigation">
          {nav.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className={cn("nav-item", active && "active")}><Icon size={19} /><span>{item.label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="admin-chip"><span className="avatar">A</span><span><strong>Administrator</strong><small>{email}</small></span></div>
          <form action="/api/admin/logout" method="post"><button className="nav-item nav-button" type="submit"><LogoutIcon size={19}/><span>Sign out</span></button></form>
        </div>
      </aside>
      <div className="mobile-topbar"><Brand href="/admin" compact /><div className="mobile-account"><span>Admin</span><form action="/api/admin/logout" method="post"><button type="submit">Sign out</button></form></div></div>
      <main className="main-content"><div className="page-surface">{children}</div></main>
    </div>
  );
}
