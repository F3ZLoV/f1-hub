/**
 * 트랙 지오메트리 분석 — 주행 좌표만으로 서킷 구조를 추출한다.
 *
 * OpenF1 은 코너 번호도, DRS 존 좌표도, 직선 구간도 주지 않는다.
 * 하지만 차가 실제로 지나간 경로(x, y)와 부스트 사용 여부(drs)가 있으므로
 * 아래를 계산으로 뽑아낼 수 있다.
 *
 *   코너/직선 → 경로의 곡률 (방향이 얼마나 빨리 꺾이는가)
 *   부스트 존 → 실제로 활성된 지점들을 경로에 투영해 군집 탐색
 *   디텍션   → 존 시작점에서 일정 거리 앞 (※ 데이터에 없어 추정값)
 *
 * 섹터 경계만 서버(랩 데이터의 섹터 소요시간 역산)에서 받는다.
 */

import type { Driver, Frame } from "@/components/replay/useReplayData";

export type Pt = { x: number; y: number };

export type TrackGeometry = {
  path: Pt[];                                   // 등간격 리샘플된 한 바퀴
  corners: { n: number; idx: number; x: number; y: number }[];
  straights: { from: number; to: number }[];
  boostZones: { from: number; to: number }[];   // 데이터로 확인된 DRS 활성 구간
  /** 가장 긴 직선 3곳 — 2026 액티브 에어로(X-모드) 구간 추정 */
  straightZones: { from: number; to: number }[];
  /** DRS 디텍션 — 존마다 하나씩 (2011~2025) */
  detections: { idx: number; x: number; y: number }[];
  /** 오버테이크 디텍션 — 서킷당 하나 (2026~). 공식 맵 기준 추정값 */
  overtakeDetection: { idx: number; x: number; y: number } | null;
  /** 오버테이크 액티베이션 — 주 직선 진입점 (2026~) */
  overtakeActivation: { idx: number; x: number; y: number } | null;
  unitsPerMeter: number;                        // 좌표 단위 → 미터 환산 근사
};

const SAMPLES = 420;          // 한 바퀴를 몇 점으로 리샘플할지 (≈12m/샘플)
const CURV_WINDOW = 3;        // 곡률 계산 창 (샘플 수)
const CORNER_DEG = 5;         // 샘플당 이 각도 이상 꺾이면 코너 후보
const CORNER_MERGE = 4;       // 이만큼 이내로 붙은 코너 후보는 한 코너로
const MIN_CORNER_TURN = 18;   // 구간 누적 회전각(도) — 완만한 굴곡 걸러내기
const MIN_STRAIGHT = 12;      // 직선으로 인정할 최소 샘플 수
const BOOST_RATIO = 0.25;     // 최대 사용량 대비 이 비율 이상이면 존
const BOOST_MERGE = 14;       // 드라이버별 편차로 갈라진 조각 병합
const MIN_BOOST = 22;         // DRS 존은 보통 600m+ → 최소 샘플 수
const ASSUMED_LAP_M = 5000;   // F1 서킷 평균 랩 길이 — 단위 환산 근사용
const DETECT_BEFORE_M = 220;  // 디텍션 추정 거리 (존 시작 앞)

const DRS_ON = [10, 12, 14];

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * 한 바퀴 분량의 프레임 추출.
 * 프레임 수가 아니라 '시작점과 끝점이 얼마나 잘 만나는가'로 고른다.
 * 피트인/아웃 랩은 경로가 닫히지 않으므로 자연스럽게 배제된다.
 */
function referenceLap(drivers: Driver[]): Frame[] | null {
  let best: Frame[] | null = null;
  let bestScore = Infinity;

  for (const d of drivers) {
    if (d.frames.length < 60) continue;
    const byLap = new Map<number, Frame[]>();
    for (const f of d.frames) {
      const l = f.lap ?? 0;
      const arr = byLap.get(l) ?? [];
      arr.push(f);
      byLap.set(l, arr);
    }
    for (const arr of byLap.values()) {
      if (arr.length < 60) continue;
      let len = 0;
      for (let i = 1; i < arr.length; i++) len += dist(arr[i - 1], arr[i]);
      if (len <= 0) continue;
      // 닫힘 정도 — 0에 가까울수록 온전한 한 바퀴
      const score = dist(arr[0], arr[arr.length - 1]) / len;
      if (score < bestScore) { bestScore = score; best = arr; }
    }
  }

  if (best) return best;
  // 랩 정보가 부실하면 가장 긴 궤적으로 폴백
  const ref = drivers.reduce(
    (a, b) => (b.frames.length > a.frames.length ? b : a),
    drivers[0]
  );
  return ref && ref.frames.length >= 40 ? ref.frames : null;
}

/** 좌표 노이즈 완화 — 곡률 판정과 오프셋 선을 부드럽게 */
function smooth(path: Pt[], w = 2): Pt[] {
  const n = path.length;
  return path.map((_, i) => {
    let sx = 0, sy = 0;
    for (let k = -w; k <= w; k++) {
      const p = path[(i + k + n) % n];
      sx += p.x; sy += p.y;
    }
    const c = w * 2 + 1;
    return { x: sx / c, y: sy / c };
  });
}

