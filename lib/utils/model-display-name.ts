/**
 * Converts a model ID (e.g. "black-forest-labs/flux-1.1-pro") into a
 * human-readable display name (e.g. "Flux 1.1 Pro").
 *
 * Algorithm:
 *  1. Split on "/" and take the last segment.
 *  2. Replace all hyphens with spaces.
 *  3. Apply Title Case (first letter of each word uppercased).
 *
 * Fallback: if no "/" is present the entire string is used as the name segment.
 * Empty string input returns an empty string.
 */
export function modelIdToDisplayName(modelId: string): string {
  if (!modelId) return "";

  const namePart = modelId.includes("/")
    ? modelId.split("/").pop() ?? modelId
    : modelId;

  return namePart
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
