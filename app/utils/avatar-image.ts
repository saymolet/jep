import { type Avatar, isValidAvatar } from "~/models/avatar";

/** Avatar photos are square images of this many pixels per side: twice the
 * largest display size (96 CSS px), so they stay sharp on retina screens. */
export const AVATAR_SIZE = 192;

/** Encoder qualities tried in order until the photo fits the size cap. */
const QUALITIES = [0.85, 0.7, 0.5, 0.3];

/** squareCrop returns the largest centered square of a width×height image. */
export function squareCrop(width: number, height: number) {
  const size = Math.min(width, height);
  return {
    sx: Math.floor((width - size) / 2),
    sy: Math.floor((height - size) / 2),
    size,
  };
}

/** encodeAvatar encodes a canvas as WebP, falling back to JPEG where the
 * browser can't encode WebP (it then silently returns a PNG, e.g. older
 * Safari). */
export function encodeAvatar(
  canvas: Pick<HTMLCanvasElement, "toDataURL">,
  quality: number,
): string {
  const webp = canvas.toDataURL("image/webp", quality);
  if (webp.startsWith("data:image/webp;")) {
    return webp;
  }
  return canvas.toDataURL("image/jpeg", quality);
}

/** fitAvatar encodes with decreasing quality until the result is a valid
 * avatar (which includes the size cap). Returns undefined if nothing fits. */
export function fitAvatar(
  canvas: Pick<HTMLCanvasElement, "toDataURL">,
): Avatar | undefined {
  for (const quality of QUALITIES) {
    const dataUrl = encodeAvatar(canvas, quality);
    if (isValidAvatar(dataUrl)) {
      return dataUrl;
    }
  }
  return undefined;
}

async function loadImage(
  file: Blob,
): Promise<{ source: CanvasImageSource; width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // Fall through to <img>, which decodes more formats on some browsers.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** imageFileToAvatar crops a picture to a centered square, scales it to
 * AVATAR_SIZE×AVATAR_SIZE and encodes it as a data: URL avatar — all in the
 * browser, so no file hosting is needed. Throws if the file can't be read as
 * an image. */
export async function imageFileToAvatar(file: Blob): Promise<Avatar> {
  const { source, width, height } = await loadImage(file);
  if (!width || !height) {
    throw new Error("Could not read the image");
  }
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not process the image");
  }
  // JPEG has no transparency; give transparent pictures a white background
  // rather than black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  ctx.imageSmoothingQuality = "high";
  const { sx, sy, size } = squareCrop(width, height);
  ctx.drawImage(source, sx, sy, size, size, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  if ("close" in source && typeof source.close === "function") {
    source.close();
  }
  const avatar = fitAvatar(canvas);
  if (!avatar) {
    throw new Error("Could not process the image");
  }
  return avatar;
}
