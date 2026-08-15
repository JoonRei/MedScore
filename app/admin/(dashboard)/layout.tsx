import { AdminShell } from "@/components/AdminShell";
import { requireAdmin } from "@/lib/admin-auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return <AdminShell email={user.email || "Admin"}>{children}</AdminShell>;
}
