import { getConstructorStandings } from "@/lib/f1api";
import { teamColor } from "@/lib/teams";
import Flag from "@/components/Flag";
import TeamLogo from "@/components/TeamLogo";

export const metadata = { title: "Constructor Standings — F1 Hub" };

export default async function ConstructorStandingsPage() {
  const season = new Date().getFullYear();
  const standings = await getConstructorStandings(season);
  const leader = standings[0] ? Number(standings[0].points) : 0;

  return (
    <div>
      <header className="page-head">
        <div className="eyebrow">SEASON {season} · WORLD CHAMPIONSHIP</div>
        <h1 className="page-title">Constructor Standings</h1>
      </header>

      <div className="table-head mono">
        <span>POS</span>
        <span>TEAM</span>
        <span className="th-r">WINS</span>
        <span className="th-r">PTS</span>
      </div>

      <div className="rows">
        {standings.map((s) => {
          const id = s.Constructor.constructorId;
          const color = teamColor(id);
          const pct = leader ? (Number(s.points) / leader) * 100 : 0;
          return (
            <div key={id} className="row card" style={{ ["--tc" as any]: color }}>
              <span className="pos display">{s.position}</span>
              <div className="team">
                <TeamLogo constructorId={id} name={s.Constructor.name} color={color} size={40} />
                <div className="team-info">
                  <div className="team-name">
                    <span className="t-flag"><Flag country={s.Constructor.nationality} size={18} /></span>
                    {s.Constructor.name}
                  </div>
                </div>
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
        .table-head {
          display: grid; grid-template-columns: 48px 1fr 70px 100px;
          gap: 16px; align-items: center; padding: 0 20px 10px;
          font-size: 10px; letter-spacing: 0.12em; color: var(--muted);
        }
        .th-r { text-align: right; }
        .rows { display: flex; flex-direction: column; gap: 6px; }
        .row {
          display: grid; grid-template-columns: 48px 1fr 70px 100px;
          gap: 16px; align-items: center; padding: 14px 20px;
          border-left: 3px solid var(--tc);
          transition: border-color .15s;
        }
        .pos { font-size: 22px; }
        .team { display: flex; align-items: center; gap: 16px; }
        .team-name { font-size: 16px; font-weight: 600; }
        .t-flag { margin-right: 8px; }
        .wins { font-size: 14px; text-align: right; color: var(--muted); }
        .pts-wrap { position: relative; text-align: right; }
        .pts { font-size: 20px; }
        .pts-bar { position: absolute; left: 0; bottom: -8px; height: 2px; opacity: 0.5; }

        @media (max-width: 768px) {
          .table-head { display: none; }
          .row { grid-template-columns: 36px 1fr 70px; }
          .wins { display: none; }
        }
      `}</style>
    </div>
  );
}
