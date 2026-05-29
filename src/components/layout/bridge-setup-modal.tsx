"use client";

import { useMakershelf } from "@/src/components/providers/makershelf-provider";
import { text } from "@/src/lib/locale";

type Props = {
  onInstalled: () => void;
  onSkip: () => void;
};

export function BridgeSetupModal({ onInstalled, onSkip }: Props) {
  const { settings } = useMakershelf();
  const lang = settings.language;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onSkip(); }}
    >
      <div
        className="panel"
        style={{
          maxWidth: 480, width: "100%", padding: "32px",
          borderRadius: "20px", position: "relative",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 48, height: 48, borderRadius: "14px",
            background: "var(--primary-soft)", color: "var(--primary)",
            marginBottom: "16px", fontSize: "22px",
          }}>
            🔗
          </div>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-main)", margin: "0 0 8px" }}>
            {text(lang, "makershelf Bridge einrichten", "Set up makershelf Bridge")}
          </h2>
          <p style={{ fontSize: "13.5px", color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
            {text(
              lang,
              "Um Dateien direkt im Slicer zu öffnen, wird einmalig ein kleines Skript auf deinem Computer installiert. Kein Dienst, kein Hintergrundprozess — nur ein Windows-Protokoll.",
              "To open files directly in your slicer, a small script needs to be installed once on your computer. No service, no background process — just a Windows protocol.",
            )}
          </p>
        </div>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
          {[
            {
              num: "1",
              title: text(lang, "Skript herunterladen", "Download script"),
              desc: text(lang, "Klick auf den Button unten", "Click the button below"),
              action: (
                <a
                  href="/api/system/makershelf-bridge"
                  download="install-makershelf-bridge.ps1"
                  className="btn btn-primary btn-sm"
                  style={{ textDecoration: "none", whiteSpace: "nowrap" }}
                >
                  {text(lang, "⬇ Skript herunterladen", "⬇ Download script")}
                </a>
              ),
            },
            {
              num: "2",
              title: text(lang, "Skript ausführen", "Run script"),
              desc: text(
                lang,
                "Rechtsklick auf die heruntergeladene Datei → \"Mit PowerShell ausführen\"",
                "Right-click the downloaded file → \"Run with PowerShell\"",
              ),
            },
            {
              num: "3",
              title: text(lang, "Erneut installieren erlaubt", "Reinstall is okay"),
              desc: text(
                lang,
                "Wenn die Bridge schon installiert war, fuehre das Skript trotzdem erneut aus. Dadurch wird der Protokoll-Handler aktualisiert.",
                "If the Bridge was already installed, run the script again anyway. This updates the protocol handler.",
              ),
            },
            {
              num: "4",
              title: text(lang, "Browser-Anfrage bestätigen", "Confirm browser prompt"),
              desc: text(
                lang,
                "Beim ersten Klick fragt der Browser einmalig: \"Mit makershelf Bridge öffnen?\" -> Ja / Immer erlauben",
                "On the first click, the browser asks once: \"Open with makershelf Bridge?\" -> Yes / Always allow",
              ),
            },
          ].map((step) => (
            <div
              key={step.num}
              style={{
                display: "flex", gap: "14px", alignItems: "flex-start",
                background: "var(--panel-muted)", borderRadius: "12px",
                padding: "14px 16px",
              }}
            >
              <div style={{
                minWidth: 28, height: 28, borderRadius: "50%",
                background: "var(--primary)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "13px", fontWeight: 700, flexShrink: 0,
              }}>
                {step.num}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-main)", marginBottom: "3px" }}>
                  {step.title}
                </div>
                <div style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: 1.5 }}>
                  {step.desc}
                </div>
                {step.action && <div style={{ marginTop: "10px" }}>{step.action}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={onInstalled}>
            {text(lang, "Fertig — Datei jetzt öffnen", "Done — open file now")}
          </button>
          <button className="btn btn-ghost" onClick={onSkip}>
            {text(lang, "Überspringen", "Skip")}
          </button>
        </div>

        <p style={{ fontSize: "11.5px", color: "var(--text-soft)", marginTop: "14px", lineHeight: 1.5 }}>
          {text(
            lang,
            "Das Skript registriert das makershelf:// Protokoll für deinen Windows-Benutzer (HKCU). Keine Admin-Rechte notwendig.",
            "The script registers the makershelf:// protocol for your Windows user (HKCU). No admin rights required.",
          )}
        </p>
      </div>
    </div>
  );
}
