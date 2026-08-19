export const dynamic = "force-dynamic";
export const revalidate = 0;
import { AdminShell } from "@/components/AdminShell";
import { requireAdminWorkspace } from "@/lib/admin-workspace";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAdminWorkspace();
  return <AdminShell
    email={context.profile.email || "Admin"}
    displayName={context.profile.display_name || "Administrator"}
  >{children}</AdminShell>;
}
