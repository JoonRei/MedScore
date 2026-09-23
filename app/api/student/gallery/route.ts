import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const BUCKET = "gallery-images";
const SIGNED_VIEW_SECONDS = 60 * 60 * 4;

export async function GET() {
  const session = await getStudentSession();
  if (!session?.student) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const student = session.student;
    const db = createAdminClient();

    const { data: posts, error: postsError } = await db
      .from("gallery_posts")
      .select("id,title,event_name,activity_date,caption,year_level,status,published_at,created_at")
      .eq("owner_id", student.owner_id)
      .eq("year_level", student.year_level)
      .eq("status", "published")
      .order("activity_date", { ascending: false })
      .order("published_at", { ascending: false });
    if (postsError) throw postsError;

    const postIds = (posts || []).map((row: any) => String(row.id));
    let photos: any[] = [];

    if (postIds.length) {
      const { data, error } = await db
        .from("gallery_photos")
        .select("id,gallery_id,storage_path,preview_path,preview_small_path,original_name,width,height,sort_order")
        .in("gallery_id", postIds)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      photos = data || [];
    }

    // The showcase only receives lightweight previews. Older photos without a
    // preview still fall back to the original until the Admin runs Optimize.
    const displayPaths = Array.from(new Set(
      photos.flatMap((row: any) => [
        String(row.preview_path || row.storage_path || ""),
        String(row.preview_small_path || row.preview_path || row.storage_path || ""),
      ]).filter(Boolean),
    ));

    const signedMap = new Map<string, string>();
    if (displayPaths.length) {
      const { data: signedRows, error: signedError } = await db.storage
        .from(BUCKET)
        .createSignedUrls(displayPaths, SIGNED_VIEW_SECONDS);
      if (signedError) throw signedError;

      for (let index = 0; index < displayPaths.length; index += 1) {
        const url = signedRows?.[index]?.signedUrl;
        if (url) signedMap.set(displayPaths[index], url);
      }
    }

    const galleries = (posts || []).map((post: any) => ({
      id: String(post.id),
      title: String(post.title || ""),
      eventName: String(post.event_name || ""),
      activityDate: String(post.activity_date || ""),
      caption: post.caption ? String(post.caption) : null,
      yearLevel: String(post.year_level || ""),
      status: "published",
      publishedAt: post.published_at ? String(post.published_at) : null,
      photos: photos
        .filter((photo: any) => String(photo.gallery_id) === String(post.id))
        .map((photo: any) => {
          const displayPath = String(photo.preview_path || photo.storage_path || "");
          const smallDisplayPath = String(photo.preview_small_path || photo.preview_path || photo.storage_path || "");
          return {
            id: String(photo.id),
            url: signedMap.get(displayPath) || "",
            smallUrl: signedMap.get(smallDisplayPath) || signedMap.get(displayPath) || "",
            originalName: photo.original_name ? String(photo.original_name) : null,
            width: photo.width == null ? null : Number(photo.width),
            height: photo.height == null ? null : Number(photo.height),
            sortOrder: Number(photo.sort_order || 0),
            optimizedPreview: Boolean(photo.preview_path && photo.preview_small_path),
          };
        })
        .filter((photo: any) => Boolean(photo.url)),
    }));

    return NextResponse.json(
      { galleries },
      { headers: { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie" } },
    );
  } catch (error) {
    console.error("student gallery GET failed", error);
    return NextResponse.json({ error: "Unable to load gallery." }, { status: 500 });
  }
}
