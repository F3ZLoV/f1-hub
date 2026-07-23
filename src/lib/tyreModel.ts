/**
 * 타이어 마모 예측 — PyTorch 모델(5→32→16→1 MLP)의 TS 이식.
 *
 * 학습은 파이썬(train_tyre_model.py), 추론은 여기서.
 * export_tyre_model.py 가 만든 tyre_model.json 의 가중치로
 * forward pass 만 수행하므로 런타임 의존성이 없다.
 *
 * 입력: compound(원-핫) + tyre_life + lap_number (수치는 표준화)
 * 출력: 예상 랩타임(초)
 */
import model from "./tyre_model.json";

type Layer = { w: number[][]; b: number[] };

const COMPOUNDS: string[] = model.compounds;
const MEAN: number[] = model.mean;
const STD: number[] = model.std;
const LAYERS: Layer[] = model.layers as Layer[];

/** y = Wx + b (W: [out][in]) */
function linear(x: number[], layer: Layer): number[] {
  const { w, b } = layer;
  const out = new Array<number>(b.length);
  for (let i = 0; i < b.length; i++) {
    const row = w[i];
    let sum = b[i];
    for (let j = 0; j < row.length; j++) sum += row[j] * x[j];
    out[i] = sum;
  }
  return out;
}

const relu = (v: number[]) => v.map((n) => (n > 0 ? n : 0));

/** 예상 랩타임(초). 학습에 없는 컴파운드면 null. */
export function predictLapTime(
  compound: string,
  tyreLife: number,
  lapNumber: number
): number | null {
  const idx = COMPOUNDS.indexOf(compound);
  if (idx < 0) return null;

  const x: number[] = [
    ...COMPOUNDS.map((_, i) => (i === idx ? 1 : 0)),
    (tyreLife - MEAN[0]) / STD[0],
    (lapNumber - MEAN[1]) / STD[1],
  ];

  let h = x;
  for (let i = 0; i < LAYERS.length; i++) {
    h = linear(h, LAYERS[i]);
    if (i < LAYERS.length - 1) h = relu(h); // 마지막 층은 활성함수 없음
  }
  return h[0];
}

/**
 * 마모 곡선 — 타이어 나이 0..maxAge 의 예상 랩타임 배열.
 * 대시보드 AI 패널이 그대로 그린다. (build_replay_full.py 와 동일하게 lap 15 기준)
 */
export function degradationCurve(
  compound: string | null | undefined,
  maxAge = 35,
  lapNumber = 15
): (number | null)[] | null {
  if (!compound || COMPOUNDS.indexOf(compound) < 0) return null;
  const curve: (number | null)[] = [];
  for (let age = 0; age <= maxAge; age++) {
    const v = predictLapTime(compound, age, lapNumber);
    curve.push(v == null ? null : Math.round(v * 100) / 100);
  }
  return curve;
}

export const MODEL_COMPOUNDS = COMPOUNDS;
