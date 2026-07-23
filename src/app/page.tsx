import Link from "next/link";
import {
  getNextRace,
  getDriverStandings,
  getConstructorStandings,
  getCircuitImage,
} from "@/lib/f1api";
import { teamColor } from "@/lib/teams";
import Flag from "@/components/Flag";
import Countdown from "@/components/Countdown";

export default async function Home() {
  const season = new Date().getFullYear();
  const [next, drivers, constructors] = await Promise.all([
    getNextRace(season),
    getDriverStandings(season),
    getConstructorStandings(season),
  ]);
  const circuitImg = next
    ? await getCircuitImage(next.Circuit.Location.country, season)
    : null;

  return (
    <div>
      <header className="page-head">
        <div className="eyebrow">SEASON {season} · CHAMPIONSHIP</div>
        <h1 className="page-title">Dashboard</h1>
      </header>

      <div className="grid">
        {/* 다음 레이스 — 방송 그래픽 히어로 */}
        {next && (
          <div className="card hero">
            <div className="hero-top">
              <span className="eyebrow">NEXT RACE</span>
              <span className="hero-round mono">R{next.round}</span>
            </div>
            <div className="hero-flag"><Flag country={next.Circuit.Location.country} size={44} /></div>
            {circuitImg && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="hero-circuit-img" src={circuitImg} alt={next.Circuit.circuitName} />
            )}
            <h2 className="hero-name display">{next.raceName}</h2>
            <div className="hero-circuit mono">{next.Circuit.circuitName}</div>
            <div className="hero-cd">
              <Countdown target={`${next.date}T${next.time ?? "12:00:00Z"}`} />
            </div>
          </div>
        )}

        {/* 리플레이 */}
        <Link href="/replay" className="card replay">
          <span className="eyebrow">TELEMETRY</span>
          <div className="replay-title display">LIVE<br/>REPLAY</div>
          <p className="replay-desc">트랙맵 · 타이밍타워 · AI 타이어 분석</p>
          <span className="replay-go mono">ENTER →</span>
        </Link>

        {/* 드라이버 스탠딩 */}
        <div className="card standings">
          <div className="std-head gfx-bar">
            <span className="eyebrow">DRIVER STANDINGS</span>
            <Link href="/standings/drivers" className="see-all mono">ALL →</Link>
          </div>
          <div className="std-table">
            {drivers.slice(0, 6).map((s) => (
              <div key={s.Driver.driverId} className="std-row">
                <span className="std-pos display">{s.position}</span>
                <span className="std-stripe" style={{ background: teamColor(s.Constructors[0]?.constructorId) }} />
                <span className="std-name">{s.Driver.code ?? s.Driver.familyName}</span>
                <span className="std-team mono">{s.Constructors[0]?.name ?? ""}</span>
                <span className="std-pts display">{s.points}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 컨스트럭터 스탠딩 */}
        <div className="card standings">
          <div className="std-head gfx-bar">
            <span className="eyebrow">CONSTRUCTORS</span>
            <Link href="/standings/constructors" className="see-all mono">ALL →</Link>
          </div>
          <div className="std-table">
            {constructors.slice(0, 6).map((s) => (
              <div key={s.Constructor.constructorId} className="std-row">
                <span className="std-pos display">{s.position}</span>
                <span className="std-stripe" style={{ background: teamColor(s.Constructor.constructorId) }} />
                <span className="std-name">{s.Constructor.name}</span>
                <span className="std-team mono"></span>
                <span className="std-pts display">{s.points}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 16px;
        }
        .std-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .see-all { font-size: 11px; color: var(--muted); }
        .see-all:hover { color: var(--f1-red); }

        /* 히어로 */
        .hero {
          position: relative;
          padding: 26px 28px;
          grid-row: span 2;
          display: flex; flex-direction: column;
          background:
            radial-gradient(circle at 90% 10%, rgba(225,6,0,0.12), transparent 50%),
            var(--surface);
        }
        .hero-top { display: flex; justify-content: space-between; align-items: center; }
        .hero-round { font-size: 13px; color: var(--f1-red); font-weight: 600; }
        .hero-flag { font-size: 52px; margin: 20px 0 8px; }
        .hero-name { font-size: 32px; line-height: 1.05; text-transform: uppercase; margin-bottom: 8px; }
        .hero-circuit { font-size: 12px; color: var(--muted); }
        .hero-circuit-img {
          position: absolute;
          top: 20px;
          right: 24px;
          width: 100px;
          height: 100px;
          object-fit: contain;
          opacity: 0.6;
          filter: brightness(0) invert(1);
          pointer-events: none;
        }
        .hero-cd { margin-top: auto; padding-top: 28px; }

        /* 리플레이 */
        .replay {
          padding: 24px 26px;
          display: flex; flex-direction: column;
          transition: border-color .15s;
        }
        .replay:hover { border-color: var(--f1-red); }
        .replay-title { font-size: 30px; line-height: 1; text-transform: uppercase; margin: 12px 0; }
        .replay-desc { font-family: var(--font-mono); font-size: 11px; color: var(--muted); line-height: 1.6; flex: 1; letter-spacing: 0.02em; }
        .replay-go { font-size: 12px; color: var(--f1-red); margin-top: 14px; letter-spacing: 0.1em; }

        /* 스탠딩 */
        .standings { padding: 20px 22px; }
        .std-table { display: flex; flex-direction: column; }
        .std-row {
          display: grid;
          grid-template-columns: 32px 4px 1fr auto auto;
          align-items: center; gap: 12px;
          padding: 9px 0;
          border-bottom: 1px solid var(--line);
        }
        .std-row:last-child { border-bottom: none; }
        .std-pos { font-size: 16px; color: var(--muted); width: 32px; }
        .std-stripe { width: 4px; height: 22px; }
        .std-name { font-size: 14px; font-weight: 600; }
        .std-team { font-size: 10px; color: var(--muted); text-align: right; letter-spacing: 0.04em; }
        .std-pts { font-size: 17px; color: var(--text); min-width: 40px; text-align: right; }

        @media (max-width: 900px) {
          .grid { grid-template-columns: 1fr; }
          .hero { grid-row: auto; }
        }
      `}</style>
    </div>
  );
}
