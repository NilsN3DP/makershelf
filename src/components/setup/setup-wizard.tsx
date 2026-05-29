"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { text } from "@/src/lib/locale";
import { getRuntimeConfig } from "@/src/lib/runtime-config";

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const raw = await response.text();
  if (!raw.trim()) throw new Error(fallbackMessage);
  try { return JSON.parse(raw) as T; } catch { throw new Error(fallbackMessage); }
}

type SetupWizardProps = {
  initialServerStatus?: { bootstrapRequired: boolean };
};

function downloadBackupCodesFile(codes: string[], label: string) {
  if (!codes.length) return;
  const content = [
    "makershelf Backup Codes",
    `Account: ${label}`,
    `Generated: ${new Date().toLocaleString("de-DE")}`,
    "",
    ...codes,
    "",
    "Store these codes in a safe place.",
  ].join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `makershelf-backup-codes-${label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function StepTrack({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "2rem" }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: "4px",
            borderRadius: "2px",
            background: i < step ? "var(--primary)" : i === step ? "var(--primary)" : "var(--border)",
            opacity: i < step ? 0.4 : 1,
            transition: "background 0.2s",
          }}
        />
      ))}
    </div>
  );
}

export function SetupWizard({ initialServerStatus }: SetupWizardProps) {
  const { settings } = useMakershelf();
  const demoMode = getRuntimeConfig().demoMode;

  const [bootstrapRequired, setBootstrapRequired] = useState(
    initialServerStatus?.bootstrapRequired ?? true,
  );
  const [workspaceName, setWorkspaceName] = useState("makershelf");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [filamentVaultEnabled, setFilamentVaultEnabled] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState<{
    otpauthUrl: string;
    backupCodes: string[];
  } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  // Load server status on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/system/status", { cache: "no-store" });
        const payload = (await response.json()) as { bootstrapRequired?: boolean };
        if (!cancelled) setBootstrapRequired(Boolean(payload.bootstrapRequired));
      } catch {
        // keep default
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // Generate QR code when bootstrap result is set
  useEffect(() => {
    let cancelled = false;
    async function buildQr() {
      if (!bootstrapResult?.otpauthUrl) { setQrDataUrl(""); return; }
      try {
        const dataUrl = await QRCode.toDataURL(bootstrapResult.otpauthUrl, {
          margin: 2, scale: 7, color: { dark: "#0f172a", light: "#ffffff" },
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setQrDataUrl("");
      }
    }
    void buildQr();
    return () => { cancelled = true; };
  }, [bootstrapResult?.otpauthUrl]);

  async function handleBootstrap(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/system/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceName, adminName, adminEmail, adminPassword, filamentVaultEnabled }),
      });
      const payload = await readJsonResponse<{
        ok?: boolean; error?: string;
        totpSetup?: { otpauthUrl: string; backupCodes: string[] };
      }>(response, "Bootstrap fehlgeschlagen.");
      if (!response.ok || !payload.ok || !payload.totpSetup) {
        throw new Error(payload.error || "Bootstrap fehlgeschlagen.");
      }
      setBootstrapResult(payload.totpSetup);
      setBootstrapRequired(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Einrichtung fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  async function handleReset() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/system/reset", { method: "POST" });
      const payload = await readJsonResponse<{ ok?: boolean; error?: string }>(
        response, "Zurücksetzen fehlgeschlagen.",
      );
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Zurücksetzen fehlgeschlagen.");
      setBootstrapResult(null);
      setBootstrapRequired(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Zurücksetzen fehlgeschlagen.");
    } finally {
      setPending(false);
    }
  }

  // ── Step 2: 2FA setup ──────────────────────────────────────────────────
  if (bootstrapResult) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--app-bg)", padding: "3rem 2rem", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: "560px" }}>
          <div style={{ marginBottom: "2rem" }}>
            <p style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-soft)", marginBottom: "6px" }}>
              {text(settings.language, "Schritt 2 von 2", "Step 2 of 2")}
            </p>
            <StepTrack step={2} total={2} />
            <h1 style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-main)", marginBottom: "8px" }}>
              {text(settings.language, "2FA einrichten", "Set up 2FA")}
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: 1.6 }}>
              {text(
                settings.language,
                "Scanne den QR-Code mit deiner Authenticator-App und sichere die Backup-Codes.",
                "Scan the QR code with your authenticator app and save the backup codes.",
              )}
            </p>
          </div>

          <div className="panel" style={{ padding: "1.5rem", marginBottom: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "152px 1fr", gap: "1.5rem", alignItems: "start" }}>
              <div style={{ background: "#fff", borderRadius: "12px", padding: "10px" }}>
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="2FA QR Code" style={{ width: "100%", borderRadius: "6px", display: "block" }} />
                ) : (
                  <div style={{ aspectRatio: "1", background: "var(--panel-muted)", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                    ...
                  </div>
                )}
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: "14px", marginBottom: "6px", color: "var(--text-main)" }}>
                  {text(settings.language, "Authenticator-App öffnen", "Open authenticator app")}
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "12px" }}>
                  {text(
                    settings.language,
                    "z.B. Google Authenticator, 2FAS, Aegis, Authy oder Microsoft Authenticator.",
                    "e.g. Google Authenticator, 2FAS, Aegis, Authy or Microsoft Authenticator.",
                  )}
                </p>
                <details>
                  <summary style={{ cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "var(--primary)" }}>
                    {text(settings.language, "Manueller Schlüssel", "Manual key")}
                  </summary>
                  <p style={{ marginTop: "6px", fontSize: "11px", wordBreak: "break-all", color: "var(--text-muted)", lineHeight: 1.5 }}>
                    {bootstrapResult.otpauthUrl}
                  </p>
                </details>
              </div>
            </div>
          </div>

          <div className="panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
            <p style={{ fontWeight: 600, fontSize: "14px", marginBottom: "12px", color: "var(--text-main)" }}>
              {text(settings.language, "Backup-Codes", "Backup codes")}
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "12px", lineHeight: 1.5 }}>
              {text(
                settings.language,
                "Bewahre diese Codes sicher auf — sie sind die einzige Möglichkeit, das Konto ohne 2FA zu entsperren.",
                "Keep these codes safe — they are the only way to unlock the account without 2FA.",
              )}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "14px" }}>
              {bootstrapResult.backupCodes.map((code) => (
                <code key={code} style={{ display: "block", background: "var(--panel-muted)", padding: "7px 10px", borderRadius: "6px", fontSize: "12.5px", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                  {code}
                </code>
              ))}
            </div>
            <button
              type="button"
              onClick={() => downloadBackupCodesFile(bootstrapResult.backupCodes, adminEmail || workspaceName)}
              className="btn btn-secondary btn-sm"
            >
              {text(settings.language, "Als Textdatei laden", "Download as text file")}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              {text(settings.language, "Login: ", "Login: ")}{adminEmail}
            </p>
            <Link href="/login" className="btn btn-primary">
              {text(settings.language, "Zum Login →", "Go to login →")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Already set up ─────────────────────────────────────────────────────
  if (!bootstrapRequired) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--app-bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ width: "100%", maxWidth: "460px" }}>
          <div className="panel" style={{ padding: "2rem", textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--primary-soft)", color: "var(--primary)", display: "grid", placeItems: "center", margin: "0 auto 1.25rem" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h1 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "8px" }}>
              {text(settings.language, "Setup bereits abgeschlossen", "Setup already complete")}
            </h1>
            <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: 1.6, marginBottom: "1.5rem" }}>
              {demoMode
                ? text(settings.language, "Für diese Demo existiert bereits ein Workspace. Melde dich mit dem Demo-Zugang an.", "This demo already has a workspace. Sign in with the demo account.")
                : text(settings.language, "Für diese Installation existiert bereits ein Workspace.", "A workspace already exists for this installation.")}
            </p>
            {error && (
              <div style={{ padding: "10px 14px", borderRadius: "8px", background: "var(--danger-soft)", color: "var(--danger)", fontSize: "13px", marginBottom: "12px", textAlign: "left" }}>
                {error}
              </div>
            )}
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <Link href="/login" className="btn btn-primary">
                {text(settings.language, "Zum Login", "Sign in")}
              </Link>
              {!demoMode && (
                <button type="button" onClick={() => void handleReset()} className="btn btn-ghost" disabled={pending}>
                  {pending ? text(settings.language, "...", "...") : text(settings.language, "Setup zurücksetzen", "Reset setup")}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Create workspace + admin ───────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "var(--app-bg)", padding: "3rem 2rem", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: "560px" }}>
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-soft)", marginBottom: "6px" }}>
            {text(settings.language, "Schritt 1 von 2", "Step 1 of 2")}
          </p>
          <StepTrack step={1} total={2} />
          <h1 style={{ fontSize: "26px", fontWeight: 800, color: "var(--text-main)", marginBottom: "8px" }}>
            {text(settings.language, "Server einrichten", "Set up server")}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", lineHeight: 1.6 }}>
            {text(
              settings.language,
              "Workspace-Name und ersten Administrator anlegen. Danach wird automatisch 2FA für den Admin eingerichtet.",
              "Create the workspace name and first administrator. 2FA for the admin will be set up automatically afterwards.",
            )}
          </p>
        </div>

        <form onSubmit={handleBootstrap}>
          <div className="panel" style={{ padding: "1.5rem", marginBottom: "1rem" }}>
            <p style={{ fontWeight: 700, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-soft)", marginBottom: "14px" }}>
              {text(settings.language, "Workspace", "Workspace")}
            </p>
            <label className="grid gap-2" style={{ marginBottom: "1rem" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>
                {text(settings.language, "Name", "Name")}
              </span>
              <input
                className="input"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="makershelf"
                required
              />
            </label>
          </div>

          <div className="panel" style={{ padding: "1.5rem", marginBottom: "1rem" }}>
            <p style={{ fontWeight: 700, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-soft)", marginBottom: "14px" }}>
              {text(settings.language, "Administrator", "Administrator")}
            </p>
            <div style={{ display: "grid", gap: "12px" }}>
              <label className="grid gap-2">
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>
                  {text(settings.language, "Name", "Name")}
                </span>
                <input
                  className="input"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder={text(settings.language, "Dein Name", "Your name")}
                  required
                />
              </label>
              <label className="grid gap-2">
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>
                  E-Mail
                </span>
                <input
                  className="input"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="username"
                  required
                />
              </label>
              <label className="grid gap-2">
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-main)" }}>
                  {text(settings.language, "Passwort", "Password")}
                  <span style={{ fontSize: "12px", fontWeight: 400, color: "var(--text-muted)", marginLeft: "6px" }}>
                    (min. 8 {text(settings.language, "Zeichen", "chars")})
                  </span>
                </span>
                <input
                  className="input"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </label>
            </div>
          </div>

          <div className="panel" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
            <label style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", cursor: "pointer" }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-main)", marginBottom: "4px" }}>
                  Filament Vault
                </p>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {text(
                    settings.language,
                    "Spulenverwaltung mit privaten und geteilten Beständen aktivieren.",
                    "Enable spool management with private and shared inventory.",
                  )}
                </p>
              </div>
              <label className="toggle" style={{ flexShrink: 0, marginTop: "2px" }}>
                <input
                  type="checkbox"
                  checked={filamentVaultEnabled}
                  onChange={(e) => setFilamentVaultEnabled(e.target.checked)}
                />
                <span className="toggle-track" />
              </label>
            </label>
          </div>

          {error && (
            <div style={{ padding: "12px 16px", borderRadius: "10px", background: "var(--danger-soft)", color: "var(--danger)", fontSize: "13.5px", fontWeight: 500, marginBottom: "1rem" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="btn btn-primary" disabled={pending} style={{ minWidth: "160px" }}>
              {pending
                ? text(settings.language, "Wird erstellt...", "Creating...")
                : text(settings.language, "Workspace erstellen →", "Create workspace →")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
