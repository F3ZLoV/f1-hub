import { NextResponse } from "next/server";
import { degradationCurve } from "@/lib/tyreModel";

/**
 * 리플레이 청크 빌더 — build_replay_full.py 의 서버 사이드 이식.
 *
 *  OpenF1(location + car_data + laps + stints + drivers)
 *   → 노이즈 필터 → 시간축 근접조인 → 랩/컴파운드 매핑 → 다운샘플링
 *   → 컬럼형(축별 배열) 페이로드
 *
 * 풀레이스를 한 요청으로 받으면 OpenF1 응답이 수십 MB라 타임아웃되므로
 * 시간 구간(청크) 단위로 나눠 받고 클라이언트가 이어붙인다.
 *
 *   ?session_key=9165&start=0&dur=300&hz=2
 *
 * t 는 세션 기준(1랩 시작) 절대 초 — 청크를 그대로 concat 할 수 있다.
 */

const OPENF1 = "https://api.openf1.org/v1";

export const revalidate = 604800; // 과거 세션은 안 바뀜
export const maxDuration = 60;

const COMPOUND_CODES = ["SOFT", "MEDIUM", "HARD", "INTERMEDIATE", "WET"];

type LocRec = { driver_number: number; date: string; x: number; y: number };
type CarRec = {
  driver_number: number; date: string;
  speed?: number; n_gear?: number; throttle?: number; brake?: number;
  rpm?: number; drs?: number;
};
type LapRec = { driver_number: number; lap_number: number; date_start?: string };
type StintRec = {
  driver_number: number; compound?: string;
  lap_start?: number; lap_end?: number; tyre_age_at_start?: number;
};
type DriverRec = {
  driver_number: number; name_acronym?: string; full_name?: string;
  team_name?: string; team_colour?: string;
};

const ts = (d: string) => Date.parse(d);

