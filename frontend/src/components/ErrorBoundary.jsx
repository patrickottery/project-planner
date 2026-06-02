import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        gap: 16,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: "var(--bg, #0f1117)",
        color: "var(--text, #e2e8f0)",
      }}>
        <p style={{ fontSize: 16, fontWeight: 600 }}>Something went wrong.</p>
        <pre style={{
          fontSize: 12,
          color: "var(--text-muted, #8892a4)",
          maxWidth: 600,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          textAlign: "left",
        }}>
          {this.state.error.message}
        </pre>
        <button
          onClick={() => { this.setState({ error: null }); window.location.reload(); }}
          style={{
            padding: "8px 18px",
            background: "var(--accent, #6366f1)",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
