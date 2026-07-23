"use client";

import { useEffect, useRef, useState } from "react";

export type Frame = {
  t: number; x: number; y: number;
  speed?: number; gear?: number; throttle?: number; brake?: number;
  drs?: number; lap?: number; comp?: string | null; age?: number | null;
  prog?: number;
};
export type Driver = {
  number: number; acronym: string; name?: string; team?: string;
  colour: string; frames: Frame[]; deg_curve?: (number | null)[] | null;
};
export type ReplayData = {
  session_key: number;
  year?: number;
  session_name?: string;
  circuit?: string;
  country?: string;
  drivers: Driver[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

const CHUNK = 300;       // 청크 길이(초) — OpenF1 응답이 감당 가능한 크기
const CONCURRENCY = 3;   // 동시 요청 수 (과하면 OpenF1 레이트리밋)

/** 컬럼형 청크 → 프레임 배열 */
function toFrames(d: any, compounds: string[], offset: number): Frame[] {
  const n = d.t.length;
  const out: Frame[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const ci = d.comp[i];
    out[i] = {
      t: Math.round((d.t[i] - offset) * 100) / 100,
      x: d.x[i], y: d.y[i],
      speed: d.speed[i] ?? undefined,
      gear: d.gear[i] ?? undefined,
      throttle: d.throttle[i] ?? undefined,
      brake: d.brake[i] ?? undefined,
      drs: d.drs[i] ?? undefined,
      lap: d.lap[i],
      comp: ci >= 0 ? compounds[ci] : null,
      age: d.age[i],
    };
  }
  return out;
}

export type ReplayOptions = {
  /** "window" = 지정 구간만, "full" = 세션 전체 */
  mode: "window" | "full";
  start: number;   // 초 (window 모드)
  dur: number;     // 초 (window 모드)
  hz: number;
};

export function useReplayData(sessionKey: number | null, opt: ReplayOptions) {
  const [data, setData] = useState<ReplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedSec, setLoadedSec] = useState(0);
  const [totalSec, setTotalSec] = useState(0);
  const bagRef = useRef<ReplayData | null>(null);

  const { mode, start, dur, hz } = opt;

  useEffect(() => {
    if (!sessionKey) return;
    let cancelled = false;

    const fetchChunk = async (s: number, d: number) => {
      const qs = new URLSearchParams({
        session_key: String(sessionKey),
        start: String(s),
        dur: String(d),
        hz: String(hz),
      });
      const res = await fetch(`/api/replay?${qs}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      return body;
    };

    /** 청크를 누적 데이터에 병합 */
    const merge = (json: any, offset: number) => {
      const compounds: string[] = json.compounds ?? [];
      if (!bagRef.current) {
        bagRef.current = {
          session_key: json.session_key,
          year: json.year,
          session_name: json.session_name,
          circuit: json.circuit,
          country: json.country,
          drivers: [],
          bounds: json.bounds ?? { minX: 0, maxX: 1, minY: 0, maxY: 1 },
        };
      }
      const bag = bagRef.current;

      if (json.bounds) {
        bag.bounds = {
          minX: Math.min(bag.bounds.minX, json.bounds.minX),
          maxX: Math.max(bag.bounds.maxX, json.bounds.maxX),
          minY: Math.min(bag.bounds.minY, json.bounds.minY),
          maxY: Math.max(bag.bounds.maxY, json.bounds.maxY),
        };
      }

      for (const cd of json.drivers ?? []) {
        const frames = toFrames(cd, compounds, offset);
        if (!frames.length) continue;
        const existing = bag.drivers.find((x) => x.number === cd.number);
        if (existing) {
          const lastT = existing.frames.length
            ? existing.frames[existing.frames.length - 1].t
            : -Infinity;
          for (const f of frames) if (f.t > lastT) existing.frames.push(f);
          if (cd.deg_curve) existing.deg_curve = cd.deg_curve;
        } else {
          bag.drivers.push({
            number: cd.number,
            acronym: cd.acronym,
            name: cd.name,
            team: cd.team,
            colour: cd.colour,
            frames,
            deg_curve: cd.deg_curve ?? null,
          });
        }
      }
      bag.drivers.sort((a, b) => a.number - b.number);
      // 얕은 복사로 리렌더 유도 (frames 배열은 재사용)
      return { ...bag, drivers: [...bag.drivers] };
    };

    (async () => {
      setLoading(true);
      setError(null);
      setData(null);
      setLoadedSec(0);
      setTotalSec(0);
      bagRef.current = null;

      try {
        const firstDur = Math.min(mode === "full" ? CHUNK : dur, CHUNK);
        const first = await fetchChunk(start, firstDur);
        if (cancelled) return;

        const offset = start;
        setData(merge(first, offset));
        setLoadedSec(firstDur);

        const end =
          mode === "full" ? Math.max(first.total_dur ?? 0, firstDur) : start + dur;
        setTotalSec(mode === "full" ? end : dur);

        // 남은 청크 계획
        const plan: number[] = [];
        for (let s = start + firstDur; s < end; s += CHUNK) plan.push(s);
        if (!plan.length) {
          setLoading(false);
          return;
        }

        // 배치 단위로 병렬 요청 → 순서대로 이어붙이기
        for (let i = 0; i < plan.length; i += CONCURRENCY) {
          if (cancelled) return;
          const batch = plan.slice(i, i + CONCURRENCY);
          const results = await Promise.allSettled(
            batch.map((s) => fetchChunk(s, Math.min(CHUNK, end - s)))
          );
          if (cancelled) return;
          for (const r of results) {
            if (r.status === "fulfilled") setData(merge(r.value, offset));
          }
          setLoadedSec(Math.min(end - start, batch[batch.length - 1] + CHUNK - start));
        }
        if (!cancelled) setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "로드 실패");
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [sessionKey, mode, start, dur, hz]);

  return { data, error, loading, loadedSec, totalSec };
}
