// One entry per tool view. Each view declares what it loads and how it renders;
// the shell (components/Shell.tsx) handles routing, params, confirm and errors.
import { useState, type ReactNode } from "react";
import * as api from "./api";
import { Accounts, AccountDetail } from "./accounts";
import { Badge, Hrs, money, Skipped, Stack, Table } from "./ui";
import { CrmQuality, Crm360, CrmDuplicatesFuzzy, CrmConflicts, CrmStale } from "./crmOps";


export type Kind = "ok" | "warn" | "bad";

export type Ctx = {
  status: api.Status;
  args: () => Record<string, string>;
  notify: (text: string, kind?: Kind) => void;
  rerun: () => Promise<void>;
  confirm: api.Confirm;
  patchStatus: (patch: Partial<api.Status>) => void;
  act: (fn: () => Promise<void>) => Promise<void>;
};

export type Param = {
  name: string;
  label: string;
  type: "text" | "number" | "select";
  value?: string | number;
  options?: string[];
  persist?: boolean;
};

export type Props = { data: any; ctx: Ctx };

export type View = {
  id: string;
  title: string;
  blurb: string;
  needs: string[][];
  top?: boolean; // listed above "Support ops" in the sidebar
  nav?: false; // reachable by hash only, not listed
  params: Param[];
  load: (args: Record<string, string>, ctx: Ctx) => Promise<any>;
  Body: (props: Props) => ReactNode;
};

type Membership = { provider: string; membership_id: string };

const CRMS = ["hubspot", "salesforce", "zoho", "outreach", "salesloft"];
const DEALS = ["hubspot", "salesforce", "zoho"];
const CADENCE = ["outreach", "salesloft"];
const PROJECT: Param = { name: "project_gid", label: "Asana project gid", type: "text", persist: true };

const tool = (name: string) => (args: object, ctx: Ctx) => api.run(`support_ops_${name}`, args, ctx.confirm);
const ticketLink = (t: any) => (
  <>
    <span className="mono">#{t.ticket_id}</span> {t.subject}
  </>
);

// Ticket → Asana task. Shared by the Tasks and Triage views.
async function routeTicket(ctx: Ctx, ticket_id: number) {
  const project_gid = ctx.args().project_gid;
  if (!project_gid) {
    ctx.notify("Enter an Asana project gid above first.", "warn");
    return null;
  }
  return api.run("support_ops_ticket_to_task", { ticket_id, project_gid }, ctx.confirm);
}

const memberKey = (m: Membership) => `${m.provider}|${m.membership_id}`;

function Collision({ data, ctx }: Props) {
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const isOn = (m: Membership) => picked[memberKey(m)] ?? true;

  async function pause() {
    const chosen = new Map<string, Membership>();
    for (const m of data.collisions.flatMap((r: any) => r.memberships) as Membership[]) {
      if (isOn(m)) chosen.set(memberKey(m), { provider: m.provider, membership_id: m.membership_id });
    }
    if (!chosen.size) return;
    const r = await api.run("support_ops_pause_collisions", { memberships: [...chosen.values()] }, ctx.confirm);
    if (!r) return;
    await ctx.rerun();
    const paused = r.results.filter((x: any) => x.paused).length;
    ctx.notify(`Paused ${paused}/${r.results.length}.`, r.results.some((x: any) => !x.paused) ? "warn" : "ok");
  }

  return (
    <>
      <Skipped data={data} />
      <Table
        cols={[
          { h: "Contact", f: (r: any) => r.email },
          { h: "Open tickets", f: (r: any) => <Stack items={r.tickets.map(ticketLink)} /> },
          {
            h: "Active in",
            f: (r: any) =>
              r.memberships.map((m: Membership) => (
                <div key={memberKey(m)}>
                  <label>
                    <input
                      type="checkbox"
                      checked={isOn(m)}
                      onChange={e => setPicked(p => ({ ...p, [memberKey(m)]: e.target.checked }))}
                    />{" "}
                    {m.provider} <span className="mono">{m.membership_id}</span>
                  </label>
                </div>
              )),
          },
        ]}
        rows={data.collisions}
        empty="No collisions — nobody with an open ticket is in an active sequence."
      />
      {data.collisions.length > 0 && <button onClick={() => ctx.act(pause)}>Pause selected</button>}
    </>
  );
}

