import DriverDetail from "./DriverDetail";

const JOLPICA = "https://api.jolpi.ca/ergast/f1";
const FIRST_SEASON = 2021;

/**
 * 정적 export 에서는 동적 라우트를 빌드 시점에 모두 찍어내야 한다.
 * 2021년 이후 출전 드라이버를 모아 그만큼의 페이지를 생성한다.
 * (여기 없는 driverId 로 접근하면 404 — 링크는 스탠딩에서만 건다)
 */
export async function generateStaticParams() {
  const thisYear = new Date().getFullYear();
  const ids = new Set<string>();
  for (let y = thisYear; y >= FIRST_SEASON; y--) {
    try {
      const res = await fetch(`${JOLPICA}/${y}/drivers/?limit=100`);
      if (!res.ok) continue;
      const data = await res.json();
      for (const d of data?.MRData?.DriverTable?.Drivers ?? []) ids.add(d.driverId);
    } catch {
      /* 한 시즌 실패해도 나머지는 생성 */
    }
  }
  return [...ids].map((id) => ({ id }));
}

export default async function DriverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DriverDetail driverId={id} />;
}
