import { getSeasonResults } from "@/lib/f1api";
import ResultsView from "./ResultsView";

export const metadata = { title: "Results — F1 Hub" };

// 시즌은 URL ?season= 로 (기본 = 올해). 2021까지 지원.
export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const sp = await searchParams;
  const thisYear = new Date().getFullYear();
  const season = Number(sp.season) || thisYear;
  const seasons: number[] = [];
  for (let y = thisYear; y >= 2021; y--) seasons.push(y);

  const races = await getSeasonResults(season);

  return (
    <div>
      <header className="page-head">
        <div className="eyebrow">RACE RESULTS · 2021—{thisYear}</div>
        <h1 className="page-title">Results</h1>
      </header>
      <ResultsView races={races} season={season} seasons={seasons} />
    </div>
  );
}
