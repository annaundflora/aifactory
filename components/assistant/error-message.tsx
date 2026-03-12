"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ErrorMessageProps {
  /** The error description text to display */
  message: string;
  /** Callback to retry the last user message. If omitted, no retry button is shown. */
  onRetry?: () => void;
  /** Number of retries attempted so far (0-based). At 3, no retry button is shown. */
  retryCount: number;
  /** Whether a retry is currently in progress */
  isRetrying?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const PERMANENT_ERROR_MESSAGE =
  "Der Assistent ist gerade nicht verfuegbar. Bitte versuche es spaeter erneut.";

// ---------------------------------------------------------------------------
// ErrorMessage Component
// ---------------------------------------------------------------------------

/**
 * Error bubble component for the chat thread.
 *
 * Displays a red-tinted chat bubble with a warning icon and error text.
 * Optionally shows a retry button (if retryCount < 3 and onRetry is provided).
 * After 3 failed retries, shows a permanent error message with no retry option.
 *
 * AC-3: Red-tinted bubble with warning icon and error text
 * AC-4: Retry button when retryCount < 3, calls onRetry, shows spinner
 * AC-5: Permanent error after 3 retries, no retry button
 * AC-9: Standalone component with message, onRetry?, retryCount props
 */
export function ErrorMessage({
  message,
  onRetry,
  retryCount,
  isRetrying = false,
}: ErrorMessageProps) {
  const isPermanentError = retryCount >= MAX_RETRIES;
  const displayMessage = isPermanentError ? PERMANENT_ERROR_MESSAGE : message;
  const showRetryButton = !isPermanentError && onRetry != null;

  return (
    <div className="flex w-full justify-start" data-testid="error-message">
      <div
        className={cn(
          "max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed",
          "bg-destructive/10 border border-destructive/20"
        )}
      >
        {/* Error content with warning icon */}
        <div className="flex items-start gap-2">
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <span className="text-destructive">{displayMessage}</span>
        </div>

        {/* Retry button (AC-4) */}
        {showRetryButton && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
                "bg-destructive/10 text-destructive hover:bg-destructive/20",
                "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              data-testid="retry-btn"
            >
              <RefreshCw
                className={cn("h-3 w-3", isRetrying && "animate-spin")}
                aria-hidden="true"
              />
              {isRetrying ? "Versuche erneut..." : "Erneut versuchen"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
