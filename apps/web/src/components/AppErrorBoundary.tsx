import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Molecular Workstation failed to render", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="runtime-error-screen">
        <div className="runtime-error-card">
          <div className="runtime-error-mark">!</div>
          <span className="eyebrow">MOLECULAR WORKSTATION · G1B</span>
          <h1>The workstation could not start</h1>
          <p>The browser loaded the shell but hit a runtime error. Start the app from the repository root with the commands below.</p>
          <pre>npm install{`\n`}npm run dev</pre>
          <small>{this.state.error.message}</small>
        </div>
      </main>
    );
  }
}
