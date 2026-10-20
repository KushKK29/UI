import type { NextConfig } from "next";

// The backend (freshdesk-connector, FastAPI) runs separately. Its JSON API and
// its server-rendered pages are proxied through this app, so the browser only
// talks to one origin and session cookies stay same-site.
const BACKEND_URL = "https://fresh-desk-mcp.vercel.app";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Old backend page URLs now live in the SPA (hash routes).
  async redirects() {
    return [
      { source: "/connected-accounts", destination: "/#/accounts", permanent: false },
      { source: "/connected-accounts/:provider", destination: "/#/account/:provider", permanent: false },
      { source: "/login", destination: "/", permanent: false },
      { source: "/signup", destination: "/", permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/crm-ops", destination: `${BACKEND_URL}/crm-ops` },
      { source: "/crm-ops/:path*", destination: `${BACKEND_URL}/crm-ops/:path*` },
    ];
  },
};

export default nextConfig;
