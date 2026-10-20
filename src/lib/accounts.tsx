// Connected accounts + per-provider tool detail (ports of the backend's
// connected_accounts.py / provider_detail.py pages).
import { useState } from "react";
import * as api from "./api";
import type { Props } from "./views";

const when = (ts?: number | null) => (ts ? new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC" : "never");

const tile = { width: 32, height: 32, borderRadius: 9, flexShrink: 0 } as const;

function Icon({ src, dim }: { src: string; dim?: boolean }) {
  return <img src={src} alt="" width={32} height={32} style={{ ...tile, objectFit: "cover", opacity: dim ? 0.5 : 1 }} />;
}

const row = { display: "flex", alignItems: "center", gap: 14, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 18px" } as const;
const list = { display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 } as const;

function FreshdeskForm({ ctx }: Pick<Props, "ctx">) {
  const [domain, setDomain] = useState("");
  const [key, setKey] = useState("");
  return (
    <form
      style={{ ...row, display: "block" }}
      onSubmit={e => {
        e.preventDefault();
        ctx.act(async () => {
          await api.connectFreshdesk(domain, key);
          setKey("");
          await ctx.rerun();
        });
      }}
    >
      <b>Freshdesk</b>
      <div className="muted" style={{ marginBottom: 10 }}>
        No OAuth app yet — connect with your domain and API key instead.
      </div>
      <label htmlFor="fd_domain">Freshdesk domain</label>
      <input id="fd_domain" placeholder="yourcompany.freshdesk.com" required autoComplete="off" value={domain} onChange={e => setDomain(e.target.value)} />
      <label htmlFor="fd_key">Freshdesk API key</label>
      <input id="fd_key" type="password" placeholder="Profile Settings → API Key" required autoComplete="off" value={key} onChange={e => setKey(e.target.value)} />
      <div style={{ marginTop: 10 }}>
        <button type="submit">Connect Freshdesk</button>
      </div>
    </form>
  );
}

export function Accounts({ data, ctx }: Props) {
  const ps: api.Provider[] = data.providers;
  const connected = ps.filter(p => p.state === "connected");
  const others = ps.filter(p => p.state !== "connected");

  const disconnect = (p: api.Provider) =>
    ctx.act(async () => {
      if (!(await ctx.confirm(`Disconnect ${p.name}`, { note: "This deletes its stored credentials." }))) return;
      await api.disconnect(p.provider);
      await ctx.rerun();
    });
  const connect = (p: api.Provider) =>
    ctx.act(async () => {
      location.href = (await api.connectUrl(p.provider)).url;
    });

  const toolCount = connected.reduce((n, p) => n + p.tool_count, 0);
  const needsAttention = connected.filter(p => p.status !== "active").length;
  const stat = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" } as const;
  const statNum = { fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 600 } as const;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 28 }}>
        <div style={stat}>
          <div style={statNum}>{connected.length}<span style={{ color: "var(--muted-soft)", fontSize: 16 }}> / {ps.length}</span></div>
          <div className="muted" style={{ marginTop: 2 }}>Providers connected</div>
        </div>
        <div style={stat}>
          <div style={{ ...statNum, color: "var(--accent)" }}>{toolCount}</div>
          <div className="muted" style={{ marginTop: 2 }}>Tools available</div>
        </div>
        <div style={stat}>
          <div style={statNum}>{needsAttention}</div>
          <div className="muted" style={{ marginTop: 2 }}>Needs attention</div>
        </div>
      </div>
      <h2>Connected</h2>
      <div style={list}>
        {connected.length === 0 && <div className="empty">Nothing connected yet — connect a provider below.</div>}
        {connected.map(p => (
          <div key={p.provider} style={row}>
            <Icon src={p.favicon} />
            <div style={{ flex: 1 }}>
              <b>{p.name}</b>{" "}
              {p.status === "active" ? <span className="badge ok">Connected</span> : <span className="badge warn">Needs reauthorization</span>}
              <div className="muted">
                {p.tool_count} tools · last used {when(p.last_used_at)}
              </div>
            </div>
            <a href={`#/account/${p.provider}`}>View tools →</a>
            <button className="ghost" onClick={() => disconnect(p)}>
              Disconnect
            </button>
          </div>
        ))}
      </div>
      <h2>Available to connect</h2>
      <div style={list}>
        {others.map(p =>
          p.state === "api_key" ? (
            <FreshdeskForm key={p.provider} ctx={ctx} />
          ) : (
            <div key={p.provider} style={row}>
              <Icon src={p.favicon} dim={p.state === "not_configured"} />
              <div style={{ flex: 1 }}>
                <b>{p.name}</b>
                <div className="muted">
                  {p.state === "available" ? (
                    "OAuth app configured"
                  ) : (
                    <>
                      needs{" "}
                      {p.env?.map((e, i) => (
                        <span key={e}>
                          {i > 0 && " and "}
                          <span className="mono">{e}</span>
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </div>
              {p.state === "available" ? <button onClick={() => connect(p)}>Connect</button> : <span className="muted">Not configured</span>}
            </div>
          ),
        )}
      </div>
    </>
  );
}

export function AccountDetail({ data }: Props) {
  const d: api.AccountDetail = data;
  return (
    <>
      <p>
        <a href="#/accounts">← Connected accounts</a>
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "16px 0 6px" }}>
        <img src={d.favicon} alt="" width={44} height={44} style={{ borderRadius: 12 }} />
        <div className="muted">{d.tools.length} tools · last used {when(d.last_used_at)}</div>
      </div>
      <div className="banner" style={{ marginTop: 20 }}>{d.instructions}</div>
      <h2>Use these tools in your agent</h2>
      <p className="muted">Every connected provider's tools are reachable through the same MCP server URL.</p>
      <pre className="mono">{d.server_url}</pre>
      <ul className="muted">
        <li>ChatGPT: Settings → Connectors → Add custom MCP server → paste URL, auth OAuth.</li>
        <li>Claude: Settings → Connectors → Add custom connector → paste URL, approve consent.</li>
        <li>Any MCP client: streamable-http with OAuth 2.1 discovery; client credentials come from dynamic registration.</li>
      </ul>
      <h2>Available tools</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
      {d.tools.map(t => (
        <div key={t.name} className="card" style={{ maxWidth: "none", padding: "14px 16px" }}>
          <span className="mono" style={{ fontWeight: 600 }}>{t.name}</span> {t.requires_confirm && <span className="badge warn">needs confirm</span>}
          <div className="muted" style={{ marginTop: 4 }}>{t.description}</div>
          <details>
            <summary className="muted">Input schema</summary>
            <pre className="mono">{JSON.stringify(t.schema, null, 2)}</pre>
          </details>
        </div>
      ))}
      </div>
    </>
  );
}
