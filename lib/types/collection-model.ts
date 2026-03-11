/**
 * Represents a model from the Replicate Collections API.
 * Maps only the relevant fields from the API response.
 * `default_example` and `latest_version` are intentionally omitted.
 */
export interface CollectionModel {
  url: string;
  owner: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  run_count: number;
  created_at: string;
}
