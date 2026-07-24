import type { Race, SessionTime } from "@/lib/f1api";

export type WeekendSession = {
  key: string;
  label: string;       // 화면 표시용
  short: string;       // 뱃지용 (FP1, SQ, Q, R …)
  start: Date;
};

/** Jolpica 의 { date, time } → Date (time 이 없으면 그 날 정오 UTC 로 가정) */
function toDate(s?: SessionTime): Date | null {
  if (!s?.date) return null;
  const d = new Date(`${s.date}T${s.time ?? "12:00:00Z"}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 한 그랑프리 주말의 세션을 시간순으로.
 *
 * 스프린트 주말은 구성이 다르다.
 *  - 2023: FP1 → 스프린트 슛아웃 → 스프린트 → 예선 → 레이스
 *  - 2024~: FP1 → 예선 → 스프린트 예선 → 스프린트 → 레이스
 * 필드 유무로 자연스럽게 처리되도록 있는 것만 모아 정렬한다.
 */
export function weekendSessions(race: Race): WeekendSession[] {
  const defs: { key: keyof Race; label: string; short: string }[] = [
    { key: "FirstPractice", label: "Practice 1", short: "FP1" },
    { key: "SecondPractice", label: "Practice 2", short: "FP2" },
    { key: "ThirdPractice", label: "Practice 3", short: "FP3" },
    { key: "SprintShootout", label: "Sprint Shootout", short: "SQ" },
    { key: "SprintQualifying", label: "Sprint Qualifying", short: "SQ" },
    { key: "Sprint", label: "Sprint", short: "SPR" },
    { key: "Qualifying", label: "Qualifying", short: "Q" },
  ];

  const out: WeekendSession[] = [];
  for (const d of defs) {
    const start = toDate(race[d.key] as SessionTime | undefined);
    if (start) out.push({ key: String(d.key), label: d.label, short: d.short, start });
  }

  const raceStart = toDate({ date: race.date, time: race.time });
  if (raceStart) {
    out.push({ key: "Race", label: "Race", short: "R", start: raceStart });
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** 아직 시작하지 않은 첫 세션 (없으면 null) */
export function nextSession(sessions: WeekendSession[]): WeekendSession | null {
  const now = Date.now();
  return sessions.find((s) => s.start.getTime() > now) ?? null;
}
