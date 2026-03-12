/**
 * Custom MIME type for gallery-to-slot drag & drop.
 * Used in dataTransfer.setData/getData to distinguish gallery drags
 * from native file drops.
 */
export const GALLERY_DRAG_MIME_TYPE = "application/x-aifactory-generation";

/**
 * Payload shape transferred during a gallery drag operation.
 */
export interface GalleryDragPayload {
  generationId: string;
  imageUrl: string;
}
