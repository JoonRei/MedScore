"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { StudentGalleryShowcase, type GalleryPost } from "@/components/StudentGalleryShowcase";

type AdminPhoto = GalleryPost["photos"][number] & {
  storagePath?: string;
  previewPath?: string | null;
  previewSmallPath?: string | null;
  smallUrl?: string | null;
  fullUrl?: string | null;
  optimizedPreview?: boolean;
  originalName?: string | null;
};

type AdminGallery = Omit<GalleryPost, "photos"> & {
  photos: AdminPhoto[];
  createdAt?: string;
  updatedAt?: string;
};

type LocalPhoto = {
  id: string;
  file: File;
  previewBlob: Blob;
  smallPreviewBlob: Blob;
  url: string;
  width: number;
  height: number;
};

type Draft = {
  id?: string;
  title: string;
  eventName: string;
  activityDate: string;
  caption: string;
  yearLevel: string;
  status: "draft" | "published";
};

const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_BYTES = 25 * 1024 * 1024;

function defaultDraft(yearLevel = ""): Draft {
  return {
    title: "",
    eventName: "",
    activityDate: new Date().toISOString().slice(0, 10),
    caption: "",
    yearLevel,
    status: "draft",
  };
}

function prettyDate(value: string) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

async function createDisplayPreview(source: Blob) {
  const bitmap = await createImageBitmap(source);
  const width = bitmap.width || 1;
  const height = bitmap.height || 1;

  const encode = async (maxSide: number, quality: number) => {
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Image preview could not be prepared.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Image preview could not be encoded.")),
        "image/webp",
        quality,
      );
    });
  };

  try {
    const [previewBlob, smallPreviewBlob] = await Promise.all([
      encode(1280, 0.82),
      encode(640, 0.8),
    ]);
    return { width, height, previewBlob, smallPreviewBlob };
  } finally {
    bitmap.close();
  }
}
function validateFile(file: File) {
  if (!ACCEPTED.has(file.type)) return "Only JPG, PNG, WEBP, and AVIF images are supported.";
  if (file.size > MAX_BYTES) return `${file.name} is larger than 25 MB.`;
  return "";
}

