"use client";

import Link from "next/link";
import { useState } from "react";

export function InviteAcceptPageClient({ token }: { token: string }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [locale, setLocale] = useState<"de" | "en">("de");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8">
      <section className="panel-technical p-8 md:p-10">
        <p className="hero-kicker">Invite</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-main">
          Team-Einladung annehmen
        </h1>
        <p className="mt-4 max-w-2xl text-muted">
          Lege deinen Namen, dein Passwort und die bevorzugte Sprache fest, um dem Workspace beizutreten.
        </p>
      </section>

      <section className="section-shell p-8">
        {done ? (
          <div className="space-y-4">
            <p className="text-lg font-semibold text-main">{status}</p>
            <Link href="/login" className="btn-primary inline-flex px-5 py-3 text-sm font-semibold">
              Zum Login
            </Link>
          </div>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setStatus("");
              setError("");

              try {
                const response = await fetch("/api/invitations/accept", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ token, name, password, locale }),
                });
                const payload = (await response.json()) as {
                  ok?: boolean;
                  error?: string;
                  message?: string;
                };
                if (!response.ok || !payload.ok) {
                  throw new Error(payload.error || "Einladung konnte nicht angenommen werden.");
                }
                setDone(true);
                setStatus(payload.message || "Einladung angenommen.");
              } catch (nextError) {
                setError(
                  nextError instanceof Error ? nextError.message : "Einladung konnte nicht angenommen werden.",
                );
              }
            }}
          >
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name"
              required
            />
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Passwort"
              minLength={8}
              required
            />
            <select
              className="input"
              value={locale}
              onChange={(event) => setLocale(event.target.value as "de" | "en")}
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
            <button className="btn btn-primary">
              Einladung annehmen
            </button>
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </form>
        )}
      </section>
    </div>
  );
}