function Churn({ data }: Props) {
  return (
    <>
      <Skipped data={data} />
      <Table
        cols={[
          { h: "Account", f: (r: any) => <>{r.account} {r.flagged && <Badge kind="bad">open deal</Badge>}</> },
          { h: "Score", f: (r: any) => <b>{r.score}</b> },
          { h: "Open", f: (r: any) => r.open_tickets },
          { h: "Reopened", f: (r: any) => r.reopened },
          { h: "High prio", f: (r: any) => r.high_priority_open },
          { h: "SLA breaches", f: (r: any) => r.sla_breaches },
          {
            h: "Deals",
            f: (r: any) =>
              r.open_deals.length ? (
                <>
                  {money(r.revenue_at_risk)}{" "}
                  <span className="muted">({r.open_deals.map((x: any) => x.name).join(", ")})</span>
                </>
              ) : (
                "—"
              ),
          },
        ]}
        rows={data.accounts}
        empty="No tickets matched to a CRM company."
      />
    </>
  );
}

function Vip({ data }: Props) {
  return (
    <>
      <Skipped data={data} />
      <Table
        cols={[
          { h: "Ticket", f: ticketLink },
          { h: "Account", f: (r: any) => r.company || "—" },
          {
            h: "Deal value",
            f: (r: any) => (r.vip ? <><Badge kind="warn">VIP</Badge> {money(r.deal_amount)}</> : "—"),
          },
          { h: "SLA", f: (r: any) => <Hrs n={r.hours_remaining} /> },
        ]}
        rows={data.tickets}
        empty="No open tickets with a due date."
      />
    </>
  );
}