/** 경로를 등간격으로 리샘플 — 곡률 계산이 샘플 밀도에 휘둘리지 않게 */
function resample(frames: Frame[], n: number): Pt[] {
  const pts: Pt[] = frames.map((f) => ({ x: f.x, y: f.y }));
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  const total = cum[cum.length - 1];
  if (!total) return pts;

  const out: Pt[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / n;
    while (j < cum.length - 2 && cum[j + 1] < target) j++;
    const span = cum[j + 1] - cum[j];
    const r = span > 0 ? (target - cum[j]) / span : 0;
    out.push({
      x: pts[j].x + (pts[j + 1].x - pts[j].x) * r,
      y: pts[j].y + (pts[j + 1].y - pts[j].y) * r,
    });
  }
  return out;
}

/** 각 샘플에서의 진행 방향 변화량(도) */
function curvature(path: Pt[], w: number): number[] {
  const n = path.length;
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const a = path[(i - w + n) % n];
    const b = path[i];
    const c = path[(i + w) % n];
    const v1x = b.x - a.x, v1y = b.y - a.y;
    const v2x = c.x - b.x, v2y = c.y - b.y;
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
    if (!l1 || !l2) continue;
    const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (l1 * l2)));
    out[i] = (Math.acos(cos) * 180) / Math.PI;
  }
  return out;
}

/** 연속 구간 묶기 (원형 트랙이므로 끝과 처음이 이어질 수 있음) */
function groupRuns(flags: boolean[]): { from: number; to: number }[] {
  const n = flags.length;
  const runs: { from: number; to: number }[] = [];
  let i = 0;
  while (i < n && flags[i]) i++;          // 첫 false 부터 시작해 wrap 처리
  if (i === n) return [{ from: 0, to: n - 1 }];
  const start = i;
  let cur: number | null = null;
  for (let k = 0; k < n; k++) {
    const idx = (start + k) % n;
    if (flags[idx]) {
      if (cur === null) cur = idx;
    } else if (cur !== null) {
      runs.push({ from: cur, to: (idx - 1 + n) % n });
      cur = null;
    }
  }
  if (cur !== null) runs.push({ from: cur, to: (start - 1 + n) % n });
  return runs;
}

/** 구간 길이 (원형) */
const runLen = (r: { from: number; to: number }, n: number) =>
  (r.to - r.from + n) % n;

/**
 * 사이가 좁게 벌어진 구간들을 하나로 합친다.
 * DRS 존은 드라이버마다 활성 지점이 조금씩 달라 조각나고,
 * 코너도 복합 코너가 여러 개로 잡히므로 병합이 필요하다.
 */
function mergeRuns(
  runs: { from: number; to: number }[],
  n: number,
  maxGap: number
): { from: number; to: number }[] {
  if (runs.length < 2) return runs;
  const sorted = [...runs].sort((a, b) => a.from - b.from);
  const out: { from: number; to: number }[] = [];
  let cur = { ...sorted[0] };
  for (let i = 1; i < sorted.length; i++) {
    const gap = (sorted[i].from - cur.to + n) % n;
    if (gap <= maxGap) cur.to = sorted[i].to;
    else { out.push(cur); cur = { ...sorted[i] }; }
  }
  out.push(cur);
  // 마지막 구간과 첫 구간이 스타트/피니시를 넘어 이어지는 경우
  if (out.length > 1) {
    const last = out[out.length - 1];
    const gap = (out[0].from - last.to + n) % n;
    if (gap <= maxGap) {
      out[0] = { from: last.from, to: out[0].to };
      out.pop();
    }
  }
  return out;
}

/** 좌표계 상의 점을 경로에서 가장 가까운 샘플 인덱스로 투영 */
function nearestIdx(path: Pt[], p: Pt): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = (path[i].x - p.x) ** 2 + (path[i].y - p.y) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

