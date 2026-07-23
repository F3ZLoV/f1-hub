"use client";

import { useState } from "react";
import { driverImage } from "@/lib/teams";

/**
 * 드라이버 헤드샷.
 * 우선순위: public/drivers 로컬(.avif) → OpenF1 headshot → 이니셜.
 * 로컬 이미지는 전신이라 상반신만 보이게 크롭.
 */
export default function DriverAvatar({
  src,
  driverId,
  code,
  color,
  size = 44,
}: {
  src?: string;       // OpenF1 headshot_url
  driverId?: string;  // Jolpica driverId
  code: string;
  color: string;
  size?: number;
}) {
  const local = driverImage(driverId);
  const [stage, setStage] = useState<0 | 1 | 2>(local ? 0 : src ? 1 : 2);

  const imgSrc = stage === 0 ? local : stage === 1 ? src : undefined;
  const isLocal = stage === 0;
  const next = () => setStage((s) => (s < 2 ? ((s + 1) as 0 | 1 | 2) : 2));

  return (
    <div className="avatar" style={{ width: size, height: size, borderColor: color }}>
      {imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt={code}
          onError={next}
          className={isLocal ? "full-body" : ""}
        />
      ) : (
        <span className="avatar-code mono" style={{ fontSize: size * 0.32 }}>
          {code}
        </span>
      )}
      <style>{`
        .avatar {
          border-radius: 50%;
          border: 2px solid;
          overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          background: var(--surface-2);
          flex-shrink: 0;
        }
        .avatar img { width: 100%; height: 100%; object-fit: cover; object-position: top center; }
        /* 전신 이미지는 얼굴~어깨가 위쪽에 있으니 확대 + 상단 정렬로 상반신만 */
        .avatar img.full-body {
          object-fit: cover;
          object-position: top center;
          transform: scale(1.7) translateY(12%);
        }
        .avatar-code { font-weight: 700; color: var(--muted); }
      `}</style>
    </div>
  );
}