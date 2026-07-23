"use client";

import { useEffect, useState } from "react";

export default function Countdown({ target }: { target: string }) {
  const [left, setLeft] = useState<number>(0);

  useEffect(() => {
    const t = new Date(target).getTime();
    const tick = () => setLeft(Math.max(0, t - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  const d = Math.floor(left / 86400000);
  const h = Math.floor((left % 86400000) / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);

  const unit = (v: number, label: string) => (
    <div className="cd-unit">
      <span className="cd-num display">{String(v).padStart(2, "0")}</span>
      <span className="cd-label mono">{label}</span>
    </div>
  );

  return (
    <div className="cd">
      {unit(d, "DAYS")}
      <span className="cd-sep">:</span>
      {unit(h, "HRS")}
      <span className="cd-sep">:</span>
      {unit(m, "MIN")}
      <span className="cd-sep">:</span>
      {unit(s, "SEC")}
      <style>{`
        .cd { display: flex; align-items: flex-start; gap: 10px; }
        .cd-unit { display: flex; flex-direction: column; align-items: center; }
        .cd-num { font-size: 38px; line-height: 1; font-weight: 700; }
        .cd-label { font-size: 9px; letter-spacing: 0.14em; color: var(--muted); margin-top: 6px; }
        .cd-sep { font-family: var(--font-display); font-size: 30px; color: var(--dim); line-height: 1; }
        @media (max-width: 768px) { .cd-num { font-size: 28px; } .cd-sep { font-size: 22px; } }
      `}</style>
    </div>
  );
}
