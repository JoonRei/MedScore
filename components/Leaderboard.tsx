"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { formatDate } from "@/lib/utils";

type Entry = { codeName: string; score: number; rank: number; isCurrent: boolean };
type ShowcaseBoard = {
  id: string;
  title: string;
  type: string;
  totalScore: number;
  date: string;
  doctorName: string | null;
  subjectId: string;
  subjectName: string;
  subjectCode: string | null;
  top: Entry[];
  totalRanked: number;
};
type Payload = { boards?: ShowcaseBoard[]; error?: string };
type RankGroup = { rank: number; score: number; entries: Entry[] };

type GestureState = {
  pointerId: number | null;
  startX: number;
  startY: number;
  latestX: number;
  latestY: number;
  moved: boolean;
};

const AUTO_ADVANCE_MS = 6500;
const CARD_STEP_PERCENT = 74;

function initials(codeName: string) {
  const compact = codeName.replace(/[^A-Za-z0-9]/g, "");
  return (compact.slice(0, 2) || codeName.slice(0, 2) || "MS").toUpperCase();
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function groupRanks(entries: Entry[]): RankGroup[] {
  const grouped = new Map<number, RankGroup>();
  for (const entry of entries) {
    const existing = grouped.get(entry.rank);
    if (existing) existing.entries.push(entry);
    else grouped.set(entry.rank, { rank: entry.rank, score: entry.score, entries: [entry] });
  }
  return Array.from(grouped.values()).sort((a, b) => a.rank - b.rank);
}

function relativePosition(index: number, activeIndex: number, total: number) {
  if (total <= 1) return 0;
  let delta = index - activeIndex;
  const half = total / 2;
  if (delta > half) delta -= total;
  if (delta < -half) delta += total;
  return delta;
}

function PodiumGroup({ group, totalScore }: { group?: RankGroup; totalScore: number }) {
  if (!group) return <div className="leaderboard-podium-stage is-empty" aria-hidden="true" />;

  const tone = group.rank === 1 ? "gold" : group.rank === 2 ? "silver" : "bronze";
  const featured = group.entries[0];

  return (
    <div className={`leaderboard-podium-stage rank-${group.rank} ${tone}`}>
      <div className="leaderboard-podium-person">
        <div className="leaderboard-podium-avatar-wrap" aria-hidden="true">
          <span className="leaderboard-podium-avatar">{initials(featured.codeName)}</span>
          <span className="leaderboard-podium-rank-badge">#{group.rank}</span>
        </div>
        <strong>{featured.codeName}</strong>
        {group.entries.length > 1 && (
          <div className="leaderboard-podium-co-rankers" aria-label={`Also ranked number ${group.rank}`}>
            {group.entries.slice(1).map((entry) => (
              <span key={`${group.rank}-${entry.codeName}`}>{entry.codeName}</span>
            ))}
          </div>
        )}
      </div>
      <div className="leaderboard-podium-block" aria-label={`Rank ${group.rank}, score ${group.score} out of ${totalScore}`}>
        <span className="leaderboard-podium-block-score"><strong>{formatScore(group.score)}</strong><small>/ {formatScore(totalScore)}</small></span>
      </div>
    </div>
  );
}

function LeaderboardCard({ board, index, totalBoards }: { board: ShowcaseBoard; index: number; totalBoards: number }) {
  const groups = groupRanks(board.top || []);
  const podium = new Map(groups.filter((group) => group.rank <= 3).map((group) => [group.rank, group]));
  const runners = groups.filter((group) => group.rank === 4 || group.rank === 5);

  return (
    <article className="leaderboard-ad-card leaderboard-podium-card leaderboard-swipe-card">
      <div className="leaderboard-ad-topline">
        <span className="leaderboard-ad-date">{formatDate(board.date)}</span>
        <div className="leaderboard-ad-count"><strong>{index + 1}</strong><span>/ {totalBoards}</span></div>
      </div>

      <div className="leaderboard-ad-title-row">
        <div className="leaderboard-ad-title">
          <h3>{board.title}</h3>
          <p>{board.subjectName}{board.doctorName ? ` · ${board.doctorName}` : ""}</p>
        </div>
        <div className="leaderboard-ad-max"><span>Max score</span><strong>{formatScore(board.totalScore)}</strong></div>
      </div>

      <div className="leaderboard-real-podium" aria-label="Top three score positions">
        <PodiumGroup group={podium.get(2)} totalScore={board.totalScore} />
        <PodiumGroup group={podium.get(1)} totalScore={board.totalScore} />
        <PodiumGroup group={podium.get(3)} totalScore={board.totalScore} />
      </div>

      {runners.length > 0 && (
        <div className="leaderboard-tied-runners">
          {runners.map((group) => (
            <div className={`leaderboard-rank-group rank-${group.rank}`} key={`${board.id}-rank-${group.rank}`}>
              <span className="leaderboard-rank-group-number">#{group.rank}</span>
              <div className="leaderboard-rank-group-names">
                {group.entries.map((entry) => (
                  <strong key={`${group.rank}-${entry.codeName}`}>{entry.codeName}</strong>
                ))}
              </div>
              <span className="leaderboard-rank-group-score">{formatScore(group.score)} / {formatScore(board.totalScore)}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export function Leaderboard() {
  const [boards, setBoards] = useState<ShowcaseBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const gestureRef = useRef<GestureState>({ pointerId: null, startX: 0, startY: 0, latestX: 0, latestY: 0, moved: false });

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    async function load() {
      setLoading(true);
      setFailed(false);
      try {
        const response = await fetch("/api/student/leaderboard", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => ({}))) as Payload;
        if (!response.ok) throw new Error(payload.error || "Unable to load leaderboard");
        if (!mounted) return;
        setBoards(Array.isArray(payload.boards) ? payload.boards : []);
        setActiveIndex(0);
        setCycle((value) => value + 1);
      } catch (error) {
        if (!mounted || controller.signal.aborted) return;
        console.error("leaderboard showcase failed", error);
        setBoards([]);
        setFailed(true);
      } finally {
        if (mounted && !controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (boards.length <= 1 || dragging) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((index) => (index + 1) % boards.length);
      setCycle((value) => value + 1);
    }, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, boards.length, cycle, dragging]);

  useEffect(() => {
    if (activeIndex >= boards.length && boards.length) setActiveIndex(0);
  }, [activeIndex, boards.length]);

  useEffect(() => {
    const slide = slideRefs.current[activeIndex];
    if (!slide) return;

    const updateHeight = () => setViewportHeight(slide.offsetHeight + 12);
    updateHeight();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateHeight) : null;
    observer?.observe(slide);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [activeIndex, boards]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateWidth = () => setViewportWidth(viewport.clientWidth);
    updateWidth();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateWidth) : null;
    observer?.observe(viewport);
    window.addEventListener("resize", updateWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [boards.length]);

  const activeBoard = boards[activeIndex] || null;

  const markerIndices = useMemo(() => {
    if (boards.length <= 12) return boards.map((_, index) => index);
    const start = Math.max(0, Math.min(activeIndex - 5, boards.length - 12));
    return Array.from({ length: 12 }, (_, offset) => start + offset);
  }, [activeIndex, boards]);

  function changeBoard(nextIndex: number) {
    if (!boards.length) return;
    const normalized = ((nextIndex % boards.length) + boards.length) % boards.length;
    setActiveIndex(normalized);
    setCycle((value) => value + 1);
    setDragX(0);
  }

  function resetGesture() {
    gestureRef.current = { pointerId: null, startX: 0, startY: 0, latestX: 0, latestY: 0, moved: false };
    setDragX(0);
    setDragging(false);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      latestX: event.clientX,
      latestY: event.clientY,
      moved: false,
    };
    setDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;

    gesture.latestX = event.clientX;
    gesture.latestY = event.clientY;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (!gesture.moved && Math.abs(dx) > 7 && Math.abs(dx) > Math.abs(dy)) {
      gesture.moved = true;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* no-op */ }
    }

    if (gesture.moved) {
      const width = viewportRef.current?.clientWidth || 320;
      const limited = Math.max(-width * 0.48, Math.min(width * 0.48, dx));
      setDragX(limited);
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;

    const dx = event.clientX - gesture.startX;
    const width = viewportRef.current?.clientWidth || 320;
    const threshold = Math.min(92, Math.max(48, width * 0.14));

    if (gesture.moved && Math.abs(dx) >= threshold && boards.length > 1) {
      changeBoard(activeIndex + (dx < 0 ? 1 : -1));
    }

    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* no-op */ }
    resetGesture();
  }

  function handleCarouselKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (boards.length <= 1) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      changeBoard(activeIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      changeBoard(activeIndex - 1);
    }
  }

  const viewportStyle: CSSProperties | undefined = viewportHeight ? { height: viewportHeight } : undefined;

  return (
    <section className="leaderboard-section leaderboard-showcase section-gap">
      <div className="leaderboard-showcase-heading">
        <h2>Celebrate the top scorers</h2>
        <p>Congratulations to the students leading each assessment.</p>
      </div>

      {loading ? (
        <div className="leaderboard-ad-loading" aria-label="Loading assessment leaderboards">
          <div className="leaderboard-ad-loading-head"><span /><span /></div>
          <div className="leaderboard-ad-loading-podium"><span /><span /><span /></div>
          <div className="leaderboard-ad-loading-row"><span /><span /></div>
        </div>
      ) : failed ? (
        <div className="leaderboard-empty leaderboard-showcase-empty"><strong>Leaderboard unavailable</strong><span>Refresh the page to try again.</span></div>
      ) : !boards.length ? (
        <div className="leaderboard-empty leaderboard-showcase-empty"><strong>No rankings available yet</strong><span>Top scorers will appear when eligible assessment scores are ready.</span></div>
      ) : activeBoard ? (
        <div className="leaderboard-ad-carousel" aria-live="polite">
          <div
            ref={viewportRef}
            className={`leaderboard-swipe-viewport leaderboard-deck-viewport${dragging ? " is-dragging" : ""}`}
            style={viewportStyle}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={resetGesture}
            onKeyDown={handleCarouselKeyDown}
            role="region"
            aria-roledescription="carousel"
            tabIndex={0}
            aria-label={`Assessment leaderboard ${activeIndex + 1} of ${boards.length}. Swipe or use the arrow keys to change assessment.`}
          >
            {boards.map((board, index) => {
              const relative = relativePosition(index, activeIndex, boards.length);
              const distance = Math.abs(relative);
              const isActive = relative === 0;
              const isNeighbor = distance === 1;
              const isFar = distance > 1;

              const stepPixels = Math.max(1, viewportWidth * (CARD_STEP_PERCENT / 100));
              const liveRelative = relative + dragX / stepPixels;
              const liveDistance = Math.abs(liveRelative);
              const nearDistance = Math.min(1, liveDistance);
              const overflowDistance = Math.max(0, liveDistance - 1);
              const scale = Math.max(0.76, 1 - nearDistance * 0.17 - overflowDistance * 0.06);
              const blur = Math.min(5.5, nearDistance * 3.2 + overflowDistance * 2.2);
              const saturation = Math.max(0.62, 1 - nearDistance * 0.27 - overflowDistance * 0.08);
              const brightness = Math.max(0.84, 1 - nearDistance * 0.08 - overflowDistance * 0.03);
              const opacity = Math.max(0, 1 - nearDistance * 0.62 - overflowDistance * 0.72);
              const lift = Math.min(13, liveDistance * 10);
              const tilt = Math.max(-3.2, Math.min(3.2, liveRelative * -2.6));
              const focus = Math.max(0, 1 - nearDistance);
              const slideStyle = {
                left: `calc(50% + ${relative * CARD_STEP_PERCENT}% + ${dragX}px)`,
                transform: `translateX(-50%) translateY(${lift}px) scale(${scale}) rotateY(${tilt}deg)`,
                opacity,
                filter: `blur(${blur}px) saturate(${saturation}) brightness(${brightness})`,
                zIndex: Math.max(0, 10 - Math.round(liveDistance * 5)),
                "--deck-focus": focus,
              } as CSSProperties;

              return (
                <div
                  className={`leaderboard-swipe-slide leaderboard-deck-slide${isActive ? " is-active" : ""}${isNeighbor ? " is-neighbor" : ""}${isFar ? " is-far" : ""}`}
                  key={board.id}
                  ref={(element) => { slideRefs.current[index] = element; }}
                  style={slideStyle}
                  aria-hidden={!isActive}
                >
                  <LeaderboardCard board={board} index={index} totalBoards={boards.length} />
                </div>
              );
            })}
          </div>

          {boards.length > 1 && (
            <div className="leaderboard-ad-timeline" aria-hidden="true">
              <div className="leaderboard-ad-progress" key={`progress-${activeBoard.id}-${cycle}`} />
            </div>
          )}

          {boards.length > 1 && (
            <div className="leaderboard-ad-markers leaderboard-swipe-markers" aria-label={`${boards.length} assessment leaderboards in rotation`}>
              {markerIndices.map((index) => (
                <button
                  type="button"
                  className={index === activeIndex ? "active" : ""}
                  key={boards[index].id}
                  aria-label={`Show ${boards[index].title}`}
                  aria-current={index === activeIndex ? "true" : undefined}
                  onClick={() => changeBoard(index)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
