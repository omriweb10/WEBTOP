/** Browser-side image work for profile pictures: decoding and the final square export. */
import { AVATAR_OUTPUT_SIZE, sourceRect, type CropState } from './avatarCrop';

export interface LoadedImage {
  element: HTMLImageElement;
  width: number;
  height: number;
  url: string;
}

/** Decodes a chosen file (EXIF orientation is applied by the browser). */
export async function loadImageFile(file: Blob): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  const element = new Image();
  element.src = url;
  try {
    await element.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('decode_failed');
  }
  return { element, width: element.naturalWidth, height: element.naturalHeight, url };
}

/** Encodes a canvas, falling back when the browser cannot produce the requested type. */
function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Renders the visible crop to a 512×512 square, preferring WebP and falling back to JPEG
 * (Safari cannot encode WebP from a canvas). Metadata such as EXIF/GPS is not carried over.
 */
export async function exportAvatar(image: LoadedImage, crop: CropState, frame: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_OUTPUT_SIZE;
  canvas.height = AVATAR_OUTPUT_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas_unavailable');
  context.imageSmoothingQuality = 'high';
  const { x, y, size } = sourceRect(crop, image.width, image.height, frame);
  context.drawImage(image.element, x, y, size, size, 0, 0, AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE);
  const webp = await toBlob(canvas, 'image/webp', 0.88);
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await toBlob(canvas, 'image/jpeg', 0.88);
  if (!jpeg) throw new Error('encode_failed');
  return jpeg;
}
