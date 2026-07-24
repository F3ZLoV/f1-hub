/**
 * 서킷별 오버테이크 디텍션 / 액티베이션 위치.
 *
 * 이 좌표는 FIA 가 서킷마다 공표하지만 어떤 API 도 제공하지 않는다.
 * 좌표에서 기하학적으로 추정하면 서킷 모양에 따라 맞기도 하고 크게 빗나가기도 하므로,
 * 공식 서킷맵에서 읽은 값을 여기에 기록해 정확도를 확보한다.
 *
 * 값은 **랩 진행률**(0 = 스타트/피니시 라인, 1 = 한 바퀴)이다.
 * 좌표계나 트랙 방향에 의존하지 않아 서킷이 바뀌어도 그대로 쓸 수 있다.
 *
 * ── 값 읽는 법 ────────────────────────────────────────
 *  1. formula1.com 의 해당 그랑프리 서킷맵을 연다
 *  2. 스타트/피니시에서 진행 방향으로 몇 % 지점에 마커가 있는지 가늠한다
 *     (코너 번호가 균등하지 않으므로 거리 비율로 보는 게 정확하다)
 *  3. 아래에 추가한다. 값이 없는 서킷은 자동 추정으로 폴백한다.
 *
 * 키는 OpenF1 의 circuit_short_name 을 정규화한 것이다(소문자, 공백·하이픈 제거).
 */

export type CircuitPoints = {
  /** 오버테이크 디텍션 — 여기서 앞차와 1초 이내면 다음 랩에 사용 가능 */
  detection?: number;
  /** 오버테이크 액티베이션 — 사용 가능해지는 지점 */
  activation?: number;
};

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.]/g, "");

/**
 * 확인된 서킷만 채운다. 추정보다 나은 값이 없으면 비워 두는 편이 낫다.
 * (비어 있으면 trackGeometry 의 기하학적 추정이 쓰인다)
 */
const TABLE: Record<string, CircuitPoints> = {
  // 예시 — 공식 맵에서 읽은 뒤 주석을 풀고 값을 넣는다
  // spafrancorchamps: { detection: 0.80, activation: 0.02 },
  // monza:            { detection: 0.86, activation: 0.00 },
  // silverstone:      { detection: 0.72, activation: 0.94 },
};

export function circuitPoints(circuitShortName?: string): CircuitPoints | null {
  if (!circuitShortName) return null;
  return TABLE[norm(circuitShortName)] ?? null;
}