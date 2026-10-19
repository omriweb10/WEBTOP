/**
 * Saving and opening local files. On iPhone the Web Share sheet ("Save to Files",
 * AirDrop, Mail…) is the most reliable way to hand a generated file to the user,
 * so it is preferred when the browser can share files; otherwise a download link is used.
 */

export type SaveFileOutcome = 'shared' | 'downloaded' | 'cancelled';

/** Offers a text file to the user via the share sheet or a download. */
export async function saveTextFile(fileName: string, text: string, mimeType: string): Promise<SaveFileOutcome> {
  const blob = new Blob([text], { type: mimeType });
  const file = typeof File === 'function' ? new File([blob], fileName, { type: mimeType }) : null;

  if (file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Fall through to a plain download when sharing is refused for other reasons.
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return 'downloaded';
}

/** Reads a user-picked file as UTF-8 text. */
export function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsText(file);
  });
}
