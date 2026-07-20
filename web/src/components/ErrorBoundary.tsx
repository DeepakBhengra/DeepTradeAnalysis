import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Dashboard render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-kite-bg p-6 text-kite-text">
          <h1 className="m-0 text-lg font-semibold text-kite-red">Dashboard failed to load</h1>
          <p className="mt-2 text-sm text-kite-muted">
            Open DevTools (F12) → Console for full details. Try a hard refresh (Ctrl+Shift+R).
          </p>
          <pre className="mt-4 overflow-auto rounded border border-kite-border bg-kite-panel p-3 text-xs">
            {this.state.error.message}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
