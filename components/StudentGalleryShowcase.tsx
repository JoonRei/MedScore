"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon } from "@/components/icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon, FullScreenIcon } from "@hugeicons/core-free-icons";

export type GalleryPhoto = {
  id: string;
  url: string;
  smallUrl?: string | null;
  fullUrl?: string | null;
  width: number | null;
  height: number | null;
  sortOrder: number;
  originalName?: string | null;
  optimizedPreview?: boolean;
  previewPath?: string | null;
};

export type GalleryPost = {
  id: string;
  title: string;
  eventName: string;
  activityDate: string;
  caption: string | null;
  yearLevel: string;
  status: "draft" | "published";
  publishedAt: string | null;
  photos: GalleryPhoto[];
};

type Props = {
  initialPosts?: GalleryPost[];
  adminPreview?: boolean;
  previewTitle?: string;
};

const INITIAL_POSTS = 3;
const INITIAL_PHOTOS = 5;

function prettyDate(value: string) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function resolutionLabel(photo: GalleryPhoto) {
  if (!photo.width || !photo.height) return "Original resolution";
  const megapixels = (photo.width * photo.height) / 1_000_000;
  return `${photo.width.toLocaleString()} × ${photo.height.toLocaleString()} · ${megapixels >= 1 ? `${megapixels.toFixed(megapixels >= 10 ? 0 : 1)} MP` : "Original"}`;
}

function downloadHref(photo: GalleryPhoto) {
  return `/api/student/gallery/download?photoId=${encodeURIComponent(photo.id)}`;
}

function originalHref(photo: GalleryPhoto) {
  return `/api/student/gallery/photo?photoId=${encodeURIComponent(photo.id)}`;
}

