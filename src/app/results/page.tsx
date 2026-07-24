"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getSeasonWinners,
  getRoundResults,
  getQualifying,
  type RaceWithResults,
  type RaceResult,
  type QualifyingResult,
} from "@/lib/f1api";
import Flag from "@/components/Flag";
import TeamLogo from "@/components/TeamLogo";

const FIRST_SEASON = 2021;
type Tab = "race" | "quali" | "grid";
const TABS: { id: Tab; label: string }[] = [
  { id: "quali", label: "QUALIFYING" },
  { id: "grid", label: "STARTING GRID" },
  { id: "race", label: "RACE" },
];

/** 예선 3세션 중 가장 빠른 기록 */
function bestQuali(q: QualifyingResult): string {
  return q.Q3 || q.Q2 || q.Q1 || "—";
}

export default function ResultsPage() {
  const thisYear = new Date().getFullYear();
  const seasons = useMemo(() => {
    const arr: number[] = [];
    for (let y = thisYear; y >= FIRST_SEASON; y--) arr.push(y);
    return arr;
  }, [thisYear]);

  const [season, setSeason] = useState(thisYear);
  const [races, setRaces] = useState<RaceWithResults[]>([]);
  const [round, setRound] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("race");

  const [results, setResults] = useState<RaceResult[]>([]);
  const [quali, setQuali] = useState<QualifyingResult[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingRound, setLoadingRound] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 시즌 → 레이스 목록 (선택기 + 우승자)
  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    setErr(null);
    setResults([]);
    setQuali([]);
    getSeasonWinners(season)
      .then((list) => {
        if (cancelled) return;
        const done = [...list].reverse(); // 최신 라운드가 위로
        setRaces(done);
        setRound(done[0]?.round ?? null);
        setLoadingList(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "시즌 조회 실패");
        setRaces([]);
        setRound(null);
        setLoadingList(false);
      });
    return () => { cancelled = true; };
  }, [season]);

  // 라운드 → 레이스 결과 + 예선
  useEffect(() => {
    if (!round) return;
    let cancelled = false;
    setLoadingRound(true);
    Promise.all([
      getRoundResults(season, round),
      getQualifying(season, round).catch(() => [] as QualifyingResult[]),
    ])
      .then(([race, q]) => {
        if (cancelled) return;
        setResults(race?.Results ?? []);
        setQuali(q);
        setLoadingRound(false);
      })
      .catch(() => {
        if (cancelled) return;
        setResults([]);
        setQuali([]);
        setLoadingRound(false);
      });
    return () => { cancelled = true; };
  }, [season, round]);

  const race = races.find((r) => r.round === round);
  const winner = results[0];
  const pole = quali[0];
  const fastest = results.find((r) => r.FastestLap?.rank === "1");

  // 스타팅 그리드 — 레이스 결과의 grid 필드로 정렬 (0 = 피트레인 스타트)
  const grid = useMemo(
    () =>
      [...results]
        .filter((r) => r.grid && r.grid !== "0")
        .sort((a, b) => Number(a.grid) - Number(b.grid)),
    [results]
  );

  return (
    <div>
      <header className="page-head">
        <div className="eyebrow">RACE RESULTS · {FIRST_SEASON}—{thisYear}</div>
        <h1 className="page-title">Results</h1>
      </header>

      {/* 시즌 · 그랑프리 선택 */}
      <div className="controls card">
        <div className="seasons">
          {seasons.map((y) => (
            <button
              key={y}
              className={`season mono ${y === season ? "on" : ""}`}
              onClick={() => setSeason(y)}
            >
              {y}
            </button>
          ))}
        </div>
        <label className="gp-field">
          <span className="eyebrow">GRAND PRIX</span>
          <select
            value={round ?? ""}
            onChange={(e) => setRound(e.target.value)}
            disabled={loadingList || !races.length}
          >
            {loadingList && <option>불러오는 중…</option>}
            {!loadingList && !races.length && <option>결과 없음</option>}
            {races.map((r) => (
              <option key={r.round} value={r.round}>
                R{r.round} · {r.raceName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {err && <div className="msg card">{err}</div>}

      {race && (
        <>
          {/* 요약 카드 */}
          <div className="summary">
            <div className="card sum">
              <div className="sum-head">
                <span className="eyebrow">RACE WINNER</span>
                <span className="sum-icon">🏆</span>
              </div>
              {winner ? (
                <>
                  <div className="sum-name display">
                    <TeamLogo
                      constructorId={winner.Constructor.constructorId}
                      name={winner.Constructor.name}
                      size={30}
                    />
                    {winner.Driver.familyName}
                  </div>
                  <div className="sum-sub mono">
                    {winner.Constructor.name} · {winner.Time?.time ?? winner.status}
                  </div>
                </>
              ) : (
                <div className="sum-empty mono">—</div>
              )}
            </div>

            <div className="card sum">
              <div className="sum-head">
                <span className="eyebrow">POLE POSITION</span>
                <span className="sum-icon">⏱</span>
              </div>
              {pole ? (
                <>
                  <div className="sum-name display">
                    <TeamLogo
                      constructorId={pole.Constructor.constructorId}
                      name={pole.Constructor.name}
                      size={30}
                    />
                    {pole.Driver.familyName}
                  </div>
                  <div className="sum-sub mono">
                    {pole.Constructor.name} · {bestQuali(pole)}
                  </div>
                </>
              ) : (
                <div className="sum-empty mono">예선 데이터 없음</div>
              )}
            </div>

            <div className="card sum">
              <div className="sum-head">
                <span className="eyebrow">FASTEST LAP</span>
                <span className="sum-icon">⚡</span>
              </div>
              {fastest ? (
                <>
                  <div className="sum-name display">
                    <TeamLogo
                      constructorId={fastest.Constructor.constructorId}
                      name={fastest.Constructor.name}
                      size={30}
                    />
                    {fastest.Driver.familyName}
                  </div>
                  <div className="sum-sub mono">
                    LAP {fastest.FastestLap?.lap} · {fastest.FastestLap?.Time?.time}
                  </div>
                </>
              ) : (
                <div className="sum-empty mono">기록 없음</div>
              )}
            </div>
          </div>

          {/* 세션 탭 */}
          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab mono ${tab === t.id ? "on" : ""}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
            <span className="tab-note mono">
              <Flag country={race.Circuit.Location.country} size={14} />{" "}
              {race.Circuit.circuitName} · {race.date}
            </span>
          </div>

          {loadingRound && <div className="msg card">불러오는 중…</div>}

          {/* RACE */}
          {!loadingRound && tab === "race" && (
            <div className="table card">
              <div className="thead mono">
                <span>POS</span><span>NO</span><span>DRIVER</span><span>TEAM</span>
                <span className="r">LAPS</span><span className="r">TIME / STATUS</span><span className="r">PTS</span>
              </div>
              {results.map((r) => (
                <div key={r.position} className="trow">
                  <span className="pos display">{r.position}</span>
                  <span className="num mono">{r.Driver.permanentNumber ?? "—"}</span>
                  <span className="drv">
                    <Flag country={r.Driver.nationality} size={15} />
                    <span className="given">{r.Driver.givenName}</span>
                    <strong>{r.Driver.familyName}</strong>
                  </span>
                  <span className="team">
                    <TeamLogo
                      constructorId={r.Constructor.constructorId}
                      name={r.Constructor.name}
                      size={22}
                    />
                    {r.Constructor.name}
                  </span>
                  <span className="r mono dim">{r.laps}</span>
                  <span className="r mono">{r.Time?.time ?? r.status}</span>
                  <span className="r display">{r.points}</span>
                </div>
              ))}
            </div>
          )}

          {/* QUALIFYING */}
          {!loadingRound && tab === "quali" && (
            quali.length ? (
              <div className="table card">
                <div className="thead mono">
                  <span>POS</span><span>NO</span><span>DRIVER</span><span>TEAM</span>
                  <span className="r">Q1</span><span className="r">Q2</span><span className="r">Q3</span>
                </div>
                {quali.map((q) => (
                  <div key={q.position} className="trow">
                    <span className="pos display">{q.position}</span>
                    <span className="num mono">{q.number}</span>
                    <span className="drv">
                      <Flag country={q.Driver.nationality} size={15} />
                      <span className="given">{q.Driver.givenName}</span>
                      <strong>{q.Driver.familyName}</strong>
                    </span>
                    <span className="team">
                      <TeamLogo
                        constructorId={q.Constructor.constructorId}
                        name={q.Constructor.name}
                        size={22}
                      />
                      {q.Constructor.name}
                    </span>
                    <span className="r mono dim">{q.Q1 ?? "—"}</span>
                    <span className="r mono dim">{q.Q2 ?? "—"}</span>
                    <span className="r mono">{q.Q3 ?? "—"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="msg card">이 라운드의 예선 데이터가 없습니다.</div>
            )
          )}

          {/* STARTING GRID */}
          {!loadingRound && tab === "grid" && (
            grid.length ? (
              <div className="table card grid-table">
                <div className="thead mono">
                  <span>GRID</span><span>NO</span><span>DRIVER</span><span>TEAM</span>
                  <span className="r">FINISH</span><span className="r">GAINED</span>
                </div>
                {grid.map((r) => {
                  const delta = Number(r.grid) - Number(r.position);
                  return (
                    <div key={r.grid} className="trow">
                      <span className="pos display">{r.grid}</span>
                      <span className="num mono">{r.Driver.permanentNumber ?? "—"}</span>
                      <span className="drv">
                        <Flag country={r.Driver.nationality} size={15} />
                        <span className="given">{r.Driver.givenName}</span>
                        <strong>{r.Driver.familyName}</strong>
                      </span>
                      <span className="team">
                        <TeamLogo
                          constructorId={r.Constructor.constructorId}
                          name={r.Constructor.name}
                          size={22}
                        />
                        {r.Constructor.name}
                      </span>
                      <span className="r mono dim">{r.position}</span>
                      <span
                        className="r mono"
                        style={{ color: delta > 0 ? "var(--up)" : delta < 0 ? "var(--down)" : "var(--dim)" }}
                      >
                        {delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="msg card">그리드 데이터가 없습니다.</div>
            )
          )}
        </>
      )}

      <style>{`
        .controls {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 20px; padding: 14px 18px; margin-bottom: 14px; flex-wrap: wrap;
        }
        .seasons { display: flex; gap: 5px; flex-wrap: wrap; }
        .season {
          padding: 6px 13px; font-size: 12px;
          background: var(--surface-2); border: 1px solid var(--line);
          color: var(--muted); cursor: pointer; clip-path: var(--clip-sm);
        }
        .season:hover { color: var(--text); }
        .season.on { color: #fff; background: var(--f1-red); border-color: var(--f1-red); }
        .gp-field { display: flex; flex-direction: column; gap: 7px; min-width: 260px; }
        .gp-field select {
          background: var(--surface-2); color: var(--text);
          border: 1px solid var(--line); padding: 8px 10px;
          font-family: var(--font-mono); font-size: 12px;
          clip-path: var(--clip-sm); outline: none;
        }
        .gp-field select:focus { border-color: var(--f1-red); }

        .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
        .sum { padding: 18px 20px; }
        .sum-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .sum-icon { font-size: 13px; opacity: 0.6; }
        .sum-name {
          display: flex; align-items: center; gap: 10px;
          font-size: 22px; text-transform: uppercase; margin-bottom: 6px;
        }
        .sum-name { line-height: 1.1; }
        .sum-sub { font-size: 11px; color: var(--muted); }
        .sum-empty { font-size: 12px; color: var(--dim); padding: 8px 0; }

        .tabs { display: flex; align-items: center; gap: 4px; margin-bottom: 10px; flex-wrap: wrap; }
        .tab {
          padding: 8px 15px; font-size: 11px; letter-spacing: 0.1em;
          background: var(--surface); border: 1px solid var(--line);
          color: var(--muted); cursor: pointer; clip-path: var(--clip-sm);
        }
        .tab:hover { color: var(--text); }
        .tab.on { color: var(--text); border-color: var(--f1-red); background: var(--surface-2); }
        .tab-note {
          margin-left: auto; font-size: 10px; color: var(--dim);
          display: flex; align-items: center; gap: 6px;
        }

        .table { padding: 6px 18px 12px; }
        .thead, .trow {
          display: grid;
          grid-template-columns: 46px 40px 1fr 190px 60px 130px 56px;
          gap: 12px; align-items: center;
        }
        .grid-table .thead, .grid-table .trow {
          grid-template-columns: 46px 40px 1fr 190px 70px 70px;
        }
        .thead {
          padding: 12px 0 10px; font-size: 10px;
          letter-spacing: 0.1em; color: var(--dim);
          border-bottom: 1px solid var(--line);
        }
        .trow {
          padding: 9px 0; font-size: 14px;
          border-bottom: 1px solid var(--line);
        }
        .trow:last-child { border-bottom: none; }
        .r { text-align: right; }
        .dim { color: var(--muted); }
        .pos { font-size: 15px; color: var(--muted); }
        .num { font-size: 12px; color: var(--muted); }
        .drv { display: flex; align-items: center; gap: 7px; min-width: 0; }
        .drv .given { color: var(--muted); }
        .drv strong { font-weight: 700; }
        .team { display: flex; align-items: center; gap: 9px; font-size: 12px; color: var(--muted);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .stripe { width: 3px; height: 17px; flex-shrink: 0; display: inline-block; }

        .msg { padding: 30px; text-align: center; color: var(--muted); font-size: 13px; }

        @media (max-width: 1000px) {
          .summary { grid-template-columns: 1fr; }
          .thead, .trow { grid-template-columns: 38px 1fr 90px 56px; }
          .grid-table .thead, .grid-table .trow { grid-template-columns: 38px 1fr 60px 60px; }
          .num, .team { display: none; }
        }
      `}</style>
    </div>
  );
}
