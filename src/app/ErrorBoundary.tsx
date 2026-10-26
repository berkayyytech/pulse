import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallbackLabel?: string;
}

interface ErrorBoundaryState {
  readonly hasError: boolean;
  readonly message: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  public static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unexpected view error',
    };
  }

  public override componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Intentionally local-only; zero external crash telemetry
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <section className="pulse-card" role="alert">
          <h2>{this.props.fallbackLabel ?? 'This section encountered an error'}</h2>
          <p>{this.state.message}</p>
          <button
            type="button"
            className="pulse-nav-btn"
            onClick={() => {
              this.setState({ hasError: false, message: '' });
            }}
          >
            Reload view
          </button>
        </section>
      );
    }
    return this.props.children;
  }
}
