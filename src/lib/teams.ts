/** 컨스트럭터별 팀 컬러 — 방송 그래픽 accent (2024~2026 라인업) */
export const TEAM_COLORS: Record<string, string> = {
  red_bull: "#3671C6",
  ferrari: "#E8002D",
  mercedes: "#27F4D2",
  mclaren: "#FF8000",
  aston_martin: "#229971",
  alpine: "#0093CC",
  williams: "#64C4FF",
  rb: "#6692FF",
  sauber: "#52E252",
  haas: "#B6BABD",
  audi: "#009597",
  cadillac: "#c8a15a",
  alphatauri: "#5E8FAA",
  alfa: "#C92D4B",
};

export function teamColor(constructorId?: string): string {
  if (!constructorId) return "#888888";
  return TEAM_COLORS[constructorId] ?? "#888888";
}

/** 팀명 짧은 이니셜 (로고 대체 마크용) */
export const TEAM_SHORT: Record<string, string> = {
  red_bull: "RBR",
  ferrari: "FER",
  mercedes: "MER",
  mclaren: "MCL",
  aston_martin: "AMR",
  alpine: "ALP",
  williams: "WIL",
  rb: "RB",
  sauber: "SAU",
  haas: "HAAS",
  audi: "AUD",
  cadillac: "CAD",
};

export function teamShort(constructorId?: string, fallback = ""): string {
  if (!constructorId) return fallback.slice(0, 3).toUpperCase();
  return TEAM_SHORT[constructorId] ?? fallback.slice(0, 3).toUpperCase();
}

/** 국가명/국적 → 국기 이모지 (F1 전 캘린더 + Ergast 특유 표기) */
const FLAG: Record<string, string> = {
  UK: "🇬🇧", British: "🇬🇧", Britain: "🇬🇧", "Great Britain": "🇬🇧", "United Kingdom": "🇬🇧", England: "🇬🇧",
  USA: "🇺🇸", "United States": "🇺🇸", American: "🇺🇸", "United States of America": "🇺🇸",
  UAE: "🇦🇪", "United Arab Emirates": "🇦🇪",
  Netherlands: "🇳🇱", Dutch: "🇳🇱",
  Monaco: "🇲🇨", Monegasque: "🇲🇨",
  Spain: "🇪🇸", Spanish: "🇪🇸",
  Australia: "🇦🇺", Australian: "🇦🇺",
  Mexico: "🇲🇽", Mexican: "🇲🇽",
  Canada: "🇨🇦", Canadian: "🇨🇦",
  Finland: "🇫🇮", Finnish: "🇫🇮",
  France: "🇫🇷", French: "🇫🇷",
  Germany: "🇩🇪", German: "🇩🇪",
  Italy: "🇮🇹", Italian: "🇮🇹",
  Japan: "🇯🇵", Japanese: "🇯🇵",
  Thailand: "🇹🇭", Thai: "🇹🇭",
  Denmark: "🇩🇰", Danish: "🇩🇰",
  China: "🇨🇳", Chinese: "🇨🇳",
  Brazil: "🇧🇷", Brazilian: "🇧🇷",
  Austria: "🇦🇹", Austrian: "🇦🇹",
  "New Zealand": "🇳🇿", "New Zealander": "🇳🇿",
  Argentina: "🇦🇷", Argentine: "🇦🇷", Argentinian: "🇦🇷",
  Bahrain: "🇧🇭", Bahraini: "🇧🇭",
  "Saudi Arabia": "🇸🇦", Saudi: "🇸🇦",
  Azerbaijan: "🇦🇿", Azerbaijani: "🇦🇿",
  Singapore: "🇸🇬", Singaporean: "🇸🇬",
  Qatar: "🇶🇦", Qatari: "🇶🇦",
  Hungary: "🇭🇺", Hungarian: "🇭🇺",
  Belgium: "🇧🇪", Belgian: "🇧🇪",
  Portugal: "🇵🇹", Portuguese: "🇵🇹",
  Turkey: "🇹🇷", Turkish: "🇹🇷",
  Russia: "🇷🇺", Russian: "🇷🇺",
  Malaysia: "🇲🇾", Malaysian: "🇲🇾",
  "South Africa": "🇿🇦",
  "South Korea": "🇰🇷", Korea: "🇰🇷", Korean: "🇰🇷",
  India: "🇮🇳", Indian: "🇮🇳",
  Sweden: "🇸🇪", Swedish: "🇸🇪",
  Switzerland: "🇨🇭", Swiss: "🇨🇭",
  Ireland: "🇮🇪", Irish: "🇮🇪",
  Poland: "🇵🇱", Polish: "🇵🇱",
  "Czech Republic": "🇨🇿", Czech: "🇨🇿",
  Venezuela: "🇻🇪", Venezuelan: "🇻🇪",
  Colombia: "🇨🇴", Colombian: "🇨🇴",
  Indonesia: "🇮🇩", Indonesian: "🇮🇩",
};

