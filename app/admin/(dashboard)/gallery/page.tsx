import { PageHeader } from "@/components/PageHeader";
import { GalleryAdminClient } from "@/components/GalleryAdminClient";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminWorkspace } from "@/lib/admin-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  const context = await requireAdminWorkspace();
  const db = createAdminClient();

  const { data: students } = await db
    .from("students")
    .select("year_level")
    .eq("owner_id", context.workspace.id)
    .eq("is_active", true)
    .order("year_level");

  const yearLevels = Array.from(
    new Set((students || []).map((row: any) => String(row.year_level || "").trim()).filter(Boolean)),
  );

  return (
    <>
      <PageHeader
        eyebrow="Student experience"
        title="Gallery"
        description="Create and publish high-quality activity galleries for each year level."
      />
      <GalleryAdminClient yearLevels={yearLevels} />
    </>
  );
}
