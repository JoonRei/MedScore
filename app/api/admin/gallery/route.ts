import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getGradeAdminUser } from "@/lib/admin-grade-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const BUCKET = "gallery-images";
const SIGNED_VIEW_SECONDS = 60 * 60;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

function cleanText(value: unknown, max = 180) {
  return String(value || "").trim().slice(0, max);
}

function extFor(name: string, mime: string) {
  const fromName = name.toLowerCase().match(/\.([a-z0-9]{2,5})$/)?.[1];
  if (fromName && ["jpg", "jpeg", "png", "webp", "avif"].includes(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/avif") return "avif";
  return "jpg";
}

async function adminUser() {
  const user = await getGradeAdminUser();
  if (!user) return null;
  return user;
}

async function ownedGallery(db: ReturnType<typeof createAdminClient>, ownerId: string, galleryId: string) {
  const { data, error } = await db
    .from("gallery_posts")
    .select("id,owner_id,title,event_name,activity_date,caption,year_level,status,published_at")
    .eq("id", galleryId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function serializeGalleries(db: ReturnType<typeof createAdminClient>, ownerId: string) {
  const { data: posts, error: postsError } = await db
    .from("gallery_posts")
    .select("id,title,event_name,activity_date,caption,year_level,status,published_at,created_at,updated_at")
    .eq("owner_id", ownerId)
    .order("activity_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (postsError) throw postsError;

  const postIds = (posts || []).map((row: any) => String(row.id));
  let photos: any[] = [];
  if (postIds.length) {
    const { data, error } = await db
      .from("gallery_photos")
      .select("id,gallery_id,storage_path,preview_path,preview_small_path,original_name,width,height,sort_order,created_at")
      .in("gallery_id", postIds)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    photos = data || [];
  }

  const paths = Array.from(new Set(
    photos.flatMap((row: any) => [
      String(row.storage_path || ""),
      String(row.preview_path || ""),
      String(row.preview_small_path || ""),
    ]).filter(Boolean),
  ));
  const signedMap = new Map<string, string>();
  if (paths.length) {
    const { data: signedRows, error: signedError } = await db.storage
      .from(BUCKET)
      .createSignedUrls(paths, SIGNED_VIEW_SECONDS);
    if (signedError) throw signedError;
    for (let index = 0; index < paths.length; index += 1) {
      const url = signedRows?.[index]?.signedUrl;
      if (url) signedMap.set(paths[index], url);
    }
  }

  return (posts || []).map((post: any) => ({
    id: String(post.id),
    title: String(post.title || ""),
    eventName: String(post.event_name || ""),
    activityDate: String(post.activity_date || ""),
    caption: post.caption ? String(post.caption) : null,
    yearLevel: String(post.year_level || ""),
    status: String(post.status || "draft"),
    publishedAt: post.published_at ? String(post.published_at) : null,
    createdAt: String(post.created_at || ""),
    updatedAt: String(post.updated_at || ""),
    photos: photos
      .filter((photo: any) => String(photo.gallery_id) === String(post.id))
      .map((photo: any) => ({
        id: String(photo.id),
        url: signedMap.get(String(photo.preview_path || photo.storage_path)) || "",
        smallUrl: signedMap.get(String(photo.preview_small_path || photo.preview_path || photo.storage_path)) || "",
        fullUrl: signedMap.get(String(photo.storage_path)) || "",
        storagePath: String(photo.storage_path || ""),
        previewPath: photo.preview_path ? String(photo.preview_path) : null,
        previewSmallPath: photo.preview_small_path ? String(photo.preview_small_path) : null,
        optimizedPreview: Boolean(photo.preview_path && photo.preview_small_path),
        originalName: photo.original_name ? String(photo.original_name) : null,
        width: photo.width == null ? null : Number(photo.width),
        height: photo.height == null ? null : Number(photo.height),
        sortOrder: Number(photo.sort_order || 0),
      })),
  }));
}

export async function GET() {
  const user = await adminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const db = createAdminClient();
    const galleries = await serializeGalleries(db, user.id);
    return NextResponse.json({ galleries }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("admin gallery GET failed", error);
    return NextResponse.json({ error: "Unable to load galleries." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await adminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  try {
    const body = await request.json();
    const action = cleanText(body?.action, 40);
    const db = createAdminClient();

    if (action === "create") {
      const title = cleanText(body?.title, 140);
      const eventName = cleanText(body?.eventName, 140);
      const activityDate = cleanText(body?.activityDate, 20);
      const caption = cleanText(body?.caption, 700);
      const yearLevel = cleanText(body?.yearLevel, 80);

      if (!title || !eventName || !activityDate || !yearLevel) {
        return NextResponse.json({ error: "Title, event name, date, and year level are required." }, { status: 400 });
      }

      const { data, error } = await db
        .from("gallery_posts")
        .insert({
          owner_id: user.id,
          title,
          event_name: eventName,
          activity_date: activityDate,
          caption: caption || null,
          year_level: yearLevel,
          status: "draft",
          published_at: null,
        })
        .select("id")
        .single();
      if (error) throw error;

      return NextResponse.json({ ok: true, galleryId: data.id });
    }

    if (action === "create_upload" || action === "create_replace_upload") {
      const galleryId = cleanText(body?.galleryId, 80);
      const fileName = cleanText(body?.fileName, 240);
      const mime = cleanText(body?.mime, 80);
      const size = Number(body?.size || 0);
      if (!galleryId || !fileName || !ALLOWED_MIME.has(mime) || !Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "Use a JPG, PNG, WEBP, or AVIF image up to 25 MB." }, { status: 400 });
      }

      const gallery = await ownedGallery(db, user.id, galleryId);
      if (!gallery) return NextResponse.json({ error: "Gallery not found." }, { status: 404 });

      const assetId = randomUUID();
      const extension = extFor(fileName, mime);
      const storagePath = `${user.id}/${galleryId}/${assetId}.${extension}`;
      const previewPath = `${user.id}/${galleryId}/${assetId}-preview.webp`;
      const previewSmallPath = `${user.id}/${galleryId}/${assetId}-preview-640.webp`;

      const [
        { data: originalUpload, error: originalUploadError },
        { data: previewUpload, error: previewUploadError },
        { data: previewSmallUpload, error: previewSmallUploadError },
      ] = await Promise.all([
        db.storage.from(BUCKET).createSignedUploadUrl(storagePath),
        db.storage.from(BUCKET).createSignedUploadUrl(previewPath),
        db.storage.from(BUCKET).createSignedUploadUrl(previewSmallPath),
      ]);
      if (originalUploadError) throw originalUploadError;
      if (previewUploadError) throw previewUploadError;
      if (previewSmallUploadError) throw previewSmallUploadError;

      return NextResponse.json({
        ok: true,
        bucket: BUCKET,
        path: originalUpload.path,
        token: originalUpload.token,
        previewPath: previewUpload.path,
        previewToken: previewUpload.token,
        previewSmallPath: previewSmallUpload.path,
        previewSmallToken: previewSmallUpload.token,
      });
    }

    if (action === "create_preview_upload") {
      const galleryId = cleanText(body?.galleryId, 80);
      const photoId = cleanText(body?.photoId, 80);
      const gallery = await ownedGallery(db, user.id, galleryId);
      if (!gallery) return NextResponse.json({ error: "Gallery not found." }, { status: 404 });

      const { data: photo, error: photoError } = await db
        .from("gallery_photos")
        .select("id")
        .eq("id", photoId)
        .eq("gallery_id", galleryId)
        .maybeSingle();
      if (photoError) throw photoError;
      if (!photo) return NextResponse.json({ error: "Photo not found." }, { status: 404 });

      const assetId = randomUUID();
      const previewPath = `${user.id}/${galleryId}/${assetId}-preview.webp`;
      const previewSmallPath = `${user.id}/${galleryId}/${assetId}-preview-640.webp`;
      const [
        { data: previewUpload, error: previewError },
        { data: previewSmallUpload, error: previewSmallError },
      ] = await Promise.all([
        db.storage.from(BUCKET).createSignedUploadUrl(previewPath),
        db.storage.from(BUCKET).createSignedUploadUrl(previewSmallPath),
      ]);
      if (previewError) throw previewError;
      if (previewSmallError) throw previewSmallError;

      return NextResponse.json({
        ok: true,
        bucket: BUCKET,
        previewPath: previewUpload.path,
        previewToken: previewUpload.token,
        previewSmallPath: previewSmallUpload.path,
        previewSmallToken: previewSmallUpload.token,
      });
    }

    if (action === "confirm_upload") {
      const galleryId = cleanText(body?.galleryId, 80);
      const path = cleanText(body?.path, 500);
      const previewPath = cleanText(body?.previewPath, 500);
      const previewSmallPath = cleanText(body?.previewSmallPath, 500);
      const originalName = cleanText(body?.originalName, 240);
      const width = Math.max(1, Math.round(Number(body?.width || 1)));
      const height = Math.max(1, Math.round(Number(body?.height || 1)));

      const gallery = await ownedGallery(db, user.id, galleryId);
      if (!gallery) return NextResponse.json({ error: "Gallery not found." }, { status: 404 });
      if (!path.startsWith(`${user.id}/${galleryId}/`) || !previewPath.startsWith(`${user.id}/${galleryId}/`) || !previewSmallPath.startsWith(`${user.id}/${galleryId}/`)) {
        return NextResponse.json({ error: "Invalid gallery image path." }, { status: 400 });
      }

      const { data: last } = await db
        .from("gallery_photos")
        .select("sort_order")
        .eq("gallery_id", galleryId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data, error } = await db
        .from("gallery_photos")
        .insert({
          gallery_id: galleryId,
          storage_path: path,
          preview_path: previewPath,
          preview_small_path: previewSmallPath,
          original_name: originalName || null,
          width,
          height,
          sort_order: Number(last?.sort_order || 0) + 1,
        })
        .select("id")
        .single();
      if (error) throw error;

      return NextResponse.json({ ok: true, photoId: data.id });
    }

    if (action === "confirm_replace") {
      const galleryId = cleanText(body?.galleryId, 80);
      const photoId = cleanText(body?.photoId, 80);
      const path = cleanText(body?.path, 500);
      const previewPath = cleanText(body?.previewPath, 500);
      const previewSmallPath = cleanText(body?.previewSmallPath, 500);
      const originalName = cleanText(body?.originalName, 240);
      const width = Math.max(1, Math.round(Number(body?.width || 1)));
      const height = Math.max(1, Math.round(Number(body?.height || 1)));

      const gallery = await ownedGallery(db, user.id, galleryId);
      if (!gallery) return NextResponse.json({ error: "Gallery not found." }, { status: 404 });
      if (!path.startsWith(`${user.id}/${galleryId}/`) || !previewPath.startsWith(`${user.id}/${galleryId}/`) || !previewSmallPath.startsWith(`${user.id}/${galleryId}/`)) {
        return NextResponse.json({ error: "Invalid gallery image path." }, { status: 400 });
      }

      const { data: current, error: currentError } = await db
        .from("gallery_photos")
        .select("id,storage_path,preview_path,preview_small_path")
        .eq("id", photoId)
        .eq("gallery_id", galleryId)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) return NextResponse.json({ error: "Photo not found." }, { status: 404 });

      const { error: updateError } = await db
        .from("gallery_photos")
        .update({
          storage_path: path,
          preview_path: previewPath,
          preview_small_path: previewSmallPath,
          original_name: originalName || null,
          width,
          height,
        })
        .eq("id", photoId)
        .eq("gallery_id", galleryId);
      if (updateError) throw updateError;

      const oldPaths = [current.storage_path, current.preview_path, current.preview_small_path]
        .map((value: any) => String(value || ""))
        .filter((value: string) => Boolean(value) && value !== path && value !== previewPath && value !== previewSmallPath);
      if (oldPaths.length) {
        await db.storage.from(BUCKET).remove(oldPaths);
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "confirm_preview") {
      const galleryId = cleanText(body?.galleryId, 80);
      const photoId = cleanText(body?.photoId, 80);
      const previewPath = cleanText(body?.previewPath, 500);
      const previewSmallPath = cleanText(body?.previewSmallPath, 500);

      const gallery = await ownedGallery(db, user.id, galleryId);
      if (!gallery) return NextResponse.json({ error: "Gallery not found." }, { status: 404 });
      if (!previewPath.startsWith(`${user.id}/${galleryId}/`) || !previewSmallPath.startsWith(`${user.id}/${galleryId}/`)) {
        return NextResponse.json({ error: "Invalid gallery preview path." }, { status: 400 });
      }

      const { data: current, error: currentError } = await db
        .from("gallery_photos")
        .select("id,preview_path,preview_small_path")
        .eq("id", photoId)
        .eq("gallery_id", galleryId)
        .maybeSingle();
      if (currentError) throw currentError;
      if (!current) return NextResponse.json({ error: "Photo not found." }, { status: 404 });

      const { error: updateError } = await db
        .from("gallery_photos")
        .update({ preview_path: previewPath, preview_small_path: previewSmallPath })
        .eq("id", photoId)
        .eq("gallery_id", galleryId);
      if (updateError) throw updateError;

      const oldPreviews = [current.preview_path, current.preview_small_path]
        .map((value: any) => String(value || ""))
        .filter((value: string) => Boolean(value) && value !== previewPath && value !== previewSmallPath);
      if (oldPreviews.length) {
        await db.storage.from(BUCKET).remove(oldPreviews);
      }

      revalidatePath("/student");
      revalidatePath("/admin/gallery");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported gallery action." }, { status: 400 });
  } catch (error) {
    console.error("admin gallery POST failed", error);
    return NextResponse.json({ error: "Unable to save gallery." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const user = await adminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  try {
    const body = await request.json();
    const action = cleanText(body?.action, 40);
    const galleryId = cleanText(body?.galleryId, 80);
    const db = createAdminClient();

    const gallery = await ownedGallery(db, user.id, galleryId);
    if (!gallery) return NextResponse.json({ error: "Gallery not found." }, { status: 404 });

    if (action === "update") {
      const title = cleanText(body?.title, 140);
      const eventName = cleanText(body?.eventName, 140);
      const activityDate = cleanText(body?.activityDate, 20);
      const caption = cleanText(body?.caption, 700);
      const yearLevel = cleanText(body?.yearLevel, 80);
      const status = body?.status === "published" ? "published" : "draft";

      if (!title || !eventName || !activityDate || !yearLevel) {
        return NextResponse.json({ error: "Title, event name, date, and year level are required." }, { status: 400 });
      }

      if (status === "published") {
        const { count, error: photoCountError } = await db
          .from("gallery_photos")
          .select("id", { count: "exact", head: true })
          .eq("gallery_id", galleryId);
        if (photoCountError) throw photoCountError;
        if (!count) return NextResponse.json({ error: "Add at least one photo before publishing." }, { status: 400 });
      }

      const { error } = await db
        .from("gallery_posts")
        .update({
          title,
          event_name: eventName,
          activity_date: activityDate,
          caption: caption || null,
          year_level: yearLevel,
          status,
          published_at: status === "published" ? (gallery.published_at || new Date().toISOString()) : null,
        })
        .eq("id", galleryId)
        .eq("owner_id", user.id);
      if (error) throw error;

      revalidatePath("/student");
      revalidatePath("/admin/gallery");
      return NextResponse.json({ ok: true });
    }

    if (action === "status") {
      const status = body?.status === "published" ? "published" : "draft";
      if (status === "published") {
        const { count, error: photoCountError } = await db
          .from("gallery_photos")
          .select("id", { count: "exact", head: true })
          .eq("gallery_id", galleryId);
        if (photoCountError) throw photoCountError;
        if (!count) return NextResponse.json({ error: "Add at least one photo before publishing." }, { status: 400 });
      }

      const { error } = await db
        .from("gallery_posts")
        .update({
          status,
          published_at: status === "published" ? (gallery.published_at || new Date().toISOString()) : null,
        })
        .eq("id", galleryId)
        .eq("owner_id", user.id);
      if (error) throw error;

      revalidatePath("/student");
      revalidatePath("/admin/gallery");
      return NextResponse.json({ ok: true });
    }

    if (action === "reorder") {
      const photoIds = Array.isArray(body?.photoIds)
        ? body.photoIds.map((value: any) => String(value || "")).filter(Boolean)
        : [];

      const { data: ownedPhotos, error: ownedError } = await db
        .from("gallery_photos")
        .select("id")
        .eq("gallery_id", galleryId);
      if (ownedError) throw ownedError;

      const ownedSet = new Set((ownedPhotos || []).map((row: any) => String(row.id)));
      if (photoIds.length !== ownedSet.size || photoIds.some((id: string) => !ownedSet.has(id))) {
        return NextResponse.json({ error: "Photo order is incomplete." }, { status: 400 });
      }

      for (let index = 0; index < photoIds.length; index += 1) {
        const { error } = await db
          .from("gallery_photos")
          .update({ sort_order: index + 1 })
          .eq("id", photoIds[index])
          .eq("gallery_id", galleryId);
        if (error) throw error;
      }

      revalidatePath("/student");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported gallery action." }, { status: 400 });
  } catch (error) {
    console.error("admin gallery PATCH failed", error);
    return NextResponse.json({ error: "Unable to update gallery." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await adminUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  try {
    const body = await request.json();
    const action = cleanText(body?.action, 40);
    const galleryId = cleanText(body?.galleryId, 80);
    const db = createAdminClient();

    const gallery = await ownedGallery(db, user.id, galleryId);
    if (!gallery) return NextResponse.json({ error: "Gallery not found." }, { status: 404 });

    if (action === "photo") {
      const photoId = cleanText(body?.photoId, 80);
      const { data: photo, error: photoError } = await db
        .from("gallery_photos")
        .select("id,storage_path,preview_path,preview_small_path")
        .eq("id", photoId)
        .eq("gallery_id", galleryId)
        .maybeSingle();
      if (photoError) throw photoError;
      if (!photo) return NextResponse.json({ error: "Photo not found." }, { status: 404 });

      const { error } = await db.from("gallery_photos").delete().eq("id", photoId).eq("gallery_id", galleryId);
      if (error) throw error;
      const photoPaths = [photo.storage_path, photo.preview_path, photo.preview_small_path]
        .map((value: any) => String(value || ""))
        .filter(Boolean);
      if (photoPaths.length) await db.storage.from(BUCKET).remove(photoPaths);

      revalidatePath("/student");
      return NextResponse.json({ ok: true });
    }

    if (action === "gallery") {
      const { data: photos, error: photosError } = await db
        .from("gallery_photos")
        .select("storage_path,preview_path,preview_small_path")
        .eq("gallery_id", galleryId);
      if (photosError) throw photosError;

      const paths = (photos || [])
        .flatMap((row: any) => [String(row.storage_path || ""), String(row.preview_path || ""), String(row.preview_small_path || "")])
        .filter(Boolean);
      const { error } = await db
        .from("gallery_posts")
        .delete()
        .eq("id", galleryId)
        .eq("owner_id", user.id);
      if (error) throw error;

      if (paths.length) await db.storage.from(BUCKET).remove(paths);

      revalidatePath("/student");
      revalidatePath("/admin/gallery");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported delete action." }, { status: 400 });
  } catch (error) {
    console.error("admin gallery DELETE failed", error);
    return NextResponse.json({ error: "Unable to delete gallery content." }, { status: 500 });
  }
}