export function analyzeTrack(
  drivers: Driver[],
  /** 서킷별 공표 위치(랩 진행률). 있으면 기하학적 추정 대신 이 값을 쓴다 */
  override?: { detection?: number; activation?: number } | null
): TrackGeometry | null {
  const lap = referenceLap(drivers);
  if (!lap || lap.length < 40) return null;

  // 원본보다 과하게 촘촘히 리샘플하면 보간 노이즈가 곡률로 잡힌다.
  // 1Hz 로 받은 랩은 점이 100여 개뿐이므로 샘플 수를 그에 맞춘다.
  const N = Math.max(180, Math.min(SAMPLES, lap.length * 3));
  const path = smooth(resample(lap, N), 2);
  if (path.length < 40) return null;

  // 랩 길이(좌표 단위) → 미터 환산 근사
  let lapLen = 0;
  for (let i = 1; i < path.length; i++) lapLen += dist(path[i - 1], path[i]);
  lapLen += dist(path[path.length - 1], path[0]);
  const unitsPerMeter = lapLen / ASSUMED_LAP_M;

  // ── 코너 / 직선 ──
  const curv = curvature(path, CURV_WINDOW);
  const isCorner = curv.map((c) => c >= CORNER_DEG);

  // 붙어 있는 후보들을 한 코너로 합치고, 누적 회전각이 작은 굴곡은 버린다
  const cornerRuns = mergeRuns(groupRuns(isCorner), N, CORNER_MERGE).filter(
    (run) => {
      let turn = 0;
      const len = runLen(run, N);
      for (let k = 0; k <= len; k++) turn += curv[(run.from + k) % N];
      return turn >= MIN_CORNER_TURN;
    }
  );

  const corners = cornerRuns
    .map((run) => {
      // 구간 내 최대 곡률 지점을 정점으로
      let best = run.from, bv = -1;
      const len = runLen(run, N);
      for (let k = 0; k <= len; k++) {
        const i = (run.from + k) % N;
        if (curv[i] > bv) { bv = curv[i]; best = i; }
      }
      return { idx: best, x: path[best].x, y: path[best].y };
    })
    // 스타트/피니시(인덱스 0) 기준 순서대로 번호 부여
    .sort((a, b) => a.idx - b.idx)
    .map((c, i) => ({ n: i + 1, ...c }));

  const straights = groupRuns(isCorner.map((c) => !c)).filter(
    (r) => runLen(r, N) >= MIN_STRAIGHT
  );

  // ── 부스트(DRS/오버테이크) 존 ──
  const hits = new Array<number>(N).fill(0);
  for (const d of drivers) {
    for (const f of d.frames) {
      if (!DRS_ON.includes(f.drs ?? -1)) continue;
      hits[nearestIdx(path, f)]++;
    }
  }
  // 드라이버마다 활성 지점이 달라 조각나므로 병합 후 길이로 거른다.
  // 실제 DRS 존은 600m 이상이라 짧은 조각은 노이즈로 본다.
  const peak = Math.max(...hits);
  const boostZones = peak > 0
    ? mergeRuns(
        groupRuns(hits.map((h) => h >= peak * BOOST_RATIO)),
        N,
        BOOST_MERGE
      ).filter((r) => runLen(r, N) >= MIN_BOOST)
    : [];

  // ── 대체 존 — 활성 데이터가 없을 때 쓸 가장 긴 직선 3곳 ──
  const straightZones = [...straights]
    .sort((a, b) => runLen(b, N) - runLen(a, N))
    .slice(0, 3);

  // ── 디텍션 (추정) ──
  // 실제 디텍션 라인 좌표는 어느 API에도 없다. 존 시작점 기준으로 역산한다.
  const backSamples = Math.round((DETECT_BEFORE_M * unitsPerMeter) / (lapLen / N));
  const at = (i: number) => ({ idx: i, x: path[i].x, y: path[i].y });

  // DRS 시대: 존마다 디텍션이 하나씩
  const detections = boostZones.map((z) =>
    at((z.from - backSamples + N * 2) % N)
  );

  // 2026 오버테이크: 활성 '존'이 없고 지점이 두 곳이다.
  //   액티베이션 — 주 직선 진입점
  //   디텍션     — 그 직선으로 들어가기 전 마지막 코너 앞
  // (공식 서킷맵의 배치를 따른 추정. 실제 좌표는 어느 API에도 없다)
  let overtakeActivation: { idx: number; x: number; y: number } | null = null;
  let overtakeDetection: { idx: number; x: number; y: number } | null = null;

  // 공표된 값이 있으면 그대로 쓴다 (랩 진행률 → 샘플 인덱스)
  const frac = (f: number) => Math.round(((f % 1) + 1) % 1 * N) % N;
  if (override?.activation != null) overtakeActivation = at(frac(override.activation));
  if (override?.detection != null) overtakeDetection = at(frac(override.detection));

  if (straightZones.length && (!overtakeActivation || !overtakeDetection)) {
    const act = straightZones[0].from;
    if (!overtakeActivation) overtakeActivation = at(act);

    // 액티베이션 직전에 있는 코너를 찾아 그보다 조금 앞에 디텍션을 둔다
    let prevCorner: number | null = null;
    let bestGap = Infinity;
    for (const c of corners) {
      const gap = (act - c.idx + N) % N;
      if (gap > 0 && gap < bestGap) { bestGap = gap; prevCorner = c.idx; }
    }
    // 디텍션이 액티베이션에서 너무 멀어지지 않게 제한 (랩의 1/8 이내)
    const maxBack = Math.round(N / 8);
    const rawBack =
      prevCorner != null
        ? ((act - prevCorner + N) % N) + Math.round(backSamples * 0.5)
        : backSamples * 2;
    const detIdx = (act - Math.min(rawBack, maxBack) + N * 2) % N;
    if (!overtakeDetection) overtakeDetection = at(detIdx);
  }

  return {
    path, corners, straights, boostZones, straightZones,
    detections, overtakeDetection, overtakeActivation, unitsPerMeter,
  };
}