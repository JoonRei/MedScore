"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/Brand";
import { HugeiconsIcon } from "@hugeicons/react";
import { Book02Icon, HonourStarIcon } from "@hugeicons/core-free-icons";
import { HomeIcon, NotificationIcon, SettingsIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { InactivityLogout } from "@/components/InactivityLogout";
import { StudentNotificationBadge, StudentNotificationsProvider } from "@/components/StudentNotifications";

type StudentNavIconProps = { size?: number; strokeWidth?: number };

function SubjectsNavIcon({ size = 25, strokeWidth = 1.75 }: StudentNavIconProps) {
  return <HugeiconsIcon icon={Book02Icon} size={size} strokeWidth={strokeWidth} color="currentColor" />;
}

function ResultsNavIcon({ size = 25, strokeWidth = 1.75 }: StudentNavIconProps) {
  return <HugeiconsIcon icon={HonourStarIcon} size={size} strokeWidth={strokeWidth} color="currentColor" />;
}

const nav = [
  { href: "/student", label: "Home", icon: HomeIcon },
  { href: "/student/subjects", label: "Subjects", icon: SubjectsNavIcon },
  { href: "/student/results", label: "Results", icon: ResultsNavIcon },
  { href: "/student/notifications", label: "Notifications", icon: NotificationIcon, notifications: true },
  { href: "/student/settings", label: "Settings", icon: SettingsIcon },
];

export function StudentShell({ children, codeName }: { children: React.ReactNode; codeName: string }) {
  const pathname = usePathname();
  const isResultsPage = pathname === "/student/results";

  return (
    <StudentNotificationsProvider>
      <div className="app-shell student-shell student-portal-v437 student-portal-v438 student-portal-v439 student-portal-v440 student-portal-v441 student-portal-v442 student-portal-v443 student-portal-v444">
        <InactivityLogout role="student" />

        <aside className="sidebar student-sidebar student-sidebar-v437 student-sidebar-v438 student-sidebar-v439 student-sidebar-v440 student-sidebar-v441 student-sidebar-v442 student-sidebar-v443 student-sidebar-v444">
          <nav className="sidebar-nav student-rail-nav-v439 student-rail-nav-v440 student-rail-nav-v441 student-rail-nav-v442 student-rail-nav-v443 student-rail-nav-v444" aria-label="Student navigation">
            {nav.map((item) => {
              const active = item.href === "/student"
                ? pathname === "/student"
                : item.href === "/student/results"
                  ? pathname.startsWith("/student/results") || pathname.startsWith("/student/grades")
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  aria-label={item.label}
                  title={item.label}
                  data-nav-label={item.label}
                  className={cn("nav-item student-nav-link student-nav-link-v438 student-nav-link-v439 student-nav-link-v440 student-nav-link-v441 student-nav-link-v442 student-nav-link-v443 student-nav-link-v444", active && "active")}
                >
                  <span className="student-nav-icon-wrap student-nav-icon-wrap-v438 student-nav-icon-wrap-v439 student-nav-icon-wrap-v440 student-nav-icon-wrap-v441 student-nav-icon-wrap-v442 student-nav-icon-wrap-v443 student-nav-icon-wrap-v444">
                    <Icon size={25} strokeWidth={1.75} />
                    {item.notifications && <StudentNotificationBadge className="is-nav" />}
                  </span>
                </Link>
              );
            })}
          </nav>

        </aside>

        <div className="student-stage-v442 student-stage-v443 student-stage-v444">
          <header className="student-topbar-v442 student-topbar-v443 student-topbar-v444 student-topbar-flow-v459">
            <Brand href="/student" />
            <div className="student-topbar-actions-v442 student-topbar-actions-v443 student-topbar-actions-v444">
              <Link href="/student/settings" className="student-topbar-avatar-v442 student-topbar-avatar-v443 student-topbar-avatar-v444" aria-label="Open student settings" title="Student settings">
                {codeName.slice(0, 1)}
              </Link>
              <form action="/api/student/logout" method="post">
                <button className="student-topbar-signout-v442 student-topbar-signout-v443 student-topbar-signout-v444" type="submit">Sign out</button>
              </form>
            </div>
          </header>

          <main className={cn("main-content student-main-content-v437 student-main-content-v438 student-main-content-v439 student-main-content-v440 student-main-content-v441 student-main-content-v442 student-main-content-v443 student-main-content-v444", isResultsPage && "student-main-is-results-v443 student-main-is-results-v444")}>
            {isResultsPage && (
              <div className="student-results-grade-access-v443 student-results-grade-access-v444">
                <Link href="/student/grades" className="button button-secondary button-sm">Term grades</Link>
              </div>
            )}
            {children}
            <div className="student-bottom-clearance-v444 student-bottom-clearance-v459" aria-hidden="true" />
          </main>
        </div>
      </div>
    </StudentNotificationsProvider>
  );
}
