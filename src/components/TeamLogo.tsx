"use client";

import { useState } from "react";
import { teamColor, teamShort } from "@/lib/teams";

/** Jolpica constructorId → public/logos/{파일명}.svg 매핑 */
const LOGO_FILE: Record<string, string> = {
  red_bull: "redbullracing",
  rb: "racingbulls",
  aston_martin: "astonmartin",
  mercedes: "mercedes",
  ferrari: "ferrari",
  mclaren: "mclaren",
  williams: "williams",
  haas: "haas",
  alpine: "alpine",
  audi: "audi",
  sauber: "audi",       // 2026 사우버 → 아우디 전환
  cadillac: "cadillac",
};

/**
 * 팀 로고 — public/logos/{파일}.svg + 팀컬러 배경.
 * 매핑/파일 없으면 팀컬러 이니셜 마크로 폴백.
 */
export default function TeamLogo({
  constructorId,
  name,
  size = 40,
}: {
  constructorId: string;
  name: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const color = teamColor(constructorId);
  const file = LOGO_FILE[constructorId];

  // 매핑 없거나 로드 실패 → 이니셜 폴백
  if (!file || failed) {
    return (
      <span className="team-badge display" style={{ background: color, width: size, height: size }}>
        {teamShort(constructorId, name)}
        <style>{`
          .team-badge {
            color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 0.03em;
            display: inline-flex; align-items: center; justify-content: center;
            clip-path: var(--clip-sm); flex-shrink: 0; text-align: center;
          }
        `}</style>
      </span>
    );
  }

  return (
    <span
      className="team-logo"
      style={{ width: size, height: size, background: color }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/logos/${file}.svg`} alt={name} onError={() => setFailed(true)} />
      <style>{`
        .team-logo {
          display: inline-flex; align-items: center; justify-content: center;
          clip-path: var(--clip-sm); flex-shrink: 0;
          padding: 6px;
        }
        .team-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
      `}</style>
    </span>
  );
}
