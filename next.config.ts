import type { NextConfig } from "next";

// The backend (freshdesk-connector, FastAPI) runs separately. Its JSON API and
// its server-rendered pages are proxied through this app, so the browser only
// talks to one origin and session cookies stay same-site.
const BACKEND_URL = "https://fresh-desk-mcp.vercel.app";

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      { source: "/connected-accounts", destination: `${BACKEND_URL}/connected-accounts` },
      { source: "/connected-accounts/:path*", destination: `${BACKEND_URL}/connected-accounts/:path*` },
      { source: "/crm-ops", destination: `${BACKEND_URL}/crm-ops` },
      { source: "/crm-ops/:path*", destination: `${BACKEND_URL}/crm-ops/:path*` },
    ];
  },
};

export default nextConfig;
