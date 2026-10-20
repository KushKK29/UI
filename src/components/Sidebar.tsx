"use client";

import type { View } from "@/lib/views";
import { icons } from "@/lib/icons";

// Same sidebar as the backend admin panel (connected_accounts.py _page_shell):
// logo, nav, user box with log out, theme toggle.
function toggleTheme() {
  const cur =
    document.documentElement.getAttribute("data-theme") ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem("hub_theme", next);
  } catch {}
}

export function Sidebar({
  email,
  views,
  activeId,
  onLogout,
}: {
  email: string;
  views: View[];
  activeId: string;
  onLogout: () => void;
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-badge" />
        <div className="logo-text">Connector Hub</div>
      </div>
      {views
        .filter(v => v.top)
        .map(v => (
          <a key={v.id} href={`#/${v.id}`} className={`nav-item ${v.id === activeId ? "active" : ""}`}>
            {icons[v.id]}
            {v.title}
          </a>
        ))}
      <div className="nav-section">CRM Ops</div>
      <a
        href="#/crm-duplicates-fuzzy"
        className={`nav-item ${activeId.startsWith("crm-") ? "active" : ""}`}
      >
        {icons["crm-duplicates"]}
        CRM Ops
      </a>
      <div className="nav-section">Support ops</div>
      {views.filter(v => v.nav !== false && !v.top).map(v => (
        <a key={v.id} href={`#/${v.id}`} className={`nav-item ${v.id === activeId ? "active" : ""}`}>
          {icons[v.id]}
          {v.title}
        </a>
      ))}
      <div className="sidebar-user">
        <div className="sidebar-avatar">{email.slice(0, 1).toUpperCase()}</div>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div className="sidebar-email">{email}</div>
          <button type="button" className="logout-btn" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
      <div className="theme-row">
        Dark mode
        <button type="button" className="theme-switch" role="switch" aria-label="Toggle dark mode" onClick={toggleTheme}>
          <span className="knob" />
        </button>
      </div>
    </div>
  );
}
