/**
 * Geometry for the square profile-picture crop. The image is scaled to cover the crop
 * frame at zoom 1; zooming enlarges it and the offset pans it. Everything is clamped so
 * the frame is always fully covered by the image.
 */
export const AVATAR_OUTPUT_SIZE = 512;
export const MAX_ZOOM = 4;
export const MAX_AVATAR_INPUT_BYTES = 15 * 1024 * 1024;
export const ACCEPTED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export interface CropState {
  zoom: number;
  /** Offset of the image centre from the frame centre, in frame pixels. */
  offsetX: number;
  offsetY: number;
}

export const INITIAL_CROP: CropState = { zoom: 1, offsetX: 0, offsetY: 0 };

/** Scale (frame px per image px) at which the image just covers the frame. */
export function coverScale(imageWidth: number, imageHeight: number, frame: number): number {
  return frame / Math.min(imageWidth, imageHeight);
}

/** Keeps zoom within range and the image covering the whole frame. */
export function clampCrop(crop: CropState, imageWidth: number, imageHeight: number, frame: number): CropState {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, crop.zoom));
  const scale = coverScale(imageWidth, imageHeight, frame) * zoom;
  const maxX = Math.max(0, (imageWidth * scale - frame) / 2);
  const maxY = Math.max(0, (imageHeight * scale - frame) / 2);
  return {
    zoom,
    offsetX: Math.min(maxX, Math.max(-maxX, crop.offsetX)),
    offsetY: Math.min(maxY, Math.max(-maxY, crop.offsetY)),
  };
}

/** Source rectangle (image px) that the frame currently shows. */
export function sourceRect(crop: CropState, imageWidth: number, imageHeight: number, frame: number) {
  const scale = coverScale(imageWidth, imageHeight, frame) * crop.zoom;
  const size = frame / scale;
  const centreX = imageWidth / 2 - crop.offsetX / scale;
  const centreY = imageHeight / 2 - crop.offsetY / scale;
  return { x: centreX - size / 2, y: centreY - size / 2, size };
}

/** Validates the chosen file before decoding it. Returns an error message or null. */
export function validateAvatarFile(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_AVATAR_TYPES as readonly string[]).includes(file.type)) return 'יש לבחור תמונה מסוג JPG,‏ PNG או WebP.';
  if (file.size > MAX_AVATAR_INPUT_BYTES) return 'הקובץ גדול מדי (עד 15MB).';
  return null;
}
