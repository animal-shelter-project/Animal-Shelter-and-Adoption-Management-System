// Preparing a photo for upload: animal photos (v2), profile pictures and
// home photos on applications. Kept out of the component file
// so that file exports only a component (eslint react-refresh rule).

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const readAsDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('We couldn’t read that file. Please choose another photo.'));
    reader.readAsDataURL(blob);
  });

// Shrinks a large photo. Resolves to a Blob, or null if the browser can't.
async function shrink(file, maxSide = 1600) {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  } catch {
    return null;
  }
}

// maxSide: also make a smaller copy when the browser can (e.g. 512 px for a
// profile picture), so uploads stay small. The original is used if not.
export async function photoToDataUrl(file, { maxSide } = {}) {
  if (!PHOTO_TYPES.includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP photo.');
  let blob = file;
  if (maxSide) blob = (await shrink(file, maxSide)) || file;
  if (blob.size > MAX_PHOTO_BYTES) {
    blob = await shrink(file, maxSide);
    if (!blob || blob.size > MAX_PHOTO_BYTES) throw new Error('Photos must be 2 MB or smaller.');
  }
  return readAsDataUrl(blob);
}
