"use client";

import { useEffect, useMemo, useState } from "react";
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

function initials(codeName: string) {
  const compact = codeName.replace(/[^A-Za-z0-9]/g, "");
  return (compact.slice(0, 2) || codeName.slice(0, 2) || "MS").toUpperCase();
}

const AUTO_ADVANCE_MS = 6500;

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
      </div>
      <div className="leaderboard-podium-block" aria-label={`Rank ${group.rank}, score ${group.score} out of ${totalScore}`}>
        <span className="leaderboard-podium-block-score"><strong>{group.score}</strong><small>/ {totalScore}</small></span>
      </div>
    </div>
  );
}

export function Leaderboard() {
  const [boards, setBoards] = useState<ShowcaseBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cycle, setCycle] = useState(0);

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
    if (boards.length <= 1) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((index) => (index + 1) % boards.length);
      setCycle((value) => value + 1);
    }, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, boards.length, cycle]);

  useEffect(() => {
    if (activeIndex >= boards.length && boards.length) setActiveIndex(0);
  }, [activeIndex, boards.length]);

  const activeBoard = boards[activeIndex] || null;
  const groups = useMemo(() => groupRanks(activeBoard?.top || []), [activeBoard]);
  const podium = useMemo(() => new Map(groups.filter((group) => group.rank <= 3).map((group) => [group.rank, group])), [groups]);
  const runners = useMemo(() => groups.filter((group) => group.rank === 4 || group.rank === 5), [groups]);

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
          <article className="leaderboard-ad-card leaderboard-podium-card" key={`${activeBoard.id}-${cycle}`}>
            <div className="leaderboard-ad-topline">
              <div className="leaderboard-ad-context">
                <span className="leaderboard-ad-type">{activeBoard.type}</span>
                <span className="leaderboard-ad-date">{formatDate(activeBoard.date)}</span>
              </div>
              <div className="leaderboard-ad-count"><strong>{activeIndex + 1}</strong><span>/ {boards.length}</span></div>
            </div>

            <div className="leaderboard-ad-title-row">
              <div className="leaderboard-ad-title">
                <h3>{activeBoard.title}</h3>
                <p>{activeBoard.subjectName}{activeBoard.doctorName ? ` · ${activeBoard.doctorName}` : ""}</p>
              </div>
              <div className="leaderboard-ad-max"><span>Max score</span><strong>{activeBoard.totalScore}</strong></div>
            </div>

            <div className="leaderboard-real-podium" aria-label="Top three score positions">
              <PodiumGroup group={podium.get(2)} totalScore={activeBoard.totalScore} />
              <PodiumGroup group={podium.get(1)} totalScore={activeBoard.totalScore} />
              <PodiumGroup group={podium.get(3)} totalScore={activeBoard.totalScore} />
            </div>

            {runners.length > 0 && (
              <div className="leaderboard-tied-runners">
                {runners.map((group) => {
                  const featured = group.entries[0];
                  return (
                    <div className={`leaderboard-rank-group rank-${group.rank}`} key={`${activeBoard.id}-rank-${group.rank}`}>
                      <span className="leaderboard-rank-group-number">#{group.rank}</span>
                      <div className="leaderboard-rank-group-names">
                        <strong>{featured.codeName}</strong>
                      </div>
                      <span className="leaderboard-rank-group-score">{group.score} / {activeBoard.totalScore}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          {boards.length > 1 && (
            <div className="leaderboard-ad-timeline" aria-hidden="true">
              <div className="leaderboard-ad-progress" key={`progress-${activeBoard.id}-${cycle}`} />
            </div>
          )}

          {boards.length > 1 && (
            <div className="leaderboard-ad-markers" aria-label={`${boards.length} assessment leaderboards in rotation`}>
              {boards.slice(0, 12).map((board, index) => <span className={index === activeIndex ? "active" : ""} key={board.id} />)}
              {boards.length > 12 && <small>+{boards.length - 12}</small>}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
