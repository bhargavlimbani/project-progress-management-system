import { Component } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

/**
 * Catches a render-time crash in one page and shows a recoverable message
 * instead of letting React unmount the whole tree — which previously left the
 * user staring at a blank white screen with the error only in the console.
 *
 * Must be a class: there is no hook equivalent of componentDidCatch.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the full trace in the console for debugging.
    console.error("Page crashed:", error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    // Navigating away from a broken page should clear the error.
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isDev = import.meta.env?.DEV;

    return (
      <div className="glass-card" style={{ padding: 40, textAlign: "center", maxWidth: 640, margin: "40px auto" }}>
        <div
          style={{
            width: 60,
            height: 60,
            margin: "0 auto 18px",
            borderRadius: "50%",
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AlertTriangle size={26} color="var(--red-400)" />
        </div>

        <h2 style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: 8 }}>
          This page ran into a problem
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--slate-400)", lineHeight: 1.6, marginBottom: 22 }}>
          The rest of the app is still working — you can go back, or reload this page.
        </p>

        {isDev && (
          <pre
            style={{
              textAlign: "left",
              fontSize: "0.72rem",
              color: "var(--red-400)",
              background: "rgba(239,68,68,0.07)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 22,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {error?.message || String(error)}
          </pre>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => this.setState({ error: null })}
          >
            <RotateCcw size={15} />
            Try again
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.location.assign("/")}
          >
            <Home size={15} />
            Go to dashboard
          </button>
        </div>
      </div>
    );
  }
}
