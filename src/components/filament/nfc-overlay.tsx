"use client";

type NfcOverlayMode = "searching" | "reading" | "writing";

type Props = {
  mode: NfcOverlayMode;
  onCancel: () => void;
};

export function NfcOverlay({ mode, onCancel }: Props) {
  const isSearching = mode === "searching";
  const isWriting = mode === "writing";

  return (
    <>
      {/* Backdrop — slightly transparent so user sees the current drawer context */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 1100,
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Centered card */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1101,
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
          padding: "36px 32px",
          textAlign: "center",
          minWidth: "280px",
          maxWidth: "360px",
        }}
      >
        {/* Animated icon area */}
        <div
          style={{
            width: 72,
            height: 72,
            margin: "0 auto 20px",
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isSearching ? (
            <>
              {/* Track ring */}
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "3px solid var(--border)",
                }}
              />
              {/* Spinning arc */}
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "3px solid var(--primary)",
                  borderTopColor: "transparent",
                  animation: "nfc-spin 0.85s linear infinite",
                }}
              />
              {/* Search glass icon */}
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </>
          ) : (
            <>
              {/* Pulsing rings */}
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "2px solid var(--primary)",
                  opacity: 0.3,
                  animation: "nfc-pulse 1.6s ease-out infinite",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  inset: 10,
                  borderRadius: "50%",
                  border: "2px solid var(--primary)",
                  opacity: 0.5,
                  animation: "nfc-pulse 1.6s ease-out infinite 0.4s",
                }}
              />
              {/* NFC waves icon */}
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 7a9 9 0 0 1 0 10M4 7a9 9 0 0 0 0 10" />
                <path d="M17 9.5a5 5 0 0 1 0 5M7 9.5a5 5 0 0 0 0 5" />
                <circle cx="12" cy="12" r="1.5" fill="var(--primary)" />
              </svg>
            </>
          )}
        </div>

        <p
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--text-main)",
            marginBottom: "8px",
          }}
        >
          {isSearching
            ? "NFC-Reader suchen"
            : isWriting
              ? "NFC-Tag beschreiben"
              : "NFC-Tag einlesen"}
        </p>
        <p
          style={{
            fontSize: "13.5px",
            color: "var(--text-muted)",
            marginBottom: "28px",
            lineHeight: 1.5,
          }}
        >
          {isSearching
            ? "Suche nach verfügbarem NFC-Reader…"
            : isWriting
              ? "Halte ein beschreibbares NFC-Tag ans Gerät."
              : "Halte den NFC-Tag ans Gerät."}
        </p>

        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: "100%" }}
          onClick={onCancel}
        >
          Abbrechen
        </button>

        {/* Inline keyframes */}
        <style>{`
          @keyframes nfc-pulse {
            0%   { transform: scale(0.85); opacity: 0.5; }
            70%  { transform: scale(1.2);  opacity: 0; }
            100% { transform: scale(1.2);  opacity: 0; }
          }
          @keyframes nfc-spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </>
  );
}