function PostMosaic({
  post,
  onOpen,
}: {
  post: GalleryPost;
  onOpen: (index: number) => void;
}) {
  const photos = post.photos || [];
  const visible = photos.slice(0, INITIAL_PHOTOS);
  const extra = Math.max(0, photos.length - visible.length);

  return (
    <div className={`gallery-editorial-v485 gallery-editorial-v487 is-count-${Math.min(visible.length, INITIAL_PHOTOS)}`}>
      {visible.map((photo, index) => {
        const showMore = extra > 0 && index === visible.length - 1;
        return (
          <button
            key={photo.id}
            type="button"
            className={`gallery-editorial-photo-v485 gallery-editorial-photo-v487 is-photo-${index + 1}`}
            onClick={() => onOpen(index)}
            aria-label={`Open ${post.title} photo ${index + 1}`}
          >
            <img
              src={photo.url}
              srcSet={photo.smallUrl && photo.smallUrl !== photo.url ? `${photo.smallUrl} 640w, ${photo.url} 1280w` : undefined}
              alt={`${post.title} photo ${index + 1}`}
              width={photo.width || undefined}
              height={photo.height || undefined}
              loading="lazy"
              decoding="async"
              fetchPriority="low"
              sizes={index === 0
                ? "(max-width: 767px) calc(100vw - 32px), (max-width: 1023px) calc(100vw - 48px), min(58vw, 820px)"
                : "(max-width: 479px) calc(50vw - 20px), (max-width: 1023px) calc(50vw - 28px), min(42vw, 590px)"}
              draggable={false}
            />
            <span className="gallery-editorial-hover-v485 gallery-editorial-hover-v487" aria-hidden="true" />
            {showMore ? (
              <span className="gallery-editorial-more-v485 gallery-editorial-more-v487">
                <strong>+{extra}</strong>
                <small>View gallery</small>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function GalleryLightbox({
  post,
  startIndex,
  allowDownload,
  onClose,
}: {
  post: GalleryPost;
  startIndex: number;
  allowDownload: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [direction, setDirection] = useState<"next" | "prev" | "jump">("jump");
  const [originalUrls, setOriginalUrls] = useState<Record<string, string>>({});
  const [loadedOriginals, setLoadedOriginals] = useState<Record<string, boolean>>({});
  const [originalError, setOriginalError] = useState("");
  const [thumbnailLoaded, setThumbnailLoaded] = useState<Record<string, boolean>>({});
  const [thumbnailFailed, setThumbnailFailed] = useState<Record<string, boolean>>({});
  const [controlsQuiet, setControlsQuiet] = useState(false);
  const [closing, setClosing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const originalRequestsRef = useRef<Partial<Record<string, Promise<string | null>>>>({});
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const photos = post.photos || [];
  const current = photos[index];
  const canPrevious = index > 0;
  const canNext = index < photos.length - 1;

  const wakeControls = useCallback(() => {
    setControlsQuiet(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setControlsQuiet(true), 2800);
  }, []);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    closeTimerRef.current = setTimeout(() => onClose(), 190);
  }, [closing, onClose]);

  const goPrevious = useCallback(() => {
    if (!canPrevious) return;
    setDirection("prev");
    setIndex((value) => Math.max(0, value - 1));
    wakeControls();
  }, [canPrevious, wakeControls]);

  const goNext = useCallback(() => {
    if (!canNext) return;
    setDirection("next");
    setIndex((value) => Math.min(photos.length - 1, value + 1));
    wakeControls();
  }, [canNext, photos.length, wakeControls]);

  const goTo = useCallback((photoIndex: number) => {
    if (photoIndex === index || photoIndex < 0 || photoIndex >= photos.length) return;
    setDirection(photoIndex > index ? "next" : "prev");
    setIndex(photoIndex);
    wakeControls();
  }, [index, photos.length, wakeControls]);

  const ensureOriginal = useCallback(async (photo: GalleryPhoto | undefined) => {
    if (!photo) return null;
    if (photo.fullUrl) {
      setOriginalUrls((currentUrls) => (
        currentUrls[photo.id] ? currentUrls : { ...currentUrls, [photo.id]: String(photo.fullUrl) }
      ));
      return String(photo.fullUrl);
    }
    if (originalUrls[photo.id]) return originalUrls[photo.id];

    const pendingRequest = originalRequestsRef.current[photo.id];
    if (pendingRequest) return pendingRequest;

    const request = (async () => {
      try {
        const response = await fetch(originalHref(photo), {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.url) throw new Error(data?.error || "Unable to load the HD photo.");
        const url = String(data.url);
        setOriginalUrls((currentUrls) => ({ ...currentUrls, [photo.id]: url }));
        return url;
      } catch (error) {
        setOriginalError(error instanceof Error ? error.message : "Unable to load the HD photo.");
        return null;
      } finally {
        delete originalRequestsRef.current[photo.id];
      }
    })();

    originalRequestsRef.current[photo.id] = request;
    return request;
  }, [originalUrls]);

  const preloadOriginal = useCallback(async (photo: GalleryPhoto | undefined) => {
    if (!photo) return;
    const url = await ensureOriginal(photo);
    if (!url) return;
    const image = new Image();
    image.decoding = "async";
    image.src = url;
  }, [ensureOriginal]);

  const triggerDownload = useCallback(() => {
    if (!allowDownload || !current) return;
    const anchor = document.createElement("a");
    anchor.href = downloadHref(current);
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    wakeControls();
  }, [allowDownload, current, wakeControls]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (viewerRef.current?.requestFullscreen) {
        await viewerRef.current.requestFullscreen();
      }
    } catch {
      // Fullscreen support varies by browser/device; viewer remains fully usable.
    } finally {
      wakeControls();
    }
  }, [wakeControls]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    wakeControls();

    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      wakeControls();
    };

    const onKey = (event: KeyboardEvent) => {
      wakeControls();

      if (event.key === "Escape") {
        if (document.fullscreenElement) {
          void document.exitFullscreen();
        } else {
          requestClose();
        }
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevious();
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }

      if ((event.key === "d" || event.key === "D") && allowDownload) {
        event.preventDefault();
        triggerDownload();
      }
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [allowDownload, goNext, goPrevious, requestClose, triggerDownload, wakeControls]);

  useEffect(() => {
    if (!current) return;

    setOriginalError("");
    void ensureOriginal(current);
    thumbnailRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });

    const previousPhoto = index > 0 ? photos[index - 1] : undefined;
    const nextPhoto = index < photos.length - 1 ? photos[index + 1] : undefined;

    const timer = window.setTimeout(() => {
      void preloadOriginal(previousPhoto);
      void preloadOriginal(nextPhoto);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [current, ensureOriginal, index, photos, preloadOriginal]);

  if (!current) return null;

  const hdUrl = current.fullUrl || originalUrls[current.id] || "";
  const hdReady = Boolean(hdUrl && loadedOriginals[current.id]);

  return (
    <div
      ref={viewerRef}
      className={[
        "gallery-lightbox-v482",
        "gallery-lightbox-v483",
        "gallery-lightbox-v484",
        "gallery-lightbox-v485",
        "gallery-lightbox-v486",
        "gallery-lightbox-v487",
        controlsQuiet ? "is-controls-quiet" : "",
        closing ? "is-closing" : "",
        isFullscreen ? "is-browser-fullscreen" : "",
      ].filter(Boolean).join(" ")}
      role="dialog"
      aria-modal="true"
      aria-label={`${post.title} gallery`}
      onPointerMove={wakeControls}
      onPointerDown={wakeControls}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <header className="gallery-lightbox-top-v486 gallery-lightbox-top-v487">
        <div className="gallery-lightbox-info-v486 gallery-lightbox-info-v487">
          <div className="gallery-lightbox-meta-v486 gallery-lightbox-meta-v487">
            {post.eventName ? <span>{post.eventName}</span> : null}
            <span>{prettyDate(post.activityDate)}</span>
            <span>{index + 1} of {photos.length}</span>
          </div>
          <strong>{post.title}</strong>
          {post.caption ? <small>{post.caption}</small> : null}
        </div>

        <div className="gallery-lightbox-actions-v486 gallery-lightbox-actions-v487">
          {allowDownload ? (
            <button
              className="gallery-lightbox-action-v486 is-download"
              type="button"
              onClick={triggerDownload}
              aria-label="Download original high-resolution photo"
            >
              <HugeiconsIcon icon={Download01Icon} size={17} strokeWidth={1.8} color="currentColor" />
              <span>Download HD</span>
            </button>
          ) : null}

          <button
            className="gallery-lightbox-action-v486 is-icon"
            type="button"
            onClick={() => void toggleFullscreen()}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            <HugeiconsIcon icon={FullScreenIcon} size={18} strokeWidth={1.8} color="currentColor" />
          </button>

          <button
            className="gallery-lightbox-action-v486 is-icon gallery-lightbox-close-v486"
            type="button"
            onClick={requestClose}
            aria-label="Close gallery"
          >
            <CloseIcon size={19} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div
        className="gallery-lightbox-stage-v486 gallery-lightbox-stage-v487"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) requestClose();
        }}
        onTouchStart={(event) => {
          wakeControls();
          const touch = event.touches[0];
          if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          wakeControls();
          const start = touchStartRef.current;
          const touch = event.changedTouches[0];
          touchStartRef.current = null;
          if (!start || !touch) return;

          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
          if (dx < 0) goNext();
          else goPrevious();
        }}
      >
        {canPrevious ? (
          <button
            type="button"
            className="gallery-lightbox-nav-v486 gallery-lightbox-nav-v487 is-prev"
            onClick={goPrevious}
            aria-label="Previous photo"
          >
            <ArrowLeftIcon size={22} strokeWidth={1.8} />
          </button>
        ) : null}

        <div className={`gallery-lightbox-photo-frame-v486 gallery-lightbox-photo-frame-v487 is-${direction}${hdReady ? " is-hd-ready" : ""}`} key={`${current.id}-${direction}`}>
          <img
            className="gallery-lightbox-preview-v486 gallery-lightbox-preview-v487"
            src={current.url}
            alt=""
            width={current.width || undefined}
            height={current.height || undefined}
            draggable={false}
            decoding="async"
          />

          {hdUrl ? (
            <img
              className={`gallery-lightbox-hd-v486 gallery-lightbox-hd-v487${hdReady ? " is-ready" : ""}`}
              src={hdUrl}
              alt={`${post.title} photo ${index + 1}`}
              width={current.width || undefined}
              height={current.height || undefined}
              draggable={false}
              decoding="async"
              fetchPriority="high"
              onLoad={() => {
                setLoadedOriginals((values) => ({ ...values, [current.id]: true }));
              }}
            />
          ) : null}

          {!hdReady && !originalError ? (
            <span className="gallery-lightbox-loading-hd-v486">Loading HD</span>
          ) : null}

          {originalError ? (
            <span className="gallery-lightbox-hd-error-v486">Preview shown · HD unavailable</span>
          ) : null}
        </div>

        {canNext ? (
          <button
            type="button"
            className="gallery-lightbox-nav-v486 gallery-lightbox-nav-v487 is-next"
            onClick={goNext}
            aria-label="Next photo"
          >
            <ArrowRightIcon size={22} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>

      <footer className="gallery-lightbox-bottom-v486 gallery-lightbox-bottom-v487">
        <div className="gallery-lightbox-mobile-context-v487">
          <strong>{post.title}</strong>
          {post.caption ? <span>{post.caption}</span> : null}
        </div>

        <div className="gallery-lightbox-filmstrip-v486 gallery-lightbox-filmstrip-v487" aria-label="Gallery thumbnails">
          {photos.map((photo, photoIndex) => {
            const loaded = Boolean(thumbnailLoaded[photo.id]);
            const failed = Boolean(thumbnailFailed[photo.id]);

            return (
              <button
                key={photo.id}
                ref={(node) => { thumbnailRefs.current[photoIndex] = node; }}
                type="button"
                className={photoIndex === index ? "is-active" : ""}
                onClick={() => goTo(photoIndex)}
                aria-label={`View photo ${photoIndex + 1}`}
                aria-current={photoIndex === index ? "true" : undefined}
              >
                {!loaded && !failed ? <span className="gallery-thumb-skeleton-v486" aria-hidden="true" /> : null}
                {failed ? (
                  <span className="gallery-thumb-fallback-v486" aria-hidden="true">Photo</span>
                ) : (
                  <img
                    className={loaded ? "is-loaded" : ""}
                    src={photo.smallUrl || photo.url}
                    alt=""
                    loading={Math.abs(photoIndex - index) <= 3 ? "eager" : "lazy"}
                    decoding="async"
                    sizes="clamp(54px, 8vw, 80px)"
                    fetchPriority={Math.abs(photoIndex - index) <= 1 ? "high" : "low"}
                    onLoad={() => setThumbnailLoaded((values) => ({ ...values, [photo.id]: true }))}
                    onError={() => setThumbnailFailed((values) => ({ ...values, [photo.id]: true }))}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="gallery-lightbox-bottom-meta-v486 gallery-lightbox-bottom-meta-v487">
          {allowDownload ? (
            <button className="gallery-lightbox-mobile-download-v486" type="button" onClick={triggerDownload}>
              <HugeiconsIcon icon={Download01Icon} size={16} strokeWidth={1.8} color="currentColor" />
              <span>HD</span>
            </button>
          ) : null}
          <span>{resolutionLabel(current)}</span>
        </div>
      </footer>
    </div>
  );
}

export function StudentGalleryShowcase({
  initialPosts,
  adminPreview = false,
  previewTitle,
}: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const [posts, setPosts] = useState<GalleryPost[]>(initialPosts || []);
  const [loading, setLoading] = useState(!initialPosts);
  const [loaded, setLoaded] = useState(Boolean(initialPosts));
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(Boolean(adminPreview));
  const [viewer, setViewer] = useState<{ post: GalleryPost; index: number } | null>(null);

  useEffect(() => {
    if (!initialPosts) return;
    setPosts(initialPosts);
    setLoading(false);
    setLoaded(true);
  }, [initialPosts]);

  useEffect(() => {
    if (initialPosts || loaded) return;
    const node = rootRef.current;
    if (!node) return;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/student/gallery", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Unable to load gallery.");
        setPosts(Array.isArray(data.galleries) ? data.galleries : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load gallery.");
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    };

    if (!("IntersectionObserver" in window)) {
      void load();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          void load();
        }
      },
      { rootMargin: "650px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [initialPosts, loaded]);

  const visiblePosts = useMemo(
    () => (showAll ? posts : posts.slice(0, INITIAL_POSTS)),
    [posts, showAll],
  );

  return (
    <>
      <section
        ref={rootRef}
        className={`student-gallery-showcase-v482 student-gallery-showcase-v483 student-gallery-showcase-v484 student-gallery-showcase-v485 student-gallery-showcase-v487${adminPreview ? " is-admin-preview" : ""}`}
        aria-labelledby="gallery-showcase-title-v482"
      >
        <div className="student-gallery-heading-v482 student-gallery-heading-v483 student-gallery-heading-v484 student-gallery-heading-v485 student-gallery-heading-v487">
          <div>
            <span>{adminPreview ? "Student preview" : "Gallery showcase"}</span>
            <h2 id="gallery-showcase-title-v482">{previewTitle || "Moments worth remembering"}</h2>
            <p>{adminPreview ? "This is how this gallery will appear in the Student Portal." : "Activities, events, and memorable moments from your year level."}</p>
          </div>
        </div>

        {loading ? (
          <div className="student-gallery-loading-v482 student-gallery-loading-v484 student-gallery-loading-v485" aria-label="Loading gallery">
            <span />
            <span />
            <span />
          </div>
        ) : error ? (
          <div className="student-gallery-empty-v482 is-error">
            <strong>Gallery unavailable</strong>
            <p>{error}</p>
          </div>
        ) : visiblePosts.length ? (
          <div className="student-gallery-posts-v482 student-gallery-posts-v483 student-gallery-posts-v484 student-gallery-posts-v485 student-gallery-posts-v487">
            {visiblePosts.map((post) => (
              <article className="student-gallery-post-v482 student-gallery-post-v483 student-gallery-post-v484 student-gallery-post-v485 student-gallery-post-v487" key={post.id}>
                <div className="student-gallery-post-head-v482 student-gallery-post-head-v483 student-gallery-post-head-v484 student-gallery-post-head-v485 student-gallery-post-head-v487">
                  <div className="student-gallery-story-copy-v485 student-gallery-story-copy-v487">
                    <div className="student-gallery-post-meta-v482 student-gallery-post-meta-v484 student-gallery-post-meta-v485 student-gallery-post-meta-v487">
                      <time dateTime={post.activityDate}>{prettyDate(post.activityDate)}</time>
                      {post.eventName ? <span>{post.eventName}</span> : null}
                    </div>
                    <h3>{post.title}</h3>
                    {post.caption ? <p>{post.caption}</p> : null}
                  </div>

                  {post.photos.length ? (
                    <button
                      className="student-gallery-full-action-v485 student-gallery-full-action-v487"
                      type="button"
                      onClick={() => setViewer({ post, index: 0 })}
                    >
                      <span>View full gallery</span>
                      <ArrowRightIcon size={14} strokeWidth={1.8} />
                    </button>
                  ) : null}
                </div>

                {post.photos.length ? (
                  <PostMosaic post={post} onOpen={(index) => setViewer({ post, index })} />
                ) : (
                  <div className="student-gallery-no-photos-v482">Photos will appear here when added.</div>
                )}

              </article>
            ))}
          </div>
        ) : (
          <div className="student-gallery-empty-v482">
            <span aria-hidden="true" />
            <strong>No gallery moments yet</strong>
            <p>Photos published for your year level will appear here.</p>
          </div>
        )}

        {!adminPreview && posts.length > INITIAL_POSTS ? (
          <button
            className="student-gallery-more-posts-v482 student-gallery-more-posts-v483 student-gallery-more-posts-v484 student-gallery-more-posts-v485 student-gallery-more-posts-v487"
            type="button"
            onClick={() => setShowAll((value) => !value)}
          >
            {showAll ? "Show less" : "View more galleries"}
          </button>
        ) : null}
      </section>

      {viewer ? (
        <GalleryLightbox
          post={viewer.post}
          startIndex={viewer.index}
          allowDownload={!adminPreview}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </>
  );
}
