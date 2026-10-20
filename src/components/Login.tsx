"use client";

import { useState, type FormEvent } from "react";
import { login, signup } from "@/lib/api";

// Same card as the backend login page (oauth_server.py _auth_form_page).
export function Login({ err, onSignedIn }: { err: string; onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(err);
  const [mode, setMode] = useState<"login" | "signup">("login");

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await (mode === "login" ? login : signup)(email, password);
      setPassword("");
      onSignedIn();
    } catch (x) {
      setError((x as Error).message);
    }
  }

  return (
    <div className="login-page">
      <form className="card" onSubmit={submit}>
        <div className="logo-row">
          <div className="logo-badge" />
          <div className="logo-text">Connector Hub</div>
        </div>
        <h1>{mode === "login" ? "Log in" : "Sign up"}</h1>
        {error && <div className="banner bad">{error}</div>}
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          required
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          placeholder="At least 8 characters"
          required
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <div className="actions">
          <button type="submit">{mode === "login" ? "Log in" : "Sign up"}</button>
        </div>
        <p className="muted">
          <a
            href="#"
            onClick={e => {
              e.preventDefault();
              setError("");
              setMode(mode === "login" ? "signup" : "login");
            }}
          >
            {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Log in"}
          </a>
        </p>
      </form>
    </div>
  );
}
