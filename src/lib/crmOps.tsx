// Ports of the backend's crm_ops_page.py three tabs (duplicate detection,
// data quality audit, customer 360) onto the JSON /api/crm-ops/* endpoints.
import { useState } from "react";
import * as api from "./api";
import { Badge, Table } from "./ui";
import type { Props } from "./views";

function Skipped({ providers_skipped }: { providers_skipped: Record<string, string> }) {
  const s = Object.entries(providers_skipped || {});
  if (!s.length) return null;
  return <div className="banner">Not included — {s.map(([k, v]) => `${k}: ${v}`).join("; ")}</div>;
}

function NoCrm() {
  return (
    <div className="empty">
      Connect at least one CRM (HubSpot, Salesforce, Zoho, Outreach, or SalesLoft) from{" "}
      <a href="#/accounts">Connected accounts</a> to run cross-CRM analysis.
    </div>
  );
}

export const CRM_OPS_TABS = [
  { id: "crm-duplicates-fuzzy", label: "Duplicate detection" },
  { id: "crm-quality", label: "Data quality audit" },
  { id: "crm-conflicts", label: "Field conflicts" },
  { id: "crm-stale", label: "Stale contacts" },
  { id: "crm-360", label: "Customer 360" },
];

export function CrmQuality({ data }: Props) {
  const d: api.QualityResult = data;
  const entries = Object.entries(d.results);
  return (
    <>
      {!d.providers_checked.length ? (
        <NoCrm />
      ) : !entries.length ? (
        <div className="empty">No connected CRM has any contacts to audit.</div>
      ) : (
        <>
          <Skipped providers_skipped={d.providers_skipped} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {entries.map(([provider, r]) => (
              <div key={provider} className="card" style={{ maxWidth: "none", padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <b style={{ fontSize: 14 }}>{provider}</b>
                  <span
                    style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 22 }}
                    className={r.quality_score == null || r.quality_score >= 80 ? "" : "err"}
                  >
                    {r.quality_score != null ? `${r.quality_score}%` : "—"}
                  </span>
                </div>
                <div className="muted" style={{ marginBottom: 8 }}>
                  {r.total_contacts} contacts · {r.flagged_count} flagged
                </div>
                <Table
                  cols={[
                    { h: "Contact", f: (f: any) => f.name || "(no name)" },
                    { h: "Issues", f: (f: any) => f.issues.join(", ") },
                    { h: "Severity", f: (f: any) => <Badge kind={f.severity === "high" ? "bad" : f.severity === "medium" ? "warn" : ""}>{f.severity}</Badge> },
                  ]}
                  rows={r.flagged.slice(0, 25)}
                  empty="No issues."
                />
                {r.flagged.length > 25 && <p className="muted">+{r.flagged.length - 25} more</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function Crm360({ data, ctx }: Props) {
  const d: api.SearchResult = data;
  const [q, setQ] = useState(ctx.args().q || "");

  return (
    <>
      <form
        className="bar"
        style={{ marginBottom: 20 }}
        onSubmit={e => {
          e.preventDefault();
          ctx.args().q = q;
          ctx.rerun();
        }}
      >
        <label style={{ flex: 1 }}>
          <input
            type="text"
            placeholder="Search by name, email, or company"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ borderRadius: 99 }}
          />
        </label>
        <button type="submit">Search</button>
      </form>
      {!d?.query ? null : !d.providers_checked.length ? (
        <NoCrm />
      ) : (
        <>
          <Skipped providers_skipped={d.providers_skipped} />
          {d.records.length === 0 ? (
            <div className="empty">No matching contact found for "{d.query}" in any connected CRM.</div>
          ) : (
            <>
              <p className="muted">
                Found in {d.found_in.length} of {d.providers_checked.length} connected CRMs.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {d.records.map(r => (
                  <div key={r.provider + r.id} className="card" style={{ maxWidth: 520, padding: "14px 18px" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                      <Badge kind="ok">{r.provider}</Badge>
                      <b>{r.name || "(no name)"}</b>
                    </div>
                    <div className="muted">{r.email || "no email"} · {r.company || "no company"} · {r.phone || "no phone"}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

const CONFIDENCE_KIND: Record<string, "ok" | "warn" | ""> = { exact: "ok", high: "", medium: "warn" };

const PROVIDER_CHIP: Record<string, { letter: string; color: string }> = {
  hubspot: { letter: "H", color: "#ff7a59" },
  salesforce: { letter: "S", color: "#00a1e0" },
  zoho: { letter: "Z", color: "#e42527" },
  outreach: { letter: "O", color: "#5951ff" },
  salesloft: { letter: "L", color: "#1fb67a" },
};

function ProviderChip({ provider }: { provider: string }) {
  const c = PROVIDER_CHIP[provider] ?? { letter: provider[0]?.toUpperCase() ?? "?", color: "#888" };
  return <span className="chip" style={{ background: c.color }} title={provider}>{c.letter}</span>;
}

// How each CRM's update tool takes a first/last name.
const NAME_UPDATE: Record<string, (id: string, first: string, last: string) => [string, object]> = {
  hubspot: (id, f, l) => ["hubspot_update_contact", { id, properties: { firstname: f, lastname: l } }],
  salesforce: (id, f, l) => ["salesforce_update_contact", { id, data: { FirstName: f, LastName: l } }],
  zoho: (id, f, l) => ["zoho_update_contact", { id, data: { First_Name: f, Last_Name: l } }],
  outreach: (id, f, l) => ["outreach_update_prospect", { id, attributes: { firstName: f, lastName: l } }],
  salesloft: (id, f, l) => ["salesloft_update_person", { id, data: { first_name: f, last_name: l } }],
};

const DISMISS_KEY = "ops_dup_dismissed";
const loadDismissed = (): string[] => {
  try {
    return JSON.parse(api.store.get(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
};

export function CrmDuplicatesFuzzy({ data, ctx }: Props) {
  const d: api.FuzzyDuplicates = data;
  const [dismissed, setDismissed] = useState<string[]>(loadDismissed);
  const [copied, setCopied] = useState("");
  const groupKey = (g: api.FuzzyDupGroup) => g.email + "|" + g.members.map(m => m.provider + m.id).join(",");
  const visible = d.duplicate_groups.filter(g => !dismissed.includes(groupKey(g)));

  const dismiss = (g: api.FuzzyDupGroup) => {
    const next = [...dismissed, groupKey(g)];
    setDismissed(next);
    api.store.set(DISMISS_KEY, JSON.stringify(next));
  };
  const copy = (email: string) => {
    navigator.clipboard?.writeText(email);
    setCopied(email);
    setTimeout(() => setCopied(""), 1500);
  };
  const syncNames = (g: api.FuzzyDupGroup) =>
    ctx.act(async () => {
      const primary = g.members.find(m => m.provider === g.recommended_primary);
      if (!primary?.name) return;
      const [first, ...rest] = primary.name.trim().split(/\s+/);
      let done = 0;
      for (const m of g.members) {
        if (m === primary || m.name === primary.name || !NAME_UPDATE[m.provider]) continue;
        const [tool, args] = NAME_UPDATE[m.provider](m.id, first, rest.join(" "));
        if (await api.run(tool, args, ctx.confirm)) done++;
      }
      if (done) {
        ctx.notify(`Updated ${done} record(s) to match ${primary.provider}.`);
        await ctx.rerun();
      }
    });

  return (
    <>
      {!d.providers_checked.length ? (
        <NoCrm />
      ) : (
        <>
          <p className="muted">
            Checked {d.total_contacts_checked} contacts across {d.providers_checked.join(", ") || "none"}. Includes
            fuzzy name+phone/company matches beyond exact email, each tagged with a confidence.
          </p>
          <Skipped providers_skipped={d.providers_skipped} />
          {visible.length === 0 ? (
            <div className="empty">No cross-CRM duplicates found.</div>
          ) : (
            <>
              {dismissed.length > 0 && (
                <p className="muted">
                  {dismissed.length} dismissed.{" "}
                  <a
                    href="#/crm-duplicates-fuzzy"
                    onClick={() => {
                      setDismissed([]);
                      api.store.set(DISMISS_KEY, null);
                    }}
                  >
                    Show all
                  </a>
                </p>
              )}
              <div className="dup-grid">
                {visible.map(g => {
                  const nameDiffers = !!g.conflicting_fields.name;
                  return (
                    <div key={groupKey(g)} className="dup-card">
                      <div className="dup-head">
                        <span className="mono dup-email" title={g.email}>{g.email}</span>
                        <Badge kind={CONFIDENCE_KIND[g.confidence]}>{g.confidence}</Badge>
                      </div>
                      <div className="dup-members">
                        {g.members.map(m => (
                          <div key={m.provider} className="dup-member">
                            <ProviderChip provider={m.provider} />
                            <div style={{ minWidth: 0 }}>
                              <div className="dup-name">
                                {m.name || "(no name)"}
                                {m.provider === g.recommended_primary && <span className="dup-primary">primary</span>}
                              </div>
                              <div className="muted dup-co">{m.company || "no company"}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {Object.keys(g.conflicting_fields).length > 0 && (
                        <div className="dup-conflicts">
                          {Object.keys(g.conflicting_fields).map(f => (
                            <span key={f} className="badge warn">{f} differs</span>
                          ))}
                        </div>
                      )}
                      <div className="dup-actions">
                        {nameDiffers && (
                          <button type="button" className="mini primary" onClick={() => syncNames(g)}>
                            Sync names
                          </button>
                        )}
                        <button type="button" className="mini" onClick={() => copy(g.email)}>
                          {copied === g.email ? "Copied" : "Copy email"}
                        </button>
                        <button type="button" className="mini ghost" onClick={() => dismiss(g)}>
                          Dismiss
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

export function CrmConflicts({ data }: Props) {
  const d: api.ConflictsResult = data;
  return (
    <>
      {!d.providers_checked.length ? (
        <NoCrm />
      ) : (
        <>
          <p className="muted">{d.total_conflicts} duplicate group(s) with disagreeing field values.</p>
          <Skipped providers_skipped={d.providers_skipped} />
          {d.conflict_groups.length === 0 ? (
            <div className="empty">No field conflicts found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {d.conflict_groups.map(g => (
                <div key={g.email} className="card" style={{ maxWidth: 560, padding: "16px 20px" }}>
                  <div className="mono" style={{ fontWeight: 600, marginBottom: 10 }}>{g.email}</div>
                  {Object.entries(g.conflicting_fields).map(([field, c]) => (
                    <div key={field} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--border-soft)" }}>
                      <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 6, textTransform: "capitalize" }}>{field}</div>
                      {Object.entries(c.values).map(([provider, value]) => (
                        <div key={provider} style={{ display: "flex", gap: 10, alignItems: "center", padding: "2px 0" }}>
                          <span className="badge" style={{ minWidth: 76, textAlign: "center" }}>{provider}</span>
                          <span>{value}</span>
                        </div>
                      ))}
                      {c.suggested_value ? (
                        <div className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>
                          Suggested: <b style={{ color: "var(--text)" }}>{c.suggested_value}</b> (from {c.suggested_from}, most recently active)
                        </div>
                      ) : (
                        <div className="muted" style={{ marginTop: 6, fontSize: 12.5 }}>No activity timestamp available to suggest a value.</div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export function CrmStale({ data }: Props) {
  const d: api.StaleResult = data;
  return (
    <>
      {!d.providers_checked.length ? (
        <NoCrm />
      ) : (
        <>
          <p className="muted">
            {d.stale_contacts.length} contact(s) idle {d.days_threshold}+ days, with no open deal
            {d.freshdesk_checked ? " and no Freshdesk ticket ever" : " (connect Freshdesk to also check ticket history)"}.
          </p>
          <Skipped providers_skipped={d.providers_skipped} />
          {d.stale_contacts.length === 0 ? (
            <div className="empty">No stale contacts found.</div>
          ) : (
            <Table
              cols={[
                { h: "Contact", f: (c: any) => <>{c.name || "(no name)"} <span className="muted">{c.email}</span></> },
                { h: "Provider", f: (c: any) => <span className="badge">{c.provider}</span> },
                { h: "Company", f: (c: any) => c.company || "—" },
                { h: "Idle", f: (c: any) => (c.idle_days != null ? `${c.idle_days} days` : "no activity recorded") },
              ]}
              rows={d.stale_contacts}
              empty="No stale contacts found."
            />
          )}
        </>
      )}
    </>
  );
}
