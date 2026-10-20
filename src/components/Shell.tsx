"use client";

import { useEffect, useRef, useState } from "react";
import * as api from "@/lib/api";
import { views, type Ctx, type Kind, type View } from "@/lib/views";
import { Confirm, type Pending } from "./Confirm";
import { Login } from "./Login";
import { Sidebar } from "./Sidebar";

type Phase = "boot" | "login" | "app";
type Notice = { text: string; kind: Kind };

const paramKey = (name: string) => `ops_p_${name}`;

export default function Shell() {
  const [phase, setPhase] = useState<Phase>("boot");
  const [loginErr, setLoginErr] = useState("");
  const [status, setStatus] = useState<api.Status | null>(null);
  const [viewId, setViewId] = useState("");
  const [args, setArgs] = useState<Record<string, string>>({});
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notices, setNotices] = useState<Notice[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const argsRef = useRef<Record<string, string>>({});
  const seq = useRef(0);

  // "account/asana" -> view "account", sub "asana"
  const [viewName, sub = ""] = viewId.split("/");
  const view = views.find(v => v.id === viewName) ?? views.find(v => !v.top && v.nav !== false)!;
  // data belongs to whichever view last finished loading; a hash change swaps `view`
  // one render before the load effect below can clear it, so gate on view id too.
  const loadedFor = useRef("");
  const dataIsStale = loadedFor.current !== `${view.id}/${sub}`;

  function showLogin(err = "") {
    setStatus(null);
    setLoginErr(err);
    setPhase("login");
  }

  async function boot() {
    if (!api.hasToken()) return showLogin();
    try {
      setStatus(await api.status());
      setPhase("app");
    } catch (e) {
      showLogin(e instanceof api.AuthError ? "" : `Cannot reach API: ${(e as Error).message}`);
    }
  }

  // Context handed to views. Rebuilt each render, so closures see current state.
  const ctx: Ctx = {
    status: status as api.Status,
    args: () => argsRef.current,
    notify: (text, kind = "ok") => setNotices(n => [...n, { text, kind }]),
    rerun: () => load(view, argsRef.current),
    confirm: (name, preview) => new Promise<boolean>(resolve => setPending({ name, preview, resolve })),
    patchStatus: patch => setStatus(s => (s ? { ...s, ...patch } : s)),
    act: async fn => {
      try {
        await fn();
      } catch (e) {
        if (e instanceof api.AuthError) showLogin("Session expired.");
        else ctx.notify((e as Error).message, "bad");
      }
    },
  };

  async function load(v: View, a: Record<string, string>) {
    const id = ++seq.current;
    const key = `${v.id}/${a.sub ?? ""}`;
    setLoading(true);
    setNotices([]);
    setError("");
    try {
      v.params.filter(p => p.persist).forEach(p => api.store.set(paramKey(p.name), a[p.name] || ""));
      const d = await v.load(a, ctx);
      if (id === seq.current) {
        loadedFor.current = key;
        setData(d);
      }
    } catch (e) {
      if (id !== seq.current) return;
      if (e instanceof api.AuthError) return showLogin("Session expired.");
      setError((e as Error).message);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }

  function setArg(name: string, value: string) {
    argsRef.current = { ...argsRef.current, [name]: value };
    setArgs(argsRef.current);
  }

  async function signOut() {
    await api.logout();
    showLogin();
  }

  // Hash routing (#/collision) so the static export needs no dynamic routes.
  useEffect(() => {
    const read = () => setViewId(location.hash.slice(2));
    read();
    window.addEventListener("hashchange", read);
    boot();
    return () => window.removeEventListener("hashchange", read);
  }, []);

  // On view change: restore saved params (or defaults), then load.
  useEffect(() => {
    if (phase !== "app") return;
    const init = Object.fromEntries(
      view.params.map(p => [
        p.name,
        (p.persist && api.store.get(paramKey(p.name))) ||
          (p.value != null ? String(p.value) : (p.options?.[0] ?? "")),
      ]),
    );
    init.sub = sub;
    argsRef.current = init;
    setArgs(init);
    load(view, init);
  }, [phase, view.id, sub]);

  if (phase === "boot") return null;
  if (phase === "login") return <Login err={loginErr} onSignedIn={boot} />;

  const connected = new Set(Object.keys(status?.connections ?? {}));
  const missing = view.needs
    .filter(any => !any.some(p => connected.has(p)))
    .map(any => any.join(" or "));

  return (
    <>
      <div className="shell">
        <Sidebar email={status?.email ?? ""} views={views} activeId={view.id} onLogout={signOut} />
        <div className="main">
          <div className="main-inner">
            {missing.length > 0 && (
              <div className="banner">
                Not connected: {missing.join("; ")}.{" "}
                <a href="#/accounts">Connect accounts</a>
              </div>
            )}
            <h1 className="page-title">{view.title}</h1>
            <div className="page-sub">{view.blurb}</div>
            {view.params.length > 0 && (
              <form
                className="params"
                onSubmit={e => {
                  e.preventDefault();
                  load(view, argsRef.current);
                }}
              >
                {view.params.map(p => (
                  <label key={p.name}>
                    {p.label}
                    {p.type === "select" ? (
                      <select name={p.name} value={args[p.name] ?? ""} onChange={e => setArg(p.name, e.target.value)}>
                        {p.options?.map(o => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name={p.name}
                        type={p.type}
                        value={args[p.name] ?? ""}
                        onChange={e => setArg(p.name, e.target.value)}
                      />
                    )}
                  </label>
                ))}
                <button type="submit" disabled={loading}>
                  Run
                </button>
              </form>
            )}
            <div>
              {notices.map((n, i) => (
                <div key={i} className={`banner ${n.kind}`}>
                  {n.text}
                </div>
              ))}
              {loading || dataIsStale ? (
                <p className="muted">Loading…</p>
              ) : error ? (
                <p className="err">{error}</p>
              ) : data?.error ? (
                <div className="banner">{data.error}</div>
              ) : (
                data && <view.Body data={data} ctx={ctx} />
              )}
            </div>
          </div>
        </div>
      </div>
      <Confirm pending={pending} onDone={() => setPending(null)} />
    </>
  );
}
