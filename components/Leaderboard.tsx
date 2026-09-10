"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, TransitionEvent as ReactTransitionEvent } from "react";
import { formatDate } from "@/lib/utils";

type Entry = { studentId: string; codeName: string; score: number; rank: number; isCurrent: boolean };
type ShowcaseBoard = {
  id: string;
  title: string;
  type: string;
  totalScore: number;
  date: string;
  doctorName: string | null;
  releasedAt?: string | null;
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


function formatMonthYear(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric" }).format(date);
}

function PodiumGroup({ group, totalScore }: { group?: RankGroup; totalScore: number }) {
  if (!group) return <div className="leaderboard-v441-podium-slot is-empty" aria-hidden="true" />;

  const visibleAvatars = group.entries.slice(0, 3);
  const hasCurrentStudent = group.entries.some((entry) => entry.isCurrent);

  return (
    <div className={`leaderboard-v441-podium-slot leaderboard-v449-podium-slot leaderboard-v450-podium-slot rank-${group.rank}${hasCurrentStudent ? " is-you" : ""}`}>
      <div className="leaderboard-v441-person leaderboard-v449-person leaderboard-v450-person">
        <div className="leaderboard-v449-avatar-cluster leaderboard-v450-avatar-cluster" aria-hidden="true">
          {visibleAvatars.map((entry, avatarIndex) => (
            <span className={`leaderboard-v441-avatar leaderboard-v449-avatar leaderboard-v450-avatar avatar-${avatarIndex + 1}`} key={`${group.rank}-avatar-${entry.studentId}`}>
              {initials(entry.codeName)}
            </span>
          ))}
          {group.entries.length > visibleAvatars.length && (
            <span className="leaderboard-v449-avatar-more leaderboard-v450-avatar-more">+{group.entries.length - visibleAvatars.length}</span>
          )}
        </div>
        <div className="leaderboard-v441-podium-names leaderboard-v449-podium-names leaderboard-v450-podium-names">
          {group.entries.map((entry) => (
            <span className="leaderboard-v449-name-row leaderboard-v450-name-row" key={`${group.rank}-${entry.studentId}`}>
              <strong>{entry.codeName}</strong>
              {entry.isCurrent && <small>You</small>}
            </span>
          ))}
        </div>
        <span className="leaderboard-v441-person-score leaderboard-v449-person-score leaderboard-v450-person-score">{formatScore(group.score)} / {formatScore(totalScore)}</span>
      </div>
      <div className="leaderboard-v441-podium-block leaderboard-v449-podium-block leaderboard-v450-podium-block" aria-label={`Rank ${group.rank}`}>
        <span className="leaderboard-v450-podium-cap" aria-hidden="true" />
        <strong>{group.rank}</strong>
      </div>
    </div>
  );
}

function LeaderboardCard({ board, index, totalBoards }: { board: ShowcaseBoard; index: number; totalBoards: number }) {
  const groups = groupRanks(board.top || []);
  const podium = new Map(groups.filter((group) => group.rank <= 3).map((group) => [group.rank, group]));
  const runners = groups
    .filter((group) => group.rank >= 4 && group.rank <= 5)
    .flatMap((group) => group.entries.map((entry) => ({ rank: group.rank, score: group.score, entry })));
  const monthYear = formatMonthYear(board.releasedAt || board.date);

  return (
    <article className="leaderboard-ad-card leaderboard-podium-card leaderboard-swipe-card leaderboard-v441-card leaderboard-v442-card leaderboard-v449-card leaderboard-v450-card">
      <div className="leaderboard-v441-card-top">
        <span className="leaderboard-v441-subject">{board.subjectName}</span>
        <h3>{board.title}</h3>
        <p>{monthYear || formatDate(board.date)}{board.type ? ` · ${board.type}` : ""}</p>
        {totalBoards > 1 && (
          <div className="leaderboard-v441-count" aria-label={`Leaderboard ${index + 1} of ${totalBoards}`}>
            <strong>{index + 1}</strong><span>/ {totalBoards}</span>
          </div>
        )}
      </div>

      <div className="leaderboard-v441-podium leaderboard-v449-podium leaderboard-v450-podium" aria-label="Top three score positions">
        <PodiumGroup group={podium.get(2)} totalScore={board.totalScore} />
        <PodiumGroup group={podium.get(1)} totalScore={board.totalScore} />
        <PodiumGroup group={podium.get(3)} totalScore={board.totalScore} />
      </div>

      {runners.length > 0 && (
        <div className="leaderboard-v441-runner-list leaderboard-v449-runner-list leaderboard-v450-runner-list" aria-label="Other top rankings">
          {runners.map(({ rank, score, entry }, runnerIndex) => (
            <div className={`leaderboard-v441-runner leaderboard-v449-runner leaderboard-v450-runner${entry.isCurrent ? " is-you" : ""}`} key={`${board.id}-${rank}-${entry.studentId}`}>
              <span className="leaderboard-v441-runner-rank">{rank}</span>
              <span className="leaderboard-v441-runner-avatar" aria-hidden="true">{initials(entry.codeName)}</span>
              <div className="leaderboard-v441-runner-copy">
                <strong>{entry.codeName}</strong>
                <small>{entry.isCurrent ? "You" : `Rank ${rank}`}</small>
              </div>
              <div className="leaderboard-v441-runner-score"><strong>{formatScore(score)}</strong><small>/ {formatScore(board.totalScore)}</small></div>
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
    <section className="leaderboard-section leaderboard-showcase leaderboard-showcase-v441 leaderboard-showcase-v442 section-gap">
      <div className="leaderboard-showcase-heading leaderboard-showcase-heading-v441 leaderboard-showcase-heading-v442 leaderboard-showcase-heading-v443">
        <div className="leaderboard-v447-heading-copy">
          <h2>Leaderboard</h2>
          <p>Top scorers from your latest released assessments.</p>
        </div>
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
