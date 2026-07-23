import { NextResponse } from "next/server";

const OPENF1 = "https://api.openf1.org/v1";

export const revalidate = 86400;

/**
 * 두 가지 모드:
 *   ?year=2024        → 그 시즌의 그랑프리(meetings) 목록  (~24행)
 *   ?meeting_key=1234 → 해당 그랑프리의 세션 목록          (~5행)
 *
 * sessions?year= 로 한 번에 받으면 행 수가 많아 잘릴 수 있어 2단계로 나눈다.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year");
  const meetingKey = searchParams.get("meeting_key");

  try {
    // ── 세션 목록 (특정 그랑프리) ──
    if (meetingKey) {
      const res = await fetch(`${OPENF1}/sessions?meeting_key=${meetingKey}`, {
        next: { revalidate: 86400 },
      });
      if (!res.ok) throw new Error(`OpenF1 sessions ${res.status}`);
      const raw: any[] = await res.json();
      const sessions = raw
        .filter((s) => s.session_key && s.date_start)
        .sort((a, b) => a.date_start.localeCompare(b.date_start)); // 주말 순서대로
      return NextResponse.json({ sessions });
    }

    // ── 그랑프리 목록 (연도) ──
    const y = Number(year);
    if (!y || y < 2023) {
      return NextResponse.json(
        { error: "OpenF1은 2023년부터 데이터를 제공합니다." },
        { status: 400 }
      );
    }
    const res = await fetch(`${OPENF1}/meetings?year=${y}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error(`OpenF1 meetings ${res.status}`);
    const raw: any[] = await res.json();
    const meetings = raw
      .filter((m) => m.meeting_key && m.date_start)
      // 프리시즌 테스팅은 그랑프리가 아니므로 제외
      .filter(
        (m) =>
          !/testing/i.test(m.meeting_name ?? "") &&
          !/testing/i.test(m.meeting_official_name ?? "")
      )
      .sort((a, b) => b.date_start.localeCompare(a.date_start)); // 최신 GP 위로

    return NextResponse.json({ year: y, meetings });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "조회 실패" },
      { status: 502 }
    );
  }
}