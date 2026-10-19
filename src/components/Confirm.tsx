"use client";

import { useEffect, useRef } from "react";

export type Pending = { name: string; preview: unknown; resolve: (ok: boolean) => void };

// Native <dialog> confirm for write tools. Resolves the pending promise on close.
export function Confirm({ pending, onDone }: { pending: Pending | null; onDone: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (pending) ref.current?.showModal();
  }, [pending]);

  return (
    <dialog
      ref={ref}
      onClose={() => {
        pending?.resolve(ref.current?.returnValue === "ok");
        onDone();
      }}
    >
      <form method="dialog">
        <h2>Confirm action</h2>
        <p className="muted">{pending?.name}</p>
        <pre>{JSON.stringify(pending?.preview, null, 2)}</pre>
        <menu>
          <button value="cancel" className="ghost">
            Cancel
          </button>
          <button value="ok">Confirm</button>
        </menu>
      </form>
    </dialog>
  );
}