async function of1<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${OPENF1}/${path}?${qs}`, {
    next: { revalidate: 604800 },
  });
  if (!res.ok) throw new Error(`OpenF1 ${path} → ${res.status}`);
  return res.json();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionKey = searchParams.get("session_key");
  if (!sessionKey) {
    return NextResponse.json({ error: "session_key 필요" }, { status: 400 });
  }
  const startOff = Math.max(0, Number(searchParams.get("start")) || 0);
  const dur = Math.min(Math.max(Number(searchParams.get("dur")) || 300, 30), 600);
  const hz = Math.min(Math.max(Number(searchParams.get("hz")) || 2, 0.5), 4);

  try {
    // ── 1) 세션 메타 ──
    const [session] = await of1<{
      session_key: number; year: number;
      date_start: string; date_end?: string;
      session_name: string; session_type: string;
      country_name: string; circuit_short_name: string;
    }>("sessions", { session_key: sessionKey });
    if (!session) {
      return NextResponse.json({ error: "세션을 찾을 수 없음" }, { status: 404 });
    }

    // ── 2) 드라이버 / 랩 / 스틴트 (가벼움, 청크마다 캐시 히트) ──
    const [drivers, laps, stints] = await Promise.all([
      of1<DriverRec>("drivers", { session_key: sessionKey }),
      of1<LapRec>("laps", { session_key: sessionKey }),
      of1<StintRec>("stints", { session_key: sessionKey }),
    ]);

    const lapStarts = laps
      .filter((l) => l.date_start)
      .map((l) => ({ n: l.lap_number, d: l.driver_number, t: ts(l.date_start!) }));

    // 기준 시점 t0 = 1랩 시작(레이스). 없으면 세션 시작.
    const firstLaps = lapStarts.filter((l) => l.n === 1).map((l) => l.t);
    const t0 = firstLaps.length ? Math.min(...firstLaps) : ts(session.date_start);
    if (!Number.isFinite(t0)) throw new Error("세션 시작 시각을 알 수 없음");

    // 세션 총 길이 — 클라이언트가 청크 개수를 계산하는 데 사용
    const endT = session.date_end ? ts(session.date_end) : NaN;
    const lastLap = lapStarts.length ? Math.max(...lapStarts.map((l) => l.t)) : t0;
    const totalDur = Math.max(
      60,
      Math.round(((Number.isFinite(endT) ? endT : lastLap + 180_000) - t0) / 1000)
    );

    const from = new Date(t0 + startOff * 1000).toISOString().replace("Z", "");
    const to = new Date(t0 + (startOff + dur) * 1000).toISOString().replace("Z", "");

    // ── 3) 좌표 + 텔레메트리 (이 청크 구간만) ──
    const [loc, car] = await Promise.all([
      of1<LocRec>("location", { session_key: sessionKey, "date>": from, "date<": to }),
      of1<CarRec>("car_data", { session_key: sessionKey, "date>": from, "date<": to }),
    ]);

    // ── 4) 드라이버별 그룹 + 노이즈 제거 ──
    const locBy = new Map<number, LocRec[]>();
    for (const r of loc) {
      if (!r.x && !r.y) continue; // 차고/정지
      const arr = locBy.get(r.driver_number) ?? [];
      arr.push(r);
      locBy.set(r.driver_number, arr);
    }
    const carBy = new Map<number, CarRec[]>();
    for (const r of car) {
      if (!r.speed && !r.rpm && !r.throttle) continue;
      const arr = carBy.get(r.driver_number) ?? [];
      arr.push(r);
      carBy.set(r.driver_number, arr);
    }
    const stintBy = new Map<number, StintRec[]>();
    for (const s of stints) {
      const arr = stintBy.get(s.driver_number) ?? [];
      arr.push(s);
      stintBy.set(s.driver_number, arr);
    }
    const lapBy = new Map<number, { n: number; t: number }[]>();
    for (const l of lapStarts) {
      const arr = lapBy.get(l.d) ?? [];
      arr.push({ n: l.n, t: l.t });
      lapBy.set(l.d, arr);
    }
    const metaBy = new Map<number, DriverRec>();
    for (const d of drivers) metaBy.set(d.driver_number, d);

    // ── 5) 병합 + 컬럼형 출력 ──
    const gapMs = 1000 / hz;
    const out: any[] = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    for (const [num, points] of locBy) {
      points.sort((a, b) => a.date.localeCompare(b.date));
      const cars = (carBy.get(num) ?? []).sort((a, b) => a.date.localeCompare(b.date));
      const carTs = cars.map((c) => ts(c.date));
      const myLaps = (lapBy.get(num) ?? []).sort((a, b) => a.t - b.t);
      const myStints = stintBy.get(num) ?? [];

      // 근접조인 (이진탐색)
      const nearest = (t: number): CarRec | undefined => {
        if (!cars.length) return undefined;
        let lo = 0, hi = carTs.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (carTs[mid] < t) lo = mid + 1;
          else hi = mid;
        }
        const iPrev = Math.max(0, lo - 1);
        const a = cars[iPrev], b = cars[lo];
        if (!a) return b;
        if (!b) return a;
        return Math.abs(carTs[iPrev] - t) <= Math.abs(carTs[lo] - t) ? a : b;
      };

      const lapAt = (t: number) => {
        let n = 0;
        for (const l of myLaps) {
          if (t >= l.t) n = l.n;
          else break;
        }
        return n > 0 ? n : 1;
      };
      const stintAt = (lapNo: number) => {
        for (const s of myStints) {
          const ls = s.lap_start;
          if (ls == null) continue;
          const le = s.lap_end ?? ls + 99;
          if (lapNo >= ls && lapNo <= le) {
            return {
              comp: s.compound ?? null,
              age: (s.tyre_age_at_start ?? 0) + (lapNo - ls),
            };
          }
        }
        return { comp: null as string | null, age: null as number | null };
      };

      const T: number[] = [], X: number[] = [], Y: number[] = [];
      const SP: (number | null)[] = [], GR: (number | null)[] = [];
      const TH: (number | null)[] = [], BR: (number | null)[] = [];
      const DR: (number | null)[] = [], LP: number[] = [];
      const CP: number[] = [], AG: (number | null)[] = [];
      let lastEmit = -Infinity;
      let lastComp: string | null = null;

      for (const p of points) {
        const t = ts(p.date);
        if (t - lastEmit < gapMs) continue;
        lastEmit = t;

        const c = nearest(t);
        const lapNo = lapAt(t);
        const { comp, age } = stintAt(lapNo);
        if (comp) lastComp = comp;

        T.push(Math.round(((t - t0) / 1000) * 100) / 100);
        X.push(p.x); Y.push(p.y);
        SP.push(c?.speed ?? null);
        GR.push(c?.n_gear ?? null);
        TH.push(c?.throttle ?? null);
        BR.push(c?.brake ?? null);
        DR.push(c?.drs ?? null);
        LP.push(lapNo);
        CP.push(comp ? COMPOUND_CODES.indexOf(comp) : -1);
        AG.push(age);

        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }

      if (T.length < 5) continue;

      const m = metaBy.get(num);
      out.push({
        number: num,
        acronym: m?.name_acronym ?? String(num),
        name: m?.full_name ?? "",
        team: m?.team_name ?? "",
        colour: "#" + (m?.team_colour ?? "888888"),
        t: T, x: X, y: Y,
        speed: SP, gear: GR, throttle: TH, brake: BR, drs: DR,
        lap: LP, comp: CP, age: AG,
        deg_curve: degradationCurve(lastComp),
      });
    }

    out.sort((a, b) => a.number - b.number);

    return NextResponse.json({
      session_key: Number(sessionKey),
      year: session.year,
      session_name: session.session_name,
      circuit: session.circuit_short_name,
      country: session.country_name,
      compounds: COMPOUND_CODES,
      chunk: { start: startOff, dur, hz },
      total_dur: totalDur,
      drivers: out,
      bounds: out.length ? { minX, maxX, minY, maxY } : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "리플레이 빌드 실패" },
      { status: 502 }
    );
  }
}
