import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/student-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const BUCKET = "gallery-images";
const ORIGINAL_URL_SECONDS = 60 * 15;

export async function GET(request: Request) {
  const session = await getStudentSession();
  if (!session?.student) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const photoId = String(new URL(request.url).searchParams.get("photoId") || "").trim();
  if (!photoId) {
    return NextResponse.json({ error: "Photo is required." }, { status: 400 });
  }

  try {
    const db = createAdminClient();

    const { data: photo, error: photoError } = await db
      .from("gallery_photos")
      .select("id,gallery_id,storage_path")
      .eq("id", photoId)
      .maybeSingle();
    if (photoError) throw photoError;
    if (!photo) return NextResponse.json({ error: "Photo not found." }, { status: 404 });

    const { data: gallery, error: galleryError } = await db
      .from("gallery_posts")
      .select("id")
      .eq("id", photo.gallery_id)
      .eq("owner_id", session.student.owner_id)
      .eq("year_level", session.student.year_level)
      .eq("status", "published")
      .maybeSingle();
    if (galleryError) throw galleryError;
    if (!gallery) {
      return NextResponse.json({ error: "Photo not available for your year level." }, { status: 404 });
    }

    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUrl(String(photo.storage_path), ORIGINAL_URL_SECONDS);
    if (error) throw error;
    if (!data?.signedUrl) throw new Error("Signed photo URL was not created.");

    return NextResponse.json(
      { url: data.signedUrl },
      { headers: { "Cache-Control": "private, no-store, max-age=0", "Vary": "Cookie" } },
    );
  } catch (error) {
    console.error("student gallery HD photo failed", error);
    return NextResponse.json({ error: "Unable to load the HD photo." }, { status: 500 });
  }
}
