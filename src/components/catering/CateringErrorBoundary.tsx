import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class CateringErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[CateringErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center" style={{ color: 'var(--aurora-text-secondary)' }}>
          <AlertTriangle size={40} className="mb-3" style={{ color: '#F59E0B' }} />
          <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--aurora-text)' }}>
            {this.props.fallbackTitle || 'Something went wrong'}
          </h3>
          <p className="text-sm mb-4">
            An unexpected error occurred. Please try refreshing.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#6366F1' }}
          >
            <RefreshCw size={14} />
            Try Again
          </button>
          {this.state.error && (
            <details className="mt-4 text-xs text-left max-w-md">
              <summary style={{ color: 'var(--aurora-text-muted)', cursor: 'pointer' }}>Error details</summary>
              <pre className="mt-2 p-2 rounded overflow-auto" style={{ backgroundColor: 'var(--aurora-surface)', color: 'var(--aurora-text-muted)' }}>
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