export function flag(nameOrNationality?: string): string {
  if (!nameOrNationality) return "🏁";
  return FLAG[nameOrNationality] ?? "🏁";
}

/** 국가명/국적 → ISO 3166-1 alpha-2 코드 (flagcdn용, 소문자) */
const COUNTRY_CODE: Record<string, string> = {
  UK: "gb", British: "gb", Britain: "gb", "Great Britain": "gb", "United Kingdom": "gb", England: "gb",
  USA: "us", "United States": "us", American: "us", "United States of America": "us",
  UAE: "ae", "United Arab Emirates": "ae",
  Netherlands: "nl", Dutch: "nl",
  Monaco: "mc", Monegasque: "mc",
  Spain: "es", Spanish: "es",
  Australia: "au", Australian: "au",
  Mexico: "mx", Mexican: "mx",
  Canada: "ca", Canadian: "ca",
  Finland: "fi", Finnish: "fi",
  France: "fr", French: "fr",
  Germany: "de", German: "de",
  Italy: "it", Italian: "it",
  Japan: "jp", Japanese: "jp",
  Thailand: "th", Thai: "th",
  Denmark: "dk", Danish: "dk",
  China: "cn", Chinese: "cn",
  Brazil: "br", Brazilian: "br",
  Austria: "at", Austrian: "at",
  "New Zealand": "nz",
  Argentina: "ar", Argentine: "ar", Argentinian: "ar",
  Bahrain: "bh", Bahraini: "bh",
  "Saudi Arabia": "sa", Saudi: "sa",
  Azerbaijan: "az", Azerbaijani: "az",
  Singapore: "sg", Singaporean: "sg",
  Qatar: "qa", Qatari: "qa",
  Hungary: "hu", Hungarian: "hu",
  Belgium: "be", Belgian: "be",
  Portugal: "pt", Portuguese: "pt",
  Turkey: "tr", Turkish: "tr",
  Russia: "ru", Russian: "ru",
  Malaysia: "my", Malaysian: "my",
  "South Africa": "za",
  "South Korea": "kr", Korea: "kr", Korean: "kr",
  India: "in", Indian: "in",
  Sweden: "se", Swedish: "se",
  Switzerland: "ch", Swiss: "ch",
  Ireland: "ie", Irish: "ie",
  Poland: "pl", Polish: "pl",
  "Czech Republic": "cz", Czech: "cz",
  Venezuela: "ve", Venezuelan: "ve",
  Colombia: "co", Colombian: "co",
  Indonesia: "id", Indonesian: "id",
};

export function countryCode(nameOrNationality?: string): string | null {
  if (!nameOrNationality) return null;
  return COUNTRY_CODE[nameOrNationality] ?? null;
}

/** Jolpica driverId → public/drivers 파일명 (2026 공식 이미지, 확장자 .avif) */
export const DRIVER_IMAGE: Record<string, string> = {
  // McLaren
  norris: "2026mclarenlannor01right",
  piastri: "2026mclarenoscpia01right",
  // Ferrari
  hamilton: "2026ferrarilewham01right",
  leclerc: "2026ferrarichalec01right",
  // Red Bull
  max_verstappen: "2026redbullracingmaxver01right",
  hadjar: "2026redbullracingisahad01right",
  // Mercedes
  russell: "2026mercedesgeorus01right",
  antonelli: "2026mercedesandant01right",
  // Williams
  albon: "2026williamsalealb01right",
  sainz: "2026williamscarsai01right",
  // Audi (Sauber)
  hulkenberg: "2026audinichul01right",
  bortoleto: "2026audigabbor01right",
  // Aston Martin
  alonso: "2026astonmartinferalo01right",
  stroll: "2026astonmartinlanstr01right",
  // Alpine
  gasly: "2026alpinepiegas01right",
  colapinto: "2026alpinefracol01right",
  // Haas
  ocon: "2026haasf1teamestoco01right",
  bearman: "2026haasf1teamolibea01right",
  // Racing Bulls
  lawson: "2026racingbullslialaw01right",
  arvid_lindblad: "2026racingbullsarvlin01right",
  // Cadillac
  perez: "2026cadillacserper01right",
  bottas: "2026cadillacvalbot01right",
};

export function driverImage(driverId?: string): string | null {
  if (!driverId) return null;
  const file = DRIVER_IMAGE[driverId];
  return file ? `/drivers/${file}.avif` : null;
}