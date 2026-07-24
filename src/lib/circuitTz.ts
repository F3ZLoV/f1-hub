/**
 * 서킷 → IANA 타임존.
 *
 * Jolpica 는 세션 시각을 UTC 로만 주고 좌표(lat/long)도 함께 주지만,
 * 좌표에서 타임존을 얻으려면 별도의 지리 데이터베이스가 필요하다.
 * F1 서킷은 수십 개뿐이므로 직접 매핑하는 편이 정확하고 가볍다.
 *
 * IANA 존을 쓰면 브라우저의 Intl 이 서머타임까지 알아서 처리한다.
 * (예: 실버스톤은 여름엔 BST, 겨울엔 GMT)
 */

const TZ: Record<string, string> = {
  // 아시아·오세아니아
  albert_park: "Australia/Melbourne",
  bahrain: "Asia/Bahrain",
  jeddah: "Asia/Riyadh",
  losail: "Asia/Qatar",
  marina_bay: "Asia/Singapore",
  suzuka: "Asia/Tokyo",
  shanghai: "Asia/Shanghai",
  yas_marina: "Asia/Dubai",
  baku: "Asia/Baku",
  sepang: "Asia/Kuala_Lumpur",
  buddh: "Asia/Kolkata",
  yeongam: "Asia/Seoul",

  // 유럽
  imola: "Europe/Rome",
  monza: "Europe/Rome",
  mugello: "Europe/Rome",
  catalunya: "Europe/Madrid",
  madring: "Europe/Madrid",
  jerez: "Europe/Madrid",
  monaco: "Europe/Monaco",
  silverstone: "Europe/London",
  brands_hatch: "Europe/London",
  red_bull_ring: "Europe/Vienna",
  ricard: "Europe/Paris",
  magny_cours: "Europe/Paris",
  hungaroring: "Europe/Budapest",
  spa: "Europe/Brussels",
  zandvoort: "Europe/Amsterdam",
  nurburgring: "Europe/Berlin",
  hockenheimring: "Europe/Berlin",
  istanbul: "Europe/Istanbul",
  portimao: "Europe/Lisbon",
  estoril: "Europe/Lisbon",
  sochi: "Europe/Moscow",

  // 아메리카
  miami: "America/New_York",
  villeneuve: "America/Toronto",
  americas: "America/Chicago",
  rodriguez: "America/Mexico_City",
  interlagos: "America/Sao_Paulo",
  vegas: "America/Los_Angeles",
  indianapolis: "America/Indiana/Indianapolis",
  detroit: "America/Detroit",
};

/** 매핑에 없으면 null — 호출 측에서 UTC 로 폴백한다 */
export function circuitTimezone(circuitId?: string): string | null {
  if (!circuitId) return null;
  return TZ[circuitId] ?? null;
}

/** 사용자 브라우저의 타임존 (SSR/정적 빌드 대비 폴백 포함) */
export function userTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** 타임존 짧은 이름 (KST, BST 등). 못 구하면 존 이름의 마지막 조각 */
export function tzLabel(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone.split("/").pop() ?? timeZone;
  }
}

/** "Fri 25 Jul 15:00" 형식 */
export function formatIn(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return date.toISOString().slice(5, 16).replace("T", " ");
  }
}
