/**
 * Shrinks phone photos before upload (a 4 MB photo becomes ~300 KB), which keeps saving
 * fast on mobile data. Falls back to the original file if the browser can't decode it
 * (e.g. HEIC on some browsers) — the original is then uploaded unchanged.
 */
const MAX_EDGE = 1600;

export async function prepareReceipt(file: File): Promise<{ blob: Blob; mimeType: string }> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || typeof createImageBitmap !== 'function') {
    return { blob: file, mimeType: file.type };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_000_000) {
      bitmap.close();
      return { blob: file, mimeType: file.type };
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.82));
    return blob && blob.size < file.size ? { blob, mimeType: 'image/jpeg' } : { blob: file, mimeType: file.type };
  } catch {
    return { blob: file, mimeType: file.type };
  }
}
