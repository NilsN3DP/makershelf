import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--app-bg)",
        padding: "2rem",
      }}
    >
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "2.5rem 3rem",
          maxWidth: "460px",
          width: "100%",
          boxShadow: "var(--shadow-lg)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--primary)",
            marginBottom: "12px",
          }}
        >
          404
        </p>
        <h1
          style={{
            fontSize: "26px",
            fontWeight: 800,
            color: "var(--text-main)",
            marginBottom: "12px",
            letterSpacing: "-0.02em",
          }}
        >
          Seite nicht gefunden
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "var(--text-muted)",
            lineHeight: 1.6,
            marginBottom: "2rem",
          }}
        >
          Diese Seite existiert nicht oder wurde verschoben.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-block",
            background: "var(--primary)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "14px",
            padding: "10px 24px",
            borderRadius: "8px",
            textDecoration: "none",
          }}
        >
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