function Tasks({ data, ctx }: Props) {
  const [close, setClose] = useState(false);

  async function createTask(ticket_id: number) {
    const r = await routeTicket(ctx, ticket_id);
    if (!r) return;
    await ctx.rerun();
    ctx.notify(r.error || "Task created.", r.error ? "warn" : "ok");
  }

  async function sync() {
    const r = await api.run("support_ops_sync_completed_tasks", { close }, ctx.confirm);
    if (!r) return;
    await ctx.rerun();
    ctx.notify(`Synced ${r.synced?.length ?? 0} ticket(s).`, "ok");
  }

  return (
    <>
      <h3>Linked tickets</h3>
      <Table
        cols={[
          { h: "Ticket", f: (r: any) => <span className="mono">#{r.ticket_id}</span> },
          { h: "Task", f: (r: any) => <a href={r.task_url} target="_blank" rel="noopener">open in Asana</a> },
          {
            h: "State",
            f: (r: any) =>
              r.error ? <Badge kind="bad">error</Badge> : r.synced ? <Badge kind="ok">synced</Badge> : r.completed ? <Badge kind="warn">task done</Badge> : "in progress",
          },
        ]}
        rows={data.links}
        empty="No linked tickets yet."
      />
      {data.links.some((l: any) => !l.synced) && (
        <div className="bar">
          <label>
            <input type="checkbox" checked={close} onChange={e => setClose(e.target.checked)} /> also close tickets
          </label>
          <button onClick={() => ctx.act(sync)}>Sync completed tasks</button>
        </div>
      )}
      <h3>Open bug tickets without a task</h3>
      <Table
        cols={[
          { h: "Ticket", f: ticketLink },
          {
            h: "",
            f: (r: any) => <button onClick={() => ctx.act(() => createTask(r.ticket_id))}>Create task</button>,
          },
        ]}
        rows={data.bug_candidates}
        empty='No unlinked bug tickets (type "Bug" or tag "bug").'
      />
    </>
  );
}

function Unlinked({ data, ctx }: Props) {
  const crms = CRMS.filter(p => ctx.status.connections[p]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [provider, setProvider] = useState(crms[0] ?? "");
  const isOn = (email: string) => picked[email] ?? true;

  async function create() {
    const contacts = data.requesters
      .filter((r: any) => isOn(r.email))
      .map((r: any) => ({ email: r.email, name: r.name }));
    if (!contacts.length || !provider) return;
    const r = await api.run("support_ops_create_missing_contacts", { provider, contacts }, ctx.confirm);
    if (!r) return;
    await ctx.rerun();
    const made = r.error ? 0 : r.results.filter((x: any) => x.created).length;
    ctx.notify(r.error || `Created ${made}/${r.results.length} in ${provider}.`, r.error ? "warn" : "ok");
  }

  return (
    <>
      <Skipped data={data} />
      <Table
        cols={[
          {
            h: "",
            f: (r: any) => (
              <input
                type="checkbox"
                checked={isOn(r.email)}
                onChange={e => setPicked(p => ({ ...p, [r.email]: e.target.checked }))}
              />
            ),
          },
          { h: "Requester", f: (r: any) => <>{r.name || "—"} <span className="muted">{r.email}</span></> },
          { h: "Tickets", f: (r: any) => r.ticket_count },
        ]}
        rows={data.requesters}
        empty="Every requester already exists in a CRM."
      />
      {data.requesters.length > 0 && (
        <div className="bar">
          <label>
            Create in{" "}
            <select value={provider} onChange={e => setProvider(e.target.value)}>
              {crms.map(p => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <button onClick={() => ctx.act(create)}>Create selected</button>
        </div>
      )}
    </>
  );
}

function Triage({ data, ctx }: Props) {
  async function route(ticket_id: number) {
    const r = await routeTicket(ctx, ticket_id);
    if (r) ctx.notify(r.error || "Task created.", r.error ? "warn" : "ok");
  }

  return (
    <>
      <Skipped data={data} />
      <Table
        cols={[
          { h: "Ticket", f: ticketLink },
          { h: "Requester", f: (r: any) => <>{r.requester_email}<div className="muted">{r.company}</div></> },
          { h: "Signals", f: (r: any) => r.signals.map((s: string) => <Badge key={s} kind="ok">{s}</Badge>) },
          {
            h: "In cadence",
            f: (r: any) => (r.active_cadences.length ? r.active_cadences.map((c: any) => c.provider).join(", ") : "—"),
          },
          {
            h: "",
            f: (r: any) => (
              <button className="ghost" onClick={() => ctx.act(() => route(r.ticket_id))}>
                Route to Asana
              </button>
            ),
          },
        ]}
        rows={data.tickets}
        empty="No buying signals found in ticket text."
      />
    </>
  );
}

function Repeated({ data }: Props) {
  return (
    <>
      <Skipped data={data} />
      <Table
        cols={[
          {
            h: "Account",
            f: (r: any) => <><b>{r.account}</b> <span className="muted">{r.repeat_tickets} tickets</span></>,
          },
          {
            h: "Recurring issues",
            f: (r: any) =>
              r.issues.map((i: any, idx: number) => (
                <div key={idx}>
                  {i.subject} <Badge>×{i.count}</Badge> {i.open ? <Badge kind="warn">{i.open} open</Badge> : null}
                </div>
              )),
          },
        ]}
        rows={data.accounts}
        empty="No repeated issues found."
      />
    </>
  );
}

function Load({ data }: Props) {
  const hours = (x: number | null) => (x == null ? "—" : `${x}h`);
  return (
    <>
      <Skipped data={data} />
      <Table
        cols={[
          { h: data.group_by, f: (r: any) => r.segment },
          { h: "Tickets", f: (r: any) => r.tickets },
          { h: "Open", f: (r: any) => r.open },
          { h: "Avg first response", f: (r: any) => hours(r.avg_first_response_hours) },
          { h: "Avg resolution", f: (r: any) => hours(r.avg_resolution_hours) },
        ]}
        rows={data.segments}
      />
    </>
  );
}

function Stale({ data }: Props) {
  return (
    <>
      <Skipped data={data} />
      <Table
        cols={[
          { h: "Deal", f: (r: any) => <>{r.name} <span className="muted">{r.provider}</span></> },
          { h: "Account", f: (r: any) => r.account },
          { h: "Value", f: (r: any) => money(r.amount) },
          { h: "Stage", f: (r: any) => r.stage },
          { h: "Idle", f: (r: any) => (r.idle_days == null ? "unknown" : `${r.idle_days}d`) },
          { h: "Open tickets", f: (r: any) => <Stack items={r.open_tickets.map(ticketLink)} /> },
        ]}
        rows={data.stuck_deals}
        empty="No stuck deals."
      />
    </>
  );
}

function FollowupGaps({ data }: Props) {
  return (
    <>
      <Skipped data={data} />
      <h2>Stale open tickets</h2>
      <Table
        cols={[
          { h: "Ticket", f: ticketLink },
          { h: "Company", f: (r: any) => r.company || "—" },
          { h: "Priority", f: (r: any) => r.priority },
          { h: "Idle", f: (r: any) => (r.idle_days == null ? "unknown" : `${r.idle_days}d`) },
        ]}
        rows={data.stale_tickets}
        empty="No stale open tickets."
      />
      <h2>Stale open deals</h2>
      <Table
        cols={[
          { h: "Deal", f: (r: any) => <>{r.name} <span className="muted">{r.provider}</span></> },
          { h: "Account", f: (r: any) => r.account },
          { h: "Value", f: (r: any) => money(r.amount) },
          { h: "Stage", f: (r: any) => r.stage },
          { h: "Idle", f: (r: any) => (r.idle_days == null ? "unknown" : `${r.idle_days}d`) },
        ]}
        rows={data.stale_deals}
        empty="No stale open deals."
      />
    </>
  );
}

function Digest({ data, ctx }: Props) {
  const [gid, setGid] = useState(ctx.status.digest_project_gid || "");

  async function save() {
    const r = await api.setDigestProject(gid.trim());
    ctx.patchStatus({ digest_project_gid: r.project_gid });
    ctx.notify(r.project_gid ? "Digest will post to that project." : "Digest turned off.", "ok");
  }

  return (
    <>
      <p>{data.changed ? <Badge kind="warn">changed since last run</Badge> : <Badge kind="ok">no change</Badge>}</p>
      <h3>SLA (overdue or &lt;24h)</h3>
      <Table
        cols={[
          { h: "Ticket", f: ticketLink },
          { h: "SLA", f: (r: any) => <Hrs n={r.hours_remaining} /> },
        ]}
        rows={data.digest.sla}
        empty="None."
      />
      <h3>Outreach collisions</h3>
      <p>{data.digest.collisions.join(", ") || "None."}</p>
      <h3>Churn-risk accounts with open deals</h3>
      <p>{data.digest.churn.join(", ") || "None."}</p>
      <h3>Scheduled delivery</h3>
      <div className="bar">
        <label>
          Asana project gid <input value={gid} onChange={e => setGid(e.target.value)} />
        </label>
        <button onClick={() => ctx.act(save)}>Save</button>
        <span className="muted">Empty = digest off.</span>
      </div>
    </>
  );
}

export const views: View[] = [
  {
    id: "accounts",
    title: "Connected accounts",
    blurb: "Tools Claude, ChatGPT, and other agents can use through this hub.",
    needs: [],
    top: true,
    params: [],
    load: () => api.accounts(),
    Body: Accounts,
  },
  {
    id: "account",
    title: "Provider tools",
    blurb: "",
    needs: [],
    nav: false,
    params: [],
    load: a => api.accountDetail(a.sub),
    Body: AccountDetail,
  },
  {
    id: "collision",
    title: "Outreach collision guard",
    blurb: "Contacts with an open ticket who are still active in an Outreach sequence or SalesLoft cadence.",
    needs: [["freshdesk"], CRMS, CADENCE],
    params: [],
    load: tool("outreach_collision_guard"),
    Body: Collision,
  },
  {
    id: "churn",
    title: "Churn risk radar",
    blurb: "Accounts scored by open tickets, reopens, high priority and SLA breaches. Flagged = has an open CRM deal.",
    needs: [["freshdesk"], CRMS, DEALS],
    params: [],
    load: tool("churn_risk_radar"),
    Body: Churn,
  },
  {
    id: "vip",
    title: "VIP ticket escalator",
    blurb: "Open tickets, with high-value accounts (open CRM deal) ranked above plain SLA order.",
    needs: [["freshdesk"], CRMS, DEALS],
    params: [{ name: "min_amount", label: "Min deal amount", type: "number", value: 0 }],
    load: (a, ctx) => tool("vip_ticket_escalator")({ min_amount: Number(a.min_amount) || 0 }, ctx),
    Body: Vip,
  },
  {
    id: "tasks",
    title: "Ticket → Asana task",
    blurb: "Hand bug tickets to engineering with a back-link, then comment on / close the ticket when the task completes.",
    needs: [["freshdesk"], ["asana"]],
    params: [PROJECT],
    load: tool("task_links"),
    Body: Tasks,
  },
  {
    id: "unlinked",
    title: "Unlinked requesters",
    blurb: "Freshdesk requesters that match no contact in any connected CRM.",
    needs: [["freshdesk"], CRMS],
    params: [],
    load: tool("unlinked_requester_finder"),
    Body: Unlinked,
  },
  {
    id: "triage",
    title: "Buying-signal triage",
    blurb: "Tickets that read like sales interest (pricing, demo, upgrade…). Keyword match, not an LLM — expect some noise.",
    needs: [["freshdesk"], CRMS],
    params: [PROJECT],
    load: tool("outreach_reply_triage"),
    Body: Triage,
  },
  {
    id: "repeated",
    title: "Repeated issues by account",
    blurb: "Tickets clustered per CRM company by fuzzy subject, so near-duplicates are caught.",
    needs: [["freshdesk"], CRMS],
    params: [],
    load: tool("repeated_issue_by_account"),
    Body: Repeated,
  },
  {
    id: "load",
    title: "Support load by segment",
    blurb: "Volume, first-response and resolution time. CRM region/owner are not available yet — company and Freshdesk fields only.",
    needs: [["freshdesk"]],
    params: [{ name: "group_by", label: "Group by", type: "select", options: ["company", "priority", "type", "source"] }],
    load: (a, ctx) => tool("support_load_by_segment")({ group_by: a.group_by || "company" }, ctx),
    Body: Load,
  },
  {
    id: "stale",
    title: "Stale deals vs open tickets",
    blurb: "Open deals with no recent activity whose account also has unresolved tickets — the deal may be stuck on support.",
    needs: [["freshdesk"], CRMS, DEALS],
    params: [{ name: "days", label: "Idle at least (days)", type: "number", value: 14 }],
    load: (a, ctx) => tool("stale_deal_vs_open_ticket")({ days: Number(a.days) || 14 }, ctx),
    Body: Stale,
  },
  {
    id: "followup-gaps",
    title: "Follow-up gaps",
    blurb: "Open tickets and open deals with no activity in N days — a combined review queue across support and sales.",
    needs: [["freshdesk"], CRMS, DEALS],
    params: [{ name: "days", label: "Idle at least (days)", type: "number", value: 7 }],
    load: (a, ctx) => tool("customer_followup_gap_detector")({ days: Number(a.days) || 7 }, ctx),
    Body: FollowupGaps,
  },
  {
    id: "digest",
    title: "Daily digest",
    blurb: "SLA, collision and churn checks. The backend cron runs this daily and posts one Asana task only when the result changed.",
    needs: [["freshdesk"]],
    params: [],
    load: tool("daily_digest"),
    Body: Digest,
  },
  {
    id: "crm-quality",
    title: "Data quality audit",
    blurb: "Cross-CRM analysis across your connected HubSpot, Salesforce, Zoho, Outreach, and SalesLoft accounts.",
    needs: [CRMS],
    nav: false,
    params: [],
    load: () => api.crmQuality(),
    Body: CrmQuality,
  },
  {
    id: "crm-360",
    title: "Customer 360",
    blurb: "Cross-CRM analysis across your connected HubSpot, Salesforce, Zoho, Outreach, and SalesLoft accounts.",
    needs: [CRMS],
    nav: false,
    params: [],
    load: a => (a.q ? api.crmSearch(a.q) : Promise.resolve({ query: "", providers_checked: [], providers_skipped: {}, found_in: [], records: [] })),
    Body: Crm360,
  },
  {
    id: "crm-duplicates-fuzzy",
    title: "Duplicate detection",
    blurb: "Cross-CRM analysis across your connected HubSpot, Salesforce, Zoho, Outreach, and SalesLoft accounts. Includes fuzzy name+phone/company matches beyond exact email, each tagged with a confidence.",
    needs: [CRMS],
    nav: false,
    params: [],
    load: () => api.crmDuplicatesFuzzy(),
    Body: CrmDuplicatesFuzzy,
  },
  {
    id: "crm-conflicts",
    title: "Field conflicts",
    blurb: "Cross-CRM analysis across your connected HubSpot, Salesforce, Zoho, Outreach, and SalesLoft accounts.",
    needs: [CRMS],
    nav: false,
    params: [],
    load: () => api.crmConflicts(),
    Body: CrmConflicts,
  },
  {
    id: "crm-stale",
    title: "Stale contacts",
    blurb: "Cross-CRM analysis across your connected HubSpot, Salesforce, Zoho, Outreach, and SalesLoft accounts.",
    needs: [CRMS],
    nav: false,
    params: [{ name: "days", label: "Idle at least (days)", type: "number", value: 90 }],
    load: a => api.crmStale(Number(a.days) || 90),
    Body: CrmStale,
  },
];
