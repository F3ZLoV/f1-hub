"use client";

import { getDriverStandings, getDriverMeta } from "@/lib/f1api";
import { teamColor } from "@/lib/teams";
import Flag from "@/components/Flag";
import DriverAvatar from "@/components/DriverAvatar";
import { useAsync } from "@/lib/useAsync";

export default function DriverStandingsPage() {
  const season = new Date().getFullYear();
  const { data, loading } = useAsync(async () => {
    const [standings, meta] = await Promise.all([
      getDriverStandings(season),
      getDriverMeta(),
    ]);
    return { standings, meta };
  }, [season]);

  const standings = data?.standings ?? [];
  const meta = data?.meta ?? {};
  const leader = standings[0] ? Number(standings[0].points) : 0;

  return (
    <div>
      <header className="page-head">
        <div className="eyebrow">SEASON {season} · WORLD CHAMPIONSHIP</div>
        <h1 className="page-title">Driver Standings</h1>
      </header>

      <div className="table-head mono">
        <span>POS</span>
        <span></span>
        <span>DRIVER</span>
        <span>TEAM</span>
        <span className="th-r">WINS</span>
        <span className="th-r">PTS</span>
      </div>

      {loading && <div className="card msg">불러오는 중…</div>}

      <div className="rows">
        {standings.map((s) => {
          const code = (s.Driver.code ?? s.Driver.familyName.slice(0, 3)).toUpperCase();
          const m = meta[code];
          const color = teamColor(s.Constructors[0]?.constructorId);
          const pct = leader ? (Number(s.points) / leader) * 100 : 0;
          return (
            <div key={s.Driver.driverId} className="row card">
              <span className="pos display">{s.position}</span>
              <DriverAvatar
                src={m?.headshot_url}
                driverId={s.Driver.driverId}
                code={code}
                color={color}
              />
              <div className="driver">
                <div className="d-name">
                  <span className="d-flag"><Flag country={s.Driver.nationality} size={18} /></span>
                  {s.Driver.givenName} <strong>{s.Driver.familyName}</strong>
                </div>
                <div className="d-num mono">#{s.Driver.permanentNumber ?? "—"} · {code}</div>
              </div>
              <div className="team">
                <span className="team-stripe" style={{ background: color }} />
                <span className="team-name">{s.Constructors[0]?.name ?? "—"}</span>
              </div>
              <span className="wins mono">{s.wins}</span>
              <div className="pts-wrap">
                <span className="pts display">{s.points}</span>
                <span className="pts-bar" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .msg { padding: 28px; text-align: center; color: var(--muted); font-size: 13px; }
        .table-head {
          display: grid;
          grid-template-columns: 48px 44px 1fr 200px 60px 90px;
          gap: 16px; align-items: center;
          padding: 0 20px 10px;
          font-size: 10px; letter-spacing: 0.12em; color: var(--muted);
        }
        .th-r { text-align: right; }
        .rows { display: flex; flex-direction: column; gap: 6px; }
        .row {
          display: grid;
          grid-template-columns: 48px 44px 1fr 200px 60px 90px;
          gap: 16px; align-items: center;
          padding: 12px 20px;
          transition: border-color .15s;
        }
        .row:hover { border-color: var(--dim); }
        .pos { font-size: 20px; color: var(--text); }
        .driver { min-width: 0; }
        .d-name { font-size: 15px; }
        .d-name strong { font-weight: 700; }
        .d-flag { margin-right: 6px; }
        .d-num { font-size: 11px; color: var(--muted); margin-top: 2px; }
        .team { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .team-stripe { width: 4px; height: 24px; flex-shrink: 0; }
        .team-name { font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .wins { font-size: 14px; text-align: right; color: var(--muted); }
        .pts-wrap { position: relative; text-align: right; }
        .pts { font-size: 18px; }
        .pts-bar { position: absolute; left: 0; bottom: -6px; height: 2px; opacity: 0.5; }

        @media (max-width: 900px) {
          .table-head { display: none; }
          .row { grid-template-columns: 36px 40px 1fr 70px; }
          .team, .wins { display: none; }
        }
      `}</style>
    </div>
  );
}
