import React, { Component, type ReactNode, type ErrorInfo } from "react";
import styles from "./ErrorBoundary.module.css";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleRetry = () => {
    // Clear persisted session data that might be corrupted
    try {
      localStorage.removeItem("aetheria_session");
      localStorage.removeItem("aetheria_user_id");
    } catch {
      // Ignore localStorage errors during cleanup
    }
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.errorContainer}>
          <div className={styles.errorContent}>
            <h2 className={styles.errorTitle}>Etwas ist schiefgelaufen</h2>
            <p className={styles.errorText}>
              Ein unerwarteter Fehler ist aufgetreten. Deine Sitzungsdaten wurden
              moeglicherweise beschaedigt.
            </p>
            {this.state.error && (
              <pre className={styles.errorDetails}>
                {this.state.error.message}
              </pre>
            )}
            <button className={styles.retryButton} onClick={this.handleRetry}>
              Neu starten
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
