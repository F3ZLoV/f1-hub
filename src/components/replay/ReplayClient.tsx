"use client";

import { useEffect, useMemo, useState } from "react";
import ReplayViewer from "./ReplayViewer";
import { useReplayData } from "./useReplayData";

type Meeting = {
  meeting_key: number;
  meeting_name: string;
  country_name: string;
  circuit_short_name: string;
  date_start: string;
  year: number;
};
type SessionItem = {
  session_key: number;
  meeting_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
};

const FIRST_YEAR = 2023; // OpenF1 제공 시작
const WINDOWS = [
  { label: "5분", v: 300 },
  { label: "10분", v: 600 },
  { label: "20분", v: 1200 },
];

export default function ReplayClient() {
  const thisYear = new Date().getFullYear();
  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = thisYear; y >= FIRST_YEAR; y--) arr.push(y);
    return arr;
  }, [thisYear]);

  const [year, setYear] = useState(thisYear);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingKey, setMeetingKey] = useState<number | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [sessionKey, setSessionKey] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loadingM, setLoadingM] = useState(true);
  const [loadingS, setLoadingS] = useState(false);

  // 재생 범위
  const [full, setFull] = useState(false);
  const [startMin, setStartMin] = useState(0);
  const [win, setWin] = useState(600);

  // 풀레이스는 데이터가 많으므로 샘플링을 낮춰 전송량을 줄인다
  const hz = full ? 1 : 2;

  const { data, error, loading, loadedSec, totalSec } = useReplayData(sessionKey, {
    mode: full ? "full" : "window",
    start: full ? 0 : startMin * 60,
    dur: win,
    hz,
  });

  // 연도 → 그랑프리
  useEffect(() => {
    let cancelled = false;
    setLoadingM(true);
    setErr(null);
    setSessions([]);
    setSessionKey(null);
    (async () => {
      try {
        const res = await fetch(`/api/sessions?year=${year}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
        const list: Meeting[] = body.meetings ?? [];
        setMeetings(list);
        setMeetingKey(list.length ? list[0].meeting_key : null);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "그랑프리 목록 조회 실패");
          setMeetings([]);
          setMeetingKey(null);
        }
      } finally {
        if (!cancelled) setLoadingM(false);
      }
    })();
    return () => { cancelled = true; };
  }, [year]);

  // 그랑프리 → 세션
  useEffect(() => {
    if (!meetingKey) return;
    let cancelled = false;
    setLoadingS(true);
    (async () => {
      try {
        const res = await fetch(`/api/sessions?meeting_key=${meetingKey}`);
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
        const list: SessionItem[] = body.sessions ?? [];
        setSessions(list);
        const race = list.find((s) => s.session_type === "Race") ?? list[list.length - 1];
        setSessionKey(race ? race.session_key : null);
        setStartMin(0);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "세션 조회 실패");
          setSessions([]);
          setSessionKey(null);
        }
      } finally {
        if (!cancelled) setLoadingS(false);
      }
    })();
    return () => { cancelled = true; };
  }, [meetingKey]);

  const meeting = meetings.find((m) => m.meeting_key === meetingKey);
  const session = sessions.find((s) => s.session_key === sessionKey);

  return (
    <div className="wrap">
      {/* 시즌 */}
      <div className="years">
        {years.map((y) => (
          <button
            key={y}
            className={`year mono ${y === year ? "on" : ""}`}
            onClick={() => setYear(y)}
          >
            {y}
          </button>
        ))}
        <span className="year-note mono">
          {loadingM ? "불러오는 중…" : `${meetings.length} GP`} · 2021—22는 OpenF1 미제공
        </span>
      </div>

      {/* 선택 */}
      <div className="card picker">
        <label className="field">
          <span className="eyebrow">GRAND PRIX</span>
          <select
            value={meetingKey ?? ""}
            onChange={(e) => setMeetingKey(Number(e.target.value))}
            disabled={loadingM || !meetings.length}
          >
            {loadingM && <option>불러오는 중…</option>}
            {!loadingM && !meetings.length && <option>그랑프리 없음</option>}
            {meetings.map((m) => (
              <option key={m.meeting_key} value={m.meeting_key}>
                {m.date_start.slice(5, 10)} · {m.country_name} — {m.circuit_short_name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="eyebrow">SESSION</span>
          <select
            value={sessionKey ?? ""}
            onChange={(e) => { setSessionKey(Number(e.target.value)); setStartMin(0); }}
            disabled={loadingS || !sessions.length}
          >
            {loadingS && <option>불러오는 중…</option>}
            {!loadingS && !sessions.length && <option>세션 없음</option>}
            {sessions.map((s) => (
              <option key={s.session_key} value={s.session_key}>
                {s.session_name}
              </option>
            ))}
          </select>
        </label>

        <div className="field short">
          <span className="eyebrow">RANGE</span>
          <div className="modes">
            <button
              className={`mode mono ${!full ? "on" : ""}`}
              onClick={() => setFull(false)}
            >
              구간
            </button>
            <button
              className={`mode mono ${full ? "on" : ""}`}
              onClick={() => setFull(true)}
            >
              풀 세션
            </button>
          </div>
        </div>

        {!full && (
          <>
            <label className="field short">
              <span className="eyebrow">START (MIN)</span>
              <input
                type="number" min={0} max={180} step={1}
                value={startMin}
                onChange={(e) => setStartMin(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
            <div className="field short">
              <span className="eyebrow">LENGTH</span>
              <div className="modes">
                {WINDOWS.map((w) => (
                  <button
                    key={w.v}
                    className={`mode mono ${win === w.v ? "on" : ""}`}
                    onClick={() => setWin(w.v)}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {err && <div className="card msg">{err}</div>}

      {sessionKey ? (
        <ReplayViewer
          data={data}
          loading={loading}
          error={error}
          loadedSec={loadedSec}
          totalSec={totalSec}
        />
      ) : (
        !loadingM && !loadingS && !err && <div className="card msg">세션을 선택하세요.</div>
      )}

      {meeting && session && (
        <p className="ctx mono">
          {meeting.year} {meeting.country_name} · {meeting.circuit_short_name} ·{" "}
          {session.session_name} ·{" "}
          {full
            ? `풀 세션 (${hz}Hz, 5분 청크 점진 로딩)`
            : `+${startMin}분부터 ${win / 60}분 (${hz}Hz)`}
        </p>
      )}

      <style>{`
        .wrap { display: flex; flex-direction: column; gap: 10px; }

        .years { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .year {
          padding: 6px 14px; font-size: 13px;
          background: var(--surface); border: 1px solid var(--line);
          color: var(--muted); cursor: pointer; clip-path: var(--clip-sm);
        }
        .year:hover { color: var(--text); }
        .year.on { color: #fff; background: var(--f1-red); border-color: var(--f1-red); }
        .year-note { font-size: 10px; color: var(--dim); margin-left: 6px; }

        .picker { display: flex; gap: 16px; align-items: flex-end; padding: 14px 18px; flex-wrap: wrap; }
        .field { display: flex; flex-direction: column; gap: 7px; flex: 1; min-width: 190px; }
        .field.short { flex: 0 0 auto; min-width: 0; }
        select, input[type="number"] {
          background: var(--surface-2); color: var(--text);
          border: 1px solid var(--line); padding: 8px 10px;
          font-family: var(--font-mono); font-size: 12px;
          clip-path: var(--clip-sm); outline: none;
        }
        select:focus, input:focus { border-color: var(--f1-red); }
        input[type="number"] { width: 92px; }

        .modes { display: flex; gap: 4px; }
        .mode {
          background: var(--surface-2); color: var(--muted);
          border: 1px solid var(--line); font-size: 11px;
          padding: 7px 11px; cursor: pointer; clip-path: var(--clip-sm);
        }
        .mode:hover { color: var(--text); }
        .mode.on { color: #fff; background: var(--f1-red); border-color: var(--f1-red); }

        .msg { padding: 28px; text-align: center; color: var(--muted); font-size: 13px; }
        .ctx { font-size: 10px; color: var(--dim); letter-spacing: 0.04em; }

        @media (max-width: 768px) {
          .picker { gap: 12px; }
          .field { min-width: 100%; }
        }
      `}</style>
    </div>
  );
}
