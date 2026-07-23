import ReplayClient from "@/components/replay/ReplayClient";

export const metadata = { title: "Telemetry Replay — F1 Hub" };

export default function ReplayPage() {
  return (
    <div>
      <header className="page-head">
        <div className="eyebrow">TELEMETRY · 2023—2026</div>
        <h1 className="page-title">Replay</h1>
      </header>
      <ReplayClient />
    </div>
  );
}
