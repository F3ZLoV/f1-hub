"use client";

import { getSchedule, getNextRace, type Race } from "@/lib/f1api";
import Flag from "@/components/Flag";
import Countdown from "@/components/Countdown";
import SessionSchedule from "@/components/SessionSchedule";
import { weekendSessions, nextSession } from "@/lib/sessions";
import { useAsync } from "@/lib/useAsync";

function raceDateTime(r: Race): string {
  return `${r.date}T${r.time ?? "12:00:00Z"}`;
}
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export default function SchedulePage() {
  const season = new Date().getFullYear();
  const { data, loading } = useAsync(async () => {
    const [races, next] = await Promise.all([getSchedule(season), getNextRace(season)]);
    return { races, next };
  }, [season]);

  const races = data?.races ?? [];
  const next = data?.next ?? null;
  const now = new Date();
  const nextRound = next?.round;

  // 레이스가 아니라 '다음 세션' 기준 (연습주행·스프린트 포함)
  const sessions = next ? weekendSessions(next) : [];
  const ns = nextSession(sessions);

  return (
    <div>
      <header className="page-head">
        <div className="eyebrow">
          SEASON {season}{races.length ? ` · ${races.length} ROUNDS` : ""}
        </div>
        <h1 className="page-title">Race Calendar</h1>
      </header>

      {next && (
        <div className="card next-race">
          <div className="next-top">
            <div className="next-left">
              <div className="eyebrow">NEXT RACE · ROUND {next.round}</div>
              <h2 className="next-name display">
                <Flag country={next.Circuit.Location.country} size={22} /> {next.raceName}
              </h2>
              <div className="next-circuit mono">
                {next.Circuit.circuitName} · {next.Circuit.Location.locality}, {next.Circuit.Location.country}
              </div>
            </div>
            <div className="next-cd">
              <div className="eyebrow cd-label">
                {ns ? `NEXT · ${ns.label}` : "WEEKEND COMPLETE"}
              </div>
              <Countdown target={(ns?.start ?? new Date(raceDateTime(next))).toISOString()} />
            </div>
          </div>
          <div className="next-sched">
            <SessionSchedule race={next} />
          </div>
        </div>
      )}

      {loading && <div className="card msg">불러오는 중…</div>}

      <div className="schedule-list">
        {races.map((r) => {
          const past = new Date(raceDateTime(r)) < now;
          const isNext = r.round === nextRound;
          return (
            <div key={r.round} className={`card race-row ${past ? "past" : ""} ${isNext ? "is-next" : ""}`}>
              <div className="race-round display">R{r.round}</div>
              <div className="race-flag"><Flag country={r.Circuit.Location.country} size={24} /></div>
              <div className="race-info">
                <div className="race-name">{r.raceName}</div>
                <div className="race-loc mono">{r.Circuit.Location.locality}, {r.Circuit.Location.country}</div>
              </div>
              <div className="race-date mono">{fmtDate(raceDateTime(r))}</div>
              <span className={`race-status mono ${past ? "done" : isNext ? "next" : "up"}`}>
                {past ? "DONE" : isNext ? "NEXT" : "—"}
              </span>
            </div>
          );
        })}
      </div>

      <style>{`
        .msg { padding: 28px; text-align: center; color: var(--muted); font-size: 13px; margin-bottom: 12px; }
        .next-race {
          padding: 26px 30px; margin-bottom: 28px;
          background:
            radial-gradient(circle at 95% 0%, rgba(225,6,0,0.1), transparent 45%),
            var(--surface);
        }
        .next-name { font-size: 26px; text-transform: uppercase; margin: 8px 0 6px; }
        .next-circuit { font-size: 12px; color: var(--muted); }
        .next-top { display: flex; justify-content: space-between; align-items: center; gap: 24px; flex-wrap: wrap; }
        .next-cd { text-align: right; }
        .cd-label { margin-bottom: 10px; }
        .next-sched { margin-top: 22px; border-top: 1px solid var(--line); padding-top: 18px; }

        .schedule-list { display: flex; flex-direction: column; gap: 8px; }
        .race-row {
          display: grid; grid-template-columns: 54px 32px 1fr auto 60px;
          align-items: center; gap: 16px; padding: 13px 20px;
          transition: border-color .15s;
        }
        .race-row:hover { border-color: var(--dim); }
        .race-row.past { opacity: 0.45; }
        .race-row.is-next { border-color: var(--f1-red); }
        .race-round { font-size: 15px; color: var(--muted); }
        .race-name { font-size: 15px; font-weight: 600; }
        .race-loc { font-size: 11px; color: var(--muted); margin-top: 2px; }
        .race-date { font-size: 13px; text-align: right; }
        .race-status { font-size: 10px; letter-spacing: 0.08em; text-align: right; }
        .race-status.done { color: var(--dim); }
        .race-status.next { color: var(--f1-red); }
        .race-status.up { color: var(--dim); }

        @media (max-width: 768px) {
          .next-race { padding: 20px; }
          .next-cd { text-align: left; }
          .race-row { grid-template-columns: 44px 28px 1fr 50px; }
          .race-date { display: none; }
        }
      `}</style>
    </div>
  );
}
