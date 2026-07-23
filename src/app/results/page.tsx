"use client";

import { useEffect, useState } from "react";
import { getSeasonWinners, getRoundResults, type RaceWithResults } from "@/lib/f1api";
import { teamColor } from "@/lib/teams";
import Flag from "@/components/Flag";

const FIRST_SEASON = 2021;

export default function ResultsPage() {
  const thisYear = new Date().getFullYear();
  const seasons: number[] = [];
  for (let y = thisYear; y >= FIRST_SEASON; y--) seasons.push(y);

  const [season, setSeason] = useState(thisYear);
  const [races, setRaces] = useState<RaceWithResults[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [openRound, setOpenRound] = useState<string | null>(null);
  // 라운드별 전체 순위 캐시 (펼친 것만 불러온다)
  const [details, setDetails] = useState<Record<string, RaceWithResults>>({});
  const [loadingRound, setLoadingRound] = useState<string | null>(null);

  // 시즌 목록 (우승자만)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setDetails({});
    setOpenRound(null);
    getSeasonWinners(season)
      .then((list) => {
        if (cancelled) return;
        setRaces([...list].reverse()); // 최신 라운드가 위로
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "결과 조회 실패");
        setRaces([]);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [season]);

  const toggle = async (round: string) => {
    if (openRound === round) { setOpenRound(null); return; }
    setOpenRound(round);
    if (details[round]) return;           // 이미 받아둔 라운드
    setLoadingRound(round);
    try {
      const full = await getRoundResults(season, round);
      if (full) setDetails((d) => ({ ...d, [round]: full }));
    } catch {
      /* 실패해도 목록은 유지 */
    } finally {
      setLoadingRound(null);
    }
  };

  return (
    <div>
      <header className="page-head">
        <div className="eyebrow">RACE RESULTS · {FIRST_SEASON}—{thisYear}</div>
        <h1 className="page-title">Results</h1>
      </header>

      <div className="season-tabs">
        {seasons.map((y) => (
          <button
            key={y}
            className={`season-tab mono ${y === season ? "active" : ""}`}
            onClick={() => setSeason(y)}
          >
            {y}
          </button>
        ))}
      </div>

      {loading && <div className="empty card">불러오는 중…</div>}
      {err && <div className="empty card">{err}</div>}
      {!loading && !err && races.length === 0 && (
        <div className="empty card">{season} 시즌 결과가 아직 없습니다.</div>
      )}

      <div className="races">
        {races.map((r) => {
          const open = openRound === r.round;
          const winner = r.Results?.[0];
          const full = details[r.round];
          return (
            <div key={r.round} className="race card">
              <button className="race-bar" onClick={() => toggle(r.round)}>
                <span className="rb-round display">R{r.round}</span>
                <span className="rb-flag"><Flag country={r.Circuit.Location.country} size={20} /></span>
                <span className="rb-name">{r.raceName}</span>
                {winner && (
                  <span className="rb-winner mono">
                    <span
                      className="rb-stripe"
                      style={{ background: teamColor(winner.Constructor.constructorId) }}
                    />
                    {winner.Driver.familyName}
                  </span>
                )}
                <span className="rb-toggle">{open ? "−" : "+"}</span>
              </button>

              {open && (
                <div className="result-table">
                  {loadingRound === r.round && <div className="rt-loading mono">불러오는 중…</div>}
                  {full && (
                    <>
                      <div className="rt-head mono">
                        <span>POS</span><span>DRIVER</span><span>TEAM</span>
                        <span className="r">GRID</span><span className="r">PTS</span>
                      </div>
                      {full.Results.map((res) => (
                        <div key={res.position} className="rt-row">
                          <span className="rt-pos display">{res.position}</span>
                          <span className="rt-driver">
                            <Flag country={res.Driver.nationality} size={16} /> {res.Driver.givenName}{" "}
                            <strong>{res.Driver.familyName}</strong>
                          </span>
                          <span className="rt-team">
                            <span
                              className="rt-stripe"
                              style={{ background: teamColor(res.Constructor.constructorId) }}
                            />
                            {res.Constructor.name}
                          </span>
                          <span className="rt-grid mono r">{res.grid}</span>
                          <span className="rt-pts display r">{res.points}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .season-tabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 20px; }
        .season-tab {
          padding: 7px 14px; font-size: 13px;
          background: var(--surface); border: 1px solid var(--line);
          color: var(--muted); cursor: pointer; clip-path: var(--clip-sm);
          transition: color .15s, border-color .15s;
        }
        .season-tab:hover { color: var(--text); }
        .season-tab.active { color: #fff; border-color: var(--f1-red); background: var(--f1-red); }

        .empty { padding: 40px; text-align: center; color: var(--muted); font-size: 13px; }

        .races { display: flex; flex-direction: column; gap: 8px; }
        .race { overflow: hidden; }
        .race-bar {
          width: 100%; display: grid;
          grid-template-columns: 56px 32px 1fr auto 28px;
          align-items: center; gap: 16px; padding: 14px 20px;
          background: transparent; border: none; cursor: pointer;
          color: var(--text); text-align: left;
        }
        .race-bar:hover { background: var(--surface-2); }
        .rb-round { font-size: 15px; color: var(--muted); }
        .rb-name { font-size: 15px; font-weight: 600; }
        .rb-winner { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
        .rb-stripe { width: 3px; height: 16px; }
        .rb-toggle { font-family: var(--font-mono); font-size: 18px; color: var(--muted); text-align: center; }

        .result-table { border-top: 1px solid var(--line); padding: 8px 20px 16px; }
        .rt-loading { padding: 16px 0; font-size: 12px; color: var(--muted); }
        .rt-head {
          display: grid; grid-template-columns: 44px 1fr 180px 56px 56px;
          gap: 14px; padding: 10px 0; font-size: 10px;
          letter-spacing: 0.1em; color: var(--dim);
        }
        .rt-head .r, .rt-grid.r, .rt-pts.r { text-align: right; }
        .rt-row {
          display: grid; grid-template-columns: 44px 1fr 180px 56px 56px;
          gap: 14px; align-items: center; padding: 8px 0;
          border-bottom: 1px solid var(--line); font-size: 14px;
        }
        .rt-row:last-child { border-bottom: none; }
        .rt-pos { font-size: 15px; color: var(--muted); }
        .rt-driver strong { font-weight: 700; }
        .rt-team { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .rt-stripe { width: 3px; height: 16px; flex-shrink: 0; }
        .rt-grid { color: var(--muted); }

        @media (max-width: 900px) {
          .race-bar { grid-template-columns: 44px 28px 1fr 28px; }
          .rb-winner { display: none; }
          .rt-head, .rt-row { grid-template-columns: 36px 1fr 50px; }
          .rt-team, .rt-grid { display: none; }
        }
      `}</style>
    </div>
  );
}