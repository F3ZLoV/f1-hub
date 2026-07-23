"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "HOME" },
  { href: "/schedule", label: "SCHEDULE" },
  { href: "/standings/drivers", label: "DRIVERS" },
  { href: "/standings/constructors", label: "TEAMS" },
  { href: "/results", label: "RESULTS" },
  { href: "/replay", label: "REPLAY" },
];

export default function TopNav() {
  const path = usePathname();
  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">F1</span>
          <span className="brand-name">HUB</span>
        </Link>

        <nav className="nav-links">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? path === "/"
                : path.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${active ? "active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="topnav-status">
          <span className="live-badge">LIVE DATA</span>
        </div>
      </div>

      <style>{`
        .topnav {
          position: sticky; top: 0; z-index: 50;
          background: rgba(11,12,15,0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--line);
        }
        .topnav-inner {
          max-width: 1360px; margin: 0 auto;
          display: flex; align-items: center; gap: 32px;
          padding: 0 32px; height: 60px;
        }
        .brand { display: flex; align-items: center; gap: 8px; }
        .brand-mark {
          background: var(--f1-red); color: #fff;
          font-family: var(--font-display); font-weight: 700;
          font-size: 16px; padding: 3px 8px;
          clip-path: var(--clip-sm);
        }
        .brand-name {
          font-family: var(--font-display); font-weight: 700;
          letter-spacing: 0.22em; font-size: 16px;
        }
        .nav-links { display: flex; gap: 4px; flex: 1; }
        .nav-link {
          font-family: var(--font-mono);
          font-size: 12px; letter-spacing: 0.1em;
          color: var(--muted);
          padding: 8px 14px;
          position: relative;
          transition: color .15s;
        }
        .nav-link:hover { color: var(--text); }
        .nav-link.active { color: var(--text); }
        .nav-link.active::after {
          content: ""; position: absolute;
          left: 14px; right: 14px; bottom: -1px; height: 2px;
          background: var(--f1-red);
        }
        .topnav-status { display: flex; align-items: center; }

        @media (max-width: 768px) {
          .topnav-inner { gap: 12px; padding: 0 16px; height: auto; flex-wrap: wrap; padding-top: 10px; padding-bottom: 10px; }
          .nav-links { order: 3; width: 100%; overflow-x: auto; }
          .topnav-status { display: none; }
        }
      `}</style>
    </header>
  );
}
