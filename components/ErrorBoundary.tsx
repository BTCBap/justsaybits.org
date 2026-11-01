import React, { Component, type PropsWithChildren } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  error: Error | null;
  attempt: number;
}

/** React.lazy caches a rejected import, so a chunk failure needs a reload. */
const isChunkError = (error: Error): boolean =>
  /dynamically imported module|Loading chunk|Importing a module script failed|Failed to fetch/i
    .test(`${error.name} ${error.message}`);

/**
 * Last-resort recovery for a render or lazy-chunk failure. The fallback keeps
 * the PS2 shell and offers a retry instead of a blank page.
 */
class ErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  private retry = () => {
    if (this.state.error && isChunkError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState((current) => ({ error: null, attempt: current.attempt + 1 }));
  };

  render() {
    if (!this.state.error) {
      return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
    }

    return (
      <div className="error-screen" role="alert">
        <div className="error-screen__panel">
          <p className="ps2-label error-screen__eyebrow">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            System error
          </p>
          <h1 className="ps2-screen-title error-screen__title">The screen did not load</h1>
          <p className="error-screen__copy">
            Something interrupted this view. Your settings are safe; try the screen again, or
            return to the main menu.
          </p>
          <div className="error-screen__actions">
            <button type="button" className="error-screen__button" onClick={this.retry} autoFocus>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
            <a className="error-screen__button" href="/">
              Main menu
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
