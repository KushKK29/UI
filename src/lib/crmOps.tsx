// Ports of the backend's crm_ops_page.py three tabs (duplicate detection,
// data quality audit, customer 360) onto the JSON /api/crm-ops/* endpoints.
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

export function CrmDuplicates({ data }: Props) {
  const d: api.Duplicates = data;
  if (!d.providers_checked.length) return <NoCrm />;
  return (
    <>
      <p className="muted">
        Checked {d.total_contacts_checked} contacts across {d.providers_checked.join(", ") || "none"}.
      </p>
      <Skipped providers_skipped={d.providers_skipped} />
      {d.duplicate_groups.length === 0 ? (
        <div className="empty">No cross-CRM duplicates found.</div>
      ) : (
        d.duplicate_groups.map(g => (
          <div key={g.email} className="card" style={{ marginBottom: 10 }}>
            <div className="mono" style={{ fontWeight: 600, marginBottom: 8 }}>{g.email}</div>
            {g.members.map(m => (
              <div key={m.provider} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0" }}>
                <Badge kind={m.provider === g.recommended_primary ? "ok" : ""}>{m.provider}</Badge>
                <span>{m.name || "(no name)"}</span>
                <span className="muted">{m.company || ""}</span>
              </div>
            ))}
            {Object.keys(g.conflicting_fields).length > 0 && (
              <div className="err" style={{ marginTop: 8 }}>
                ⚠ {Object.keys(g.conflicting_fields).map(f => `${f} differs`).join(", ")}
              </div>
            )}
          </div>
        ))
      )}
    </>
  );
}

export function CrmQuality({ data }: Props) {
  const d: api.QualityResult = data;
  if (!d.providers_checked.length) return <NoCrm />;
  const entries = Object.entries(d.results);
  if (!entries.length) return <div className="empty">No connected CRM has any contacts to audit.</div>;
  return (
    <>
      <Skipped providers_skipped={d.providers_skipped} />
      {entries.map(([provider, r]) => (
        <div key={provider} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <b>{provider}</b>
            <span style={{ fontWeight: 700, fontSize: 18 }} className={r.quality_score == null || r.quality_score >= 80 ? "" : "err"}>
              {r.quality_score != null ? `${r.quality_score}%` : "—"}
            </span>
          </div>
          <div className="muted" style={{ marginBottom: 6 }}>
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
    </>
  );
}

export function Crm360({ data }: Props) {
  const d: api.R360 | null = data;
  return (
    <>
      {d?.email && (
        !d.providers_checked.length ? (
          <NoCrm />
        ) : (
          <>
            <Skipped providers_skipped={d.providers_skipped} />
            {d.records.length === 0 ? (
              <div className="empty">No matching contact found for {d.email} in any connected CRM.</div>
            ) : (
              <>
                <p className="muted">
                  Found in {d.found_in.length} of {d.providers_checked.length} connected CRMs.
                </p>
                {d.records.map(r => (
                  <div key={r.provider + r.id} className="card" style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                      <Badge kind="ok">{r.provider}</Badge>
                      <b>{r.name || "(no name)"}</b>
                    </div>
                    <div className="muted">{r.company || "no company"} · {r.phone || "no phone"}</div>
                  </div>
                ))}
              </>
            )}
          </>
        )
      )}
    </>
  );
}
