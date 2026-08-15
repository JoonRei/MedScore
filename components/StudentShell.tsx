"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/Brand";
import { BookIcon, ChartIcon, HomeIcon, LogoutIcon, SettingsIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { InactivityLogout } from "@/components/InactivityLogout";

const nav = [
  { href: "/student", label: "Home", mobileLabel: "Home", icon: HomeIcon },
  { href: "/student/subjects", label: "Subjects", mobileLabel: "Subjects", icon: BookIcon },
  { href: "/student/results", label: "Results", mobileLabel: "Results", icon: ChartIcon },
  { href: "/student/settings", label: "Settings", mobileLabel: "Settings", icon: SettingsIcon },
];

export function StudentShell({ children, codeName }: { children: React.ReactNode; codeName: string }) {
  const pathname = usePathname();
  return (
    <div className="app-shell student-shell">
      <InactivityLogout role="student" />
      <aside className="sidebar student-sidebar">
        <div className="sidebar-brand"><Brand href="/student" /></div>
        <div className="sidebar-section-label">Student portal</div>
        <nav className="sidebar-nav" aria-label="Student navigation">
          {nav.map((item) => {
            const active = item.href === "/student" ? pathname === "/student" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={cn("nav-item", active && "active")}>
                <Icon size={19}/>
                <span className="nav-label nav-label-desktop">{item.label}</span>
                <span className="nav-label nav-label-mobile">{item.mobileLabel}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="admin-chip student-chip"><span className="avatar">{codeName.slice(0, 1)}</span><span><strong>{codeName}</strong><small>Student account</small></span></div>
          <form action="/api/student/logout" method="post"><button className="nav-item nav-button" type="submit"><LogoutIcon size={19}/><span>Sign out</span></button></form>
        </div>
      </aside>
      <div className="mobile-topbar"><Brand href="/student" compact /><div className="mobile-account"><span>{codeName}</span><form action="/api/student/logout" method="post"><button type="submit">Sign out</button></form></div></div>
      <main className="main-content"><div className="page-surface">{children}</div></main>
    </div>
  );
}
