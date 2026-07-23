/**
 * 국기 — flagcdn.com SVG 이미지 사용 (모든 OS 동일 렌더).
 * 이모지 국기는 Windows에서 안 나오므로 이미지로.
 */
import { countryCode } from "@/lib/teams";

export default function Flag({
  country,
  size = 20,
}: {
  country?: string;
  size?: number;
}) {
  const code = countryCode(country);
  if (!code) {
    return <span style={{ fontSize: size * 0.9 }}>🏁</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/${code}.svg`}
      alt={country ?? ""}
      width={size}
      height={Math.round(size * 0.7)}
      style={{
        display: "inline-block",
        objectFit: "cover",
        borderRadius: 2,
        verticalAlign: "middle",
        aspectRatio: "10 / 7",
      }}
    />
  );
}