export function GalleryAdminClient({ yearLevels }: { yearLevels: string[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const dragIndexRef = useRef<number | null>(null);
  const localPhotosRef = useRef<LocalPhoto[]>([]);
  const [galleries, setGalleries] = useState<AdminGallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [editing, setEditing] = useState<AdminGallery | null>(null);
  const [draft, setDraft] = useState<Draft>(() => defaultDraft(yearLevels[0] || ""));
  const [localPhotos, setLocalPhotos] = useState<LocalPhoto[]>([]);
  const [preview, setPreview] = useState<AdminGallery | null>(null);
  const [replaceTarget, setReplaceTarget] = useState<AdminPhoto | null>(null);

  const effectiveYearLevels = useMemo(
    () => yearLevels.length ? yearLevels : ["1st Year", "2nd Year", "3rd Year", "4th Year"],
    [yearLevels],
  );

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/gallery", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Unable to load gallery.");
      setGalleries(Array.isArray(data.galleries) ? data.galleries : []);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to load gallery." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localPhotosRef.current = localPhotos;
  }, [localPhotos]);

  useEffect(() => {
    return () => {
      localPhotosRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const resetEditor = () => {
    localPhotos.forEach((item) => URL.revokeObjectURL(item.url));
    setEditing(null);
    setDraft(defaultDraft(effectiveYearLevels[0] || ""));
    setLocalPhotos([]);
  };

  const openNew = () => {
    resetEditor();
    setDraft(defaultDraft(effectiveYearLevels[0] || ""));
    setEditing({} as AdminGallery);
  };

  const openEdit = (gallery: AdminGallery) => {
    localPhotos.forEach((item) => URL.revokeObjectURL(item.url));
    setLocalPhotos([]);
    setEditing(gallery);
    setDraft({
      id: gallery.id,
      title: gallery.title,
      eventName: gallery.eventName,
      activityDate: gallery.activityDate,
      caption: gallery.caption || "",
      yearLevel: gallery.yearLevel,
      status: gallery.status,
    });
  };

  const addFiles = async (files: File[]) => {
    const accepted: LocalPhoto[] = [];
    for (const file of files) {
      const issue = validateFile(file);
      if (issue) {
        setNotice({ tone: "error", text: issue });
        continue;
      }
      try {
        const prepared = await createDisplayPreview(file);
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          previewBlob: prepared.previewBlob,
          smallPreviewBlob: prepared.smallPreviewBlob,
          url: URL.createObjectURL(prepared.previewBlob),
          width: prepared.width,
          height: prepared.height,
        });
      } catch {
        setNotice({ tone: "error", text: `Unable to preview ${file.name}.` });
      }
    }
    if (accepted.length) setLocalPhotos((current) => [...current, ...accepted]);
  };

  const moveLocal = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return;
    setLocalPhotos((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const uploadOne = async (galleryId: string, item: LocalPhoto) => {
    const prepare = await fetch("/api/admin/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_upload",
        galleryId,
        fileName: item.file.name,
        mime: item.file.type,
        size: item.file.size,
      }),
    });
    const prepared = await prepare.json().catch(() => ({}));
    if (!prepare.ok) throw new Error(prepared?.error || "Unable to prepare image upload.");

    const supabase = createBrowserSupabaseClient();
    const [originalUpload, previewUpload, smallPreviewUpload] = await Promise.all([
      supabase.storage
        .from(prepared.bucket)
        .uploadToSignedUrl(prepared.path, prepared.token, item.file, {
          contentType: item.file.type,
          cacheControl: "31536000",
        }),
      supabase.storage
        .from(prepared.bucket)
        .uploadToSignedUrl(prepared.previewPath, prepared.previewToken, item.previewBlob, {
          contentType: "image/webp",
          cacheControl: "31536000",
        }),
      supabase.storage
        .from(prepared.bucket)
        .uploadToSignedUrl(prepared.previewSmallPath, prepared.previewSmallToken, item.smallPreviewBlob, {
          contentType: "image/webp",
          cacheControl: "31536000",
        }),
    ]);
    if (originalUpload.error) throw originalUpload.error;
    if (previewUpload.error) throw previewUpload.error;
    if (smallPreviewUpload.error) throw smallPreviewUpload.error;

    const confirm = await fetch("/api/admin/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "confirm_upload",
        galleryId,
        path: prepared.path,
        previewPath: prepared.previewPath,
        previewSmallPath: prepared.previewSmallPath,
        originalName: item.file.name,
        width: item.width,
        height: item.height,
      }),
    });
    const confirmed = await confirm.json().catch(() => ({}));
    if (!confirm.ok) throw new Error(confirmed?.error || "Unable to finish image upload.");
  };

  const save = async (publish: boolean) => {
    if (!draft.title.trim() || !draft.eventName.trim() || !draft.activityDate || !draft.yearLevel) {
      setNotice({ tone: "error", text: "Enter the gallery title, activity/event name, date, and year level." });
      return;
    }
    if (!draft.id && !localPhotos.length) {
      setNotice({ tone: "error", text: "Add at least one photo to create this gallery." });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      let galleryId = draft.id;

      if (!galleryId) {
        const response = await fetch("/api/admin/gallery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            title: draft.title,
            eventName: draft.eventName,
            activityDate: draft.activityDate,
            caption: draft.caption,
            yearLevel: draft.yearLevel,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Unable to create gallery.");
        galleryId = String(data.galleryId);
      }

      for (const item of localPhotos) {
        await uploadOne(galleryId, item);
      }

      const response = await fetch("/api/admin/gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          galleryId,
          title: draft.title,
          eventName: draft.eventName,
          activityDate: draft.activityDate,
          caption: draft.caption,
          yearLevel: draft.yearLevel,
          status: publish ? "published" : "draft",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Unable to save gallery.");

      resetEditor();
      await load();
      setNotice({
        tone: "success",
        text: publish ? "Gallery published to the selected year level." : "Gallery saved as draft.",
      });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to save gallery." });
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (gallery: AdminGallery, status: "draft" | "published") => {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", galleryId: gallery.id, status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Unable to update gallery.");
      await load();
      setNotice({ tone: "success", text: status === "published" ? "Gallery published." : "Gallery unpublished." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to update gallery." });
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = async (gallery: AdminGallery, photo: AdminPhoto) => {
    if (!window.confirm("Delete this photo from the gallery?")) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/gallery", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "photo", galleryId: gallery.id, photoId: photo.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Unable to delete photo.");
      await load();
      const refreshed = galleries.find((item) => item.id === gallery.id);
      setNotice({ tone: "success", text: "Photo deleted." });
      if (editing?.id === gallery.id && refreshed) openEdit(refreshed);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to delete photo." });
    } finally {
      setSaving(false);
    }
  };

  const deleteGallery = async (gallery: AdminGallery) => {
    if (!window.confirm(`Delete “${gallery.title}” and all of its photos?`)) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/gallery", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "gallery", galleryId: gallery.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Unable to delete gallery.");
      await load();
      setNotice({ tone: "success", text: "Gallery deleted." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to delete gallery." });
    } finally {
      setSaving(false);
    }
  };

  const reorderSaved = async (gallery: AdminGallery, from: number, to: number) => {
    if (from === to || to < 0 || to >= gallery.photos.length) return;
    const next = [...gallery.photos];
    const [photo] = next.splice(from, 1);
    next.splice(to, 0, photo);

    setGalleries((current) => current.map((item) => item.id === gallery.id ? { ...item, photos: next } : item));

    try {
      const response = await fetch("/api/admin/gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reorder", galleryId: gallery.id, photoIds: next.map((item) => item.id) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Unable to reorder photos.");
      await load();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to reorder photos." });
      await load();
    }
  };

  const replacePhoto = async (gallery: AdminGallery, photo: AdminPhoto, file: File) => {
    const issue = validateFile(file);
    if (issue) {
      setNotice({ tone: "error", text: issue });
      return;
    }

    setSaving(true);
    try {
      const preparedImage = await createDisplayPreview(file);
      const prepare = await fetch("/api/admin/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_replace_upload",
          galleryId: gallery.id,
          fileName: file.name,
          mime: file.type,
          size: file.size,
        }),
      });
      const prepared = await prepare.json().catch(() => ({}));
      if (!prepare.ok) throw new Error(prepared?.error || "Unable to prepare replacement.");

      const supabase = createBrowserSupabaseClient();
      const [originalUpload, previewUpload, smallPreviewUpload] = await Promise.all([
        supabase.storage
          .from(prepared.bucket)
          .uploadToSignedUrl(prepared.path, prepared.token, file, {
            contentType: file.type,
            cacheControl: "31536000",
          }),
        supabase.storage
          .from(prepared.bucket)
          .uploadToSignedUrl(prepared.previewPath, prepared.previewToken, preparedImage.previewBlob, {
            contentType: "image/webp",
            cacheControl: "31536000",
          }),
        supabase.storage
          .from(prepared.bucket)
          .uploadToSignedUrl(prepared.previewSmallPath, prepared.previewSmallToken, preparedImage.smallPreviewBlob, {
            contentType: "image/webp",
            cacheControl: "31536000",
          }),
      ]);
      if (originalUpload.error) throw originalUpload.error;
      if (previewUpload.error) throw previewUpload.error;
      if (smallPreviewUpload.error) throw smallPreviewUpload.error;

      const confirm = await fetch("/api/admin/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_replace",
          galleryId: gallery.id,
          photoId: photo.id,
          path: prepared.path,
          previewPath: prepared.previewPath,
          previewSmallPath: prepared.previewSmallPath,
          originalName: file.name,
          width: preparedImage.width,
          height: preparedImage.height,
        }),
      });
      const confirmed = await confirm.json().catch(() => ({}));
      if (!confirm.ok) throw new Error(confirmed?.error || "Unable to replace photo.");

      await load();
      setNotice({ tone: "success", text: "Photo replaced." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Unable to replace photo." });
    } finally {
      setSaving(false);
      setReplaceTarget(null);
      if (replaceInputRef.current) replaceInputRef.current.value = "";
    }
  };

  const photosNeedingOptimization = useMemo(
    () => galleries.flatMap((gallery) =>
      gallery.photos
        .filter((photo) => (!photo.previewPath || !photo.previewSmallPath) && photo.fullUrl)
        .map((photo) => ({ gallery, photo })),
    ),
    [galleries],
  );

  const optimizeExistingPhotos = async () => {
    if (!photosNeedingOptimization.length || optimizing) return;
    setOptimizing(true);
    setNotice(null);

    try {
      const supabase = createBrowserSupabaseClient();
      let completed = 0;

      for (const entry of photosNeedingOptimization) {
        setOptimizationProgress(`${completed + 1} / ${photosNeedingOptimization.length}`);

        const originalResponse = await fetch(String(entry.photo.fullUrl), { cache: "no-store" });
        if (!originalResponse.ok) throw new Error(`Unable to read ${entry.photo.originalName || "an existing photo"}.`);
        const originalBlob = await originalResponse.blob();
        const preparedImage = await createDisplayPreview(originalBlob);

        const prepare = await fetch("/api/admin/gallery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_preview_upload",
            galleryId: entry.gallery.id,
            photoId: entry.photo.id,
          }),
        });
        const prepared = await prepare.json().catch(() => ({}));
        if (!prepare.ok) throw new Error(prepared?.error || "Unable to prepare optimized preview.");

        const [previewUpload, smallPreviewUpload] = await Promise.all([
          supabase.storage
            .from(prepared.bucket)
            .uploadToSignedUrl(
              prepared.previewPath,
              prepared.previewToken,
              preparedImage.previewBlob,
              { contentType: "image/webp", cacheControl: "31536000" },
            ),
          supabase.storage
            .from(prepared.bucket)
            .uploadToSignedUrl(
              prepared.previewSmallPath,
              prepared.previewSmallToken,
              preparedImage.smallPreviewBlob,
              { contentType: "image/webp", cacheControl: "31536000" },
            ),
        ]);
        if (previewUpload.error) throw previewUpload.error;
        if (smallPreviewUpload.error) throw smallPreviewUpload.error;

        const confirm = await fetch("/api/admin/gallery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "confirm_preview",
            galleryId: entry.gallery.id,
            photoId: entry.photo.id,
            previewPath: prepared.previewPath,
            previewSmallPath: prepared.previewSmallPath,
          }),
        });
        const confirmed = await confirm.json().catch(() => ({}));
        if (!confirm.ok) throw new Error(confirmed?.error || "Unable to save optimized preview.");

        completed += 1;
      }

      await load();
      setNotice({
        tone: "success",
        text: `${completed} existing photo${completed === 1 ? "" : "s"} optimized for faster student loading.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Unable to optimize existing photos.",
      });
    } finally {
      setOptimizing(false);
      setOptimizationProgress("");
    }
  };

  const editorIsNew = Boolean(editing && !editing.id);
  const savedPhotos = editing?.id
    ? galleries.find((gallery) => gallery.id === editing.id)?.photos || editing.photos || []
    : [];

  return (
    <div className="admin-gallery-v482">
      {notice ? (
        <div className={`gallery-admin-toast-v482 is-${notice.tone}`} role="status">
          <strong>{notice.tone === "success" ? "Done" : "Needs attention"}</strong>
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)}>×</button>
        </div>
      ) : null}

      <div className="admin-gallery-toolbar-v482">
        <div>
          <strong>{galleries.length} {galleries.length === 1 ? "gallery" : "galleries"}</strong>
          <span>Draft, publish, and organize memories for each year level.</span>
        </div>
        <div className="admin-gallery-toolbar-actions-v484">
          {photosNeedingOptimization.length ? (
            <button
              type="button"
              className="button button-secondary gallery-admin-optimize-v484"
              onClick={() => void optimizeExistingPhotos()}
              disabled={optimizing || saving}
            >
              {optimizing ? `Optimizing ${optimizationProgress}` : "Optimize existing photos"}
            </button>
          ) : null}
          <button type="button" className="button button-primary" onClick={openNew}>New gallery</button>
        </div>
      </div>

      {loading ? (
        <div className="admin-gallery-loading-v482">
          {Array.from({ length: 3 }).map((_, index) => <span key={index} />)}
        </div>
      ) : galleries.length ? (
        <div className="admin-gallery-list-v482">
          {galleries.map((gallery) => {
            const cover = gallery.photos[0];
            return (
              <article className="admin-gallery-card-v482" key={gallery.id}>
                <button type="button" className="admin-gallery-cover-v482" onClick={() => setPreview(gallery)} aria-label={`Preview ${gallery.title}`}>
                  {cover?.url ? <img src={cover.url} alt="" loading="lazy" decoding="async" /> : <span>No photo</span>}
                </button>
                <div className="admin-gallery-card-copy-v482">
                  <div className="admin-gallery-card-meta-v482">
                    <span className={`is-${gallery.status}`}>{gallery.status === "published" ? "Published" : "Draft"}</span>
                    <small>{gallery.yearLevel}</small>
                    <time>{prettyDate(gallery.activityDate)}</time>
                  </div>
                  <h2>{gallery.title}</h2>
                  <p>{gallery.eventName}</p>
                  <div className="admin-gallery-card-bottom-v482">
                    <span>{gallery.photos.length} photo{gallery.photos.length === 1 ? "" : "s"}</span>
                    <div>
                      <button type="button" onClick={() => setPreview(gallery)}>Preview</button>
                      <button type="button" onClick={() => openEdit(gallery)}>Edit</button>
                      <button type="button" onClick={() => void setStatus(gallery, gallery.status === "published" ? "draft" : "published")} disabled={saving}>
                        {gallery.status === "published" ? "Unpublish" : "Publish"}
                      </button>
                      <button type="button" className="is-danger" onClick={() => void deleteGallery(gallery)} disabled={saving}>Delete</button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="admin-gallery-empty-v482">
          <span />
          <h2>No galleries yet</h2>
          <p>Create your first activity gallery and publish it to the appropriate year level.</p>
          <button type="button" className="button button-primary" onClick={openNew}>Create gallery</button>
        </div>
      )}

      {editing ? (
        <div className="gallery-admin-modal-backdrop-v482" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) resetEditor(); }}>
          <div className="gallery-admin-modal-v482" role="dialog" aria-modal="true" aria-labelledby="gallery-editor-title-v482">
            <div className="gallery-admin-modal-head-v482">
              <div>
                <span>{editorIsNew ? "New memory" : "Edit gallery"}</span>
                <h2 id="gallery-editor-title-v482">{editorIsNew ? "Create gallery" : draft.title || "Gallery"}</h2>
              </div>
              <button type="button" onClick={resetEditor} disabled={saving} aria-label="Close">×</button>
            </div>

            <div className="gallery-admin-modal-body-v482">
              <div className="gallery-admin-fields-v482">
                <label>
                  <span>Gallery / Activity Title</span>
                  <input value={draft.title} maxLength={140} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. White Coat Ceremony" />
                </label>
                <label>
                  <span>Activity or Event Name</span>
                  <input value={draft.eventName} maxLength={140} onChange={(event) => setDraft((current) => ({ ...current, eventName: event.target.value }))} placeholder="e.g. College of Medicine Program" />
                </label>
                <label>
                  <span>Date</span>
                  <input type="date" value={draft.activityDate} onChange={(event) => setDraft((current) => ({ ...current, activityDate: event.target.value }))} />
                </label>
                <label>
                  <span>Year Level</span>
                  <select value={draft.yearLevel} onChange={(event) => setDraft((current) => ({ ...current, yearLevel: event.target.value }))}>
                    {effectiveYearLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                  </select>
                </label>
                <label className="is-wide">
                  <span>Caption <small>Optional</small></span>
                  <textarea value={draft.caption} maxLength={700} onChange={(event) => setDraft((current) => ({ ...current, caption: event.target.value }))} placeholder="A short note about this moment." />
                </label>
              </div>

              <div
                className="gallery-dropzone-v482"
                onDragOver={(event) => { event.preventDefault(); event.currentTarget.classList.add("is-dragging"); }}
                onDragLeave={(event) => event.currentTarget.classList.remove("is-dragging")}
                onDrop={(event) => {
                  event.preventDefault();
                  event.currentTarget.classList.remove("is-dragging");
                  void addFiles(Array.from(event.dataTransfer.files || []));
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={(event) => void addFiles(Array.from(event.target.files || []))}
                />
                <strong>Drop photos here</strong>
                <span>or choose photos from your device · JPG, PNG, WEBP, AVIF · up to 25 MB each</span>
                <button type="button" className="button button-secondary" onClick={() => inputRef.current?.click()}>Choose photos</button>
              </div>

              {savedPhotos.length ? (
                <div className="gallery-saved-photo-section-v482">
                  <div className="gallery-photo-section-head-v482">
                    <strong>Published / saved photos</strong>
                    <span>Use the arrows to reorder, or replace an individual photo.</span>
                  </div>
                  <div className="gallery-admin-photo-grid-v482">
                    {savedPhotos.map((photo, index) => (
                      <div className="gallery-admin-photo-v482" key={photo.id}>
                        <img src={photo.url} alt="" loading="lazy" />
                        <div className="gallery-admin-photo-actions-v482">
                          <button type="button" disabled={index === 0 || saving} onClick={() => void reorderSaved(editing as AdminGallery, index, index - 1)}>←</button>
                          <button type="button" disabled={index === savedPhotos.length - 1 || saving} onClick={() => void reorderSaved(editing as AdminGallery, index, index + 1)}>→</button>
                          <button type="button" disabled={saving} onClick={() => { setReplaceTarget(photo); replaceInputRef.current?.click(); }}>Replace</button>
                          <button type="button" className="is-danger" disabled={saving} onClick={() => void removePhoto(editing as AdminGallery, photo)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {localPhotos.length ? (
                <div className="gallery-local-photo-section-v482">
                  <div className="gallery-photo-section-head-v482">
                    <strong>Photos ready to upload</strong>
                    <span>Drag thumbnails to change their order before saving.</span>
                  </div>
                  <div className="gallery-admin-photo-grid-v482">
                    {localPhotos.map((photo, index) => (
                      <div
                        className="gallery-admin-photo-v482 is-local"
                        key={photo.id}
                        draggable
                        onDragStart={() => { dragIndexRef.current = index; }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          const from = dragIndexRef.current;
                          dragIndexRef.current = null;
                          if (from != null) moveLocal(from, index);
                        }}
                      >
                        <img src={photo.url} alt="" />
                        <div className="gallery-admin-photo-actions-v482">
                          <button
                            type="button"
                            className="is-danger"
                            onClick={() => {
                              URL.revokeObjectURL(photo.url);
                              setLocalPhotos((current) => current.filter((item) => item.id !== photo.id));
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="gallery-admin-modal-actions-v482">
              <button type="button" className="button button-secondary" onClick={resetEditor} disabled={saving}>Cancel</button>
              <button type="button" className="button button-secondary" onClick={() => void save(false)} disabled={saving}>{saving ? "Saving…" : "Save draft"}</button>
              <button type="button" className="button button-primary" onClick={() => void save(true)} disabled={saving}>{saving ? "Publishing…" : "Publish"}</button>
            </div>
          </div>
        </div>
      ) : null}

      <input
        ref={replaceInputRef}
        className="gallery-hidden-file-input-v482"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const gallery = editing?.id ? galleries.find((item) => item.id === editing.id) : null;
          if (file && replaceTarget && gallery) void replacePhoto(gallery, replaceTarget, file);
        }}
      />

      {preview ? (
        <div className="gallery-admin-preview-backdrop-v482" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}>
          <div className="gallery-admin-preview-v482">
            <div className="gallery-admin-preview-head-v482">
              <div><strong>Student preview</strong><span>{preview.yearLevel}</span></div>
              <button type="button" onClick={() => setPreview(null)}>Close</button>
            </div>
            <div className="gallery-admin-preview-body-v482">
              <StudentGalleryShowcase initialPosts={[preview]} adminPreview previewTitle={preview.title} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
