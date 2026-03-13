/**
 * Wrapper around the CSS View Transitions API with graceful degradation.
 *
 * When `document.startViewTransition` is available (Chrome 111+, Safari 18+,
 * Firefox 133+), the callback runs inside a view transition so the browser
 * can animate matching `view-transition-name` elements.
 *
 * In unsupported browsers the callback executes immediately without any
 * animation — the feature degrades gracefully.
 *
 * @param callback - State update to run inside the view transition.
 */
export function startViewTransitionIfSupported(callback: () => void): void {
  if (
    typeof document !== "undefined" &&
    "startViewTransition" in document &&
    typeof (document as any).startViewTransition === "function"
  ) {
    (document as any).startViewTransition(callback);
  } else {
    callback();
  }
}
