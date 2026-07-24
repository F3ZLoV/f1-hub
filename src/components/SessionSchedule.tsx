"use client";

import { useEffect, useState } from "react";
import type { Race } from "@/lib/f1api";
import { weekendSessions, nextSession, type WeekendSession } from "@/lib/sessions";
import { circuitTimezone, userTimezone, tzLabel, formatIn } from "@/lib/circuitTz";

/** 남은 시간 문자열 */
function remain(ms: number): string {
  if (ms <= 0) return "—";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (d > 0) return `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function SessionSchedule({
  race,
  compact = false,
}: {
  race: Race;
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const sessions: WeekendSession[] = weekendSessions(race);
  if (!sessions.length) return null;

  const next = nextSession(sessions);
  const circuitTz = circuitTimezone(race.Circuit.circuitId) ?? "UTC";
  const userTz = userTimezone();
  const sameZone = circuitTz === userTz;

  const ref = next?.start ?? sessions[sessions.length - 1].start;

  return (
    <div className={`sched ${compact ? "compact" : ""}`}>
      <div className="tzbar mono">
        <span>
          <i className="dot local" />
          LOCAL {tzLabel(ref, userTz)}
        </span>
        {!sameZone && (
          <span>
            <i className="dot circuit" />
            TRACK {tzLabel(ref, circuitTz)}
          </span>
        )}
      </div>

      <div className="rows">
        {sessions.map((s) => {
          const ms = s.start.getTime() - now;
          const isNext = next?.key === s.key;
          const past = ms <= 0;
          return (
            <div key={s.key} className={`row ${isNext ? "next" : ""} ${past ? "past" : ""}`}>
              <span className="short mono">{s.short}</span>
              <span className="label">{s.label}</span>
              <span className="times mono">
                <b>{formatIn(s.start, userTz)}</b>
                {!sameZone && <i>{formatIn(s.start, circuitTz)}</i>}
              </span>
              <span className={`left mono ${isNext ? "hot" : ""}`}>
                {past ? "—" : remain(ms)}
              </span>
            </div>
          );
        })}
      </div>

      <style>{`
        .sched { display: flex; flex-direction: column; gap: 10px; }
        .tzbar {
          display: flex; gap: 16px; flex-wrap: wrap;
          font-size: 10px; letter-spacing: 0.08em; color: var(--muted);
        }
        .tzbar span { display: flex; align-items: center; gap: 6px; }
        .dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
        .dot.local { background: var(--f1-red); }
        .dot.circuit { background: var(--muted); }

        .rows { display: flex; flex-direction: column; }
        .row {
          display: grid;
          grid-template-columns: 42px 1fr auto 100px;
          gap: 12px; align-items: center;
          padding: 9px 0;
          border-bottom: 1px solid var(--line);
        }
        .row:last-child { border-bottom: none; }
        .row.past { opacity: 0.4; }
        .row.next { background: linear-gradient(90deg, rgba(225,6,0,0.08), transparent); }

        .short {
          font-size: 10px; letter-spacing: 0.06em; color: var(--muted);
          border: 1px solid var(--line); padding: 3px 0; text-align: center;
        }
        .row.next .short { color: #fff; background: var(--f1-red); border-color: var(--f1-red); }
        .label { font-size: 13px; }

        .times { text-align: right; display: flex; flex-direction: column; gap: 2px; }
        .times b { font-size: 12px; font-weight: 600; }
        .times i { font-size: 10px; color: var(--muted); font-style: normal; }

        .left { text-align: right; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
        .left.hot { color: var(--f1-red); font-weight: 600; }

        .compact .label { font-size: 12px; }
        .compact .row { padding: 7px 0; }

        @media (max-width: 640px) {
          .row { grid-template-columns: 38px 1fr auto; }
          .left { display: none; }
        }
      `}</style>
    </div>
  );
}
