/**
 * ErrorBoundary — generic React error boundary used by feature routes
 * to keep an isolated crash from blanking the entire app shell (T11).
 *
 * The fallback is intentionally lightweight; feature routes can pass a
 * custom `fallback` ReactNode for a more contextual message. The reset
 * action is wired to component state — the consumer is responsible for
 * also invalidating the relevant React Query keys if a refetch is
 * desired.
 *
 * SECURITY: error messages are not rendered to the user except the
 * generic translated string. We intentionally do not display
 * `error.message` because it may carry server-shaped detail. Stack
 * traces are surfaced only in dev builds.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { withTranslation, type WithTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface Props extends WithTranslation {
  children: ReactNode;
  fallback?: ReactNode;
  /** Called when reset is clicked — useful to invalidate React Query keys. */
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryInner extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Pino-equivalent client-side log path is intentionally not added —
    // we leave instrumentation to a dedicated observability pipeline so
    // sensitive props never end up in plain console.log output (T13).
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    const { t } = this.props;

    return (
      <div
        role="alert"
        className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-border bg-card p-6 text-center"
      >
        <h2 className="text-base font-semibold text-ink">{t("common.error")}</h2>
        <p className="text-sm text-ink-muted">
          {t("common.errorDescription", {
            defaultValue: "An unexpected error occurred. Please try again.",
          })}
        </p>
        {import.meta.env.DEV && this.state.error?.message && (
          <pre className="max-h-32 w-full overflow-auto rounded-md bg-muted p-2 text-left font-mono text-xs text-destructive">
            {this.state.error.message}
          </pre>
        )}
        <Button type="button" size="sm" onClick={this.handleReset}>
          {t("common.retry")}
        </Button>
      </div>
    );
  }
}

export const ErrorBoundary = withTranslation()(ErrorBoundaryInner);
export default ErrorBoundary;
