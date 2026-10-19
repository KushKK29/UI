import type { ReactNode } from "react";

export type Tone = "" | "ok" | "warn" | "bad";

export function Badge({ kind = "", children }: { kind?: Tone; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

export function Stack({ items }: { items: ReactNode[] }) {
  return (
    <>
      {items.map((x, i) => (
        <div key={i}>{x}</div>
      ))}
    </>
  );
}

export const money = (n: number | null | undefined) => (n ? "$" + Math.round(n).toLocaleString() : "—");

export function Hrs({ n }: { n: number | null | undefined }) {
  if (n == null) return <>—</>;
  if (n < 0) return <Badge kind="bad">{-n}h overdue</Badge>;
  if (n < 24) return <Badge kind="warn">{n}h left</Badge>;
  return <>{n}h</>;
}

export type Col<T> = { h: string; f: (r: T) => ReactNode };

export function Table<T>({ cols, rows, empty = "Nothing to show." }: { cols: Col<T>[]; rows?: T[]; empty?: string }) {
  if (!rows?.length) return <div className="empty">{empty}</div>;
  return (
    <table>
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th key={i}>{c.h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {cols.map((c, j) => (
              <td key={j}>{c.f(r)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Skipped({ data }: { data: { providers_skipped?: Record<string, string> } }) {
  const s = Object.entries(data?.providers_skipped || {});
  if (!s.length) return null;
  return <div className="banner">Skipped: {s.map(([k, v]) => `${k} (${v})`).join("; ")}</div>;
}
