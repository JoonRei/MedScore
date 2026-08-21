"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/Brand";
import { BookIcon, ChartIcon, FileIcon, HomeIcon, LogoutIcon, SettingsIcon, UsersIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { InactivityLogout } from "@/components/InactivityLogout";

const nav = [
  { href: "/admin", label: "Overview", mobileLabel: "Home", icon: HomeIcon },
  { href: "/admin/students", label: "Students", mobileLabel: "Students", icon: UsersIcon },
  { href: "/admin/subjects", label: "Subjects", mobileLabel: "Subjects", icon: BookIcon },
  { href: "/admin/assessments", label: "Assessments", mobileLabel: "Exams", icon: FileIcon },
  { href: "/admin/reports", label: "Reports", mobileLabel: "Reports", icon: ChartIcon },
  { href: "/admin/settings", label: "Settings", mobileLabel: "Settings", icon: SettingsIcon },
];

export function AdminShell({
  children,
  email,
  displayName,
}: {
  children: React.ReactNode;
  email: string;
  displayName: string;
}) {
  const pathname = usePathname();
  return (
    <div className="app-shell admin-shell">
      <InactivityLogout role="admin" />
      <aside className="sidebar">
        <div className="sidebar-brand"><Brand href="/admin" /></div>
        <div className="sidebar-section-label">Admin portal</div>
        <nav className="sidebar-nav" aria-label="Admin navigation">
          {nav.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} prefetch={true} className={cn("nav-item", active && "active")}>
              <Icon size={19} />
              <span className="nav-label nav-label-desktop">{item.label}</span>
              <span className="nav-label nav-label-mobile">{item.mobileLabel}</span>
            </Link>;
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="admin-chip"><span className="avatar">{displayName.slice(0, 1).toUpperCase()}</span><span><strong>{displayName}</strong><small>{email}</small></span></div>
          <form action="/api/admin/logout" method="post"><button className="nav-item nav-button" type="submit"><LogoutIcon size={19}/><span>Sign out</span></button></form>
        </div>
      </aside>
      <div className="mobile-topbar"><Brand href="/admin" /><div className="mobile-account"><span>{displayName}</span><form action="/api/admin/logout" method="post"><button type="submit">Sign out</button></form></div></div>
      <main className="main-content admin-main-content">{children}</main>
    </div>
  );
}
