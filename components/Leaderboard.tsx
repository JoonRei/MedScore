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
const TRANSITION_MS = 300;

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
  const [phase, setPhase] = useState<"idle" | "exit">("idle");
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [pendingDirection, setPendingDirection] = useState<1 | -1>(1);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
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
    if (boards.length <= 1 || dragging || phase !== "idle") return;
    const timer = window.setTimeout(() => {
      void animateTo(activeIndex + 1, 1);
    }, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, boards.length, cycle, dragging, phase]);

  useEffect(() => {
    if (activeIndex >= boards.length && boards.length) setActiveIndex(0);
  }, [activeIndex, boards.length]);

  useEffect(() => () => {
    if (transitionTimerRef.current) window.clearTimeout(transitionTimerRef.current);
  }, []);

  const activeBoard = boards[activeIndex] || null;

  const markerIndices = useMemo(() => {
    if (boards.length <= 12) return boards.map((_, index) => index);
    const start = Math.max(0, Math.min(activeIndex - 5, boards.length - 12));
    return Array.from({ length: 12 }, (_, offset) => start + offset);
  }, [activeIndex, boards]);

  function normalizedIndex(index: number) {
    if (!boards.length) return 0;
    return ((index % boards.length) + boards.length) % boards.length;
  }

  function clearTransitionTimer() {
    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }

  function animateTo(nextIndex: number, direction: 1 | -1) {
    if (!boards.length || phase !== "idle") return;
    const normalized = normalizedIndex(nextIndex);
    if (normalized === activeIndex && boards.length > 1) return;

    const width = viewportRef.current?.clientWidth || 360;
    clearTransitionTimer();
    setPendingIndex(normalized);
    setPendingDirection(direction);
    setPhase("exit");
    setDragging(false);
    setDragX(direction > 0 ? -width * 0.56 : width * 0.56);

    transitionTimerRef.current = window.setTimeout(() => {
      // The preview underneath has already reached the exact final visual state.
      // Swap it into the active slot in the same React commit: no second enter
      // animation, opacity reset, or one-frame flash.
      setActiveIndex(normalized);
      setCycle((value) => value + 1);
      setDragX(0);
      setPendingIndex(null);
      setPhase("idle");
      transitionTimerRef.current = null;
    }, TRANSITION_MS);
  }

  function resetGesture() {
    gestureRef.current = { pointerId: null, startX: 0, startY: 0, latestX: 0, latestY: 0, moved: false };
    setDragX(0);
    setDragging(false);
    if (phase === "idle") setPendingIndex(null);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (phase !== "idle") return;
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
    if (gesture.pointerId !== event.pointerId || phase !== "idle") return;

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
      const limited = Math.max(-width * 0.42, Math.min(width * 0.42, dx));
      setDragX(limited);
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId || phase !== "idle") return;

    const dx = event.clientX - gesture.startX;
    const width = viewportRef.current?.clientWidth || 320;
    const threshold = Math.min(92, Math.max(48, width * 0.14));

    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* no-op */ }

    if (gesture.moved && Math.abs(dx) >= threshold && boards.length > 1) {
      gestureRef.current = { pointerId: null, startX: 0, startY: 0, latestX: 0, latestY: 0, moved: false };
      setDragging(false);
      animateTo(activeIndex + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      return;
    }

    resetGesture();
  }

  function handleCarouselKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (boards.length <= 1 || phase !== "idle") return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      animateTo(activeIndex + 1, 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      animateTo(activeIndex - 1, -1);
    }
  }

  const width = viewportRef.current?.clientWidth || 360;
  const dragProgress = Math.min(1, Math.abs(dragX) / Math.max(1, width * 0.42));
  const dragScale = 1 - dragProgress * 0.035;
  const dragOpacity = 1 - dragProgress * 0.14;
  const dragDirection: 1 | -1 = dragX < 0 ? 1 : -1;
  const previewIndex = boards.length > 1 && Math.abs(dragX) > 2
    ? normalizedIndex(activeIndex + dragDirection)
    : pendingIndex;
  const previewBoard = previewIndex !== null && previewIndex !== activeIndex ? boards[previewIndex] : null;
  const previewDirection = pendingIndex !== null ? pendingDirection : dragDirection;
  const previewProgress = phase === "exit" ? 1 : dragProgress;
  const previewStyle = {
    transform: `translate3d(${previewDirection > 0 ? (1 - previewProgress) * 3.5 : -(1 - previewProgress) * 3.5}%, 0, 0) scale(${0.99 + previewProgress * 0.01})`,
    opacity: phase === "exit" ? 1 : Math.min(0.96, 0.18 + previewProgress * 0.78),
  } as CSSProperties;
  const cardStyle = {
    transform: `translate3d(${dragX}px, 0, 0) scale(${phase === "exit" ? 0.975 : dragScale})`,
    opacity: phase === "exit" ? 0.10 : dragOpacity,
  } as CSSProperties;

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
            className={`leaderboard-swipe-viewport leaderboard-single-viewport${dragging ? " is-dragging" : ""}${phase === "exit" ? " is-exiting" : ""}`}
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
            {previewBoard && (dragging || phase === "exit") && (
              <div
                className="leaderboard-single-underlay"
                style={previewStyle}
                aria-hidden="true"
              >
                <LeaderboardCard board={previewBoard} index={previewIndex ?? 0} totalBoards={boards.length} />
              </div>
            )}
            <div
              className="leaderboard-single-slide"
              style={cardStyle}
            >
              <LeaderboardCard board={activeBoard} index={activeIndex} totalBoards={boards.length} />
            </div>
          </div>

          {boards.length > 1 && (
            <div className="leaderboard-ad-markers leaderboard-swipe-markers" aria-label={`${boards.length} assessment leaderboards in rotation`}>
              {markerIndices.map((index) => (
                <button
                  type="button"
                  className={index === activeIndex ? "active" : ""}
                  key={boards[index].id}
                  aria-label={`Show ${boards[index].title}`}
                  aria-current={index === activeIndex ? "true" : undefined}
                  onClick={() => {
                    if (index === activeIndex || phase !== "idle") return;
                    const directDistance = index - activeIndex;
                    const wrappedDistance = directDistance > 0 ? directDistance - boards.length : directDistance + boards.length;
                    const direction: 1 | -1 = Math.abs(directDistance) <= Math.abs(wrappedDistance)
                      ? (directDistance > 0 ? 1 : -1)
                      : (wrappedDistance > 0 ? 1 : -1);
                    animateTo(index, direction);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
