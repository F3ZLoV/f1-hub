"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { analyzeTrack, type TrackGeometry } from "@/lib/trackGeometry";
import { circuitPoints } from "@/lib/circuitPoints";
import type { Frame, Driver, ReplayData } from "./useReplayData";

// ── 연도별 규정 (2026: DRS 폐지 → Overtake Mode) ──────
const DRS_ON = [10, 12, 14];
const isModern = (y: number) => y >= 2026;
function inferYear(sk?: number) {
  if (!sk) return 2023;
  if (sk >= 12000) return 2026;
  if (sk >= 11000) return 2025;
  if (sk >= 10000) return 2024;
  return 2023;
}

/** 누적 주행거리 기준 실제 레이스 순위 */
function rankOrder(drivers: Driver[], st: Record<number, Frame>): number[] {
  return [...drivers]
    .sort((a, b) => {
      const pa = st[a.number]?.prog ?? 0;
      const pb = st[b.number]?.prog ?? 0;
      if (pb !== pa) return pb - pa;
      return a.number - b.number;
    })
    .map((d) => d.number);
}

const SPEEDS = [1, 4, 8];

export default function ReplayViewer({
  data,
  loading,
  error,
  loadedSec,
  totalSec,
}: {
  data: ReplayData | null;
  loading: boolean;
  error: string | null;
  loadedSec: number;
  totalSec: number;
}) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [clock, setClock] = useState(0);
  const [snapshot, setSnapshot] = useState<Record<number, Frame>>({});
  const [order, setOrder] = useState<number[]>([]);
  const [showMap, setShowMap] = useState(true);

  // 트랙 구조 분석 — 프레임이 늘어날 때만 다시 계산
  const frameTotal = data
    ? data.drivers.reduce((n, d) => n + d.frames.length, 0)
    : 0;
  const geo: TrackGeometry | null = useMemo(
    () => (data ? analyzeTrack(data.drivers, circuitPoints(data.circuit)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.session_key, frameTotal]
  );
  // 이 세션에 부스트(DRS/오버테이크) 데이터가 존재하는가
  // 2026 은 OpenF1 이 drs 를 전부 null 로 주므로 false 가 된다
  const hasBoostData = useMemo(() => {
    if (!data) return false;
    for (const d of data.drivers) {
      for (const f of d.frames) if (f.drs != null) return true;
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.session_key, frameTotal]);

  const geoRef = useRef<TrackGeometry | null>(null);
  const showMapRef = useRef(true);
  const hasBoostRef = useRef(false);
  useEffect(() => { geoRef.current = geo; renderRef.current?.(clockRef.current); }, [geo]);
  useEffect(() => { showMapRef.current = showMap; renderRef.current?.(clockRef.current); }, [showMap]);
  useEffect(() => { hasBoostRef.current = hasBoostData; renderRef.current?.(clockRef.current); }, [hasBoostData]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  const selectedRef = useRef<number | null>(null);
  const ptrRef = useRef<Record<number, number>>({});
  const distRef = useRef<Record<number, Float64Array>>({});
  const viewRef = useRef({ w: 0, h: 0 });
  const renderRef = useRef<((t: number) => void) | null>(null);
  const maxTRef = useRef(0);
  const sessionRef = useRef<number | null>(null);
  const modernRef = useRef(false);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  // ── 데이터 갱신(청크 추가 포함) 시 파생값 재계산 ──────
  useEffect(() => {
    if (!data) return;

    // 세션이 바뀌면 재생 상태 초기화
    if (sessionRef.current !== data.session_key) {
      sessionRef.current = data.session_key;
      clockRef.current = 0;
      setClock(0);
      setPlaying(false);
      setSelected(data.drivers[0]?.number ?? null);
      ptrRef.current = {};
    }

    // 누적 주행거리(순위 기준) — 청크가 붙었으므로 다시 적산
    for (const d of data.drivers) {
      const arr = new Float64Array(d.frames.length);
      let acc = 0;
      for (let i = 1; i < d.frames.length; i++) {
        const dx = d.frames[i].x - d.frames[i - 1].x;
        const dy = d.frames[i].y - d.frames[i - 1].y;
        acc += Math.hypot(dx, dy);
        arr[i] = acc;
      }
      distRef.current[d.number] = arr;
      if (ptrRef.current[d.number] == null) ptrRef.current[d.number] = 0;
    }

    maxTRef.current = data.drivers.reduce(
      (m, d) => (d.frames.length ? Math.max(m, d.frames[d.frames.length - 1].t) : m),
      0
    );
  }, [data]);

  // ── 렌더 루프 ──────────────────────────────────────
  useEffect(() => {
    if (!data) return;
    const cv = canvasRef.current;
    const wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const b = data.bounds;
    const pad = 46;

    const frameAt = (d: Driver, t: number): Frame => {
      const fr = d.frames;
      const k = d.number;
      let p = ptrRef.current[k] ?? 0;
      if (p > fr.length - 1) p = fr.length - 1;
      while (p < fr.length - 1 && fr[p + 1].t <= t) p++;
      while (p > 0 && fr[p].t > t) p--;
      ptrRef.current[k] = p;
      const a = fr[p];
      const nx = fr[Math.min(p + 1, fr.length - 1)];
      const sp = nx.t - a.t;
      const r = sp > 0 ? Math.min(1, Math.max(0, (t - a.t) / sp)) : 0;
      const drs = DRS_ON.includes(nx.drs ?? -1) ? nx.drs : a.drs;
      const dist = distRef.current[k];
      const d0 = dist ? dist[p] : 0;
      const d1 = dist ? dist[Math.min(p + 1, fr.length - 1)] : 0;
      return {
        t, x: a.x + (nx.x - a.x) * r, y: a.y + (nx.y - a.y) * r,
        speed: a.speed, gear: a.gear, throttle: a.throttle, brake: a.brake,
        drs, lap: a.lap, comp: a.comp, age: a.age,
        prog: d0 + (d1 - d0) * r,
      };
    };

    const render = (t: number) => {
      const { w, h } = viewRef.current;
      if (!w || !h) return;
      const s = Math.min((w - pad * 2) / (b.maxX - b.minX), (h - pad * 2) / (b.maxY - b.minY));
      const ox = (w - (b.maxX - b.minX) * s) / 2;
      const oy = (h - (b.maxY - b.minY) * s) / 2;
      const px = (x: number) => ox + (x - b.minX) * s;
      const py = (y: number) => h - (oy + (y - b.minY) * s);

      ctx.clearRect(0, 0, w, h);

      // 트랙 아웃라인 — 분석된 한 바퀴 경로가 있으면 그것으로 그린다.
      // 원본 프레임을 그대로 겹치면 피트레인과 좌표 노이즈까지 같이 그려진다.
      const geoBase = geoRef.current;
      ctx.strokeStyle = "#1E2733";
      ctx.lineWidth = 13;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      if (geoBase) {
        const gp = geoBase.path;
        for (let i = 0; i < gp.length; i++) {
          const X = px(gp[i].x), Y = py(gp[i].y);
          i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        }
        ctx.closePath();
      } else {
        let path = data.drivers[0]?.frames ?? [];
        for (const d of data.drivers) if (d.frames.length > path.length) path = d.frames;
        for (let i = 0; i < path.length; i++) {
          const X = px(path[i].x), Y = py(path[i].y);
          i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        }
      }
      ctx.stroke();

      // ── 트랙 구조 오버레이 (F1 공식 서킷맵 스타일) ──
      const g = geoRef.current;
      if (g && showMapRef.current) {
        const N = g.path.length;
        // 화면 좌표로 미리 변환 — 오프셋을 픽셀 단위로 다루기 위해
        const S = g.path.map((p) => ({ x: px(p.x), y: py(p.y) }));

        // 폴리곤 회전 방향으로 '바깥쪽'을 한 번만 결정한다.
        // 중심점 기준으로 점마다 판정하면 오목한 구간에서 법선이 뒤집혀
        // 오프셋 선이 트랙을 가로지르며 직각으로 꺾인다.
        let area2 = 0;
        for (let i = 0; i < N; i++) {
          const a = S[i], b = S[(i + 1) % N];
          area2 += a.x * b.y - b.x * a.y;
        }
        const side = area2 > 0 ? 1 : -1;

        const outward = (i: number) => {
          const a = S[(i - 3 + N) % N], b = S[(i + 3) % N];
          const dx = b.x - a.x, dy = b.y - a.y;
          const l = Math.hypot(dx, dy) || 1;
          return { nx: (side * dy) / l, ny: (-side * dx) / l };
        };

        // 급한 코너에서는 오프셋을 줄인다.
        // 곡률 반경보다 크게 밀면 평행선이 스스로 접혀 교차한다.
        const offScale = (i: number) => {
          const a = S[(i - 3 + N) % N], b = S[i], c = S[(i + 3) % N];
          const v1x = b.x - a.x, v1y = b.y - a.y;
          const v2x = c.x - b.x, v2y = c.y - b.y;
          const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
          if (!l1 || !l2) return 1;
          const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (l1 * l2)));
          const deg = (Math.acos(cos) * 180) / Math.PI;
          return Math.max(0.35, 1 - deg / 45);
        };

        const strokeRun = (
          from: number, to: number, color: string, w: number,
          offset = 0, dash: number[] | null = null
        ) => {
          const len = (to - from + N) % N;
          ctx.strokeStyle = color;
          ctx.lineWidth = w;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          if (dash) ctx.setLineDash(dash);
          ctx.beginPath();
          for (let k = 0; k <= len; k++) {
            const i = (from + k) % N;
            let X = S[i].x, Y = S[i].y;
            if (offset) {
              const { nx, ny } = outward(i);
              const o = offset * offScale(i);
              X += nx * o; Y += ny * o;
            }
            k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
          }
          ctx.stroke();
          if (dash) ctx.setLineDash([]);
        };

        const nearestOnPath = (p: { x: number; y: number }) => {
          let best = 0, bd = Infinity;
          for (let i = 0; i < N; i++) {
            const dd = (g.path[i].x - p.x) ** 2 + (g.path[i].y - p.y) ** 2;
            if (dd < bd) { bd = dd; best = i; }
          }
          return best;
        };

        // ① 섹터 — 트랙을 덮지 않고 안쪽을 따라가는 가는 실선으로
        const secs = data.sectors ?? [];
        const i2 = secs.find((x) => x.n === 2) ? nearestOnPath(secs.find((x) => x.n === 2)!) : -1;
        const i3 = secs.find((x) => x.n === 3) ? nearestOnPath(secs.find((x) => x.n === 3)!) : -1;
        if (i2 >= 0 && i3 >= 0) {
          strokeRun(0, i2, "#E10600", 3);
          strokeRun(i2, i3, "#22D3EE", 3);
          strokeRun(i3, 0, "#FFD43B", 3);
        }

        // ② 구간 표시 — 트랙 바깥으로 평행 이동한 점선
        //  ≤2025: DRS 활성 존 (데이터로 확인된 실제 구간)
        //  2026~: 오버테이크는 활성 '존'이 없다. 랩 어디서든 쓸 수 있다.
        //         대신 액티브 에어로(X-모드)가 작동하는 주요 직선을 표시한다.
        const zoneColor = modernRef.current ? "#A78BFA" : "#39E07B";
        if (hasBoostRef.current) {
          for (const z of g.boostZones) strokeRun(z.from, z.to, zoneColor, 5, 15, [7, 5]);
        } else if (modernRef.current) {
          ctx.globalAlpha = 0.65;
          for (const z of g.straightZones) strokeRun(z.from, z.to, zoneColor, 4, 15, [5, 6]);
          ctx.globalAlpha = 1;
        }

        // ③ 디텍션 — 트랙 위 점 + 지시선 + 라벨 (위치는 추정)
        //  ≤2025: DRS 존마다 하나씩
        //  2026~: 서킷당 하나. 여기서 1초 이내면 다음 랩에 오버테이크 사용 가능
        {
          type Marker = { idx: number; x: number; y: number; label: string };
          const markers: Marker[] = hasBoostRef.current
            ? g.detections.map((d, i) => ({ ...d, label: `DRS DET ${i + 1}` }))
            : modernRef.current
              ? [
                  ...(g.overtakeDetection
                    ? [{ ...g.overtakeDetection, label: "OVERTAKE DETECTION" }]
                    : []),
                  ...(g.overtakeActivation
                    ? [{ ...g.overtakeActivation, label: "OVERTAKE ACTIVATION" }]
                    : []),
                ]
              : [];
          markers.forEach((d) => {
            const { nx, ny } = outward(d.idx);
            const p0 = S[d.idx];
            const p1 = { x: p0.x + nx * 34, y: p0.y + ny * 34 };
            ctx.strokeStyle = zoneColor;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(p0.x, p0.y, 4.5, 0, Math.PI * 2);
            if (d.label.includes("ACTIVATION")) {
              // 액티베이션은 속 빈 원으로 디텍션과 구분
              ctx.fillStyle = "#0B0C0F";
              ctx.fill();
              ctx.lineWidth = 2;
              ctx.strokeStyle = zoneColor;
              ctx.stroke();
            } else {
              ctx.fillStyle = zoneColor;
              ctx.fill();
            }
            ctx.fillStyle = zoneColor;
            ctx.font = "600 8px ui-monospace, monospace";
            const label = d.label;
            const tw = ctx.measureText(label).width;
            ctx.fillText(label, p1.x - (nx < 0 ? tw : 0), p1.y + (ny < 0 ? 9 : -3));
          });
        }

        // ④ 코너 번호 — 바깥쪽으로 밀어서 트랙과 겹치지 않게
        ctx.font = "600 10px ui-monospace, monospace";
        ctx.fillStyle = "#C9D1DA";
        for (const c of g.corners) {
          const { nx, ny } = outward(c.idx);
          const X = S[c.idx].x + nx * 19;
          const Y = S[c.idx].y + ny * 19;
          const label = String(c.n).padStart(2, "0");
          const tw = ctx.measureText(label).width;
          ctx.fillText(label, X - tw / 2, Y + 3.5);
        }

        // ⑤ 스타트/피니시 — 체커 무늬
        {
          const { nx, ny } = outward(0);
          const tx = -ny, ty = nx;  // 트랙 진행 방향
          const p0 = S[0];
          const half = 9, cell = 3;
          for (let r = -1; r <= 0; r++) {
            for (let q = -half / cell; q < half / cell; q++) {
              const on = (Math.abs(Math.floor(q)) + Math.abs(r)) % 2 === 0;
              ctx.fillStyle = on ? "#FFFFFF" : "#11151B";
              const bx = p0.x + nx * (q * cell) + tx * (r * cell);
              const by = p0.y + ny * (q * cell) + ty * (r * cell);
              ctx.fillRect(bx - cell / 2, by - cell / 2, cell, cell);
            }
          }
        }
      }

      // 차량
      const state: Record<number, Frame> = {};
      for (const d of data.drivers) state[d.number] = frameAt(d, t);
      const sel = selectedRef.current;
      for (const d of data.drivers) {
        if (d.number === sel) continue;
        const f = state[d.number];
        ctx.beginPath();
        ctx.arc(px(f.x), py(f.y), 5, 0, Math.PI * 2);
        ctx.fillStyle = d.colour;
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      const sd = data.drivers.find((d) => d.number === sel);
      if (sd) {
        const sf = state[sd.number];
        ctx.beginPath();
        ctx.arc(px(sf.x), py(sf.y), 9, 0, Math.PI * 2);
        ctx.fillStyle = sd.colour;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#fff";
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px ui-monospace, monospace";
        ctx.fillText(sd.acronym, px(sf.x) + 13, py(sf.y) + 4);
      }
      return state;
    };

    renderRef.current = (t) => { render(t); };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(rect.width * dpr);
      cv.height = Math.round(rect.height * dpr);
      cv.style.width = `${rect.width}px`;
      cv.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      viewRef.current = { w: rect.width, h: rect.height };
      const st = render(clockRef.current);
      if (st) setSnapshot(st);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const first = render(clockRef.current);
    if (first) {
      setSnapshot(first);
      setOrder(rankOrder(data.drivers, first));
    }

    let raf = 0;
    let last = 0;
    let tick = 0;
    const loop = (tsNow: number) => {
      if (!playingRef.current) return;
      if (last) clockRef.current += ((tsNow - last) / 1000) * speedRef.current;
      last = tsNow;
      if (clockRef.current >= maxTRef.current) {
        clockRef.current = maxTRef.current;
        playingRef.current = false;
        setPlaying(false);
      }
      const st = render(clockRef.current);
      tick++;
      if (st && tick % 4 === 0) {
        setSnapshot(st);
        setClock(clockRef.current);
      }
      if (st && tick % 20 === 0) setOrder(rankOrder(data.drivers, st));
      if (playingRef.current) raf = requestAnimationFrame(loop);
    };

    if (playing) {
      last = 0;
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [data, playing]);

  // ── 스크럽 ─────────────────────────────────────────
  const onScrub = (v: number) => {
    if (!data) return;
    clockRef.current = (v / 1000) * maxTRef.current;
    Object.keys(ptrRef.current).forEach((k) => { ptrRef.current[Number(k)] = 0; });
    setClock(clockRef.current);
    renderRef.current?.(clockRef.current);
    const st: Record<number, Frame> = {};
    for (const d of data.drivers) {
      const fr = d.frames;
      let p = 0;
      while (p < fr.length - 1 && fr[p + 1].t <= clockRef.current) p++;
      ptrRef.current[d.number] = p;
      const dist = distRef.current[d.number];
      st[d.number] = { ...fr[p], prog: dist ? dist[p] : 0 };
    }
    setSnapshot(st);
    setOrder(rankOrder(data.drivers, st));
  };

  // ── 로딩 / 에러 ────────────────────────────────────
  if (error && !data) {
    return (
      <div className="card state-box">
        <div className="eyebrow">데이터를 불러오지 못했습니다</div>
        <p className="state-msg">{error}</p>
        <p className="state-hint mono">다른 세션이거나 시작 오프셋을 조정해 보세요</p>
        <style>{`
          .state-box { padding: 48px; text-align: center; }
          .state-msg { margin-top: 12px; color: var(--text); }
          .state-hint { margin-top: 8px; font-size: 12px; color: var(--muted); }
        `}</style>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card state-box">
        <div className="eyebrow">BUILDING TELEMETRY</div>
        <div className="load-num display">···</div>
        <div className="load-bar"><span className="indet" /></div>
        <p className="state-hint mono">
          OpenF1 좌표 · 텔레메트리 병합 중 (첫 구간 5~15초)
        </p>
        <style>{`
          .state-box { padding: 56px 48px; text-align: center; }
          .load-num { font-size: 44px; margin: 14px 0 16px; }
          .load-bar { height: 3px; background: var(--line); overflow: hidden; max-width: 320px; margin: 0 auto; }
          .load-bar span { display: block; height: 100%; background: var(--f1-red); }
          .load-bar .indet { width: 40%; animation: slide 1.1s ease-in-out infinite; }
          @keyframes slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
          .state-hint { margin-top: 14px; font-size: 11px; color: var(--muted); }
        `}</style>
      </div>
    );
  }

  const year = data.year ?? inferYear(data.session_key);
  const modern = isModern(year);
  modernRef.current = modern;
  const sel = data.drivers.find((d) => d.number === selected) ?? data.drivers[0];
  const sf = snapshot[sel.number];
  const maxT = maxTRef.current;
  const mm = Math.floor(clock / 60);
  const ss = (clock % 60).toFixed(1).padStart(4, "0");
  const bufferPct = totalSec ? Math.min(100, (loadedSec / totalSec) * 100) : 100;

  // 선택 드라이버가 지금 해당 구간 안에 있는가.
  //  ≤2025: DRS 존 (drs 값으로 실제 작동 여부까지 알 수 있다)
  //  2026~: 액티브 에어로가 작동하는 직선. 오버테이크와는 별개 시스템이며,
  //         오버테이크는 랩 어디서나 쓸 수 있어 위치로 판정할 수 없다.
  const inZone = (() => {
    if (!geo || !sf) return false;
    const gp = geo.path;
    const NP = gp.length;
    let best = 0, bd = Infinity;
    for (let i = 0; i < NP; i++) {
      const dd = (gp[i].x - sf.x) ** 2 + (gp[i].y - sf.y) ** 2;
      if (dd < bd) { bd = dd; best = i; }
    }
    const zones = hasBoostData ? geo.boostZones : geo.straightZones;
    return zones.some(
      (z) => ((best - z.from + NP) % NP) <= ((z.to - z.from + NP) % NP)
    );
  })();

  // AI 타이어 분석
  let ai: { comp: string; age: number; cur: number; rate: number } | null = null;
  if (sel.deg_curve && sf?.comp) {
    const age = sf.age ?? 0;
    const curve = sel.deg_curve;
    const cur = curve[Math.min(age, curve.length - 1)];
    const next5 = curve[Math.min(age + 5, curve.length - 1)];
    if (cur != null && next5 != null) {
      ai = { comp: sf.comp, age, cur, rate: (next5 - cur) / 5 };
    }
  }

  return (
    <div className="replay">
      {/* 컨트롤 바 */}
      <div className="ctrl card">
        <button className="play" onClick={() => {
          if (clockRef.current >= maxT) clockRef.current = 0;
          setPlaying((p) => !p);
        }}>
          {playing ? "❚❚ 일시정지" : "▶ 재생"}
        </button>
        <div className="speeds">
          <span className="eyebrow">SPEED</span>
          {SPEEDS.map((s) => (
            <button key={s} className={`spd ${speed === s ? "on" : ""}`} onClick={() => setSpeed(s)}>
              {s}×
            </button>
          ))}
        </div>
        <span className={`era mono ${modern ? "modern" : ""}`}>
          {modern ? "OVERTAKE MODE ERA" : "DRS ERA"}
        </span>
        <button
          className={`mapbtn mono ${showMap ? "on" : ""}`}
          onClick={() => setShowMap((v) => !v)}
          title="직선·부스트존·섹터·코너 번호 표시"
        >
          TRACK MAP
        </button>
        <div className="clock display">
          {mm}:{ss}
        </div>
      </div>

      {/* 본체 */}
      <div className="body">
        <div className="track card" ref={wrapRef}>
          <span className="track-label mono">
            {data.circuit ?? `SESSION ${data.session_key}`} · {year}
            {data.session_name ? ` · ${data.session_name.toUpperCase()}` : ""} ·{" "}
            {data.drivers.length} CARS
          </span>
          <canvas ref={canvasRef} />
          {showMap && geo && (
            <div className="legend mono">
              <span><i className="sw" style={{ background: "#E10600" }} />S1</span>
              <span><i className="sw" style={{ background: "#22D3EE" }} />S2</span>
              <span><i className="sw" style={{ background: "#FFD43B" }} />S3</span>
              <span>
                <i className="sw dash" style={{ borderColor: modern ? "#A78BFA" : "#39E07B" }} />
                {hasBoostData
                  ? "DRS ZONE · DETECTION(추정)"
                  : "STRAIGHT MODE ZONE · OVERTAKE DET/ACT(추정)"}
              </span>
              <span className="dim">{geo.corners.length} CORNERS</span>
            </div>
          )}
        </div>

        <div className="side">
          {/* 선택 드라이버 디테일 */}
          <div className="card detail">
            <div className="d-head">
              <span className="dot" style={{ background: sel.colour }} />
              <span className="acr mono">{sel.acronym}</span>
              <span className="team">{sel.team ?? ""}</span>
            </div>
            <div className="speed-row">
              <span className="spd-val display">{sf?.speed ?? 0}</span>
              <span className="spd-u mono">km/h</span>
              <div className="gear">
                <b className="display">{sf?.gear === 0 || sf?.gear == null ? "N" : sf.gear}</b>
                <small className="mono">GEAR</small>
              </div>
            </div>
            <div className="bars">
              <div className="bar-row">
                <span className="bar-lbl mono">THR</span>
                <div className="bar t"><i style={{ width: `${sf?.throttle ?? 0}%` }} /></div>
              </div>
              <div className="bar-row">
                <span className="bar-lbl mono">BRK</span>
                <div className="bar b"><i style={{ width: sf?.brake ? "100%" : "0%" }} /></div>
              </div>
            </div>
            {!hasBoostData ? (
              <div className="aero-row">
                <span
                  className="aero na mono"
                  title="오버테이크 사용 가능 여부는 디텍션 지점의 간격으로 정해지며 OpenF1이 제공하지 않습니다"
                >
                  {modern ? "OVERTAKE" : "DRS"} · N/A
                </span>
                <span
                  className={`aero zone mono ${inZone ? "on" : ""}`}
                  title="액티브 에어로가 작동하는 직선 구간 (좌표 기반 추정)"
                >
                  {inZone ? "X-MODE ●" : "X-MODE"}
                </span>
              </div>
            ) : (
              <span className={`aero mono ${DRS_ON.includes(sf?.drs ?? -1) ? (modern ? "otm" : "on") : ""}`}>
                {DRS_ON.includes(sf?.drs ?? -1)
                  ? `${modern ? "OVERTAKE" : "DRS"} ●`
                  : modern ? "OVERTAKE" : "DRS"}
              </span>
            )}
          </div>

          {/* AI 타이어 분석 */}
          <div className="card ai-panel">
            <div className="ai-title mono">⬡ AI 타이어 분석</div>
            {ai ? (
              <>
                <div className="ai-stat">
                  <span className="muted">컴파운드 / 나이</span>
                  <b className="mono">{ai.comp} · {ai.age}랩</b>
                </div>
                <div className="ai-stat">
                  <span className="muted">예측 랩타임</span>
                  <b className="mono">{ai.cur.toFixed(2)}s</b>
                </div>
                <div className="ai-stat">
                  <span className="muted">마모율 (5랩)</span>
                  <b className="mono" style={{ color: ai.rate > 0.05 ? "var(--down)" : "var(--up)" }}>
                    {ai.rate >= 0 ? "+" : ""}{ai.rate.toFixed(3)}s/lap
                  </b>
                </div>
                <DegChart curve={sel.deg_curve!} age={ai.age} />
                <p className="ai-note">
                  {modern
                    ? "2026 신규 컴파운드는 마모 특성 재정립 중 — 연도별 재학습 필요."
                    : "PyTorch 회귀 모델 예측. 세로선 = 현재 타이어 나이."}
                </p>
              </>
            ) : (
              <p className="ai-note">
                {sel.deg_curve
                  ? "현재 타이어 데이터 없음 (피트/차고 구간)"
                  : "이 세션은 마모 모델이 아직 적용되지 않았습니다. 컴파운드·타이어 나이는 타워에서 확인할 수 있습니다."}
              </p>
            )}
          </div>
        </div>

        {/* 타이밍 타워 — 맨 오른쪽, 전체 높이 */}
        <div className="card tower">
          <div className="tower-head">
            <span className="eyebrow">TIMING TOWER</span>
            <span className="tower-cnt mono">{order.length}</span>
          </div>
          <div className="rows">
            {order.map((num, i) => {
              const d = data.drivers.find((x) => x.number === num);
              if (!d) return null;
              const f = snapshot[num];
              return (
                <button
                  key={num}
                  className={`row ${num === sel.number ? "sel" : ""}`}
                  onClick={() => {
                    setSelected(num);
                    renderRef.current?.(clockRef.current);
                  }}
                >
                  <span className="pos display">{i + 1}</span>
                  <span className="dot" style={{ background: d.colour }} />
                  <span className="acr mono">{d.acronym}</span>
                  <span className="lap mono">L{f?.lap ?? 1}</span>
                  <span className={`cmp mono ${f?.comp ?? ""}`}>{f?.comp ? f.comp[0] : "-"}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 스크럽 + 버퍼 */}
      <div className="scrub card">
        <div className="buf">
          <span className="buf-fill" style={{ width: `${bufferPct}%` }} />
        </div>
        <input
          type="range" min={0} max={1000} step={1}
          value={maxT ? (clock / maxT) * 1000 : 0}
          onChange={(e) => onScrub(Number(e.target.value))}
        />
        {loading && (
          <span className="buf-note mono">
            뒤 구간 불러오는 중 · {Math.round(loadedSec / 60)}분 / {Math.round(totalSec / 60)}분
          </span>
        )}
      </div>

      <style>{`
        .replay { display: flex; flex-direction: column; gap: 10px; }

        /* 컨트롤 */
        .ctrl { display: flex; align-items: center; gap: 20px; padding: 12px 18px; }
        .play {
          background: var(--f1-red); color: #fff; border: none;
          font-family: var(--font-display); font-weight: 600; font-size: 13px;
          padding: 9px 18px; cursor: pointer; clip-path: var(--clip-sm);
          letter-spacing: 0.04em;
        }
        .speeds { display: flex; align-items: center; gap: 6px; }
        .spd {
          background: var(--surface-2); color: var(--muted);
          border: 1px solid var(--line); font-family: var(--font-mono);
          font-size: 12px; padding: 5px 11px; cursor: pointer;
          clip-path: var(--clip-sm);
        }
        .spd:hover { color: var(--text); }
        .spd.on { color: #fff; background: var(--f1-red); border-color: var(--f1-red); }
        .era { font-size: 10px; letter-spacing: 0.12em; color: var(--muted);
          border: 1px solid var(--line); padding: 4px 9px; }
        .era.modern { color: var(--f1-red); border-color: var(--f1-red); }
        .clock { margin-left: auto; font-size: 22px; font-variant-numeric: tabular-nums; }
        .mapbtn {
          background: var(--surface-2); color: var(--muted);
          border: 1px solid var(--line); font-size: 10px;
          letter-spacing: 0.1em; padding: 5px 10px; cursor: pointer;
          clip-path: var(--clip-sm);
        }
        .mapbtn:hover { color: var(--text); }
        .mapbtn.on { color: var(--text); border-color: var(--dim); }
        .legend {
          position: absolute; left: 16px; bottom: 14px;
          display: flex; flex-wrap: wrap; gap: 12px;
          font-size: 9px; letter-spacing: 0.08em; color: var(--muted);
          pointer-events: none;
        }
        .legend span { display: flex; align-items: center; gap: 5px; }
        .legend .sw { width: 12px; height: 3px; display: inline-block; }
        .legend .sw.dash { height: 0; border-top: 2px dashed; }
        .legend .dim { color: var(--dim); }

        /* 본체 */
        .body { display: grid; grid-template-columns: 1fr 272px 216px; gap: 10px; }
        .track { position: relative; height: calc(100vh - 300px); min-height: 460px; overflow: hidden; }
        .track canvas { display: block; }
        .track-label {
          position: absolute; top: 14px; left: 16px;
          font-size: 10px; letter-spacing: 0.12em; color: var(--muted);
          pointer-events: none;
        }

        .side { display: flex; flex-direction: column; gap: 10px;
          height: calc(100vh - 300px); min-height: 460px; }

        /* 타워 — 맨 오른쪽 전체 높이 */
        .tower {
          padding: 14px 10px; display: flex; flex-direction: column;
          height: calc(100vh - 300px); min-height: 460px; min-width: 0;
        }
        .tower-head {
          display: flex; justify-content: space-between; align-items: center;
          padding: 0 6px 10px; border-bottom: 1px solid var(--line); margin-bottom: 6px;
        }
        .tower-cnt { font-size: 10px; color: var(--dim); }
        .rows { display: flex; flex-direction: column; gap: 1px; overflow-y: auto; min-height: 0; flex: 1; }
        .row {
          display: grid; grid-template-columns: 18px 8px 1fr auto auto;
          align-items: center; gap: 8px; padding: 7px 6px;
          background: transparent; border: none; cursor: pointer;
          color: var(--text); text-align: left; width: 100%;
          border-left: 2px solid transparent;
        }
        .row:hover { background: var(--surface-2); }
        .row.sel { background: var(--surface-2); border-left-color: var(--f1-red); }
        .pos { font-size: 13px; color: var(--muted); text-align: center; }
        .row.sel .pos { color: var(--text); }
        .dot { width: 8px; height: 8px; border-radius: 2px; }
        .acr { font-size: 12px; font-weight: 700; letter-spacing: 0.05em; }
        .lap { font-size: 10px; color: var(--muted); }
        .cmp {
          font-size: 9px; padding: 2px 6px; border: 1px solid var(--line);
          color: var(--muted); min-width: 20px; text-align: center;
        }
        .cmp.SOFT { color: #F0506E; border-color: #F0506E55; }
        .cmp.MEDIUM { color: #FFD43B; border-color: #FFD43B55; }
        .cmp.HARD { color: var(--text); border-color: #44505E; }

        /* 디테일 */
        .detail { padding: 14px 16px; }
        .d-head { display: flex; align-items: center; gap: 9px; margin-bottom: 12px; }
        .d-head .dot { width: 11px; height: 11px; border-radius: 3px; }
        .d-head .acr { font-size: 14px; }
        .d-head .team { font-size: 10px; color: var(--muted); margin-left: auto; }
        .speed-row { display: flex; align-items: baseline; gap: 7px; margin-bottom: 12px; }
        .spd-val { font-size: 34px; line-height: 1; font-variant-numeric: tabular-nums; }
        .spd-u { font-size: 10px; color: var(--muted); }
        .gear { margin-left: auto; text-align: center; }
        .gear b { font-size: 24px; display: block; line-height: 1; }
        .gear small { font-size: 8px; color: var(--muted); letter-spacing: 0.1em; }
        .bars { display: flex; flex-direction: column; gap: 6px; margin-bottom: 10px; }
        .bar-row { display: flex; align-items: center; gap: 9px; }
        .bar-lbl { font-size: 9px; color: var(--muted); width: 22px; }
        .bar { flex: 1; height: 6px; background: var(--surface-2); overflow: hidden; }
        .bar i { display: block; height: 100%; transition: width .08s linear; }
        .bar.t i { background: var(--up); }
        .bar.b i { background: var(--down); }
        .aero {
          display: inline-block; font-size: 9px; letter-spacing: 0.12em;
          padding: 4px 9px; border: 1px solid var(--line); color: var(--muted);
        }
        .aero.on { color: #22D3EE; border-color: #22D3EE; background: rgba(34,211,238,.08); }
        .aero.otm { color: #A78BFA; border-color: #A78BFA; background: rgba(167,139,250,.08); }
        .aero.na { color: var(--dim); border-style: dashed; }
        .aero-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .aero.zone.on { color: #A78BFA; border-color: #A78BFA; background: rgba(167,139,250,.08); }

        /* AI */
        .ai-panel { padding: 14px 16px; }
        .ai-title { font-size: 10px; letter-spacing: 0.1em; color: #A78BFA;
          font-weight: 700; margin-bottom: 10px; }
        .ai-stat { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 6px; }
        .ai-stat .muted { color: var(--muted); }
        .ai-note { font-size: 10px; color: var(--muted); margin-top: 8px; line-height: 1.5; }

        /* 스크럽 */
        .scrub { padding: 12px 18px; }
        .buf { height: 2px; background: var(--line); margin-bottom: 8px; }
        .buf-fill { display: block; height: 100%; background: var(--dim); transition: width .3s; }
        .buf-note { display: block; margin-top: 6px; font-size: 10px; color: var(--muted); }
        .scrub input { width: 100%; accent-color: var(--f1-red); cursor: pointer; }

        @media (max-width: 1180px) {
          .body { grid-template-columns: 1fr 240px; }
          .tower { grid-column: 1 / -1; height: auto; min-height: 0; max-height: 280px; }
        }
        @media (max-width: 900px) {
          .body { grid-template-columns: 1fr; }
          .track { height: 52vh; min-height: 320px; }
          .side { height: auto; min-height: 0; }
          .rows { max-height: 220px; }
          .ctrl { flex-wrap: wrap; gap: 12px; }
          .clock { margin-left: 0; }
        }
      `}</style>
    </div>
  );
}

// ── 마모 곡선 미니 차트 ───────────────────────────────
function DegChart({ curve, age }: { curve: (number | null)[]; age: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d");
    if (!g) return;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = 110;
    c.width = W * dpr; c.height = H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    const vals = curve.filter((v): v is number => v != null);
    if (!vals.length) return;
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const P = 20;
    const X = (i: number) => P + (i / (curve.length - 1)) * (W - P * 1.6);
    const Y = (v: number) => H - P - ((v - mn) / (mx - mn || 1)) * (H - P * 1.8);

    g.strokeStyle = "#A78BFA";
    g.lineWidth = 2;
    g.beginPath();
    curve.forEach((v, i) => {
      if (v == null) return;
      const x = X(i), y = Y(v);
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    });
    g.stroke();

    const ax = X(Math.min(age, curve.length - 1));
    g.strokeStyle = "#22D3EE";
    g.lineWidth = 1.5;
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(ax, P * 0.5);
    g.lineTo(ax, H - P * 0.7);
    g.stroke();
    g.setLineDash([]);

    g.fillStyle = "#7A8290";
    g.font = "10px ui-monospace, monospace";
    g.fillText(`${mn.toFixed(0)}s`, 2, Y(mn));
    g.fillText("age", W - 22, H - 4);
  }, [curve, age]);

  return <canvas ref={ref} style={{ width: "100%", height: 110, display: "block", marginTop: 8 }} />;
}