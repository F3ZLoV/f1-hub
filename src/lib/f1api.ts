/**
 * F1 데이터 API 클라이언트
 *  - Jolpica (Ergast 후속): 스케줄·스탠딩·결과  https://api.jolpi.ca/ergast/f1
 *  - OpenF1: 드라이버 이미지·팀컬러·텔레메트리   https://api.openf1.org/v1
 */

const JOLPICA = "https://api.jolpi.ca/ergast/f1";
const OPENF1 = "https://api.openf1.org/v1";

// ── 타입 ──────────────────────────────────────────────
export interface Circuit {
  circuitId: string;
  circuitName: string;
  Location: { locality: string; country: string; lat: string; long: string };
}
export interface SessionTime {
  date: string;
  time?: string;
}
export interface Race {
  season: string;
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit: Circuit;
  // 주말 세션 일정 (2021+ 데이터에 존재, 시각은 UTC)
  FirstPractice?: SessionTime;
  SecondPractice?: SessionTime;
  ThirdPractice?: SessionTime;
  Qualifying?: SessionTime;
  Sprint?: SessionTime;
  SprintQualifying?: SessionTime;
  SprintShootout?: SessionTime;
}
export interface Driver {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  givenName: string;
  familyName: string;
  nationality: string;
}
export interface Constructor {
  constructorId: string;
  name: string;
  nationality: string;
}
export interface DriverStanding {
  position: string;
  points: string;
  wins: string;
  Driver: Driver;
  Constructors: Constructor[];
}
export interface ConstructorStanding {
  position: string;
  points: string;
  wins: string;
  Constructor: Constructor;
}
export interface RaceResult {
  position: string;
  points: string;
  grid: string;
  laps: string;
  status: string;
  Driver: Driver;
  Constructor: Constructor;
  Time?: { time: string };
  FastestLap?: {
    rank: string;
    lap?: string;
    Time?: { time: string };
    AverageSpeed?: { units: string; speed: string };
  };
}
export interface RaceWithResults extends Race {
  Results: RaceResult[];
}
export interface QualifyingResult {
  position: string;
  number: string;
  Driver: Driver;
  Constructor: Constructor;
  Q1?: string;
  Q2?: string;
  Q3?: string;
}
export interface RaceWithQualifying extends Race {
  QualifyingResults: QualifyingResult[];
}
/** OpenF1 드라이버 메타 (이미지·팀컬러) */
export interface OpenF1Driver {
  driver_number: number;
  full_name: string;
  name_acronym: string;
  headshot_url?: string;
  team_colour?: string;
  team_name?: string;
}

// ── fetch 헬퍼 ────────────────────────────────────────
async function jolpica<T>(path: string): Promise<T> {
  // 정적 사이트라 브라우저에서 직접 호출 (Jolpica는 공개 API, CORS 허용)
  const res = await fetch(`${JOLPICA}/${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Jolpica ${res.status}: ${path}`);
  return res.json();
}

// ── Jolpica 엔드포인트 ────────────────────────────────
export async function getSchedule(season: string | number = "current"): Promise<Race[]> {
  const data = await jolpica<any>(`${season}/races/?limit=30`);
  return data?.MRData?.RaceTable?.Races ?? [];
}
export async function getDriverStandings(
  season: string | number = "current"
): Promise<DriverStanding[]> {
  const data = await jolpica<any>(`${season}/driverstandings/?limit=40`);
  return data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings ?? [];
}
export async function getConstructorStandings(
  season: string | number = "current"
): Promise<ConstructorStanding[]> {
  const data = await jolpica<any>(`${season}/constructorstandings/?limit=40`);
  return data?.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings ?? [];
}
export async function getNextRace(season: string | number = "current"): Promise<Race | null> {
  const races = await getSchedule(season);
  const now = new Date();
  return races.find((r) => new Date(`${r.date}T${r.time ?? "00:00:00Z"}`) >= now) ?? null;
}

/** 한 시즌의 모든 레이스 결과 (완료된 것만) */
/** 시즌 결과 파일 캐시 (S3+CloudFront 에 구운 것). 없으면 null */
const seasonFileCache = new Map<string, RaceWithResults[] | null>();

async function loadSeasonFile(
  season: string | number
): Promise<RaceWithResults[] | null> {
  const key = String(season);
  if (seasonFileCache.has(key)) return seasonFileCache.get(key)!;
  let val: RaceWithResults[] | null = null;
  try {
    // 같은 오리진(CloudFront) — 엣지 캐시에서 바로 나온다
    const res = await fetch(`/data/results-${key}.json`);
    if (res.ok) val = await res.json();
  } catch {
    /* 캐시 없으면 Jolpica 로 폴백 */
  }
  seasonFileCache.set(key, val);
  return val;
}

/**
 * 시즌 우승자 목록 (레이스당 1행) — 결과 페이지 목록·선택기용.
 * Jolpica 는 limit 상한이 100 이라 전체 결과(20명×24전)를 한 번에 못 받는다.
 * 목록에는 우승자만 필요하므로 position=1 필터로 받아 24행으로 끝낸다.
 */
export async function getSeasonWinners(
  season: string | number
): Promise<RaceWithResults[]> {
  const cached = await loadSeasonFile(season);
  if (cached) return cached.map((r) => ({ ...r, Results: r.Results.slice(0, 1) }));
  const data = await jolpica<any>(`${season}/results/1/?limit=100`);
  return data?.MRData?.RaceTable?.Races ?? [];
}

