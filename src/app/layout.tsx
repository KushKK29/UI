import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Support Ops",
};

// Same theme bootstrap as the backend pages (connected_accounts.py): apply the
// saved theme before first paint so there is no flash.
const THEME_INIT = `try{var t=localStorage.getItem("hub_theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t);}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script sets data-theme on <html>, and
    // browser extensions may add attributes to <body> before hydration.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,600&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
