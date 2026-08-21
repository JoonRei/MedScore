"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, TransitionEvent as ReactTransitionEvent } from "react";
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
type SettleState = { mode: "advance" | "snapback"; direction: 1 | -1; targetIndex: number };

type GestureState = {
  pointerId: number | null;
  startX: number;
  startY: number;
  startedAt: number;
  moved: boolean;
};

const AUTO_ADVANCE_MS = 6500;
const TRANSITION_MS = 250;

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
        <div className="leaderboard-runner-stack-v419">
          {runners.map((group) => (
            <div className={`leaderboard-runner-row-v421 rank-${group.rank}`} key={`${board.id}-rank-${group.rank}`}>
              <div className="leaderboard-runner-rank-v421" aria-hidden="true"><strong>#{group.rank}</strong></div>
              <div className="leaderboard-runner-students-v421" aria-label={`Rank ${group.rank}`}>
                {group.entries.map((entry) => (
                  <div className="leaderboard-runner-student-v421" key={`${group.rank}-${entry.codeName}`}>
                    <span aria-hidden="true">{initials(entry.codeName)}</span>
                    <strong>{entry.codeName}</strong>
                  </div>
                ))}
              </div>
              <div className="leaderboard-runner-score-v421"><strong>{formatScore(group.score)}</strong><small>/ {formatScore(board.totalScore)}</small></div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="leaderboard-card-skeleton" role="status" aria-live="polite" aria-label="Loading leaderboard">
      <div className="leaderboard-skeleton-top">
        <span className="skeleton-block" />
        <span className="skeleton-block" />
      </div>
      <div className="leaderboard-skeleton-title-row">
        <div>
          <span className="skeleton-block" />
          <span className="skeleton-block" />
        </div>
        <span className="skeleton-block leaderboard-skeleton-max" />
      </div>
      <div className="leaderboard-skeleton-podium" aria-hidden="true">
        <div><span className="skeleton-block" /><span className="skeleton-block" /></div>
        <div className="is-first"><span className="skeleton-block" /><span className="skeleton-block" /></div>
        <div><span className="skeleton-block" /><span className="skeleton-block" /></div>
      </div>
      <div className="leaderboard-skeleton-bottom" aria-hidden="true">
        <span className="skeleton-block" />
        <span className="skeleton-block" />
      </div>
    </div>
  );
}

export function Leaderboard() {
  const [boards, setBoards] = useState<ShowcaseBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [direction, setDirection] = useState<1 | -1 | 0>(0);
  const [settle, setSettle] = useState<SettleState | null>(null);
  const [instantReset, setInstantReset] = useState(false);
  const [cycle, setCycle] = useState(0);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const settleRef = useRef<SettleState | null>(null);
  const gestureRef = useRef<GestureState>({ pointerId: null, startX: 0, startY: 0, startedAt: 0, moved: false });

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
        setDragX(0);
        setDirection(0);
        settleRef.current = null;
        setSettle(null);
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
      if (fallbackTimerRef.current) window.clearTimeout(fallbackTimerRef.current);
    };
  }, []);

  const markerIndices = useMemo(() => {
    if (boards.length <= 12) return boards.map((_, index) => index);
    const start = Math.max(0, Math.min(activeIndex - 5, boards.length - 12));
    return Array.from({ length: 12 }, (_, offset) => start + offset);
  }, [activeIndex, boards]);

  const previewIndex = settle?.mode === "advance"
    ? settle.targetIndex
    : direction === 0 || boards.length <= 1
      ? activeIndex
      : (activeIndex + direction + boards.length) % boards.length;

  const width = () => Math.max(280, viewportRef.current?.clientWidth || 320);
  const progress = Math.min(1, Math.abs(dragX) / width());

  useEffect(() => {
    if (boards.length <= 1 || dragging || settle) return;
    const timer = window.setTimeout(() => startAdvance(1), AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, boards.length, cycle, dragging, settle]);

  function clearFallback() {
    if (fallbackTimerRef.current) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }

  function completeSettle() {
    const currentSettle = settleRef.current;
    if (!currentSettle) return;
    clearFallback();

    if (currentSettle.mode === "advance") {
      setInstantReset(true);
      setActiveIndex(currentSettle.targetIndex);
      setCycle((value) => value + 1);
    }
    setDragX(0);
    setDirection(0);
    settleRef.current = null;
    setSettle(null);
    requestAnimationFrame(() => requestAnimationFrame(() => setInstantReset(false)));
  }

  function armFallback() {
    clearFallback();
    fallbackTimerRef.current = window.setTimeout(completeSettle, TRANSITION_MS + 90);
  }

  function startAdvance(nextDirection: 1 | -1, requestedIndex?: number) {
    if (boards.length <= 1 || dragging || settle) return;
    const targetIndex = requestedIndex ?? (activeIndex + nextDirection + boards.length) % boards.length;
    setDirection(nextDirection);
    const nextSettle: SettleState = { mode: "advance", direction: nextDirection, targetIndex };
    settleRef.current = nextSettle;
    setSettle(nextSettle);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setDragX(nextDirection === 1 ? -width() : width());
        armFallback();
      });
    });
  }

  function startSnapback() {
    if (direction === 0) {
      setDragging(false);
      setDragX(0);
      return;
    }
    setDragging(false);
    const nextSettle: SettleState = { mode: "snapback", direction, targetIndex: activeIndex };
    settleRef.current = nextSettle;
    setSettle(nextSettle);
    requestAnimationFrame(() => {
      setDragX(0);
      armFallback();
    });
  }

  function resetGesture() {
    gestureRef.current = { pointerId: null, startX: 0, startY: 0, startedAt: 0, moved: false };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (settle || boards.length <= 1) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      moved: false,
    };
    setDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId || settle) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    if (!gesture.moved && Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy) * 1.12) {
      gesture.moved = true;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* no-op */ }
    }
    if (!gesture.moved) return;

    const limit = width() * 0.72;
    const nextX = Math.max(-limit, Math.min(limit, dx));
    setDirection(nextX < 0 ? 1 : -1);
    setDragX(nextX);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId || settle) return;

    const dx = event.clientX - gesture.startX;
    const elapsed = Math.max(1, performance.now() - gesture.startedAt);
    const velocity = Math.abs(dx) / elapsed;
    const threshold = Math.min(76, Math.max(38, width() * 0.105));
    const shouldAdvance = gesture.moved && (Math.abs(dx) >= threshold || (Math.abs(dx) >= 18 && velocity >= 0.28));

    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* no-op */ }
    resetGesture();

    if (shouldAdvance) {
      const nextDirection: 1 | -1 = dx < 0 ? 1 : -1;
      const targetIndex = (activeIndex + nextDirection + boards.length) % boards.length;
      const nextSettle: SettleState = { mode: "advance", direction: nextDirection, targetIndex };
      setDirection(nextDirection);
      setDragging(false);
      settleRef.current = nextSettle;
      setSettle(nextSettle);
      requestAnimationFrame(() => {
        setDragX(nextDirection === 1 ? -width() : width());
        armFallback();
      });
      return;
    }

    startSnapback();
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (gesture.pointerId !== event.pointerId) return;
    resetGesture();
    startSnapback();
  }

  function handleTransitionEnd(event: ReactTransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "transform" || !settle) return;
    completeSettle();
  }

  function handleCarouselKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (boards.length <= 1 || dragging || settle) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      startAdvance(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      startAdvance(-1);
    }
  }

  function moveTo(index: number) {
    if (index === activeIndex || dragging || settle) return;
    const forward = (index - activeIndex + boards.length) % boards.length;
    const backward = (activeIndex - index + boards.length) % boards.length;
    startAdvance(forward <= backward ? 1 : -1, index);
  }

  const currentStyle = {
    transform: `translate3d(${dragX}px,0,0) scale(${1 - progress * 0.012})`,
    opacity: 1 - progress * 0.08,
    transition: dragging || instantReset ? "none" : undefined,
  } as CSSProperties;

  const incomingStyle = direction === 0 ? undefined : {
    transform: `translate3d(calc(${direction * 100}% + ${dragX}px),0,0) scale(${0.988 + progress * 0.012})`,
    opacity: 0.72 + progress * 0.28,
    transition: dragging || instantReset ? "none" : undefined,
  } as CSSProperties;

  return (
    <section className="leaderboard-section leaderboard-showcase section-gap">
      <div className="leaderboard-showcase-heading">
        <h2>Celebrate the top scorers</h2>
        <p>Congratulations to the students leading each assessment.</p>
      </div>

      {loading ? (
        <LeaderboardSkeleton />
      ) : failed ? (
        <div className="leaderboard-empty leaderboard-showcase-empty"><strong>Leaderboard unavailable</strong><span>Please try again in a moment.</span></div>
      ) : !boards.length ? (
        <div className="leaderboard-empty leaderboard-showcase-empty"><strong>No rankings available yet</strong><span>Top scorers will appear when eligible assessment scores are ready.</span></div>
      ) : (
        <div className="leaderboard-ad-carousel" aria-live="polite">
          <div
            ref={viewportRef}
            className={`leaderboard-swipe-viewport leaderboard-swipe-viewport-v418${dragging ? " is-dragging" : ""}${settle ? " is-settling" : ""}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onKeyDown={handleCarouselKeyDown}
            role="region"
            aria-roledescription="carousel"
            tabIndex={0}
            aria-label={`Assessment leaderboard ${activeIndex + 1} of ${boards.length}. Swipe or use the arrow keys to change assessment.`}
          >
            <div className="leaderboard-swipe-layer leaderboard-swipe-current" style={currentStyle} onTransitionEnd={handleTransitionEnd}>
              <LeaderboardCard board={boards[activeIndex]} index={activeIndex} totalBoards={boards.length} />
            </div>

            {direction !== 0 && boards.length > 1 && (
              <div className="leaderboard-swipe-layer leaderboard-swipe-incoming" style={incomingStyle} aria-hidden="true">
                <LeaderboardCard board={boards[previewIndex]} index={previewIndex} totalBoards={boards.length} />
              </div>
            )}
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
                  onClick={() => moveTo(index)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
