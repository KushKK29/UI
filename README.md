# Support Ops UI

Next.js (App Router, TypeScript) front end for the freshdesk-connector backend (FastAPI, `../freshdesk-connector`).
The UI proxies `/api/*` and `/connected-accounts` to the backend, so the browser talks to one origin only.

Full stack, two terminals:

```
# 1. backend (port 8004)
cd ../freshdesk-connector
uvicorn mcp_http_server:app --app-dir src --port 8004

# 2. UI (port 3000)
cd ../freshdesk-connector-ui
npm install
npm run dev
```

Open http://localhost:3000 and sign in with your connector hub account. No API URL to enter.

Production: `npm run build && npm start`. Backend location is set by `BACKEND_URL` (default `http://localhost:8004`).

Connecting Freshdesk / CRMs / Asana happens on the *Connected accounts* page (link in the sidebar),
served by the backend through this app's proxy.

Deploy the UI and backend behind one domain (reverse proxy), or point `BACKEND_URL` at the backend.

Files: `src/lib/api.ts` (fetch + confirm flow), `src/lib/views.tsx` (one entry per tool view), `src/components/Shell.tsx` (routing, params, run loop), `src/components/Login.tsx`, `src/components/Confirm.tsx`, `src/lib/ui.tsx` (table/badge helpers).
# UI
