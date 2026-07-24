"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getDriverInfo,
  getDriverSeasons,
  getDriverSeasonResults,
  getDriverStandingForSeason,
  getDriverMeta,
  type Driver,
  type DriverStanding,
  type DriverSeasonRace,
  type OpenF1Driver,
} from "@/lib/f1api";
import { teamColor } from "@/lib/teams";
import Flag from "@/components/Flag";
import DriverAvatar from "@/components/DriverAvatar";
import TeamLogo from "@/components/TeamLogo";
import { useAsync } from "@/lib/useAsync";

export default function DriverDetail({ driverId }: { driverId: string }) {
  const [season, setSeason] = useState<string | null>(null);

  // 드라이버 기본 정보 + 출전 시즌 + 헤드샷
  const { data: base, loading: loadingBase } = useAsync(async () => {
    const [info, seasons, meta] = await Promise.all([
      getDriverInfo(driverId),
      getDriverSeasons(driverId),
      getDriverMeta().catch(() => ({} as Record<string, OpenF1Driver>)),
    ]);
    return { info, seasons, meta };
  }, [driverId]);

  const info: Driver | null = base?.info ?? null;
  const seasons = base?.seasons ?? [];

  useEffect(() => {
    if (!season && seasons.length) setSeason(seasons[0]);
  }, [seasons, season]);

  // 선택 시즌의 순위 + 라운드별 결과
  const { data: sd, loading: loadingSeason } = useAsync(async () => {
    if (!season) return null;
    const [standing, races] = await Promise.all([
      getDriverStandingForSeason(season, driverId).catch(() => null),
      getDriverSeasonResults(season, driverId).catch(() => [] as DriverSeasonRace[]),
    ]);
    return { standing, races };
  }, [season, driverId]);

  const standing: DriverStanding | null = sd?.standing ?? null;
  const races = useMemo(() => sd?.races ?? [], [sd]);

  const code = (info?.code ?? info?.familyName?.slice(0, 3) ?? "").toUpperCase();
  const headshot = base?.meta?.[code]?.headshot_url;
  const team = standing?.Constructors?.[0];
  const color = teamColor(team?.constructorId);

  // 시즌 집계 — 완주 기록에서 직접 계산
  const stats = useMemo(() => {
    let podium = 0, best = 99, dnf = 0, points = 0;
    for (const r of races) {
      const res = r.Results?.[0];
      if (!res) continue;
      const pos = Number(res.position);
      if (pos <= 3) podium++;
      if (pos < best) best = pos;
      if (!/finished|\+\d+ lap/i.test(res.status)) dnf++;
      points += Number(res.points) || 0;
    }
    return { podium, best: best === 99 ? null : best, dnf, points, entries: races.length };
  }, [races]);

  const maxPts = Math.max(
    1,
    ...races.map((r) => Number(r.Results?.[0]?.points) || 0)
  );

  if (loadingBase) {
    return <div className="card msg">불러오는 중…</div>;
  }
  if (!info) {
    return (
      <div className="card msg">
        드라이버를 찾을 수 없습니다.
        <br />
        <Link href="/standings/drivers" className="back mono">← 스탠딩으로</Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/standings/drivers" className="back mono">← DRIVER STANDINGS</Link>

      {/* 헤더 */}
      <div className="card hero" style={{ ["--tc" as string]: color } as React.CSSProperties}>
        <DriverAvatar
          src={headshot}
          driverId={driverId}
          code={code}
          color={color}
          size={92}
        />
        <div className="hero-info">
          <div className="eyebrow">
            {info.permanentNumber ? `#${info.permanentNumber} · ` : ""}{code}
          </div>
          <h1 className="hero-name display">
            {info.givenName} <strong>{info.familyName}</strong>
          </h1>
          <div className="hero-meta mono">
            <Flag country={info.nationality} size={18} />
            {info.nationality}
            {team && (
              <>
                <span className="sep">·</span>
                <TeamLogo constructorId={team.constructorId} name={team.name} size={20} />
                {team.name}
              </>
            )}
          </div>
        </div>
        {standing && (
          <div className="hero-pos">
            <span className="eyebrow">{season} 순위</span>
            <b className="display">{standing.position}</b>
            <span className="mono">{standing.points} PTS</span>
          </div>
        )}
      </div>

      {/* 시즌 선택 */}
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

      {loadingSeason && <div className="card msg">불러오는 중…</div>}

      {!loadingSeason && season && (
        <>
          {/* 시즌 집계 */}
          <div className="stats">
            <div className="card stat">
              <span className="eyebrow">WINS</span>
              <b className="display">{standing?.wins ?? "0"}</b>
            </div>
            <div className="card stat">
              <span className="eyebrow">PODIUMS</span>
              <b className="display">{stats.podium}</b>
            </div>
            <div className="card stat">
              <span className="eyebrow">BEST FINISH</span>
              <b className="display">{stats.best ? `P${stats.best}` : "—"}</b>
            </div>
            <div className="card stat">
              <span className="eyebrow">ENTRIES</span>
              <b className="display">{stats.entries}</b>
            </div>
            <div className="card stat">
              <span className="eyebrow">DNF</span>
              <b className="display">{stats.dnf}</b>
            </div>
          </div>

          {/* 라운드별 결과 */}
          {races.length ? (
            <div className="card table">
              <div className="thead mono">
                <span>RND</span><span>GRAND PRIX</span>
                <span className="r">GRID</span><span className="r">FINISH</span>
                <span>STATUS</span><span className="r">PTS</span>
              </div>
              {races.map((r) => {
                const res = r.Results?.[0];
                if (!res) return null;
                const delta = Number(res.grid) - Number(res.position);
                return (
                  <div key={r.round} className="trow">
                    <span className="rnd mono">R{r.round}</span>
                    <span className="gp">
                      <Flag country={r.Circuit.Location.country} size={15} />
                      {r.raceName}
                    </span>
                    <span className="r mono dim">{res.grid}</span>
                    <span className="r">
                      <b className="display">{res.position}</b>
                      {Number(res.grid) > 0 && delta !== 0 && (
                        <i
                          className="delta mono"
                          style={{ color: delta > 0 ? "var(--up)" : "var(--down)" }}
                        >
                          {delta > 0 ? `▲${delta}` : `▼${-delta}`}
                        </i>
                      )}
                    </span>
                    <span className="status mono dim">{res.status}</span>
                    <span className="r pts">
                      <b className="display">{res.points}</b>
                      <i
                        className="pbar"
                        style={{
                          width: `${(Number(res.points) / maxPts) * 100}%`,
                          background: color,
                        }}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card msg">{season} 시즌 기록이 없습니다.</div>
          )}
        </>
      )}

      <style>{`
        .back {
          display: inline-block; font-size: 11px; color: var(--muted);
          letter-spacing: 0.1em; margin-bottom: 16px;
        }
        .back:hover { color: var(--f1-red); }

        .hero {
          display: flex; align-items: center; gap: 22px;
          padding: 24px 28px; margin-bottom: 16px;
          border-left: 3px solid var(--tc);
          background:
            radial-gradient(circle at 92% 8%, rgba(225,6,0,0.10), transparent 55%),
            var(--surface);
        }
        .hero-info { min-width: 0; }
        .hero-name { font-size: 32px; text-transform: uppercase; margin: 6px 0 8px; }
        .hero-name strong { font-weight: 700; }
        .hero-meta {
          display: flex; align-items: center; gap: 8px;
          font-size: 12px; color: var(--muted);
        }
        .hero-meta .sep { color: var(--dim); }
        .hero-pos {
          margin-left: auto; text-align: right;
          display: flex; flex-direction: column; gap: 4px;
        }
        .hero-pos b { font-size: 40px; line-height: 1; }
        .hero-pos span.mono { font-size: 11px; color: var(--muted); }

        .seasons { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 14px; }
        .season {
          padding: 6px 13px; font-size: 12px;
          background: var(--surface); border: 1px solid var(--line);
          color: var(--muted); cursor: pointer; clip-path: var(--clip-sm);
        }
        .season:hover { color: var(--text); }
        .season.on { color: #fff; background: var(--f1-red); border-color: var(--f1-red); }

        .stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 14px; }
        .stat { padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; }
        .stat b { font-size: 26px; line-height: 1; }

        .table { padding: 6px 18px 12px; }
        .thead, .trow {
          display: grid; grid-template-columns: 48px 1fr 60px 78px 150px 78px;
          gap: 12px; align-items: center;
        }
        .thead {
          padding: 12px 0 10px; font-size: 10px;
          letter-spacing: 0.1em; color: var(--dim);
          border-bottom: 1px solid var(--line);
        }
        .trow { padding: 9px 0; font-size: 14px; border-bottom: 1px solid var(--line); }
        .trow:last-child { border-bottom: none; }
        .r { text-align: right; }
        .dim { color: var(--muted); }
        .rnd { font-size: 12px; color: var(--muted); }
        .gp { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .delta { font-size: 10px; margin-left: 6px; font-style: normal; }
        .status { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pts { position: relative; }
        .pts b { font-size: 15px; }
        .pbar { position: absolute; right: 0; bottom: -6px; height: 2px; opacity: 0.6; }

        .msg { padding: 32px; text-align: center; color: var(--muted); font-size: 13px; }

        @media (max-width: 900px) {
          .hero { flex-wrap: wrap; gap: 16px; }
          .hero-pos { margin-left: 0; text-align: left; }
          .stats { grid-template-columns: repeat(3, 1fr); }
          .thead, .trow { grid-template-columns: 42px 1fr 60px 60px; }
          .status, .thead span:nth-child(3), .trow span:nth-child(3) { display: none; }
        }
      `}</style>
    </div>
  );
}
