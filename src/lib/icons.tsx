// Inline stroke-icon set for the sidebar nav — one per view id, matching the
// Connector Hub Redesign mockup (claude.ai/artifact/VrzbRMzSdZZacDVd26iZ6d).
import type { ReactNode } from "react";

const base = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, "aria-hidden": true } as const;

export const icons: Record<string, ReactNode> = {
  accounts: (
    <svg {...base}><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
  ),
  "crm-duplicates": (
    <svg {...base}><circle cx="9" cy="9" r="5" /><circle cx="15" cy="15" r="5" /></svg>
  ),
  "crm-quality": (
    <svg {...base}><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>
  ),
  "crm-360": (
    <svg {...base}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-4 3-6 7-6s7 2 7 6" /></svg>
  ),
  collision: (
    <svg {...base}><path d="M8 7h12M8 12h12M8 17h8" /><circle cx="4" cy="7" r="1.5" /><circle cx="4" cy="12" r="1.5" /><circle cx="4" cy="17" r="1.5" /></svg>
  ),
  churn: (
    <svg {...base}><path d="M3 17l5-6 4 4 7-9" /></svg>
  ),
  vip: (
    <svg {...base}><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" /></svg>
  ),
  tasks: (
    <svg {...base}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 12l2 2 4-4" /></svg>
  ),
  unlinked: (
    <svg {...base}><circle cx="8" cy="8" r="3" /><circle cx="16" cy="16" r="3" /><path d="M11 11l2 2" /></svg>
  ),
  triage: (
    <svg {...base}><path d="M12 3v6M12 21v-6M4.2 7.8l5 2.5M14.8 13.7l5 2.5M4.2 16.2l5-2.5M14.8 10.3l5-2.5" /><circle cx="12" cy="12" r="2" /></svg>
  ),
  repeated: (
    <svg {...base}><path d="M4 7h11l-3-3M20 17H9l3 3" /></svg>
  ),
  load: (
    <svg {...base}><path d="M5 20V10M12 20V4M19 20v-7" /></svg>
  ),
  stale: (
    <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  ),
  digest: (
    <svg {...base}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>
  ),
};