/** 특정 라운드의 전체 순위 */
export async function getRoundResults(
  season: string | number,
  round: string | number
): Promise<RaceWithResults | null> {
  const cached = await loadSeasonFile(season);
  if (cached) return cached.find((r) => r.round === String(round)) ?? null;
  const data = await jolpica<any>(`${season}/${round}/results/?limit=100`);
  return data?.MRData?.RaceTable?.Races?.[0] ?? null;
}

export async function getRaceResults(season: string | number, round: string | number) {
  const data = await jolpica<any>(`${season}/${round}/results/?limit=30`);
  return data?.MRData?.RaceTable?.Races?.[0] ?? null;
}

// ── OpenF1: 드라이버 이미지·팀컬러 ────────────────────
/**
 * 최신 세션의 드라이버 메타(headshot, team_colour)를 driver_number → 정보로 맵.
 * OpenF1은 Jolpica와 별개라, name_acronym(VER 등)으로 매칭한다.
 * 실패해도 페이지는 떠야 하므로 빈 맵 반환.
 */
export async function getDriverMeta(): Promise<Record<string, OpenF1Driver>> {
  try {
    const year = new Date().getFullYear();
    // 1) 올해 Race 세션들을 조회 (가장 최근 완료 세션의 라인업이 최신)
    const sessRes = await fetch(
      `${OPENF1}/sessions?year=${year}&session_type=Race`
    );
    let sessionKey: number | null = null;
    if (sessRes.ok) {
      const sessions: { session_key: number; date_start: string }[] = await sessRes.json();
      if (sessions.length) {
        // 가장 최근 세션
        sessions.sort((a, b) => b.date_start.localeCompare(a.date_start));
        sessionKey = sessions[0].session_key;
      }
    }
    // 2) 세션 못 찾으면 latest 폴백
    const url = sessionKey
      ? `${OPENF1}/drivers?session_key=${sessionKey}`
      : `${OPENF1}/drivers?meeting_key=latest`;
    const res = await fetch(url);
    if (!res.ok) return {};
    const list: OpenF1Driver[] = await res.json();
    const map: Record<string, OpenF1Driver> = {};
    for (const d of list) {
      if (d.name_acronym) map[d.name_acronym.toUpperCase()] = d;
    }
    return map;
  } catch {
    return {};
  }
}

/**
 * 서킷 레이아웃 이미지 URL (OpenF1 meetings의 circuit_image).
 * 국가명으로 조회. 실패하면 null → 폴백 처리.
 */
export async function getCircuitImage(
  countryName: string,
  year: number
): Promise<string | null> {
  try {
    const res = await fetch(
      `${OPENF1}/meetings?year=${year}&country_name=${encodeURIComponent(countryName)}`
    );
    if (!res.ok) return null;
    const meetings: { circuit_image?: string }[] = await res.json();
    return meetings[0]?.circuit_image ?? null;
  } catch {
    return null;
  }
}

// ── 드라이버 상세 ─────────────────────────────────────
export interface DriverSeasonRace {
  season: string;
  round: string;
  raceName: string;
  date: string;
  Circuit: Circuit;
  Results: RaceResult[];
}

/** 드라이버 기본 정보 */
export async function getDriverInfo(driverId: string): Promise<Driver | null> {
  const data = await jolpica<any>(`drivers/${driverId}/`);
  return data?.MRData?.DriverTable?.Drivers?.[0] ?? null;
}

/** 특정 시즌, 특정 드라이버의 라운드별 결과 */
export async function getDriverSeasonResults(
  season: string | number,
  driverId: string
): Promise<DriverSeasonRace[]> {
  const data = await jolpica<any>(`${season}/drivers/${driverId}/results/?limit=40`);
  return data?.MRData?.RaceTable?.Races ?? [];
}

/** 특정 시즌 드라이버의 챔피언십 순위 한 줄 */
export async function getDriverStandingForSeason(
  season: string | number,
  driverId: string
): Promise<DriverStanding | null> {
  const data = await jolpica<any>(`${season}/drivers/${driverId}/driverstandings/`);
  return (
    data?.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings?.[0] ?? null
  );
}

/** 드라이버가 출전한 시즌 목록 (최신순) */
export async function getDriverSeasons(driverId: string): Promise<string[]> {
  const data = await jolpica<any>(`drivers/${driverId}/seasons/?limit=40`);
  const seasons: { season: string }[] = data?.MRData?.SeasonTable?.Seasons ?? [];
  return seasons.map((s) => s.season).reverse();
}


/** 예선 결과 파일 캐시 (S3+CloudFront) */
const qualiFileCache = new Map<string, RaceWithQualifying[] | null>();

async function loadQualifyingFile(
  season: string | number
): Promise<RaceWithQualifying[] | null> {
  const key = String(season);
  if (qualiFileCache.has(key)) return qualiFileCache.get(key)!;
  let val: RaceWithQualifying[] | null = null;
  try {
    const res = await fetch(`/data/qualifying-${key}.json`);
    if (res.ok) val = await res.json();
  } catch {
    /* 캐시 없으면 Jolpica 로 폴백 */
  }
  qualiFileCache.set(key, val);
  return val;
}

/** 특정 라운드 예선 결과 */
export async function getQualifying(
  season: string | number,
  round: string | number
): Promise<QualifyingResult[]> {
  const cached = await loadQualifyingFile(season);
  if (cached) {
    return cached.find((r) => r.round === String(round))?.QualifyingResults ?? [];
  }
  const data = await jolpica<any>(`${season}/${round}/qualifying/?limit=100`);
  return data?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults ?? [];
}
